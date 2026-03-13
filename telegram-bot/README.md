# Business KZ: Bot + Admin + API

Сервис включает:
- Telegram-бот для клиентов
- HTTP API для заявок с сайта
- Админку для менеджеров (`/admin`) с канбан-доской

## Возможности админки
- Канбан по заявкам: `new`, `in_progress`, `waiting`, `done`
- Редактирование данных заявки (имя, телефон, услуга, комментарий, срок, ответственный)
- Редактирование контента сайта (hero, контакты, WhatsApp)
- Управление пользователями и ролями (`manager`, `superadmin`)
- Аудит действий (для `superadmin`)

## Запуск
```bash
cd /c/Users/GoldExtremal/.vscode/projects/buisenes-kz/telegram-bot
npm install
npm run start
```

После запуска доступны:
- API health: `http://localhost:3001/health`
- Публичный контент сайта: `http://localhost:3001/api/public/site-content`
- Админка: `http://localhost:3001/admin`

## Первичный вход в админку
Берется из `.env`:
- `ADMIN_USERNAME`
- `ADMIN_PASSWORD`

После входа рекомендуется сменить пароль через раздел пользователей.

## Важные API
- `POST /api/site-lead` — заявка с сайта
- `POST /admin/api/auth/login` — вход
- `GET /admin/api/leads` — список заявок
- `PATCH /admin/api/leads/:id` — обновление заявки
- `GET/POST/PATCH /admin/api/users` — управление пользователями
- `GET/PUT /admin/api/site-content` — контент сайта
- `GET /admin/api/activity` — журнал действий

## .env
- `TOKEN` - Telegram bot token
- `DB_PATH` - SQLite файл
- `MANAGER_USERNAME` - кто может выполнить `/bind_manager`
- `PORT` - порт API (по умолчанию `3001`)
- `WEB_ALLOWED_ORIGIN` - CORS origin
- `ADMIN_USERNAME` - логин первого супер-админа
- `ADMIN_PASSWORD` - пароль первого супер-админа

## Как включить Telegram-уведомления менеджеру
1. Запустите сервис
2. Напишите боту своим аккаунтом (`MANAGER_USERNAME`)
3. Выполните `/bind_manager`
4. Новые заявки с сайта и бота будут приходить в Telegram менеджеру
