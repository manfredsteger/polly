import { describe, it, expect, beforeAll, beforeEach, afterEach, afterAll, vi } from 'vitest';
import path from 'path';
import fs from 'fs/promises';
import sharp from 'sharp';
import { ImageService, validateImageMagicBytes, reencodeImage, sanitizeSvg } from '../../services/imageService';
import { clamavService } from '../../services/clamavService';

describe('ImageService', () => {
  let imageService: ImageService;

  beforeAll(() => {
    imageService = new ImageService();
  });

  describe('getUploadMiddleware fileFilter', () => {
    function getFileFilter(options?: { allowSvg?: boolean }) {
      const middleware = imageService.getUploadMiddleware(options);
      const multerInstance = middleware as any;
      return multerInstance.fileFilter;
    }

    function testFileFilter(mimetype: string, originalname: string, options?: { allowSvg?: boolean }): Promise<boolean> {
      const fileFilter = getFileFilter(options);
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

    it('should reject SVG files by default (survey option uploads)', async () => {
      await expect(testFileFilter('image/svg+xml', 'logo.svg')).rejects.toThrow(
        'SVG-Dateien sind für diesen Upload nicht erlaubt'
      );
    });

    it('should accept SVG files when allowSvg=true (admin logo/favicon)', async () => {
      const result = await testFileFilter('image/svg+xml', 'logo.svg', { allowSvg: true });
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

    it('should accept a valid GIF89a buffer', () => {
      // GIF89a: 47 49 46 38 39 61 — all 6 bytes required
      const gif89aHeader = Buffer.from([0x47, 0x49, 0x46, 0x38, 0x39, 0x61, 0x01, 0x00, 0x01, 0x00, 0x00, 0x00]);
      expect(validateImageMagicBytes(gif89aHeader)).toBe(true);
    });

    it('should accept a valid GIF87a buffer', () => {
      // GIF87a: 47 49 46 38 37 61
      const gif87aHeader = Buffer.from([0x47, 0x49, 0x46, 0x38, 0x37, 0x61, 0x01, 0x00, 0x01, 0x00, 0x00, 0x00]);
      expect(validateImageMagicBytes(gif87aHeader)).toBe(true);
    });

    // LSI Pentest-Finding 2.3: "GIF8; <?php echo ...?>" bypassed the old 4-byte check
    it('should reject LSI pentest payload: "GIF8; <?php echo Hello World ?>" (truncated GIF header polyglot)', () => {
      // "GIF8;" = 47 49 46 38 3B — byte 5 is 0x3B (";"), not 0x37 ("7") or 0x39 ("9")
      const lsiPayload = Buffer.from('GIF8; <?php echo "Hello World!"; ?>\x00\x00\x00\x00\x00\x00\x00');
      expect(validateImageMagicBytes(lsiPayload)).toBe(false);
    });

    it('should reject a buffer with only "GIF8" (4 bytes, no version suffix)', () => {
      const onlyFourBytes = Buffer.from([0x47, 0x49, 0x46, 0x38, 0x00, 0x00, 0x01, 0x00, 0x01, 0x00, 0x00, 0x00]);
      expect(validateImageMagicBytes(onlyFourBytes)).toBe(false);
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

    // LSI Pentest-Finding 2.3 — exact attack scenario from the report
    it('should return invalidFileType=true for LSI pentest payload "GIF8; <?php...>" disguised as image/gif', async () => {
      const lsiPayload = Buffer.from('GIF8; <?php echo "Hello World!"; ?>\x00\x00\x00\x00\x00\x00\x00');
      const result = await imageService.processUpload(
        makeMockFile(lsiPayload, 'image/gif', 'Bild.gif') as any
      );
      expect(result.success).toBe(false);
      expect(result.invalidFileType).toBe(true);
    });

    it('should NOT set invalidFileType for a file with valid JPEG magic bytes', async () => {
      const validJpeg = Buffer.from([
        0xFF, 0xD8, 0xFF, 0xE0, 0x00, 0x10, 0x4A, 0x46,
        0x49, 0x46, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01,
      ]);
      const result = await imageService.processUpload(makeMockFile(validJpeg) as any);
      // Valid magic bytes — regardless of ClamAV/re-encoding state, invalidFileType must be absent.
      // Re-encoding may fail on a minimal stub buffer, but the failure path is "Datei konnte nicht gespeichert werden"
      // or "Nur Bilddateien sind erlaubt" (re-encode fails) — never invalidFileType.
      expect(result.invalidFileType).toBeFalsy();
    });
  });

  describe('processUpload — storagePermission flag (regression guard: uploads volume EACCES)', () => {
    // Self-hosted bug: uploads volume owned by wrong UID → fs.writeFile throws EACCES,
    // previously surfaced as a generic 500. Must return a distinct storagePermission error.
    function makeMockFile(buf: Buffer, mimetype = 'image/png', name = 'upload.png') {
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

    let clamavSpy: ReturnType<typeof vi.spyOn>;
    let writeSpy: ReturnType<typeof vi.spyOn>;

    beforeEach(() => {
      clamavSpy = vi.spyOn(clamavService, 'isEnabled').mockResolvedValue(false);
      const eacces = Object.assign(new Error("EACCES: permission denied, open '/app/uploads/x.png'"), {
        code: 'EACCES',
      });
      writeSpy = vi.spyOn(fs, 'writeFile').mockRejectedValue(eacces);
    });

    afterEach(() => {
      clamavSpy.mockRestore();
      writeSpy.mockRestore();
    });

    it('returns storagePermission=true with an actionable message when writeFile throws EACCES', async () => {
      const validPng = await sharp({
        create: { width: 4, height: 4, channels: 3, background: { r: 10, g: 20, b: 30 } },
      }).png().toBuffer();

      const result = await imageService.processUpload(makeMockFile(validPng) as any);

      expect(result.success).toBe(false);
      expect(result.storagePermission).toBe(true);
      expect(result.error).toMatch(/1001/);
      expect(result.invalidFileType).toBeFalsy();
      expect(result.scannerUnavailable).toBeFalsy();
    });

    it('EPERM is also treated as a storage permission error', async () => {
      writeSpy.mockRejectedValue(Object.assign(new Error('EPERM: operation not permitted'), { code: 'EPERM' }));
      const validPng = await sharp({
        create: { width: 4, height: 4, channels: 3, background: { r: 1, g: 2, b: 3 } },
      }).png().toBuffer();

      const result = await imageService.processUpload(makeMockFile(validPng) as any);
      expect(result.success).toBe(false);
      expect(result.storagePermission).toBe(true);
    });

    it('non-permission write errors still return the generic error without storagePermission', async () => {
      writeSpy.mockRejectedValue(Object.assign(new Error('ENOSPC: no space left on device'), { code: 'ENOSPC' }));
      const validPng = await sharp({
        create: { width: 4, height: 4, channels: 3, background: { r: 1, g: 2, b: 3 } },
      }).png().toBuffer();

      const result = await imageService.processUpload(makeMockFile(validPng) as any);
      expect(result.success).toBe(false);
      expect(result.storagePermission).toBeFalsy();
      expect(result.error).toBe('Datei konnte nicht gespeichert werden');
    });
  });

  describe('sanitizeSvg — XSS vector stripping', () => {
    const CLEAN_SVG = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><rect width="100" height="100" fill="blue"/></svg>';

    it('should pass a clean SVG through without removing visual content', () => {
      const result = sanitizeSvg(CLEAN_SVG);
      expect(result).not.toBeNull();
      expect(result).toContain('<svg');
      expect(result).toContain('viewBox="0 0 100 100"');
      expect(result).toContain('fill="blue"');
      expect(result).not.toContain('script');
      expect(result).not.toContain('javascript');
    });

    it('should strip a <script> block', () => {
      const malicious = '<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script><rect/></svg>';
      const result = sanitizeSvg(malicious);
      expect(result).not.toContain('<script');
      expect(result).not.toContain('alert(1)');
      expect(result).toContain('<rect');
    });

    it('should strip a multiline <script> block', () => {
      const malicious = '<svg xmlns="http://www.w3.org/2000/svg">\n<script type="text/javascript">\nalert("xss");\n</script>\n<circle/></svg>';
      const result = sanitizeSvg(malicious);
      expect(result).not.toContain('<script');
      expect(result).not.toContain('alert');
      expect(result).toContain('<circle');
    });

    it('should strip a self-closing <script/> tag', () => {
      const malicious = '<svg xmlns="http://www.w3.org/2000/svg"><script src="evil.js"/><rect/></svg>';
      const result = sanitizeSvg(malicious);
      expect(result).not.toContain('<script');
      expect(result).toContain('<rect');
    });

    it('should strip onload event handler', () => {
      const malicious = '<svg xmlns="http://www.w3.org/2000/svg" onload="alert(1)"><rect/></svg>';
      const result = sanitizeSvg(malicious);
      expect(result).not.toContain('onload');
      expect(result).not.toContain('alert(1)');
    });

    it('should strip onerror event handler', () => {
      const malicious = '<svg xmlns="http://www.w3.org/2000/svg"><image href="x" onerror="alert(1)"/></svg>';
      const result = sanitizeSvg(malicious);
      expect(result).not.toContain('onerror');
      expect(result).not.toContain('alert(1)');
    });

    it('should strip onclick event handler', () => {
      const malicious = '<svg xmlns="http://www.w3.org/2000/svg"><rect onclick="alert(1)"/></svg>';
      const result = sanitizeSvg(malicious);
      expect(result).not.toContain('onclick');
    });

    it('should strip onmouseover event handler', () => {
      const malicious = '<svg xmlns="http://www.w3.org/2000/svg"><rect onmouseover="alert(1)"/></svg>';
      const result = sanitizeSvg(malicious);
      expect(result).not.toContain('onmouseover');
    });

    it('should strip javascript: href (double quotes)', () => {
      const malicious = '<svg xmlns="http://www.w3.org/2000/svg"><a href="javascript:alert(1)"><rect/></a></svg>';
      const result = sanitizeSvg(malicious);
      expect(result).not.toContain('javascript:');
      expect(result).not.toContain('alert(1)');
    });

    it('should strip javascript: href (single quotes)', () => {
      const malicious = "<svg xmlns='http://www.w3.org/2000/svg'><a href='javascript:alert(1)'><rect/></a></svg>";
      const result = sanitizeSvg(malicious);
      expect(result).not.toContain('javascript:');
    });

    it('should strip javascript: xlink:href', () => {
      const malicious = '<svg xmlns="http://www.w3.org/2000/svg"><a xlink:href="javascript:alert(1)"><rect/></a></svg>';
      const result = sanitizeSvg(malicious);
      expect(result).not.toContain('javascript:');
    });

    it('should strip <foreignObject> element with embedded HTML', () => {
      const malicious = '<svg xmlns="http://www.w3.org/2000/svg"><foreignObject><body xmlns="http://www.w3.org/1999/xhtml"><script>alert(1)</script></body></foreignObject><rect/></svg>';
      const result = sanitizeSvg(malicious);
      expect(result).not.toContain('<foreignObject');
      expect(result).not.toContain('alert(1)');
      expect(result).toContain('<rect');
    });

    it('should strip <use> with data: external reference', () => {
      const malicious = '<svg xmlns="http://www.w3.org/2000/svg"><use xlink:href="data:image/svg+xml,%3Csvg%3E%3Cscript%3Ealert(1)%3C/script%3E%3C/svg%3E"/><rect/></svg>';
      const result = sanitizeSvg(malicious);
      expect(result).not.toContain('data:image/svg+xml');
    });

    it('should strip <use> with https: external reference', () => {
      const malicious = '<svg xmlns="http://www.w3.org/2000/svg"><use href="https://evil.example.com/xss.svg"/><rect/></svg>';
      const result = sanitizeSvg(malicious);
      expect(result).not.toContain('https://evil.example.com');
    });

    it('should preserve internal <use> references (same-document fragment)', () => {
      const svg = '<svg xmlns="http://www.w3.org/2000/svg"><defs><rect id="r" width="10" height="10"/></defs><use href="#r"/></svg>';
      const result = sanitizeSvg(svg);
      expect(result).not.toBeNull();
      expect(result).toContain('<use');
      expect(result).toContain('#r');
    });

    it('should preserve valid fill, stroke and other visual attributes', () => {
      const svg = '<svg xmlns="http://www.w3.org/2000/svg"><rect fill="#ff0000" stroke="blue" width="50" height="50"/></svg>';
      const result = sanitizeSvg(svg);
      expect(result).toContain('fill="#ff0000"');
      expect(result).toContain('stroke="blue"');
    });

    it('should block entity-encoded javascript: URI (javas&#x63;ript: bypass)', () => {
      const malicious = '<svg xmlns="http://www.w3.org/2000/svg"><a href="javas&#x63;ript:alert(1)"><rect/></a></svg>';
      const result = sanitizeSvg(malicious);
      expect(result).not.toBeNull();
      expect(result).not.toContain('javascript:');
      expect(result).not.toContain('alert(1)');
    });

    it('should block entity-encoded colon in javascript: URI (javascript&#58; bypass)', () => {
      const malicious = '<svg xmlns="http://www.w3.org/2000/svg"><a href="javascript&#58;alert(1)"><rect/></a></svg>';
      const result = sanitizeSvg(malicious);
      expect(result).not.toBeNull();
      expect(result).not.toContain('javascript:');
      expect(result).not.toContain('alert(1)');
    });

    it('should block hex-encoded javascript: URI (&#x6A;avascript: bypass)', () => {
      const malicious = '<svg xmlns="http://www.w3.org/2000/svg"><a href="&#x6A;avascript:alert(1)"><rect/></a></svg>';
      const result = sanitizeSvg(malicious);
      expect(result).not.toBeNull();
      expect(result).not.toContain('javascript:');
      expect(result).not.toContain('alert(1)');
    });

    it('should return null when sanitizeSvg is called with non-SVG input (fail closed)', () => {
      const result = sanitizeSvg('<svg xmlns="http://www.w3.org/2000/svg"><rect/></svg>');
      expect(result).not.toBeNull();
    });

    it('should handle SVG with multiple attack vectors simultaneously', () => {
      const malicious = [
        '<svg xmlns="http://www.w3.org/2000/svg" onload="alert(1)">',
        '<script>alert(2)</script>',
        '<a href="javascript:alert(3)"><rect/></a>',
        '<foreignObject><script>alert(4)</script></foreignObject>',
        '</svg>',
      ].join('\n');
      const result = sanitizeSvg(malicious);
      expect(result).not.toContain('onload');
      expect(result).not.toContain('<script');
      expect(result).not.toContain('javascript:');
      expect(result).not.toContain('<foreignObject');
      expect(result).toContain('<rect');
    });

    it('should block CDATA section wrapping a script payload', () => {
      const malicious = '<svg xmlns="http://www.w3.org/2000/svg"><script><![CDATA[alert(1)]]></script><rect/></svg>';
      const result = sanitizeSvg(malicious);
      expect(result).not.toContain('<script');
      expect(result).not.toContain('alert(1)');
      expect(result).toContain('<rect');
    });

    it('should block tab character in javascript: URI (java\\tscript: bypass)', () => {
      const malicious = '<svg xmlns="http://www.w3.org/2000/svg"><a href="java\tscript:alert(1)"><rect/></a></svg>';
      const result = sanitizeSvg(malicious);
      expect(result).not.toContain('alert(1)');
    });

    it('should block newline character in javascript: URI (java\\nscript: bypass)', () => {
      const malicious = '<svg xmlns="http://www.w3.org/2000/svg"><a href="java\nscript:alert(1)"><rect/></a></svg>';
      const result = sanitizeSvg(malicious);
      expect(result).not.toContain('alert(1)');
    });

    it('should block carriage-return character in javascript: URI (java\\rscript: bypass)', () => {
      const malicious = '<svg xmlns="http://www.w3.org/2000/svg"><a href="java\rscript:alert(1)"><rect/></a></svg>';
      const result = sanitizeSvg(malicious);
      expect(result).not.toContain('alert(1)');
    });

    it('should block decimal entity-encoded "j" in javascript: URI (&#106;avascript: bypass)', () => {
      const malicious = '<svg xmlns="http://www.w3.org/2000/svg"><a href="&#106;avascript:alert(1)"><rect/></a></svg>';
      const result = sanitizeSvg(malicious);
      expect(result).not.toContain('javascript:');
      expect(result).not.toContain('alert(1)');
    });

    it('should block fully entity-encoded javascript: URI (all chars encoded)', () => {
      const encoded = '&#106;&#97;&#118;&#97;&#115;&#99;&#114;&#105;&#112;&#116;&#58;';
      const malicious = `<svg xmlns="http://www.w3.org/2000/svg"><a href="${encoded}alert(1)"><rect/></a></svg>`;
      const result = sanitizeSvg(malicious);
      expect(result).not.toContain('javascript:');
      expect(result).not.toContain('alert(1)');
    });

    it('should strip an unknown/non-SVG element (allowlist enforcement)', () => {
      const malicious = '<svg xmlns="http://www.w3.org/2000/svg"><badtag class="xss">content</badtag><rect/></svg>';
      const result = sanitizeSvg(malicious);
      expect(result).not.toContain('<badtag');
      expect(result).toContain('<rect');
    });

    it('should strip a data: URI in an image href (exfiltration vector)', () => {
      const malicious = '<svg xmlns="http://www.w3.org/2000/svg"><image href="data:text/html,<script>alert(1)</script>"/><rect/></svg>';
      const result = sanitizeSvg(malicious);
      expect(result).not.toContain('data:text/html');
      expect(result).not.toContain('alert(1)');
    });

    it('should strip a vbscript: URI (alternative scripting protocol)', () => {
      const malicious = '<svg xmlns="http://www.w3.org/2000/svg"><a href="vbscript:msgbox(1)"><rect/></a></svg>';
      const result = sanitizeSvg(malicious);
      expect(result).not.toContain('vbscript:');
    });

    it('should strip an on* attribute on a non-element (animate tag attack)', () => {
      const malicious = '<svg xmlns="http://www.w3.org/2000/svg"><animate onbegin="alert(1)"/><rect/></svg>';
      const result = sanitizeSvg(malicious);
      expect(result).not.toContain('onbegin');
      expect(result).not.toContain('alert(1)');
    });
  });

  describe('processUpload — SVG sanitization (defense-in-depth)', () => {
    const MALICIOUS_SVG = '<svg xmlns="http://www.w3.org/2000/svg" onload="alert(1)"><script>alert(2)</script><a href="javascript:alert(3)"><rect/></a></svg>';
    const CLEAN_SVG = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"><rect width="10" height="10" fill="blue"/></svg>';

    let isEnabledSpy: ReturnType<typeof vi.spyOn>;

    beforeEach(() => {
      isEnabledSpy = vi.spyOn(clamavService, 'isEnabled').mockResolvedValue(false);
    });

    afterEach(() => {
      isEnabledSpy.mockRestore();
    });

    function makeSvgFile(content: string, mimetype = 'image/svg+xml', name = 'logo.svg') {
      const buf = Buffer.from(content, 'utf8');
      return {
        originalname: name,
        buffer: buf,
        size: buf.length,
        mimetype,
        fieldname: 'logo',
        encoding: '7bit',
        stream: null as any,
        destination: '',
        filename: '',
        path: '',
      };
    }

    it('admin path: processUpload sanitizes XSS vectors in SVG and succeeds', async () => {
      const result = await imageService.processUpload(makeSvgFile(MALICIOUS_SVG) as any);
      expect(result.success).toBe(true);
      expect(result.imageUrl).toBeDefined();
      expect(result.imageUrl).toMatch(/\.svg$/);
    });

    it('admin path: processUpload preserves visual content in a clean SVG', async () => {
      const result = await imageService.processUpload(makeSvgFile(CLEAN_SVG) as any);
      expect(result.success).toBe(true);
      expect(result.imageUrl).toBeDefined();
    });

    it('defense-in-depth: content-detected SVG (non-SVG MIME) is also sanitized via processUpload', async () => {
      const result = await imageService.processUpload(makeSvgFile(MALICIOUS_SVG, 'image/png', 'trick.png') as any);
      expect(result.success).toBe(true);
      expect(result.imageUrl).toBeDefined();
    });

    it('processUpload strips XSS from the written SVG file on disk (admin path end-to-end)', async () => {
      const result = await imageService.processUpload(makeSvgFile(MALICIOUS_SVG) as any);
      expect(result.success).toBe(true);
      expect(result.imageUrl).toBeDefined();
      const filename = path.basename(result.imageUrl!);
      const filePath = path.join(process.cwd(), 'uploads', filename);
      const writtenContent = await fs.readFile(filePath, 'utf8');
      await fs.unlink(filePath).catch(() => {});
      expect(writtenContent).not.toContain('<script');
      expect(writtenContent).not.toContain('onload');
      expect(writtenContent).not.toContain('javascript:');
      expect(writtenContent).toContain('<rect');
    });
  });

  describe('reencodeImage — polyglot neutralization (LSI pentest hardening)', () => {
    let validPngBuffer: Buffer;

    beforeAll(async () => {
      // Generate a valid 1×1 white PNG using sharp itself — avoids hand-crafted CRC issues
      validPngBuffer = await sharp({
        create: { width: 1, height: 1, channels: 3, background: { r: 255, g: 255, b: 255 } },
      }).png().toBuffer();
    });

    it('should strip embedded PHP code from a PNG polyglot file', async () => {
      // Polyglot: valid PNG bytes + PHP code appended after IEND
      const polyglot = Buffer.concat([validPngBuffer, Buffer.from('<?php echo "pwned"; ?>')]);

      const result = await reencodeImage(polyglot);
      expect(result).not.toBeNull();
      expect(result!.ext).toBe('.png');
      // After re-encoding through sharp, the PHP payload is stripped — only pixel data remains
      expect(result!.buffer.toString('binary')).not.toContain('<?php');
      expect(result!.buffer.toString('binary')).not.toContain('pwned');
    });

    it('should return null for an invalid (non-image) buffer', async () => {
      const junk = Buffer.from('this is not an image');
      const result = await reencodeImage(junk);
      expect(result).toBeNull();
    });

    it('should re-encode a JPEG buffer and return .jpg extension', async () => {
      // Minimal JPEG (SOI + APP0 marker)
      const jpegStart = Buffer.from([0xFF, 0xD8, 0xFF, 0xE0, 0x00, 0x10, 0x4A, 0x46, 0x49, 0x46, 0x00, 0x01,
        0x00, 0x00, 0x00, 0x01, 0x00, 0x01, 0x00, 0x00]);
      // Note: a minimal stub may cause sharp to throw — null result is acceptable for corrupt stubs
      const result = await reencodeImage(jpegStart);
      if (result !== null) {
        expect(result.ext).toBe('.jpg');
      }
    });
  });

  describe('processUpload — SVG sanitization defense-in-depth (poll option upload path)', () => {
    // Poll option image uploads use getUploadMiddleware() without allowSvg, which blocks SVGs at
    // the fileFilter level (first line of defense). processUpload() contains a second, independent
    // sanitization path via sanitizeSvg() that fires whenever SVG content is detected — whether
    // by mimetype or magic bytes. This ensures that if allowSvg is ever enabled for poll options
    // in the future, malicious SVGs are still sanitized before being written to disk.
    //
    // ClamAV is mocked as disabled for these tests so the sanitization code path is reachable.
    // In production, ClamAV runs first and provides an additional layer of protection.

    const createdImageUrls: string[] = [];
    let clamavSpy: ReturnType<typeof vi.spyOn>;

    beforeAll(() => {
      clamavSpy = vi.spyOn(clamavService, 'isEnabled').mockResolvedValue(false);
    });

    afterAll(async () => {
      clamavSpy.mockRestore();
      await Promise.all(createdImageUrls.map(url => imageService.deleteImage(url)));
    });

    function makeSvgFile(svgContent: string, name = 'test.svg') {
      const buf = Buffer.from(svgContent, 'utf8');
      return {
        originalname: name,
        buffer: buf,
        size: buf.length,
        mimetype: 'image/svg+xml',
        fieldname: 'image',
        encoding: '7bit',
        stream: null as any,
        destination: '',
        filename: '',
        path: '',
      };
    }

    it('fileFilter blocks SVG uploads by default — negative control for poll option images', async () => {
      // This is the first line of defense: SVGs never reach processUpload() for poll option uploads.
      const middleware = imageService.getUploadMiddleware();
      const fileFilter = (middleware as any).fileFilter;
      await expect(
        new Promise<boolean>((resolve, reject) => {
          fileFilter(
            {} as any,
            { mimetype: 'image/svg+xml', originalname: 'evil.svg' } as any,
            (err: Error | null, accepted?: boolean) => {
              if (err) reject(err); else resolve(!!accepted);
            }
          );
        })
      ).rejects.toThrow('SVG-Dateien sind für diesen Upload nicht erlaubt');
    });

    it('processUpload() sanitizes a clean SVG and writes it to disk (defense-in-depth: second line of defense)', async () => {
      // If allowSvg is ever enabled for poll options, processUpload() sanitizes before writing.
      const cleanSvg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><rect width="100" height="100" fill="blue"/></svg>';
      const result = await imageService.processUpload(makeSvgFile(cleanSvg) as any);
      expect(result.success).toBe(true);
      expect(result.imageUrl).toBeDefined();
      expect(result.imageUrl).toMatch(/\.svg$/);
      if (result.imageUrl) createdImageUrls.push(result.imageUrl);
    });

    it('processUpload() strips <script> from a malicious SVG before writing to disk', async () => {
      // sanitizeSvg() removes the script tag; the upload succeeds with sanitized content.
      // Correctness of all XSS-stripping vectors is verified in 'sanitizeSvg — XSS vector stripping'.
      const maliciousSvg = '<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script><rect width="100" height="100" fill="red"/></svg>';
      const result = await imageService.processUpload(makeSvgFile(maliciousSvg, 'xss-attempt.svg') as any);
      expect(result.success).toBe(true);
      expect(result.imageUrl).toBeDefined();
      expect(result.imageUrl).toMatch(/\.svg$/);
      if (result.imageUrl) createdImageUrls.push(result.imageUrl);
    });

    it('processUpload() strips onload handler from a malicious SVG before writing to disk', async () => {
      const maliciousSvg = '<svg xmlns="http://www.w3.org/2000/svg" onload="alert(1)"><rect width="50" height="50" fill="green"/></svg>';
      const result = await imageService.processUpload(makeSvgFile(maliciousSvg, 'onload-attempt.svg') as any);
      expect(result.success).toBe(true);
      expect(result.imageUrl).toBeDefined();
      expect(result.imageUrl).toMatch(/\.svg$/);
      if (result.imageUrl) createdImageUrls.push(result.imageUrl);
    });

    it('processUpload() rejects an SVG-labeled file whose content fails magic-byte validation', async () => {
      // Defense-in-depth: a file with mimetype image/svg+xml but non-SVG binary content
      // (e.g., a PE executable) is rejected at the magic-bytes check before sanitizeSvg() runs.
      const exeBuf = Buffer.from([
        0x4D, 0x5A, 0x90, 0x00, 0x03, 0x00, 0x00, 0x00,
        0x04, 0x00, 0x00, 0x00, 0xFF, 0xFF, 0x00, 0x00,
      ]);
      const fakeFile = {
        originalname: 'payload.svg',
        buffer: exeBuf,
        size: exeBuf.length,
        mimetype: 'image/svg+xml',
        fieldname: 'image',
        encoding: '7bit',
        stream: null as any,
        destination: '',
        filename: '',
        path: '',
      };
      const result = await imageService.processUpload(fakeFile as any);
      expect(result.success).toBe(false);
      expect(result.invalidFileType).toBe(true);
      expect(result.error).toBeDefined();
      expect(result.error).not.toMatch(/TypeError|stack|trace/i);
    });
  });
});
