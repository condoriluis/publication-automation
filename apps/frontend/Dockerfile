# -----------------------------------------------
# Dockerfile — Frontend Next.js 15 (standalone)
# -----------------------------------------------
FROM node:20-alpine AS deps
WORKDIR /workspace
COPY package.json package-lock.json* ./
COPY apps/frontend/package.json ./apps/frontend/
RUN npm install --legacy-peer-deps --no-audit --no-fund

FROM node:20-alpine AS build
WORKDIR /workspace
ENV NEXT_TELEMETRY_DISABLED=1
COPY --from=deps /workspace/node_modules ./node_modules
COPY apps/frontend ./apps/frontend
WORKDIR /workspace/apps/frontend
# genera next-env + componentes de require en build-time
RUN npx next build

FROM node:20-alpine AS runtime
WORKDIR /workspace/apps/frontend
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 PORT=3000
COPY --from=build /workspace/apps/frontend/.next/standalone ./
COPY --from=build /workspace/apps/frontend/.next/static ./.next/static
COPY --from=build /workspace/apps/frontend/public ./public
EXPOSE 3000
CMD ["node", "server.js"]
