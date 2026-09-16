import { Module } from '@nestjs/common';

import { PaginationModule } from '../../common/pagination/pagination.module';
import { FacebookModule } from '../facebook/facebook.module';
import { AiModule } from '../ai/ai.module';
import { AuditModule } from '../audit/audit.module';
import { CampaignExecutionModule } from '../../workers/campaign-execution.module';
import { CommentsController } from './comments.controller';
import { CommentsService } from './comments.service';
import { CommentAutomationService } from './comment-automation.service';
import { CommentWorkerService } from './comment-worker.service';
import { CommentPollWorkerService } from './comment-poll.service';
import { CommentRulesService } from './comment-rules.service';
import { CommentRulesController } from './comment-rules.controller';

@Module({
  imports: [PaginationModule, CampaignExecutionModule, FacebookModule, AiModule, AuditModule],
  controllers: [CommentsController, CommentRulesController],
  providers: [
    CommentsService,
    CommentAutomationService,
    CommentWorkerService,
    CommentPollWorkerService,
    CommentRulesService,
  ],
  exports: [CommentsService, CommentAutomationService],
})
export class CommentsModule {}