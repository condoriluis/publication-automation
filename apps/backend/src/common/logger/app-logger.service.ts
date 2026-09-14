import { Injectable, LogLevel, LoggerService } from '@nestjs/common';

type Level = 'debug' | 'info' | 'warn' | 'error';

const LEVEL_ORDER: Record<Level, number> = { debug: 10, info: 20, warn: 30, error: 40 };

/**
 * Logger estructurado global (reemplaza el default de Nest sin dependencias
 * externas). Formato legible en desarrollo y JSON en producción.
 *
 * Implementa `LoggerService` para `app.useLogger(...)` y, por forma, `LoggerLike`
 * (usado por FacebookService/AiService y los workers).
 */
@Injectable()
export class AppLogger implements LoggerService {
  private readonly minLevel: Level;
  private readonly jsonMode: boolean;

  constructor() {
    const envLevel = process.env.LOG_LEVEL ?? 'info';
    this.minLevel = envLevel in LEVEL_ORDER ? (envLevel as Level) : 'info';
    this.jsonMode = process.env.NODE_ENV === 'production' || process.env.LOG_FORMAT === 'json';
  }

  private enabled(level: Level): boolean {
    return LEVEL_ORDER[level] >= LEVEL_ORDER[this.minLevel];
  }

  private write(level: Level, message: string, context?: string, trace?: string): void {
    if (!this.enabled(level)) return;
    const stamp = new Date().toISOString();
    const ctx = context ?? 'App';
    if (this.jsonMode) {
      const entry = JSON.stringify({
        timestamp: stamp,
        level,
        context: ctx,
        message,
        ...(trace ? { stack: trace } : {}),
      });
      if (level === 'error') console.error(entry);
      else console.log(entry);
      return;
    }
    const line = `${stamp} ${level.toUpperCase().padEnd(5)} [${ctx}] ${message}`;
    if (level === 'error') console.error(line, trace ?? '');
    else if (level === 'warn') console.warn(line);
    else console.log(line);
  }

  // ---- LoggerService (usado por app.useLogger) ----
  log(message: unknown, ...optionalParams: unknown[]): void {
    this.write('info', String(message), this.firstContext(optionalParams));
  }
  error(message: unknown, ...optionalParams: unknown[]): void {
    const [a, b] = optionalParams;
    const trace = typeof a === 'string' && a.includes('\n') ? a : undefined;
    const context = (trace ? b : a) as string | undefined;
    this.write('error', String(message), context, trace);
  }
  warn(message: unknown, ...optionalParams: unknown[]): void {
    this.write('warn', String(message), this.firstContext(optionalParams));
  }
  debug(message: unknown, ...optionalParams: unknown[]): void {
    this.write('debug', String(message), this.firstContext(optionalParams));
  }
  verbose(message: unknown, ...optionalParams: unknown[]): void {
    this.write('debug', String(message), this.firstContext(optionalParams));
  }
  fatal(message: unknown, ...optionalParams: unknown[]): void {
    this.write('error', `FATAL: ${String(message)}`, this.firstContext(optionalParams));
  }
  setLogLevels?(levels: LogLevel[]): void {
    void levels; // el nivel ya se controla vía LOG_LEVEL
  }

  // ---- LoggerLike (workers / servicios) ----
  info(message: string, context?: string): void {
    this.write('info', message, context);
  }

  private firstContext(params: unknown[]): string | undefined {
    const first = params[0];
    return typeof first === 'string' ? first : undefined;
  }
}