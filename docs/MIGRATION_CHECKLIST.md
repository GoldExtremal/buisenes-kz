# Migration Checklist (No Tech Change Yet)

## Goal
Prepare codebase for React/structured migration without breaking current production behavior.

## Completed
- [x] Remove Python legacy bot artifacts
- [x] Add repository-level ignore rules
- [x] Isolate runtime secrets and DB files from git
- [x] Keep admin panel and API behind clear route prefixes

## Pending (safe incremental)
- [x] Split `telegram-bot/bot.js` into domain modules
- [ ] Add API contract docs per endpoint
- [x] Add lightweight tests for lead creation and auth
- [x] Add structured error response shape
- [ ] Add DB migration scripts folder

## Commit Strategy
1. `chore(repo): clean legacy artifacts and ignore runtime files`
2. `chore(docs): add migration preparation and environment templates`
3. `refactor(bot): split monolith bot.js into modules` (next iteration)
