import { describe, it, expect, beforeAll } from 'vitest';
import { ImageService, validateImageMagicBytes } from '../../services/imageService';

describe('ImageService', () => {
  let imageService: ImageService;

  beforeAll(() => {
    imageService = new ImageService();
  });

  describe('getUploadMiddleware fileFilter', () => {
    function getFileFilter() {
      const middleware = imageService.getUploadMiddleware();
      const multerInstance = middleware as any;
      return multerInstance.fileFilter;
    }

    function testFileFilter(mimetype: string, originalname: string): Promise<boolean> {
      const fileFilter = getFileFilter();
      return new Promise((resolve, reject) => {
        const fakeReq = {} as any;
        const fakeFile = { mimetype, originalname } as any;
        fileFilter(fakeReq, fakeFile, (err: Error | null, accepted?: boolean) => {
          if (err) {
            reject(err);
          } else {
            resolve(!!accepted);
          }
        });
      });
    }

    it('should accept PNG files', async () => {
      const result = await testFileFilter('image/png', 'logo.png');
      expect(result).toBe(true);
    });

    it('should accept JPEG files', async () => {
      const result = await testFileFilter('image/jpeg', 'logo.jpg');
      expect(result).toBe(true);
    });

    it('should accept SVG files', async () => {
      const result = await testFileFilter('image/svg+xml', 'logo.svg');
      expect(result).toBe(true);
    });

    it('should accept WebP files', async () => {
      const result = await testFileFilter('image/webp', 'logo.webp');
      expect(result).toBe(true);
    });

    it('should accept GIF files', async () => {
      const result = await testFileFilter('image/gif', 'animation.gif');
      expect(result).toBe(true);
    });

    it('should accept BMP files', async () => {
      const result = await testFileFilter('image/bmp', 'logo.bmp');
      expect(result).toBe(true);
    });

    it('should accept ICO files', async () => {
      const result = await testFileFilter('image/x-icon', 'favicon.ico');
      expect(result).toBe(true);
    });

    it('should accept AVIF files', async () => {
      const result = await testFileFilter('image/avif', 'photo.avif');
      expect(result).toBe(true);
    });

    it('should reject PDF files', async () => {
      await expect(testFileFilter('application/pdf', 'document.pdf')).rejects.toThrow('Nur Bilddateien sind erlaubt');
    });

    it('should reject text files', async () => {
      await expect(testFileFilter('text/plain', 'readme.txt')).rejects.toThrow('Nur Bilddateien sind erlaubt');
    });

    it('should reject JavaScript files', async () => {
      await expect(testFileFilter('application/javascript', 'script.js')).rejects.toThrow('Nur Bilddateien sind erlaubt');
    });

    it('should reject HTML files', async () => {
      await expect(testFileFilter('text/html', 'page.html')).rejects.toThrow('Nur Bilddateien sind erlaubt');
    });

    it('should reject ZIP files', async () => {
      await expect(testFileFilter('application/zip', 'archive.zip')).rejects.toThrow('Nur Bilddateien sind erlaubt');
    });

    it('should reject executables', async () => {
      await expect(testFileFilter('application/octet-stream', 'program.exe')).rejects.toThrow('Nur Bilddateien sind erlaubt');
    });
  });

  describe('getUploadMiddleware limits', () => {
    it('should have a 5MB file size limit', () => {
      const middleware = imageService.getUploadMiddleware();
      const multerInstance = middleware as any;
      expect(multerInstance.limits?.fileSize).toBe(5 * 1024 * 1024);
    });
  });

  describe('getImageUrl', () => {
    it('should return correct URL path', () => {
      const url = imageService.getImageUrl('test-image-123.png');
      expect(url).toBe('/uploads/test-image-123.png');
    });
  });

  describe('validateImageMagicBytes — real content check (pentest hardening)', () => {
    it('should accept a valid JPEG buffer', () => {
      const jpegHeader = Buffer.from([0xFF, 0xD8, 0xFF, 0xE0, 0x00, 0x10, 0x4A, 0x46, 0x49, 0x46, 0x00, 0x01]);
      expect(validateImageMagicBytes(jpegHeader)).toBe(true);
    });

    it('should accept a valid PNG buffer', () => {
      const pngHeader = Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, 0x00, 0x00, 0x00, 0x0D]);
      expect(validateImageMagicBytes(pngHeader)).toBe(true);
    });

    it('should accept a valid GIF buffer', () => {
      const gifHeader = Buffer.from([0x47, 0x49, 0x46, 0x38, 0x39, 0x61, 0x01, 0x00, 0x01, 0x00, 0x00, 0x00]);
      expect(validateImageMagicBytes(gifHeader)).toBe(true);
    });

    it('should accept a valid WebP buffer', () => {
      const webpHeader = Buffer.from([
        0x52, 0x49, 0x46, 0x46,
        0x24, 0x00, 0x00, 0x00,
        0x57, 0x45, 0x42, 0x50,
      ]);
      expect(validateImageMagicBytes(webpHeader)).toBe(true);
    });

    it('should accept a valid BMP buffer', () => {
      const bmpHeader = Buffer.from([0x42, 0x4D, 0x36, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x36, 0x00]);
      expect(validateImageMagicBytes(bmpHeader)).toBe(true);
    });

    it('should accept a valid ICO buffer', () => {
      const icoHeader = Buffer.from([0x00, 0x00, 0x01, 0x00, 0x01, 0x00, 0x10, 0x10, 0x00, 0x00, 0x01, 0x00]);
      expect(validateImageMagicBytes(icoHeader)).toBe(true);
    });

    it('should accept inline SVG content', () => {
      const svgContent = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><rect/></svg>');
      expect(validateImageMagicBytes(svgContent)).toBe(true);
    });

    it('should reject PHP script disguised as image/jpeg (MIME spoofing attack)', () => {
      const phpScript = Buffer.from('<?php system($_GET["cmd"]); ?>\x00\x00\x00\x00\x00\x00\x00\x00\x00');
      expect(validateImageMagicBytes(phpScript)).toBe(false);
    });

    it('should reject a plain text file disguised as image/png', () => {
      const textContent = Buffer.from('This is just plain text content, not an image at all.');
      expect(validateImageMagicBytes(textContent)).toBe(false);
    });

    it('should reject an HTML file disguised as image', () => {
      const htmlContent = Buffer.from('<html><body><script>alert(1)</script></body></html>');
      expect(validateImageMagicBytes(htmlContent)).toBe(false);
    });

    it('should reject a ZIP/JAR file disguised as image', () => {
      const zipHeader = Buffer.from([0x50, 0x4B, 0x03, 0x04, 0x14, 0x00, 0x00, 0x00, 0x08, 0x00, 0x00, 0x00]);
      expect(validateImageMagicBytes(zipHeader)).toBe(false);
    });

    it('should reject a PE executable disguised as image', () => {
      const exeHeader = Buffer.from([0x4D, 0x5A, 0x90, 0x00, 0x03, 0x00, 0x00, 0x00, 0x04, 0x00, 0x00, 0x00]);
      expect(validateImageMagicBytes(exeHeader)).toBe(false);
    });

    it('should reject an ELF binary disguised as image', () => {
      const elfHeader = Buffer.from([0x7F, 0x45, 0x4C, 0x46, 0x02, 0x01, 0x01, 0x00, 0x00, 0x00, 0x00, 0x00]);
      expect(validateImageMagicBytes(elfHeader)).toBe(false);
    });

    it('should reject a buffer that is too short', () => {
      const shortBuffer = Buffer.from([0xFF, 0xD8]);
      expect(validateImageMagicBytes(shortBuffer)).toBe(false);
    });

    it('should reject an empty buffer', () => {
      expect(validateImageMagicBytes(Buffer.alloc(0))).toBe(false);
    });

    it('should reject a null-byte buffer', () => {
      const nullBuffer = Buffer.alloc(20, 0x00);
      expect(validateImageMagicBytes(nullBuffer)).toBe(false);
    });
  });

  describe('processUpload — invalidFileType flag (regression guard)', () => {
    // These tests exist because the MIME-filter in multer only checks the
    // Content-Type header, which can be spoofed. processUpload runs a second
    // layer of defence (magic-byte validation). When that check fails the
    // result MUST carry invalidFileType=true so HTTP routes return 400 instead
    // of the generic 500 fallback — a difference that was previously untested
    // and caused CI failures in hardening.test.ts T011.

    function makeMockFile(buf: Buffer, mimetype = 'image/jpeg', name = 'upload.jpg') {
      return {
        originalname: name,
        buffer: buf,
        size: buf.length,
        mimetype,
        fieldname: 'image',
        encoding: '7bit',
        stream: null as any,
        destination: '',
        filename: '',
        path: '',
      };
    }

    it('should return invalidFileType=true when content is a PHP script disguised as JPEG', async () => {
      const phpPayload = Buffer.from('<?php system($_GET["cmd"]); ?>\x00\x00\x00\x00\x00');
      const result = await imageService.processUpload(makeMockFile(phpPayload) as any);
      expect(result.success).toBe(false);
      expect(result.invalidFileType).toBe(true);
      expect(result.error).toBeDefined();
      expect(result.error).not.toMatch(/php|system|exec|TypeError|multer|stack/i);
    });

    it('should return invalidFileType=true for a ZIP archive disguised as PNG', async () => {
      const zipHeader = Buffer.from([
        0x50, 0x4B, 0x03, 0x04, 0x14, 0x00, 0x00, 0x00,
        0x08, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
      ]);
      const result = await imageService.processUpload(makeMockFile(zipHeader, 'image/png', 'archive.png') as any);
      expect(result.success).toBe(false);
      expect(result.invalidFileType).toBe(true);
    });

    it('should return invalidFileType=true for a PE executable disguised as image', async () => {
      const exeHeader = Buffer.from([
        0x4D, 0x5A, 0x90, 0x00, 0x03, 0x00, 0x00, 0x00,
        0x04, 0x00, 0x00, 0x00, 0xFF, 0xFF, 0x00, 0x00,
      ]);
      const result = await imageService.processUpload(makeMockFile(exeHeader, 'image/jpeg', 'payload.jpg') as any);
      expect(result.success).toBe(false);
      expect(result.invalidFileType).toBe(true);
    });

    it('should NOT set invalidFileType for a file with valid JPEG magic bytes', async () => {
      const validJpeg = Buffer.from([
        0xFF, 0xD8, 0xFF, 0xE0, 0x00, 0x10, 0x4A, 0x46,
        0x49, 0x46, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01,
      ]);
      const result = await imageService.processUpload(makeMockFile(validJpeg) as any);
      // The file has valid magic bytes — regardless of ClamAV state,
      // invalidFileType must be absent/falsy.
      expect(result.invalidFileType).toBeFalsy();
    });
  });
});
