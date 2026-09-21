import fs from "node:fs/promises";
import path from "node:path";
import { exec } from "node:child_process";
import { promisify } from "node:util";
import { tool } from "ai";
import { z } from "zod";
import { glob } from "glob";

const execAsync = promisify(exec);

export type BuildStep = {
  id: string;
  label: string;
  command: string;
  kind: "typecheck" | "build" | "test" | "package" | "compile";
};

export type BuildPipeline = {
  stack: string[];
  steps: BuildStep[];
  artifactGlobs: string[];
  notes: string[];
};

async function readJson(filePath: string) {
  try {
    return JSON.parse(await fs.readFile(filePath, "utf8")) as Record<string, unknown>;
  } catch {
    return null;
  }
}

async function exists(filePath: string) {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

/** Infer how to compile / package this workspace into a final product. */
export async function detectBuildPipeline(workspace: string): Promise<BuildPipeline> {
  const steps: BuildStep[] = [];
  const stack: string[] = [];
  const notes: string[] = [];
  const artifactGlobs: string[] = [];

  const pkgPath = path.join(workspace, "package.json");
  if (await exists(pkgPath)) {
    stack.push("Node/JS");
    const pkg = (await readJson(pkgPath)) ?? {};
    const scripts = (pkg.scripts ?? {}) as Record<string, string>;

    if (scripts.typecheck) {
      steps.push({
        id: "typecheck",
        label: "Typecheck",
        command: "npm run typecheck",
        kind: "typecheck",
      });
    }
    if (scripts.build) {
      steps.push({
        id: "build",
        label: "Production build",
        command: "npm run build",
        kind: "build",
      });
      artifactGlobs.push("dist/**/*", "build/**/*", ".next/**/*", "out/**/*");
    }
    if (scripts.test) {
      steps.push({
        id: "test",
        label: "Tests",
        command: "npm test",
        kind: "test",
      });
    }
    if (scripts.dist || scripts["dist:linux"] || scripts.pack) {
      const command = scripts.dist
        ? "npm run dist"
        : scripts.pack
          ? "npm run pack"
          : "npm run dist:linux";
      steps.push({
        id: "package",
        label: "Package installer / final product",
        command,
        kind: "package",
      });
      artifactGlobs.push("release/**/*", "dist_electron/**/*", "*.AppImage", "*.dmg", "*.exe");
    }
    if ((pkg.devDependencies as Record<string, string> | undefined)?.["electron-builder"] ||
      (pkg.build as object | undefined)) {
      notes.push("Electron packaging available — prefer npm run dist / pack for installers.");
    }
  }

  if (await exists(path.join(workspace, "Cargo.toml"))) {
    stack.push("Rust");
    steps.push({
      id: "cargo-build",
      label: "Cargo release build",
      command: "cargo build --release",
      kind: "compile",
    });
    artifactGlobs.push("target/release/**/*");
  }

  if (await exists(path.join(workspace, "go.mod"))) {
    stack.push("Go");
    steps.push({
      id: "go-build",
      label: "Go build",
      command: "go build -o bin/app .",
      kind: "compile",
    });
    artifactGlobs.push("bin/**/*");
  }

  if (
    (await exists(path.join(workspace, "pyproject.toml"))) ||
    (await exists(path.join(workspace, "requirements.txt")))
  ) {
    stack.push("Python");
    notes.push("Python projects: prefer packaging with the project's documented build backend.");
    if (await exists(path.join(workspace, "pyproject.toml"))) {
      steps.push({
        id: "python-build",
        label: "Python package build",
        command: "python -m build",
        kind: "build",
      });
      artifactGlobs.push("dist/**/*");
    }
  }

  if (await exists(path.join(workspace, "CMakeLists.txt"))) {
    stack.push("CMake/C++");
    steps.push({
      id: "cmake-build",
      label: "CMake release build",
      command:
        "cmake -S . -B build -DCMAKE_BUILD_TYPE=Release && cmake --build build --config Release",
      kind: "compile",
    });
    artifactGlobs.push("build/**/*");
  }

  if (steps.length === 0) {
    notes.push("No standard build pipeline detected — invent a minimal build script, then compile.");
  }

  return { stack, steps, artifactGlobs: [...new Set(artifactGlobs)], notes };
}

export async function runBuildCommand(
  workspace: string,
  command: string,
  timeoutMs = 600_000
) {
  try {
    const { stdout, stderr } = await execAsync(command, {
      cwd: workspace,
      timeout: timeoutMs,
      maxBuffer: 8 * 1024 * 1024,
      env: process.env,
    });
    return {
      ok: true,
      command,
      stdout: stdout.slice(0, 40_000),
      stderr: stderr.slice(0, 20_000),
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
      command,
      code: err.code ?? 1,
      stdout: (err.stdout ?? "").slice(0, 40_000),
      stderr: (err.stderr ?? err.message ?? "Build failed").slice(0, 20_000),
    };
  }
}

export async function listBuildArtifacts(
  workspace: string,
  globs: string[]
): Promise<Array<{ path: string; size: number; mtime: string }>> {
  const files = new Set<string>();
  for (const pattern of globs) {
    const matches = await glob(pattern, {
      cwd: workspace,
      nodir: true,
      absolute: false,
      ignore: ["**/node_modules/**", "**/.git/**"],
    });
    for (const match of matches) files.add(match);
  }

  const artifacts: Array<{ path: string; size: number; mtime: string }> = [];
  for (const relative of [...files].sort()) {
    try {
      const stat = await fs.stat(path.join(workspace, relative));
      // Prefer installer / bundle sized outputs; still include smaller dist files
      artifacts.push({
        path: relative,
        size: stat.size,
        mtime: stat.mtime.toISOString(),
      });
    } catch {
      // skip
    }
  }

  // Surface largest / newest first for "final product" clarity
  return artifacts
    .sort((a, b) => b.size - a.size || b.mtime.localeCompare(a.mtime))
    .slice(0, 80);
}

export async function runFullShip(workspace: string) {
  const pipeline = await detectBuildPipeline(workspace);
  const results: Array<Record<string, unknown>> = [];

  // Prefer typecheck → build → package; skip tests unless only option
  const ordered = [
    ...pipeline.steps.filter((s) => s.kind === "typecheck"),
    ...pipeline.steps.filter((s) => s.kind === "build" || s.kind === "compile"),
    ...pipeline.steps.filter((s) => s.kind === "package"),
  ];

  for (const step of ordered) {
    const result = await runBuildCommand(workspace, step.command);
    results.push({ step, ...result });
    if (!result.ok) {
      return {
        ok: false,
        pipeline,
        results,
        artifacts: await listBuildArtifacts(workspace, pipeline.artifactGlobs),
      };
    }
  }

  return {
    ok: true,
    pipeline,
    results,
    artifacts: await listBuildArtifacts(workspace, pipeline.artifactGlobs),
  };
}

export function createBuildTools(workspace: string) {
  return {
    detect_build_pipeline: tool({
      description:
        "Detect how to typecheck, compile, build, and package this project into a final product (dist/installers/binaries).",
      inputSchema: z.object({}),
      execute: async () => detectBuildPipeline(workspace),
    }),

    run_build_step: tool({
      description:
        "Run one build/compile/package command in the workspace (long timeout). Prefer steps from detect_build_pipeline.",
      inputSchema: z.object({
        command: z.string().min(1),
        timeoutMs: z.number().int().positive().max(900_000).default(600_000),
      }),
      execute: async ({ command, timeoutMs }) =>
        runBuildCommand(workspace, command, timeoutMs),
    }),

    ship_project: tool({
      description:
        "Compile and package the project end-to-end: typecheck → build/compile → package installers/binaries, then list artifacts.",
      inputSchema: z.object({}),
      execute: async () => runFullShip(workspace),
    }),

    list_build_artifacts: tool({
      description: "List compiled/packaged output files (dist, release, binaries).",
      inputSchema: z.object({
        globs: z
          .array(z.string())
          .default(["dist/**/*", "release/**/*", "build/**/*", "bin/**/*", "target/release/**/*"]),
      }),
      execute: async ({ globs }) => ({
        artifacts: await listBuildArtifacts(workspace, globs),
      }),
    }),
  };
}
