import { Injectable } from '@nestjs/common';
import { Page, FacebookAccount } from '@prisma/client';
import axios from 'axios';
import { AppConfigService } from '../../config/app-config.service';
import { CryptoService } from '../../common/crypto/crypto.service';
import { AppLogger } from '../../common/logger/app-logger.service';
import { PrismaService } from '../../prisma/prisma.service';
import {
  FACEBOOK_ME_FIELDS,
  FACEBOOK_OAUTH_DIALOG_BASE,
  FACEBOOK_PAGE_FIELDS,
  OAUTH_STATE_TTL_MS,
} from './facebook.config';

export interface FacebookGraphErrorBody {
  message?: string;
  code?: number;
  type?: string;
  error_subcode?: number;
  fbtrace_id?: string;
}

export interface PagePublishInput {
  message: string;
  imageUrls?: string[];
  videoUrl?: string;
}

export interface PagePublishResult {
  id: string;
  permalink: string;
}

export interface FacebookComment {
  id: string;
  message?: string;
  from?: { id: string; name?: string } | null;
  created_time?: string;
  is_hidden?: boolean;
  parent?: { id: string } | null;
}

export interface FacebookCommentsPage {
  data: FacebookComment[];
  paging?: { next?: string; cursors?: { after?: string; before?: string } };
}

/** Respuesta de /oauth/access_token (intercambio de code o fb_exchange_token). */
export interface MetaTokenResponse {
  access_token: string;
  token_type?: string;
  /** Segundos de validez; ausente en tokens long-lived sin expiración. */
  expires_in?: number;
}

/** Payload de /debug_token. */
export interface MetaDebugTokenData {
  app_id: string;
  type: string;
  application?: string;
  is_valid: boolean;
  /** Epoch (s). 0 = long-lived sin expiración. */
  expires_at?: number;
  issued_at?: number;
  data_access_expires_at?: number;
  scopes: string[];
  user_id?: string;
}

export type MetaPictureField = { url?: string; data?: { url?: string } };

/** Página devuelta por /me/accounts. */
export interface MetaPageSummary {
  id: string;
  name: string;
  category?: string;
  access_token: string;
  fan_count?: number;
  link?: string;
  is_published?: boolean;
  picture?: MetaPictureField;
  tasks?: string[];
}

/** FacebookAccount sin los tokens en claro/cifrados (seguro para exponer). */
export type SafeFacebookAccount = Omit<
  FacebookAccount,
  'accessTokenEncrypted' | 'refreshTokenEncrypted'
>;

/** Códigos de error de Graph que nunca tienen sentido reintentar. */
const FACEBOOK_PERMANENT_CODES = new Set([10, 17, 100, 190, 200, 368]);

/**
 * Error tipado de la API oficial de Meta.
 * - `isPermanent === true` → el job debe FRACASAR sin reintentos (token, permisos, params).
 * - `isPermanent === false` → transitorio (timeout/429/5xx) y el worker reintenta con backoff.
 */
export class FacebookGraphError extends Error {
  readonly status?: number;
  readonly body?: FacebookGraphErrorBody;

  constructor(message: string, opts: { status?: number; body?: FacebookGraphErrorBody } = {}) {
    super(message);
    this.name = 'FacebookGraphError';
    this.status = opts.status;
    this.body = opts.body;
  }

  get code(): number | undefined {
    return this.body?.code;
  }
  get type(): string | undefined {
    return this.body?.type;
  }
  get isPermanent(): boolean {
    if (this.status !== undefined && (this.status >= 500 || this.status === 429)) return false;
    if (this.type === 'OAuthException') return true;
    if (this.code !== undefined) return FACEBOOK_PERMANENT_CODES.has(this.code);
    return /token|permission|permanently|not found|no existe/i.test(this.message);
  }
}

/**
 * Firma central de integración con la API oficial de Meta (Graph API).
 * Todo acceso a token/cifrado queda encapsulado aquí: los workers y
 * servicios reciben solo ids de la base (pageId / metaCommentId / postObjectId).
 */
