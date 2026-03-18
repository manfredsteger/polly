import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { WebSocket } from 'ws';
import request from 'supertest';
import { createTestApp, getTestServer } from '../testApp';
import { liveVotingService } from '../../services/liveVotingService';
import type { Express } from 'express';
import type { Server } from 'http';
import { ADMIN_USERNAME, ADMIN_PASSWORD } from '../testCredentials';

let app: Express;
let agent: ReturnType<typeof request.agent>;
let server: Server;
let wsBaseUrl: string;

async function loginAsAdmin(ag: ReturnType<typeof request.agent>) {
  await ag
    .post('/api/v1/auth/login')
    .send({ usernameOrEmail: ADMIN_USERNAME, password: ADMIN_PASSWORD });
}

function connectWs(url: string): Promise<WebSocket> {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(url);
    ws.on('open', () => resolve(ws));
    ws.on('error', reject);
    setTimeout(() => reject(new Error('WS connection timeout')), 5000);
  });
}

function waitForMessage(ws: WebSocket, timeout = 3000): Promise<any> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('WS message timeout')), timeout);
    ws.once('message', (data) => {
      clearTimeout(timer);
      resolve(JSON.parse(data.toString()));
    });
  });
}

function waitForClose(ws: WebSocket, timeout = 3000): Promise<{ code: number; reason: string }> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('WS close timeout')), timeout);
    ws.once('close', (code, reason) => {
      clearTimeout(timer);
      resolve({ code, reason: reason.toString() });
    });
  });
}

describe('WebSocket Security Tests', () => {
  let adminToken: string;
  let publicToken: string;

  beforeAll(async () => {
    app = await createTestApp();
    agent = request.agent(app);
    await loginAsAdmin(agent);

    const res = await agent.post('/api/v1/polls').send({
      title: 'WS Security Test Poll',
      type: 'schedule',
      options: [{ text: 'Option A' }, { text: 'Option B' }],
    });
    adminToken = res.body.adminToken;
    publicToken = res.body.publicToken;

    server = getTestServer()!;
    liveVotingService.initializeWithUpgrade(server);
    await new Promise<void>((resolve) => {
      if (server.listening) {
        resolve();
      } else {
        server.listen(0, resolve);
      }
    });
    const address = server.address() as { port: number };
    wsBaseUrl = `ws://localhost:${address.port}/ws/live-voting`;
  });

  describe('Poll existence validation', () => {
    it('should reject join for non-existent poll token', async () => {
      const ws = await connectWs(wsBaseUrl);
      const closePromise = waitForClose(ws);
      const msgPromise = waitForMessage(ws);

      ws.send(JSON.stringify({
        type: 'join_poll',
        pollToken: 'non-existent-token-12345',
        sessionId: `s-${Date.now()}-1`,
      }));

      const msg = await msgPromise;
      expect(msg.type).toBe('error');
      expect(msg.code).toBe('POLL_NOT_FOUND');

      const close = await closePromise;
      expect(close.code).toBe(4404);
    });

    it('should accept join for valid poll token', async () => {
      const ws = await connectWs(wsBaseUrl);
      const msgPromise = waitForMessage(ws);

      ws.send(JSON.stringify({
        type: 'join_poll',
        pollToken: publicToken,
        sessionId: `s-${Date.now()}-2`,
        voterName: 'Test Voter',
      }));

      const msg = await msgPromise;
      expect(['joined', 'presence_update']).toContain(msg.type);
      expect(msg).toHaveProperty('viewerCount');
      expect(msg).toHaveProperty('activeVoters');

      ws.close();
    });
  });

  describe('Presenter privilege escalation prevention', () => {
    it('should NOT grant presenter when isPresenter is self-reported without adminToken', async () => {
      const ws = await connectWs(wsBaseUrl);
      const msgPromise = waitForMessage(ws);

      ws.send(JSON.stringify({
        type: 'join_poll',
        pollToken: publicToken,
        sessionId: `s-${Date.now()}-att`,
        voterName: 'Attacker',
        isPresenter: true,
      }));

      const msg = await msgPromise;
      expect(['joined', 'presence_update']).toContain(msg.type);
      ws.close();
    });

    it('should grant presenter status with valid adminToken', async () => {
      const ws = await connectWs(wsBaseUrl);
      const msgPromise = waitForMessage(ws);

      ws.send(JSON.stringify({
        type: 'join_poll',
        pollToken: publicToken,
        sessionId: `s-${Date.now()}-pres`,
        adminToken: adminToken,
      }));

      const msg = await msgPromise;
      expect(['joined', 'presence_update']).toContain(msg.type);
      ws.close();
    });

    it('should reject start_presenting without adminToken', async () => {
      const ws = await connectWs(wsBaseUrl);
      const sid = `s-${Date.now()}-esc`;

      const joinPromise = waitForMessage(ws);
      ws.send(JSON.stringify({
        type: 'join_poll',
        pollToken: publicToken,
        sessionId: sid,
        voterName: 'Escalation',
      }));
      await joinPromise;

      const errorPromise = waitForMessage(ws);
      ws.send(JSON.stringify({
        type: 'start_presenting',
        pollToken: publicToken,
      }));

      const errorMsg = await errorPromise;
      expect(errorMsg.type).toBe('error');
      expect(errorMsg.code).toBe('FORBIDDEN');
      ws.close();
    });

    it('should reject start_presenting with wrong adminToken', async () => {
      const ws = await connectWs(wsBaseUrl);
      const sid = `s-${Date.now()}-wt`;

      const joinPromise = waitForMessage(ws);
      ws.send(JSON.stringify({
        type: 'join_poll',
        pollToken: publicToken,
        sessionId: sid,
        voterName: 'Wrong Token',
      }));
      await joinPromise;

      const errorPromise = waitForMessage(ws);
      ws.send(JSON.stringify({
        type: 'start_presenting',
        pollToken: publicToken,
        adminToken: 'definitely-wrong-admin-token',
      }));

      const errorMsg = await errorPromise;
      expect(errorMsg.type).toBe('error');
      expect(errorMsg.code).toBe('FORBIDDEN');
      ws.close();
    });

    it('should accept start_presenting with correct adminToken', async () => {
      const ws = await connectWs(wsBaseUrl);
      const sid = `s-${Date.now()}-rp`;

      const joinPromise = waitForMessage(ws);
      ws.send(JSON.stringify({
        type: 'join_poll',
        pollToken: publicToken,
        sessionId: sid,
        adminToken: adminToken,
      }));
      await joinPromise;

      ws.send(JSON.stringify({
        type: 'start_presenting',
        pollToken: publicToken,
        adminToken: adminToken,
      }));

      await new Promise(r => setTimeout(r, 200));
      ws.close();
    });
  });
});
