import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest';
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

function collectMessages(ws: WebSocket, count: number, timeout = 3000): Promise<any[]> {
  return new Promise((resolve, reject) => {
    const messages: any[] = [];
    const timer = setTimeout(() => resolve(messages), timeout);
    const handler = (data: Buffer) => {
      messages.push(JSON.parse(data.toString()));
      if (messages.length >= count) {
        clearTimeout(timer);
        ws.off('message', handler);
        resolve(messages);
      }
    };
    ws.on('message', handler);
  });
}

function sendAndWait(ws: WebSocket, msg: any, timeout = 3000): Promise<any> {
  const promise = waitForMessage(ws, timeout);
  ws.send(JSON.stringify(msg));
  return promise;
}

function safeClose(ws: WebSocket) {
  if (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING) {
    ws.close();
  }
}

describe('LiveVotingService - Multi-User Live Session Tests', () => {
  let schedulePollPublicToken: string;
  let schedulePollAdminToken: string;
  let schedulePollOptions: any[];
  let surveyPollPublicToken: string;
  let surveyPollAdminToken: string;
  let surveyPollOptions: any[];
  let orgaPollPublicToken: string;
  let orgaPollAdminToken: string;
  let orgaPollOptions: any[];

  const openConnections: WebSocket[] = [];

  function trackWs(ws: WebSocket): WebSocket {
    openConnections.push(ws);
    return ws;
  }

  beforeAll(async () => {
    app = await createTestApp();
    agent = request.agent(app);
    await loginAsAdmin(agent);

    const scheduleRes = await agent.post('/api/v1/polls').send({
      title: 'Live Session Schedule Test',
      type: 'schedule',
      options: [
        { text: 'Monday 10:00' },
        { text: 'Tuesday 14:00' },
        { text: 'Wednesday 09:00' },
      ],
    });
    schedulePollPublicToken = scheduleRes.body.publicToken;
    schedulePollAdminToken = scheduleRes.body.adminToken;
    const scheduleDetail = await agent.get(`/api/v1/polls/admin/${schedulePollAdminToken}`);
    schedulePollOptions = scheduleDetail.body.options;

    const surveyRes = await agent.post('/api/v1/polls').send({
      title: 'Live Session Survey Test',
      type: 'survey',
      options: [
        { text: 'Option Alpha' },
        { text: 'Option Beta' },
        { text: 'Option Gamma' },
      ],
    });
    surveyPollPublicToken = surveyRes.body.publicToken;
    surveyPollAdminToken = surveyRes.body.adminToken;
    const surveyDetail = await agent.get(`/api/v1/polls/admin/${surveyPollAdminToken}`);
    surveyPollOptions = surveyDetail.body.options;

    const orgaRes = await agent.post('/api/v1/polls').send({
      title: 'Live Session Orga Test',
      type: 'organization',
      options: [
        { text: 'Bring cake', maxCapacity: 2 },
        { text: 'Bring drinks', maxCapacity: 3 },
      ],
    });
    orgaPollPublicToken = orgaRes.body.publicToken;
    orgaPollAdminToken = orgaRes.body.adminToken;
    const orgaDetail = await agent.get(`/api/v1/polls/admin/${orgaPollAdminToken}`);
    orgaPollOptions = orgaDetail.body.options;

    server = getTestServer()!;
    liveVotingService.initializeWithUpgrade(server);
    await new Promise<void>((resolve) => {
      if (server.listening) resolve();
      else server.listen(0, resolve);
    });
    const address = server.address() as { port: number };
    wsBaseUrl = `ws://localhost:${address.port}/ws/live-voting`;
  });

  afterEach(() => {
    openConnections.forEach(ws => safeClose(ws));
    openConnections.length = 0;
  });

  afterAll(() => {
    openConnections.forEach(ws => safeClose(ws));
  });

  describe('Multi-user presence tracking', () => {
    it('should track multiple voters joining the same poll', async () => {
      const ws1 = trackWs(await connectWs(wsBaseUrl));
      const ws2 = trackWs(await connectWs(wsBaseUrl));
      const ws3 = trackWs(await connectWs(wsBaseUrl));

      const msgs1initial = collectMessages(ws1, 2, 2000);
      ws1.send(JSON.stringify({
        type: 'join_poll',
        pollToken: schedulePollPublicToken,
        sessionId: 'multi-user-1',
        voterName: 'Alice',
      }));
      const msgs1a = await msgs1initial;
      const joinOrPresence1 = msgs1a.find((m: any) => m.activeVoters?.length === 1);
      expect(joinOrPresence1).toBeDefined();
      expect(joinOrPresence1.activeVoters[0].name).toBe('Alice');

      const collectOn1 = collectMessages(ws1, 1, 2000);
      const msgs2initial = collectMessages(ws2, 2, 2000);
      ws2.send(JSON.stringify({
        type: 'join_poll',
        pollToken: schedulePollPublicToken,
        sessionId: 'multi-user-2',
        voterName: 'Bob',
      }));
      const msgs2a = await msgs2initial;
      const msg2with2voters = msgs2a.find((m: any) => m.activeVoters?.length === 2);
      expect(msg2with2voters).toBeDefined();
      expect(msg2with2voters.viewerCount).toBe(2);

      const msgs1fromBob = await collectOn1;
      expect(msgs1fromBob.some((m: any) => m.activeVoters?.length === 2)).toBe(true);

      const collectOn1b = collectMessages(ws1, 1, 2000);
      const collectOn2b = collectMessages(ws2, 1, 2000);
      const msgs3initial = collectMessages(ws3, 2, 2000);
      ws3.send(JSON.stringify({
        type: 'join_poll',
        pollToken: schedulePollPublicToken,
        sessionId: 'multi-user-3',
        voterName: 'Charlie',
      }));
      const msgs3a = await msgs3initial;
      const msg3with3voters = msgs3a.find((m: any) => m.activeVoters?.length === 3);
      expect(msg3with3voters).toBeDefined();
      expect(msg3with3voters.viewerCount).toBe(3);

      const msgs1b = await collectOn1b;
      const msgs2b = await collectOn2b;
      expect(msgs1b.some((m: any) => m.activeVoters?.length === 3)).toBe(true);
      expect(msgs2b.some((m: any) => m.activeVoters?.length === 3)).toBe(true);
    });

    it('should update presence when a voter disconnects', async () => {
      const ws1 = trackWs(await connectWs(wsBaseUrl));
      const ws2 = trackWs(await connectWs(wsBaseUrl));

      await sendAndWait(ws1, {
        type: 'join_poll',
        pollToken: schedulePollPublicToken,
        sessionId: 'disc-1',
        voterName: 'Stay',
      });

      await sendAndWait(ws2, {
        type: 'join_poll',
        pollToken: schedulePollPublicToken,
        sessionId: 'disc-2',
        voterName: 'Leave',
      });

      const collectOnStay = collectMessages(ws1, 1, 2000);
      ws2.close();

      const msgs = await collectOnStay;
      const presenceUpdate = msgs.find((m: any) => m.type === 'presence_update');
      expect(presenceUpdate).toBeDefined();
      expect(presenceUpdate.activeVoters).toHaveLength(1);
      expect(presenceUpdate.activeVoters[0].name).toBe('Stay');
    });
  });

  describe('Live vote broadcasting (Schedule poll)', () => {
    it('should broadcast in-progress votes from one voter to all others', async () => {
      const wsVoter = trackWs(await connectWs(wsBaseUrl));
      const wsPresenter = trackWs(await connectWs(wsBaseUrl));
      const wsViewer = trackWs(await connectWs(wsBaseUrl));

      await sendAndWait(wsPresenter, {
        type: 'join_poll',
        pollToken: schedulePollPublicToken,
        sessionId: 'pres-broadcast',
        adminToken: schedulePollAdminToken,
      });

      await sendAndWait(wsViewer, {
        type: 'join_poll',
        pollToken: schedulePollPublicToken,
        sessionId: 'viewer-broadcast',
        voterName: 'Viewer',
      });

      await sendAndWait(wsVoter, {
        type: 'join_poll',
        pollToken: schedulePollPublicToken,
        sessionId: 'voter-broadcast',
        voterName: 'VotingUser',
      });

      const optionId = String(schedulePollOptions[0].id);

      const presenterCollect = collectMessages(wsPresenter, 1);
      const viewerCollect = collectMessages(wsViewer, 1);

      wsVoter.send(JSON.stringify({
        type: 'vote_in_progress',
        optionId,
        response: 'yes',
      }));

      const presenterMsgs = await presenterCollect;
      const viewerMsgs = await viewerCollect;

      const presLiveUpdate = presenterMsgs.find((m: any) => m.type === 'live_vote_update');
      expect(presLiveUpdate).toBeDefined();
      expect(presLiveUpdate.voterName).toBe('VotingUser');
      expect(presLiveUpdate.optionId).toBe(optionId);
      expect(presLiveUpdate.response).toBe('yes');

      const viewLiveUpdate = viewerMsgs.find((m: any) => m.type === 'live_vote_update');
      expect(viewLiveUpdate).toBeDefined();
      expect(viewLiveUpdate.liveVotes).toBeDefined();
      expect(viewLiveUpdate.liveVotes['voter-broadcast']).toBeDefined();
      expect(viewLiveUpdate.liveVotes['voter-broadcast'].voterName).toBe('VotingUser');
      expect(viewLiveUpdate.liveVotes['voter-broadcast'].votes[optionId]).toBe('yes');
    });

    it('should broadcast multiple vote changes from one voter', async () => {
      const wsVoter = trackWs(await connectWs(wsBaseUrl));
      const wsPresenter = trackWs(await connectWs(wsBaseUrl));

      await sendAndWait(wsPresenter, {
        type: 'join_poll',
        pollToken: schedulePollPublicToken,
        sessionId: 'pres-multi-vote',
        adminToken: schedulePollAdminToken,
      });

      await sendAndWait(wsVoter, {
        type: 'join_poll',
        pollToken: schedulePollPublicToken,
        sessionId: 'voter-multi-vote',
        voterName: 'MultiVoter',
      });

      const option1 = String(schedulePollOptions[0].id);
      const option2 = String(schedulePollOptions[1].id);
      const option3 = String(schedulePollOptions[2].id);

      let collect = collectMessages(wsPresenter, 1);
      wsVoter.send(JSON.stringify({ type: 'vote_in_progress', optionId: option1, response: 'yes' }));
      let msgs = await collect;
      let update = msgs.find((m: any) => m.type === 'live_vote_update');
      expect(update.liveVotes['voter-multi-vote'].votes[option1]).toBe('yes');

      collect = collectMessages(wsPresenter, 1);
      wsVoter.send(JSON.stringify({ type: 'vote_in_progress', optionId: option2, response: 'no' }));
      msgs = await collect;
      update = msgs.find((m: any) => m.type === 'live_vote_update');
      expect(update.liveVotes['voter-multi-vote'].votes[option1]).toBe('yes');
      expect(update.liveVotes['voter-multi-vote'].votes[option2]).toBe('no');

      collect = collectMessages(wsPresenter, 1);
      wsVoter.send(JSON.stringify({ type: 'vote_in_progress', optionId: option3, response: 'maybe' }));
      msgs = await collect;
      update = msgs.find((m: any) => m.type === 'live_vote_update');
      expect(update.liveVotes['voter-multi-vote'].votes[option1]).toBe('yes');
      expect(update.liveVotes['voter-multi-vote'].votes[option2]).toBe('no');
      expect(update.liveVotes['voter-multi-vote'].votes[option3]).toBe('maybe');
    });

    it('should handle vote change (yes to no) correctly', async () => {
      const wsVoter = trackWs(await connectWs(wsBaseUrl));
      const wsPresenter = trackWs(await connectWs(wsBaseUrl));

      await sendAndWait(wsPresenter, {
        type: 'join_poll',
        pollToken: schedulePollPublicToken,
        sessionId: 'pres-change',
        adminToken: schedulePollAdminToken,
      });

      await sendAndWait(wsVoter, {
        type: 'join_poll',
        pollToken: schedulePollPublicToken,
        sessionId: 'voter-change',
        voterName: 'Changer',
      });

      const optionId = String(schedulePollOptions[0].id);

      let collect = collectMessages(wsPresenter, 1);
      wsVoter.send(JSON.stringify({ type: 'vote_in_progress', optionId, response: 'yes' }));
      let msgs = await collect;
      expect(msgs.find((m: any) => m.type === 'live_vote_update').liveVotes['voter-change'].votes[optionId]).toBe('yes');

      collect = collectMessages(wsPresenter, 1);
      wsVoter.send(JSON.stringify({ type: 'vote_in_progress', optionId, response: 'no' }));
      msgs = await collect;
      expect(msgs.find((m: any) => m.type === 'live_vote_update').liveVotes['voter-change'].votes[optionId]).toBe('no');
    });

    it('should handle vote removal (null response) correctly', async () => {
      const wsVoter = trackWs(await connectWs(wsBaseUrl));
      const wsPresenter = trackWs(await connectWs(wsBaseUrl));

      await sendAndWait(wsPresenter, {
        type: 'join_poll',
        pollToken: schedulePollPublicToken,
        sessionId: 'pres-remove',
        adminToken: schedulePollAdminToken,
      });

      await sendAndWait(wsVoter, {
        type: 'join_poll',
        pollToken: schedulePollPublicToken,
        sessionId: 'voter-remove',
        voterName: 'Remover',
      });

      const optionId = String(schedulePollOptions[0].id);

      let collect = collectMessages(wsPresenter, 1);
      wsVoter.send(JSON.stringify({ type: 'vote_in_progress', optionId, response: 'yes' }));
      await collect;

      collect = collectMessages(wsPresenter, 1);
      wsVoter.send(JSON.stringify({ type: 'vote_in_progress', optionId, response: null }));
      const msgs = await collect;
      const update = msgs.find((m: any) => m.type === 'live_vote_update');
      expect(update.liveVotes['voter-remove']).toBeUndefined();
    });
  });

  describe('Multi-voter simultaneous voting', () => {
    it('should correctly track votes from 3 simultaneous voters', async () => {
      const wsA = trackWs(await connectWs(wsBaseUrl));
      const wsB = trackWs(await connectWs(wsBaseUrl));
      const wsC = trackWs(await connectWs(wsBaseUrl));
      const wsPresenter = trackWs(await connectWs(wsBaseUrl));

      await sendAndWait(wsPresenter, {
        type: 'join_poll',
        pollToken: schedulePollPublicToken,
        sessionId: 'pres-simul',
        adminToken: schedulePollAdminToken,
      });

      await sendAndWait(wsA, {
        type: 'join_poll',
        pollToken: schedulePollPublicToken,
        sessionId: 'simul-a',
        voterName: 'Alice',
      });

      await sendAndWait(wsB, {
        type: 'join_poll',
        pollToken: schedulePollPublicToken,
        sessionId: 'simul-b',
        voterName: 'Bob',
      });

      await sendAndWait(wsC, {
        type: 'join_poll',
        pollToken: schedulePollPublicToken,
        sessionId: 'simul-c',
        voterName: 'Charlie',
      });

      const option1 = String(schedulePollOptions[0].id);
      const option2 = String(schedulePollOptions[1].id);

      const presenterCollect = collectMessages(wsPresenter, 3, 3000);

      wsA.send(JSON.stringify({ type: 'vote_in_progress', optionId: option1, response: 'yes' }));
      wsB.send(JSON.stringify({ type: 'vote_in_progress', optionId: option1, response: 'no' }));
      wsC.send(JSON.stringify({ type: 'vote_in_progress', optionId: option2, response: 'maybe' }));

      const msgs = await presenterCollect;
      expect(msgs.length).toBe(3);

      const lastUpdate = msgs[msgs.length - 1];
      expect(lastUpdate.type).toBe('live_vote_update');
      expect(lastUpdate.liveVotes['simul-a'].votes[option1]).toBe('yes');
      expect(lastUpdate.liveVotes['simul-b'].votes[option1]).toBe('no');
      expect(lastUpdate.liveVotes['simul-c'].votes[option2]).toBe('maybe');
    });
  });

  describe('Vote finalization', () => {
    it('should remove voter from live list after vote_submitted and notify all', async () => {
      const wsVoter = trackWs(await connectWs(wsBaseUrl));
      const wsPresenter = trackWs(await connectWs(wsBaseUrl));

      await sendAndWait(wsPresenter, {
        type: 'join_poll',
        pollToken: schedulePollPublicToken,
        sessionId: 'pres-final',
        adminToken: schedulePollAdminToken,
      });

      await sendAndWait(wsVoter, {
        type: 'join_poll',
        pollToken: schedulePollPublicToken,
        sessionId: 'voter-final',
        voterName: 'Finalizer',
      });

      let collect = collectMessages(wsPresenter, 1);
      wsVoter.send(JSON.stringify({
        type: 'vote_in_progress',
        optionId: String(schedulePollOptions[0].id),
        response: 'yes',
      }));
      await collect;

      collect = collectMessages(wsPresenter, 1);
      wsVoter.send(JSON.stringify({
        type: 'vote_submitted',
        voterName: 'Finalizer',
      }));
      const msgs = await collect;

      const finalized = msgs.find((m: any) => m.type === 'vote_finalized');
      expect(finalized).toBeDefined();
      expect(finalized.voterName).toBe('Finalizer');
      expect(finalized.liveVotes['voter-final']).toBeUndefined();
      expect(finalized.activeVoters.find((v: any) => v.id === 'voter-final')).toBeUndefined();
    });

    it('should keep other voters active after one submits', async () => {
      const wsA = trackWs(await connectWs(wsBaseUrl));
      const wsB = trackWs(await connectWs(wsBaseUrl));
      const wsPresenter = trackWs(await connectWs(wsBaseUrl));

      await sendAndWait(wsPresenter, {
        type: 'join_poll',
        pollToken: schedulePollPublicToken,
        sessionId: 'pres-partial-final',
        adminToken: schedulePollAdminToken,
      });

      await sendAndWait(wsA, {
        type: 'join_poll',
        pollToken: schedulePollPublicToken,
        sessionId: 'part-a',
        voterName: 'Alice',
      });

      await sendAndWait(wsB, {
        type: 'join_poll',
        pollToken: schedulePollPublicToken,
        sessionId: 'part-b',
        voterName: 'Bob',
      });

      const option1 = String(schedulePollOptions[0].id);

      let collect = collectMessages(wsPresenter, 2);
      wsA.send(JSON.stringify({ type: 'vote_in_progress', optionId: option1, response: 'yes' }));
      wsB.send(JSON.stringify({ type: 'vote_in_progress', optionId: option1, response: 'maybe' }));
      await collect;

      collect = collectMessages(wsPresenter, 1);
      wsA.send(JSON.stringify({ type: 'vote_submitted', voterName: 'Alice' }));
      const msgs = await collect;

      const finalized = msgs.find((m: any) => m.type === 'vote_finalized');
      expect(finalized).toBeDefined();
      expect(finalized.liveVotes['part-a']).toBeUndefined();
      expect(finalized.liveVotes['part-b']).toBeDefined();
      expect(finalized.liveVotes['part-b'].votes[option1]).toBe('maybe');
    });
  });

  describe('Presenter functionality', () => {
    it('should not add presenter to activeVoters list', async () => {
      const wsPresenter = trackWs(await connectWs(wsBaseUrl));

      const joined = await sendAndWait(wsPresenter, {
        type: 'join_poll',
        pollToken: schedulePollPublicToken,
        sessionId: 'pres-no-voter',
        adminToken: schedulePollAdminToken,
      });

      expect(['joined', 'presence_update']).toContain(joined.type);
      expect(joined.activeVoters.find((v: any) => v.id === 'pres-no-voter')).toBeUndefined();
    });

    it('should allow start_presenting with valid adminToken', async () => {
      const ws = trackWs(await connectWs(wsBaseUrl));

      await sendAndWait(ws, {
        type: 'join_poll',
        pollToken: schedulePollPublicToken,
        sessionId: 'start-pres',
        adminToken: schedulePollAdminToken,
      });

      ws.send(JSON.stringify({
        type: 'start_presenting',
        pollToken: schedulePollPublicToken,
        adminToken: schedulePollAdminToken,
      }));

      await new Promise(r => setTimeout(r, 200));
    });

    it('should reject start_presenting without valid adminToken', async () => {
      const ws = trackWs(await connectWs(wsBaseUrl));

      await sendAndWait(ws, {
        type: 'join_poll',
        pollToken: schedulePollPublicToken,
        sessionId: 'bad-pres',
        voterName: 'Hacker',
      });

      const collect = collectMessages(ws, 1, 2000);
      ws.send(JSON.stringify({
        type: 'start_presenting',
        pollToken: schedulePollPublicToken,
        adminToken: 'wrong-token',
      }));

      const msgs = await collect;
      const errorMsg = msgs.find((m: any) => m.type === 'error');
      expect(errorMsg).toBeDefined();
      expect(errorMsg.code).toBe('FORBIDDEN');
    });
  });

  describe('Name update', () => {
    it('should update voter name and broadcast presence', async () => {
      const wsVoter = trackWs(await connectWs(wsBaseUrl));
      const wsOther = trackWs(await connectWs(wsBaseUrl));

      await sendAndWait(wsOther, {
        type: 'join_poll',
        pollToken: schedulePollPublicToken,
        sessionId: 'name-other',
        voterName: 'Observer',
      });

      await sendAndWait(wsVoter, {
        type: 'join_poll',
        pollToken: schedulePollPublicToken,
        sessionId: 'name-changer',
        voterName: 'OldName',
      });

      const collect = collectMessages(wsOther, 1, 2000);
      wsVoter.send(JSON.stringify({
        type: 'update_name',
        voterName: 'NewName',
      }));

      const msgs = await collect;
      const presence = msgs.find((m: any) => m.type === 'presence_update');
      expect(presence).toBeDefined();
      const updatedVoter = presence.activeVoters.find((v: any) => v.id === 'name-changer');
      expect(updatedVoter).toBeDefined();
      expect(updatedVoter.name).toBe('NewName');
    });
  });

  describe('Ping/Pong keepalive', () => {
    it('should respond to ping with pong', async () => {
      const ws = trackWs(await connectWs(wsBaseUrl));

      await sendAndWait(ws, {
        type: 'join_poll',
        pollToken: schedulePollPublicToken,
        sessionId: 'ping-test',
        voterName: 'Pinger',
      });

      const pong = await sendAndWait(ws, { type: 'ping' });
      expect(pong.type).toBe('pong');
    });
  });

  describe('Cross-poll isolation', () => {
    it('should not leak votes between different polls', async () => {
      const wsPoll1 = trackWs(await connectWs(wsBaseUrl));
      const wsPoll2 = trackWs(await connectWs(wsBaseUrl));
      const wsPresenter2 = trackWs(await connectWs(wsBaseUrl));

      await sendAndWait(wsPoll1, {
        type: 'join_poll',
        pollToken: schedulePollPublicToken,
        sessionId: 'cross-sched',
        voterName: 'ScheduleVoter',
      });

      await sendAndWait(wsPresenter2, {
        type: 'join_poll',
        pollToken: surveyPollPublicToken,
        sessionId: 'cross-pres',
        adminToken: surveyPollAdminToken,
      });

      await sendAndWait(wsPoll2, {
        type: 'join_poll',
        pollToken: surveyPollPublicToken,
        sessionId: 'cross-surv',
        voterName: 'SurveyVoter',
      });

      const presCollect = collectMessages(wsPresenter2, 1, 2000);

      wsPoll1.send(JSON.stringify({
        type: 'vote_in_progress',
        optionId: String(schedulePollOptions[0].id),
        response: 'yes',
      }));

      const surveyMsgs = await presCollect;
      const leakedUpdate = surveyMsgs.find((m: any) =>
        m.type === 'live_vote_update' && m.voterName === 'ScheduleVoter'
      );
      expect(leakedUpdate).toBeUndefined();
    });
  });

  describe('Survey poll live voting', () => {
    it('should track survey option selections live', async () => {
      const wsVoter = trackWs(await connectWs(wsBaseUrl));
      const wsPresenter = trackWs(await connectWs(wsBaseUrl));

      await sendAndWait(wsPresenter, {
        type: 'join_poll',
        pollToken: surveyPollPublicToken,
        sessionId: 'surv-pres',
        adminToken: surveyPollAdminToken,
      });

      await sendAndWait(wsVoter, {
        type: 'join_poll',
        pollToken: surveyPollPublicToken,
        sessionId: 'surv-voter',
        voterName: 'SurveyUser',
      });

      const optionId = String(surveyPollOptions[0].id);
      const collect = collectMessages(wsPresenter, 1);
      wsVoter.send(JSON.stringify({ type: 'vote_in_progress', optionId, response: 'yes' }));

      const msgs = await collect;
      const update = msgs.find((m: any) => m.type === 'live_vote_update');
      expect(update).toBeDefined();
      expect(update.liveVotes['surv-voter'].votes[optionId]).toBe('yes');
    });
  });

  describe('Results refresh notification', () => {
    it('should broadcast results_refresh to all viewers', async () => {
      const ws1 = trackWs(await connectWs(wsBaseUrl));
      const ws2 = trackWs(await connectWs(wsBaseUrl));

      await sendAndWait(ws1, {
        type: 'join_poll',
        pollToken: schedulePollPublicToken,
        sessionId: 'refresh-1',
        voterName: 'Refresher1',
      });

      await sendAndWait(ws2, {
        type: 'join_poll',
        pollToken: schedulePollPublicToken,
        sessionId: 'refresh-2',
        voterName: 'Refresher2',
      });

      const collect1 = collectMessages(ws1, 1, 2000);
      const collect2 = collectMessages(ws2, 1, 2000);

      liveVotingService.notifyResultsRefresh(schedulePollPublicToken);

      const msgs1 = await collect1;
      const msgs2 = await collect2;
      expect(msgs1.some((m: any) => m.type === 'results_refresh')).toBe(true);
      expect(msgs2.some((m: any) => m.type === 'results_refresh')).toBe(true);
    });
  });

  describe('Slot update broadcast (Organization poll)', () => {
    it('should broadcast slot_update to all viewers', async () => {
      const ws1 = trackWs(await connectWs(wsBaseUrl));
      const ws2 = trackWs(await connectWs(wsBaseUrl));

      await sendAndWait(ws1, {
        type: 'join_poll',
        pollToken: orgaPollPublicToken,
        sessionId: 'orga-1',
        voterName: 'OrgaUser1',
      });

      await sendAndWait(ws2, {
        type: 'join_poll',
        pollToken: orgaPollPublicToken,
        sessionId: 'orga-2',
        voterName: 'OrgaUser2',
      });

      const collect1 = collectMessages(ws1, 1, 2000);
      const collect2 = collectMessages(ws2, 1, 2000);

      const optId = orgaPollOptions[0].id;
      liveVotingService.broadcastSlotUpdate(orgaPollPublicToken, {
        [optId]: { currentCount: 1, maxCapacity: 2 },
      });

      const msgs1 = await collect1;
      const msgs2 = await collect2;

      const slotMsg1 = msgs1.find((m: any) => m.type === 'slot_update');
      const slotMsg2 = msgs2.find((m: any) => m.type === 'slot_update');
      expect(slotMsg1).toBeDefined();
      expect(slotMsg2).toBeDefined();
      expect(slotMsg1.slotUpdates[optId].currentCount).toBe(1);
      expect(slotMsg1.slotUpdates[optId].maxCapacity).toBe(2);
    });
  });

  describe('Service stats', () => {
    it('should report correct stats', async () => {
      const ws = trackWs(await connectWs(wsBaseUrl));

      await sendAndWait(ws, {
        type: 'join_poll',
        pollToken: schedulePollPublicToken,
        sessionId: 'stats-test',
        voterName: 'StatsUser',
      });

      const stats = liveVotingService.getStats();
      expect(stats.activeRooms).toBeGreaterThanOrEqual(1);
      expect(stats.totalConnections).toBeGreaterThanOrEqual(1);
      expect(stats.rooms.length).toBeGreaterThanOrEqual(1);
    });
  });
});
