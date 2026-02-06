#!/usr/bin/env node
const { Command } = require('commander');
const fs = require('fs-extra');
const path = require('path');
const shell = require('shelljs');

const program = new Command();

program
  .name('gas-craft')
  .description('CLI to scaffold and manage GasCraft projects')
  .version('0.2.0');

// ─── Helpers ──────────────────────────────────────────────────────────

/**
 * Run a shell command and exit on failure.
 * @param {string} cmd
 * @param {string} errorMsg
 * @param {Object} [opts] - shelljs exec options
 * @return {Object} shelljs result
 */
function run(cmd, errorMsg, opts) {
  const result = shell.exec(cmd, opts || {});
  if (result.code !== 0) {
    console.error('Error: ' + (errorMsg || cmd + ' failed'));
    process.exit(1);
  }
  return result;
}

// ─── Command: init ────────────────────────────────────────────────────

program.command('init')
  .argument('<projectName>', 'Name of the new project directory')
  .option('--type <type>', 'Apps Script project type (sheets, docs, slides, forms, webapp, api)', 'sheets')
  .option('--no-clasp', 'Skip clasp login and project creation (manual setup later)')
  .description('Initialize a new gas-craft project and link it to Google Apps Script')
  .action((projectName, opts) => {
    console.log(`\n  Initializing gas-craft project: ${projectName}\n`);

    // 1. Create project directory
    if (fs.existsSync(projectName)) {
      console.error(`Error: Directory '${projectName}' already exists.`);
      process.exit(1);
    }
    fs.mkdirSync(projectName);

    const projectDir = path.resolve(projectName);
    const srcDir = path.join(projectDir, 'src');
    fs.ensureDirSync(srcDir);

    // 2. appsscript.json manifest
    const manifest = {
      timeZone: 'America/New_York',
      dependencies: {},
      exceptionLogging: 'STACKDRIVER',
      runtimeVersion: 'V8'
    };
    fs.writeJsonSync(path.join(srcDir, 'appsscript.json'), manifest, { spaces: 2 });

    // 3. Code.gs starter file
    const starterCode = `/**
 * gas-craft Starter Project
 *
 * Available modules:
 *   Sheet.readAll(name)        - read spreadsheet data as objects
 *   Http.getJson(url)          - fetch JSON from any API
 *   Auth.connect(name, config) - OAuth2 login to external services
 *   Log.info(message)          - structured logging
 *   Errors.wrap(fn)            - automatic error handling
 */
function onOpen() {
  GasCraft.init();
}

function start() {
  // Example: read data from a sheet
  // const rows = Sheet.readAll("Sheet1");
  // Log.info("Got " + rows.length + " rows");

  // Example: call an API
  // const data = Http.getJson("https://jsonplaceholder.typicode.com/todos/1");
  // Log.info("API response", data);

  Log.info("Hello from gas-craft!");
}
`;
    fs.writeFileSync(path.join(srcDir, 'Code.gs'), starterCode);

    // 4. package.json for the user project
    const projectPackage = {
      name: projectName,
      version: '1.0.0',
      scripts: {
        push: 'clasp push',
        pull: 'clasp pull',
        open: 'clasp open',
        lint: 'gas-craft lint',
        test: 'gas-craft test'
      },
      devDependencies: {
        '@google/clasp': '^3.0.0',
        '@types/google-apps-script': '^1.0.0',
        '@johnmcswain/gas-craft': '^0.2.0',
        'eslint': '^9.0.0',
        'eslint-plugin-googleappsscript': '^1.0.6'
      }
    };
    fs.writeJsonSync(path.join(projectDir, 'package.json'), projectPackage, { spaces: 2 });

    // 5. ESLint flat config (eslint.config.js)
    const eslintConfig = `const googleappsscript = require("eslint-plugin-googleappsscript");

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

        // gas-craft framework globals
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
`;
    fs.writeFileSync(path.join(projectDir, 'eslint.config.js'), eslintConfig);

    // 6. .gitignore
    const gitignore = `node_modules/
.clasp.json
creds.json
.DS_Store
`;
    fs.writeFileSync(path.join(projectDir, '.gitignore'), gitignore);

    console.log('  Created project structure:');
    console.log(`    ${projectName}/`);
    console.log('    ├── src/');
    console.log('    │   ├── appsscript.json');
    console.log('    │   └── Code.gs');
    console.log('    ├── eslint.config.js');
    console.log('    ├── .gitignore');
    console.log('    └── package.json\n');

    // 7. Auto-run clasp login + create (unless --no-clasp)
    if (opts.clasp) {
      console.log('  Setting up Google Apps Script connection...\n');

      // Check if clasp is available
      if (!shell.which('clasp') && !shell.which('npx')) {
        console.log('  clasp not found. Run these manually after npm install:');
        console.log(`    cd ${projectName}`);
        console.log('    npx clasp login');
        console.log(`    npx clasp create --type ${opts.type} --rootDir src\n`);
      } else {
        const claspCmd = shell.which('clasp') ? 'clasp' : 'npx clasp';

        // Check if already logged in by trying clasp list (silent)
        const loginCheck = shell.exec(`${claspCmd} list`, { silent: true });
        if (loginCheck.code !== 0) {
          console.log('  Logging into Google (a browser window will open)...\n');
          shell.exec(`${claspCmd} login`, { cwd: projectDir });
        } else {
          console.log('  Already logged into Google.\n');
        }

        // Create the Apps Script project
        console.log(`  Creating Apps Script project (type: ${opts.type})...\n`);
        const createResult = shell.exec(
          `${claspCmd} create --title "${projectName}" --type ${opts.type} --rootDir src`,
          { cwd: projectDir }
        );

        if (createResult.code === 0) {
          console.log('\n  Apps Script project linked!\n');
        } else {
          console.log('\n  Could not auto-create project. Run manually:');
          console.log(`    cd ${projectName}`);
          console.log(`    npx clasp create --type ${opts.type} --rootDir src\n`);
        }
      }
    } else {
      // --no-clasp: write a placeholder .clasp.json
      const claspConfig = {
        scriptId: '',
        rootDir: 'src'
      };
      fs.writeJsonSync(path.join(projectDir, '.clasp.json'), claspConfig, { spaces: 2 });

      console.log('  Skipped clasp setup. When you\'re ready:\n');
      console.log(`    cd ${projectName}`);
      console.log('    npm install');
      console.log('    npx clasp login');
      console.log(`    npx clasp create --type ${opts.type} --rootDir src\n`);
    }

    console.log('  Next steps:');
    console.log(`    cd ${projectName}`);
    console.log('    npm install');
    console.log('    npx gas-craft lint        # check your code');
    console.log('    npx clasp push            # deploy to Google\n');
  });

