import fs from "node:fs/promises";
import path from "node:path";
import { exec } from "node:child_process";
import { promisify } from "node:util";
import { tool } from "ai";
import { z } from "zod";
import { glob } from "glob";
import { buildProjectMap } from "./projectMap.js";
import { understandProject } from "./understand.js";
import { scaffoldProject } from "./scaffold.js";
import { runQualityCheck } from "./quality.js";
import { applyPatch, explainCode, findTodos, runTests } from "./essentialTools.js";
import { defaultProjectsRoot } from "./projectInstall.js";

const execAsync = promisify(exec);

function assertInsideWorkspace(workspace: string, targetPath: string): string {
  const resolvedWorkspace = path.resolve(workspace);
  const resolved = path.resolve(resolvedWorkspace, targetPath);
  if (
    resolved !== resolvedWorkspace &&
    !resolved.startsWith(resolvedWorkspace + path.sep)
  ) {
    throw new Error(`Path escapes workspace: ${targetPath}`);
  }
  return resolved;
}

function assertInsideProjectsRoot(targetPath: string): string {
  const root = path.resolve(defaultProjectsRoot());
  const resolved = path.resolve(root, targetPath);
  if (resolved !== root && !resolved.startsWith(root + path.sep)) {
    throw new Error(`Path escapes Helix Projects folder: ${targetPath}`);
  }
  return resolved;
}

