# Migration Checklist (Preparation Before Tech Switch)

## Goal
Подготовить текущий проект (без смены стека) к безопасной миграции на React/Next и более строгим практикам разработки.

## Stage 1: Cleanup and boundaries
- [x] Удалены legacy-артефакты Python-бота
- [x] Настроен `.gitignore` для runtime-файлов и секретов
- [x] Разделены публичные и админ-маршруты
- [x] Вынесены переменные окружения в `.env`/`.env.example`

## Stage 2: Modularization and baseline quality
- [x] Разбит монолит `bot.js` на `src/*` модули
- [x] Добавлены базовые тесты (`node:test`)
- [x] Введен унифицированный формат ошибок API
- [x] Подготовлена структура документации по API

## Stage 3: Operational readiness (current)
- [x] OpenAPI-контракт: `telegram-bot/docs/openapi.yaml`
- [x] SQL-миграции: `telegram-bot/db/migrations/*`
- [x] Скрипт применения миграций: `npm run db:migrate`
- [x] Скрипт бэкапа БД: `npm run db:backup`
- [x] ESLint + Prettier + EditorConfig
- [x] Security middleware: `helmet`, rate-limit
- [x] Dockerfile + `docker-compose.yml`
- [x] CI workflow (`.github/workflows/ci.yml`)

## Before migration (still recommended)
- [ ] Добавить smoke e2e тесты ключевых сценариев (site lead -> admin)
- [ ] Добавить health checks и alerts для production-хостинга
- [ ] Подготовить environment matrix (dev/stage/prod)
- [ ] Финализировать schema/version policy для БД

## Commit strategy (recommended)
1. `docs(project): expand architecture and migration readiness`
2. `chore(bot): add migrations and backup scripts`
3. `chore(bot): add lint/format standards`
4. `feat(api): harden security middleware and rate limits`
5. `chore(devops): add docker and ci workflow`
6. `docs(roadmap): add react-next migration phases`
