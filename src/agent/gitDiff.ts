import { exec } from "node:child_process";
import { promisify } from "node:util";
import fs from "node:fs/promises";
import path from "node:path";
import { createTwoFilesPatch } from "diff";

const execAsync = promisify(exec);

export type GitFileStatus = {
  path: string;
  status: "M" | "A" | "D" | "U" | "??" | string;
};

export async function getGitStatus(workspace: string): Promise<GitFileStatus[]> {
  try {
    const { stdout } = await execAsync("git status --porcelain", { cwd: workspace });
    return stdout
      .split(/\r?\n/)
      .filter(Boolean)
      .map((line) => {
        const status = line.slice(0, 2).trim() || "??";
        const filePath = line.slice(3).replace(/^"|"$/g, "").replace(/\\ /g, " ");
        // handle renames "R  old -> new"
        const arrow = filePath.includes(" -> ") ? filePath.split(" -> ").pop()! : filePath;
        return { path: arrow, status };
      });
  } catch {
    return [];
  }
}

export async function getOriginalFileContent(
  workspace: string,
  relativePath: string
): Promise<string> {
  try {
    const { stdout } = await execAsync(`git show HEAD:${JSON.stringify(relativePath)}`, {
      cwd: workspace,
      maxBuffer: 4 * 1024 * 1024,
    });
    return stdout;
  } catch {
    try {
      return await fs.readFile(path.join(workspace, relativePath), "utf8");
    } catch {
      return "";
    }
  }
}

export async function getFileDiff(
  workspace: string,
  relativePath: string,
  currentContent?: string
): Promise<{ original: string; modified: string; patch: string }> {
  const original = await getOriginalFileContent(workspace, relativePath);
  const modified =
    typeof currentContent === "string"
      ? currentContent
      : await fs.readFile(path.join(workspace, relativePath), "utf8").catch(() => "");
  const patch = createTwoFilesPatch(
    `a/${relativePath}`,
    `b/${relativePath}`,
    original,
    modified,
    "",
    ""
  );
  return { original, modified, patch };
}
