FROM node:20-alpine AS base
RUN corepack enable && corepack prepare pnpm@9.15.0 --activate
WORKDIR /app

# Standalone paper Telegram AFK worker — no DB/keys; talks to API only.
COPY workers/telegram/package.json workers/telegram/tsconfig.json ./workers/telegram/
COPY tsconfig.base.json ./

WORKDIR /app/workers/telegram
RUN pnpm install --frozen-lockfile=false

COPY workers/telegram/src ./src
RUN pnpm build

ENV ENABLE_TRADING=false
ENV ENABLE_TX_SUBMISSION=false
ENV TELEGRAM_DRY_RUN=true
ENV API_BASE_URL=http://api:3001

CMD ["node", "dist/index.js"]
