require("dotenv").config();

const TelegramBot = require("node-telegram-bot-api");
const sqlite3 = require("sqlite3").verbose();
const path = require("path");
const express = require("express");
const cors = require("cors");
const crypto = require("crypto");

const TOKEN = (process.env.TOKEN || "").trim();
const DB_PATH = (process.env.DB_PATH || "bot.db").trim();
const MANAGER_USERNAME = normalizeUsername(process.env.MANAGER_USERNAME || "");
const PORT = Number(process.env.PORT || 3001);
const WEB_ALLOWED_ORIGIN = (process.env.WEB_ALLOWED_ORIGIN || "*").trim();
const ADMIN_USERNAME = (process.env.ADMIN_USERNAME || "admin").trim();
const ADMIN_PASSWORD = (process.env.ADMIN_PASSWORD || "Admin12345!").trim();
const SESSION_TTL_HOURS = Number(process.env.SESSION_TTL_HOURS || 168);

if (!TOKEN) {
  throw new Error("TOKEN не найден. Укажите TOKEN в .env");
}

const dbFile = path.resolve(__dirname, DB_PATH);
const db = new sqlite3.Database(dbFile);
const bot = new TelegramBot(TOKEN, { polling: true });

const userStates = new Map();
const userSources = new Map();
let managerChatId = null;

const MENU_KEYBOARD = {
  keyboard: [
    ["Подобрать услугу", "Оставить заявку"],
    ["Связаться с менеджером", "О компании"],
  ],
  resize_keyboard: true,
};

const CANCEL_KEYBOARD = {
  keyboard: [["Отмена"]],
  resize_keyboard: true,
};

const SERVICES_KEYBOARD = {
  keyboard: [
    ["Регистрация ТОО/ИП", "Открытие счета"],
    ["Бизнес-виза", "ИИН/БИН"],
    ["РВП", "Юридический адрес"],
    ["Другое", "Отмена"],
  ],
  resize_keyboard: true,
};

const TIMING_KEYBOARD = {
  keyboard: [
    ["Срочно (сегодня)", "1-3 рабочих дня"],
    ["На этой неделе", "Пока консультация"],
    ["Отмена"],
  ],
  resize_keyboard: true,
};

const COMMENT_KEYBOARD = {
  keyboard: [["Без комментария"], ["Отмена"]],
  resize_keyboard: true,
};

const CONFIRM_KEYBOARD = {
  keyboard: [["Подтвердить", "Изменить"], ["Отмена"]],
  resize_keyboard: true,
};

const SOURCE_LABELS = {
  site_menu: "Сайт: меню",
  site_hero: "Сайт: hero",
  site_contacts: "Сайт: контакты",
  site_float: "Сайт: плавающая кнопка",
  site_quick_form: "Сайт: форма быстрой заявки",
};

const LEAD_STATUSES = ["new", "in_progress", "waiting", "done"];

const SITE_CONTENT_DEFAULTS = {
  hero_title: "Запуск бизнеса и легализация в Казахстане без бюрократического стресса",
  hero_lead: "Сопровождаем предпринимателей и иностранцев под ключ: от регистрации ТОО до оформления РВП и бизнес-визы.",
  contacts_title: "Обсудим вашу задачу",
  contacts_address: "Республика Казахстан, г. Астана, ул. Уалиханова, 5 офис 17",
  phone_1: "+7 702 372 15 18",
  phone_2: "+7 705 423 16 33",
  email: "info.cbr01@gmail.com",
  whatsapp_link: "https://wa.me/77023721518",
};

const STEPS = {
  ASK_NAME: "ASK_NAME",
  ASK_PHONE: "ASK_PHONE",
  ASK_SERVICE: "ASK_SERVICE",
  ASK_TIMING: "ASK_TIMING",
  ASK_COMMENT: "ASK_COMMENT",
  ASK_CONFIRM: "ASK_CONFIRM",
};

function normalizeUsername(username) {
  return String(username || "").trim().replace(/^@/, "").toLowerCase();
}

function sanitizePhone(value) {
  return String(value || "").replace(/[\s\-()]/g, "").trim();
}

