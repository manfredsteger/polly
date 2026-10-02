import net from 'net';
import { storage } from '../storage';

export interface ClamAVConfig {
  enabled: boolean;
  host: string;
  port: number;
  timeout: number; // milliseconds
  maxFileSize: number; // bytes
  configurationUnavailable?: boolean;
}

export interface ScanResult {
  isClean: boolean;
  virusName?: string;
  error?: string;
  scannerUnavailable?: boolean;
}

const DEFAULT_CONFIG: ClamAVConfig = {
  enabled: false,
  host: 'localhost',
  port: 3310,
  timeout: 30000,
  maxFileSize: 25 * 1024 * 1024, // 25MB
};

function getEnvironmentOverrides(): Partial<ClamAVConfig> {
  const overrides: Partial<ClamAVConfig> = {};
  const enabled = process.env.CLAMAV_ENABLED?.trim().toLowerCase();
  const host = process.env.CLAMAV_HOST?.trim();
  const port = process.env.CLAMAV_PORT?.trim();

  if (enabled === 'true') overrides.enabled = true;
  else if (enabled === 'false') overrides.enabled = false;
  else if (enabled) {
    console.warn('[ClamAV] Ignoring invalid CLAMAV_ENABLED value; use true or false');
  }

  if (host) overrides.host = host;

  if (port) {
    const parsedPort = Number(port);
    if (/^\d+$/.test(port) && Number.isInteger(parsedPort) && parsedPort > 0 && parsedPort <= 65535) {
      overrides.port = parsedPort;
    } else {
      console.warn('[ClamAV] Ignoring invalid CLAMAV_PORT value');
    }
  }

  return overrides;
}

export class ClamAVService {
  private configCache: ClamAVConfig | null = null;
  private configCacheTime: number = 0;
  private readonly CONFIG_CACHE_TTL = 60000; // 1 minute
  private envInitialized = false;

  async initFromEnv(): Promise<void> {
    if (this.envInitialized) return;
    this.envInitialized = true;

    const environmentOverrides = getEnvironmentOverrides();
    if (Object.keys(environmentOverrides).length === 0) {
      return;
    }

    try {
      const existingSetting = await storage.getSetting('clamav_config');
      
      if (!existingSetting?.value) {
        const envConfig: ClamAVConfig = {
          ...DEFAULT_CONFIG,
          ...environmentOverrides,
        };

        await storage.setSetting({ key: 'clamav_config', value: envConfig });
        console.log(`[ClamAV] Initialized from environment: enabled=${envConfig.enabled}, host=${envConfig.host}:${envConfig.port}`);
        this.clearConfigCache();
      } else {
        console.log('[ClamAV] Runtime environment overrides persisted scanner configuration');
      }
    } catch (error) {
      console.error('[ClamAV] Failed to initialize from environment:', error);
    }
  }

  async getConfig(): Promise<ClamAVConfig> {
    const now = Date.now();
    if (this.configCache && (now - this.configCacheTime) < this.CONFIG_CACHE_TTL) {
      return this.configCache;
    }

    try {
      const setting = await storage.getSetting('clamav_config');
      const environmentOverrides = getEnvironmentOverrides();
      if (setting?.value) {
        this.configCache = {
          ...DEFAULT_CONFIG,
          ...setting.value as Partial<ClamAVConfig>,
          ...environmentOverrides,
        };
      } else {
        this.configCache = { ...DEFAULT_CONFIG, ...environmentOverrides };
      }
      this.configCacheTime = now;
      return this.configCache;
    } catch (error) {
      console.error('Failed to load ClamAV config:', error);
      const environmentOverrides = getEnvironmentOverrides();

      // A last-known configuration is safer and more useful than silently
      // falling back to the disabled default when a transient DB read fails.
      if (this.configCache) {
        return { ...this.configCache, ...environmentOverrides };
      }

      // An explicit runtime choice is authoritative. Without one, the
      // scanner state is unknown, so uploads must fail closed rather than
      // assuming that an Admin-managed scanner was disabled.
      if (environmentOverrides.enabled === false) {
        return { ...DEFAULT_CONFIG, ...environmentOverrides };
      }
      if (environmentOverrides.enabled === true) {
        return { ...DEFAULT_CONFIG, ...environmentOverrides };
      }
      return {
        ...DEFAULT_CONFIG,
        enabled: true,
        configurationUnavailable: true,
      };
    }
  }

  clearConfigCache(): void {
    this.configCache = null;
    this.configCacheTime = 0;
  }

  async testConnection(): Promise<{ success: boolean; message: string; responseTime?: number; unavailable?: boolean }> {
    const config = await this.getConfig();
    
    if (!config.enabled) {
      return { success: false, message: 'ClamAV is disabled' };
    }

    return this.testConnectionWithConfig(config.host, config.port, config.timeout);
  }

