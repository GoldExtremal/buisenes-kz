const TelegramBot = require("node-telegram-bot-api");
const { config } = require("./config");
const { LEAD_STATUSES, SITE_CONTENT_DEFAULTS } = require("./constants");
const { createStore } = require("./store");
const { createApiServer } = require("./api");
const { createTelegramHandlers } = require("./telegram");
const { escapeHtml } = require("./utils");

async function bootstrap() {
  const bot = new TelegramBot(config.token, { polling: true });

  const store = createStore({
    dbFile: config.dbFile,
    adminUsername: config.adminUsername,
    adminPassword: config.adminPassword,
    sessionTtlHours: config.sessionTtlHours,
    siteContentDefaults: SITE_CONTENT_DEFAULTS,
  });

  await store.initDb();

  const runtime = {
    userStates: new Map(),
    userSources: new Map(),
    managerChatId: await store.getSetting("manager_chat_id"),
  };

  async function notifyManager({ payload, leadMeta, title = "Новая заявка" }) {
    if (!runtime.managerChatId) return;

    const usernameText = payload.username ? `@${payload.username}` : "не указан";
    const commentText = payload.comment || "без комментария";

    const text = [
      `<b>${title}</b>`,
      `ID: <b>${leadMeta.id}</b>`,
      `Дата: <b>${leadMeta.createdAt}</b>`,
      `Имя: <b>${escapeHtml(payload.name)}</b>`,
      `Телефон: <b>${escapeHtml(payload.phone)}</b>`,
      `Услуга: <b>${escapeHtml(payload.service || "не указана")}</b>`,
      `Срок: <b>${escapeHtml(payload.timing || "не указан")}</b>`,
      `Комментарий: <b>${escapeHtml(commentText)}</b>`,
      `Источник: <b>${escapeHtml(payload.source || "Прямой вход")}</b>`,
      `Канал: <b>${escapeHtml(payload.channel || "unknown")}</b>`,
      `Telegram: <b>${escapeHtml(usernameText)}</b>`,
      `User ID: <b>${payload.user_id || 0}</b>`,
    ].join("\n");

    try {
      await bot.sendMessage(Number(runtime.managerChatId), text, { parse_mode: "HTML" });
    } catch (err) {
      console.error("Failed to notify manager:", err.message);
    }
  }

  const telegramHandlers = createTelegramHandlers({
    bot,
    store,
    config,
    runtime,
    notifyManager,
  });

  telegramHandlers.register();

  createApiServer({
    config,
    store,
    getSourceLabel: telegramHandlers.getSourceLabel,
    notifyManager,
    getManagerChatId: () => runtime.managerChatId,
  });

  console.log(`Bot started (JS). DB: ${config.dbFile}`);
  console.log(`Admin available at http://localhost:${config.port}/admin`);
  console.log(`Lead statuses: ${LEAD_STATUSES.join(", ")}`);
}

module.exports = { bootstrap };