function isValidPhone(value) {
  const cleaned = sanitizePhone(value);
  return /^\+?\d{10,15}$/.test(cleaned);
}

function isValidName(value) {
  const name = String(value || "").trim();
  if (name.length < 2 || name.length > 60) {
    return false;
  }
  return /^[\p{L} .'-]+$/u.test(name);
}

function escapeHtml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function nowStamp() {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  const hh = String(d.getHours()).padStart(2, "0");
  const mi = String(d.getMinutes()).padStart(2, "0");
  const ss = String(d.getSeconds()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd} ${hh}:${mi}:${ss}`;
}

function run(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function onRun(err) {
      if (err) {
        reject(err);
        return;
      }
      resolve(this);
    });
  });
}

function get(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => {
      if (err) {
        reject(err);
        return;
      }
      resolve(row);
    });
  });
}

function all(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) {
        reject(err);
        return;
      }
      resolve(rows);
    });
  });
}

function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString("hex");
  const hash = crypto.pbkdf2Sync(password, salt, 100000, 64, "sha512").toString("hex");
  return `${salt}:${hash}`;
}

function verifyPassword(password, stored) {
  const [salt, originalHash] = String(stored || "").split(":");
  if (!salt || !originalHash) return false;
  const hash = crypto.pbkdf2Sync(password, salt, 100000, 64, "sha512").toString("hex");
  return crypto.timingSafeEqual(Buffer.from(hash), Buffer.from(originalHash));
}

function randomToken() {
  return crypto.randomBytes(32).toString("hex");
}

async function ensureLeadColumn(columnName, definition) {
  const cols = await all("PRAGMA table_info(leads)");
  if (cols.some((col) => col.name === columnName)) return;
  await run(`ALTER TABLE leads ADD COLUMN ${columnName} ${definition}`);
}

async function initDb() {
  await run(`
    CREATE TABLE IF NOT EXISTS leads (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      username TEXT,
      name TEXT NOT NULL,
      phone TEXT NOT NULL,
      service TEXT NOT NULL,
      timing TEXT,
      comment TEXT,
      source TEXT,
      channel TEXT,
      status TEXT,
      assignee_user_id INTEGER,
      updated_at TEXT,
      created_at TEXT NOT NULL
    )
  `);

  await ensureLeadColumn("timing", "TEXT");
  await ensureLeadColumn("source", "TEXT");
  await ensureLeadColumn("channel", "TEXT");
  await ensureLeadColumn("status", "TEXT DEFAULT 'new'");
  await ensureLeadColumn("assignee_user_id", "INTEGER");
  await ensureLeadColumn("updated_at", "TEXT");

  await run(`
    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    )
  `);

  await run(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL,
      is_active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL
    )
  `);

  await run(`
    CREATE TABLE IF NOT EXISTS sessions (
      token TEXT PRIMARY KEY,
      user_id INTEGER NOT NULL,
      expires_at TEXT NOT NULL,
      created_at TEXT NOT NULL
    )
  `);

  await run(`
    CREATE TABLE IF NOT EXISTS audit_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      actor_user_id INTEGER,
      action TEXT NOT NULL,
      details TEXT,
      created_at TEXT NOT NULL
    )
  `);

  await run(`
    CREATE TABLE IF NOT EXISTS site_content (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      updated_at TEXT NOT NULL
    )
  `);

  for (const [key, value] of Object.entries(SITE_CONTENT_DEFAULTS)) {
    const exists = await get("SELECT key FROM site_content WHERE key = ?", [key]);
    if (!exists) {
      await run("INSERT INTO site_content(key, value, updated_at) VALUES(?, ?, ?)", [key, value, nowStamp()]);
    }
  }

  const row = await get("SELECT value FROM settings WHERE key = ?", ["manager_chat_id"]);
  managerChatId = row ? String(row.value) : null;

  await seedSuperadmin();
}

async function seedSuperadmin() {
  const exists = await get("SELECT id FROM users WHERE username = ?", [ADMIN_USERNAME]);
  if (exists) return;
  await run(
    "INSERT INTO users(username, password_hash, role, is_active, created_at) VALUES(?, ?, 'superadmin', 1, ?)",
    [ADMIN_USERNAME, hashPassword(ADMIN_PASSWORD), nowStamp()]
  );
  console.log(`Seeded superadmin user: ${ADMIN_USERNAME}`);
}

