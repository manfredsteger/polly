import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import request from 'supertest';
import { createTestApp } from '../testApp';
import { createTestUser } from '../fixtures/testData';
import type { Express } from 'express';
import { storage } from '../../storage';
import { db } from '../../db';
import { passwordResetTokens, users } from '@shared/schema';
import { eq } from 'drizzle-orm';
import bcrypt from 'bcryptjs';

export const testMeta = {
  category: 'auth' as const,
  name: 'Passwort-Zurücksetzen',
  description: 'Prüft Password-Reset Token-Ablauf und SSO-Benutzer-Blockierung',
  severity: 'critical' as const,
};

describe('Auth - Password Reset', () => {
  let app: Express;
  let testUserId: number;
  let testUserEmail: string;

  beforeAll(async () => {
    app = await createTestApp();
  });

  beforeEach(async () => {
    const uniqueId = Date.now();
    const userData = createTestUser({ email: `reset-test-${uniqueId}@example.com` });
    const passwordHash = await bcrypt.hash(userData.password, 10);
    
    const [user] = await db.insert(users).values({
      username: `resettest${uniqueId}`,
      email: userData.email,
      name: userData.name,
      passwordHash,
      provider: 'local',
      role: 'user',
      isTestData: true,
    }).returning();
    
    testUserId = user.id;
    testUserEmail = user.email;
  });

  describe('Token Expiration', () => {
    it('should reject expired password reset tokens', async () => {
      const token = 'expired-test-token-' + Date.now();
      const expiredTime = new Date(Date.now() - 2 * 60 * 60 * 1000);
      
      await db.insert(passwordResetTokens).values({
        userId: testUserId,
        token,
        expiresAt: expiredTime,
      });

      const response = await request(app)
        .post('/api/v1/auth/reset-password')
        .send({
          token,
          newPassword: 'NewSecurePassword123!',
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('Ungültiger oder abgelaufener');
    });

    it('should accept valid non-expired tokens', async () => {
      const resetToken = await storage.createPasswordResetToken(testUserId);

      const response = await request(app)
        .post('/api/v1/auth/reset-password')
        .send({
          token: resetToken.token,
          newPassword: 'NewSecurePassword123!',
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });

    it('should reject already used tokens', async () => {
      const resetToken = await storage.createPasswordResetToken(testUserId);
      
      await request(app)
        .post('/api/v1/auth/reset-password')
        .send({
          token: resetToken.token,
          newPassword: 'NewSecurePassword123!',
        });

      const secondResponse = await request(app)
        .post('/api/v1/auth/reset-password')
        .send({
          token: resetToken.token,
          newPassword: 'AnotherPassword456!',
        });

      expect(secondResponse.status).toBe(400);
      expect(secondResponse.body.error).toContain('Ungültiger oder abgelaufener');
    });

    it('should validate 1-hour expiry time is correctly applied', async () => {
      const resetToken = await storage.createPasswordResetToken(testUserId);
      
      const [tokenRecord] = await db.select()
        .from(passwordResetTokens)
        .where(eq(passwordResetTokens.token, resetToken.token));

      const now = Date.now();
      const expiryTime = new Date(tokenRecord.expiresAt).getTime();
      const oneHour = 60 * 60 * 1000;
      
      expect(expiryTime).toBeGreaterThan(now);
      expect(expiryTime).toBeLessThanOrEqual(now + oneHour + 1000);
    });
  });

  describe('SSO User Blocking', () => {
    it('should silently ignore password reset requests for SSO users', async () => {
      const ssoId = Date.now();
      const ssoEmail = `sso-user-${ssoId}@example.com`;
      await db.insert(users).values({
        username: `ssouser${ssoId}`,
        email: ssoEmail,
        name: 'SSO Test User',
        provider: 'keycloak',
        keycloakId: 'keycloak-id-' + ssoId,
        role: 'user',
        isTestData: true,
      });

      const response = await request(app)
        .post('/api/v1/auth/request-password-reset')
        .send({ email: ssoEmail });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);

      const tokens = await db.select()
        .from(passwordResetTokens)
        .innerJoin(users, eq(passwordResetTokens.userId, users.id))
        .where(eq(users.email, ssoEmail));

      expect(tokens.length).toBe(0);
    });

    it('should create reset token for local users', async () => {
      const response = await request(app)
        .post('/api/v1/auth/request-password-reset')
        .send({ email: testUserEmail });

      expect(response.status).toBe(200);

      const tokens = await db.select()
        .from(passwordResetTokens)
        .where(eq(passwordResetTokens.userId, testUserId));

      expect(tokens.length).toBeGreaterThan(0);
    });

    it('should return success for non-existent emails (prevent enumeration)', async () => {
      const response = await request(app)
        .post('/api/v1/auth/request-password-reset')
        .send({ email: 'nonexistent-' + Date.now() + '@example.com' });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });
  });

  describe('Password Validation', () => {
    it('should reject passwords shorter than 8 characters', async () => {
      const resetToken = await storage.createPasswordResetToken(testUserId);

      const response = await request(app)
        .post('/api/v1/auth/reset-password')
        .send({
          token: resetToken.token,
          newPassword: 'short',
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('mindestens 8 Zeichen');
    });

    it('should accept passwords with 8+ characters', async () => {
      const resetToken = await storage.createPasswordResetToken(testUserId);

      const response = await request(app)
        .post('/api/v1/auth/reset-password')
        .send({
          token: resetToken.token,
          newPassword: 'ExactlyEight',
        });

      expect(response.status).toBe(200);
    });
  });

  describe('Password Hash Update', () => {
    it('should update passwordHash and invalidate old password after reset', async () => {
      const originalPassword = 'TestPassword123!';
      const newPassword = 'BrandNewPassword456!';
      
      const [userBefore] = await db.select()
        .from(users)
        .where(eq(users.id, testUserId));
      const oldHash = userBefore.passwordHash;

      const resetToken = await storage.createPasswordResetToken(testUserId);
      
      const resetResponse = await request(app)
        .post('/api/v1/auth/reset-password')
        .send({
          token: resetToken.token,
          newPassword,
        });
      expect(resetResponse.status).toBe(200);

      const [userAfter] = await db.select()
        .from(users)
        .where(eq(users.id, testUserId));
      
      expect(userAfter.passwordHash).not.toBe(oldHash);

      const oldPasswordValid = await bcrypt.compare(originalPassword, userAfter.passwordHash!);
      expect(oldPasswordValid).toBe(false);
      
      const newPasswordValid = await bcrypt.compare(newPassword, userAfter.passwordHash!);
      expect(newPasswordValid).toBe(true);
    });

    it('should allow login with new password after reset (non-test user)', async () => {
      const loginTestId = Date.now();
      const newPassword = 'ResetPassword789!';
      const originalPassword = 'OriginalPassword123!';
      const loginTestEmail = `login-test-${loginTestId}@example.com`;
      
      const passwordHash = await bcrypt.hash(originalPassword, 10);
      const [loginUser] = await db.insert(users).values({
        username: `logintest${loginTestId}`,
        email: loginTestEmail,
        name: 'Login Test User',
        passwordHash,
        provider: 'local',
        role: 'user',
        isTestData: false,
      }).returning();

      const resetToken = await storage.createPasswordResetToken(loginUser.id);
      
      await request(app)
        .post('/api/v1/auth/reset-password')
        .send({
          token: resetToken.token,
          newPassword,
        });

      const loginResponse = await request(app)
        .post('/api/v1/auth/login')
        .send({
          usernameOrEmail: loginTestEmail,
          password: newPassword,
        });

      expect(loginResponse.status).toBe(200);
      expect(loginResponse.body.user).toBeDefined();
      
      await db.delete(users).where(eq(users.id, loginUser.id));
    });

    it('should reject login with old password after reset (non-test user)', async () => {
      const loginTestId = Date.now();
      const originalPassword = 'OriginalPassword456!';
      const newPassword = 'ChangedPassword999!';
      const loginTestEmail = `login-test2-${loginTestId}@example.com`;
      
      const passwordHash = await bcrypt.hash(originalPassword, 10);
      const [loginUser] = await db.insert(users).values({
        username: `logintest2${loginTestId}`,
        email: loginTestEmail,
        name: 'Login Test User 2',
        passwordHash,
        provider: 'local',
        role: 'user',
        isTestData: false,
      }).returning();

      const resetToken = await storage.createPasswordResetToken(loginUser.id);
      
      await request(app)
        .post('/api/v1/auth/reset-password')
        .send({
          token: resetToken.token,
          newPassword,
        });

      const loginResponse = await request(app)
        .post('/api/v1/auth/login')
        .send({
          usernameOrEmail: loginTestEmail,
          password: originalPassword,
        });

      expect(loginResponse.status).toBe(401);
      
      await db.delete(users).where(eq(users.id, loginUser.id));
    });
  });
});
