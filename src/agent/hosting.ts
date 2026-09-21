/**
 * Website hosting setup — two modes:
 * 1) credentialed: Helix picks a host and deploys with tokens you explicitly allow
 * 2) assisted: Helix opens/clicks through the host UI on your PC; you log in yourself
 */

import fs from "node:fs/promises";
import path from "node:path";
import { exec } from "node:child_process";
import { promisify } from "node:util";
import { tool } from "ai";
import { z } from "zod";
import { loadSecrets, saveSecrets, type HelixSecrets } from "./github.js";
import { detectBuildPipeline, runBuildCommand } from "./build.js";

const execAsync = promisify(exec);

export type HostProvider =
  | "vercel"
  | "netlify"
  | "cloudflare-pages"
  | "github-pages"
  | "auto";

export type HostingMode = "credentialed" | "assisted";

export type HostingSettings = {
  allowCredentialedSetup: boolean;
  preferredHost: HostProvider;
  vercelToken?: string;
  netlifyToken?: string;
  cloudflareToken?: string;
  cloudflareAccountId?: string;
};

export type HostingSession = {
  id: string;
  mode: HostingMode;
  provider: Exclude<HostProvider, "auto">;
  status:
    | "awaiting-allow"
    | "awaiting-login"
    | "ready"
    | "deploying"
    | "done"
    | "error";
  loginUrl: string;
  dashboardUrl: string;
  steps: string[];
  message: string;
  url?: string;
  startedAt: string;
  updatedAt: string;
  error?: string;
};

type PlaywrightPage = {
  url: () => string;
  goto: (url: string, opts?: { waitUntil?: string }) => Promise<unknown>;
  waitForTimeout: (ms: number) => Promise<unknown>;
  getByRole: (
    role: string,
    opts?: { name?: RegExp | string }
  ) => { click: (opts?: { timeout?: number }) => Promise<unknown> };
};

type AssistedBrowser = {
  context: { close: () => Promise<void>; pages: () => PlaywrightPage[]; newPage: () => Promise<PlaywrightPage> };
  page: PlaywrightPage;
};

let assisted: AssistedBrowser | null = null;
let currentSession: HostingSession | null = null;

function hostingDir(workspace: string) {
  return path.join(workspace, ".helix", "hosting");
}

function sessionPath(workspace: string) {
  return path.join(hostingDir(workspace), "session.json");
}

function hostingFromSecrets(secrets: HelixSecrets): HostingSettings {
  const h = secrets.hosting ?? {};
  return {
    allowCredentialedSetup: Boolean(h.allowCredentialedSetup),
    preferredHost: (h.preferredHost as HostProvider) || "auto",
    vercelToken: h.vercelToken || process.env.VERCEL_TOKEN,
    netlifyToken: h.netlifyToken || process.env.NETLIFY_AUTH_TOKEN,
    cloudflareToken: h.cloudflareToken || process.env.CLOUDFLARE_API_TOKEN,
    cloudflareAccountId: h.cloudflareAccountId || process.env.CLOUDFLARE_ACCOUNT_ID,
  };
}

export async function getHostingSettings(workspace: string): Promise<HostingSettings> {
  return hostingFromSecrets(await loadSecrets(workspace));
}