async function saveSetting(key, value) {
  await run(
    `
      INSERT INTO settings(key, value) VALUES(?, ?)
      ON CONFLICT(key) DO UPDATE SET value = excluded.value
    `,
    [key, String(value)]
  );
}

async function createLead(payload) {
  const createdAt = nowStamp();
  const result = await run(
    `
      INSERT INTO leads (user_id, username, name, phone, service, timing, comment, source, channel, status, assignee_user_id, updated_at, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `,
    [
      payload.user_id || 0,
      payload.username || null,
      payload.name,
      payload.phone,
      payload.service || "Не выбрана",
      payload.timing || "",
      payload.comment || "",
      payload.source || "Прямой вход",
      payload.channel || "telegram",
      payload.status || "new",
      payload.assignee_user_id || null,
      createdAt,
      createdAt,
    ]
  );

  return { id: result.lastID, createdAt };
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
  userStates.set(chatId, { step: STEPS.ASK_NAME, payload: {} });
}

function clearLead(chatId) {
  userStates.delete(chatId);
}

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
  ].join("\n");
}

async function notifyManager(payload, leadMeta, title = "Новая заявка") {
  if (!managerChatId) return;

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
    await bot.sendMessage(Number(managerChatId), text, { parse_mode: "HTML" });
  } catch (err) {
    console.error("Failed to notify manager:", err.message);
  }
}

function cleanLeadStatus(status) {
  return LEAD_STATUSES.includes(status) ? status : "new";
}

async function logAudit(actorUserId, action, details) {
  await run(
    "INSERT INTO audit_logs(actor_user_id, action, details, created_at) VALUES(?, ?, ?, ?)",
    [actorUserId || null, action, details ? JSON.stringify(details) : null, nowStamp()]
  );
}

async function createSession(userId) {
  const token = randomToken();
  const expires = new Date(Date.now() + SESSION_TTL_HOURS * 60 * 60 * 1000)
    .toISOString()
    .slice(0, 19)
    .replace("T", " ");
  await run("INSERT INTO sessions(token, user_id, expires_at, created_at) VALUES(?, ?, ?, ?)", [
    token,
    userId,
    expires,
    nowStamp(),
  ]);
  return token;
}

