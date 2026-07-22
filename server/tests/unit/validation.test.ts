import { describe, it, expect } from 'vitest';
import { passwordSchema, createPollSchema, createPollSchemaBase, registerSchema } from '../../routes/common';
import { validatePasswordAgainstPolicy, DEFAULT_PASSWORD_POLICY } from '../../lib/passwordPolicy';

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
    const pollTypeSchema = createPollSchemaBase.shape.type;

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
    const titleSchema = createPollSchemaBase.shape.title;

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

  describe('validatePasswordAgainstPolicy()', () => {
    const fullPolicy = DEFAULT_PASSWORD_POLICY;

    it('should accept a password that meets all default policy requirements', () => {
      const errors = validatePasswordAgainstPolicy('SecurePass123!', fullPolicy);
      expect(errors).toHaveLength(0);
    });

    it('should reject a password shorter than the minimum length', () => {
      const errors = validatePasswordAgainstPolicy('Ab1!', fullPolicy);
      expect(errors.length).toBeGreaterThan(0);
      expect(errors.some(e => e.includes('12'))).toBe(true);
    });

    it('should reject a password without uppercase when required', () => {
      const errors = validatePasswordAgainstPolicy('securepass123!', { ...fullPolicy, requireUppercase: true });
      expect(errors.some(e => e.toLowerCase().includes('großbuchstabe'))).toBe(true);
    });

    it('should reject a password without lowercase when required', () => {
      const errors = validatePasswordAgainstPolicy('SECUREPASS123!', { ...fullPolicy, requireLowercase: true });
      expect(errors.some(e => e.toLowerCase().includes('kleinbuchstabe'))).toBe(true);
    });

    it('should reject a password without numbers when required', () => {
      const errors = validatePasswordAgainstPolicy('SecurePassword!', { ...fullPolicy, requireNumbers: true });
      expect(errors.some(e => e.toLowerCase().includes('zahl'))).toBe(true);
    });

    it('should reject a password without special chars when required', () => {
      const errors = validatePasswordAgainstPolicy('SecurePass1234', { ...fullPolicy, requireSpecialChars: true });
      expect(errors.some(e => e.toLowerCase().includes('sonderzeichen'))).toBe(true);
    });

    it('should accept a password when all complexity rules are disabled', () => {
      const relaxed = { minLength: 6, requireUppercase: false, requireLowercase: false, requireNumbers: false, requireSpecialChars: false };
      const errors = validatePasswordAgainstPolicy('simple', relaxed);
      expect(errors).toHaveLength(0);
    });

    it('should return multiple errors for a password violating multiple rules', () => {
      const errors = validatePasswordAgainstPolicy('abc', fullPolicy);
      expect(errors.length).toBeGreaterThan(1);
    });

    it('should respect a custom minLength', () => {
      const policy = { ...fullPolicy, minLength: 20 };
      const errors = validatePasswordAgainstPolicy('SecurePass123!', policy);
      expect(errors.length).toBeGreaterThan(0);
      expect(errors.some(e => e.includes('20'))).toBe(true);
    });
  });
});