export async function saveHostingSettings(
  workspace: string,
  patch: Partial<HostingSettings> & { clearTokens?: boolean }
): Promise<HostingSettings> {
  const secrets = await loadSecrets(workspace);
  const current = hostingFromSecrets(secrets);
  const next: HostingSettings = {
    allowCredentialedSetup:
      patch.allowCredentialedSetup !== undefined
        ? patch.allowCredentialedSetup
        : current.allowCredentialedSetup,
    preferredHost: patch.preferredHost ?? current.preferredHost,
    vercelToken: current.vercelToken,
    netlifyToken: current.netlifyToken,
    cloudflareToken: current.cloudflareToken,
    cloudflareAccountId: current.cloudflareAccountId,
  };
  if (typeof patch.vercelToken === "string" && patch.vercelToken.trim()) {
    next.vercelToken = patch.vercelToken.trim();
  }
  if (typeof patch.netlifyToken === "string" && patch.netlifyToken.trim()) {
    next.netlifyToken = patch.netlifyToken.trim();
  }
  if (typeof patch.cloudflareToken === "string" && patch.cloudflareToken.trim()) {
    next.cloudflareToken = patch.cloudflareToken.trim();
  }
  if (typeof patch.cloudflareAccountId === "string" && patch.cloudflareAccountId.trim()) {
    next.cloudflareAccountId = patch.cloudflareAccountId.trim();
  }
  if (patch.clearTokens) {
    next.vercelToken = undefined;
    next.netlifyToken = undefined;
    next.cloudflareToken = undefined;
    next.cloudflareAccountId = undefined;
  }
  const hosting: NonNullable<HelixSecrets["hosting"]> = {
    allowCredentialedSetup: next.allowCredentialedSetup,
    preferredHost: next.preferredHost,
  };
  if (next.vercelToken) hosting.vercelToken = next.vercelToken;
  if (next.netlifyToken) hosting.netlifyToken = next.netlifyToken;
  if (next.cloudflareToken) hosting.cloudflareToken = next.cloudflareToken;
  if (next.cloudflareAccountId) hosting.cloudflareAccountId = next.cloudflareAccountId;

  await saveSecrets(workspace, { hosting });
  return next;
}

const PROVIDER_META: Record<
  Exclude<HostProvider, "auto">,
  { name: string; loginUrl: string; dashboardUrl: string; tokenHelp: string }
> = {
  vercel: {
    name: "Vercel",
    loginUrl: "https://vercel.com/login",
    dashboardUrl: "https://vercel.com/new",
    tokenHelp: "https://vercel.com/account/tokens",
  },
  netlify: {
    name: "Netlify",
    loginUrl: "https://app.netlify.com/login",
    dashboardUrl: "https://app.netlify.com/start",
    tokenHelp: "https://app.netlify.com/user/applications#personal-access-tokens",
  },
  "cloudflare-pages": {
    name: "Cloudflare Pages",
    loginUrl: "https://dash.cloudflare.com/login",
    dashboardUrl: "https://dash.cloudflare.com/?to=/:account/pages",
    tokenHelp: "https://dash.cloudflare.com/profile/api-tokens",
  },
  "github-pages": {
    name: "GitHub Pages",
    loginUrl: "https://github.com/login",
    dashboardUrl: "https://github.com/new",
    tokenHelp: "Use the GitHub panel token (repo scope)",
  },
};

export async function recommendHost(workspace: string): Promise<{
  provider: Exclude<HostProvider, "auto">;
  reason: string;
  alternatives: Array<Exclude<HostProvider, "auto">>;
}> {
  const settings = await getHostingSettings(workspace);
  if (settings.preferredHost !== "auto") {
    return {
      provider: settings.preferredHost,
      reason: "User preferred host in Helix hosting settings.",
      alternatives: ["vercel", "netlify", "cloudflare-pages", "github-pages"],
    };
  }

  const pipeline = await detectBuildPipeline(workspace);
  const hasNext = pipeline.stack.some((s) => /next/i.test(s)) ||
    (await fileExists(path.join(workspace, "next.config.js"))) ||
    (await fileExists(path.join(workspace, "next.config.ts"))) ||
    (await fileExists(path.join(workspace, "next.config.mjs")));
  const pkg = await readPkg(workspace);
  const deps = { ...(pkg?.dependencies as object), ...(pkg?.devDependencies as object) };
  const depNames = Object.keys(deps ?? {});

  if (hasNext || depNames.includes("next")) {
    return {
      provider: "vercel",
      reason: "Next.js / Vercel-native stack detected.",
      alternatives: ["netlify", "cloudflare-pages"],
    };
  }
  if (depNames.includes("vite") || (await fileExists(path.join(workspace, "index.html")))) {
    return {
      provider: "netlify",
      reason: "Static / Vite site — Netlify or Cloudflare Pages fit well; picking Netlify.",
      alternatives: ["cloudflare-pages", "vercel", "github-pages"],
    };
  }
  if (await loadSecrets(workspace).then((s) => Boolean(s.githubToken || process.env.GITHUB_TOKEN))) {
    return {
      provider: "github-pages",
      reason: "GitHub token already connected — GitHub Pages is available without a new host login.",
      alternatives: ["vercel", "netlify", "cloudflare-pages"],
    };
  }
  return {
    provider: "vercel",
    reason: "Default: Vercel works for most JS/web apps and has a simple token deploy path.",
    alternatives: ["netlify", "cloudflare-pages", "github-pages"],
  };
}

