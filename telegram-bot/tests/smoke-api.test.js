const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("path");
const os = require("os");
const fs = require("fs");

const { createStore } = require("../src/store");
const { createApiServer } = require("../src/api");
const { SITE_CONTENT_DEFAULTS } = require("../src/constants");

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

test("smoke: public lead flow and admin auth", async () => {
  const dbFile = path.join(os.tmpdir(), `bkz-smoke-${Date.now()}.db`);
  const adminDir = path.resolve(__dirname, "..", "admin");

  const store = createStore({
    dbFile,
    adminUsername: "admin",
    adminPassword: "StrongAdmin123!",
    sessionTtlHours: 24,
    siteContentDefaults: SITE_CONTENT_DEFAULTS,
  });
  await store.initDb();

  const { server } = createApiServer({
    config: {
      port: 3105,
      webAllowedOrigins: ["http://localhost:5173"],
      adminDir,
      authCookieName: "bkz_admin_token",
      authCookieSecure: false,
      sessionTtlHours: 24,
    },
    store,
    getSourceLabel: (s) => s || "site_quick_form",
    notifyManager: async () => {},
    getManagerChatId: () => null,
  });

  try {
    await sleep(100);

    const leadResp = await fetch("http://127.0.0.1:3105/api/site-lead", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: "Иван Иванов",
        phone: "+77021234567",
        service: "ИИН/БИН",
        source: "smoke_test",
      }),
    });
    assert.equal(leadResp.status, 200);
    const leadJson = await leadResp.json();
    assert.equal(leadJson.ok, true);
    assert.ok(leadJson.leadId > 0);

    const loginResp = await fetch("http://127.0.0.1:3105/admin/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        username: "admin",
        password: "StrongAdmin123!",
      }),
    });
    assert.equal(loginResp.status, 200);
    const loginJson = await loginResp.json();
    assert.equal(loginJson.ok, true);
    assert.ok(loginJson.token);

    const leadsResp = await fetch("http://127.0.0.1:3105/admin/api/leads", {
      headers: {
        Authorization: `Bearer ${loginJson.token}`,
      },
    });
    assert.equal(leadsResp.status, 200);
    const leadsJson = await leadsResp.json();
    assert.equal(leadsJson.ok, true);
    assert.ok(Array.isArray(leadsJson.leads));
    assert.ok(leadsJson.leads.length >= 1);
  } finally {
    await new Promise((resolve) => server.close(resolve));
    try {
      fs.unlinkSync(dbFile);
    } catch (_err) {
      // ignore cleanup errors
    }
  }
});
