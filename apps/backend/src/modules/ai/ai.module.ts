import { Module } from '@nestjs/common';
import { AiService } from './ai.service';
import { AIConfigModule } from './ai-config.module';

/** Expone AiService para respuestas automáticas en moderación de comentarios. */
@Module({
  imports: [AIConfigModule],
  providers: [AiService],
  exports: [AiService],
})
export class AiModule {}