import { Injectable, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Interval } from '@nestjs/schedule';

import { AppLogger } from '../../common/logger/app-logger.service';
import { PrismaService } from '../../prisma/prisma.service';

/**
 * Retención de auditoría.
 *
 * Evita que AuditLog (y la actividad íntegra) crezca sin límite: una vez al
 * día elimina los registros anteriores a AUDIT_RETENTION_DAYS (por defecto 90).
 * El borrado es idempotente y con corte temporal, por lo que es seguro
 * ejecutarlo desde varios procesos a la vez.
 */
@Injectable()
export class AuditCleanupService implements OnModuleInit {
  private static readonly INTERVAL_MS = 86_400_000; // 24h
  private static readonly DEFAULT_RETENTION_DAYS = 90;

  private readonly retentionDays: number;
  private running = false;

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly logger: AppLogger,
  ) {
    const configured = this.config.get<string>('AUDIT_RETENTION_DAYS');
    const days = configured === undefined || configured === '' ? NaN : Number(configured);
    this.retentionDays =
      Number.isFinite(days) && days > 0 ? Math.trunc(days) : AuditCleanupService.DEFAULT_RETENTION_DAYS;
  }

  /** Purga una vez al arrancar y luego cada 24h. */
  onModuleInit(): void {
    void this.tick();
  }

  @Interval('audit-cleanup', AuditCleanupService.INTERVAL_MS)
  private async tick(): Promise<void> {
    if (this.running) return;
    this.running = true;
    try {
      await this.purge();
    } catch (err) {
      this.logger.error(
        `Purgado de auditoría falló: ${err instanceof Error ? err.message : String(err)}`,
        undefined,
        'AuditCleanup',
      );
    } finally {
      this.running = false;
    }
  }

  private async purge(): Promise<void> {
    const cutoff = new Date(Date.now() - this.retentionDays * 86_400_000);
    const { count } = await this.prisma.auditLog.deleteMany({
      where: { createdAt: { lt: cutoff } },
    });
    if (count > 0) {
      this.logger.log(
        `Auditoría purgada: ${count} registros anteriores a ${this.retentionDays} días`,
        'AuditCleanup',
      );
    }
  }
}