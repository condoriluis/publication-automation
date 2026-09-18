import { z } from 'zod';

/**
 * Validación estricta de variables de entorno al arrancar.
 * El proceso se detiene temprano si falta o es inválida alguna var crítica.
 * Usa zod (ya en dependencias) en lugar de Joi, cumpliendo la interfaz
 * `validate(config)` esperada por ConfigModule.forRoot().
 */
const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().int().positive().default(3001),
  CORS_ORIGINS: z.string().optional(),
  FRONTEND_URL: z.string().url().default('http://localhost:3000'),

  // Base de datos (PostgreSQL — Supabase con Prisma)
  // pooler :6543 (runtime) en DATABASE_URL / direct :5432 (migraciones) en DIRECT_URL
  DATABASE_URL: z
    .string()
    .regex(/^postgresql:\/\//, 'DATABASE_URL debe empezar con postgresql://'),
  DIRECT_URL: z.string().optional(),

  // Worker de campañas sin cola externa (claims atómicos en PostgreSQL)
  WORKER_CONCURRENCY: z.coerce.number().int().min(1).max(100).default(10),
  WORKER_LEASE_MS: z.coerce.number().int().min(1000).default(60000),
  WORKER_MAX_ATTEMPTS: z.coerce.number().int().min(1).max(50).default(5),
  WORKER_RETRY_BACKOFF_MS: z.coerce.number().int().min(0).default(30000),

  // Sondeo automático de comentarios (alternativa a webhooks sin publicar la app)
  COMMENT_POLL_INTERVAL_MIN: z.coerce.number().int().min(1).max(60).default(10),
  COMMENT_POLL_WINDOW_HOURS: z.coerce.number().int().min(1).max(24 * 30).default(24),
  COMMENT_POLL_MAX_POSTS: z.coerce.number().int().min(1).max(100).default(10),
  COMMENT_POLL_PAGE_DELAY_MS: z.coerce.number().int().min(0).max(10_000).default(250),

  // Seguridad / JWT
  JWT_SECRET: z.string().min(32, 'JWT_SECRET debe tener al menos 32 caracteres'),
  JWT_EXPIRES_IN: z.string().default('1d'),
  REFRESH_TOKEN_SECRET: z.string().min(32).optional(),
  REFRESH_TOKEN_EXPIRES_IN: z.string().default('7d'),
  BCRYPT_ROUNDS: z.coerce.number().int().min(4).max(15).default(12),

  // reCAPTCHA (login) — opcional: si no se define, la verificación se omite
  RECAPTCHA_SECRET_KEY: z
    .string()
    .optional()
    .superRefine((value, ctx) => {
      // Fail-closed: si se corre en producción sin secret, el arranque falla
      // en lugar de dejar el login sin verificación antirrobot.
      if (process.env.NODE_ENV === 'production' && !value) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'RECAPTCHA_SECRET_KEY es obligatoria en producción (fail-closed)',
        });
      }
    }),

  // Cifrado AES-256-GCM para tokens de terceros (clave HEX de 32 bytes).
  // Requerida: sin ella el arranque falla (no se permite clave por defecto).
  TOKEN_ENCRYPTION_KEY: z.string().regex(
    /^[0-9a-fA-F]{64}$/,
    'TOKEN_ENCRYPTION_KEY debe ser un string HEX de 64 caracteres (32 bytes)',
  ),

  // Meta / Facebook
  FACEBOOK_APP_ID: z.string().min(1),
  FACEBOOK_APP_SECRET: z.string().min(1),
  FACEBOOK_API_VERSION: z.string().default('v26.0'),
  META_OAUTH_SCOPES: z
    .string()
    .default(
      'email,pages_show_list,pages_read_engagement,pages_manage_posts,pages_manage_engagement,pages_manage_metadata,business_management',
    ),
  META_OAUTH_REDIRECT_URI: z.string().url(),
  META_WEBHOOK_VERIFY_TOKEN: z.string().min(1),

  // IA (proveedor configurable)
  AI_PROVIDER: z.enum(['openai', 'anthropic', 'google', 'groq', 'openrouter']).default('openai'),
  AI_MODEL: z.string().default('gpt-4o-mini'),
  AI_API_KEY: z.string().optional(),
  AI_BASE_URL: z.string().url().optional(),

  // Rate limiting
  THROTTLE_TTL_MS: z.coerce.number().int().min(1000).default(60000),
  THROTTLE_LIMIT: z.coerce.number().int().min(10).default(200),

  // Retención de auditoría (purgado automático diario)
  AUDIT_RETENTION_DAYS: z.coerce.number().int().positive().max(3650).optional(),

  // Logging
  LOG_LEVEL: z.string().optional(),
  LOG_FORMAT: z.string().optional(),
  LOG_FILE: z.string().optional(),
  PRISMA_LOG: z.string().optional(),
});

/** Función `validate` para ConfigModule.forRoot({ validate }) */
export function validateEnvConfig(config: Record<string, unknown>): Record<string, unknown> {
  const parsed = envSchema.safeParse(config);
  if (!parsed.success) {
    const details = parsed.error.issues
      .map((issue) => `${issue.path.join('.') || '(root)'}: ${issue.message}`)
      .join('; ');
    throw new Error(`Configuración de entorno inválida: ${details}`);
  }
  return parsed.data;
}