async function fileExists(p: string) {
  try {
    await fs.access(p);
    return true;
  } catch {
    return false;
  }
}

async function readPkg(workspace: string) {
  try {
    return JSON.parse(
      await fs.readFile(path.join(workspace, "package.json"), "utf8")
    ) as Record<string, unknown>;
  } catch {
    return null;
  }
}

async function ensureBuilt(workspace: string, relativeRoot?: string) {
  const cwd = relativeRoot ? path.join(workspace, relativeRoot) : workspace;
  const pipeline = await detectBuildPipeline(cwd);
  const build = pipeline.steps.find((s) => s.kind === "build" || s.kind === "compile");
  if (!build) {
    return { ok: true as const, skipped: true, note: "No build script — deploying as-is." };
  }
  const result = await runBuildCommand(cwd, build.command);
  return { ...result, skipped: false };
}

async function pickPublishDir(workspace: string, relativeRoot?: string): Promise<string> {
  const base = relativeRoot ? path.join(workspace, relativeRoot) : workspace;
  for (const dir of ["dist", "out", "build", "public"]) {
    if (await fileExists(path.join(base, dir))) {
      return relativeRoot ? path.join(relativeRoot, dir) : dir;
    }
  }
  return relativeRoot ? path.join(relativeRoot, "dist") : "dist";
}

async function openSystemBrowser(url: string) {
  const platform = process.platform;
  const cmd =
    platform === "win32" ? `start "" ${JSON.stringify(url)}` :
    platform === "darwin" ? `open ${JSON.stringify(url)}` :
    `xdg-open ${JSON.stringify(url)}`;
  try {
    await execAsync(cmd);
    return { opened: true as const, method: "system-browser" as const };
  } catch {
    return { opened: false as const, method: "none" as const, url };
  }
}

async function launchAssistedBrowser(loginUrl: string, workspace: string) {
  try {
    const playwright = await import("playwright");
    const profile = path.join(workspace, ".helix", "browser-profile");
    await fs.mkdir(profile, { recursive: true });
    const context = await playwright.chromium.launchPersistentContext(profile, {
      headless: false,
      viewport: { width: 1280, height: 860 },
      args: ["--disable-blink-features=AutomationControlled"],
    });
    const page = context.pages()[0] ?? (await context.newPage());
    await page.goto(loginUrl, { waitUntil: "domcontentloaded" });
    assisted = { context, page } as AssistedBrowser;
    return { opened: true as const, method: "playwright" as const };
  } catch (error) {
    const fallback = await openSystemBrowser(loginUrl);
    return {
      ...fallback,
      playwrightError: error instanceof Error ? error.message : String(error),
    };
  }
}

export async function getHostingSession(workspace: string): Promise<HostingSession | null> {
  if (currentSession) return currentSession;
  try {
    const raw = await fs.readFile(sessionPath(workspace), "utf8");
    currentSession = JSON.parse(raw) as HostingSession;
    return currentSession;
  } catch {
    return null;
  }
}

async function saveSession(workspace: string, session: HostingSession) {
  currentSession = session;
  await fs.mkdir(hostingDir(workspace), { recursive: true });
  await fs.writeFile(sessionPath(workspace), JSON.stringify(session, null, 2), "utf8");
  return session;
}

