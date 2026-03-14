const { Telegraf } = require("telegraf");

function createTelegramBotAdapter(token) {
  const bot = new Telegraf(token);
  const textHandlers = [];
  const messageHandlers = [];

  bot.on("message", async (ctx) => {
    const msg = ctx.message;
    if (!msg) return;

    const text = typeof msg.text === "string" ? msg.text : "";
    for (const { regex, handler } of textHandlers) {
      const match = text.match(regex);
      if (match) {
        await handler(msg, match);
      }
    }

    for (const handler of messageHandlers) {
      await handler(msg);
    }
  });

  return {
    onText(regex, handler) {
      textHandlers.push({ regex, handler });
    },

    on(event, handler) {
      if (event === "message") {
        messageHandlers.push(handler);
      }
    },

    async sendChatAction(chatId, action) {
      return bot.telegram.sendChatAction(chatId, action);
    },

    async sendMessage(chatId, text, options = {}) {
      return bot.telegram.sendMessage(chatId, text, options);
    },

    async launch() {
      await bot.launch();
    },

    async stop(signal = "SIGINT") {
      bot.stop(signal);
    },
  };
}

module.exports = { createTelegramBotAdapter };
