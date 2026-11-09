import request from 'supertest';
import bcrypt from 'bcryptjs';
import { nanoid } from 'nanoid';
import type { Express } from 'express';
import { storage } from '../../storage';
import { ADMIN_USERNAME, ADMIN_PASSWORD } from '../testCredentials';

export type TestAgent = ReturnType<typeof request.agent>;

export async function loginAdminAgent(app: Express): Promise<TestAgent> {
  const agent = request.agent(app);
  const res = await agent
    .post('/api/v1/auth/login')
    .send({ usernameOrEmail: ADMIN_USERNAME, password: ADMIN_PASSWORD });
  if (res.status !== 200) {
    throw new Error(`Admin login failed with ${res.status}: ${JSON.stringify(res.body)}`);
  }
  return agent;
}

export interface CreatedTestUser {
  id: number;
  username: string;
  email: string;
  password: string;
  agent: TestAgent;
}

/**
 * Creates a verified local user flagged as test data and returns a logged-in agent.
 * Callers should delete the user in afterAll (storage.deleteUser) to keep runs isolated.
 */
export async function createLoggedInUser(
  app: Express,
  overrides: Partial<{ role: 'user' | 'manager' | 'admin'; languagePreference: 'de' | 'en'; name: string }> = {},
): Promise<CreatedTestUser> {
  const suffix = nanoid(8).toLowerCase().replace(/[^a-z0-9]/g, 'x');
  const username = `cov_${suffix}`;
  const email = `cov-${suffix}@test.example`;
  const password = 'TestPassword123!';
  const user = await storage.createUser({
    username,
    email,
    name: overrides.name ?? `Coverage ${suffix}`,
    passwordHash: await bcrypt.hash(password, 4),
    role: overrides.role ?? 'user',
    provider: 'local',
    isTestData: true,
  } as any);
  await storage.updateUser(user.id, {
    emailVerified: true,
    ...(overrides.languagePreference ? { languagePreference: overrides.languagePreference } : {}),
  } as any);

  const agent = request.agent(app);
  const res = await agent.post('/api/v1/auth/login').send({ usernameOrEmail: username, password });
  if (res.status !== 200) {
    throw new Error(`Test user login failed with ${res.status}: ${JSON.stringify(res.body)}`);
  }
  return { id: user.id, username, email, password, agent };
}
