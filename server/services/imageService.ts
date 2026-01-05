import multer from 'multer';
import path from 'path';
import fs from 'fs/promises';
import { clamavService } from './clamavService';
import { storage } from '../storage';
import type { InsertClamavScanLog } from '@shared/schema';

export interface UploadResult {
  success: boolean;
  imageUrl?: string;
  error?: string;
  virusName?: string;
}

export interface ScanContext {
  userId?: number;
  email?: string;
  requestIp?: string;
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

  getUploadMiddleware() {
    return multer({
      storage: multer.memoryStorage(),
      limits: {
        fileSize: 5 * 1024 * 1024, // 5MB limit
      },
      fileFilter: (req, file, cb) => {
        if (file.mimetype.startsWith('image/')) {
          cb(null, true);
        } else {
          cb(new Error('Nur Bilddateien sind erlaubt'));
        }
      }
    });
  }

  async processUpload(file: Express.Multer.File, context?: ScanContext): Promise<UploadResult> {
    const clamavEnabled = await clamavService.isEnabled();
    const scanStartTime = Date.now();
    
    if (clamavEnabled) {
      console.log(`[ClamAV] Scanne Upload: ${file.originalname} (${file.size} bytes)`);
      
      const scanResult = await clamavService.scanBuffer(file.buffer, file.originalname);
      const scanDuration = Date.now() - scanStartTime;
      
      // Log the scan to database
      const scanLog: InsertClamavScanLog = {
        filename: file.originalname,
        fileSize: file.size,
        mimeType: file.mimetype,
        scanStatus: scanResult.isClean ? 'clean' : (scanResult.virusName ? 'infected' : 'error'),
        virusName: scanResult.virusName || null,
        errorMessage: scanResult.error || null,
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
        return {
          success: false,
          error: scanResult.error || 'Virus erkannt',
          virusName: scanResult.virusName,
        };
      }
      
      console.log(`[ClamAV] Scan erfolgreich: ${file.originalname}`);
    }

    await this.ensureUploadDir();
    
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const ext = path.extname(file.originalname);
    const filename = `poll-image-${uniqueSuffix}${ext}`;
    const filePath = path.join(this.uploadDir, filename);

    try {
      await fs.writeFile(filePath, file.buffer);
      
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
}

export const imageService = new ImageService();
