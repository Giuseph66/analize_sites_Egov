# syntax=docker/dockerfile:1

# ---------------------------------------------------------------------------
# Imagem base: Node 22 + as bibliotecas nativas exigidas pelo Chromium.
#
# Usamos o Chrome que o proprio Puppeteer baixa, e nao o chromium do Debian:
# o puppeteer 22 fixa uma versao especifica (127) e essa e a combinacao testada
# pelo projeto. Ver docs/research.md, secao 3.3.
# ---------------------------------------------------------------------------
FROM node:22-bookworm-slim AS base

ENV DEBIAN_FRONTEND=noninteractive \
    PUPPETEER_CACHE_DIR=/opt/puppeteer

RUN apt-get update && apt-get install -y --no-install-recommends \
      ca-certificates \
      curl \
      fonts-liberation \
      fonts-noto-color-emoji \
      libasound2 \
      libatk-bridge2.0-0 \
      libatk1.0-0 \
      libcairo2 \
      libcups2 \
      libdbus-1-3 \
      libdrm2 \
      libexpat1 \
      libgbm1 \
      libglib2.0-0 \
      libnspr4 \
      libnss3 \
      libpango-1.0-0 \
      libx11-6 \
      libxcb1 \
      libxcomposite1 \
      libxdamage1 \
      libxext6 \
      libxfixes3 \
      libxkbcommon0 \
      libxrandr2 \
      xdg-utils \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# ---------------------------------------------------------------------------
# Dependencias + build do frontend
# ---------------------------------------------------------------------------
FROM base AS builder

COPY package.json package-lock.json ./
COPY packages/shared-types/package.json packages/shared-types/
COPY packages/logger/package.json packages/logger/
COPY packages/report-normalizer/package.json packages/report-normalizer/
COPY packages/evaluator/package.json packages/evaluator/
COPY apps/api/package.json apps/api/
COPY apps/frontend/package.json apps/frontend/
COPY experiments/qualweb-test/package.json experiments/qualweb-test/

# `npm ci` executa o postinstall do puppeteer, que baixa o Chrome em
# PUPPETEER_CACHE_DIR. E a etapa mais lenta do build.
RUN npm ci

COPY . .

RUN npm run build --workspace=@lae/frontend

# ---------------------------------------------------------------------------
# Runtime
# ---------------------------------------------------------------------------
FROM base AS runtime

ENV NODE_ENV=production \
    RUNNING_IN_DOCKER=true \
    PORT=3000 \
    HOST=0.0.0.0

COPY --from=builder /opt/puppeteer /opt/puppeteer
COPY --from=builder /app /app

# data/ e logs/ sao montados do host; os diretorios precisam existir e ser
# graváveis pelo usuario `node`.
RUN mkdir -p /app/data/raw /app/data/reports /app/data/evaluations /app/logs \
    && chown -R node:node /app/data /app/logs /opt/puppeteer

USER node

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
  CMD curl -fsS http://127.0.0.1:3000/api/health || exit 1

# O backend roda via tsx (sem etapa de compilacao propria). Para um laboratorio
# local isso mantem os stack traces apontando para o TypeScript original.
CMD ["npx", "tsx", "apps/api/src/main.ts"]
