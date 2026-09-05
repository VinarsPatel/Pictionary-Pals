const js = require("@eslint/js")
const globals = require("globals")

module.exports = [
  js.configs.recommended,
  {
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: "commonjs",
      globals: {
        ...globals.node,
      },
    },
    rules: {
      eqeqeq: ["error", "smart"], // allows the `x == null` idiom (matches null or undefined)
      "no-unused-vars": ["warn", { argsIgnorePattern: "^_" }],
    },
  },
  {
    ignores: ["node_modules/", "data/"],
  },
]
