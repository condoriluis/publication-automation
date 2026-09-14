import { Module } from '@nestjs/common';
import { PaginationHelper } from './pagination.helper';

@Module({
  providers: [PaginationHelper],
  exports: [PaginationHelper],
})
export class PaginationModule {}
