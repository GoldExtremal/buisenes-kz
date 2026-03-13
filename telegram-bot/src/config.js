require("dotenv").config();
const path = require("path");
const { normalizeUsername } = require("./utils");

const config = {
  token: (process.env.TOKEN || "").trim(),
  dbPath: (process.env.DB_PATH || "bot.db").trim(),
  managerUsername: normalizeUsername(process.env.MANAGER_USERNAME || ""),
  port: Number(process.env.PORT || 3001),
  webAllowedOrigin: (process.env.WEB_ALLOWED_ORIGIN || "*").trim(),
  adminUsername: (process.env.ADMIN_USERNAME || "admin").trim(),
  adminPassword: (process.env.ADMIN_PASSWORD || "Admin12345!").trim(),
  sessionTtlHours: Number(process.env.SESSION_TTL_HOURS || 168),
  dbFile: path.resolve(__dirname, "..", (process.env.DB_PATH || "bot.db").trim()),
  adminDir: path.resolve(__dirname, "..", "admin"),
};

if (!config.token) {
  throw new Error("TOKEN не найден. Укажите TOKEN в .env");
}

module.exports = { config };
