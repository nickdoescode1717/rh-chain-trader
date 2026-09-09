FROM node:20-alpine AS base
RUN corepack enable && corepack prepare pnpm@9.15.0 --activate
WORKDIR /app

COPY package.json pnpm-workspace.yaml tsconfig.base.json ./
COPY packages/core/package.json packages/core/
COPY packages/db/package.json packages/db/
COPY apps/api/package.json apps/api/

RUN pnpm install --filter @rh/api... --frozen-lockfile=false

COPY packages/core packages/core
COPY packages/db packages/db
COPY apps/api apps/api

RUN pnpm --filter @rh/core build && pnpm --filter @rh/db build && pnpm --filter @rh/api build

WORKDIR /app/apps/api
ENV API_PORT=3001
EXPOSE 3001
CMD ["node", "dist/index.js"]
