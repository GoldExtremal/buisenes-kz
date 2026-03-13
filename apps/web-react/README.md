# React Frontend (Phase 1)

React-версия публичного сайта в рамках миграции.

## Запуск

```bash
cd /c/Users/GoldExtremal/.vscode/projects/buisenes-kz/apps/web-react
npm install
cp .env.example .env
npm run dev
```

По умолчанию фронт доступен на `http://localhost:5173`.

## Переменные

- `VITE_API_BASE_URL` - адрес backend API (по умолчанию `http://localhost:3001`)

## Что уже перенесено

- Полная структура страницы и стиль текущего сайта
- Загрузка публичного контента (`/api/public/site-content`)
- Отправка формы заявки (`/api/site-lead`)
- Мобильное меню и reveal-анимации

## Проверка интеграции

1. Запустить `telegram-bot` сервис на `3001`
2. Запустить React фронт
3. Оставить заявку через форму
4. Убедиться, что заявка пришла в админку и в Telegram менеджеру
