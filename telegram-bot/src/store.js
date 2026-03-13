const sqlite3 = require("sqlite3").verbose();
const nodeCrypto = require("crypto");
const { nowStamp } = require("./utils");

function hashPassword(password) {
  const salt = nodeCrypto.randomBytes(16).toString("hex");
  const hash = nodeCrypto.pbkdf2Sync(password, salt, 100000, 64, "sha512").toString("hex");
  return `${salt}:${hash}`;
}

function verifyPassword(password, stored) {
  const [salt, originalHash] = String(stored || "").split(":");
  if (!salt || !originalHash) return false;
  const hash = nodeCrypto.pbkdf2Sync(password, salt, 100000, 64, "sha512").toString("hex");
  return nodeCrypto.timingSafeEqual(Buffer.from(hash), Buffer.from(originalHash));
}

function randomToken() {
  return nodeCrypto.randomBytes(32).toString("hex");
}

function createStore({ dbFile, adminUsername, adminPassword, sessionTtlHours, siteContentDefaults }) {
  const db = new sqlite3.Database(dbFile);

  function run(sql, params = []) {
    return new Promise((resolve, reject) => {
      db.run(sql, params, function onRun(err) {
        if (err) return reject(err);
        resolve(this);
      });
    });
  }

  function get(sql, params = []) {
    return new Promise((resolve, reject) => {
      db.get(sql, params, (err, row) => {
        if (err) return reject(err);
        resolve(row);
      });
    });
  }

  function all(sql, params = []) {
    return new Promise((resolve, reject) => {
      db.all(sql, params, (err, rows) => {
        if (err) return reject(err);
        resolve(rows);
      });
    });
  }

  async function ensureLeadColumn(columnName, definition) {
    const cols = await all("PRAGMA table_info(leads)");
    if (cols.some((col) => col.name === columnName)) return;
    await run(`ALTER TABLE leads ADD COLUMN ${columnName} ${definition}`);
  }

  async function seedSuperadmin() {
    const exists = await get("SELECT id FROM users WHERE username = ?", [adminUsername]);
    if (exists) return;
    await run(
      "INSERT INTO users(username, password_hash, role, is_active, created_at) VALUES(?, ?, 'superadmin', 1, ?)",
      [adminUsername, hashPassword(adminPassword), nowStamp()]
    );
    console.log(`Seeded superadmin user: ${adminUsername}`);
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

    for (const [key, value] of Object.entries(siteContentDefaults)) {
      const exists = await get("SELECT key FROM site_content WHERE key = ?", [key]);
      if (!exists) {
        await run("INSERT INTO site_content(key, value, updated_at) VALUES(?, ?, ?)", [
          key,
          value,
          nowStamp(),
        ]);
      }
    }

    await seedSuperadmin();
  }

  async function getSetting(key) {
    const row = await get("SELECT value FROM settings WHERE key = ?", [key]);
    return row ? String(row.value) : null;
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

  async function listLeads(limit = 500) {
    return all(
      `
        SELECT l.*, u.username AS assignee_username
        FROM leads l
        LEFT JOIN users u ON u.id = l.assignee_user_id
        ORDER BY l.id DESC
        LIMIT ?
      `,
      [limit]
    );
  }

  async function getLeadById(id) {
    return get("SELECT * FROM leads WHERE id = ?", [id]);
  }

  async function updateLead(id, next) {
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
  }

  async function listUsers() {
    return all("SELECT id, username, role, is_active, created_at FROM users ORDER BY id DESC");
  }

  async function createUser({ username, password, role }) {
    await run(
      "INSERT INTO users(username, password_hash, role, is_active, created_at) VALUES(?, ?, ?, 1, ?)",
      [username, hashPassword(password), role, nowStamp()]
    );
  }

  async function getUserById(id) {
    return get("SELECT * FROM users WHERE id = ?", [id]);
  }

  async function getUserByUsername(username) {
    return get("SELECT * FROM users WHERE username = ?", [username]);
  }

  async function updateUser({ id, role, isActive, password }) {
    const user = await getUserById(id);
    const passwordHash = password ? hashPassword(password) : user.password_hash;
    await run("UPDATE users SET role = ?, is_active = ?, password_hash = ? WHERE id = ?", [
      role,
      Number(isActive),
      passwordHash,
      id,
    ]);
  }

  async function createSession(userId) {
    const token = randomToken();
    const expires = new Date(Date.now() + sessionTtlHours * 60 * 60 * 1000)
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

  async function deleteSession(token) {
    await run("DELETE FROM sessions WHERE token = ?", [token]);
  }

  async function getSessionWithUser(token) {
    return get(
      `
        SELECT s.token, s.expires_at, u.id, u.username, u.role, u.is_active
        FROM sessions s
        JOIN users u ON u.id = s.user_id
        WHERE s.token = ?
      `,
      [token]
    );
  }

  async function listSiteContent() {
    return all("SELECT key, value, updated_at FROM site_content ORDER BY key");
  }

  async function listSiteContentPublic() {
    return all("SELECT key, value FROM site_content");
  }

  async function upsertSiteContent(contentObject) {
    for (const [key, value] of Object.entries(contentObject)) {
      await run(
        `
          INSERT INTO site_content(key, value, updated_at) VALUES(?, ?, ?)
          ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at
        `,
        [key, String(value || "").trim(), nowStamp()]
      );
    }
  }

  async function logAudit(actorUserId, action, details) {
    await run("INSERT INTO audit_logs(actor_user_id, action, details, created_at) VALUES(?, ?, ?, ?)", [
      actorUserId || null,
      action,
      details ? JSON.stringify(details) : null,
      nowStamp(),
    ]);
  }

  async function listActivity(limit = 300) {
    return all(
      `
        SELECT a.*, u.username AS actor_username
        FROM audit_logs a
        LEFT JOIN users u ON u.id = a.actor_user_id
        ORDER BY a.id DESC
        LIMIT ?
      `,
      [limit]
    );
  }

  async function getLeadStatusCounts() {
    return all("SELECT status, COUNT(*) AS total FROM leads GROUP BY status");
  }

  return {
    db,
    run,
    get,
    all,
    initDb,
    getSetting,
    saveSetting,
    createLead,
    listLeads,
    getLeadById,
    updateLead,
    listUsers,
    createUser,
    getUserById,
    getUserByUsername,
    updateUser,
    createSession,
    deleteSession,
    getSessionWithUser,
    listSiteContent,
    listSiteContentPublic,
    upsertSiteContent,
    logAudit,
    listActivity,
    getLeadStatusCounts,
    verifyPassword,
  };
}

module.exports = { createStore };
