/**
 * Configuración tipada ensamblada a partir de variables de entorno.
 * Regresa estructuras ya validadas (env.validation corre antes).
 */
export const configuration = () => ({
  nodeEnv: process.env.NODE_ENV ?? 'development',
  port: parseInt(process.env.PORT ?? '3001', 10),
  corsOrigins: (process.env.CORS_ORIGINS ?? process.env.FRONTEND_URL ?? 'http://localhost:3000')
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean),
  frontendUrl: process.env.FRONTEND_URL ?? 'http://localhost:3000',

  worker: {
    concurrency: parseInt(process.env.WORKER_CONCURRENCY ?? '10', 10),
    leaseMs: parseInt(process.env.WORKER_LEASE_MS ?? '60000', 10),
    maxAttempts: parseInt(process.env.WORKER_MAX_ATTEMPTS ?? '5', 10),
    retryBackoffMs: parseInt(process.env.WORKER_RETRY_BACKOFF_MS ?? '30000', 10),
  },

  jwt: {
    secret: process.env.JWT_SECRET,
    expiresIn: process.env.JWT_EXPIRES_IN ?? '1d',
    refreshSecret: process.env.REFRESH_TOKEN_SECRET ?? process.env.JWT_SECRET,
    refreshExpiresIn: process.env.REFRESH_TOKEN_EXPIRES_IN ?? '7d',
  },
  bcryptRounds: parseInt(process.env.BCRYPT_ROUNDS ?? '12', 10),

  crypto: {
    tokenEncryptionKey: process.env.TOKEN_ENCRYPTION_KEY,
  },

  throttle: {
    ttl: parseInt(process.env.THROTTLE_TTL_MS ?? '60000', 10),
    limit: parseInt(process.env.THROTTLE_LIMIT ?? '200', 10),
  },

  facebook: {
    appId: process.env.FACEBOOK_APP_ID,
    appSecret: process.env.FACEBOOK_APP_SECRET,
    apiVersion: process.env.FACEBOOK_API_VERSION ?? 'v26.0',
    scopes: (process.env.META_OAUTH_SCOPES ?? '')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean),
    redirectUri: process.env.META_OAUTH_REDIRECT_URI,
    webhookVerifyToken: process.env.META_WEBHOOK_VERIFY_TOKEN,
  },

  ai: {
    provider: process.env.AI_PROVIDER ?? 'openai',
    model: process.env.AI_MODEL ?? 'gpt-4o-mini',
    apiKey: process.env.AI_API_KEY || undefined,
    baseUrl: process.env.AI_BASE_URL || undefined,
  },
});