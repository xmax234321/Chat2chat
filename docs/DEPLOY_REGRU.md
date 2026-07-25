# Деплой Chat2Chat на REG.RU Cloud

Инструкция для [Рег.облако](https://reg.cloud) — облачный VPS с шаблоном **Docker**.

## 1. Создать сервер

1. [reg.cloud](https://reg.cloud) → **Облачные серверы** → **Создать**
2. ОС: **Ubuntu 22.04** или **24.04**
3. Шаблон: **Docker** (автоустановка)
4. Минимум: **1 vCPU, 1 GB RAM, 10 GB SSD** (для relay-only достаточно)
5. Запишите **публичный IP**

## 2. DNS

В панели REG.RU (или где куплен домен):

| Тип | Имя | Значение |
|-----|-----|----------|
| A | `relay` | IP вашего VPS |

Пример: `relay.example.ru` → `185.x.x.x`

## 3. Firewall

В панели REG.RU откройте порты:

- **22** — SSH
- **80** — HTTP (Let's Encrypt)
- **443** — HTTPS

Порт **3847** наружу не нужен — Caddy проксирует внутри Docker.

## 4. Подключиться по SSH

```bash
ssh root@185.x.x.x
```

Рекомендуется добавить SSH-ключ в панели REG.RU при создании сервера.

## 5. Загрузить проект

**Вариант A — git (если репозиторий на GitHub/GitLab):**

```bash
export REPO_URL=git@github.com:ВАШ_АККАУНТ/chat2chat.git
export APP_DIR=/opt/chat2chat
git clone "$REPO_URL" "$APP_DIR"
cd "$APP_DIR/deploy/regru"
cp .env.example .env
nano .env   # DOMAIN, ACME_EMAIL
```

**Вариант B — с вашего компьютера (rsync):**

```bash
rsync -avz --exclude node_modules --exclude .git \
  "./Chat2chat extreme/" root@185.x.x.x:/opt/chat2chat/
ssh root@185.x.x.x
cd /opt/chat2chat/deploy/regru
cp .env.example .env && nano .env
```

### Пример `.env`

```env
DOMAIN=relay.example.ru
ACME_EMAIL=you@example.ru
CORS_ORIGIN=https://relay.example.ru
VITE_CHAT2CHAT_SERVER=wss://relay.example.ru/ws
VITE_CHAT2CHAT_HTTP=https://relay.example.ru
```

## 6. Запуск

**Полный стек** (relay + веб-UI + HTTPS):

```bash
chmod +x deploy.sh bootstrap.sh
./deploy.sh full
```

**Только API relay** (без веб-интерфейса, дешевле):

```bash
./deploy.sh relay
```

Первый запуск займёт 3–5 минут (сборка Docker-образов).

## 7. Проверка

```bash
curl https://relay.example.ru/api/v1/health
curl https://relay.example.ru/api/v1/stats
```

Ожидаемый ответ health:

```json
{"status":"ok","queuedMessages":0,...}
```

WebSocket: `wss://relay.example.ru/ws`

## 8. Подключить клиент

В веб-приложении или `.env` клиента:

```env
VITE_CHAT2CHAT_SERVER=wss://relay.example.ru/ws
VITE_CHAT2CHAT_HTTP=https://relay.example.ru
```

Если UI собран с другого домена — укажите его в `CORS_ORIGIN`.

## 9. Обновление

```bash
cd /opt/chat2chat
git pull
cd deploy/regru
./deploy.sh full
```

## API на production

| URL | Описание |
|-----|----------|
| `GET https://DOMAIN/api/v1` | Инфо |
| `GET https://DOMAIN/api/v1/health` | Health |
| `GET https://DOMAIN/api/v1/stats` | Статистика |
| `PUT/GET https://DOMAIN/blob/:id` | Медиа |
| `wss://DOMAIN/ws` | Сообщения |

## Troubleshooting

**Сертификат не выдаётся** — проверьте A-запись DNS и что порты 80/443 открыты.

**502 Bad Gateway** — `docker compose -f docker-compose.prod.yml logs relay`

**CORS ошибка в браузере** — добавьте домен UI в `CORS_ORIGIN` в `.env` и перезапустите relay.

**Мало RAM при сборке** — используйте `./deploy.sh relay` или увеличьте VPS до 2 GB.
