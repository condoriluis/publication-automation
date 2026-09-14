# -----------------------------------------------
# Dockerfile — API + Worker (backend NestJS + BullMQ)
# Multi-etapa: compila en node:20-alpine, ejecuta sin devDeps.
# -----------------------------------------------

# ---- Etapa 1: instalar dependencias ----
FROM node:20-alpine AS deps
WORKDIR /workspace
# Copia solo los manifests para cachear capas de npm
COPY package.json ./
COPY apps/backend/package.json ./apps/backend/
COPY apps/backend/tsconfig*.json ./apps/backend/
COPY apps/backend/nest-cli.json ./apps/backend/
RUN npm install --legacy-peer-deps --no-audit --no-fund || \
    (echo "npm install del monorepo falló; reintentando workspace" && \
     cd apps/backend && npm install --legacy-peer-deps --no-audit --no-fund)

# ---- Etapa 2: compilar ----
FROM node:20-alpine AS build
WORKDIR /workspace
ENV NODE_ENV=production
COPY --from=deps /workspace/node_modules ./node_modules
COPY . .
# Prisma: genera cliente + retoza migraciones y compila
RUN cd apps/backend \
    && npx prisma generate \
    && npx prisma migrate deploy || true \
    && npx nest build

# ---- Etapa 3: runtime ----
FROM node:20-alpine AS runtime
WORKDIR /workspace
ENV NODE_ENV=production PORT=3001
RUN mkdir -p /workspace/logs

COPY --from=build /workspace/apps/backend/dist ./apps/backend/dist
COPY --from=build /workspace/apps/backend/prisma ./apps/backend/prisma
COPY --from=build /workspace/apps/backend/package.json ./apps/backend/package.json
COPY --from=build /workspace/node_modules ./node_modules

EXPOSE 3001
# Comando por defecto: API. El worker se arranca con: node dist/worker.js
CMD ["node", "apps/backend/dist/main.js"]
