const fs = require("fs");
const path = require("path");
const sqlite3 = require("sqlite3").verbose();

function run(db, sql, params = []) {
  return new Promise((resolve, reject) => {
    db.run(sql, params, (err) => {
      if (err) reject(err);
      else resolve();
    });
  });
}

function get(db, sql, params = []) {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => {
      if (err) reject(err);
      else resolve(row);
    });
  });
}

function exec(db, sql) {
  return new Promise((resolve, reject) => {
    db.exec(sql, (err) => {
      if (err) reject(err);
      else resolve();
    });
  });
}

async function applyMigrations({ dbFile, migrationsDir }) {
  const resolvedMigrationsDir =
    migrationsDir || path.resolve(__dirname, "..", "db", "migrations");

  const db = new sqlite3.Database(dbFile);
  try {
    await run(
      db,
      "CREATE TABLE IF NOT EXISTS schema_migrations (version TEXT PRIMARY KEY, applied_at TEXT NOT NULL)"
    );

    const files = fs
      .readdirSync(resolvedMigrationsDir)
      .filter((f) => f.endsWith(".sql"))
      .sort();

    let applied = 0;
    for (const file of files) {
      const version = file.replace(/\.sql$/, "");
      const exists = await get(
        db,
        "SELECT version FROM schema_migrations WHERE version = ?",
        [version]
      );
      if (exists) continue;

      const sql = fs.readFileSync(path.join(resolvedMigrationsDir, file), "utf8");
      await exec(db, sql);
      await run(
        db,
        "INSERT INTO schema_migrations(version, applied_at) VALUES(?, datetime('now'))",
        [version]
      );
      applied += 1;
    }

    return { applied, total: files.length };
  } finally {
    db.close();
  }
}

module.exports = { applyMigrations };
