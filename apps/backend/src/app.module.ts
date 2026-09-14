import 'reflect-metadata';
import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { ScheduleModule } from '@nestjs/schedule';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';

import { validateEnvConfig } from './config/env.validation';
import { configuration } from './config/configuration';
import { AppConfigModule } from './config/app-config.module';

import { LoggerModule } from './common/logger/logger.module';
import { PrismaModule } from './prisma/prisma.module';
import { CryptoModule } from './common/crypto/crypto.module';
import { PaginationModule } from './common/pagination/pagination.module';

import { HealthModule } from './modules/health/health.module';
import { AuthModule } from './modules/auth/auth.module';
import { UsersModule } from './modules/users/users.module';
import { PagesModule } from './modules/pages/pages.module';
import { FacebookModule } from './modules/facebook/facebook.module';
import { CampaignsModule } from './modules/campaigns/campaigns.module';
import { PostsModule } from './modules/posts/posts.module';
import { CommentsModule } from './modules/comments/comments.module';
import { AiModule } from './modules/ai/ai.module';
import { DashboardModule } from './modules/dashboard/dashboard.module';
import { AuditModule } from './modules/audit/audit.module';
import { WebhooksModule } from './modules/webhooks/webhooks.module';
import { CampaignExecutionModule } from './workers/campaign-execution.module';

@Module({
  imports: [
    // Config global, validada estrictamente en el arranque
    ConfigModule.forRoot({
      isGlobal: true,
      cache: true,
      expandVariables: true,
      load: [configuration],
      validate: validateEnvConfig,
      validationOptions: { abortEarly: false, allowUnknown: true },
    }),
    ThrottlerModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        throttlers: [
          {
            ttl: config.get<number>('THROTTLE_TTL_MS') ?? 60_000,
            limit: config.get<number>('THROTTLE_LIMIT') ?? 200,
          },
        ],
      }),
    }),
    ScheduleModule.forRoot(),

    LoggerModule,
    PrismaModule,
    CryptoModule,
    PaginationModule,
    AppConfigModule,

    HealthModule,
    AuthModule,
    UsersModule,
    FacebookModule,
    PagesModule,
    CampaignsModule,
    PostsModule,
    CommentsModule,
    AiModule,
    DashboardModule,
    AuditModule,
    WebhooksModule,

    // Ejecución de campañas sin cola externa: scheduler + worker por claims.
    CampaignExecutionModule,
  ],
  providers: [
    { provide: APP_GUARD, useClass: ThrottlerGuard },
  ],
})
export class AppModule {}