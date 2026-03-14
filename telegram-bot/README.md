# Business KZ Bot Service

Telegram-бот + API + админка для обработки заявок Business KZ.

## Что внутри

- Telegram-бот с пошаговым сбором заявки
- API для заявок с сайта
- Админка (`/admin`) для менеджеров
- SQLite хранилище
- Базовые тесты и DevOps-скрипты

## Структура

- `bot.js` - entrypoint
- `src/` - backend модули
- `admin/` - frontend админки
- `db/migrations/` - SQL миграции
- `docs/openapi.yaml` - контракт API
- `scripts/apply-migrations.js` - миграции
- `scripts/backup-db.js` - backup
- `tests/` - unit tests

## Быстрый запуск (Git Bash)

```bash
cd /c/Users/GoldExtremal/.vscode/projects/buisenes-kz/telegram-bot
npm install
cp .env.example .env
# укажи TOKEN, MANAGER_USERNAME, ADMIN_PASSWORD
npm run db:migrate
npm run start
```

`npm run start` теперь автоматически применяет SQL-миграции при запуске.

## Команды

```bash
npm run start
npm test
npm run lint
npm run lint:fix
npm run format
npm run format:check
npm run db:migrate
npm run db:backup
```

## Админка

После запуска:

- `http://localhost:3001/admin`

Первичный супер-админ создается из `.env`:

- `ADMIN_USERNAME`
- `ADMIN_PASSWORD`

## Привязка менеджера в Telegram

1. В `.env` укажи `MANAGER_USERNAME` без `@`
2. Этим аккаунтом отправь боту `/bind_manager`
3. После этого заявки из сайта/бота будут приходить в привязанный чат

## Переменные окружения

- `TOKEN` - токен Telegram-бота
- `DB_PATH` - путь к SQLite (обычно `bot.db`)
- `MANAGER_USERNAME` - username менеджера для `/bind_manager`
- `PORT` - порт API (по умолчанию `3001`)
- `WEB_ALLOWED_ORIGIN` - CORS origin
- `ADMIN_USERNAME` - логин супер-админа
- `ADMIN_PASSWORD` - пароль супер-админа
- `SESSION_TTL_HOURS` - TTL сессии
- `AUTH_COOKIE_NAME` - имя httpOnly cookie админ-сессии
- `AUTH_COOKIE_SECURE` - secure-флаг cookie (`true` для HTTPS)

## Безопасность

- `helmet` для HTTP headers
- rate limit на публичный и admin API
- role-based доступ (`manager`, `superadmin`)
- единый формат ошибок API
- admin auth поддерживает httpOnly cookie сессии

## Docker

```bash
cd /c/Users/GoldExtremal/.vscode/projects/buisenes-kz
docker compose up --build
```

Dev-режим с bind mounts:

```bash
docker compose -f docker-compose.dev.yml up --build
```

## Тестирование и качество

CI workflow (`.github/workflows/ci.yml`) проверяет:

- `npm run lint`
- `npm test`
- `npm run format:check`
- `apps/web-react: npm run build`