// ─── Command: lint ────────────────────────────────────────────────────

program.command('lint')
  .option('--fix', 'Auto-fix problems where possible')
  .option('--src <dir>', 'Source directory to lint', 'src')
  .description('Lint .gs and .js files for syntax errors and style issues')
  .action((opts) => {
    const srcDir = path.resolve(opts.src);

    if (!fs.existsSync(srcDir)) {
      console.error(`Error: Source directory not found: ${srcDir}`);
      process.exit(1);
    }

    // Collect all .gs and .js files
    const files = collectFiles(srcDir, ['.gs', '.js']);
    if (files.length === 0) {
      console.log('No .gs or .js files found in ' + opts.src);
      return;
    }

    console.log(`\n  Linting ${files.length} file(s) in ${opts.src}/...\n`);

    // Check for ESLint config in project root
    const projectRoot = findProjectRoot(srcDir);
    const hasConfig = fs.existsSync(path.join(projectRoot, 'eslint.config.js'))
      || fs.existsSync(path.join(projectRoot, 'eslint.config.mjs'));

    // Build ESLint command
    // ESLint doesn't know .gs extension by default, so we pass files explicitly
    // and tell ESLint to treat them as JS
    const eslintBin = resolveEslint(projectRoot);

    if (!eslintBin) {
      console.error('  ESLint not found. Install it:');
      console.error('    npm install --save-dev eslint eslint-plugin-googleappsscript\n');
      process.exit(1);
    }

    // Create a temporary config if the project doesn't have one
    let tempConfig = null;
    if (!hasConfig) {
      tempConfig = path.join(projectRoot, '.eslint.gascraft.tmp.js');
      fs.writeFileSync(tempConfig, generateDefaultConfig());
    }

    const configFlag = tempConfig ? ` --config "${tempConfig}"` : '';
    const fixFlag = opts.fix ? ' --fix' : '';

    // ESLint doesn't natively handle .gs — pass the files with --ext override
    // For flat config, we pass files directly since --ext is deprecated
    const fileList = files.map(f => `"${f}"`).join(' ');
    const cmd = `"${eslintBin}"${configFlag}${fixFlag} ${fileList}`;

    const result = shell.exec(cmd, { silent: false });

    // Clean up temp config
    if (tempConfig && fs.existsSync(tempConfig)) {
      fs.removeSync(tempConfig);
    }

    if (result.code === 0) {
      console.log('\n  No lint errors found.\n');
    } else if (result.code === 1) {
      console.log('\n  Lint issues found (see above).');
      if (!opts.fix) {
        console.log('  Run with --fix to auto-fix what\'s possible.\n');
      }
      process.exit(1);
    } else {
      console.error('\n  Linter encountered an error. Check the output above.\n');
      process.exit(result.code);
    }
  });

