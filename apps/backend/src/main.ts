import 'reflect-metadata';
import { HttpStatus, ValidationPipe, VersioningType } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import helmet from 'helmet';
import { json, urlencoded } from 'express';

import { AppModule } from './app.module';
import { AppConfigService } from './config/app-config.service';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';
import { RequestIdInterceptor } from './common/interceptors/request-id.interceptor';
import { AppLogger } from './common/logger/app-logger.service';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    bufferLogs: true,
    // rawBody permite verificar la firma HMAC del webhook de Meta sobre los
    // bytes EXACTOS recibidos (x-hub-signature-256), no sobre una re-serialización.
    rawBody: true,
  });

  const config = app.get(ConfigService);
  const appConfig = app.get(AppConfigService);
  const logger = app.get(AppLogger);
  app.useLogger(logger);

  // ---- Seguridad de cabeceras HTTP ----
  app.use(
    helmet({
      contentSecurityPolicy: appConfig.isProd ? undefined : false,
      crossOriginEmbedderPolicy: false,
    }),
  );

  // ---- CORS estricto (nunca *) ----
  app.enableCors({
    origin(origin, cb) {
      const allowed = appConfig.corsOrigins;
      if (!origin || allowed.includes(origin)) cb(null, true);
      else cb(new Error(`CORS: origen no permitido: ${origin}`));
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Request-Id', 'Idempotency-Key'],
    exposedHeaders: ['X-Request-Id', 'X-RateLimit-Remaining'],
    maxAge: 86_400,
  });

  // ---- Límites de payload (protección DoS a nivel de body) ----
  app.use(json({ limit: '20mb' }));
  app.use(urlencoded({ extended: true, limit: '20mb' }));

  // ---- Validación global estricta (class-validator) ----
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );

  app.useGlobalFilters(new AllExceptionsFilter(logger, config));
  app.useGlobalInterceptors(new RequestIdInterceptor());

  // ---- Prefijo global + versionado ----
  app.setGlobalPrefix('api');
  app.enableVersioning({ type: VersioningType.URI, defaultVersion: '1' });

  // ---- Ruta raíz pública (GET/HEAD /) para probes externas (Render, Uptime, LB) ----
  const adapter = app.getHttpAdapter();
  const rootInfo = () => ({
    service: 'publication-automation-api',
    status: 'ok',
    version: '1.0.0',
    endpoints: {
      api: '/api/v1',
      health: '/api/v1/health',
      docs: appConfig.isProd ? undefined : '/api/v1/docs',
    },
    timestamp: new Date().toISOString(),
  });
  adapter.get('/', (_req: unknown, res: any) => res.status(HttpStatus.OK).json(rootInfo()));
  adapter.head('/', (_req: unknown, res: any) => res.status(HttpStatus.OK).send());

  // ---- Swagger solo en no-producción ----
  if (!appConfig.isProd) {
    const doc = new DocumentBuilder()
      .setTitle('Publication Automation API')
      .setDescription('Gestión y automatización de publicaciones e interacciones de páginas de Facebook vía API oficial de Meta.')
      .setVersion('1.0.0')
      .addBearerAuth()
      .build();
    const document = SwaggerModule.createDocument(app, doc);
    SwaggerModule.setup('api/docs', app, document);
  }

  const port = appConfig.port;
  await app.listen(port, '0.0.0.0');
  logger.log(`API en http://localhost:${port}/api/v1`, 'Bootstrap');

  const shutdown = (signal: NodeJS.Signals) => {
    logger.warn(`Recibido ${signal}, cerrando servidor...`, 'Bootstrap');
    void app.close().then(() => process.exit(0));
  };
  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);
}

void bootstrap();
