import multer from 'multer';
import path from 'path';
import fs from 'fs/promises';
import sharp from 'sharp';
import { JSDOM } from 'jsdom';
import createDOMPurify from 'dompurify';
import { clamavService } from './clamavService';
import { emailService } from './emailService';
import { storage } from '../storage';
import type { InsertClamavScanLog } from '@shared/schema';

/**
 * Lazy-initialised DOMPurify instance backed by a JSDOM window.
 * Created once and reused — JSDOM startup is expensive.
 */
let _domPurify: ReturnType<typeof createDOMPurify> | null = null;

function getDOMPurify(): ReturnType<typeof createDOMPurify> {
  if (!_domPurify) {
    const { window } = new JSDOM('');
    const purify = createDOMPurify(window as unknown as Window);

    purify.addHook('afterSanitizeAttributes', (node: Element) => {
      for (const attr of ['href', 'xlink:href', 'src', 'action']) {
        if (node.hasAttribute(attr)) {
          const val = node.getAttribute(attr) ?? '';
          if (!val.startsWith('#')) {
            node.removeAttribute(attr);
          }
        }
      }
    });

    _domPurify = purify;
  }
  return _domPurify;
}

/**
 * Sanitizes SVG content using DOMPurify (SVG + svgFilters profile) backed
 * by a JSDOM DOM parser.
 *
 * Because the DOM parser resolves XML entity encoding before DOMPurify
 * inspects attribute values, obfuscated vectors such as `javas&#x63;ript:`
 * or `javascript&#58;` are normalised at parse time and then blocked by
 * DOMPurify — something a regex pass cannot guarantee.
 *
 * Sanitization rules:
 *  - SVG element/attribute allowlist enforced (non-SVG content stripped)
 *  - <script>, <foreignObject>, event-handler attributes (on*) removed
 *  - javascript: URIs blocked by DOMPurify URI validation
 *  - All href / xlink:href / src / action attributes restricted to
 *    same-document fragment references (#...) by a post-sanitize hook;
 *    external and data: URIs are removed
 *  - <use> is explicitly re-allowed (common in logos) but its href is
 *    subject to the fragment-only hook above
 *
 * Returns `null` when parsing or sanitization throws — callers must treat
 * null as a hard rejection (fail closed, reject the upload).
 */
export function sanitizeSvg(svgContent: string): string | null {
  try {
    const purify = getDOMPurify();
    const sanitized = purify.sanitize(svgContent, {
      USE_PROFILES: { svg: true, svgFilters: true },
      ADD_TAGS: ['use'],
      ADD_ATTR: ['href', 'xlink:href'],
      RETURN_DOM: false,
      RETURN_DOM_FRAGMENT: false,
    });
    return sanitized;
  } catch (err) {
    console.error('[ImageService] SVG sanitization error:', err);
    return null;
  }
}

export interface UploadResult {
  success: boolean;
  imageUrl?: string;
  error?: string;
  virusName?: string;
  scannerUnavailable?: boolean;
  invalidFileType?: boolean;
}

export interface ScanContext {
  userId?: number;
  email?: string;
  requestIp?: string;
}

const ALLOWED_MIME_PREFIXES = ['image/'];

type ReencodingFormat = 'jpeg' | 'png' | 'gif' | 'webp' | 'avif';

const REENCODE_FORMAT_MAP: Record<string, { format: ReencodingFormat; ext: string }> = {
  jpeg: { format: 'jpeg', ext: '.jpg' },
  png:  { format: 'png',  ext: '.png' },
  gif:  { format: 'gif',  ext: '.gif' },
  webp: { format: 'webp', ext: '.webp' },
  avif: { format: 'avif', ext: '.avif' },
};

export function validateImageMagicBytes(buffer: Buffer): boolean {
  if (buffer.length < 12) return false;

  const b = buffer;

  if (b[0] === 0xFF && b[1] === 0xD8 && b[2] === 0xFF) return true;

  if (b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4E && b[3] === 0x47 &&
      b[4] === 0x0D && b[5] === 0x0A && b[6] === 0x1A && b[7] === 0x0A) return true;

  // GIF87a: 47 49 46 38 37 61 — GIF89a: 47 49 46 38 39 61
  // Full 6-byte check prevents "GIF8; <?php...>" polyglot bypass (LSI pentest finding 2.3)
  if (b[0] === 0x47 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x38 &&
      (b[4] === 0x37 || b[4] === 0x39) && b[5] === 0x61) return true;

  if (b[0] === 0x52 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x46 &&
      b[8] === 0x57 && b[9] === 0x45 && b[10] === 0x42 && b[11] === 0x50) return true;

  if (b[0] === 0x42 && b[1] === 0x4D) return true;

  if (b[0] === 0x00 && b[1] === 0x00 && b[2] === 0x01 && b[3] === 0x00) return true;

  if (b[4] === 0x66 && b[5] === 0x74 && b[6] === 0x79 && b[7] === 0x70) {
    const brand = buffer.slice(8, 12).toString('ascii');
    if (['avif', 'heic', 'heif', 'mif1', 'msf1'].some(t => brand.startsWith(t))) return true;
  }

  const start = buffer.slice(0, 512).toString('utf8').toLowerCase().trimStart();
  if (start.startsWith('<svg') || start.startsWith('<?xml')) return true;

  return false;
}

