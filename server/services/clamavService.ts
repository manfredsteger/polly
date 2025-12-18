import net from 'net';
import { storage } from '../storage';

export interface ClamAVConfig {
  enabled: boolean;
  host: string;
  port: number;
  timeout: number; // milliseconds
  maxFileSize: number; // bytes
}

export interface ScanResult {
  isClean: boolean;
  virusName?: string;
  error?: string;
}

const DEFAULT_CONFIG: ClamAVConfig = {
  enabled: false,
  host: 'localhost',
  port: 3310,
  timeout: 30000,
  maxFileSize: 25 * 1024 * 1024, // 25MB
};

export class ClamAVService {
  private configCache: ClamAVConfig | null = null;
  private configCacheTime: number = 0;
  private readonly CONFIG_CACHE_TTL = 60000; // 1 minute

  async getConfig(): Promise<ClamAVConfig> {
    const now = Date.now();
    if (this.configCache && (now - this.configCacheTime) < this.CONFIG_CACHE_TTL) {
      return this.configCache;
    }

    try {
      const setting = await storage.getSetting('clamav_config');
      if (setting?.value) {
        this.configCache = { ...DEFAULT_CONFIG, ...setting.value as Partial<ClamAVConfig> };
      } else {
        this.configCache = DEFAULT_CONFIG;
      }
      this.configCacheTime = now;
      return this.configCache;
    } catch (error) {
      console.error('Failed to load ClamAV config:', error);
      return DEFAULT_CONFIG;
    }
  }

  clearConfigCache(): void {
    this.configCache = null;
    this.configCacheTime = 0;
  }

  async testConnection(): Promise<{ success: boolean; message: string; responseTime?: number }> {
    const config = await this.getConfig();
    
    if (!config.enabled) {
      return { success: false, message: 'ClamAV ist deaktiviert' };
    }

    const startTime = Date.now();

    return new Promise((resolve) => {
      const client = new net.Socket();
      let resolved = false;

      const cleanup = () => {
        if (!resolved) {
          resolved = true;
          client.destroy();
        }
      };

      client.setTimeout(config.timeout);

      client.on('connect', () => {
        client.write('zPING\0');
      });

      client.on('data', (data) => {
        const response = data.toString().trim();
        cleanup();
        if (response === 'PONG') {
          resolve({
            success: true,
            message: 'Verbindung zu ClamAV erfolgreich',
            responseTime: Date.now() - startTime,
          });
        } else {
          resolve({
            success: false,
            message: `Unerwartete Antwort: ${response}`,
          });
        }
      });

      client.on('error', (error) => {
        cleanup();
        resolve({
          success: false,
          message: `Verbindungsfehler: ${error.message}`,
        });
      });

      client.on('timeout', () => {
        cleanup();
        resolve({
          success: false,
          message: 'Zeitüberschreitung bei der Verbindung',
        });
      });

      client.connect(config.port, config.host);
    });
  }

  async scanBuffer(buffer: Buffer, filename?: string): Promise<ScanResult> {
    const config = await this.getConfig();

    if (!config.enabled) {
      return { isClean: true };
    }

    if (buffer.length > config.maxFileSize) {
      return {
        isClean: false,
        error: `Datei überschreitet maximale Größe von ${Math.round(config.maxFileSize / 1024 / 1024)}MB`,
      };
    }

    return new Promise((resolve) => {
      const client = new net.Socket();
      let resolved = false;
      let responseData = '';

      const cleanup = () => {
        if (!resolved) {
          resolved = true;
          client.destroy();
        }
      };

      client.setTimeout(config.timeout);

      client.on('connect', () => {
        client.write('zINSTREAM\0');
        
        const chunkSize = 2048;
        let offset = 0;
        
        while (offset < buffer.length) {
          const chunk = buffer.subarray(offset, Math.min(offset + chunkSize, buffer.length));
          const sizeBuffer = Buffer.alloc(4);
          sizeBuffer.writeUInt32BE(chunk.length, 0);
          client.write(sizeBuffer);
          client.write(chunk);
          offset += chunkSize;
        }
        
        const endBuffer = Buffer.alloc(4);
        endBuffer.writeUInt32BE(0, 0);
        client.write(endBuffer);
      });

      client.on('data', (data) => {
        responseData += data.toString();
      });

      client.on('end', () => {
        cleanup();
        const response = responseData.trim();
        
        if (response.includes('OK')) {
          resolve({ isClean: true });
        } else if (response.includes('FOUND')) {
          const match = response.match(/stream: (.+) FOUND/);
          const virusName = match ? match[1] : 'Unbekannter Virus';
          console.warn(`ClamAV: Virus gefunden in ${filename || 'Datei'}: ${virusName}`);
          resolve({
            isClean: false,
            virusName,
          });
        } else if (response.includes('ERROR')) {
          console.error(`ClamAV Scan-Fehler: ${response}`);
          resolve({
            isClean: false,
            error: `Scan-Fehler: ${response}`,
          });
        } else {
          resolve({
            isClean: false,
            error: `Unbekannte Antwort: ${response}`,
          });
        }
      });

      client.on('error', (error) => {
        cleanup();
        console.error(`ClamAV Verbindungsfehler: ${error.message}`);
        resolve({
          isClean: false,
          error: `Verbindungsfehler: ${error.message}`,
        });
      });

      client.on('timeout', () => {
        cleanup();
        resolve({
          isClean: false,
          error: 'Zeitüberschreitung beim Scan',
        });
      });

      client.connect(config.port, config.host);
    });
  }

  async isEnabled(): Promise<boolean> {
    const config = await this.getConfig();
    return config.enabled;
  }
}

export const clamavService = new ClamAVService();
