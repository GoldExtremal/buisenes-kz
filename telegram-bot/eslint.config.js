const js = require("@eslint/js");
const globals = require("globals");

module.exports = [
  {
    ignores: ["node_modules/**", "bot.db", "backups/**", "db/**"],
  },
  js.configs.recommended,
  {
    files: ["**/*.js"],
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "script",
      globals: {
        ...globals.node,
      },
    },
    rules: {
      "no-console": "off",
      "no-unused-vars": [
        "error",
        {
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
          caughtErrorsIgnorePattern: "^_",
        },
      ],
      "no-empty": ["error", { allowEmptyCatch: true }],
    },
  },
  {
    files: ["admin/**/*.js"],
    languageOptions: {
      globals: {
        ...globals.browser,
      },
    },
  },
];