export async function startWebsiteSetup(
  workspace: string,
  input: {
    mode: HostingMode;
    provider?: HostProvider;
    projectName?: string;
    relativeRoot?: string;
  }
): Promise<HostingSession & { browser?: Record<string, unknown> }> {
  const settings = await getHostingSettings(workspace);
  const rec = await recommendHost(workspace);
  const provider = (
    input.provider && input.provider !== "auto" ? input.provider : rec.provider
  ) as Exclude<HostProvider, "auto">;
  const meta = PROVIDER_META[provider];
  const now = new Date().toISOString();

  if (input.mode === "credentialed" && !settings.allowCredentialedSetup) {
    const session: HostingSession = {
      id: `host-${Date.now()}`,
      mode: "credentialed",
      provider,
      status: "awaiting-allow",
      loginUrl: meta.loginUrl,
      dashboardUrl: meta.dashboardUrl,
      steps: [
        "Open the Host tab in Helix.",
        "Enable “Allow credentialed host setup”.",
        `Paste a ${meta.name} token (not your password) from ${meta.tokenHelp}.`,
        "Run setup again in credentialed mode — Helix will build and deploy.",
      ],
      message:
        "Credentialed setup is locked until you explicitly allow it and store a host token locally.",
      startedAt: now,
      updatedAt: now,
    };
    await saveSession(workspace, session);
    return session;
  }

  if (input.mode === "assisted") {
    const browser = await launchAssistedBrowser(meta.loginUrl, workspace);
    const session: HostingSession = {
      id: `host-${Date.now()}`,
      mode: "assisted",
      provider,
      status: "awaiting-login",
      loginUrl: meta.loginUrl,
      dashboardUrl: meta.dashboardUrl,
      steps: [
        `A browser should open to ${meta.name} login (${meta.loginUrl}).`,
        "Log in yourself (Helix does not type your password).",
        "When you see the dashboard, click “I’m logged in” in the Helix Host tab (or tell the agent).",
        "Helix will then click through new-project / deploy steps on your PC.",
      ],
      message: `${meta.name} assisted setup started. Log in in the browser, then confirm.`,
      startedAt: now,
      updatedAt: now,
    };
    await saveSession(workspace, session);
    return { ...session, browser };
  }

  // credentialed + allowed → deploy immediately
  const deploy = await deployWithCredentials(workspace, {
    provider,
    relativeRoot: input.relativeRoot,
    projectName: input.projectName,
  });
  const session: HostingSession = {
    id: `host-${Date.now()}`,
    mode: "credentialed",
    provider,
    status: deploy.ok ? "done" : "error",
    loginUrl: meta.loginUrl,
    dashboardUrl: meta.dashboardUrl,
    steps: deploy.steps,
    message: deploy.message,
    url: deploy.url,
    error: deploy.ok ? undefined : deploy.message,
    startedAt: now,
    updatedAt: new Date().toISOString(),
  };
  await saveSession(workspace, session);
  return session;
}

export async function confirmHostingLogin(workspace: string) {
  const session = await getHostingSession(workspace);
  if (!session || session.mode !== "assisted") {
    return { ok: false, error: "No assisted hosting session awaiting login." };
  }
  session.status = "ready";
  session.message = "Login confirmed. Call hosting_assisted_deploy to continue click-through setup.";
  session.updatedAt = new Date().toISOString();
  await saveSession(workspace, session);
  return { ok: true, session };
}

