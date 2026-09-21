import fs from "node:fs/promises";
import path from "node:path";
import { exec } from "node:child_process";
import { promisify } from "node:util";
import { tool } from "ai";
import { z } from "zod";

const execAsync = promisify(exec);

export type HelixSecrets = {
  githubToken?: string;
  githubUser?: string;
  defaultBranch?: string;
  hosting?: {
    allowCredentialedSetup?: boolean;
    preferredHost?: string;
    vercelToken?: string;
    netlifyToken?: string;
    cloudflareToken?: string;
    cloudflareAccountId?: string;
  };
  trading?: {
    allowLiveTrading?: boolean;
    binanceApiKey?: string;
    binanceApiSecret?: string;
  };
};

function secretsPath(workspace: string) {
  return path.join(workspace, ".helix", "secrets.json");
}

export async function loadSecrets(workspace: string): Promise<HelixSecrets> {
  try {
    const raw = await fs.readFile(secretsPath(workspace), "utf8");
    return JSON.parse(raw) as HelixSecrets;
  } catch {
    return {};
  }
}

export async function saveSecrets(
  workspace: string,
  patch: HelixSecrets
): Promise<HelixSecrets> {
  const current = await loadSecrets(workspace);
  const next = { ...current, ...patch };
  await fs.mkdir(path.dirname(secretsPath(workspace)), { recursive: true });
  await fs.writeFile(secretsPath(workspace), JSON.stringify(next, null, 2), "utf8");
  if (next.githubToken) {
    process.env.GITHUB_TOKEN = next.githubToken;
  }
  return next;
}

export async function githubStatus(workspace: string) {
  const secrets = await loadSecrets(workspace);
  const token = secrets.githubToken || process.env.GITHUB_TOKEN;
  let remote: string | null = null;
  let branch: string | null = null;
  let dirty = false;
  try {
    const [{ stdout: rem }, { stdout: br }, { stdout: st }] = await Promise.all([
      execAsync("git remote get-url origin", { cwd: workspace }),
      execAsync("git rev-parse --abbrev-ref HEAD", { cwd: workspace }),
      execAsync("git status --porcelain", { cwd: workspace }),
    ]);
    remote = rem.trim();
    branch = br.trim();
    dirty = st.trim().length > 0;
  } catch {
    // not a git repo
  }

  let user: string | null = secrets.githubUser ?? null;
  if (token && !user) {
    try {
      const res = await fetch("https://api.github.com/user", {
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: "application/vnd.github+json",
          "User-Agent": "HelixAgent/0.1",
        },
      });
      if (res.ok) {
        const data = (await res.json()) as { login?: string };
        user = data.login ?? null;
      }
    } catch {
      // ignore
    }
  }

  return {
    connected: Boolean(token),
    user,
    remote,
    branch,
    dirty,
    hasEnvToken: Boolean(process.env.GITHUB_TOKEN),
  };
}

export async function gitCommit(workspace: string, message: string, paths?: string[]) {
  const addCmd =
    paths && paths.length > 0
      ? `git add -- ${paths.map((p) => JSON.stringify(p)).join(" ")}`
      : "git add -A";
  await execAsync(addCmd, { cwd: workspace });
  const { stdout: status } = await execAsync("git status --porcelain", { cwd: workspace });
  if (!status.trim()) {
    return { ok: true, committed: false, reason: "nothing to commit" };
  }
  const safeMessage = message.replace(/"/g, '\\"');
  await execAsync(`git commit -m "${safeMessage}"`, { cwd: workspace });
  const { stdout: sha } = await execAsync("git rev-parse --short HEAD", { cwd: workspace });
  return { ok: true, committed: true, sha: sha.trim() };
}

export async function gitPush(workspace: string, setUpstream = true) {
  const secrets = await loadSecrets(workspace);
  const token = secrets.githubToken || process.env.GITHUB_TOKEN;
  const { stdout: branchOut } = await execAsync("git rev-parse --abbrev-ref HEAD", {
    cwd: workspace,
  });
  const branch = branchOut.trim();
  const { stdout: remoteOut } = await execAsync("git remote get-url origin", {
    cwd: workspace,
  });
  let remote = remoteOut.trim();

  const env = { ...process.env };
  if (token && remote.includes("github.com")) {
    if (remote.startsWith("git@github.com:")) {
      remote = remote.replace("git@github.com:", "https://github.com/");
    }
    if (remote.startsWith("https://github.com/")) {
      remote = remote.replace(
        "https://github.com/",
        `https://x-access-token:${token}@github.com/`
      );
    }
    const args = setUpstream
      ? ["push", "-u", remote, `HEAD:refs/heads/${branch}`]
      : ["push", remote, `HEAD:refs/heads/${branch}`];
    const { stdout, stderr } = await execAsync(`git ${args.map((a) => JSON.stringify(a)).join(" ")}`, {
      cwd: workspace,
      env,
      timeout: 120_000,
    });
    return { ok: true, branch, stdout: stdout.slice(0, 4000), stderr: stderr.slice(0, 2000) };
  }

  const { stdout, stderr } = await execAsync(
    setUpstream ? `git push -u origin HEAD` : `git push`,
    { cwd: workspace, env, timeout: 120_000 }
  );
  return { ok: true, branch, stdout: stdout.slice(0, 4000), stderr: stderr.slice(0, 2000) };
}

export function createGitTools(workspace: string) {
  return {
    git_commit: tool({
      description: "Stage and commit workspace changes with a message.",
      inputSchema: z.object({
        message: z.string().min(1),
        paths: z.array(z.string()).optional(),
      }),
      execute: async ({ message, paths }) => gitCommit(workspace, message, paths),
    }),
    git_push: tool({
      description:
        "Push the current branch to GitHub origin. Uses the connected GitHub token when available.",
      inputSchema: z.object({
        setUpstream: z.boolean().default(true),
      }),
      execute: async ({ setUpstream }) => gitPush(workspace, setUpstream),
    }),
    github_connection_status: tool({
      description: "Check whether GitHub is connected and show remote/branch status.",
      inputSchema: z.object({}),
      execute: async () => githubStatus(workspace),
    }),
  };
}
