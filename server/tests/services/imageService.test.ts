import { describe, it, expect, beforeAll } from 'vitest';
import { ImageService } from '../../services/imageService';

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
});
