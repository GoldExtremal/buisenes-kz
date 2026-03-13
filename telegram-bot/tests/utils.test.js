const test = require("node:test");
const assert = require("node:assert/strict");

const { normalizeUsername, isValidName, isValidPhone, escapeHtml } = require("../src/utils");

test("normalizeUsername strips @ and lowercases", () => {
  assert.equal(normalizeUsername("@GoldExtremal"), "goldextremal");
  assert.equal(normalizeUsername(" TeStUser "), "testuser");
});

test("isValidName validates basic human names", () => {
  assert.equal(isValidName("Иван Петров"), true);
  assert.equal(isValidName("A"), false);
  assert.equal(isValidName("John123"), false);
});

test("isValidPhone validates international style", () => {
  assert.equal(isValidPhone("+77021234567"), true);
  assert.equal(isValidPhone("+7 (702) 123-45-67"), true);
  assert.equal(isValidPhone("12345"), false);
});

test("escapeHtml protects special symbols", () => {
  assert.equal(escapeHtml('<b>"&'), "&lt;b&gt;&quot;&amp;");
});
