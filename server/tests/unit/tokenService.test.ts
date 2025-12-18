import { describe, it, expect } from 'vitest';
import { tokenService } from '../../services/tokenService';

export const testMeta = {
  category: 'auth' as const,
  name: 'Token-Service',
  description: 'Prüft die Token-Extraktion (pure Hilfsfunktionen ohne Netzwerkzugriff)',
  severity: 'critical' as const,
};

describe('Token Service - Unit Tests', () => {
  describe('extractBearerToken (pure function)', () => {
    it('should extract token from valid Bearer header', () => {
      const authHeader = 'Bearer eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9.test';
      const token = tokenService.extractBearerToken(authHeader);
      
      expect(token).toBe('eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9.test');
    });

    it('should return null for undefined header', () => {
      const token = tokenService.extractBearerToken(undefined);
      
      expect(token).toBeNull();
    });

    it('should return null for empty string', () => {
      const token = tokenService.extractBearerToken('');
      
      expect(token).toBeNull();
    });

    it('should return null for non-Bearer header', () => {
      const token = tokenService.extractBearerToken('Basic dXNlcjpwYXNz');
      
      expect(token).toBeNull();
    });

    it('should return empty string for Bearer without token', () => {
      const token = tokenService.extractBearerToken('Bearer ');
      
      expect(token).toBe('');
    });

    it('should be case-sensitive (lowercase bearer rejected)', () => {
      const lowerCase = tokenService.extractBearerToken('bearer token123');
      
      expect(lowerCase).toBeNull();
    });

    it('should be case-sensitive (uppercase BEARER rejected)', () => {
      const upperCase = tokenService.extractBearerToken('BEARER token123');
      
      expect(upperCase).toBeNull();
    });

    it('should extract token with complex JWT structure', () => {
      const complexJWT = 'Bearer eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIn0.signature';
      const token = tokenService.extractBearerToken(complexJWT);
      
      expect(token).toBe('eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIn0.signature');
    });
  });

  describe('isOIDCEnabled (state check)', () => {
    it('should return boolean indicating OIDC configuration state', () => {
      const isEnabled = tokenService.isOIDCEnabled();
      
      expect(typeof isEnabled).toBe('boolean');
    });
  });
});