function createApiServer() {
  const app = express();
  app.use(express.json({ limit: "150kb" }));
  app.use(
    cors({
      origin: WEB_ALLOWED_ORIGIN === "*" ? true : WEB_ALLOWED_ORIGIN,
      methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    })
  );

  app.get("/health", (_req, res) => {
    res.json({ ok: true, service: "business-kz-admin-api" });
  });

  app.get("/api/public/site-content", async (_req, res) => {
    const rows = await all("SELECT key, value FROM site_content");
    const content = Object.fromEntries(rows.map((r) => [r.key, r.value]));
    res.json({ ok: true, content });
  });

  app.post("/api/site-lead", async (req, res) => {
    try {
      const name = String(req.body?.name || "").trim();
      const phone = String(req.body?.phone || "").trim();
      const service = String(req.body?.service || "").trim();
      const comment = String(req.body?.comment || "").trim();
      const source = getSourceLabel(String(req.body?.source || "site_quick_form").trim());

      if (!isValidName(name)) return res.status(400).json({ ok: false, error: "invalid_name" });
      if (!isValidPhone(phone)) return res.status(400).json({ ok: false, error: "invalid_phone" });

      const payload = {
        name,
        phone,
        service: service || "Не выбрана",
        comment,
        timing: "Не указан",
        source,
        channel: "site",
        username: "site-form",
        user_id: 0,
      };

      const leadMeta = await createLead(payload);
      await notifyManager(payload, leadMeta, "Новая заявка с сайта");

      res.json({ ok: true, leadId: leadMeta.id });
    } catch (err) {
      console.error("Site lead API error:", err.message);
      res.status(500).json({ ok: false, error: "internal_error" });
    }
  });

  function auth(required = true) {
    return async (req, res, next) => {
      const authHeader = req.headers.authorization || "";
      const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7).trim() : "";
      if (!token) {
        if (required) return res.status(401).json({ ok: false, error: "unauthorized" });
        return next();
      }

      const row = await get(
        `
          SELECT s.token, s.expires_at, u.id, u.username, u.role, u.is_active
          FROM sessions s
          JOIN users u ON u.id = s.user_id
          WHERE s.token = ?
        `,
        [token]
      );

      if (!row || !row.is_active || row.expires_at < nowStamp()) {
        if (required) return res.status(401).json({ ok: false, error: "unauthorized" });
        return next();
      }

      req.auth = {
        token,
        user: { id: row.id, username: row.username, role: row.role },
      };
      return next();
    };
  }

  function requireRole(...roles) {
    return (req, res, next) => {
      const role = req.auth?.user?.role;
      if (!role || !roles.includes(role)) return res.status(403).json({ ok: false, error: "forbidden" });
      return next();
    };
  }

  app.post("/admin/api/auth/login", async (req, res) => {
    const username = String(req.body?.username || "").trim();
    const password = String(req.body?.password || "").trim();

    const user = await get("SELECT * FROM users WHERE username = ?", [username]);
    if (!user || !user.is_active || !verifyPassword(password, user.password_hash)) {
      return res.status(401).json({ ok: false, error: "invalid_credentials" });
    }

    const token = await createSession(user.id);
    await logAudit(user.id, "auth.login", { username });
    return res.json({
      ok: true,
      token,
      user: { id: user.id, username: user.username, role: user.role },
    });
  });

  app.post("/admin/api/auth/logout", auth(), async (req, res) => {
    await run("DELETE FROM sessions WHERE token = ?", [req.auth.token]);
    await logAudit(req.auth.user.id, "auth.logout", {});
    res.json({ ok: true });
  });

  app.get("/admin/api/me", auth(), async (req, res) => {
    res.json({ ok: true, user: req.auth.user });
  });

  app.get("/admin/api/leads", auth(), async (_req, res) => {
    const rows = await all(
      `
        SELECT l.*, u.username AS assignee_username
        FROM leads l
        LEFT JOIN users u ON u.id = l.assignee_user_id
        ORDER BY l.id DESC
        LIMIT 500
      `
    );
    res.json({ ok: true, leads: rows, statuses: LEAD_STATUSES });
  });

  app.patch("/admin/api/leads/:id", auth(), async (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) return res.status(400).json({ ok: false, error: "invalid_id" });

    const current = await get("SELECT * FROM leads WHERE id = ?", [id]);
    if (!current) return res.status(404).json({ ok: false, error: "not_found" });

    const next = {
      name: String(req.body?.name ?? current.name).trim(),
      phone: String(req.body?.phone ?? current.phone).trim(),
      service: String(req.body?.service ?? current.service).trim(),
      timing: String(req.body?.timing ?? (current.timing || "")).trim(),
      comment: String(req.body?.comment ?? (current.comment || "")).trim(),
      source: String(req.body?.source ?? (current.source || "")).trim(),
      status: cleanLeadStatus(String(req.body?.status || current.status || "new")),
      assignee_user_id:
        req.body?.assignee_user_id === null || req.body?.assignee_user_id === ""
          ? null
          : Number(req.body?.assignee_user_id || current.assignee_user_id || null),
    };

    if (!isValidName(next.name)) return res.status(400).json({ ok: false, error: "invalid_name" });
    if (!isValidPhone(next.phone)) return res.status(400).json({ ok: false, error: "invalid_phone" });

    await run(
      `
        UPDATE leads
        SET name = ?, phone = ?, service = ?, timing = ?, comment = ?, source = ?, status = ?, assignee_user_id = ?, updated_at = ?
        WHERE id = ?
      `,
      [
        next.name,
        next.phone,
        next.service,
        next.timing,
        next.comment,
        next.source,
        next.status,
        Number.isFinite(next.assignee_user_id) ? next.assignee_user_id : null,
        nowStamp(),
        id,
      ]
    );

    await logAudit(req.auth.user.id, "lead.update", { id, updates: next });
    res.json({ ok: true });
  });

  app.get("/admin/api/users", auth(), requireRole("superadmin"), async (_req, res) => {
    const users = await all("SELECT id, username, role, is_active, created_at FROM users ORDER BY id DESC");
    res.json({ ok: true, users });
  });

  app.post("/admin/api/users", auth(), requireRole("superadmin"), async (req, res) => {
    const username = String(req.body?.username || "").trim();
    const password = String(req.body?.password || "").trim();
    const role = String(req.body?.role || "manager").trim();

    if (!username || password.length < 8) return res.status(400).json({ ok: false, error: "invalid_payload" });
    if (!["manager", "superadmin"].includes(role)) return res.status(400).json({ ok: false, error: "invalid_role" });

    try {
      await run(
        "INSERT INTO users(username, password_hash, role, is_active, created_at) VALUES(?, ?, ?, 1, ?)",
        [username, hashPassword(password), role, nowStamp()]
      );
      await logAudit(req.auth.user.id, "user.create", { username, role });
      res.json({ ok: true });
    } catch (err) {
      res.status(400).json({ ok: false, error: "username_exists" });
    }
  });

  app.patch("/admin/api/users/:id", auth(), requireRole("superadmin"), async (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) return res.status(400).json({ ok: false, error: "invalid_id" });

    const user = await get("SELECT * FROM users WHERE id = ?", [id]);
    if (!user) return res.status(404).json({ ok: false, error: "not_found" });

    const role = req.body?.role ? String(req.body.role) : user.role;
    const isActive = typeof req.body?.is_active === "number" ? req.body.is_active : user.is_active;
    const password = String(req.body?.password || "").trim();

    if (!["manager", "superadmin"].includes(role)) return res.status(400).json({ ok: false, error: "invalid_role" });
    if (![0, 1].includes(Number(isActive))) return res.status(400).json({ ok: false, error: "invalid_active" });

    const passwordHash = password ? hashPassword(password) : user.password_hash;

    await run("UPDATE users SET role = ?, is_active = ?, password_hash = ? WHERE id = ?", [
      role,
      Number(isActive),
      passwordHash,
      id,
    ]);

    await logAudit(req.auth.user.id, "user.update", { id, role, is_active: Number(isActive), password_changed: !!password });
    res.json({ ok: true });
  });

  app.get("/admin/api/site-content", auth(), async (_req, res) => {
    const rows = await all("SELECT key, value, updated_at FROM site_content ORDER BY key");
    res.json({ ok: true, content: rows });
  });

  app.put("/admin/api/site-content", auth(), async (req, res) => {
    const payload = req.body?.content;
    if (!payload || typeof payload !== "object") return res.status(400).json({ ok: false, error: "invalid_payload" });

    const allowedKeys = Object.keys(SITE_CONTENT_DEFAULTS);
    const updates = {};

    for (const key of allowedKeys) {
      if (Object.prototype.hasOwnProperty.call(payload, key)) {
        const value = String(payload[key] || "").trim();
        updates[key] = value;
        await run(
          `
            INSERT INTO site_content(key, value, updated_at) VALUES(?, ?, ?)
            ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at
          `,
          [key, value, nowStamp()]
        );
      }
    }

    await logAudit(req.auth.user.id, "site_content.update", updates);
    res.json({ ok: true });
  });

  app.get("/admin/api/activity", auth(), requireRole("superadmin"), async (_req, res) => {
    const logs = await all(
      `
        SELECT a.*, u.username AS actor_username
        FROM audit_logs a
        LEFT JOIN users u ON u.id = a.actor_user_id
        ORDER BY a.id DESC
        LIMIT 300
      `
    );
    res.json({ ok: true, logs });
  });

  app.get("/admin/api/stats", auth(), async (_req, res) => {
    const counts = await all("SELECT status, COUNT(*) AS total FROM leads GROUP BY status");
    const byStatus = Object.fromEntries(LEAD_STATUSES.map((s) => [s, 0]));
    counts.forEach((row) => {
      byStatus[row.status || "new"] = row.total;
    });
    const total = Object.values(byStatus).reduce((a, b) => a + Number(b), 0);
    res.json({ ok: true, total, byStatus });
  });

  const adminDir = path.resolve(__dirname, "admin");
  app.use("/admin", express.static(adminDir));

  app.listen(PORT, () => {
    console.log(`HTTP API started on port ${PORT}`);
  });
}

