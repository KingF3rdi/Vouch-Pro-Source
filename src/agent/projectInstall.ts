/**
 * Install / update the user's Helix project folder.
 * Creates Documents/Helix/Projects/<name> and syncs managed templates
 * without overwriting user source files.
 */

import fs from "node:fs/promises";
import fsSync from "node:fs";
import path from "node:path";
import os from "node:os";

export const HELIX_APP_VERSION = "0.3.0";

export type ProjectInstallResult = {
  workspace: string;
  projectsRoot: string;
  created: string[];
  updated: string[];
  skipped: string[];
  version: string;
  upgraded: boolean;
};

function documentsDir(): string {
  if (process.env.HELIX_PROJECTS_ROOT) {
    return path.resolve(process.env.HELIX_PROJECTS_ROOT);
  }
  const home = os.homedir();
  if (process.platform === "win32") {
    return process.env.USERPROFILE
      ? path.join(process.env.USERPROFILE, "Documents")
      : path.join(home, "Documents");
  }
  // macOS / Linux
  const docs = path.join(home, "Documents");
  if (fsSync.existsSync(docs)) return docs;
  return home;
}

export function defaultProjectsRoot(): string {
  return path.join(documentsDir(), "Helix", "Projects");
}

export function defaultWorkspacePath(projectName = "Helix Workspace"): string {
  return path.join(defaultProjectsRoot(), projectName);
}

async function exists(p: string): Promise<boolean> {
  try {
    await fs.access(p);
    return true;
  } catch {
    return false;
  }
}

async function writeIfMissing(
  full: string,
  content: string,
  created: string[],
  skipped: string[]
) {
  if (await exists(full)) {
    skipped.push(full);
    return;
  }
  await fs.mkdir(path.dirname(full), { recursive: true });
  await fs.writeFile(full, content, "utf8");
  created.push(full);
}

/** Always refresh managed templates (safe to overwrite). */
async function writeManaged(
  full: string,
  content: string,
  updated: string[],
  created: string[]
) {
  const had = await exists(full);
  await fs.mkdir(path.dirname(full), { recursive: true });
  await fs.writeFile(full, content, "utf8");
  (had ? updated : created).push(full);
}

function managedTemplates(workspaceName: string): Record<string, string> {
  return {
    "README.helix.md": `# ${workspaceName}

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
    ".helix/managed/AGENTS.md": `# Helix Agent Notes

Workspace managed by Helix ${HELIX_APP_VERSION}.

Rules:
1. Prefer small, precise edits.
2. Keep TypeScript compiling.
3. Do not delete user files outside \`.helix/managed/\`.
4. After meaningful changes, summarize what changed.
`,
    ".helix/managed/starter-prompt.md": `Build in this IDE workspace:

1. Map the project
2. Scaffold or extend the app under src/
3. Fix type errors
4. Verify with the project's scripts
`,
  };
}

function starterPackageJson(name: string): string {
  return (
    JSON.stringify(
      {
        name: name
          .toLowerCase()
          .replace(/[^a-z0-9-_]+/g, "-")
          .replace(/^-|-$/g, "") || "helix-workspace",
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

function starterTsconfig(): string {
  return `${JSON.stringify(
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
  )}\n`;
}

function starterMainTs(): string {
  return `/**
 * Helix starter entry — replace this with your app.
 */
export function main() {
  console.log("Helix workspace ready.");
}

main();
`;
}

function starterGitignore(): string {
  return `node_modules/
dist/
.helix/sessions/
.helix/learning/
.helix/secrets.json
.env
*.log
`;
}

/**
 * Ensure the project folder exists and managed templates are up to date.
 */
export async function installOrUpdateProject(options?: {
  workspace?: string;
  projectName?: string;
  forceManaged?: boolean;
}): Promise<ProjectInstallResult> {
  const projectsRoot = defaultProjectsRoot();
  const workspace =
    options?.workspace ||
    process.env.HELIX_WORKSPACE ||
    defaultWorkspacePath(options?.projectName || "Helix Workspace");

  const created: string[] = [];
  const updated: string[] = [];
  const skipped: string[] = [];

  await fs.mkdir(workspace, { recursive: true });

  const metaPath = path.join(workspace, ".helix", "install.json");
  let previousVersion = "";
  try {
    const raw = await fs.readFile(metaPath, "utf8");
    previousVersion = String((JSON.parse(raw) as { version?: string }).version || "");
  } catch {
    // first install
  }
  const upgraded = previousVersion !== HELIX_APP_VERSION;

  const name = path.basename(workspace);
  const managed = managedTemplates(name);
  for (const [rel, content] of Object.entries(managed)) {
    await writeManaged(path.join(workspace, rel), content, updated, created);
  }

  // One-time / missing starter project files (never overwrite user edits)
  await writeIfMissing(
    path.join(workspace, "package.json"),
    starterPackageJson(name),
    created,
    skipped
  );
  await writeIfMissing(
    path.join(workspace, "tsconfig.json"),
    starterTsconfig(),
    created,
    skipped
  );
  await writeIfMissing(
    path.join(workspace, "src", "main.ts"),
    starterMainTs(),
    created,
    skipped
  );
  await writeIfMissing(
    path.join(workspace, ".gitignore"),
    starterGitignore(),
    created,
    skipped
  );
  await writeIfMissing(
    path.join(workspace, "README.md"),
    `# ${name}\n\nCreated by Helix. See README.helix.md for workspace notes.\n`,
    created,
    skipped
  );

  // Default MCP config if missing
  await writeIfMissing(
    path.join(workspace, ".helix", "mcp.json"),
    JSON.stringify({ mcpServers: {} }, null, 2) + "\n",
    created,
    skipped
  );

  await fs.mkdir(path.join(workspace, ".helix"), { recursive: true });
  await fs.writeFile(
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
  (await exists(metaPath) ? updated : created).push(metaPath);

  return {
    workspace,
    projectsRoot,
    created: created.map((p) => path.relative(workspace, p) || p),
    updated: updated.map((p) => path.relative(workspace, p) || p),
    skipped: skipped.map((p) => path.relative(workspace, p) || p),
    version: HELIX_APP_VERSION,
    upgraded,
  };
}

/** Sync CJS-friendly resolve used by Electron before the server boots. */
export function resolveDesktopWorkspace(): string {
  if (process.env.HELIX_WORKSPACE) return path.resolve(process.env.HELIX_WORKSPACE);
  return defaultWorkspacePath();
}
