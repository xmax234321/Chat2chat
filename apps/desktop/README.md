# Chat2Chat for macOS

Нативное десктоп-приложение на **Electron**, использует UI из `apps/web`.

## Разработка

```bash
# из корня monorepo
pnpm install
pnpm dev:desktop
```

Откроется окно Chat2Chat с hot-reload (веб на :5173).

## Сборка .app / .dmg

```bash
pnpm build:desktop      # .app + .zip
pnpm --filter @chat2chat/desktop build:app   # только .app
```

Артефакты в `apps/desktop/release/`:

- `mac-arm64/Chat2Chat.app` — запустить двойным кликом
- `Chat2Chat-0.1.0-arm64-mac.zip` — архив для распространения

> При первом запуске macOS может спросить разрешение (приложение не подписано Apple).  
> Системные настройки → Конфиденциальность → «Всё равно открыть».

## Relay-сервер

По умолчанию подключается к `wss://api.chat2chat.org/ws`.

Другой сервер при сборке:

```bash
CHAT2CHAT_SERVER_WS=wss://relay.example.ru/ws \
CHAT2CHAT_SERVER_HTTP=https://relay.example.ru \
pnpm build:desktop
```

## Примечания

- Роутинг в приложении — `HashRouter` (корректная работа из `file://`)
- Интерфейс всегда в режиме **Computer** (боковая панель + чаты)
- Планируется миграция на Tauri 2 для меньшего размера и Bluetooth pairing
