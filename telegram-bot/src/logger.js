function createLogger(scope = "app") {
  function write(level, message, meta = {}) {
    const line = {
      ts: new Date().toISOString(),
      level,
      scope,
      message,
      ...meta,
    };
    const json = JSON.stringify(line);
    if (level === "error") {
      console.error(json);
    } else {
      console.log(json);
    }
  }

  return {
    info: (message, meta) => write("info", message, meta),
    warn: (message, meta) => write("warn", message, meta),
    error: (message, meta) => write("error", message, meta),
  };
}

module.exports = { createLogger };
