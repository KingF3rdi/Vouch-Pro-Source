/**
 * Quality gates — typecheck / tests the agent must run after meaningful edits.
 */

import { exec } from "node:child_process";
import { promisify } from "node:util";
import fs from "node:fs/promises";
import path from "node:path";

const execAsync = promisify(exec);

export type QualityReport = {
  ok: boolean;
  checks: Array<{
    id: string;
    command: string;
    ok: boolean;
    stdout: string;
    stderr: string;
  }>;
  summary: string;
};

async function exists(p: string) {
  try {
    await fs.access(p);
    return true;
  } catch {
    return false;
  }
}

export async function runQualityCheck(workspace: string): Promise<QualityReport> {
  const checks: QualityReport["checks"] = [];
  const commands: Array<{ id: string; command: string }> = [];

  const pkgPath = path.join(workspace, "package.json");
  if (await exists(pkgPath)) {
    try {
      const pkg = JSON.parse(await fs.readFile(pkgPath, "utf8")) as {
        scripts?: Record<string, string>;
      };
      const scripts = pkg.scripts ?? {};
      if (scripts.typecheck) commands.push({ id: "typecheck", command: "npm run typecheck" });
      else if (await exists(path.join(workspace, "tsconfig.json"))) {
        commands.push({
          id: "typecheck",
          command: "npx tsc -p tsconfig.json --noEmit",
        });
      }
      if (scripts.lint) commands.push({ id: "lint", command: "npm run lint" });
      if (scripts.test) commands.push({ id: "test", command: "npm test" });
    } catch {
      // ignore
    }
  }

  if (await exists(path.join(workspace, "backend", "requirements.txt"))) {
    commands.push({
      id: "python-compile",
      command: "python3 -m compileall backend/app -q",
    });
  }

  if (commands.length === 0) {
    return {
      ok: true,
      checks: [],
      summary: "No automated quality commands detected — manually verify the change.",
    };
  }

  for (const step of commands.slice(0, 4)) {
    try {
      const { stdout, stderr } = await execAsync(step.command, {
        cwd: workspace,
        timeout: 180_000,
        maxBuffer: 4 * 1024 * 1024,
        env: process.env,
      });
      checks.push({
        id: step.id,
        command: step.command,
        ok: true,
        stdout: stdout.slice(0, 12_000),
        stderr: stderr.slice(0, 6_000),
      });
    } catch (error) {
      const err = error as { stdout?: string; stderr?: string; message?: string };
      checks.push({
        id: step.id,
        command: step.command,
        ok: false,
        stdout: (err.stdout ?? "").slice(0, 12_000),
        stderr: (err.stderr ?? err.message ?? "failed").slice(0, 6_000),
      });
      break; // fail fast — agent should fix before continuing
    }
  }

  const ok = checks.every((c) => c.ok);
  return {
    ok,
    checks,
    summary: ok
      ? `All ${checks.length} quality checks passed.`
      : `Quality failed at: ${checks.filter((c) => !c.ok).map((c) => c.id).join(", ")}`,
  };
}
