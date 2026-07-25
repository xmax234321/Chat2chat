# Chat2Chat

Приватный мессенджер: сервер не хранит переписку, E2E-шифрование, телефон — источник истины.

## Стек

| Компонент | Технологии |
|-----------|------------|
| **Мобильный** | React Native + Expo, libsignal-client, SQLCipher, Keychain |
| **Десктоп** | Tauri 2 + React, те же shared-пакеты |
| **Сервер** | Node.js, Fastify, WebSocket, Redis (prod) |
| **Общее** | TypeScript monorepo, `@noble/curves`, `@scure/bip39`, `@signalapp/libsignal-client` |

Подробнее: [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)

## Быстрый старт

```bash
pnpm install
pnpm build
pnpm dev:server   # relay-сервер :3847
pnpm dev:web      # UI в браузере :5173 (проксирует /api, /blob, /ws)
pnpm dev:desktop  # нативное macOS-приложение (Electron)
pnpm build:desktop # собрать Chat2Chat.app
pnpm demo         # демо: два клиента, отправка сообщения
```

### API relay-сервера

| Метод | Путь | Описание |
|-------|------|----------|
| `GET` | `/api/v1` | Информация об API |
| `GET` | `/api/v1/health` | Health check |
| `GET` | `/api/v1/stats` | Статистика очереди и подключений |
| `PUT` | `/api/v1/blob/:blobId` | Загрузка зашифрованного blob |
| `GET` | `/api/v1/blob/:blobId` | Скачивание blob |
| `WS` | `/ws` | WebSocket relay (сообщения) |

Legacy: `/health`, `/blob/*` — те же эндпоинты без префикса.

### Docker (локально)

```bash
cp .env.example .env
pnpm docker:up          # только relay на :3847
pnpm docker:full        # relay + web (nginx)
```

### REG.RU Cloud (production)

Пошаговая инструкция: **[docs/DEPLOY_REGRU.md](docs/DEPLOY_REGRU.md)**

Кратко: VPS с шаблоном Docker → DNS A-запись → `deploy/regru/.env` → `./deploy.sh full`

## Структура

```
apps/server      — zero-storage relay
apps/web         — веб-UI (React, по макету Claude)
apps/demo        — CLI-демонстрация
apps/mobile      — React Native (каркас)
apps/desktop     — macOS-приложение (Electron + React UI)
packages/crypto  — identity, seed, шифрование
packages/storage — зашифрованная локальная БД
packages/protocol — wire-формат
packages/transport — WebSocket-клиент
```

## Принципы

- Seed-фраза восстанавливает **только identity**, не историю
- Сообщения на сервере живут до ACK получателя
- Собственные криптопримитивы не пишем — только аудированные библиотеки

## Лицензия

Private / TBD