export function createAgentTools(workspace: string) {
  const projectsRoot = defaultProjectsRoot();

  return {
    project_map: tool({
      description:
        "Map the workspace structure, stack markers, and key files. Call this at the start of every project task.",
      inputSchema: z.object({}),
      execute: async () => buildProjectMap(workspace),
    }),

    understand_project: tool({
      description:
        "Deeply understand the codebase: architecture, entrypoints, modules, scripts, risks. Call before complex work.",
      inputSchema: z.object({}),
      execute: async () => understandProject(workspace),
    }),

    scaffold_project: tool({
      description:
        "Scaffold a product on disk: ts-api, react-vite, fullstack-ts, python-fastapi, monorepo-lite, website, electron-app, game-canvas, mod-fabric, browser-extension. Creates real folders/files. Does not overwrite existing files.",
      inputSchema: z.object({
        kind: z.enum([
          "ts-api",
          "react-vite",
          "fullstack-ts",
          "python-fastapi",
          "monorepo-lite",
          "website",
          "electron-app",
          "game-canvas",
          "mod-fabric",
          "browser-extension",
        ]),
        name: z.string().min(1),
        relativeRoot: z
          .string()
          .optional()
          .describe("Folder to create under the workspace (default: name)"),
      }),
      execute: async ({ kind, name, relativeRoot }) =>
        scaffoldProject(workspace, { kind, name, relativeRoot }),
    }),

    quality_check: tool({
      description:
        "Run project quality gates (typecheck/lint/test/python compile). Call after meaningful edits.",
      inputSchema: z.object({}),
      execute: async () => runQualityCheck(workspace),
    }),

    apply_patch: tool({
      description:
        "Exact search-replace edit inside a file on disk. Prefer this over rewriting whole files for small changes.",
      inputSchema: z.object({
        relativePath: z.string(),
        oldText: z.string().min(1),
        newText: z.string(),
        replaceAll: z.boolean().default(false),
      }),
      execute: async ({ relativePath, oldText, newText, replaceAll }) =>
        applyPatch(workspace, relativePath, oldText, newText, replaceAll),
    }),

    explain_code: tool({
      description: "Read a file and return a preview plus structural notes for understanding.",
      inputSchema: z.object({
        relativePath: z.string(),
        maxChars: z.number().int().positive().max(50_000).default(12_000),
      }),
      execute: async ({ relativePath, maxChars }) =>
        explainCode(workspace, relativePath, maxChars),
    }),

    find_todos: tool({
      description: "Find TODO/FIXME/HACK markers in the workspace.",
      inputSchema: z.object({
        maxMatches: z.number().int().positive().max(100).default(40),
      }),
      execute: async ({ maxMatches }) => findTodos(workspace, maxMatches),
    }),

    run_tests: tool({
      description: "Run the project's test suite (npm test or pytest).",
      inputSchema: z.object({}),
      execute: async () => runTests(workspace),
    }),

    list_directory: tool({
      description: "List files and folders in a directory relative to the workspace.",
      inputSchema: z.object({
        relativePath: z
          .string()
          .default(".")
          .describe("Directory path relative to the workspace root"),
      }),
      execute: async ({ relativePath }) => {
        const dir = assertInsideWorkspace(workspace, relativePath || ".");
        const entries = await fs.readdir(dir, { withFileTypes: true });
        return {
          absolutePath: dir,
          entries: entries.map((entry) => ({
            name: entry.name,
            type: entry.isDirectory() ? "dir" : "file",
          })),
        };
      },
    }),

    read_file: tool({
      description: "Read a text file from the workspace on this PC.",
      inputSchema: z.object({
        relativePath: z.string().describe("File path relative to the workspace"),
        maxChars: z.number().int().positive().max(200_000).default(80_000),
      }),
      execute: async ({ relativePath, maxChars }) => {
        const filePath = assertInsideWorkspace(workspace, relativePath);
        const content = await fs.readFile(filePath, "utf8");
        if (content.length > maxChars) {
          return {
            truncated: true,
            absolutePath: filePath,
            content: content.slice(0, maxChars),
            note: `Truncated to ${maxChars} characters`,
          };
        }
        return { truncated: false, absolutePath: filePath, content };
      },
    }),

    create_directory: tool({
      description:
        "Create a real folder on this PC inside the current workspace (parents included). Returns the absolute disk path.",
      inputSchema: z.object({
        relativePath: z.string().min(1).describe("Folder path relative to the workspace"),
      }),
      execute: async ({ relativePath }) => {
        const dir = assertInsideWorkspace(workspace, relativePath);
        await fs.mkdir(dir, { recursive: true });
        return {
          ok: true,
          created: true,
          path: relativePath,
          absolutePath: dir,
          onDisk: true,
        };
      },
    }),

    create_project_folder: tool({
      description: `Create a new project folder on this PC under ${projectsRoot}. Use for a brand-new app/site/game next to the current workspace.`,
      inputSchema: z.object({
        name: z
          .string()
          .min(1)
          .describe("Folder name under Documents/Helix/Projects"),
      }),
      execute: async ({ name }) => {
        const safe = name.replace(/[<>:"|?*\u0000-\u001f]/g, "-").trim();
        if (!safe) throw new Error("Invalid folder name");
        const dir = assertInsideProjectsRoot(safe);
        await fs.mkdir(dir, { recursive: true });
        return {
          ok: true,
          created: true,
          path: safe,
          absolutePath: dir,
          projectsRoot,
          onDisk: true,
        };
      },
    }),

    write_file: tool({
      description:
        "Create or overwrite a real text file on this PC in the workspace. Creates parent folders automatically. Returns the absolute disk path.",
      inputSchema: z.object({
        relativePath: z.string(),
        content: z.string(),
      }),
      execute: async ({ relativePath, content }) => {
        const filePath = assertInsideWorkspace(workspace, relativePath);
        await fs.mkdir(path.dirname(filePath), { recursive: true });
        const existed = await fs
          .access(filePath)
          .then(() => true)
          .catch(() => false);
        await fs.writeFile(filePath, content, "utf8");
        return {
          ok: true,
          created: !existed,
          updated: existed,
          path: relativePath,
          absolutePath: filePath,
          onDisk: true,
          bytes: Buffer.byteLength(content, "utf8"),
        };
      },
    }),

    search_files: tool({
      description: "Search file contents in the workspace with a case-insensitive substring.",
      inputSchema: z.object({
        query: z.string().min(1),
        globPattern: z.string().default("**/*.{ts,tsx,js,jsx,py,md,json,css,html}"),
        maxMatches: z.number().int().positive().max(100).default(40),
      }),
      execute: async ({ query, globPattern, maxMatches }) => {
        const files = await glob(globPattern, {
          cwd: workspace,
          nodir: true,
          ignore: ["**/node_modules/**", "**/.git/**", "**/dist/**", "**/.helix/**"],
          absolute: false,
        });
        const needle = query.toLowerCase();
        const matches: Array<{ path: string; line: number; text: string }> = [];

        for (const relativePath of files) {
          if (matches.length >= maxMatches) break;
          try {
            const fullPath = assertInsideWorkspace(workspace, relativePath);
            const text = await fs.readFile(fullPath, "utf8");
            const lines = text.split(/\r?\n/);
            lines.forEach((line, index) => {
              if (matches.length >= maxMatches) return;
              if (line.toLowerCase().includes(needle)) {
                matches.push({
                  path: relativePath,
                  line: index + 1,
                  text: line.trim().slice(0, 240),
                });
              }
            });
          } catch {
            // Skip unreadable files
          }
        }

        return { matches, scannedFiles: files.length, workspace };
      },
    }),

    run_terminal: tool({
      description:
        "Run a shell command inside the workspace. Use for builds, tests, git, and package managers. Avoid destructive commands.",
      inputSchema: z.object({
        command: z.string().min(1),
        timeoutMs: z.number().int().positive().max(600_000).default(120_000),
      }),
      execute: async ({ command, timeoutMs }) => {
        try {
          const { stdout, stderr } = await execAsync(command, {
            cwd: workspace,
            timeout: timeoutMs,
            maxBuffer: 2 * 1024 * 1024,
            env: process.env,
          });
          return {
            ok: true,
            cwd: workspace,
            stdout: stdout.slice(0, 20_000),
            stderr: stderr.slice(0, 8_000),
          };
        } catch (error) {
          const err = error as {
            stdout?: string;
            stderr?: string;
            message?: string;
            code?: number;
          };
          return {
            ok: false,
            cwd: workspace,
            code: err.code ?? 1,
            stdout: (err.stdout ?? "").slice(0, 20_000),
            stderr: (err.stderr ?? err.message ?? "Command failed").slice(0, 8_000),
          };
        }
      },
    }),
  };
}

export type AgentTools = ReturnType<typeof createAgentTools>;
