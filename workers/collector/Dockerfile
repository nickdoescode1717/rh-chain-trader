FROM node:20-alpine AS base
RUN corepack enable && corepack prepare pnpm@9.15.0 --activate
WORKDIR /app

COPY package.json pnpm-workspace.yaml tsconfig.base.json ./
COPY packages/core/package.json packages/core/
COPY workers/collector/package.json workers/collector/

RUN pnpm install --filter @rh/collector... --frozen-lockfile=false

COPY packages/core packages/core
COPY workers/collector workers/collector

RUN pnpm --filter @rh/core build && pnpm --filter @rh/collector build

WORKDIR /app/workers/collector
CMD ["node", "dist/index.js"]
