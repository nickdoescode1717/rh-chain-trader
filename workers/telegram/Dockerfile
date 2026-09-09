FROM node:20-alpine
WORKDIR /app

# Standalone paper Telegram AFK worker — no DB/keys; talks to API only.
# Self-contained tsconfig (no extends / no sed) so Alpine builds are reliable.
COPY workers/telegram/package.json ./
RUN npm install \
 && npm install -D typescript@5.7.2 @types/node@22.10.0

COPY workers/telegram/src ./src

RUN printf '%s\n' \
  '{' \
  '  "compilerOptions": {' \
  '    "target": "ES2022",' \
  '    "module": "NodeNext",' \
  '    "moduleResolution": "NodeNext",' \
  '    "lib": ["ES2022"],' \
  '    "strict": true,' \
  '    "esModuleInterop": true,' \
  '    "skipLibCheck": true,' \
  '    "forceConsistentCasingInFileNames": true,' \
  '    "resolveJsonModule": true,' \
  '    "outDir": "./dist",' \
  '    "rootDir": "./src",' \
  '    "declaration": false,' \
  '    "sourceMap": false' \
  '  },' \
  '  "include": ["src/**/*"]' \
  '}' > tsconfig.json \
 && npx tsc -p tsconfig.json

ENV ENABLE_TRADING=false
ENV ENABLE_TX_SUBMISSION=false
ENV TELEGRAM_DRY_RUN=true
ENV API_BASE_URL=http://api:3001

CMD ["node", "dist/index.js"]
