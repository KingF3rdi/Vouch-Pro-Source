/**
 * Essential agent tools — patch, tests, explain, todos.
 */

import fs from "node:fs/promises";
import path from "node:path";
import { exec } from "node:child_process";
import { promisify } from "node:util";
import { glob } from "glob";

const execAsync = promisify(exec);

function assertInside(workspace: string, targetPath: string): string {
  const root = path.resolve(workspace);
  const resolved = path.resolve(root, targetPath);
  if (resolved !== root && !resolved.startsWith(root + path.sep)) {
    throw new Error(`Path escapes workspace: ${targetPath}`);
  }
  return resolved;
}

export async function applyPatch(
  workspace: string,
  relativePath: string,
  oldText: string,
  newText: string,
  replaceAll = false
): Promise<{ ok: boolean; replacements: number; path: string }> {
  const filePath = assertInside(workspace, relativePath);
  const content = await fs.readFile(filePath, "utf8");
  if (!content.includes(oldText)) {
    return { ok: false, replacements: 0, path: relativePath };
  }
  const replacements = replaceAll
    ? content.split(oldText).length - 1
    : 1;
  const next = replaceAll
    ? content.split(oldText).join(newText)
    : content.replace(oldText, newText);
  await fs.writeFile(filePath, next, "utf8");
  return { ok: true, replacements, path: relativePath };
}

export async function explainCode(
  workspace: string,
  relativePath: string,
  maxChars = 12_000
): Promise<{ path: string; preview: string; notes: string[] }> {
  const filePath = assertInside(workspace, relativePath);
  const text = await fs.readFile(filePath, "utf8");
  const preview = text.length > maxChars ? text.slice(0, maxChars) : text;
  const notes: string[] = [];
  if (/from ['"]express['"]|fastapi|Flask/.test(text)) notes.push("HTTP/server module");
  if (/react|useState|useEffect/.test(text)) notes.push("React UI module");
  if (/tool\(|StructuredTool|bind_tools/.test(text)) notes.push("Agent tool wiring");
  if (/password|api[_-]?key|secret/i.test(text)) {
    notes.push("May contain sensitive patterns — review carefully");
  }
  return { path: relativePath, preview, notes };
}

export async function findTodos(
  workspace: string,
  maxMatches = 40
): Promise<{ todos: Array<{ path: string; line: number; text: string }> }> {
  const files = await glob("**/*.{ts,tsx,js,jsx,py,md}", {
    cwd: workspace,
    nodir: true,
    ignore: ["**/node_modules/**", "**/.git/**", "**/dist/**", "**/.helix/**"],
  });
  const todos: Array<{ path: string; line: number; text: string }> = [];
  const re = /\b(TODO|FIXME|HACK|XXX)\b/;
  for (const rel of files) {
    if (todos.length >= maxMatches) break;
    try {
      const text = await fs.readFile(path.join(workspace, rel), "utf8");
      text.split(/\r?\n/).forEach((line, i) => {
        if (todos.length >= maxMatches) return;
        if (re.test(line)) {
          todos.push({ path: rel, line: i + 1, text: line.trim().slice(0, 200) });
        }
      });
    } catch {
      // skip
    }
  }
  return { todos };
}

export async function runTests(workspace: string): Promise<{
  ok: boolean;
  command: string;
  stdout: string;
  stderr: string;
}> {
  let command = "npm test";
  try {
    const pkg = JSON.parse(
      await fs.readFile(path.join(workspace, "package.json"), "utf8")
    ) as { scripts?: Record<string, string> };
    if (!pkg.scripts?.test) {
      const hasPytest =
        (await exists(path.join(workspace, "pytest.ini"))) ||
        (await exists(path.join(workspace, "tests")));
      if (hasPytest) command = "python3 -m pytest -q";
      else {
        return {
          ok: false,
          command: "",
          stdout: "",
          stderr: "No test script detected (npm test / pytest).",
        };
      }
    }
  } catch {
    // default npm test
  }

  try {
    const { stdout, stderr } = await execAsync(command, {
      cwd: workspace,
      timeout: 300_000,
      maxBuffer: 4 * 1024 * 1024,
      env: process.env,
    });
    return { ok: true, command, stdout: stdout.slice(0, 20_000), stderr: stderr.slice(0, 8_000) };
  } catch (error) {
    const err = error as { stdout?: string; stderr?: string; message?: string };
    return {
      ok: false,
      command,
      stdout: (err.stdout ?? "").slice(0, 20_000),
      stderr: (err.stderr ?? err.message ?? "tests failed").slice(0, 8_000),
    };
  }
}

async function exists(p: string) {
  try {
    await fs.access(p);
    return true;
  } catch {
    return false;
  }
}
