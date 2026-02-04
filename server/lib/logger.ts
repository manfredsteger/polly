type LogLevel = 'debug' | 'info' | 'warn' | 'error';

interface LogEntry {
  timestamp: string;
  level: LogLevel;
  category: string;
  message: string;
  data?: Record<string, unknown>;
  requestId?: string;
  userId?: number;
  ip?: string;
  duration?: number;
}

class Logger {
  private minLevel: LogLevel;
  private readonly levelPriority: Record<LogLevel, number> = {
    debug: 0,
    info: 1,
    warn: 2,
    error: 3,
  };

  constructor() {
    this.minLevel = (process.env.LOG_LEVEL as LogLevel) || 
      (process.env.NODE_ENV === 'production' ? 'info' : 'debug');
  }

  private shouldLog(level: LogLevel): boolean {
    return this.levelPriority[level] >= this.levelPriority[this.minLevel];
  }

  private formatEntry(entry: LogEntry): string {
    const { timestamp, level, category, message, ...rest } = entry;
    const prefix = `[${timestamp}] [${level.toUpperCase()}] [${category}]`;
    const dataStr = Object.keys(rest).length > 0 ? ` ${JSON.stringify(rest)}` : '';
    return `${prefix} ${message}${dataStr}`;
  }

  private log(level: LogLevel, category: string, message: string, data?: Record<string, unknown>): void {
    if (!this.shouldLog(level)) return;

    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level,
      category,
      message,
      ...data,
    };

    const formatted = this.formatEntry(entry);

    switch (level) {
      case 'debug':
        console.debug(formatted);
        break;
      case 'info':
        console.info(formatted);
        break;
      case 'warn':
        console.warn(formatted);
        break;
      case 'error':
        console.error(formatted);
        break;
    }
  }

  debug(category: string, message: string, data?: Record<string, unknown>): void {
    this.log('debug', category, message, data);
  }

  info(category: string, message: string, data?: Record<string, unknown>): void {
    this.log('info', category, message, data);
  }

  warn(category: string, message: string, data?: Record<string, unknown>): void {
    this.log('warn', category, message, data);
  }

  error(category: string, message: string, data?: Record<string, unknown>): void {
    this.log('error', category, message, data);
  }

  request(method: string, path: string, statusCode: number, durationMs: number, data?: Record<string, unknown>): void {
    const level: LogLevel = statusCode >= 500 ? 'error' : statusCode >= 400 ? 'warn' : 'info';
    this.log(level, 'HTTP', `${method} ${path} ${statusCode} ${durationMs}ms`, data);
  }

  security(event: string, data?: Record<string, unknown>): void {
    this.warn('SECURITY', event, data);
  }

  auth(event: string, data?: Record<string, unknown>): void {
    this.info('AUTH', event, data);
  }

  db(operation: string, data?: Record<string, unknown>): void {
    this.debug('DB', operation, data);
  }
}

export const logger = new Logger();
