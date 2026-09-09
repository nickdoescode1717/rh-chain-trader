FROM node:20-alpine
WORKDIR /app

# Standalone paper Telegram AFK worker — no DB/keys; talks to API only.
# Layout so tsconfig extends ../tsconfig.base.json resolves.
COPY tsconfig.base.json ./tsconfig.base.json
COPY workers/telegram/package.json workers/telegram/tsconfig.json ./workers/telegram/

WORKDIR /app/workers/telegram
RUN sed -i 's|../../tsconfig.base.json|../tsconfig.base.json|' tsconfig.json \
 && npm install \
 && npm install -D typescript@5.7.2 @types/node@22.10.0

COPY workers/telegram/src ./src
RUN npx tsc -p tsconfig.json

ENV ENABLE_TRADING=false
ENV ENABLE_TX_SUBMISSION=false
ENV TELEGRAM_DRY_RUN=true
ENV API_BASE_URL=http://api:3001

CMD ["node", "dist/index.js"]
