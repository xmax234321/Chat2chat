# Chat2Chat Web UI

Веб-клиент по макету `Chat2Chat UI.html` — тёмный mobile-first интерфейс в рамке телефона.

## Экраны

- **Onboarding:** Welcome → Identity → Seed → Confirm → Email
- **Messaging:** Chats → Conversation (текст, фото, видео)
- **Contacts:** Add (QR / ID) → Verify safety number
- **Settings:** Account, backup, devices
- **Desktop:** QR-link, phone offline state

## Запуск

```bash
# Терминал 1 — relay
pnpm dev:server

# Терминал 2 — UI
pnpm dev:web
```

Открой http://localhost:5173

## Стек

- React 19 + React Router + Vite
- `@chat2chat/crypto/browser` — identity, шифрование медиа
- `@chat2chat/protocol` — wire-формат
- Browser WebSocket transport + HTTP blob upload

## Дизайн

- Фон `#0B0B0C`, акцент `#F4F4F3`
- Шрифты: Hanken Grotesk, JetBrains Mono
- Phone shell 390×844 (на мобильном — fullscreen)
