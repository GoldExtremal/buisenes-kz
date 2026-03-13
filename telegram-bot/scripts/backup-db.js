const fs = require("fs");
const path = require("path");

const dbPath = process.env.DB_PATH || "bot.db";
const source = path.resolve(__dirname, "..", dbPath);
const backupDir = path.resolve(__dirname, "..", "backups");

if (!fs.existsSync(source)) {
  console.error(`db file not found: ${source}`);
  process.exit(1);
}

if (!fs.existsSync(backupDir)) {
  fs.mkdirSync(backupDir, { recursive: true });
}

const stamp = new Date().toISOString().replace(/[:.]/g, "-");
const target = path.join(backupDir, `bot-${stamp}.db`);

fs.copyFileSync(source, target);
console.log(`backup created: ${target}`);
