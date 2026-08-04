# Chat2Chat

site: chat2chat.org

Приватный мессенджер: relay не хранит переписку, E2E-шифрование, телефон — источник истины.

Клиенты подключаются к публичному Chat2Chat relay (`https://api.chat2chat.org`). Инструкций по self-host relay в этом репозитории нет.

## Стек

| Компонент | Технологии |
|-----------|------------|
| **Мобильный** | React Native + Capacitor, libsignal-client, SQLCipher, Keychain |
| **Веб / UI** | React + Vite |
| **Десктоп** | Electron + React, те же shared-пакеты |
| **Общее** | TypeScript monorepo, `@noble/curves`, `@scure/bip39`, `@signalapp/libsignal-client` |

Подробнее: [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)

## Быстрый старт

```bash
pnpm install
pnpm build
pnpm dev:web      # UI в браузере :5173 (по умолчанию — production relay)
pnpm dev:desktop  # нативное macOS-приложение
pnpm build:desktop # собрать Chat2Chat.app
pnpm ios          # iOS (Capacitor + Xcode)
pnpm android      # Android (Capacitor + Android Studio)
pnpm demo         # CLI-демо двух клиентов через relay
```

Для локальной разработки против другого relay задайте `VITE_CHAT2CHAT_DEV_RELAY_HTTP` / `VITE_CHAT2CHAT_DEV_RELAY_WS` в `apps/web/.env.development` (см. `apps/mobile/README.md`).

## Структура

```
apps/web         — веб-UI (React)
apps/mobile      — iOS / Android (Capacitor)
apps/desktop     — macOS-приложение (Electron + React UI)
apps/demo        — CLI-демонстрация
apps/website     — маркетинговый сайт (исходники)
packages/crypto  — identity, seed, шифрование
packages/storage — зашифрованная локальная БД
packages/protocol — wire-формат
packages/transport — WebSocket-клиент
deploy/altstore  — манифесты AltStore
scripts/         — иконки, проверки Info.plist
```

## Принципы

- Seed-фраза восстанавливает **только identity**, не историю
- Сообщения на relay живут до ACK получателя
- Собственные криптопримитивы не пишем — только аудированные библиотеки

## Лицензия

Private / TBD