  async testConnectionWithConfig(host: string, port: number, timeout: number): Promise<{ success: boolean; message: string; responseTime?: number; unavailable?: boolean }> {
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

      client.setTimeout(timeout);

      client.on('connect', () => {
        client.write('zPING\0');
      });

      client.on('data', (data) => {
        const response = data.toString().replace(/\0/g, '').trim();
        cleanup();
        if (response === 'PONG') {
          resolve({
            success: true,
            message: 'Connection to ClamAV successful',
            responseTime: Date.now() - startTime,
          });
        } else {
          resolve({
            success: false,
            message: `Unexpected response: ${response}`,
          });
        }
      });

      client.on('error', (error: NodeJS.ErrnoException) => {
        cleanup();
        const isUnavailable = error.code === 'ECONNREFUSED' || error.code === 'ENOTFOUND' || error.code === 'EHOSTUNREACH';
        resolve({
          success: false,
          message: `Connection error: ${error.message}`,
          unavailable: isUnavailable,
        });
      });

      client.on('timeout', () => {
        cleanup();
        resolve({
          success: false,
          message: 'Connection timeout',
          unavailable: true,
        });
      });

      client.connect(port, host);
    });
  }

  async scanBuffer(buffer: Buffer, filename?: string): Promise<ScanResult> {
    const config = await this.getConfig();

    if (config.configurationUnavailable) {
      console.error('[ClamAV] SECURITY: Scanner configuration unavailable - Upload BLOCKIERT (fail-secure)');
      return {
        isClean: false,
        scannerUnavailable: true,
        error: 'Virenscanner-Konfiguration nicht verfügbar. Upload wurde aus Sicherheitsgründen blockiert.',
      };
    }

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
            scannerUnavailable: true,
            error: 'Virenscanner-Fehler. Upload wurde aus Sicherheitsgründen blockiert.',
          });
        } else {
          console.error(`ClamAV Scan-Fehler: Unerwartete Antwort: ${response || '(leer)'}`);
          resolve({
            isClean: false,
            scannerUnavailable: true,
            error: 'Virenscanner-Fehler. Upload wurde aus Sicherheitsgründen blockiert.',
          });
        }
      });

      client.on('error', (error: NodeJS.ErrnoException) => {
        cleanup();
        if (error.code === 'ECONNREFUSED' || error.code === 'ENOTFOUND' || error.code === 'EHOSTUNREACH') {
          console.error(`[ClamAV] SECURITY: Scanner nicht erreichbar (${config.host}:${config.port}) - Upload BLOCKIERT (fail-secure)`);
          resolve({
            isClean: false,
            scannerUnavailable: true,
            error: `Virenscanner nicht erreichbar (${config.host}:${config.port}). Upload aus Sicherheitsgründen blockiert. Bitte ClamAV-Daemon starten oder Scanner deaktivieren.`,
          });
        } else {
          console.error(`[ClamAV] SECURITY: Scanner communication error (${error.code || 'unknown'}) - Upload BLOCKIERT (fail-secure)`);
          resolve({
            isClean: false,
            scannerUnavailable: true,
            error: 'Virenscanner nicht erreichbar. Upload wurde aus Sicherheitsgründen blockiert.',
          });
        }
      });

      client.on('timeout', () => {
        cleanup();
        console.error(`[ClamAV] SECURITY: Scanner Timeout (${config.host}:${config.port}) - Upload BLOCKIERT (fail-secure)`);
        resolve({
          isClean: false,
          scannerUnavailable: true,
          error: `Virenscanner-Timeout (${config.host}:${config.port}). Upload aus Sicherheitsgründen blockiert. Bitte ClamAV-Daemon prüfen oder Scanner deaktivieren.`,
        });
      });

      client.connect(config.port, config.host);
    });
  }

  async isEnabled(): Promise<boolean> {
    const config = await this.getConfig();
    return config.enabled;
  }

  async getScanLogs(options: {
    limit?: number;
    offset?: number;
    status?: 'clean' | 'infected' | 'error';
    startDate?: Date;
    endDate?: Date;
  } = {}): Promise<{ logs: any[]; total: number }> {
    try {
      return await storage.getClamavScanLogs(options);
    } catch (error) {
      console.error('[ClamAV] Fehler beim Laden der Scan-Logs:', error);
      return { logs: [], total: 0 };
    }
  }

  async getScanLog(id: number): Promise<any | null> {
    try {
      return await storage.getClamavScanLog(id) || null;
    } catch (error) {
      console.error('[ClamAV] Fehler beim Laden des Scan-Logs:', error);
      return null;
    }
  }

  async getScanStats(): Promise<{
    totalScans: number;
    cleanScans: number;
    infectedScans: number;
    errorScans: number;
    lastScanAt: Date | null;
  }> {
    try {
      return await storage.getClamavScanStats();
    } catch (error) {
      console.error('[ClamAV] Fehler beim Laden der Scan-Statistiken:', error);
      return {
        totalScans: 0,
        cleanScans: 0,
        infectedScans: 0,
        errorScans: 0,
        lastScanAt: null,
      };
    }
  }
}

export const clamavService = new ClamAVService();
