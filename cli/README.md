# @johnmcswain/gas-craft

The official CLI for the **gas-craft
** framework — scaffold, lint, and manage Google Apps Script projects from your terminal.

gas-craft
 is a lightweight Google Apps Script library designed to simplify education and prototyping. This CLI is an **optional companion tool** for developers and students who prefer a local workflow. It wraps Google's [clasp](https://github.com/google/clasp) to provide framework-aware scaffolding, linting, and deployment.

> **Don't need local tooling?** You can use gas-craft
 as a pure Apps Script library with zero CLI setup. See the [gas-craft
 Framework README](https://github.com/johnmcswain/gas-craft) for details.

## Installation

```bash
# Run directly (no install needed)
npx @johnmcswain/gas-craft init my-project

# Or install globally
npm install -g @johnmcswain/gas-craft
```

### Prerequisites

- **Node.js** >= 16
- A **Google account** with access to [Google Apps Script](https://script.google.com)
- **Google Apps Script API** enabled in [User Settings](https://script.google.com/home/usersettings) (required by [clasp](https://www.npmjs.com/package/@google/clasp))

<img src="https://user-images.githubusercontent.com/744973/54870967-a9135780-4d6a-11e9-991c-9f57a508bdf0.gif" />

## Quick Start

```bash
# 1. Create a new project (opens browser to log into Google)
npx gas-craft init my-project

# 2. Install dependencies
cd my-project
npm install

# 3. Write your code in src/Code.gs, then lint it
npx gas-craft lint

# 4. Deploy to Google Apps Script
npx clasp push
```

## Commands

### `gas-craft init <projectName>`

Scaffold a new gas-craft
 project and link it to Google Apps Script.

```bash
gas-craft init my-project
gas-craft init my-project --type webapp
gas-craft init my-project --no-clasp
```

**What it creates:**

```
my-project/
├── src/
│   ├── appsscript.json      # GAS manifest (V8 runtime)
│   └── Code.gs              # Starter file with examples
├── eslint.config.js          # ESLint config for .gs files
├── .clasp.json               # Clasp project link
├── .gitignore
└── package.json              # npm scripts: push, pull, lint, test
```

**What it does:**

1. Creates the directory structure and starter files
2. Generates an ESLint config pre-loaded with all GAS and gas-craft
 globals
3. Runs `clasp login` (opens browser for Google auth)
4. Runs `clasp create` to link a new Apps Script project

| Option | Description | Default |
|---|---|---|
| `--type <type>` | Apps Script project type: `sheets`, `docs`, `slides`, `forms`, `webapp`, `api` | `sheets` |
| `--no-clasp` | Skip Google login and project creation (set up manually later) | — |

---

### `gas-craft lint`

Lint `.gs` and `.js` files for syntax errors, undefined variables, and style issues. Powered by [ESLint](https://eslint.org/) with GAS-aware configuration.

```bash
gas-craft lint              # lint all files in src/
gas-craft lint --fix        # auto-fix what's possible
gas-craft lint --src lib    # lint a different directory
```

**What it checks:**

- Undefined variables (`no-undef`) — catches typos in GAS service names
- Unused variables (`no-unused-vars`)
- Unreachable code, empty blocks, accidental `==` instead of `===`
- All GAS globals (`SpreadsheetApp`, `UrlFetchApp`, etc.) are pre-registered
- All gas-craft
 globals (`Sheet`, `Http`, `Auth`, `Log`, `Errors`) are pre-registered

If your project has an `eslint.config.js`, it uses that. Otherwise, a sensible default config is generated automatically.

| Option | Description | Default |
|---|---|---|
| `--fix` | Auto-fix problems where possible | — |
| `--src <dir>` | Source directory to lint | `src` |

---

### `gas-craft add <recipe>`

Add a pre-built recipe module to your project.

```bash
gas-craft add recipe:mail-merge
```

Copies the recipe `.gs` file into your `src/recipes/` directory. Deploy with `clasp push`.

---

### `gas-craft test`

Push code to Google and run remote tests.

```bash
gas-craft test
```

1. Runs `clasp push` to upload your code
2. Invokes the `testRunner()` function in your Apps Script project via `clasp run`
3. Streams results back to your terminal

> **Note:** Your project must export a `testRunner()` function. See the [testing guide](https://github.com/johnmcswain/gas-craft#testing) for setup instructions.

---

### `gas-craft docs`

Generate Markdown API documentation from JSDoc comments.

```bash
gas-craft docs
```

Scans all `.gs` and `.js` files in `src/`, extracts `/** ... */` blocks, and writes a `DOCS.md` file.

---

## gas-craft
 Framework Modules

Projects scaffolded with `gas-craft init` have access to these modules (provided via the gas-craft
 library):

| Module | Purpose | Example |
|---|---|---|
| `Sheet` | Read/write spreadsheet data | `Sheet.readAll("Contacts")` |
| `Http` | Simplified API calls | `Http.getJson("https://api.example.com/data")` |
| `Auth` | OAuth2 authentication | `Auth.connect("github", { clientId, ... })` |
| `Log` | Structured logging | `Log.info("Processed 10 rows")` |
| `Errors` | Error handling + `wrap()` decorator | `const safe = Errors.wrap(myFunction)` |

### npm Scripts

Every scaffolded project includes these convenience scripts:

```bash
npm run push      # clasp push
npm run pull      # clasp pull
npm run open      # clasp open (opens in browser)
npm run lint      # gas-craft lint
npm run test      # gas-craft test
```

## Configuration

### ESLint

The `init` command generates an `eslint.config.js` using the [ESLint flat config](https://eslint.org/docs/latest/use/configure/configuration-files) format. It includes:

- [`eslint-plugin-googleappsscript`](https://www.npmjs.com/package/eslint-plugin-googleappsscript) — registers all GAS globals
- gas-craft
 module globals (`Sheet`, `Http`, `Auth`, `Log`, `Errors`)
- Sensible defaults for educational code (warnings over errors where possible)

You can customize rules by editing `eslint.config.js` in your project root.

### Clasp

The CLI wraps clasp for project setup but does not replace it. You can use any clasp command directly:

```bash
npx clasp push          # deploy code
npx clasp pull          # pull remote changes
npx clasp open          # open in Apps Script editor
npx clasp deployments   # list deployments
```

## Compatibility

| Requirement | Version |
|---|---|
| Node.js | >= 16 |
| clasp | >= 2.4 |
| ESLint | >= 9.0 (flat config) |
| Google Apps Script | V8 runtime |

## Related

- [gas-craft
 Framework](https://github.com/johnmcswain/gas-craft) — the full framework (library + curriculum + CLI)
- [Google clasp](https://github.com/google/clasp) — official GAS CLI
- [eslint-plugin-googleappsscript](https://www.npmjs.com/package/eslint-plugin-googleappsscript) — ESLint plugin for GAS
- [@types/google-apps-script](https://www.npmjs.com/package/@types/google-apps-script) — TypeScript definitions for GAS

## Contributing

Contributions are welcome. Please open an issue or pull request on the [GitHub repository](https://github.com/johnmcswain/gas-craft).

## License

[MIT](./LICENSE) — John McSwain