async function showManagerLeads(chatId) {
  const rows = await all(
    `
      SELECT id, name, phone, service, timing, source, channel, status, created_at
      FROM leads
      ORDER BY id DESC
      LIMIT 10
    `
  );

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
  await reply(chatId, lines.join("\n"));
}

async function startLead(chatId) {
  beginLead(chatId);
  await reply(chatId, "Отлично, начнем оформление заявки.\nКак к вам обращаться?", {
    reply_markup: CANCEL_KEYBOARD,
  });
}

async function onCommandStart(msg, match) {
  const chatId = msg.chat.id;
  const payload = (match && match[1] ? match[1] : "").trim();
  const sourceLabel = getSourceLabel(payload);
  userSources.set(chatId, sourceLabel);

  const intro = [
    "Здравствуйте. Вы в сервис-боте <b>Business KZ</b>.",
    "Помогу подобрать услугу и быстро передать заявку менеджеру.",
    `Источник обращения: <b>${escapeHtml(sourceLabel)}</b>`,
  ].join("\n");

  await reply(chatId, intro, { reply_markup: MENU_KEYBOARD });
}

async function onCommandHelp(msg) {
  await reply(msg.chat.id, "Выберите действие в меню ниже.\nЕсли хотите, могу сразу помочь с заявкой.", {
    reply_markup: MENU_KEYBOARD,
  });
}

