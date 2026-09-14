import { Module } from '@nestjs/common';

import { AIConfigService } from './ai-config.service';

@Module({
  providers: [AIConfigService],
  exports: [AIConfigService],
})
export class AIConfigModule {}