@Injectable()
export class FacebookService {
  private readonly timeout = 30_000;
  /** Estados OAuth emitidos en /oauth/url (CSRF de un solo uso con TTL). */
  private readonly pendingOAuthStates = new Map<string, number>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly crypto: CryptoService,
    private readonly config: AppConfigService,
    private readonly logger: AppLogger,
  ) {}

  /**
   * Publica un post en la página. Devuelve { id, permalink }.
   * - Con imageUrls: sube cada foto (published:false) y las adjunta vía attached_media.
   * - Con videoUrl: publica video con descripción (no combinable con imágenes).
   * - Sin media: feed de texto/links.
   */
  async publishToPage(pageId: string, input: PagePublishInput): Promise<PagePublishResult> {
    const { page, token } = await this.loadPage(pageId);

    if (input.videoUrl) {
      const video = await this.request<{ id: string }>('POST', `/${page.facebookPageId}/videos`, {
        params: { access_token: token, file_url: input.videoUrl, description: input.message },
      });
      const permalink = await this.fetchPermalink(video.id, token);
      return { id: video.id, permalink };
    }

    const params: Record<string, unknown> = { access_token: token, message: input.message };
    if (input.imageUrls?.length) {
      const media: Array<{ media_fbid: string }> = [];
      for (const url of input.imageUrls.slice(0, 8)) {
        const photo = await this.request<{ id: string }>('POST', `/${page.facebookPageId}/photos`, {
          params: { access_token: token, url, published: false },
        });
        media.push({ media_fbid: photo.id });
      }
      params.attached_media = JSON.stringify(media);
    }

    const post = await this.request<{ id: string }>('POST', `/${page.facebookPageId}/feed`, { params });
    const permalink = await this.fetchPermalink(post.id, token);
    return { id: post.id, permalink };
  }

  /** GET /{post_object_id}/comments — sincroniza comentarios de un post publicado. */
  async getPostComments(
    postObjectId: string,
    pageId: string,
    options: { limit?: number; after?: string } = {},
  ): Promise<FacebookCommentsPage> {
    const { token } = await this.loadPage(pageId);
    return this.request<FacebookCommentsPage>('GET', `/${postObjectId}/comments`, {
      params: {
        access_token: token,
        fields: 'id,message,from,created_time,is_hidden,parent{id}',
        limit: options.limit ?? 100,
        after: options.after,
      },
    });
  }

  /** POST /{comment_id}/comments — responde literalmente al comentario. */
  async replyToComment(commentId: string, pageId: string, message: string): Promise<{ id: string }> {
    const { token } = await this.loadPage(pageId);
    return this.request<{ id: string }>('POST', `/${commentId}/comments`, {
      params: { access_token: token, message },
    });
  }

  /** POST /{comment_id} con is_hidden — oculta/muestra un comentario. */
  async setCommentHidden(commentId: string, pageId: string, isHidden: boolean): Promise<void> {
    const { token } = await this.loadPage(pageId);
    await this.request('POST', `/${commentId}`, { params: { access_token: token, is_hidden: isHidden } });
  }

  /** DELETE /{comment_id} — elimina el comentario en Meta (si el permiso lo permite). */
  async deleteComment(commentId: string, pageId: string): Promise<void> {
    const { token } = await this.loadPage(pageId);
    await this.request('DELETE', `/${commentId}`, { params: { access_token: token } });
  }

  /** DELETE /{object_id} — elimina un post publicado de la página en Meta. */
  async deletePost(pageId: string, metaObjectId: string): Promise<void> {
    const { token } = await this.loadPage(pageId);
    await this.request('DELETE', `/${metaObjectId}`, { params: { access_token: token } });
  }

  // ---------------------------------------------------------------------------
  // OAuth (autorización de la cuenta e intercambio de tokens)
  // ---------------------------------------------------------------------------

  /** Deja registrado el estado OAuth para validación de un solo uso en el callback. */
  rememberOAuthState(state: string): void {
    this.pendingOAuthStates.set(state, Date.now() + OAUTH_STATE_TTL_MS);
  }

  /** Valida y consume un estado OAuth (single-use + TTL). */
  consumeOAuthState(state: string): boolean {
    const exp = this.pendingOAuthStates.get(state);
    if (exp === undefined) return false;
    this.pendingOAuthStates.delete(state);
    return exp > Date.now();
  }

  /** URL del diálogo de autorización de Meta (www.facebook.com/{version}/dialog/oauth). */
  getOAuthUrl(state: string): string {
    const params = new URLSearchParams({
      client_id: this.config.facebookAppId,
      redirect_uri: this.config.facebookRedirectUri,
      state,
      response_type: 'code',
      scope: this.config.facebookScopes.join(','),
    });
    return `${FACEBOOK_OAUTH_DIALOG_BASE}/${this.config.facebookApiVersion}/dialog/oauth?${params.toString()}`;
  }

  /** Intercambia el `code` de autorización por un access token corto. */
  async exchangeCodeForToken(code: string): Promise<MetaTokenResponse> {
    return this.request<MetaTokenResponse>('POST', '/oauth/access_token', {
      params: {
        client_id: this.config.facebookAppId,
        client_secret: this.config.facebookAppSecret,
        redirect_uri: this.config.facebookRedirectUri,
        code,
      },
    });
  }

  /** Convierte un token corto en un token long-lived (60 días) vía fb_exchange_token. */
  async longLivedToken(shortToken: string): Promise<MetaTokenResponse> {
    return this.request<MetaTokenResponse>('POST', '/oauth/access_token', {
      params: {
        grant_type: 'fb_exchange_token',
        client_id: this.config.facebookAppId,
        client_secret: this.config.facebookAppSecret,
        fb_exchange_token: shortToken,
      },
    });
  }

  /**
   * Lista las páginas del usuario vía /me/accounts siguiendo el cursor
   * `paging.next` hasta agotarlo. Devuelve el array plano de páginas de Meta.
   */
  async getPages(accessToken: string): Promise<MetaPageSummary[]> {
    const params = { access_token: accessToken, fields: FACEBOOK_PAGE_FIELDS, limit: 100 };
    const first = await this.request<{ data: MetaPageSummary[]; paging?: { next?: string } }>(
      'GET',
      '/me/accounts',
      { params },
    );
    const pages = [...(first.data ?? [])];

    let nextUrl = first.paging?.next;
    while (nextUrl) {
      const { data } = await axios.get<{ data: MetaPageSummary[]; paging?: { next?: string } }>(
        nextUrl,
        { timeout: this.timeout },
      );
      pages.push(...(data.data ?? []));
      nextUrl = data.paging?.next;
    }
    return pages;
  }

  // ---------------------------------------------------------------------------
  // Cuentas conectadas
  // ---------------------------------------------------------------------------

  /**
   * Valida el token con /debug_token, guarda la FacebookAccount (token cifrado
   * con AES-256-GCM) y refresca las Page vinculadas desde /me/accounts.
   * Devuelve la cuenta sin tokens en claro.
   */
  async storeFacebookAccount(
    userId: string,
    accessToken: string,
    expiresInSeconds?: number,
  ): Promise<SafeFacebookAccount> {
    const debug = await this.debugToken(accessToken);
    if (!debug.is_valid) {
      throw new FacebookGraphError('El access token de Meta no es válido o expiró', {
        status: 400,
        body: { code: 190, type: 'OAuthException', error_subcode: 463, message: 'El access token de Meta no es válido o expiró' },
      });
    }

    const me = await this.getMe(accessToken).catch(() => null);
    const facebookUserId = debug.user_id ?? me?.id;
    if (!facebookUserId) {
      throw new FacebookGraphError('No se pudo identificar al usuario de Facebook', {
        status: 400,
        body: { code: 100, type: 'InvalidParameter', message: 'No se pudo identificar al usuario de Facebook' },
      });
    }

    const accessTokenEncrypted = this.crypto.encrypt(accessToken);
    const tokenExpiresAt =
      debug.expires_at && debug.expires_at > 0
        ? new Date(debug.expires_at * 1000)
        : expiresInSeconds
          ? new Date(Date.now() + expiresInSeconds * 1000)
          : null;

    const data = {
      facebookUserId,
      facebookUserName: me?.name ?? null,
      email: me?.email ?? null,
      accessTokenEncrypted,
      tokenType: 'long-lived',
      tokenExpiresAt,
      scopes: debug.scopes ?? [],
      status: 'ACTIVE' as const,
    };

    const account = await this.prisma.facebookAccount.upsert({
      where: { userId_facebookUserId: { userId, facebookUserId } },
      create: { ...data, userId },
      update: data,
    });

    const syncedPages = await this.syncAccountPages(account.id, accessToken);
    this.logger.info(
      `Cuenta de Facebook ${facebookUserId} conectada para el usuario ${userId} (${syncedPages} páginas sincronizadas)`,
    );

    const fresh = await this.prisma.facebookAccount.findUniqueOrThrow({ where: { id: account.id } });
    return this.toSafeFacebookAccount(fresh);
  }

  /** Lista las cuentas de Facebook conectadas del usuario (sin tokens). */
  async listAccounts(
    userId: string,
  ): Promise<Array<Omit<FacebookAccount, 'accessTokenEncrypted' | 'refreshTokenEncrypted'> & { pageCount: number }>> {
    const accounts = await this.prisma.facebookAccount.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      include: { _count: { select: { pages: true } } },
    });
    return accounts.map(({ accessTokenEncrypted, refreshTokenEncrypted, _count, ...safe }) => {
      void accessTokenEncrypted;
      void refreshTokenEncrypted;
      return {
        ...safe,
        pageCount: _count.pages,
      };
    });
  }

  /** Desconecta la cuenta: revoca el token en Meta (best effort) y la marca DISCONNECTED. */
  async disconnect(userId: string, accountId: string): Promise<{ id: string; status: string }> {
    const account = await this.prisma.facebookAccount.findFirst({
      where: { id: accountId, userId },
      select: { id: true, accessTokenEncrypted: true, facebookUserId: true },
    });
    if (!account) {
      throw new FacebookGraphError('Cuenta de Facebook no encontrada', {
        status: 404,
        body: { code: 100, message: 'Cuenta de Facebook no encontrada' },
      });
    }

    try {
      const token = this.crypto.decrypt(account.accessTokenEncrypted);
      // La API de Meta requiere DELETE /{userId}/permissions para revocar todos los permisos
      await this.request('DELETE', `/${account.facebookUserId}/permissions`, {
        params: { access_token: token },
      });
    } catch (err) {
      // Best-effort: si el token ya expiró o fue revocado, la cuenta igual se desconecta en BD
      this.logger.warn(`No se pudo revocar el access token de ${accountId}: ${(err as Error).message}`);
    }

    await this.prisma.facebookAccount.update({
      where: { id: accountId },
      data: { status: 'DISCONNECTED' },
    });
    this.logger.info(`Cuenta de Facebook ${accountId} desconectada (usuario ${userId})`);
    return { id: accountId, status: 'DISCONNECTED' };
  }

  /** GET /debug_token con input_token + app token. */
  private async debugToken(accessToken: string): Promise<MetaDebugTokenData> {
    const res = await this.request<{ data: MetaDebugTokenData }>('GET', '/debug_token', {
      params: {
        input_token: accessToken,
        access_token: `${this.config.facebookAppId}|${this.config.facebookAppSecret}`,
      },
    });
    return res.data;
  }

  private async getMe(accessToken: string): Promise<{ id: string; name?: string; email?: string }> {
    return this.request<{ id: string; name?: string; email?: string }>('GET', '/me', {
      params: { fields: FACEBOOK_ME_FIELDS, access_token: accessToken },
    });
  }

  /** Upsert de las Page de la cuenta a partir de /me/accounts (token de página cifrado). */
  private async syncAccountPages(accountId: string, accessToken: string): Promise<number> {
    const metaPages = await this.getPages(accessToken);
    const account = await this.prisma.facebookAccount.findUniqueOrThrow({
      where: { id: accountId },
      select: { userId: true },
    });

    for (const meta of metaPages) {
      const pageTokenEncrypted = meta.access_token ? this.crypto.encrypt(meta.access_token) : undefined;
      await this.prisma.page.upsert({
        where: { accountId_facebookPageId: { accountId, facebookPageId: meta.id } },
        create: {
          accountId,
          userId: account.userId,
          facebookPageId: meta.id,
          name: meta.name,
          category: meta.category ?? null,
          pictureUrl: this.pictureUrl(meta.picture),
          url: meta.link ?? null,
          followersCount: meta.fan_count ?? 0,
          accessTokenEncrypted: pageTokenEncrypted ?? '',
        },
        update: {
          name: meta.name,
          category: meta.category ?? null,
          pictureUrl: this.pictureUrl(meta.picture),
          url: meta.link ?? null,
          followersCount: meta.fan_count ?? 0,
          status: meta.is_published === false ? 'DISABLED' : 'ACTIVE',
          ...(pageTokenEncrypted ? { accessTokenEncrypted: pageTokenEncrypted } : {}),
        },
      });
    }
    return metaPages.length;
  }

  private pictureUrl(picture?: MetaPictureField): string | undefined {
    return picture?.url ?? picture?.data?.url ?? undefined;
  }

  private toSafeFacebookAccount(account: FacebookAccount): SafeFacebookAccount {
    const { accessTokenEncrypted, refreshTokenEncrypted, ...safe } = account;
    void accessTokenEncrypted;
    void refreshTokenEncrypted;
    return safe;
  }

  private async loadPage(pageId: string): Promise<{ page: Page; token: string }> {
    const page = await this.prisma.page.findUnique({ where: { id: pageId } });
    if (!page) {
      throw new FacebookGraphError('La página no existe en la base de datos', {
        body: { code: 100, message: 'La página no existe en la base de datos' },
      });
    }
    if (page.status === 'DISABLED' || page.status === 'REVOKED') {
      throw new FacebookGraphError(`La página está en estado ${page.status}`, {
        body: { code: 200, type: 'OAuthException', message: `La página está en estado ${page.status}` },
      });
    }
    const token = this.crypto.decrypt(page.accessTokenEncrypted);
    if (!token?.trim()) {
      throw new FacebookGraphError('La página no tiene token de acceso válido', {
        body: { code: 190, type: 'OAuthException', message: 'Sin token de acceso' },
      });
    }
    return { page, token };
  }

  private async fetchPermalink(graphId: string, token: string): Promise<string> {
    try {
      const result = await this.request<{ permalink_url?: string }>('GET', `/${graphId}`, {
        params: { fields: 'permalink_url', access_token: token },
      });
      if (result.permalink_url) return result.permalink_url;
    } catch (err) {
      this.logger.warn(`Permalink no disponible para ${graphId}: ${(err as Error).message}`);
    }
    return `https://www.facebook.com/permalink/?id=${this.extractGraphId(graphId)}`;
  }

  private extractGraphId(graphId: string): string {
    const idx = graphId.lastIndexOf('_');
    return idx >= 0 ? graphId.slice(idx + 1) : graphId;
  }

  private async request<T>(
    method: 'GET' | 'POST' | 'DELETE',
    path: string,
    opts: { params?: Record<string, unknown> },
  ): Promise<T> {
    try {
      const { data } = await axios.request<T & { error?: FacebookGraphErrorBody }>({
        method,
        url: `https://graph.facebook.com/${this.config.facebookApiVersion}${path}`,
        params: opts.params,
        timeout: this.timeout,
      });
      if (data && typeof data === 'object' && (data as { error?: FacebookGraphErrorBody }).error) {
        const body = (data as { error: FacebookGraphErrorBody }).error;
        throw new FacebookGraphError(body.message ?? 'Error de Graph API', { body });
      }
      return data as T;
    } catch (err) {
      if (err instanceof FacebookGraphError) throw err;
      if (axios.isAxiosError(err)) {
        const status = err.response?.status;
        const body = err.response?.data as FacebookGraphErrorBody | undefined;
        if (body) throw new FacebookGraphError(body.message ?? err.message, { status, body });
        const transient = err.code === 'ECONNABORTED' || !err.request || (status !== undefined && status >= 500);
        throw new FacebookGraphError(err.message, { status: transient ? status ?? 500 : status });
      }
      throw err;
    }
  }
}