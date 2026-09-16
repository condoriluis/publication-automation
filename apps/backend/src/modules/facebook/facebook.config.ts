import { Injectable } from '@nestjs/common';
import { AppConfigService } from '../../config/app-config.service';

/** Base de la API de Graph de Meta. */
export const FACEBOOK_GRAPH_BASE = 'https://graph.facebook.com';
/** Base del diálogo de autorización OAuth (www.facebook.com). */
export const FACEBOOK_OAUTH_DIALOG_BASE = 'https://www.facebook.com';

/** Campos solicitados al listar páginas en /me/accounts. */
export const FACEBOOK_PAGE_FIELDS =
  'id,name,category,access_token,fan_count,picture{url},link,is_published';
/** Campos del perfil del usuario de Facebook en /me. */
export const FACEBOOK_ME_FIELDS = 'id,name,email,first_name,last_name';
/** Campos que suscribimos vía /{page_id}/subscribed_apps para el webhook de comentarios. */
export const FACEBOOK_PAGE_SUBSCRIBE_FIELDS = 'feed,comments';

/** TTL del estado OAuth emitido en /facebook/oauth/url. */
export const OAUTH_STATE_TTL_MS = 10 * 60 * 1000;

/**
 * Configuración específica de la integración con Meta/Facebook.
 * Reutiliza los getters ya tipados de AppConfigService y añade
 * urls/endpoints derivados (graph base, diálogo OAuth, app token).
 */
@Injectable()
export class FacebookConfig {
  constructor(private readonly appConfig: AppConfigService) {}

  get appId(): string {
    return this.appConfig.facebookAppId;
  }

  get appSecret(): string {
    return this.appConfig.facebookAppSecret;
  }

  get apiVersion(): string {
    return this.appConfig.facebookApiVersion;
  }

  get scopes(): string[] {
    return this.appConfig.facebookScopes;
  }

  get redirectUri(): string {
    return this.appConfig.facebookRedirectUri;
  }

  /** https://graph.facebook.com/{version} */
  get graphBaseUrl(): string {
    return `${FACEBOOK_GRAPH_BASE}/${this.apiVersion}`;
  }

  /** https://www.facebook.com/{version}/dialog/oauth */
  get authDialogUrl(): string {
    return `${FACEBOOK_OAUTH_DIALOG_BASE}/${this.apiVersion}/dialog/oauth`;
  }

  /** Token de app `{appId}|{appSecret}`, necesario para /debug_token. */
  get appToken(): string {
    return `${this.appId}|${this.appSecret}`;
  }
}