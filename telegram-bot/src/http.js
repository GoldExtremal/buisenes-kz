class HttpError extends Error {
  constructor(status, code, message) {
    super(message || code);
    this.status = status;
    this.code = code;
  }
}

function createRequestId() {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

function fail(res, reqId, status, code, message) {
  return res.status(status).json({
    ok: false,
    error: { code, message: message || code, requestId: reqId },
  });
}

function ok(res, payload = {}) {
  return res.json({ ok: true, ...payload });
}

module.exports = { HttpError, createRequestId, fail, ok };
