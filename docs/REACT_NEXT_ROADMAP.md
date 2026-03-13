# React/Next Migration Roadmap

## Scope and constraints
- Текущий проект не требует экстремального highload (не 100M заявок/час).
- Приоритет: поддерживаемость, SEO, скорость разработки, предсказуемый деплой.
- Миграция должна идти поэтапно без остановки текущих заявок.

## Target architecture (pragmatic)
- Frontend: Next.js (App Router), SSG/SSR where relevant.
- Backend API: текущий Node/Express сервис остается отдельным сервисом на первом этапе.
- Admin UI: перенос в React (Vite или Next sub-app) после стабилизации публичного сайта.
- Data: SQLite на старте, с возможностью перехода на Postgres при росте нагрузки.

## Phase 0: Foundation (done/ongoing)
- Модульный backend
- OpenAPI
- Миграции и бэкапы
- CI и минимальная security baseline

## Phase 1: Public site migration
- Создать Next.js приложение в отдельной папке (`apps/web`)
- Перенести публичные страницы и формы заявок
- Подключить SEO мета-теги, sitemap, robots
- Использовать ISR/SSG для стабильных страниц

Acceptance criteria:
- Lighthouse SEO >= 90 на ключевых страницах
- Все формы отправляют заявки в текущий API
- URL и контент совпадают с текущим сайтом

## Phase 2: Admin migration
- Перенести `admin/` в React-приложение (`apps/admin`)
- Типизировать API-клиент по OpenAPI
- Внедрить единый UI-kit и role guards

Acceptance criteria:
- Полный parity с текущей админкой (лиды, статусы, пользователи, аудит, контент)
- Нет регрессий в правах доступа

## Phase 3: Backend hardening
- Внедрить structured config per env
- Добавить centralized error monitoring
- Расширить тесты: integration + smoke
- Оценить необходимость миграции с SQLite на Postgres

Acceptance criteria:
- Автотесты покрывают критический путь создания и обработки заявки
- Наблюдаемость позволяет диагностировать инциденты без ручного дебага БД

## Phase 4: Decommission legacy static
- Удалить старый статический сайт после стабилизации Next.js
- Обновить документацию, runbooks, onboarding

Acceptance criteria:
- В проде работает только новая фронтенд-версия
- Команда использует единый pipeline сборки и деплоя

## Risks and mitigations
- Риск: расхождение контрактов API и фронтенда
  - Митигировать через OpenAPI и контрактные тесты
- Риск: простой при миграции форм
  - Митигировать через параллельный запуск и feature flags
- Риск: усложнение для небольшой команды
  - Митигировать через минималистичный стек и этапность
