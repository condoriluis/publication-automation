import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';

import { CurrentUser, Permissions } from '../../common/decorators/auth.decorators';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { PostsService } from './posts.service';
import { CreatePostDto } from './dto/create-post.dto';
import { UpdatePostDto } from './dto/update-post.dto';
import { PostFilterDto } from './dto/post-filter.dto';

@ApiTags('posts')
@ApiBearerAuth()
@Controller('posts')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class PostsController {
  constructor(private readonly postsService: PostsService) {}

  @Post()
  @Permissions('posts:write')
  @ApiOperation({ summary: 'Crear publicación (borrador o programada)' })
  create(@CurrentUser('sub') userId: string, @Body() dto: CreatePostDto) {
    return this.postsService.create(userId, dto);
  }

  @Get()
  @Permissions('posts:read')
  @ApiOperation({ summary: 'Listar publicaciones (paginado + filtros)' })
  findAll(@CurrentUser('sub') userId: string, @Query() query: PostFilterDto) {
    return this.postsService.findAll(userId, query);
  }

  @Get(':id')
  @Permissions('posts:read')
  @ApiOperation({ summary: 'Detalle de publicación' })
  findOne(@CurrentUser('sub') userId: string, @Param('id') id: string) {
    return this.postsService.findOne(userId, id);
  }

  @Patch(':id')
  @Permissions('posts:write')
  @ApiOperation({ summary: 'Actualizar publicación (solo DRAFT)' })
  update(@CurrentUser('sub') userId: string, @Param('id') id: string, @Body() dto: UpdatePostDto) {
    return this.postsService.update(userId, id, dto);
  }

  @Post(':id/publish')
  @HttpCode(HttpStatus.ACCEPTED)
  @Permissions('posts:write')
  @ApiOperation({ summary: 'Encolar publicación en Meta (job asíncrono)' })
  publish(@CurrentUser('sub') userId: string, @Param('id') id: string) {
    return this.postsService.publish(userId, id);
  }

  @Post(':id/cancel')
  @HttpCode(HttpStatus.ACCEPTED)
  @Permissions('posts:write')
  @ApiOperation({ summary: 'Cancelar publicación no ejecutada' })
  cancel(@CurrentUser('sub') userId: string, @Param('id') id: string) {
    return this.postsService.cancel(userId, id);
  }

  @Delete(':id')
  @Permissions('posts:write')
  @ApiOperation({ summary: 'Eliminar publicación (de Facebook si estaba publicada)' })
  remove(@CurrentUser('sub') userId: string, @Param('id') id: string) {
    return this.postsService.remove(userId, id);
  }
}