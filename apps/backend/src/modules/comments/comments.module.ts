import { Module } from '@nestjs/common';

import { PaginationModule } from '../../common/pagination/pagination.module';
import { FacebookModule } from '../facebook/facebook.module';
import { AiModule } from '../ai/ai.module';
import { AuditModule } from '../audit/audit.module';
import { CampaignExecutionModule } from '../../workers/campaign-execution.module';
import { CommentsController } from './comments.controller';
import { CommentsService } from './comments.service';

@Module({
  imports: [PaginationModule, CampaignExecutionModule, FacebookModule, AiModule, AuditModule],
  controllers: [CommentsController],
  providers: [CommentsService],
  exports: [CommentsService],
})
export class CommentsModule {}