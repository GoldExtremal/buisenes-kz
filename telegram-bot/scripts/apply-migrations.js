const path = require("path");
const { applyMigrations } = require("../src/migrations");

const dbPath = process.env.DB_PATH || "bot.db";
const dbFile = path.resolve(__dirname, "..", dbPath);
const migrationsDir = path.resolve(__dirname, "..", "db", "migrations");

async function main() {
  const result = await applyMigrations({ dbFile, migrationsDir });
  console.log(`migrations complete (applied ${result.applied}/${result.total})`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