/** Best-effort click-through after the user logged in. */
export async function assistedHostingDeploy(
  workspace: string,
  input: { projectName?: string; relativeRoot?: string } = {}
) {
  const session = await getHostingSession(workspace);
  if (!session || session.mode !== "assisted") {
    return { ok: false, error: "Start assisted setup and confirm login first." };
  }
  if (session.status === "awaiting-login") {
    return { ok: false, error: "Confirm login first (hosting_confirm_login)." };
  }

  session.status = "deploying";
  session.updatedAt = new Date().toISOString();
  await saveSession(workspace, session);

  await ensureBuilt(workspace, input.relativeRoot);
  const publishDir = await pickPublishDir(workspace, input.relativeRoot);
  const absPublish = path.join(workspace, publishDir);
  const name = input.projectName || path.basename(workspace);
  const meta = PROVIDER_META[session.provider];
  const clicks: string[] = [];

  if (assisted?.page) {
    const page = assisted.page;
    try {
      await page.goto(meta.dashboardUrl, { waitUntil: "domcontentloaded" });
      clicks.push(`Opened ${meta.dashboardUrl}`);
      await page.waitForTimeout(1500);

      // Best-effort UI navigation — hosts change often; fall back to instructions
      if (session.provider === "vercel") {
        try {
          await page.getByRole("button", { name: /add new|add\.\.\.|create/i }).click({
            timeout: 4000,
          });
          clicks.push("Clicked Add New");
        } catch {
          clicks.push("Could not auto-click Add New — use the open dashboard.");
        }
        try {
          await page.getByRole("link", { name: /project/i }).click({ timeout: 4000 });
          clicks.push("Opened Project flow");
        } catch {
          // ignore
        }
      } else if (session.provider === "netlify") {
        try {
          await page.getByRole("button", { name: /add new site|import/i }).click({
            timeout: 4000,
          });
          clicks.push("Clicked add new site");
        } catch {
          clicks.push("Open “Add new site” manually in the Netlify window.");
        }
      } else if (session.provider === "cloudflare-pages") {
        clicks.push("In Cloudflare Pages: Create application → Pages → Upload assets or Connect git.");
      } else {
        clicks.push("In GitHub: create repo / enable Pages → Deploy from branch (gh-pages or docs).");
      }

      session.status = "ready";
      session.steps = [
        ...clicks,
        `Local build output ready at: ${publishDir}`,
        absPublish
          ? `Upload/import that folder (or connect the git repo) in the open ${meta.name} window.`
          : "Build the site, then upload dist/.",
        "When the live URL appears, paste it back to Helix.",
      ];
      session.message = `${meta.name} dashboard is open. Helix prepared clicks + local build; finish linking the project in the browser if a click was missed.`;
      session.updatedAt = new Date().toISOString();
      await saveSession(workspace, session);
      return {
        ok: true,
        session,
        publishDir,
        absolutePublishDir: absPublish,
        clicks,
        note: "Assisted mode never submits your password. Complete any remaining host UI steps in the open window.",
      };
    } catch (error) {
      session.status = "error";
      session.error = error instanceof Error ? error.message : String(error);
      session.updatedAt = new Date().toISOString();
      await saveSession(workspace, session);
      return { ok: false, error: session.error, session, publishDir };
    }
  }

  // No Playwright session — open dashboard and guide
  await openSystemBrowser(meta.dashboardUrl);
  session.status = "ready";
  session.steps = [
    `Opened ${meta.dashboardUrl} in your browser.`,
    `Publish folder prepared: ${publishDir}`,
    `Create/import project “${name}” and deploy that folder or connect git.`,
    "Paste the live URL back to Helix when done.",
  ];
  session.message = "Assisted checklist ready (system browser).";
  session.updatedAt = new Date().toISOString();
  await saveSession(workspace, session);
  return { ok: true, session, publishDir, clicks: session.steps };
}

