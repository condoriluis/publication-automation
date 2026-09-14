import { Module } from '@nestjs/common';

import { PaginationModule } from '../../common/pagination/pagination.module';
import { AuditModule } from '../audit/audit.module';
import { CampaignExecutionModule } from '../../workers/campaign-execution.module';
import { CampaignsController } from './campaigns.controller';
import { CampaignsService } from './campaigns.service';

@Module({
  imports: [PaginationModule, CampaignExecutionModule, AuditModule],
  controllers: [CampaignsController],
  providers: [CampaignsService],
  exports: [CampaignsService],
})
export class CampaignsModule {}