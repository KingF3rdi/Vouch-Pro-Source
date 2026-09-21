import fs from "node:fs/promises";
import path from "node:path";
import { glob } from "glob";

const IGNORE = new Set([
  "node_modules",
  ".git",
  "dist",
  ".helix",
  ".next",
  "coverage",
  "__pycache__",
]);

const MARKERS = [
  "package.json",
  "pnpm-workspace.yaml",
  "tsconfig.json",
  "next.config.js",
  "next.config.ts",
  "vite.config.ts",
  "Cargo.toml",
  "pyproject.toml",
  "requirements.txt",
  "go.mod",
  "README.md",
  ".env.example",
];

export type ProjectMap = {
  root: string;
  topLevel: string[];
  markers: string[];
  likelyStack: string[];
  keyFiles: string[];
  summary: string;
};

export async function buildProjectMap(workspace: string): Promise<ProjectMap> {
  const root = path.resolve(workspace);
  let topLevel: string[] = [];
  try {
    const entries = await fs.readdir(root, { withFileTypes: true });
    topLevel = entries
      .filter((e) => !IGNORE.has(e.name) && !e.name.startsWith("."))
      .map((e) => (e.isDirectory() ? `${e.name}/` : e.name))
      .sort();
  } catch {
    topLevel = [];
  }

  const markers: string[] = [];
  for (const marker of MARKERS) {
    try {
      await fs.access(path.join(root, marker));
      markers.push(marker);
    } catch {
      // missing
    }
  }

  const likelyStack: string[] = [];
  if (markers.includes("package.json")) likelyStack.push("Node/JS");
  if (markers.some((m) => m.startsWith("next.config"))) likelyStack.push("Next.js");
  if (markers.includes("vite.config.ts")) likelyStack.push("Vite");
  if (markers.includes("tsconfig.json")) likelyStack.push("TypeScript");
  if (markers.includes("Cargo.toml")) likelyStack.push("Rust");
  if (markers.includes("pyproject.toml") || markers.includes("requirements.txt")) {
    likelyStack.push("Python");
  }
  if (markers.includes("go.mod")) likelyStack.push("Go");

  const keyFiles = (
    await glob("**/*.{ts,tsx,js,jsx,py,go,rs,md,json}", {
      cwd: root,
      nodir: true,
      ignore: ["**/node_modules/**", "**/.git/**", "**/dist/**", "**/.helix/**"],
      absolute: false,
    })
  )
    .filter((f) => !f.includes("package-lock"))
    .slice(0, 80);

  const summary = [
    `Workspace: ${root}`,
    `Stack hints: ${likelyStack.join(", ") || "unknown"}`,
    `Markers: ${markers.join(", ") || "none"}`,
    `Top-level: ${topLevel.slice(0, 40).join(", ")}`,
    `Sample files (${Math.min(keyFiles.length, 25)} of ${keyFiles.length}): ${keyFiles
      .slice(0, 25)
      .join(", ")}`,
  ].join("\n");

  return { root, topLevel, markers, likelyStack, keyFiles, summary };
}
