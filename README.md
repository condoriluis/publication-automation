# Publication Automation 🚀

Plataforma **full-stack** para la **gestión y automatización de publicaciones e interacciones** de páginas de Facebook usando exclusivamente la **API oficial de Meta** (Graph API + OAuth + Webhooks), con capas de IA configurable, una **cola de trabajo propia sobre PostgreSQL** (claims atómicos con leases, sin Redis), auditoría total y una API preparada para producción.

> ⚠️ **Advertencia de política**: esta herramienta **NO** evade ni elude límites, restricciones o sistemas anti-spam de Meta, ni fabrica interacción falsa. Todo se hace con el token del usuario final y los permisos reales que Meta otorga. Respetar la política de la plataforma es requisito de uso.

---

## 🧱 Stack

| Capa | Tecnología |
|---|---|
| API | NestJS 11 + TypeScript estricto |
| ORM | Prisma 6 (PostgreSQL) |
| Scheduler | @nestjs/schedule (intervalos) |
| Colas | Cola propia en PostgreSQL: scheduler + worker con claims atómicos y leases (sin BullMQ/Redis) |
| DB | PostgreSQL 16 |
| Validación | class-validator + Joi (env) + Zod (payloads IA) |
| Seguridad | Helmet, CORS estricto, throttling, AES-256-GCM (tokens cifrados), bcrypt |
| IA | OpenAI / Anthropic / Groq / Google / OpenRouter (configurable) |
| Frontend | Next.js 15 App Router + React 19 + Tailwind + shadcn/ui + Sonner |

---

## 📁 Estructura

```
publication-automation/
├── docker-compose.yml        # postgres + api + worker + scheduler
├── .env.example
├── apps/
│   ├── backend/             # NestJS API (src/...)
│   │   ├── prisma/schema.prisma
│   │   ├── prisma/seed.ts
│   │   └── src/main.ts
│   └── frontend/            # Next.js 15 (App Router)
└── (monorepo)  workspaces: apps/*
```

Backend (módulos → `apps/backend/src/modules/`): `auth`, `users`, `pages`, `facebook` (OAuth + Graph), `campaigns`, `posts`, `comments`, `ai`, `dashboard`, `audit`, `webhooks`, `health`, `users`.
Orquestación en `src/workers/`: `campaign-executor` (ejecución), `campaign-scheduler` (activación/cierre de campañas), `campaign-worker` (SQL de fondo).

---

## 🚀 Desarrollo rápido

Requisitos: **Docker Desktop** con Compose v2, Node 20+.

1. Copia `apps/backend/.env.example` → `apps/backend/.env` y rellena al menos `FACEBOOK_APP_ID/SECRET`, `DATABASE_URL`, `JWT_SECRET`, `META_*`.
   > `DATABASE_URL`/`DIRECT_URL` apuntan al Postgres; en local, al contenedor `pa-postgres` (`localhost:5433`).
2. Levantar infraestructura:
   ```bash
   docker compose up -d postgres
   ```
3. Backend (con hot-reload):
   ```bash
   npm run dev:backend
   ```
   > En desarrollo la API responde en `http://localhost:3001/api/v1`. Docs Swagger en `/api/docs`.

4. Migraciones + seed:
   ```bash
   npm run db:migrate && npm run db:seed
   ```

### Todo con Docker (producción-like)

```bash
docker compose up --build -d
docker compose ps
```

Servicios: `postgres` (5433), `api` (3001), `worker` (SQL de fondo), `scheduler` (intervalos). La API expone `/health`.
Los tres procesos de la app compiten por claims atómicos en PostgreSQL (multiréplica sin duplicados).

---

## 🔐 Variables de entorno clave (ver `.env.example`)

| Variable | Descripción |
|---|---|
| `DATABASE_URL` / `DIRECT_URL` | DSN PostgreSQL (pooler + directo para migraciones) |
| `WORKER_CONCURRENCY` | Publicaciones simultáneas del worker |
| `WORKER_LEASE_MS` / `WORKER_MAX_ATTEMPTS` / `WORKER_RETRY_BACKOFF_MS` | Lease de claims, intentos máx. y backoff ante fallos transitorios |
| `JWT_SECRET` / `REFRESH_TOKEN_SECRET` | ≥32 chars, firmas JWT |
| `FACEBOOK_APP_ID/SECRET` | App de Meta (developers.facebook.com) |
| `META_OAUTH_REDIRECT_URI` | Debe estar registrada en la app |
| `META_WEBHOOK_VERIFY_TOKEN` | Verificación webhook |
| `TOKEN_ENCRYPTION_KEY` | **AES-256-GCM** para tokens en reposo (¡cámbialo!) |
| `AI_*` | Proveedor/modelo/API key para generación |
| `THROTTLE_*`, `CORS_ORIGINS` | Protección y CORS |

---

## 🔌 Conexión con Facebook (Meta)

1. En `login` → botón "Conectar con Facebook" → OAuth de Meta (App ID/SECRET + scopes `pages_show_list, pages_manage_posts, pages_read_engagement, ...`).
2. Callback intercambia el código por `access_token` vía Graph API, **se cifra con `TOKEN_ENCRYPTION_KEY`** (AES-256-GCM) y se guarda.
3. `/facebook/accounts`, `/pages` (sync páginas), `/campaigns`, `/posts`, `/comments` gestionan el flujo.
4. Webhooks `/webhooks` reciben comentarios/insights de Meta; la IA propone (¡nunca auto-publica sin aprobación!).

---

## 🧪 Tests

```bash
cd apps/backend && npm test
```

No hay datos falsos: los mocks sustituyen exclusivamente llamadas de red; las entidades vienen de Prisma real.

---

## 🧠 IA

- `AiModule` de `src/modules/ai/ai.module.ts` → `AiService` con proveedor configurable (OpenAI/Anthropic/Groq/OpenRouter/Google).
- Métodos: generar contenido de post, respuestas de comentarios, análisis/riesgo de comentarios, moderación sugerida.
- **La IA nunca ejecuta acciones por sí sola**: siempre devuelve una propuesta que el usuario aprueba.

---

## 📄 Licencia

MIT. Por favor, respeta las políticas de Meta y los términos de uso de las APIs.
