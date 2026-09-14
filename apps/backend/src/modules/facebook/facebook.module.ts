import { Module } from '@nestjs/common';
import { FacebookController } from './facebook.controller';
import { FacebookService } from './facebook.service';
import { FacebookConfig } from './facebook.config';

/** Expone FacebookService a los módulos de negocio y a los workers standalone. */
@Module({
  controllers: [FacebookController],
  providers: [FacebookService, FacebookConfig],
  exports: [FacebookService],
})
export class FacebookModule {}