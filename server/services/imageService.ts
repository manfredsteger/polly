import multer from 'multer';
import path from 'path';
import fs from 'fs/promises';
import { clamavService } from './clamavService';

export interface UploadResult {
  success: boolean;
  imageUrl?: string;
  error?: string;
  virusName?: string;
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

  async processUpload(file: Express.Multer.File): Promise<UploadResult> {
    const clamavEnabled = await clamavService.isEnabled();
    
    if (clamavEnabled) {
      console.log(`[ClamAV] Scanne Upload: ${file.originalname} (${file.size} bytes)`);
      
      const scanResult = await clamavService.scanBuffer(file.buffer, file.originalname);
      
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
