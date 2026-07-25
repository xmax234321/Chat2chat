# Chat2Chat через AltStore (без платного Apple Developer)

AltStore ставит приложение через **бесплатный Apple ID**. Приложение работает **7 дней**, потом нужно обновить (iPhone и Mac в одной Wi‑Fi, AltServer включён).

## Шаг 1 — Mac

1. Скачай **AltServer**: https://altstore.io  
2. Установи, запусти (иконка в меню macOS сверху).  
3. Войди в AltServer своим **Apple ID** (бесплатным).

## Шаг 2 — iPhone

1. iPhone и Mac в **одной Wi‑Fi**.  
2. В AltServer: **Install AltStore → [твой iPhone]**.  
3. На iPhone: **Настройки → Основные → VPN и управление устройством** → доверь разработчику.  
4. Открой приложение **AltStore** на iPhone.

## Шаг 3 — Собрать Chat2Chat

```bash
# из корня репозитория
pnpm ios:altstore
```

Файлы появятся в `apps/mobile/altstore/dist/`:
- `Chat2Chat-public-build-1.ipa`
- `source.json` — для источника AltStore
- `icon.png`
- `install-link.txt` — ссылка `altstore://install?...`

## Вариант A — только себе (без сервера)

1. **AirDrop** файл `Chat2Chat-public-build-1.ipa` на iPhone.  
2. **Поделиться → Открыть в AltStore** (или «Open in AltStore»).  
3. Войди Apple ID, если спросит.  
4. Chat2Chat появится в **My Apps**.

## Вариант B — раздать друзьям (нужен HTTPS)

1. Залей на сервер (например `https://api.chat2chat.org/altstore/`):
   - `Chat2Chat-public-build-1.ipa`
   - `source.json`
   - `icon.png`
2. На iPhone в AltStore: **Browse → +** → вставь URL:
   ```
   https://api.chat2chat.org/altstore/source.json
   ```
3. Установи **Chat2Chat** из источника.

Или отправь ссылку из `install-link.txt` (открывать **на iPhone** в Safari).

Перед заливкой можно сменить базовый URL:

```bash
ALTSTORE_BASE_URL=https://твой-домен/altstore pnpm ios:altstore
```

## Обновление каждые 7 дней

1. Mac с **AltServer** включён, тот же Wi‑Fi.  
2. AltStore → **My Apps → Chat2Chat → Refresh** (или Refresh All).

Без Mac приложение перестанет открываться после истечения подписи.

## Лимиты бесплатного Apple ID

- До **3** приложений через AltStore одновременно.  
- Подпись **7 дней**.  
- Только **iOS 14+**.

## Если не ставится

- Проверь Wi‑Fi и AltServer на Mac.  
- Удали старую Chat2Chat и поставь заново.  
- В AltStore: **Settings → Sign in** снова с Apple ID.  
- Собери свежий IPA: `pnpm ios:altstore`.