export async function reencodeImage(buffer: Buffer): Promise<{ buffer: Buffer; ext: string } | null> {
  try {
    const instance = sharp(buffer, { failOnError: true });
    const { format } = await instance.metadata();

    if (!format) return null;

    const mapping = REENCODE_FORMAT_MAP[format];
    if (!mapping) {
      return null;
    }

    const reencoded = await instance
      .withMetadata(false)
      .toFormat(mapping.format)
      .toBuffer();

    return { buffer: reencoded, ext: mapping.ext };
  } catch {
    return null;
  }
}

export class ImageService {
  private uploadDir = path.join(process.cwd(), 'uploads');

  constructor() {
    this.ensureUploadDir();
  }

  private async ensureUploadDir() {
    try {
      await fs.access(this.uploadDir);
    } catch {
      await fs.mkdir(this.uploadDir, { recursive: true });
    }
  }

  getUploadMiddleware(options?: { allowSvg?: boolean }) {
    const allowSvg = options?.allowSvg ?? false;
    return multer({
      storage: multer.memoryStorage(),
      limits: {
        fileSize: 5 * 1024 * 1024,
      },
      fileFilter: (req, file, cb) => {
        if (file.mimetype === 'image/svg+xml' && !allowSvg) {
          const err = new Error('SVG-Dateien sind für diesen Upload nicht erlaubt') as Error & { status: number };
          err.status = 400;
          cb(err);
          return;
        }
        if (ALLOWED_MIME_PREFIXES.some(prefix => file.mimetype.startsWith(prefix))) {
          cb(null, true);
        } else {
          cb(new Error('Nur Bilddateien sind erlaubt'));
        }
      }
    });
  }

  async processUpload(file: Express.Multer.File, context?: ScanContext, options?: { allowSvg?: boolean }): Promise<UploadResult> {
    if (!validateImageMagicBytes(file.buffer)) {
      console.warn(`[ImageService] Magic-Byte-Prüfung fehlgeschlagen: ${file.originalname} (${file.mimetype})`);
      return {
        success: false,
        error: 'Nur Bilddateien sind erlaubt',
        invalidFileType: true,
      };
    }

    const _svgTextStart = file.buffer.slice(0, 1024).toString('utf8').toLowerCase().trimStart();
    const isSvgContent = file.mimetype === 'image/svg+xml' ||
      _svgTextStart.startsWith('<svg') ||
      _svgTextStart.startsWith('<?xml') ||
      _svgTextStart.startsWith('<!doctype svg') ||
      /^[\s\S]{0,300}<svg[\s>]/i.test(_svgTextStart);

    if (isSvgContent && options?.allowSvg === false) {
      console.warn(`[ImageService] SVG content blocked (endpoint disallows SVG): ${file.originalname} (${file.mimetype})`);
      return {
        success: false,
        error: 'SVG-Dateien sind für diesen Upload nicht erlaubt',
        invalidFileType: true,
      };
    }

    const clamavEnabled = await clamavService.isEnabled();
    const scanStartTime = Date.now();

    if (clamavEnabled) {
      console.log(`[ClamAV] Scanne Upload: ${file.originalname} (${file.size} bytes)`);

      const scanResult = await clamavService.scanBuffer(file.buffer, file.originalname);
      const scanDuration = Date.now() - scanStartTime;

      let scanStatus: 'clean' | 'infected' | 'error' | 'skipped';
      if (scanResult.scannerUnavailable) {
        scanStatus = 'error';
      } else if (scanResult.isClean) {
        scanStatus = 'clean';
      } else if (scanResult.virusName) {
        scanStatus = 'infected';
      } else {
        scanStatus = 'error';
      }

      const scanLog: InsertClamavScanLog = {
        filename: file.originalname,
        fileSize: file.size,
        mimeType: file.mimetype,
        scanStatus,
        virusName: scanResult.virusName || null,
        errorMessage: scanResult.scannerUnavailable ? 'Scanner nicht erreichbar - Upload blockiert (fail-secure)' : (scanResult.error || null),
        actionTaken: scanResult.isClean ? 'allowed' : 'blocked',
        uploaderUserId: context?.userId || null,
        uploaderEmail: context?.email || null,
        requestIp: context?.requestIp || null,
        scanDurationMs: scanDuration,
      };

      try {
        await storage.createClamavScanLog(scanLog);
      } catch (logError) {
        console.error('[ClamAV] Fehler beim Speichern des Scan-Logs:', logError);
      }

      if (!scanResult.isClean) {
        console.warn(`[ClamAV] Upload abgelehnt: ${file.originalname} - ${scanResult.virusName || scanResult.error}`);

        if (scanResult.virusName) {
          this.notifyAdminsOfVirusDetection({
            filename: file.originalname,
            fileSize: file.size,
            virusName: scanResult.virusName,
            uploaderEmail: context?.email,
            requestIp: context?.requestIp,
            scannedAt: new Date(),
          });
        }

        return {
          success: false,
          error: scanResult.error || 'Virus erkannt',
          virusName: scanResult.virusName,
          scannerUnavailable: scanResult.scannerUnavailable,
        };
      }

      console.log(`[ClamAV] Scan erfolgreich: ${file.originalname}`);
    }

    await this.ensureUploadDir();

    const isSvg = isSvgContent;
    const isIco = file.mimetype === 'image/x-icon';
    const isBmp = file.mimetype === 'image/bmp';

    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);

