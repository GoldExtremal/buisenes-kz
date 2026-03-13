const fs = require("fs");
const path = require("path");
const sqlite3 = require("sqlite3").verbose();

const dbPath = process.env.DB_PATH || "bot.db";
const migrationsDir = path.resolve(__dirname, "..", "db", "migrations");
const dbFile = path.resolve(__dirname, "..", dbPath);

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

async function main() {
  const db = new sqlite3.Database(dbFile);
  try {
    await run(
      db,
      "CREATE TABLE IF NOT EXISTS schema_migrations (version TEXT PRIMARY KEY, applied_at TEXT NOT NULL)"
    );

    const files = fs
      .readdirSync(migrationsDir)
      .filter((f) => f.endsWith(".sql"))
      .sort();

    for (const file of files) {
      const version = file.replace(/\.sql$/, "");
      const exists = await get(db, "SELECT version FROM schema_migrations WHERE version = ?", [version]);
      if (exists) {
        console.log(`skip ${file}`);
        continue;
      }

      const sql = fs.readFileSync(path.join(migrationsDir, file), "utf8");
      await exec(db, sql);
      await run(db, "INSERT INTO schema_migrations(version, applied_at) VALUES(?, datetime('now'))", [
        version,
      ]);
      console.log(`applied ${file}`);
    }

    console.log("migrations complete");
  } finally {
    db.close();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
