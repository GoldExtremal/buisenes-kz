require("dotenv").config();
const path = require("path");
const { normalizeUsername } = require("./utils");

const isProd = process.env.NODE_ENV === "production";
const rawOrigins = (process.env.WEB_ALLOWED_ORIGIN || "").trim();
const webAllowedOrigins = rawOrigins
  ? rawOrigins
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean)
  : ["http://localhost:5173", "http://localhost:3001"];

const config = {
  token: (process.env.TOKEN || "").trim(),
  dbPath: (process.env.DB_PATH || "bot.db").trim(),
  managerUsername: normalizeUsername(process.env.MANAGER_USERNAME || ""),
  port: Number(process.env.PORT || 3001),
  webAllowedOrigins,
  adminUsername: (process.env.ADMIN_USERNAME || "").trim(),
  adminPassword: (process.env.ADMIN_PASSWORD || "").trim(),
  sessionTtlHours: Number(process.env.SESSION_TTL_HOURS || 168),
  authCookieName: (process.env.AUTH_COOKIE_NAME || "bkz_admin_token").trim(),
  authCookieSecure:
    String(process.env.AUTH_COOKIE_SECURE || (isProd ? "true" : "false")).trim() === "true",
  dbFile: path.resolve(__dirname, "..", (process.env.DB_PATH || "bot.db").trim()),
  adminDir: path.resolve(__dirname, "..", "admin"),
};

if (!config.token) {
  throw new Error("TOKEN не найден. Укажите TOKEN в .env");
}

if (!config.adminUsername) {
  throw new Error("ADMIN_USERNAME не найден. Укажите ADMIN_USERNAME в .env");
}

if (!config.adminPassword) {
  throw new Error("ADMIN_PASSWORD не найден. Укажите ADMIN_PASSWORD в .env");
}

if (isProd && config.webAllowedOrigins.includes("*")) {
  throw new Error("WEB_ALLOWED_ORIGIN='*' запрещен в production. Укажите whitelist доменов через запятую.");
}

if (isProd && ["Admin12345!", "change_me", "admin"].includes(config.adminPassword)) {
  throw new Error("Небезопасный ADMIN_PASSWORD для production. Укажите сильный пароль.");
}

module.exports = { config };
