import {
  BadRequestException,
  Controller,
  Delete,
  Get,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  CurrentUser,
  Public,
  RequestWithUser,
} from '../../common/decorators/auth.decorators';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CryptoService } from '../../common/crypto/crypto.service';
import { OAUTH_STATE_TTL_MS } from './facebook.config';
import { FacebookService, SafeFacebookAccount } from './facebook.service';

@Controller('facebook')
@UseGuards(JwtAuthGuard)
export class FacebookController {
  constructor(
    private readonly facebook: FacebookService,
    private readonly crypto: CryptoService,
  ) {}

  /** OAuth iniciando: URL de Meta + estado (CSRF) de un solo uso. */
  @Public()
  @Get('oauth/url')
  async getOAuthUrl(): Promise<{ authorizeUrl: string; state: string; expiresInSeconds: number }> {
    const state = this.crypto.randomToken(32);
    this.facebook.rememberOAuthState(state);
    return {
      authorizeUrl: this.facebook.getOAuthUrl(state),
      state,
      expiresInSeconds: OAUTH_STATE_TTL_MS / 1000,
    };
  }

  /** Callback del flujo OAuth: intercambia el code y conecta la cuenta al usuario del JWT. */
  @Get('oauth/callback')
  async oauthCallback(
    @Query('code') code: string,
    @Query('state') state: string,
    @CurrentUser('sub') userId: string,
  ): Promise<{ success: boolean; account: SafeFacebookAccount }> {
    if (!code || !state) {
      throw new BadRequestException('Faltan los parámetros code/state');
    }
    if (!this.facebook.consumeOAuthState(state)) {
      throw new BadRequestException('Estado OAuth inválido o expirado');
    }

    const shortToken = await this.facebook.exchangeCodeForToken(code);
    const longToken = await this.facebook.longLivedToken(shortToken.access_token);
    const account = await this.facebook.storeFacebookAccount(
      userId,
      longToken.access_token,
      longToken.expires_in,
    );

    return { success: true, account };
  }

  /** Cuentas de Facebook conectadas del usuario autenticado. */
  @Get('accounts')
  async listAccounts(@CurrentUser() user: RequestWithUser['user']): Promise<
    ReturnType<FacebookService['listAccounts']>
  > {
    return this.facebook.listAccounts(user.sub);
  }

  /** Desconecta una cuenta de Facebook. */
  @Delete('accounts/:id')
  async disconnect(
    @Param('id') id: string,
    @CurrentUser('sub') userId: string,
  ): Promise<{ success: boolean; account: { id: string; status: string } }> {
    const account = await this.facebook.disconnect(userId, id);
    return { success: true, account };
  }
}