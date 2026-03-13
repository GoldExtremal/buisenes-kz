const {
  MENU_KEYBOARD,
  CANCEL_KEYBOARD,
  SERVICES_KEYBOARD,
  TIMING_KEYBOARD,
  COMMENT_KEYBOARD,
  CONFIRM_KEYBOARD,
  SOURCE_LABELS,
  STEPS,
} = require("./constants");
const { normalizeUsername, isValidName, isValidPhone, escapeHtml } = require("./utils");

function createTelegramHandlers({ bot, store, config, runtime, notifyManager }) {
  function getSourceLabel(startPayload) {
    if (!startPayload) return "Прямой вход";
    return SOURCE_LABELS[startPayload] || `Источник: ${startPayload}`;
  }

  function formatLeadSummary(payload) {
    const commentText = payload.comment ? payload.comment : "Без комментария";
    return [
      "<b>Проверьте данные перед отправкой:</b>",
      `Имя: <b>${escapeHtml(payload.name)}</b>`,
      `Телефон: <b>${escapeHtml(payload.phone)}</b>`,
      `Услуга: <b>${escapeHtml(payload.service)}</b>`,
      `Срок: <b>${escapeHtml(payload.timing)}</b>`,
      `Комментарий: <b>${escapeHtml(commentText)}</b>`,
    ].join("\\n");
  }

  async function reply(chatId, text, options = {}) {
    await bot.sendChatAction(chatId, "typing");
    return bot.sendMessage(chatId, text, {
      parse_mode: "HTML",
      disable_web_page_preview: true,
      ...options,
    });
  }

  function beginLead(chatId) {
    runtime.userStates.set(chatId, { step: STEPS.ASK_NAME, payload: {} });
  }

  function clearLead(chatId) {
    runtime.userStates.delete(chatId);
  }

  async function showManagerLeads(chatId) {
    const rows = await store.listLeads(10);
    if (!rows.length) {
      await reply(chatId, "Заявок пока нет.");
      return;
    }

    const lines = ["<b>Последние 10 заявок:</b>"];
    rows.forEach((row) => {
      lines.push(
        `#${row.id} | ${escapeHtml(row.name)} | ${escapeHtml(row.phone)} | ${escapeHtml(row.service)} | ${escapeHtml(
          row.status || "new"
        )} | ${escapeHtml(row.channel || "-")} | ${row.created_at}`
      );
    });
    await reply(chatId, lines.join("\\n"));
  }

  async function startLead(chatId) {
    beginLead(chatId);
    await reply(chatId, "Отлично, начнем оформление заявки.\\nКак к вам обращаться?", {
      reply_markup: CANCEL_KEYBOARD,
    });
  }

  async function onCommandStart(msg, match) {
    const chatId = msg.chat.id;
    const payload = (match && match[1] ? match[1] : "").trim();
    const sourceLabel = getSourceLabel(payload);
    runtime.userSources.set(chatId, sourceLabel);

    const intro = [
      "Здравствуйте. Вы в сервис-боте <b>Business KZ</b>.",
      "Помогу подобрать услугу и быстро передать заявку менеджеру.",
      `Источник обращения: <b>${escapeHtml(sourceLabel)}</b>`,
    ].join("\\n");

    await reply(chatId, intro, { reply_markup: MENU_KEYBOARD });
  }

  async function onCommandHelp(msg) {
    await reply(msg.chat.id, "Выберите действие в меню ниже.\\nЕсли хотите, могу сразу помочь с заявкой.", {
      reply_markup: MENU_KEYBOARD,
    });
  }

  async function onBindManager(msg) {
    const chatId = msg.chat.id;
    const currentUsername = normalizeUsername(msg.from?.username);

    if (!config.managerUsername) {
      await reply(chatId, "MANAGER_USERNAME не задан в .env.");
      return;
    }

    if (currentUsername !== config.managerUsername) {
      await reply(chatId, "Недостаточно прав для этой команды.");
      return;
    }

    runtime.managerChatId = String(chatId);
    await store.saveSetting("manager_chat_id", runtime.managerChatId);
    await reply(chatId, `Чат менеджера привязан: <b>${runtime.managerChatId}</b>`);
  }

  function isManager(msg) {
    return normalizeUsername(msg.from?.username) === config.managerUsername;
  }

  async function answerQuickQuestion(chatId, lowerText) {
    if (lowerText.includes("срок")) {
      await reply(chatId, "По большинству задач стартовые этапы закрываются в течение 1-3 рабочих дней.");
      return true;
    }
    if (lowerText.includes("иин") || lowerText.includes("бин")) {
      await reply(
        chatId,
        "Помогаем с ИИН/БИН для нерезидентов и компаний. Нажмите 'Оставить заявку' для точной оценки."
      );
      return true;
    }
    if (lowerText.includes("цена") || lowerText.includes("стоим")) {
      await reply(
        chatId,
        "Стоимость зависит от задачи и срочности. Оставьте заявку, и менеджер даст точный расчет."
      );
      return true;
    }
    return false;
  }

  async function onText(msg) {
    const chatId = msg.chat.id;
    const text = (msg.text || "").trim();
    const lower = text.toLowerCase();

    if (!text || text.startsWith("/")) return;

    if (lower === "подобрать услугу") {
      await reply(
        chatId,
        "Выберите, что вам ближе:\\n- Регистрация бизнеса\\n- Банковский счет\\n- Виза/миграция\\nМожно сразу нажать <b>Оставить заявку</b>.",
        { reply_markup: MENU_KEYBOARD }
      );
      return;
    }

    if (lower === "связаться с менеджером") {
      await reply(
        chatId,
        "Оставьте заявку, и менеджер свяжется с вами. Также можно позвонить: <b>+7 702 372 15 18</b>",
        {
          reply_markup: MENU_KEYBOARD,
        }
      );
      return;
    }

    if (lower === "о компании") {
      await reply(chatId, "Business KZ сопровождает запуск бизнеса и миграционные вопросы в Казахстане.");
      return;
    }

    if (lower === "оставить заявку") {
      await startLead(chatId);
      return;
    }

    if (lower === "отмена") {
      clearLead(chatId);
      await reply(chatId, "Остановил текущий сценарий. Если нужно, начнем заново.", {
        reply_markup: MENU_KEYBOARD,
      });
      return;
    }

    const state = runtime.userStates.get(chatId);
    if (!state) {
      const handled = await answerQuickQuestion(chatId, lower);
      if (!handled) {
        await reply(chatId, "Чтобы не терять время, выберите действие в меню ниже.", {
          reply_markup: MENU_KEYBOARD,
        });
      }
      return;
    }

    if (state.step === STEPS.ASK_NAME) {
      if (!isValidName(text)) {
        await reply(chatId, "Укажите имя в формате: Иван Петров. Без цифр и спецсимволов.", {
          reply_markup: CANCEL_KEYBOARD,
        });
        return;
      }
      state.payload.name = text;
      state.step = STEPS.ASK_PHONE;
      await reply(chatId, "Отлично. Укажите телефон для связи в международном формате.", {
        reply_markup: CANCEL_KEYBOARD,
      });
      return;
    }

    if (state.step === STEPS.ASK_PHONE) {
      if (!isValidPhone(text)) {
        await reply(chatId, "Похоже, номер введен не полностью. Пример: +77021234567", {
          reply_markup: CANCEL_KEYBOARD,
        });
        return;
      }
      state.payload.phone = text;
      state.step = STEPS.ASK_SERVICE;
      await reply(chatId, "Выберите основную услугу:", { reply_markup: SERVICES_KEYBOARD });
      return;
    }

    if (state.step === STEPS.ASK_SERVICE) {
      state.payload.service = text;
      state.step = STEPS.ASK_TIMING;
      await reply(chatId, "Какой у вас приоритет по срокам?", { reply_markup: TIMING_KEYBOARD });
      return;
    }

    if (state.step === STEPS.ASK_TIMING) {
      state.payload.timing = text;
      state.step = STEPS.ASK_COMMENT;
      await reply(chatId, "Добавьте краткий комментарий к задаче или нажмите 'Без комментария'.", {
        reply_markup: COMMENT_KEYBOARD,
      });
      return;
    }

    if (state.step === STEPS.ASK_COMMENT) {
      state.payload.comment = lower === "без комментария" ? "" : text;
      state.payload.user_id = msg.from.id;
      state.payload.username = msg.from.username || "";
      state.payload.source = runtime.userSources.get(chatId) || "Прямой вход";
      state.payload.channel = "telegram";
      state.step = STEPS.ASK_CONFIRM;

      await reply(chatId, formatLeadSummary(state.payload), { reply_markup: CONFIRM_KEYBOARD });
      return;
    }

    if (state.step === STEPS.ASK_CONFIRM) {
      if (lower === "изменить") {
        state.step = STEPS.ASK_NAME;
        state.payload = {};
        await reply(chatId, "Хорошо, начнем заново. Как к вам обращаться?", {
          reply_markup: CANCEL_KEYBOARD,
        });
        return;
      }

      if (lower !== "подтвердить") {
        await reply(chatId, "Пожалуйста, выберите 'Подтвердить' или 'Изменить'.", {
          reply_markup: CONFIRM_KEYBOARD,
        });
        return;
      }

      try {
        const leadMeta = await store.createLead(state.payload);
        await notifyManager({ payload: state.payload, leadMeta, title: "Новая заявка из Telegram-бота" });
        await reply(chatId, "Спасибо. Заявка принята в работу. Менеджер свяжется с вами в ближайшее время.", {
          reply_markup: MENU_KEYBOARD,
        });
      } catch (err) {
        console.error("Failed to save lead:", err.message);
        await reply(chatId, "Не удалось сохранить заявку. Повторите попытку чуть позже.", {
          reply_markup: MENU_KEYBOARD,
        });
      } finally {
        clearLead(chatId);
      }
    }
  }

  function register() {
    bot.onText(/^\/start(?:\s+(.+))?$/i, onCommandStart);
    bot.onText(/^\/help$/i, onCommandHelp);
    bot.onText(/^\/lead$/i, async (msg) => startLead(msg.chat.id));
    bot.onText(/^\/bind_manager$/i, onBindManager);
    bot.onText(/^\/manager_leads$/i, async (msg) => {
      if (!isManager(msg)) {
        await reply(msg.chat.id, "Недостаточно прав для этой команды.");
        return;
      }
      await showManagerLeads(msg.chat.id);
    });
    bot.on("message", onText);
  }

  return {
    register,
    getSourceLabel,
    reply,
  };
}

module.exports = { createTelegramHandlers };
