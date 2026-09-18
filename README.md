# Publication Automation

Plataforma **full-stack** para la **gestión y automatización de publicaciones e interacciones** de páginas de Facebook usando la **API oficial de Meta** (Graph API + OAuth + Webhooks), con IA configurable, una **cola de trabajo propia sobre PostgreSQL** (claims atómicos con leases, sin Redis) y un registro de auditoría completo.

> ⚠️ **Política**: la herramienta **NO** evita límites ni sistemas anti-spam de Meta, ni fabrica interacción falsa. Trabaja con el token del usuario y los permisos que Meta otorga. Respetar las políticas de Meta es requisito de uso.

---

## 🧱 Stack

| Capa | Tecnología |
|---|---|
| API | NestJS 11 + TypeScript estricto |
| ORM | Prisma 6 (PostgreSQL) |
| Scheduler | @nestjs/schedule (intervalos: campañas y publicación programada) |
| Colas | Cola propia en PostgreSQL: worker + scheduler con claims atómicos y leases (sin BullMQ/Redis) |
| DB | PostgreSQL 16 |
| Validación | class-validator (DTOs) + Zod (env y payloads IA) |
| Seguridad | Helmet, CORS estricto, throttling, AES-256-GCM (tokens en reposo), bcrypt, reCAPTCHA |
| IA | OpenAI / Anthropic / Groq / Google / OpenRouter (configurable) |
| Frontend | Next.js 16 App Router + React 19 + Tailwind + shadcn/ui + Sonner |

---

## 📁 Estructura

```
publication-automation/
├── docker-compose.yml      # postgres + api + worker + scheduler
├── render.yaml             # despliegue del backend en Render
├── apps/
│   ├── backend/            # NestJS API (api/), worker (worker.ts), scheduler (scheduler.ts)
│   │   ├── prisma/schema.prisma + seed.ts
│   │   └── src/
│   │       ├── modules/    # auth, users, pages, facebook, campaigns, posts, comments,
│   │       │               # ai, dashboard, audit, webhooks, health
│   │       └── workers/    # campaign-executor, campaign-scheduler, campaign-worker,
│   │                       # scheduled-post-publisher
│   └── frontend/           # Next.js 16 (App Router)
```

Monorepo con **npm workspaces** (`apps/*`).

---

## 🚀 Desarrollo rápido

Requisitos: Docker Desktop (Compose v2) y Node 20+.

1. Copia `apps/backend/.env.example` → `apps/backend/.env` y completa al menos `DATABASE_URL`/`DIRECT_URL`, `JWT_SECRET`, `REFRESH_TOKEN_SECRET`, `TOKEN_ENCRYPTION_KEY` (HEX de 64 chars, obligatoria) y las `FACEBOOK_APP_*`/`META_*`.
2. Levanta la base:
   ```bash
   docker compose up -d postgres
   ```
3. Backend (hot-reload) → `npm run dev:backend`
4. Migraciones + seed → `npm run db:migrate && npm run db:seed`
5. Frontend → `npm run dev:frontend` (en `http://localhost:3000`)

La API responde en `http://localhost:3001/api/v1` (prefijo global `api`), con Swagger en `/api/docs`.

### Producción-like con Docker

```bash
docker compose up --build -d
```

Servicios: `postgres` (5433), `api` (3001), `worker` y `scheduler` (procesos en segundo plano). Los tres procesos de la app compiten por claims atómicos en PostgreSQL, así que pueden replicarse sin duplicados.

---

## 🔐 Variables clave (ver `apps/backend/.env.example`)

| Variable | Descripción |
|---|---|
| `DATABASE_URL` / `DIRECT_URL` | DSN PostgreSQL (pooled para runtime, directa para migraciones) |
| `TOKEN_ENCRYPTION_KEY` | **Obligatoria** (HEX 64). AES-256-GCM de los tokens de Facebook |
| `JWT_SECRET` / `REFRESH_TOKEN_SECRET` | ≥32 chars; firmas de JWT y refresh tokens |
| `FACEBOOK_APP_ID` / `FACEBOOK_APP_SECRET` / `FACEBOOK_API_VERSION` | App de Meta (v26.0) |
| `META_OAUTH_REDIRECT_URI` / `META_OAUTH_SCOPES` | Callback OAuth y scopes solicitados |
| `META_WEBHOOK_VERIFY_TOKEN` | Verificación del webhook de Meta |
| `RECAPTCHA_SECRET_KEY` | **Obligatorio en producción** (fail-closed) |
| `AI_PROVIDER` / `AI_MODEL` / `AI_API_KEY` | Proveedor/modelo/clave de IA |
| `WORKER_CONCURRENCY` / `WORKER_LEASE_MS` / `WORKER_MAX_ATTEMPTS` / `WORKER_RETRY_BACKOFF_MS` | Concurrencia, leases y reintentos del worker |
| `AUDIT_RETENTION_DAYS` | Días de retención del registro de auditoría (purga diaria) |

---

## 🔌 Conexión con Facebook (Meta)

1. En `login` → "Conectar con Facebook": OAuth con los scopes `META_OAUTH_SCOPES` (email, `pages_show_list`, `pages_read_engagement`, `pages_manage_posts`, `pages_manage_engagement`, `pages_manage_metadata`, `business_management`).
2. El callback intercambia el código por `access_token` vía Graph API, **se cifra con `TOKEN_ENCRYPTION_KEY`** (AES-256-GCM) y se guarda. Para rotar la clave existe `npm run encryption:rekey` (y `encryption:rekey:dry`).
3. El webhook recibe comentarios vía `subscribed_apps`; la IA los clasifica. Como respaldo hay sondeo programado de comentarios (`COMMENT_POLL_*`).
4. Al conectar, el token corto se convierte en **long-lived (~60 días)** vía `fb_exchange_token`, se guarda cifrado su fecha de vencimiento y se renueva reconectando por OAuth.

---

## 🧠 IA

- `AiModule` → `AiService` con proveedor configurable (`AI_PROVIDER`).
- Funciones: generar contenido de posts y campañas, redactar respuestas a comentarios, **analizar/clasificar comentarios** (riesgo, sentimiento, acción sugerida) y moderación sugerida.
- Por debajo del umbral de confianza (80) el comentario pasa a **revisión humana**.
- **La IA nunca ejecuta acciones por sí sola**: siempre devuelve una propuesta que el usuario aprueba.

---

## ✔️ Checks

```bash
npm run lint                # frontend + backend
npm run build:backend       # prisma generate + nest build
npm run build:frontend      # next build (desde apps/frontend)
npm run test                # jest (configurado; sin tests por ahora)
```

---

## 📄 Licencia

MIT. Respeta las políticas de Meta y los términos de uso de las APIs.