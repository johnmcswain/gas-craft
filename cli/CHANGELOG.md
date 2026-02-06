# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.2.0] - 2026-02-06

### Added
- **`gas-craft lint` command** — lint `.gs` and `.js` files using ESLint with GAS-aware configuration.
  - `--fix` flag for auto-fixing problems.
  - `--src <dir>` flag to lint a custom directory.
  - Auto-generates a default ESLint config if none exists in the project.
  - Pre-registers all Google Apps Script and gas-craft
 globals.
- **`gas-craft init` enhancements:**
  - Auto-runs `clasp login` and `clasp create` during scaffolding.
  - `--type` flag to choose project type (sheets, docs, slides, forms, webapp, api).
  - `--no-clasp` flag to skip Google setup for offline/manual workflows.
  - Generates `eslint.config.js` (ESLint flat config format) in scaffolded projects.
  - Scaffolded `package.json` includes npm scripts: `push`, `pull`, `open`, `lint`, `test`.
- **`gas-craft docs` command** — generates `DOCS.md` from JSDoc comments in `.gs` files.
- Starter `Code.gs` now includes commented examples for all gas-craft
 modules.

### Changed
- Bumped CLI version to 0.2.0.
- Updated clasp dependency to `^3.0.0`.

## [0.1.0] - 2026-01-15

### Added
- Initial release.
- `gas-craft init <projectName>` — scaffold a new gas-craft
 project.
- `gas-craft add recipe:<name>` — add a recipe module to the project.
- `gas-craft test` — push code and run remote tests via clasp.
- `gas-craft docs` — placeholder for documentation generation.
