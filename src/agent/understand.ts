/**
 * Deep project understanding for Helix Own — architecture, entrypoints, modules.
 */

import fs from "node:fs/promises";
import path from "node:path";
import { glob } from "glob";
import { buildProjectMap } from "./projectMap.js";

const IGNORE = [
  "**/node_modules/**",
  "**/.git/**",
  "**/dist/**",
  "**/.helix/**",
  "**/release/**",
  "**/.next/**",
  "**/__pycache__/**",
  "**/.venv/**",
];

async function readSafe(filePath: string, max = 12_000): Promise<string | null> {
  try {
    const text = await fs.readFile(filePath, "utf8");
    return text.length > max ? text.slice(0, max) + "\n/* …truncated… */" : text;
  } catch {
    return null;
  }
}

export type ProjectUnderstanding = {
  mapSummary: string;
  architecture: string[];
  entrypoints: string[];
  modules: Array<{ path: string; role: string }>;
  dependencies: string[];
  scripts: Record<string, string>;
  risks: string[];
  howToRun: string[];
  narrative: string;
};

export async function understandProject(workspace: string): Promise<ProjectUnderstanding> {
  const map = await buildProjectMap(workspace);
  const root = path.resolve(workspace);
  const architecture: string[] = [];
  const entrypoints: string[] = [];
  const modules: Array<{ path: string; role: string }> = [];
  const risks: string[] = [];
  const howToRun: string[] = [];
  let dependencies: string[] = [];
  let scripts: Record<string, string> = {};

  const pkgRaw = await readSafe(path.join(root, "package.json"), 40_000);
  if (pkgRaw) {
    try {
      const pkg = JSON.parse(pkgRaw) as {
        dependencies?: Record<string, string>;
        devDependencies?: Record<string, string>;
        scripts?: Record<string, string>;
        main?: string;
        type?: string;
      };
      scripts = pkg.scripts ?? {};
      dependencies = [
        ...Object.keys(pkg.dependencies ?? {}),
        ...Object.keys(pkg.devDependencies ?? {}),
      ].slice(0, 80);
      if (pkg.main) entrypoints.push(pkg.main);
      architecture.push(
        `Node package (type=${pkg.type ?? "commonjs"}) with ${dependencies.length} deps/devDeps`
      );
      if (scripts.dev) howToRun.push(`npm run dev`);
      if (scripts.build) howToRun.push(`npm run build`);
      if (scripts.typecheck) howToRun.push(`npm run typecheck`);
      if (scripts.test) howToRun.push(`npm test`);
    } catch {
      risks.push("package.json is not valid JSON");
    }
  }

  const candidates = [
    "src/server/index.ts",
    "src/ui/main.tsx",
    "src/ui/App.tsx",
    "backend/main.py",
    "src/index.ts",
    "src/main.ts",
    "app/page.tsx",
    "electron/main.cjs",
  ];
  for (const rel of candidates) {
    try {
      await fs.access(path.join(root, rel));
      entrypoints.push(rel);
    } catch {
      // missing
    }
  }

  if (map.likelyStack.includes("Vite") || map.markers.includes("vite.config.ts")) {
    architecture.push("Vite SPA / tooling frontend");
  }
  if (map.topLevel.some((t) => t === "backend/")) {
    architecture.push("Split backend/ + frontend (polyglot)");
  }
  if (map.topLevel.some((t) => t === "electron/")) {
    architecture.push("Electron desktop shell");
  }
  if (map.likelyStack.includes("Python") || map.topLevel.some((t) => t === "backend/")) {
    architecture.push("Python services/agents present");
  }
  if (map.topLevel.some((t) => t === "src/")) {
    architecture.push("src/-rooted application code");
  }

  const roleHints: Array<{ pattern: RegExp; role: string }> = [
    { pattern: /\/agent\//, role: "agent/orchestration" },
    { pattern: /\/ui\//, role: "UI" },
    { pattern: /\/server\//, role: "HTTP API server" },
    { pattern: /\/tools/, role: "agent tools" },
    { pattern: /backend\//, role: "Python backend" },
    { pattern: /electron\//, role: "desktop shell" },
    { pattern: /skills\//, role: "agent skill" },
    { pattern: /components\//, role: "UI component" },
  ];

  const files = await glob("**/*.{ts,tsx,py,js,cjs,mjs}", {
    cwd: root,
    nodir: true,
    ignore: IGNORE,
    absolute: false,
  });

  for (const file of files.slice(0, 120)) {
    const hit = roleHints.find((h) => h.pattern.test(file));
    if (hit) modules.push({ path: file, role: hit.role });
  }

  // Dedupe modules by path
  const seen = new Set<string>();
  const uniqueModules = modules.filter((m) => {
    if (seen.has(m.path)) return false;
    seen.add(m.path);
    return true;
  }).slice(0, 60);

  if (!scripts.typecheck && map.markers.includes("tsconfig.json")) {
    risks.push("TypeScript present but no typecheck script — use npx tsc -p tsconfig.json --noEmit");
  }
  if (!pkgRaw && map.likelyStack.length === 0) {
    risks.push("No clear package manifest — greenfield or unusual layout");
  }

  const narrative = [
    `This workspace looks like: ${architecture.join("; ") || "unknown layout"}.`,
    `Stack: ${map.likelyStack.join(", ") || "unknown"}.`,
    `Entrypoints: ${[...new Set(entrypoints)].slice(0, 12).join(", ") || "none detected"}.`,
    `Key modules labeled: ${uniqueModules.length}.`,
    howToRun.length ? `Run via: ${howToRun.join(" · ")}.` : "No standard run scripts detected.",
    risks.length ? `Risks: ${risks.join("; ")}.` : "No immediate structural risks flagged.",
  ].join(" ");

  return {
    mapSummary: map.summary,
    architecture,
    entrypoints: [...new Set(entrypoints)],
    modules: uniqueModules,
    dependencies: dependencies.slice(0, 40),
    scripts,
    risks,
    howToRun,
    narrative,
  };
}
