const googleappsscript = require("eslint-plugin-googleappsscript");

module.exports = [
  {
    files: ["src/**/*.gs", "src/**/*.js"],
    plugins: {
      googleappsscript: googleappsscript
    },
    languageOptions: {
      ecmaVersion: 2020,
      sourceType: "script",
      globals: {
        // Google Apps Script services
        ...googleappsscript.environments.googleappsscript.globals,

        // GasCraft framework globals
        GasCraft: "readonly",
        Sheet: "readonly",
        Http: "readonly",
        Auth: "readonly",
        Log: "readonly",
        Errors: "readonly",
        MailMerge: "readonly",

        // Backward-compatible aliases
        SheetUtils: "readonly",
        ErrorHandler: "readonly"
      }
    },
    rules: {
      "no-unused-vars": ["warn", { argsIgnorePattern: "^_" }],
      "no-undef": "error",
      "no-redeclare": "warn",
      "eqeqeq": ["warn", "smart"],
      "no-constant-condition": "warn",
      "no-debugger": "warn",
      "no-empty": "warn",
      "no-extra-semi": "warn",
      "no-unreachable": "error"
    }
  }
];
