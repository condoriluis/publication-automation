import { Module } from '@nestjs/common';
import { AiController } from './ai.controller';
import { AiService } from './ai.service';
import { AIConfigModule } from './ai-config.module';
import { PrismaModule } from '../../prisma/prisma.module';

/** Expone AiService para respuestas automáticas en moderación de comentarios. */
@Module({
  imports: [AIConfigModule, PrismaModule],
  controllers: [AiController],
  providers: [AiService],
  exports: [AiService],
})
export class AiModule {}