import { tool } from "ai";
import { z } from "zod";

export const id = "project-map";
export const name = "Project Map";
export const description = "Summarize project structure for faster orientation.";
export const version = "0.1.0";
export const enabled = true;

export const systemPrompt =
  "Use project_tree early on unfamiliar codebases to orient before deep reads.";

export function createTools() {
  return {
    project_tree: tool({
      description:
        "List top-level files and important config markers in the workspace (legacy plugin helper).",
      inputSchema: z.object({
        depth: z.number().int().min(1).max(3).default(2),
      }),
      execute: async ({ depth }) => {
        const fs = await import("node:fs/promises");
        const path = await import("node:path");
        const root = process.env.HELIX_WORKSPACE
          ? path.resolve(process.env.HELIX_WORKSPACE)
          : process.cwd();

        const interesting = new Set([
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
        ]);

        async function walk(dir: string, level: number): Promise<unknown[]> {
          if (level > depth) return [];
          const entries = await fs.readdir(dir, { withFileTypes: true });
          const out: unknown[] = [];
          for (const entry of entries) {
            if (entry.name === "node_modules" || entry.name === ".git" || entry.name === "dist") {
              continue;
            }
            const full = path.join(dir, entry.name);
            const relative = path.relative(root, full);
            if (entry.isDirectory()) {
              out.push({
                path: relative,
                type: "dir",
                children: await walk(full, level + 1),
              });
            } else {
              out.push({
                path: relative,
                type: "file",
                important: interesting.has(entry.name),
              });
            }
          }
          return out;
        }

        return {
          root,
          tree: await walk(root, 1),
        };
      },
    }),
  };
}
