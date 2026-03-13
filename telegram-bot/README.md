# Business KZ Bot Service

Telegram-��� + API + ������� ��� ��������� ������ Business KZ.

## ��� ������

- Telegram-��� � ��������� ������ ������
- API ��� ������ � �����
- ������� (`/admin`) ��� ����������
- SQLite ���������
- ������� ����� � DevOps-�������

## ���������

- `bot.js` - entrypoint
- `src/` - backend ������
- `admin/` - frontend �������
- `db/migrations/` - SQL ��������
- `docs/openapi.yaml` - �������� API
- `scripts/apply-migrations.js` - ��������
- `scripts/backup-db.js` - backup
- `tests/` - unit tests

## ������� ������ (Git Bash)

```bash
cd /c/Users/GoldExtremal/.vscode/projects/buisenes-kz/telegram-bot
npm install
cp .env.example .env
# ����� TOKEN, MANAGER_USERNAME, ADMIN_PASSWORD
npm run db:migrate
npm run start
```

## �������

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

## �������

����� �������:

- `http://localhost:3001/admin`

��������� �����-����� ��������� �� `.env`:

- `ADMIN_USERNAME`
- `ADMIN_PASSWORD`

## �������� ��������� � Telegram

1. � `.env` ����� `MANAGER_USERNAME` ��� `@`
2. ���� ��������� ������� ���� `/bind_manager`
3. ����� ����� ������ �� �����/���� ����� ��������� � ����������� ���

## ���������� ���������

- `TOKEN` - ����� Telegram-����
- `DB_PATH` - ���� � SQLite (������ `bot.db`)
- `MANAGER_USERNAME` - username ��������� ��� `/bind_manager`
- `PORT` - ���� API (�� ��������� `3001`)
- `WEB_ALLOWED_ORIGIN` - CORS origin
- `ADMIN_USERNAME` - ����� �����-������
- `ADMIN_PASSWORD` - ������ �����-������
- `SESSION_TTL_HOURS` - TTL ������

## ������������

- `helmet` ��� HTTP headers
- rate limit �� ��������� � admin API
- role-based ������ (`manager`, `superadmin`)
- ������ ������ ������ API

## Docker

```bash
cd /c/Users/GoldExtremal/.vscode/projects/buisenes-kz
docker compose up --build
```

## ������������ � ��������

CI workflow (`.github/workflows/ci.yml`) ���������:

- `npm run lint`
- `npm test`
- `npm run format:check`