export async function deployWithCredentials(
  workspace: string,
  input: {
    provider: Exclude<HostProvider, "auto">;
    relativeRoot?: string;
    projectName?: string;
  }
): Promise<{ ok: boolean; message: string; url?: string; steps: string[]; log?: string }> {
  const settings = await getHostingSettings(workspace);
  if (!settings.allowCredentialedSetup) {
    return {
      ok: false,
      message: "Credentialed setup not allowed. Enable it in the Host tab.",
      steps: ["Enable allowCredentialedSetup", "Save a host token", "Retry"],
    };
  }

  const steps: string[] = [];
  const build = await ensureBuilt(workspace, input.relativeRoot);
  steps.push(build.skipped ? "Build skipped (none detected)" : build.ok ? "Build ok" : "Build failed");
  if (!build.ok && !build.skipped) {
    return {
      ok: false,
      message: "Build failed before deploy.",
      steps,
      log: ("stderr" in build ? build.stderr : "") || "",
    };
  }

  const publishDir = await pickPublishDir(workspace, input.relativeRoot);
  const name = (input.projectName || path.basename(workspace)).replace(/[^a-zA-Z0-9-_]/g, "-");

  if (input.provider === "vercel") {
    if (!settings.vercelToken) {
      return {
        ok: false,
        message: "Missing Vercel token. Save one in the Host tab.",
        steps: [...steps, `Create token at ${PROVIDER_META.vercel.tokenHelp}`],
      };
    }
    try {
      const cmd = `npx --yes vercel@latest deploy ${JSON.stringify(publishDir)} --prod --yes --token ${JSON.stringify(settings.vercelToken)} --name ${JSON.stringify(name)}`;
      const { stdout, stderr } = await execAsync(cmd, {
        cwd: workspace,
        timeout: 600_000,
        maxBuffer: 8 * 1024 * 1024,
        env: { ...process.env, VERCEL_TOKEN: settings.vercelToken },
      });
      const combined = `${stdout}\n${stderr}`;
      const urlMatch = combined.match(/https:\/\/[^\s]+\.vercel\.app[^\s]*/);
      steps.push("Vercel deploy finished");
      return {
        ok: true,
        message: "Deployed to Vercel with your allowed token.",
        url: urlMatch?.[0],
        steps,
        log: combined.slice(-4000),
      };
    } catch (error) {
      const err = error as { stdout?: string; stderr?: string; message?: string };
      return {
        ok: false,
        message: err.stderr || err.message || "Vercel deploy failed",
        steps,
        log: `${err.stdout ?? ""}\n${err.stderr ?? ""}`.slice(-4000),
      };
    }
  }

  if (input.provider === "netlify") {
    if (!settings.netlifyToken) {
      return {
        ok: false,
        message: "Missing Netlify token. Save one in the Host tab.",
        steps: [...steps, `Create token at ${PROVIDER_META.netlify.tokenHelp}`],
      };
    }
    try {
      const cmd = `npx --yes netlify-cli deploy --prod --dir ${JSON.stringify(publishDir)} --auth ${JSON.stringify(settings.netlifyToken)}`;
      const { stdout, stderr } = await execAsync(cmd, {
        cwd: workspace,
        timeout: 600_000,
        maxBuffer: 8 * 1024 * 1024,
        env: { ...process.env, NETLIFY_AUTH_TOKEN: settings.netlifyToken },
      });
      const combined = `${stdout}\n${stderr}`;
      const urlMatch = combined.match(/https:\/\/[^\s]+\.netlify\.app[^\s]*/);
      steps.push("Netlify deploy finished");
      return {
        ok: true,
        message: "Deployed to Netlify with your allowed token.",
        url: urlMatch?.[0],
        steps,
        log: combined.slice(-4000),
      };
    } catch (error) {
      const err = error as { stdout?: string; stderr?: string; message?: string };
      return {
        ok: false,
        message: err.stderr || err.message || "Netlify deploy failed",
        steps,
        log: `${err.stdout ?? ""}\n${err.stderr ?? ""}`.slice(-4000),
      };
    }
  }

  if (input.provider === "github-pages") {
    const secrets = await loadSecrets(workspace);
    const token = secrets.githubToken || process.env.GITHUB_TOKEN;
    if (!token) {
      return {
        ok: false,
        message: "Connect GitHub in the GitHub tab first (token needed for Pages).",
        steps,
      };
    }
    steps.push(
      "GitHub Pages: push the publish folder to branch gh-pages (or enable Pages in repo settings).",
      `Publish dir: ${publishDir}`,
      "Helix can commit/push if you ask — or use assisted mode to click through repo Settings → Pages."
    );
    return {
      ok: true,
      message:
        "GitHub Pages needs a repo + Pages config. Token is present — ask Helix to push a gh-pages branch or finish in assisted mode.",
      steps,
    };
  }

  // Cloudflare Pages via wrangler
  if (!settings.cloudflareToken || !settings.cloudflareAccountId) {
    return {
      ok: false,
      message: "Cloudflare Pages needs API token + account id in the Host tab.",
      steps: [...steps, PROVIDER_META["cloudflare-pages"].tokenHelp],
    };
  }
  try {
    const cmd = `npx --yes wrangler pages deploy ${JSON.stringify(publishDir)} --project-name ${JSON.stringify(name)}`;
    const { stdout, stderr } = await execAsync(cmd, {
      cwd: workspace,
      timeout: 600_000,
      maxBuffer: 8 * 1024 * 1024,
      env: {
        ...process.env,
        CLOUDFLARE_API_TOKEN: settings.cloudflareToken,
        CLOUDFLARE_ACCOUNT_ID: settings.cloudflareAccountId,
      },
    });
    const combined = `${stdout}\n${stderr}`;
    const urlMatch = combined.match(/https:\/\/[^\s]+\.pages\.dev[^\s]*/);
    steps.push("Cloudflare Pages deploy finished");
    return {
      ok: true,
      message: "Deployed to Cloudflare Pages with your allowed token.",
      url: urlMatch?.[0],
      steps,
      log: combined.slice(-4000),
    };
  } catch (error) {
    const err = error as { stdout?: string; stderr?: string; message?: string };
    return {
      ok: false,
      message: err.stderr || err.message || "Cloudflare deploy failed",
      steps,
      log: `${err.stdout ?? ""}\n${err.stderr ?? ""}`.slice(-4000),
    };
  }
}