async function onBindManager(msg) {
  const chatId = msg.chat.id;
  const currentUsername = normalizeUsername(msg.from?.username);

  if (!MANAGER_USERNAME) {
    await reply(chatId, "MANAGER_USERNAME не задан в .env.");
    return;
  }

  if (currentUsername !== MANAGER_USERNAME) {
    await reply(chatId, "Недостаточно прав для этой команды.");
    return;
  }

  managerChatId = String(chatId);
  await saveSetting("manager_chat_id", managerChatId);
  await reply(chatId, `Чат менеджера привязан: <b>${managerChatId}</b>`);
}

function isManager(msg) {
  return normalizeUsername(msg.from?.username) === MANAGER_USERNAME;
}

async function answerQuickQuestion(chatId, lowerText) {
  if (lowerText.includes("срок")) {
    await reply(chatId, "По большинству задач стартовые этапы закрываются в течение 1-3 рабочих дней.");
    return true;
  }
  if (lowerText.includes("иин") || lowerText.includes("бин")) {
    await reply(chatId, "Помогаем с ИИН/БИН для нерезидентов и компаний. Нажмите 'Оставить заявку' для точной оценки.");
    return true;
  }
  if (lowerText.includes("цена") || lowerText.includes("стоим")) {
    await reply(chatId, "Стоимость зависит от задачи и срочности. Оставьте заявку, и менеджер даст точный расчет.");
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
      "Выберите, что вам ближе:\n- Регистрация бизнеса\n- Банковский счет\n- Виза/миграция\nМожно сразу нажать <b>Оставить заявку</b>.",
      { reply_markup: MENU_KEYBOARD }
    );
    return;
  }

  if (lower === "связаться с менеджером") {
    await reply(chatId, "Оставьте заявку, и менеджер свяжется с вами. Также можно позвонить: <b>+7 702 372 15 18</b>", {
      reply_markup: MENU_KEYBOARD,
    });
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

  const state = userStates.get(chatId);
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
    state.payload.source = userSources.get(chatId) || "Прямой вход";
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
      const leadMeta = await createLead(state.payload);
      await notifyManager(state.payload, leadMeta, "Новая заявка из Telegram-бота");
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

async function bootstrap() {
  await initDb();
  createApiServer();

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

  console.log(`Bot started (JS). DB: ${dbFile}`);
}

bootstrap().catch((err) => {
  console.error("Bot bootstrap failed:", err);
  process.exit(1);
});