/**
 * Walk a directory and collect files with given extensions.
 * @param {string} dir
 * @param {string[]} extensions
 * @return {string[]}
 */
function collectFiles(dir, extensions) {
  let results = [];
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      results = results.concat(collectFiles(full, extensions));
    } else if (extensions.some(ext => entry.name.endsWith(ext))) {
      results.push(full);
    }
  }
  return results;
}

/**
 * Walk up from a directory to find the nearest package.json (project root).
 * @param {string} startDir
 * @return {string}
 */
function findProjectRoot(startDir) {
  let dir = startDir;
  while (dir !== path.dirname(dir)) {
    if (fs.existsSync(path.join(dir, 'package.json'))) return dir;
    dir = path.dirname(dir);
  }
  return process.cwd();
}

/**
 * Find the ESLint binary: local node_modules first, then global.
 * @param {string} projectRoot
 * @return {string|null}
 */
function resolveEslint(projectRoot) {
  // Local node_modules
  const localBin = path.join(projectRoot, 'node_modules', '.bin', 'eslint');
  const localBinCmd = localBin + (process.platform === 'win32' ? '.cmd' : '');
  if (fs.existsSync(localBinCmd)) return localBinCmd;
  if (fs.existsSync(localBin)) return localBin;

  // Global
  const global = shell.which('eslint');
  if (global) return global.toString();

  return null;
}

/**
 * Generate a default ESLint flat config for projects without one.
 * @return {string}
 */
function generateDefaultConfig() {
  return `module.exports = [
  {
    files: ["**/*.gs", "**/*.js"],
    languageOptions: {
      ecmaVersion: 2020,
      sourceType: "script",
      globals: {
        // Google Apps Script built-in services
        Browser: "readonly", CacheService: "readonly", CalendarApp: "readonly",
        CardService: "readonly", Charts: "readonly", ContactsApp: "readonly",
        ContentService: "readonly", DocumentApp: "readonly", DriveApp: "readonly",
        FormApp: "readonly", GmailApp: "readonly", GroupsApp: "readonly",
        HtmlService: "readonly", Jdbc: "readonly", LanguageApp: "readonly",
        LockService: "readonly", Logger: "readonly", MailApp: "readonly",
        Maps: "readonly", MimeType: "readonly", PropertiesService: "readonly",
        ScriptApp: "readonly", Session: "readonly", SlidesApp: "readonly",
        SpreadsheetApp: "readonly", UrlFetchApp: "readonly", Utilities: "readonly",
        XmlService: "readonly", console: "readonly", OAuth2: "readonly",
        HtmlOutput: "readonly",

        // gas-craft globals
        GasCraft: "readonly", Sheet: "readonly", Http: "readonly",
        Auth: "readonly", Log: "readonly", Errors: "readonly",
        MailMerge: "readonly", SheetUtils: "readonly", ErrorHandler: "readonly"
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
`;
}