export async function closeAssistedBrowser() {
  if (assisted) {
    try {
      await assisted.context.close();
    } catch {
      // ignore
    }
    assisted = null;
  }
  return { ok: true };
}

export function createHostingTools(workspace: string) {
  return {
    hosting_recommend: tool({
      description:
        "Recommend a website host (Vercel, Netlify, Cloudflare Pages, GitHub Pages) for this project.",
      inputSchema: z.object({}),
      execute: async () => recommendHost(workspace),
    }),

    hosting_status: tool({
      description: "Show hosting allow-flag, which tokens are saved (booleans only), and current setup session.",
      inputSchema: z.object({}),
      execute: async () => {
        const settings = await getHostingSettings(workspace);
        const session = await getHostingSession(workspace);
        return {
          allowCredentialedSetup: settings.allowCredentialedSetup,
          preferredHost: settings.preferredHost,
          hasVercelToken: Boolean(settings.vercelToken),
          hasNetlifyToken: Boolean(settings.netlifyToken),
          hasCloudflareToken: Boolean(settings.cloudflareToken),
          hasCloudflareAccountId: Boolean(settings.cloudflareAccountId),
          session,
        };
      },
    }),

    hosting_start_setup: tool({
      description:
        "Start website hosting setup. mode=credentialed uses allowed tokens to find/deploy. mode=assisted opens the host on the user's PC for them to log in; Helix clicks through afterward.",
      inputSchema: z.object({
        mode: z.enum(["credentialed", "assisted"]),
        provider: z
          .enum(["vercel", "netlify", "cloudflare-pages", "github-pages", "auto"])
          .default("auto"),
        projectName: z.string().optional(),
        relativeRoot: z.string().optional(),
      }),
      execute: async (input) => startWebsiteSetup(workspace, input),
    }),

    hosting_confirm_login: tool({
      description:
        "Call after the user logged into the host in the assisted browser window.",
      inputSchema: z.object({}),
      execute: async () => confirmHostingLogin(workspace),
    }),

    hosting_assisted_deploy: tool({
      description:
        "After assisted login, build the site and click through host UI / open dashboard to finish setup on the user's PC.",
      inputSchema: z.object({
        projectName: z.string().optional(),
        relativeRoot: z.string().optional(),
      }),
      execute: async (input) => assistedHostingDeploy(workspace, input),
    }),

    hosting_deploy_credentialed: tool({
      description:
        "Build and deploy with a stored host token. Requires Host tab allow + token. Never uses passwords — tokens only.",
      inputSchema: z.object({
        provider: z.enum(["vercel", "netlify", "cloudflare-pages", "github-pages"]),
        projectName: z.string().optional(),
        relativeRoot: z.string().optional(),
      }),
      execute: async (input) => deployWithCredentials(workspace, input),
    }),
  };
}
