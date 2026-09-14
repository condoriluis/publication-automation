import { Body, Controller, ForbiddenException, Get, HttpCode, Post, Query, Req } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { SkipThrottle } from '@nestjs/throttler';
import { Request } from 'express';
import { RawBodyRequest } from '@nestjs/common';
import { Public } from '../../common/decorators/auth.decorators';
import { CryptoService } from '../../common/crypto/crypto.service';
import { AppConfigService as AppConfig } from '../../config/app-config.service';
import { WebhooksService } from './webhooks.service';

@ApiTags('Webhooks Meta')
@Controller('webhooks/meta')
@SkipThrottle()
export class WebhooksController {
  constructor(
    private readonly webhooksService: WebhooksService,
    private readonly crypto: CryptoService,
    private readonly appConfig: AppConfig,
  ) {}

  @Get()
  @Public()
  verify(
    @Query('hub.mode') mode?: string,
    @Query('hub.verify_token') token?: string,
    @Query('hub.challenge') challenge?: string,
  ): string {
    const tokenOk = token !== undefined && this.crypto.safeEqual(this.appConfig.webhookVerifyToken, token);
    if (mode === 'subscribe' && tokenOk && challenge !== undefined) {
      return challenge;
    }
    throw new ForbiddenException('Verificación del webhook rechazada');
  }

  @Post()
  @Public()
  @HttpCode(200)
  async receive(@Req() req: RawBodyRequest<Request>, @Body() body: unknown): Promise<void> {
    const signature = (req.headers?.['x-hub-signature-256'] as string | undefined) ?? '';
    const rawBody = req.rawBody ?? Buffer.from(JSON.stringify(body ?? {}));
    if (!this.webhooksService.verifySignature(rawBody, signature)) {
      throw new ForbiddenException('Firma inválida del webhook de Meta');
    }
    await this.webhooksService.processPayload(body);
  }
}