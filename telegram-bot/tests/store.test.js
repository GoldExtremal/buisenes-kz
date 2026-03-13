const test = require("node:test");
const assert = require("node:assert/strict");

const { createStore } = require("../src/store");

function buildStore() {
  return createStore({
    dbFile: ":memory:",
    adminUsername: "admin",
    adminPassword: "Admin12345!",
    sessionTtlHours: 24,
    siteContentDefaults: {
      hero_title: "Hero",
      hero_lead: "Lead",
      contacts_title: "Contacts",
      contacts_address: "Address",
      phone_1: "+1",
      phone_2: "+2",
      email: "test@example.com",
      whatsapp_link: "https://wa.me/10000000000",
    },
  });
}

function closeStore(store) {
  return new Promise((resolve, reject) => {
    store.db.close((err) => {
      if (err) reject(err);
      else resolve();
    });
  });
}

test("store initializes, creates lead, user and session", async () => {
  const store = buildStore();
  try {
    await store.initDb();

    const leadMeta = await store.createLead({
      user_id: 1,
      username: "u1",
      name: "Test Client",
      phone: "+77021234567",
      service: "ИИН/БИН",
      timing: "1-3 рабочих дня",
      comment: "test",
      source: "site",
      channel: "site",
    });

    assert.ok(leadMeta.id > 0);

    const leads = await store.listLeads(10);
    assert.equal(leads.length, 1);
    assert.equal(leads[0].name, "Test Client");

    const admin = await store.getUserByUsername("admin");
    assert.ok(admin);
    assert.equal(store.verifyPassword("Admin12345!", admin.password_hash), true);

    const token = await store.createSession(admin.id);
    assert.ok(token);

    const session = await store.getSessionWithUser(token);
    assert.ok(session);
    assert.equal(session.username, "admin");

    const publicContent = await store.listSiteContentPublic();
    assert.ok(publicContent.length >= 1);
  } finally {
    await closeStore(store);
  }
});
