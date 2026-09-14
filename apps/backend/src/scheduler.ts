import 'reflect-metadata';
import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { ScheduleModule } from '@nestjs/schedule';
import { NestFactory } from '@nestjs/core';
import { Logger } from '@nestjs/common';

import { validateEnvConfig } from './config/env.validation';
import { configuration } from './config/configuration';
import { AppConfigModule } from './config/app-config.module';
import { LoggerModule } from './common/logger/logger.module';
import { PrismaModule } from './prisma/prisma.module';
import { CryptoModule } from './common/crypto/crypto.module';
import { PaginationModule } from './common/pagination/pagination.module';
import { CampaignExecutionModule } from './workers/campaign-execution.module';
import { CampaignSchedulerService } from './workers/campaign-scheduler.service';

/**
 * Contexto Nest del proceso Scheduler (dist/scheduler.js).
 * Activa campañas SCHEDULED, cierra campañas por endsAt, libera leases
 * vencidos y, gracias a CampaignExecutionModule, también trota el worker
 * poller (ambos son idempotentes vía claims atómicos en PostgreSQL).
 */
@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      cache: true,
      expandVariables: true,
      load: [configuration],
      validate: validateEnvConfig,
    }),
    ScheduleModule.forRoot(),
    // JwtService global (el AuditModule que usa CampaignExecutionModule expone
    // un controlador HTTP protegido con JwtAuthGuard).
    JwtModule.registerAsync({
      global: true,
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.get<string>('JWT_SECRET', { infer: true }),
      }),
    }),
    LoggerModule,
    PrismaModule,
    CryptoModule,
    PaginationModule,
    AppConfigModule,
    CampaignExecutionModule,
  ],
})
export class SchedulerAppModule {}

/**
 * El scheduler no expone HTTP: crea un contexto de aplicación Nest y deja
 * corriendo los intervalos de @nestjs/schedule.
 */
async function bootstrap(): Promise<void> {
  const logger = new Logger('Scheduler');
  const app = await NestFactory.createApplicationContext(SchedulerAppModule, {
    bufferLogs: true,
    logger: ['log', 'warn', 'error'],
  });
  await app.init();
  logger.log(`Scheduler activo (intervalo ${CampaignSchedulerService.INTERVAL_MS / 1000}s)`);

  const shutdown = (signal: NodeJS.Signals) => {
    logger.warn(`Recibido ${signal}, cerrando scheduler...`);
    void (async () => {
      await app.close();
      process.exit(0);
    })();
  };
  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);
}

void bootstrap();