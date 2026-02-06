# gas-craft
 Framework

**gas-craft** is a lightweight, zero-friction Google Apps Script (GAS) library designed to simplify education and prototyping. It provides a collection of utility wrappers and composable "recipe" modules that allow students and developers to build powerful automations without getting bogged down in boilerplate code.

## 🚀 Getting Started

No installation, CLI, or local tooling is required. You can add the library directly to your Google Apps Script project.

### Library Details
- **Script ID:** `1pXigysst-qyh4xUfH6wZFXLv9PpltRWLNvU76mhSwIbmYGRwgwPysBqr`
- **Link:** [gas-craft
 Library](https://script.google.com/d/1pXigysst-qyh4xUfH6wZFXLv9PpltRWLNvU76mhSwIbmYGRwgwPysBqr/edit?usp=sharing)

### How to Add
1. Open your Google Apps Script project.
2. Click **Libraries** (+) in the sidebar.
3. Paste the **Script ID** above and click **Look up**.
4. Select the latest version and click **Add**.

---

## 📦 Features

### Utility Modules
Wrappers that simplify common patterns and reduce boilerplate:
- **Sheet Operations:** Batch read/write helpers.
- **API Pagination:** Simple handling of paginated API responses.
- **Logging:** Structured logging to a dedicated "Logs" sheet.
- **Auth:** OAuth2 token management.
- **Error Handling:** Writes friendly messages to the spreadsheet instead of silently failing.

### Recipe Modules
Composable, single-purpose functions for common educational use cases:
- **Form Router:** Route Google Form responses to different destinations.
- **Mail Merge:** Simple Sheet-to-email merge functionality.
- **Webhook Receiver:** Easily handle incoming webhooks.
- **Gemini API:** Wrapper for calling Google's Gemini API.

### Bootstrap
- **`gasCraft.init()`**: A single function call that sets up a configuration sheet, creates menu items, and scaffolds necessary triggers.

---

## 📚 Curriculum Kit

Located in the `/curriculum` directory, this kit contains resources for instructors:
- **Assignment Templates:** Google Docs (linked) and companion starter script projects.
- **Instructor Guide:** Structure for a 4-week or 8-week GAS unit.
- **Grading Rubric & Helper:** Tools for evaluating student submissions.
- **Showcase Assignment:** A guide for students to contribute a recipe back to the framework.

---

## 🛠️ CLI (Optional Power-User Path)

For advanced users or those preferring a local development workflow, `gas-script` is available as an npm package.

```bash
# Initialize a new project with boilerplate
npx gas-script init my-project

# Add a specific recipe
npx gas-script add recipe:sheet-to-email

# Run remote tests
npx gas-script test

# Generate documentation
npx gas-script docs
```

## 📖 Documentation

Visit the [Documentation Site](#) (Coming Soon) for:
- Getting Started Guide
- Recipe Catalog

---

**Author:** John McSwain  
**Repository:** [github.com/johnmcswain/gas-craft](https://github.com/johnmcswain/gas-craft)
