# Chat2Chat Relay Server
FROM node:22-alpine AS base
RUN corepack enable && corepack prepare pnpm@9.15.0 --activate
WORKDIR /app

FROM base AS deps
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml tsconfig.base.json ./
COPY apps/server/package.json ./apps/server/
COPY packages/protocol/package.json ./packages/protocol/
COPY packages/crypto/package.json ./packages/crypto/
RUN pnpm install --frozen-lockfile --filter @chat2chat/server... --ignore-scripts

FROM base AS build
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/apps/server/node_modules ./apps/server/node_modules
COPY --from=deps /app/packages/protocol/node_modules ./packages/protocol/node_modules
COPY --from=deps /app/packages/crypto/node_modules ./packages/crypto/node_modules
COPY package.json pnpm-workspace.yaml tsconfig.base.json ./
COPY packages/protocol ./packages/protocol
COPY packages/crypto ./packages/crypto
COPY apps/server ./apps/server
RUN pnpm --filter @chat2chat/protocol build && pnpm --filter @chat2chat/crypto build && pnpm --filter @chat2chat/server build
RUN pnpm deploy --filter @chat2chat/server --prod /out --config.ignore-scripts=true

FROM node:22-alpine AS runner
RUN apk add --no-cache wget
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3847
ENV HOST=0.0.0.0
COPY --from=build /out/ ./
EXPOSE 3847
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget -qO- http://localhost:3847/api/v1/health || exit 1
CMD ["node", "dist/index.js"]
