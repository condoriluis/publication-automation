import { Module } from '@nestjs/common';
import { AiModule } from '../modules/ai/ai.module';
import { AuditModule } from '../modules/audit/audit.module';
import { FacebookModule } from '../modules/facebook/facebook.module';
import { CampaignExecutorService } from './campaign-executor.service';
import { CampaignSchedulerService } from './campaign-scheduler.service';
import { CampaignWorkerService } from './campaign-worker.service';
import { ScheduledPostPublisherService } from './scheduled-post-publisher.service';

/**
 * Módulo de ejecución de campañas sin cola externa.
 *
 * Proporciona:
 *  - Executor: primitivas atómicas compartidas (publicar post, responder comentario).
 *  - Scheduler: activación de campañas SCHEDULED y cierre por endsAt.
 *  - Worker: poller que reclama grupos "debidos" y avanza su ejecución.
 *  - ScheduledPostPublisher: publica solo los posts sueltos programados.
 *
 * Se importa tanto en el proceso API como en el Worker/Scheduler, de modo que
 * todos los procesos compiten por claims atómicos en PostgreSQL (Render free
 * puede correr todo en un solo proceso).
 */
@Module({
  imports: [FacebookModule, AiModule, AuditModule],
  providers: [
    CampaignExecutorService,
    CampaignSchedulerService,
    CampaignWorkerService,
    ScheduledPostPublisherService,
  ],
  exports: [CampaignExecutorService, CampaignSchedulerService, CampaignWorkerService],
})
export class CampaignExecutionModule {}