// ─── Command: add ─────────────────────────────────────────────────────

program.command('add')
  .argument('<recipeName>', 'Recipe to add (e.g., recipe:mail-merge)')
  .description('Add a recipe module to the project')
  .action((recipeName) => {
    // Normalize: "recipe:mail-merge" -> "MailMerge"
    let cleanName = recipeName.replace('recipe:', '');
    cleanName = cleanName.replace(/-./g, x => x[1].toUpperCase());
    cleanName = cleanName.charAt(0).toUpperCase() + cleanName.slice(1);

    const fileName = cleanName + '.gs';

    // Locate the recipe in the repo
    const repoRecipeDir = path.resolve(__dirname, '..', '..', 'src', 'recipes');
    const sourcePath = path.join(repoRecipeDir, fileName);

    if (!fs.existsSync(sourcePath)) {
      console.error(`Error: Recipe not found: ${fileName}`);
      console.log('Available recipes:');
      if (fs.existsSync(repoRecipeDir)) {
        fs.readdirSync(repoRecipeDir)
          .filter(f => f.endsWith('.gs'))
          .forEach(f => console.log('  - recipe:' + f.replace('.gs', '').replace(/([A-Z])/g, '-$1').toLowerCase().replace(/^-/, '')));
      }
      return;
    }

    const targetDir = path.join(process.cwd(), 'src', 'recipes');
    fs.ensureDirSync(targetDir);

    const targetPath = path.join(targetDir, fileName);
    fs.copySync(sourcePath, targetPath);

    console.log(`\nSuccess! Added ${cleanName} to src/recipes/${fileName}`);
    console.log('Deploy with: npx clasp push');
  });

// ─── Command: test ────────────────────────────────────────────────────

program.command('test')
  .description('Push code and run remote tests via clasp')
  .action(() => {
    console.log('Running remote tests...\n');

    run('clasp push', 'clasp push failed');

    console.log('Invoking remote TestRunner...');
    const result = shell.exec('clasp run testRunner');

    if (result.code !== 0) {
      console.error('Error: Remote execution failed.');
      console.error('Make sure your project has a testRunner() function.');
      process.exit(1);
    }

    console.log('Test Results:', result.stdout);
  });

// ─── Command: docs ────────────────────────────────────────────────────

program.command('docs')
  .description('Generate Markdown documentation from JSDoc')
  .action(() => {
    console.log('Generating documentation...');

    const srcDir = path.resolve('src');
    if (!fs.existsSync(srcDir)) {
      console.error('Error: No src/ directory found.');
      process.exit(1);
    }

    const files = collectFiles(srcDir, ['.gs', '.js']);
    const docBlocks = [];

    files.forEach((file) => {
      const content = fs.readFileSync(file, 'utf8');
      const jsdocPattern = /\/\*\*[\s\S]*?\*\//g;
      const matches = content.match(jsdocPattern);
      if (matches) {
        const relPath = path.relative(process.cwd(), file);
        docBlocks.push(`## ${relPath}\n`);
        matches.forEach((block) => {
          docBlocks.push('```\n' + block + '\n```\n');
        });
      }
    });

    if (docBlocks.length === 0) {
      console.log('No JSDoc blocks found.');
      return;
    }

    const output = '# gas-craft API Documentation\n\n' + docBlocks.join('\n');
    fs.writeFileSync('DOCS.md', output);
    console.log('Generated DOCS.md with ' + docBlocks.length + ' sections.');
  });

program.parse();
