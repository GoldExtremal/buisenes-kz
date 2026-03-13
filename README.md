# Business KZ Project

## Current Layout
- `index.html`, `styles.css`, `script.js`: public marketing website
- `telegram-bot/`: Telegram bot, HTTP API and admin panel

## Runtime Components
- Public website (static files)
- API + Bot service (`telegram-bot/bot.js`)
- Admin panel (`/admin` served by API service)

## Migration-Ready Principles (already prepared)
- Legacy Python bot files removed
- Runtime artifacts excluded from git (`.venv`, `node_modules`, `.env`, `bot.db`)
- Environment split with `.env.example`
- Admin and public surfaces separated by routes (`/admin/*`, `/api/*`, `/api/public/*`)

## Next Migration Target (without immediate tech switch)
- Keep behavior stable while gradually splitting `bot.js` into modules:
  - `src/config`
  - `src/db`
  - `src/api`
  - `src/bot`
  - `src/admin`

This keeps current stack but reduces migration risk.
