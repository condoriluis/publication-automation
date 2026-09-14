import { Module } from '@nestjs/common';
import { PaginationModule } from '../../common/pagination/pagination.module';
import { AuditController } from './audit.controller';
import { AuditService } from './audit.service';

@Module({
  imports: [PaginationModule],
  controllers: [AuditController],
  providers: [AuditService],
  exports: [AuditService],
})
export class AuditModule {}