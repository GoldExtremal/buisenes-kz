const express = require("express");
const cors = require("cors");
const {
  LEAD_STATUSES,
  SITE_CONTENT_DEFAULTS,
} = require("./constants");
const {
  isValidName,
  isValidPhone,
  escapeHtml,
  nowStamp,
} = require("./utils");

function createApiServer({ config, store, getSourceLabel, notifyManager, getManagerChatId }) {
  const app = express();

  app.use(express.json({ limit: "150kb" }));
  app.use(
    cors({
      origin: config.webAllowedOrigin === "*" ? true : config.webAllowedOrigin,
      methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    })
  );

  app.get("/health", (_req, res) => {
    res.json({ ok: true, service: "business-kz-admin-api" });
  });

  app.get("/api/public/site-content", async (_req, res) => {
    const rows = await store.listSiteContentPublic();
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

      const leadMeta = await store.createLead(payload);
      await notifyManager({ payload, leadMeta, title: "Новая заявка с сайта" });

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

      const row = await store.getSessionWithUser(token);
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

    const user = await store.getUserByUsername(username);
    if (!user || !user.is_active || !store.verifyPassword(password, user.password_hash)) {
      return res.status(401).json({ ok: false, error: "invalid_credentials" });
    }

    const token = await store.createSession(user.id);
    await store.logAudit(user.id, "auth.login", { username });
    return res.json({
      ok: true,
      token,
      user: { id: user.id, username: user.username, role: user.role },
    });
  });

  app.post("/admin/api/auth/logout", auth(), async (req, res) => {
    await store.deleteSession(req.auth.token);
    await store.logAudit(req.auth.user.id, "auth.logout", {});
    res.json({ ok: true });
  });

  app.get("/admin/api/me", auth(), async (req, res) => {
    res.json({ ok: true, user: req.auth.user });
  });

  app.get("/admin/api/leads", auth(), async (_req, res) => {
    const leads = await store.listLeads(500);
    res.json({ ok: true, leads, statuses: LEAD_STATUSES });
  });

  app.patch("/admin/api/leads/:id", auth(), async (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) return res.status(400).json({ ok: false, error: "invalid_id" });

    const current = await store.getLeadById(id);
    if (!current) return res.status(404).json({ ok: false, error: "not_found" });

    const status = LEAD_STATUSES.includes(String(req.body?.status || current.status || "new"))
      ? String(req.body?.status || current.status || "new")
      : "new";

    const next = {
      name: String(req.body?.name ?? current.name).trim(),
      phone: String(req.body?.phone ?? current.phone).trim(),
      service: String(req.body?.service ?? current.service).trim(),
      timing: String(req.body?.timing ?? (current.timing || "")).trim(),
      comment: String(req.body?.comment ?? (current.comment || "")).trim(),
      source: String(req.body?.source ?? (current.source || "")).trim(),
      status,
      assignee_user_id:
        req.body?.assignee_user_id === null || req.body?.assignee_user_id === ""
          ? null
          : Number(req.body?.assignee_user_id || current.assignee_user_id || null),
    };

    if (!isValidName(next.name)) return res.status(400).json({ ok: false, error: "invalid_name" });
    if (!isValidPhone(next.phone)) return res.status(400).json({ ok: false, error: "invalid_phone" });

    await store.updateLead(id, next);
    await store.logAudit(req.auth.user.id, "lead.update", { id, updates: next });
    res.json({ ok: true });
  });

  app.get("/admin/api/users", auth(), requireRole("superadmin"), async (_req, res) => {
    const users = await store.listUsers();
    res.json({ ok: true, users });
  });

  app.post("/admin/api/users", auth(), requireRole("superadmin"), async (req, res) => {
    const username = String(req.body?.username || "").trim();
    const password = String(req.body?.password || "").trim();
    const role = String(req.body?.role || "manager").trim();

    if (!username || password.length < 8) return res.status(400).json({ ok: false, error: "invalid_payload" });
    if (!["manager", "superadmin"].includes(role)) return res.status(400).json({ ok: false, error: "invalid_role" });

    try {
      await store.createUser({ username, password, role });
      await store.logAudit(req.auth.user.id, "user.create", { username, role });
      res.json({ ok: true });
    } catch (_err) {
      res.status(400).json({ ok: false, error: "username_exists" });
    }
  });

  app.patch("/admin/api/users/:id", auth(), requireRole("superadmin"), async (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) return res.status(400).json({ ok: false, error: "invalid_id" });

    const user = await store.getUserById(id);
    if (!user) return res.status(404).json({ ok: false, error: "not_found" });

    const role = req.body?.role ? String(req.body.role) : user.role;
    const isActive = typeof req.body?.is_active === "number" ? req.body.is_active : user.is_active;
    const password = String(req.body?.password || "").trim();

    if (!["manager", "superadmin"].includes(role)) return res.status(400).json({ ok: false, error: "invalid_role" });
    if (![0, 1].includes(Number(isActive))) return res.status(400).json({ ok: false, error: "invalid_active" });

    await store.updateUser({ id, role, isActive: Number(isActive), password });
    await store.logAudit(req.auth.user.id, "user.update", {
      id,
      role,
      is_active: Number(isActive),
      password_changed: !!password,
    });
    res.json({ ok: true });
  });

  app.get("/admin/api/site-content", auth(), async (_req, res) => {
    const content = await store.listSiteContent();
    res.json({ ok: true, content });
  });

  app.put("/admin/api/site-content", auth(), async (req, res) => {
    const payload = req.body?.content;
    if (!payload || typeof payload !== "object") return res.status(400).json({ ok: false, error: "invalid_payload" });

    const updates = {};
    const allowedKeys = Object.keys(SITE_CONTENT_DEFAULTS);
    for (const key of allowedKeys) {
      if (Object.prototype.hasOwnProperty.call(payload, key)) {
        updates[key] = String(payload[key] || "").trim();
      }
    }

    await store.upsertSiteContent(updates);
    await store.logAudit(req.auth.user.id, "site_content.update", updates);
    res.json({ ok: true });
  });

  app.get("/admin/api/activity", auth(), requireRole("superadmin"), async (_req, res) => {
    const logs = await store.listActivity(300);
    res.json({ ok: true, logs });
  });

  app.get("/admin/api/stats", auth(), async (_req, res) => {
    const counts = await store.getLeadStatusCounts();
    const byStatus = Object.fromEntries(LEAD_STATUSES.map((s) => [s, 0]));
    counts.forEach((row) => {
      byStatus[row.status || "new"] = row.total;
    });
    const total = Object.values(byStatus).reduce((a, b) => a + Number(b), 0);
    res.json({ ok: true, total, byStatus, managerChatBound: !!getManagerChatId() });
  });

  app.use("/admin", express.static(config.adminDir));

  app.listen(config.port, () => {
    console.log(`HTTP API started on port ${config.port}`);
  });
}

module.exports = { createApiServer };
