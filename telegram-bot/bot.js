const { bootstrap } = require("./src/bootstrap");

bootstrap().catch((err) => {
  console.error("Bot bootstrap failed:", err);
  process.exit(1);
});
