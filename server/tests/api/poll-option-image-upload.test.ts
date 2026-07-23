import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import { createTestApp } from '../testApp';
import type { Express } from 'express';

export const testMeta = {
  category: 'security' as const,
  name: 'Poll-Option-Bild-Upload SVG-Blockierung',
  description: 'Supertest-basierte HTTP-Tests: SVG-Uploads an den Poll-Option-Bild-Endpunkt werden abgelehnt — auch bei MIME-Type-Bypass',
  severity: 'critical' as const,
};

const UPLOAD_ENDPOINT = '/api/v1/upload/image';

const MINIMAL_SVG = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"><rect width="10" height="10" fill="blue"/></svg>';

const XML_PROLOG_SVG = '<?xml version="1.0" encoding="UTF-8"?><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"><rect width="10" height="10" fill="blue"/></svg>';

const MALICIOUS_SVG = [
  '<svg xmlns="http://www.w3.org/2000/svg" onload="alert(1)">',
  '<script>alert(2)</script>',
  '<a href="javascript:alert(3)"><rect/></a>',
  '</svg>',
].join('');

describe('Poll-Option Image Upload — SVG Blocking (HTTP Integration)', () => {
  let app: Express;

  beforeAll(async () => {
    app = await createTestApp();
  });

  describe('MIME-type-declared SVG (image/svg+xml)', () => {
    it('should return 400 when uploading a clean SVG with image/svg+xml MIME type', async () => {
      const res = await request(app)
        .post(UPLOAD_ENDPOINT)
        .attach('image', Buffer.from(MINIMAL_SVG, 'utf8'), {
          filename: 'shape.svg',
          contentType: 'image/svg+xml',
        });

      expect(res.status).toBe(400);
      const body = res.body as Record<string, string>;
      const errorText = body.error ?? body.message ?? '';
      expect(errorText.length).toBeGreaterThan(0);
      expect(errorText).toMatch(/SVG|erlaubt/i);
    });

    it('should return 400 when uploading a malicious SVG with image/svg+xml MIME type', async () => {
      const res = await request(app)
        .post(UPLOAD_ENDPOINT)
        .attach('image', Buffer.from(MALICIOUS_SVG, 'utf8'), {
          filename: 'exploit.svg',
          contentType: 'image/svg+xml',
        });

      expect(res.status).toBe(400);
      const body = res.body as Record<string, string>;
      const errorText = body.error ?? body.message ?? '';
      expect(errorText.length).toBeGreaterThan(0);
    });
  });

  describe('MIME-type bypass — SVG content declared as non-SVG', () => {
    it('should return 400 when SVG content is uploaded with image/png MIME type (MIME bypass)', async () => {
      const res = await request(app)
        .post(UPLOAD_ENDPOINT)
        .attach('image', Buffer.from(MINIMAL_SVG, 'utf8'), {
          filename: 'not-a-png.png',
          contentType: 'image/png',
        });

      expect(res.status).toBe(400);
      const body = res.body as Record<string, string>;
      const errorText = body.error ?? body.message ?? '';
      expect(errorText.length).toBeGreaterThan(0);
      expect(errorText).toMatch(/SVG|erlaubt/i);
    });

    it('should return 400 when malicious SVG content is uploaded with image/jpeg MIME type (MIME bypass)', async () => {
      const res = await request(app)
        .post(UPLOAD_ENDPOINT)
        .attach('image', Buffer.from(MALICIOUS_SVG, 'utf8'), {
          filename: 'fake.jpg',
          contentType: 'image/jpeg',
        });

      expect(res.status).toBe(400);
      const body = res.body as Record<string, string>;
      const errorText = body.error ?? body.message ?? '';
      expect(errorText.length).toBeGreaterThan(0);
    });

    it('should return 400 when XML-prolog-prefixed SVG (<?xml ...?><svg ...>) is declared as image/png (prolog bypass)', async () => {
      const res = await request(app)
        .post(UPLOAD_ENDPOINT)
        .attach('image', Buffer.from(XML_PROLOG_SVG, 'utf8'), {
          filename: 'vector.png',
          contentType: 'image/png',
        });

      expect(res.status).toBe(400);
      const body = res.body as Record<string, string>;
      const errorText = body.error ?? body.message ?? '';
      expect(errorText).toMatch(/SVG|erlaubt/i);
    });

    it('should return 400 when XML-prolog-prefixed SVG is declared as image/webp (prolog bypass)', async () => {
      const res = await request(app)
        .post(UPLOAD_ENDPOINT)
        .attach('image', Buffer.from(XML_PROLOG_SVG, 'utf8'), {
          filename: 'vector.webp',
          contentType: 'image/webp',
        });

      expect(res.status).toBe(400);
      const body = res.body as Record<string, string>;
      const errorText = body.error ?? body.message ?? '';
      expect(errorText).toMatch(/SVG|erlaubt/i);
    });
  });

  describe('Sanity check — non-SVG uploads are not blocked by this guard', () => {
    it('should NOT return 400 for a missing file (returns 400 for a different reason: no file provided)', async () => {
      const res = await request(app)
        .post(UPLOAD_ENDPOINT);

      expect(res.status).toBe(400);
      const body = res.body as Record<string, string>;
      const errorText = body.error ?? body.message ?? '';
      expect(errorText).not.toMatch(/SVG/i);
    });
  });
});
