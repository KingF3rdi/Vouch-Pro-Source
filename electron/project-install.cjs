/**
 * CJS project installer for Electron main (mirrors src/agent/projectInstall.ts).
 * Keeps Documents/Helix/Projects/Helix Workspace installed + managed files updated.
 */

const fs = require("fs");
const path = require("path");
const os = require("os");

const HELIX_APP_VERSION = "0.3.0";

function documentsDir() {
  if (process.env.HELIX_PROJECTS_ROOT) {
    return path.resolve(process.env.HELIX_PROJECTS_ROOT);
  }
  const home = os.homedir();
  if (process.platform === "win32") {
    return process.env.USERPROFILE
      ? path.join(process.env.USERPROFILE, "Documents")
      : path.join(home, "Documents");
  }
  const docs = path.join(home, "Documents");
  if (fs.existsSync(docs)) return docs;
  return home;
}

function defaultProjectsRoot() {
  return path.join(documentsDir(), "Helix", "Projects");
}

function defaultWorkspacePath(projectName = "Helix Workspace") {
  return path.join(defaultProjectsRoot(), projectName);
}

function writeIfMissing(full, content, created, skipped) {
  if (fs.existsSync(full)) {
    skipped.push(full);
    return;
  }
  fs.mkdirSync(path.dirname(full), { recursive: true });
  fs.writeFileSync(full, content, "utf8");
  created.push(full);
}

function writeManaged(full, content, updated, created) {
  const had = fs.existsSync(full);
  fs.mkdirSync(path.dirname(full), { recursive: true });
  fs.writeFileSync(full, content, "utf8");
  (had ? updated : created).push(full);
}

function starterPackageJson(name) {
  const slug =
    name
      .toLowerCase()
      .replace(/[^a-z0-9-_]+/g, "-")
      .replace(/^-|-$/g, "") || "helix-workspace";
  return (
    JSON.stringify(
      {
        name: slug,
        private: true,
        version: "0.1.0",
        type: "module",
        scripts: {
          dev: "tsx watch src/main.ts",
          build: "tsc -p tsconfig.json",
          typecheck: "tsc -p tsconfig.json --noEmit",
          start: "node dist/main.js",
        },
        devDependencies: {
          typescript: "^5.9.2",
          tsx: "^4.20.5",
          "@types/node": "^24.3.1",
        },
      },
      null,
      2
    ) + "\n"
  );
}

