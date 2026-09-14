import { Module } from '@nestjs/common';
import { PaginationModule } from '../../common/pagination/pagination.module';
import { FacebookModule } from '../facebook/facebook.module';
import { PagesController } from './pages.controller';
import { PagesService } from './pages.service';

/**
 * Gestión de páginas de Facebook vinculadas a las cuentas conectadas.
 * Reutiliza FacebookService (Meta API) y PaginationHelper.
 */
@Module({
  imports: [FacebookModule, PaginationModule],
  controllers: [PagesController],
  providers: [PagesService],
  exports: [PagesService],
})
export class PagesModule {}