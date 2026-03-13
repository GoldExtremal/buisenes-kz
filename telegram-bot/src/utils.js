function normalizeUsername(username) {
  return String(username || "")
    .trim()
    .replace(/^@/, "")
    .toLowerCase();
}

function sanitizePhone(value) {
  return String(value || "")
    .replace(/[\s\-()]/g, "")
    .trim();
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

module.exports = {
  normalizeUsername,
  sanitizePhone,
  isValidPhone,
  isValidName,
  escapeHtml,
  nowStamp,
};