function installOrUpdateProjectSync(options = {}) {
  const projectsRoot = defaultProjectsRoot();
  const workspace =
    options.workspace ||
    process.env.HELIX_WORKSPACE ||
    defaultWorkspacePath(options.projectName || "Helix Workspace");

  const created = [];
  const updated = [];
  const skipped = [];

  fs.mkdirSync(workspace, { recursive: true });

  const metaPath = path.join(workspace, ".helix", "install.json");
  let previousVersion = "";
  try {
    previousVersion = String(JSON.parse(fs.readFileSync(metaPath, "utf8")).version || "");
  } catch {
    // first install
  }
  const upgraded = previousVersion !== HELIX_APP_VERSION;
  const name = path.basename(workspace);
  const pkgPath = path.join(workspace, "package.json");

  // Fast path: already installed at this version — skip disk writes on every launch
  if (
    !upgraded &&
    !options.forceManaged &&
    fs.existsSync(metaPath) &&
    fs.existsSync(pkgPath)
  ) {
    return {
      workspace,
      projectsRoot,
      created: [],
      updated: [],
      skipped: [],
      version: HELIX_APP_VERSION,
      upgraded: false,
      npmInstall: null,
      fastPath: true,
    };
  }

  writeManaged(
    path.join(workspace, "README.helix.md"),
    `# ${name}

This folder is your **Helix project workspace**.

- Helix creates and updates files under \`.helix/managed/\` on every start.
- Your own code in \`src/\`, \`app/\`, etc. is never overwritten.
- Ask the agent to scaffold features, fix TypeScript, and keep the project building.

## Quick start

\`\`\`bash
npm install
npm run dev
\`\`\`
`,
    updated,
    created
  );

  writeManaged(
    path.join(workspace, ".helix", "managed", "AGENTS.md"),
    `# Helix Agent Notes

Workspace managed by Helix ${HELIX_APP_VERSION}.

Rules:
1. Prefer small, precise edits.
2. Keep TypeScript compiling.
3. Do not delete user files outside \`.helix/managed/\`.
4. After meaningful changes, summarize what changed.
`,
    updated,
    created
  );

  writeManaged(
    path.join(workspace, ".helix", "managed", "starter-prompt.md"),
    `Build in this IDE workspace:

1. Map the project
2. Scaffold or extend the app under src/
3. Fix type errors
4. Verify with the project's scripts
`,
    updated,
    created
  );

  writeIfMissing(
    path.join(workspace, "package.json"),
    starterPackageJson(name),
    created,
    skipped
  );
  writeIfMissing(
    path.join(workspace, "tsconfig.json"),
    `${JSON.stringify(
      {
        compilerOptions: {
          target: "ES2022",
          module: "NodeNext",
          moduleResolution: "NodeNext",
          outDir: "dist",
          rootDir: "src",
          strict: true,
          skipLibCheck: true,
          esModuleInterop: true,
        },
        include: ["src/**/*"],
      },
      null,
      2
    )}\n`,
    created,
    skipped
  );
  writeIfMissing(
    path.join(workspace, "src", "main.ts"),
    `/**
 * Helix starter entry — replace this with your app.
 */
export function main() {
  console.log("Helix workspace ready.");
}

main();
`,
    created,
    skipped
  );
  writeIfMissing(
    path.join(workspace, ".gitignore"),
    `node_modules/
dist/
.helix/sessions/
.helix/learning/
.helix/secrets.json
.env
*.log
`,
    created,
    skipped
  );
  writeIfMissing(
    path.join(workspace, "README.md"),
    `# ${name}\n\nCreated by Helix. See README.helix.md for workspace notes.\n`,
    created,
    skipped
  );
  writeIfMissing(
    path.join(workspace, ".helix", "mcp.json"),
    JSON.stringify({ mcpServers: {} }, null, 2) + "\n",
    created,
    skipped
  );

  fs.mkdirSync(path.join(workspace, ".helix"), { recursive: true });
  fs.writeFileSync(
    metaPath,
    JSON.stringify(
      {
        version: HELIX_APP_VERSION,
        previousVersion: previousVersion || null,
        updatedAt: new Date().toISOString(),
        projectsRoot,
        workspace,
        upgraded,
      },
      null,
      2
    ) + "\n",
    "utf8"
  );

  // Optionally npm install when package.json exists and node_modules is missing
  let npmInstall = null;
  const pkg = path.join(workspace, "package.json");
  const nm = path.join(workspace, "node_modules");
  if (fs.existsSync(pkg) && !fs.existsSync(nm) && options.runNpmInstall !== false) {
    try {
      const { spawnSync } = require("child_process");
      const result = spawnSync(
        process.platform === "win32" ? "npm.cmd" : "npm",
        ["install", "--no-fund", "--no-audit"],
        {
          cwd: workspace,
          encoding: "utf8",
          timeout: 180_000,
          shell: process.platform === "win32",
        }
      );
      npmInstall = {
        ok: result.status === 0,
        status: result.status,
        stderr: (result.stderr || "").slice(0, 500),
      };
    } catch (err) {
      npmInstall = { ok: false, error: String(err && err.message ? err.message : err) };
    }
  }

  return {
    workspace,
    projectsRoot,
    created: created.map((p) => path.relative(workspace, p) || p),
    updated: updated.map((p) => path.relative(workspace, p) || p),
    skipped: skipped.map((p) => path.relative(workspace, p) || p),
    version: HELIX_APP_VERSION,
    upgraded,
    npmInstall,
  };
}

module.exports = {
  HELIX_APP_VERSION,
  defaultProjectsRoot,
  defaultWorkspacePath,
  installOrUpdateProjectSync,
};
