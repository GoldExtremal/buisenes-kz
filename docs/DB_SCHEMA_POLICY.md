# DB Schema Version Policy

## Goals
- Predictable schema changes across dev/stage/prod
- Reproducible deployments
- Safe rollback strategy for small team operations

## Rules
1. Every schema change must be represented by a new SQL file in `telegram-bot/db/migrations/`.
2. File naming format: `NNN_short_description.sql`, where `NNN` is zero-padded and strictly increasing.
3. Migrations must be idempotent (`IF NOT EXISTS`, `ON CONFLICT`, safe `ALTER` patterns).
4. Backward compatibility first:
   - Add new columns/tables before code that depends on them.
   - Remove columns only in a separate later migration after code cleanup.
5. Do not edit already-applied migration files; create a new migration instead.

## Runtime behavior
- `npm run start` applies pending migrations automatically before app bootstrap.
- `npm run db:migrate` can be run explicitly in CI/CD or maintenance windows.
- Applied versions are tracked in `schema_migrations`.

## Rollback approach
- SQLite rollback is file-based in this project.
- Before deployment, run `npm run db:backup`.
- In incident recovery, restore `bot.db` from backup and redeploy previous app version.

## Checklist for each migration
- [ ] Migration runs on clean DB
- [ ] Migration runs on existing production-like DB snapshot
- [ ] App tests pass after migration (`npm test`)
- [ ] Backup taken before production deployment
