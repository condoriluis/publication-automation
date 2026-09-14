import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { Logger } from '@nestjs/common';

import { WorkerAppModule } from './workers/worker-app.module';
import { CampaignWorkerService } from './workers/campaign-worker.service';

/**
 * Proceso Worker: consume la cola de campañas sobre PostgreSQL.
 * Se ejecuta con `npm run worker` (desarrollo) o `node dist/worker.js` (prod).
 * No publica HTTP: el poller (CampaignWorkerService) avanza los grupos
 * reclamados y el scheduler cierra campañas vencidas.
 */
async function bootstrap(): Promise<void> {
  const logger = new Logger('CampaignWorker');
  const app = await NestFactory.createApplicationContext(WorkerAppModule, {
    bufferLogs: true,
    logger: ['log', 'warn', 'error'],
  });
  await app.init();

  const worker = app.get(CampaignWorkerService);
  logger.log('Worker activo: poller de grupos cada 5s (claims atómicos en PostgreSQL)');
  void worker;

  const shutdown = (signal: NodeJS.Signals) => {
    logger.warn(`Recibido ${signal}, cerrando worker...`, 'CampaignWorker');
    void (async () => {
      await app.close();
      process.exit(0);
    })();
  };
  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);
}

void bootstrap();