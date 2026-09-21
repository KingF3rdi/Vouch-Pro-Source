import { tool } from "ai";
import { z } from "zod";

export const id = "git-status";
export const name = "Git Status";
export const description = "Quick git workspace awareness for the agent.";
export const version = "0.1.0";
export const enabled = true;

export const systemPrompt =
  "When useful, use the git_brief tool to understand branch and dirty state before editing.";

export function createTools() {
  return {
    git_brief: tool({
      description: "Return a short git status summary for the current workspace.",
      inputSchema: z.object({}),
      execute: async () => {
        const { exec } = await import("node:child_process");
        const { promisify } = await import("node:util");
        const execAsync = promisify(exec);
        try {
          const [{ stdout: branch }, { stdout: status }, { stdout: log }] =
            await Promise.all([
              execAsync("git rev-parse --abbrev-ref HEAD"),
              execAsync("git status --short"),
              execAsync("git log -5 --oneline"),
            ]);
          return {
            branch: branch.trim(),
            status: status.trim() || "(clean)",
            recentCommits: log.trim().split("\n").filter(Boolean),
          };
        } catch (error) {
          return {
            error: error instanceof Error ? error.message : "Not a git repository",
          };
        }
      },
    }),
  };
}
