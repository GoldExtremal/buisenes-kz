const express = require("express");
const cors = require("cors");
const { createLogger } = require("./logger");
const { createRequestId, fail, ok } = require("./http");
const { LEAD_STATUSES, SITE_CONTENT_DEFAULTS } = require("./constants");
const { isValidName, isValidPhone, nowStamp } = require("./utils");

function createApiServer({ config, store, getSourceLabel, notifyManager, getManagerChatId }) {
  const app = express();
  const logger = createLogger("api");

  app.use(express.json({ limit: "150kb" }));
  app.use(
    cors({
      origin: config.webAllowedOrigin === "*" ? true : config.webAllowedOrigin,
      methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    })
  );

  app.use((req, res, next) => {
    req.reqId = createRequestId();
    const startedAt = Date.now();

    res.on("finish", () => {
      logger.info("request.completed", {
        reqId: req.reqId,
        method: req.method,
        path: req.path,
        status: res.statusCode,
        ms: Date.now() - startedAt,
      });
    });

    next();
  });

  app.get("/health", (_req, res) => {
    ok(res, { service: "business-kz-admin-api" });
  });

  app.get("/api/public/site-content", async (_req, res) => {
    const rows = await store.listSiteContentPublic();
    const content = Object.fromEntries(rows.map((r) => [r.key, r.value]));
    ok(res, { content });
  });

  app.post("/api/site-lead", async (req, res) => {
    try {
      const name = String(req.body?.name || "").trim();
      const phone = String(req.body?.phone || "").trim();
      const service = String(req.body?.service || "").trim();
      const comment = String(req.body?.comment || "").trim();
      const source = getSourceLabel(String(req.body?.source || "site_quick_form").trim());

      if (!isValidName(name)) return fail(res, req.reqId, 400, "invalid_name", "Invalid name");
      if (!isValidPhone(phone)) return fail(res, req.reqId, 400, "invalid_phone", "Invalid phone");

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

      ok(res, { leadId: leadMeta.id });
    } catch (err) {
      logger.error("site_lead.failed", { reqId: req.reqId, error: err.message });
      fail(res, req.reqId, 500, "internal_error", "Internal error");
    }
  });

  function auth(required = true) {
    return async (req, res, next) => {
      const authHeader = req.headers.authorization || "";
      const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7).trim() : "";
      if (!token) {
        if (required) return fail(res, req.reqId, 401, "unauthorized", "Unauthorized");
        return next();
      }

      const row = await store.getSessionWithUser(token);
      if (!row || !row.is_active || row.expires_at < nowStamp()) {
        if (required) return fail(res, req.reqId, 401, "unauthorized", "Unauthorized");
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
      if (!role || !roles.includes(role)) return fail(res, req.reqId, 403, "forbidden", "Forbidden");
      return next();
    };
  }

  app.post("/admin/api/auth/login", async (req, res) => {
    const username = String(req.body?.username || "").trim();
    const password = String(req.body?.password || "").trim();

    const user = await store.getUserByUsername(username);
    if (!user || !user.is_active || !store.verifyPassword(password, user.password_hash)) {
      return fail(res, req.reqId, 401, "invalid_credentials", "Invalid credentials");
    }

    const token = await store.createSession(user.id);
    await store.logAudit(user.id, "auth.login", { username });
    return ok(res, {
      token,
      user: { id: user.id, username: user.username, role: user.role },
    });
  });

  app.post("/admin/api/auth/logout", auth(), async (req, res) => {
    await store.deleteSession(req.auth.token);
    await store.logAudit(req.auth.user.id, "auth.logout", {});
    ok(res);
  });

  app.get("/admin/api/me", auth(), async (req, res) => {
    ok(res, { user: req.auth.user });
  });

  app.get("/admin/api/leads", auth(), async (_req, res) => {
    const leads = await store.listLeads(500);
    ok(res, { leads, statuses: LEAD_STATUSES });
  });

  app.patch("/admin/api/leads/:id", auth(), async (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) return fail(res, req.reqId, 400, "invalid_id", "Invalid id");

    const current = await store.getLeadById(id);
    if (!current) return fail(res, req.reqId, 404, "not_found", "Lead not found");

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

    if (!isValidName(next.name)) return fail(res, req.reqId, 400, "invalid_name", "Invalid name");
    if (!isValidPhone(next.phone)) return fail(res, req.reqId, 400, "invalid_phone", "Invalid phone");

    await store.updateLead(id, next);
    await store.logAudit(req.auth.user.id, "lead.update", { id, updates: next });
    ok(res);
  });

  app.get("/admin/api/users", auth(), requireRole("superadmin"), async (_req, res) => {
    const users = await store.listUsers();
    ok(res, { users });
  });

  app.post("/admin/api/users", auth(), requireRole("superadmin"), async (req, res) => {
    const username = String(req.body?.username || "").trim();
    const password = String(req.body?.password || "").trim();
    const role = String(req.body?.role || "manager").trim();

    if (!username || password.length < 8) return fail(res, req.reqId, 400, "invalid_payload", "Invalid payload");
    if (!["manager", "superadmin"].includes(role)) return fail(res, req.reqId, 400, "invalid_role", "Invalid role");

    try {
      await store.createUser({ username, password, role });
      await store.logAudit(req.auth.user.id, "user.create", { username, role });
      ok(res);
    } catch (_err) {
      fail(res, req.reqId, 400, "username_exists", "Username already exists");
    }
  });

  app.patch("/admin/api/users/:id", auth(), requireRole("superadmin"), async (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) return fail(res, req.reqId, 400, "invalid_id", "Invalid id");

    const user = await store.getUserById(id);
    if (!user) return fail(res, req.reqId, 404, "not_found", "User not found");

    const role = req.body?.role ? String(req.body.role) : user.role;
    const isActive = typeof req.body?.is_active === "number" ? req.body.is_active : user.is_active;
    const password = String(req.body?.password || "").trim();

    if (!["manager", "superadmin"].includes(role)) return fail(res, req.reqId, 400, "invalid_role", "Invalid role");
    if (![0, 1].includes(Number(isActive))) return fail(res, req.reqId, 400, "invalid_active", "Invalid active flag");

    await store.updateUser({ id, role, isActive: Number(isActive), password });
    await store.logAudit(req.auth.user.id, "user.update", {
      id,
      role,
      is_active: Number(isActive),
      password_changed: !!password,
    });
    ok(res);
  });

  app.get("/admin/api/site-content", auth(), async (_req, res) => {
    const content = await store.listSiteContent();
    ok(res, { content });
  });

  app.put("/admin/api/site-content", auth(), async (req, res) => {
    const payload = req.body?.content;
    if (!payload || typeof payload !== "object") return fail(res, req.reqId, 400, "invalid_payload", "Invalid payload");

    const updates = {};
    const allowedKeys = Object.keys(SITE_CONTENT_DEFAULTS);
    for (const key of allowedKeys) {
      if (Object.prototype.hasOwnProperty.call(payload, key)) {
        updates[key] = String(payload[key] || "").trim();
      }
    }

    await store.upsertSiteContent(updates);
    await store.logAudit(req.auth.user.id, "site_content.update", updates);
    ok(res);
  });

  app.get("/admin/api/activity", auth(), requireRole("superadmin"), async (_req, res) => {
    const logs = await store.listActivity(300);
    ok(res, { logs });
  });

  app.get("/admin/api/stats", auth(), async (_req, res) => {
    const counts = await store.getLeadStatusCounts();
    const byStatus = Object.fromEntries(LEAD_STATUSES.map((s) => [s, 0]));
    counts.forEach((row) => {
      byStatus[row.status || "new"] = row.total;
    });
    const total = Object.values(byStatus).reduce((a, b) => a + Number(b), 0);
    ok(res, { total, byStatus, managerChatBound: !!getManagerChatId() });
  });

  app.use("/admin", express.static(config.adminDir));

  app.use((err, req, res, _next) => {
    logger.error("request.failed", {
      reqId: req?.reqId,
      method: req?.method,
      path: req?.path,
      error: err?.message || "unknown_error",
    });
    if (res.headersSent) return;
    fail(res, req?.reqId || "n/a", 500, "internal_error", "Internal error");
  });

  app.listen(config.port, () => {
    logger.info("server.started", { port: config.port });
  });
}

module.exports = { createApiServer };
