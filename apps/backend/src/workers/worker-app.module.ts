import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { ScheduleModule } from '@nestjs/schedule';

import { validateEnvConfig } from '../config/env.validation';
import { configuration } from '../config/configuration';
import { AppConfigModule } from '../config/app-config.module';
import { LoggerModule } from '../common/logger/logger.module';
import { PrismaModule } from '../prisma/prisma.module';
import { CryptoModule } from '../common/crypto/crypto.module';
import { PaginationModule } from '../common/pagination/pagination.module';
import { FacebookModule } from '../modules/facebook/facebook.module';
import { AiModule } from '../modules/ai/ai.module';
import { AuditModule } from '../modules/audit/audit.module';
import { CampaignExecutionModule } from './campaign-execution.module';

/**
 * Contexto Nest del proceso Worker (dist/worker.js).
 * No abre HTTP ni Swagger; ejecuta el poller y el scheduler sobre
 * PostgreSQL (claims atómicos, sin cola externa).
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
    FacebookModule,
    AiModule,
    AuditModule,
    CampaignExecutionModule,
  ],
})
export class WorkerAppModule {}