    let finalBuffer: Buffer;
    let finalExt: string;

    if (isSvg || isIco || isBmp) {
      if (isSvg) {
        const svgText = file.buffer.toString('utf8');
        const sanitized = sanitizeSvg(svgText);
        if (sanitized === null) {
          console.warn(`[ImageService] SVG sanitization fehlgeschlagen (Upload abgelehnt): ${file.originalname}`);
          return {
            success: false,
            error: 'SVG-Datei konnte nicht verarbeitet werden',
            invalidFileType: true,
          };
        }
        finalBuffer = Buffer.from(sanitized, 'utf8');
        console.log(`[ImageService] SVG sanitized: ${file.originalname}`);
      } else {
        finalBuffer = file.buffer;
      }
      finalExt = path.extname(file.originalname) || (isSvg ? '.svg' : isIco ? '.ico' : '.bmp');
    } else {
      const reencoded = await reencodeImage(file.buffer);
      if (!reencoded) {
        console.warn(`[ImageService] Re-encoding fehlgeschlagen (kein unterstütztes Format): ${file.originalname}`);
        return {
          success: false,
          error: 'Nur Bilddateien sind erlaubt',
          invalidFileType: true,
        };
      }
      finalBuffer = reencoded.buffer;
      finalExt = reencoded.ext;
      console.log(`[ImageService] Re-encoding erfolgreich: ${file.originalname} → ${finalExt} (${reencoded.buffer.length} bytes)`);
    }

    const filename = `poll-image-${uniqueSuffix}${finalExt}`;
    const filePath = path.join(this.uploadDir, filename);

    try {
      await fs.writeFile(filePath, finalBuffer);

      return {
        success: true,
        imageUrl: this.getImageUrl(filename),
      };
    } catch (error) {
      console.error('Fehler beim Speichern der Datei:', error);
      return {
        success: false,
        error: 'Datei konnte nicht gespeichert werden',
      };
    }
  }

  async deleteImage(imageUrl: string): Promise<void> {
    try {
      const filename = path.basename(imageUrl);
      const filePath = path.join(this.uploadDir, filename);
      await fs.unlink(filePath);
    } catch (error) {
      console.error('Failed to delete image:', error);
    }
  }

  async deletePollImages(pollId: string): Promise<void> {
    try {
      const files = await fs.readdir(this.uploadDir);
      const pollImageFiles = files.filter(file => file.includes(pollId));

      await Promise.all(
        pollImageFiles.map(file =>
          fs.unlink(path.join(this.uploadDir, file)).catch(console.error)
        )
      );
    } catch (error) {
      console.error('Failed to delete poll images:', error);
    }
  }

  getImageUrl(filename: string): string {
    return `/uploads/${filename}`;
  }

  private async notifyAdminsOfVirusDetection(details: {
    filename: string;
    fileSize: number;
    virusName: string;
    uploaderEmail?: string | null;
    requestIp?: string | null;
    scannedAt: Date;
  }): Promise<void> {
    try {
      const admins = await storage.getAdminUsers();
      const adminEmails = admins
        .filter(admin => admin.email)
        .map(admin => admin.email!);

      if (adminEmails.length === 0) {
        console.log('[ClamAV] No admin emails found for virus notification');
        return;
      }

      emailService.sendVirusDetectionAlert(adminEmails, details).catch(err => {
        console.error('[ClamAV] Failed to send virus detection email:', err);
      });

      console.log(`[ClamAV] Virus alert queued for ${adminEmails.length} admin(s)`);
    } catch (error) {
      console.error('[ClamAV] Error preparing virus notification:', error);
    }
  }
}

export const imageService = new ImageService();
