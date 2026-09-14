import { Module } from '@nestjs/common';

import { PaginationModule } from '../../common/pagination/pagination.module';
import { AuditModule } from '../audit/audit.module';
import { FacebookModule } from '../facebook/facebook.module';
import { CampaignExecutionModule } from '../../workers/campaign-execution.module';
import { PostsController } from './posts.controller';
import { PostsService } from './posts.service';

@Module({
  imports: [PaginationModule, CampaignExecutionModule, AuditModule, FacebookModule],
  controllers: [PostsController],
  providers: [PostsService],
  exports: [PostsService],
})
export class PostsModule {}