import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { configuration } from './configuration';

export type AppConfigShape = ReturnType<typeof configuration>;

/**
 * Servicio de acceso tipado a la configuración global.
 * Se basa en `configuration()` (ya validada por Joi al arrancar).
 */
@Injectable()
export class AppConfigService {
  constructor(private readonly config: ConfigService) {}

  get all(): AppConfigShape {
    return configuration();
  }
  get nodeEnv(): string {
    return this.all.nodeEnv;
  }
  get isProd(): boolean {
    return this.nodeEnv === 'production';
  }
  get port(): number {
    return this.all.port;
  }
  get corsOrigins(): string[] {
    return this.all.corsOrigins;
  }
  get frontendUrl(): string {
    return this.all.frontendUrl;
  }
  get workerConcurrency(): number {
    return this.all.worker.concurrency;
  }
  get workerLeaseMs(): number {
    return this.all.worker.leaseMs;
  }
  get workerMaxAttempts(): number {
    return this.all.worker.maxAttempts;
  }
  get workerRetryBackoffMs(): number {
    return this.all.worker.retryBackoffMs;
  }
  get jwtSecret(): string {
    return this.all.jwt.secret!;
  }
  get jwtExpiresIn(): string {
    return this.all.jwt.expiresIn;
  }
  get refreshSecret(): string {
    return this.all.jwt.refreshSecret!;
  }
  get refreshExpiresIn(): string {
    return this.all.jwt.refreshExpiresIn;
  }
  get bcryptRounds(): number {
    return this.all.bcryptRounds;
  }
  get tokenEncryptionKey(): string {
    return this.all.crypto.tokenEncryptionKey!;
  }
  get throttleTtlMs(): number {
    return this.all.throttle.ttl;
  }
  get throttleLimit(): number {
    return this.all.throttle.limit;
  }
  get facebookAppId(): string {
    return this.all.facebook.appId!;
  }
  get facebookAppSecret(): string {
    return this.all.facebook.appSecret!;
  }
  get facebookApiVersion(): string {
    return this.all.facebook.apiVersion;
  }
  get facebookScopes(): string[] {
    return this.all.facebook.scopes;
  }
  get facebookRedirectUri(): string {
    return this.all.facebook.redirectUri!;
  }
  get webhookVerifyToken(): string {
    return this.all.facebook.webhookVerifyToken!;
  }
  get aiProvider(): string {
    return this.all.ai.provider;
  }
  get aiModel(): string {
    return this.all.ai.model;
  }
  get aiApiKey(): string | undefined {
    return this.all.ai.apiKey;
  }
  get aiBaseUrl(): string | undefined {
    return this.all.ai.baseUrl;
  }
}
