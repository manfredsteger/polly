import { describe, it, expect } from 'vitest';
import { passwordSchema, createPollSchema, registerSchema } from '../../routes/common';

export const testMeta = {
  category: 'api' as const,
  name: 'Validierungs-Schemas',
  description: 'Prüft die Zod-Validierungs-Schemas',
  severity: 'high' as const,
};

describe('Validation Schemas - Unit Tests', () => {
  describe('Password Schema (imported from routes.ts)', () => {
    it('should accept valid password with all requirements', () => {
      const result = passwordSchema.safeParse('SecurePass123!');
      expect(result.success).toBe(true);
    });

    it('should reject password shorter than 8 characters', () => {
      const result = passwordSchema.safeParse('Pass1!');
      expect(result.success).toBe(false);
    });

    it('should reject password without uppercase', () => {
      const result = passwordSchema.safeParse('password123!');
      expect(result.success).toBe(false);
    });

    it('should reject password without lowercase', () => {
      const result = passwordSchema.safeParse('PASSWORD123!');
      expect(result.success).toBe(false);
    });

    it('should reject password without number', () => {
      const result = passwordSchema.safeParse('SecurePassword!');
      expect(result.success).toBe(false);
    });

    it('should reject password without special character', () => {
      const result = passwordSchema.safeParse('SecurePassword123');
      expect(result.success).toBe(false);
    });
  });

  describe('Poll Type Schema (from createPollSchema)', () => {
    const pollTypeSchema = createPollSchema.shape.type;

    it('should accept schedule type', () => {
      const result = pollTypeSchema.safeParse('schedule');
      expect(result.success).toBe(true);
    });

    it('should accept survey type', () => {
      const result = pollTypeSchema.safeParse('survey');
      expect(result.success).toBe(true);
    });

    it('should accept organization type', () => {
      const result = pollTypeSchema.safeParse('organization');
      expect(result.success).toBe(true);
    });

    it('should reject invalid type', () => {
      const result = pollTypeSchema.safeParse('invalid');
      expect(result.success).toBe(false);
    });

    it('should reject empty string', () => {
      const result = pollTypeSchema.safeParse('');
      expect(result.success).toBe(false);
    });
  });

  describe('Poll Title Schema (from createPollSchema)', () => {
    const titleSchema = createPollSchema.shape.title;

    it('should accept valid title', () => {
      const result = titleSchema.safeParse('Meine Umfrage');
      expect(result.success).toBe(true);
    });

    it('should accept title with exactly 200 characters', () => {
      const result = titleSchema.safeParse('A'.repeat(200));
      expect(result.success).toBe(true);
    });

    it('should reject title with 201 characters', () => {
      const result = titleSchema.safeParse('A'.repeat(201));
      expect(result.success).toBe(false);
    });

    it('should reject empty title', () => {
      const result = titleSchema.safeParse('');
      expect(result.success).toBe(false);
    });
  });

  describe('Register Schema (imported from routes.ts)', () => {
    it('should accept valid registration data', () => {
      const result = registerSchema.safeParse({
        username: 'testuser',
        email: 'test@example.com',
        name: 'Test User',
        password: 'SecurePass123!',
      });
      expect(result.success).toBe(true);
    });

    it('should reject username shorter than 3 chars', () => {
      const result = registerSchema.safeParse({
        username: 'ab',
        email: 'test@example.com',
        name: 'Test User',
        password: 'SecurePass123!',
      });
      expect(result.success).toBe(false);
    });

    it('should reject invalid email format', () => {
      const result = registerSchema.safeParse({
        username: 'testuser',
        email: 'not-an-email',
        name: 'Test User',
        password: 'SecurePass123!',
      });
      expect(result.success).toBe(false);
    });
  });
});
