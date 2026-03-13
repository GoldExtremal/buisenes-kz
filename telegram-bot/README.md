# Business KZ: Bot + Admin + API

Сервис включает:
- Telegram-бот для клиентов
- HTTP API для заявок с сайта
- Админку для менеджеров (`/admin`) с канбан-доской

## Структура (этап 2)
- `bot.js` — тонкая точка входа
- `src/config.js` — конфиг окружения
- `src/constants.js` — доменные константы
- `src/utils.js` — общие утилиты
- `src/store.js` — SQLite store + auth/session/audit/content
- `src/telegram.js` — сценарии Telegram-бота
- `src/api.js` — HTTP API и admin routes
- `src/bootstrap.js` — сборка приложения
- `admin/` — frontend админки

## Запуск
```bash
cd /c/Users/GoldExtremal/.vscode/projects/buisenes-kz/telegram-bot
npm install
npm run start
```

## Тесты
```bash
npm test
```

После запуска доступны:
- API health: `http://localhost:3001/health`
- Публичный контент сайта: `http://localhost:3001/api/public/site-content`
- Админка: `http://localhost:3001/admin`

## Первичный вход в админку
Берется из `.env`:
- `ADMIN_USERNAME`
- `ADMIN_PASSWORD`

## .env
- `TOKEN` - Telegram bot token
- `DB_PATH` - SQLite файл
- `MANAGER_USERNAME` - кто может выполнить `/bind_manager`
- `PORT` - порт API (по умолчанию `3001`)
- `WEB_ALLOWED_ORIGIN` - CORS origin
- `ADMIN_USERNAME` - логин первого супер-админа
- `ADMIN_PASSWORD` - пароль первого супер-админа
- `SESSION_TTL_HOURS` - TTL сессии в часах

## Формат ошибок API
Сервер возвращает ошибки в унифицированном виде:
```json
{
  "ok": false,
  "error": {
    "code": "invalid_payload",
    "message": "Invalid payload",
    "requestId": "..."
  }
}
```
