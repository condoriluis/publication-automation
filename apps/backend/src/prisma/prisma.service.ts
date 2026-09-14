import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { AppLogger } from '../common/logger/app-logger.service';

/**
 * Cliente Prisma de un solo tono, registrado globalmente.
 * Conecta en onModuleInit, libera en onModuleDestroy.
 */
@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  constructor(private readonly logger: AppLogger) {
    super({
      errorFormat: 'minimal',
      log:
        process.env.NODE_ENV === 'development' && process.env.PRISMA_LOG === 'true'
          ? [{ emit: 'event', level: 'query' }, { emit: 'event', level: 'info' }, { emit: 'event', level: 'warn' }]
          : [{ emit: 'event', level: 'warn' }, { emit: 'event', level: 'error' }],
    });

    (this as never as { $on?: (level: 'query', e: (payload: { query: string; params: string; duration: number }) => void) => void }).$on?.('query', (e: { query: string; params: string; duration: number }) => {
      this.logger.debug(`Prisma [${e.duration}ms] ${e.query} {${e.params}}`, 'Prisma');
    });
    (this as never as { $on?: (level: 'error', e: (payload: { message: string }) => void) => void }).$on?.('error', (e: { message: string }) => {
      this.logger.error(e.message, undefined, 'Prisma');
    });
  }

  async onModuleInit(): Promise<void> {
    await this.$connect();
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
  }
}
