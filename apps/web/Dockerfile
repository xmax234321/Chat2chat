FROM node:22-alpine AS build
RUN corepack enable && corepack prepare pnpm@9.15.0 --activate
WORKDIR /app
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml tsconfig.base.json ./
COPY apps/web/package.json ./apps/web/
COPY packages/protocol/package.json ./packages/protocol/
COPY packages/crypto/package.json ./packages/crypto/
RUN pnpm install --frozen-lockfile --filter @chat2chat/web...
COPY packages ./packages
COPY apps/web ./apps/web
ARG VITE_CHAT2CHAT_SERVER=ws://localhost:3847/ws
ARG VITE_CHAT2CHAT_HTTP=http://localhost:3847
ENV VITE_CHAT2CHAT_SERVER=$VITE_CHAT2CHAT_SERVER
ENV VITE_CHAT2CHAT_HTTP=$VITE_CHAT2CHAT_HTTP
RUN pnpm --filter @chat2chat/protocol build && pnpm --filter @chat2chat/crypto build && pnpm --filter @chat2chat/web build

FROM nginx:alpine
COPY apps/web/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/apps/web/dist /usr/share/nginx/html
EXPOSE 80
