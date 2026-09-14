type WorkerLogLevel = 'debug' | 'info' | 'warn' | 'error';

const LEVEL_ORDER: Record<WorkerLogLevel, number> = { debug: 10, info: 20, warn: 30, error: 40 };

/**
 * Logger mínimo para procesos que corren FUERA del contenedor DI de Nest
 * (ej. `src/workers/campaign.worker.ts`). Usa console con marca de tiempo
 * ISO y nivel. Compatible por forma con `AppLogger` (ver `LoggerLike`).
 */
export class WorkerLogger {
  private readonly minLevel: WorkerLogLevel;

  constructor(
    private readonly context = 'worker',
    minLevel?: WorkerLogLevel,
  ) {
    const env = process.env.LOG_LEVEL as WorkerLogLevel | undefined;
    this.minLevel = minLevel ?? (env && env in LEVEL_ORDER ? env : 'info');
  }

  private enabled(level: WorkerLogLevel): boolean {
    return LEVEL_ORDER[level] >= LEVEL_ORDER[this.minLevel];
  }

  private write(level: WorkerLogLevel, message: string, trace?: string): void {
    if (!this.enabled(level)) return;
    const stamp = new Date().toISOString();
    const pad = level.toUpperCase().padEnd(5);
    const line = `${stamp} ${pad} [${this.context}] ${message}`;
    if (level === 'error') console.error(line, trace ?? '');
    else if (level === 'warn') console.warn(line);
    else console.log(line);
  }

  debug(message: string, trace?: string): void {
    this.write('debug', message, trace);
  }
  info(message: string, trace?: string): void {
    this.write('info', message, trace);
  }
  warn(message: string, trace?: string): void {
    this.write('warn', message, trace);
  }
  error(message: string, trace?: string): void {
    this.write('error', message, trace);
  }
}

/** Forma mínima compartida por AppLogger y WorkerLogger. */
export interface LoggerLike {
  debug(message: string, trace?: string): void;
  info(message: string, trace?: string): void;
  warn(message: string, trace?: string): void;
  error(message: string, trace?: string): void;
}

export const createWorkerLogger = (context: string): WorkerLogger => new WorkerLogger(context);