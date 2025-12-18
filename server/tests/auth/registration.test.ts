import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import { createTestApp } from '../testApp';
import type { Express } from 'express';
import { nanoid } from 'nanoid';

export const testMeta = {
  category: 'auth' as const,
  name: 'Benutzer-Registrierung',
  description: 'Prüft Registrierung mit Validierung von E-Mail, Username und Passwort',
  severity: 'high' as const,
};

describe('Auth - Registration', () => {
  let app: Express;

  beforeAll(async () => {
    app = await createTestApp();
  });

  it('should reject registration with short password (less than 8 chars)', async () => {
    const response = await request(app)
      .post('/api/v1/auth/register')
      .send({
        username: `user${nanoid(6)}`,
        email: `test-${nanoid(8)}@example.com`,
        name: 'Test User',
        password: '1234567',
      });

    expect(response.status).toBeGreaterThanOrEqual(400);
  });

  it('should reject registration with password missing uppercase', async () => {
    const response = await request(app)
      .post('/api/v1/auth/register')
      .send({
        username: `user${nanoid(6)}`,
        email: `test-${nanoid(8)}@example.com`,
        name: 'Test User',
        password: 'password123!',
      });

    expect(response.status).toBeGreaterThanOrEqual(400);
  });

  it('should reject registration with password missing special character', async () => {
    const response = await request(app)
      .post('/api/v1/auth/register')
      .send({
        username: `user${nanoid(6)}`,
        email: `test-${nanoid(8)}@example.com`,
        name: 'Test User',
        password: 'Password123',
      });

    expect(response.status).toBeGreaterThanOrEqual(400);
  });

  it('should reject registration with invalid email', async () => {
    const response = await request(app)
      .post('/api/v1/auth/register')
      .send({
        username: `user${nanoid(6)}`,
        email: 'not-an-email',
        name: 'Test User',
        password: 'SecurePassword123!',
      });

    expect(response.status).toBeGreaterThanOrEqual(400);
  });

  it('should reject registration without username', async () => {
    const response = await request(app)
      .post('/api/v1/auth/register')
      .send({
        email: `test-${nanoid(8)}@example.com`,
        name: 'Test User',
        password: 'SecurePassword123!',
      });

    expect(response.status).toBeGreaterThanOrEqual(400);
  });

  it('should reject registration without email', async () => {
    const response = await request(app)
      .post('/api/v1/auth/register')
      .send({
        username: `user${nanoid(6)}`,
        name: 'Test User',
        password: 'SecurePassword123!',
      });

    expect(response.status).toBeGreaterThanOrEqual(400);
  });

  it('should return 400 for empty registration body', async () => {
    const response = await request(app)
      .post('/api/v1/auth/register')
      .send({});

    expect(response.status).toBeGreaterThanOrEqual(400);
  });

  it('should reject short username (less than 3 chars)', async () => {
    const response = await request(app)
      .post('/api/v1/auth/register')
      .send({
        username: 'ab',
        email: `test-${nanoid(8)}@example.com`,
        name: 'Test User',
        password: 'SecurePassword123!',
      });

    expect(response.status).toBeGreaterThanOrEqual(400);
  });
});
