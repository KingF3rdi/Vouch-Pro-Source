import express from "express";
import cors from "cors";
import path from "node:path";
import fs from "node:fs/promises";
import fsSync from "node:fs";
import { fileURLToPath } from "node:url";
import type { UIMessage } from "ai";
import { getDefaultSettings } from "../agent/settings.js";
import { installOrUpdateProject, defaultWorkspacePath } from "../agent/projectInstall.js";
import {
  createSession,
  deleteSession,
  getSession,
  listSessions,
  saveSession,
  type StoredSession,
} from "../agent/sessions.js";
import {
  HELIX_MODELS,
  getHelixModel,
  loadHelixSettings,
  saveHelixSettings,
} from "../agent/models.js";
import type { AgentMode, ProviderKind } from "../shared/types.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.HELIX_PORT ?? 8787);
const bootStarted = Date.now();

function loadEnvFileSync() {
  try {
    const envPath = path.resolve(process.cwd(), ".env");
    const raw = fsSync.readFileSync(envPath, "utf8");
    for (const line of raw.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const eq = trimmed.indexOf("=");
      if (eq === -1) continue;
      const key = trimmed.slice(0, eq).trim();
      const value = trimmed.slice(eq + 1).trim().replace(/^["']|["']$/g, "");
      if (!(key in process.env)) process.env[key] = value;
    }
  } catch {
    // optional .env
  }
}

function workspaceFromQuery(raw?: string) {
  return path.resolve(raw || process.env.HELIX_WORKSPACE || process.cwd());
}

function assertInside(workspace: string, targetPath: string) {
  const root = path.resolve(workspace);
  const resolved = path.resolve(root, targetPath);
  if (resolved !== root && !resolved.startsWith(root + path.sep)) {
    throw new Error("Path escapes workspace");
  }
  return resolved;
}

loadEnvFileSync();

// Ensure project folder exists. Desktop already synced sync — skip duplicate boot work.
if (!process.env.HELIX_WORKSPACE) {
  process.env.HELIX_WORKSPACE = defaultWorkspacePath();
}
if (process.env.HELIX_DESKTOP === "1") {
  console.log(`[helix] desktop workspace=${process.env.HELIX_WORKSPACE}`);
} else {
  void installOrUpdateProject({ workspace: process.env.HELIX_WORKSPACE }).then((info) => {
    process.env.HELIX_WORKSPACE = info.workspace;
    console.log(
      `[helix] project ${info.workspace} · created=${info.created.length} updated=${info.updated.length}`
    );
  });
}

const app = express();
app.use(cors());
app.use(express.json({ limit: "8mb" }));

// Health first — Electron polls this to open the UI
app.get("/api/health", (_req, res) => {
  res.json({
    ok: true,
    name: "helix-agent",
    version: "0.6.0",
    backend: "typescript-agent",
    agents: ["typescript", "python-optional"],
    bootMs: Date.now() - bootStarted,
  });
});

// Accept connections immediately — remaining routes register on this same app.
app.listen(PORT, "127.0.0.1", () => {
  console.log(
    `Helix agent listening on http://127.0.0.1:${PORT} (boot ${Date.now() - bootStarted}ms)`
  );
});

app.get("/api/settings", async (_req, res) => {
  res.json(await getDefaultSettings());
});

app.get("/api/project", async (_req, res) => {
  const info = await installOrUpdateProject({
    workspace: process.env.HELIX_WORKSPACE || defaultWorkspacePath(),
  });
  process.env.HELIX_WORKSPACE = info.workspace;
  res.json(info);
});

app.post("/api/project/install", async (req, res) => {
  try {
    const workspace =
      typeof req.body?.workspace === "string" && req.body.workspace.trim()
        ? path.resolve(req.body.workspace.trim())
        : process.env.HELIX_WORKSPACE || defaultWorkspacePath();
    const info = await installOrUpdateProject({ workspace });
    process.env.HELIX_WORKSPACE = info.workspace;
    res.json({ ok: true, ...info });
  } catch (error) {
    res.status(500).json({
      error: error instanceof Error ? error.message : "Project install failed",
    });
  }
});

app.get("/api/models", async (req, res) => {
  const workspace = workspaceFromQuery(
    typeof req.query.workspace === "string" ? req.query.workspace : undefined
  );
  const saved = await loadHelixSettings(workspace);
  const { listModelAvailability } = await import("../agent/models.js");
  const availability = await listModelAvailability();
  res.json({
    models: HELIX_MODELS,
    selected: saved.modelId,
    gatewayConfigured: availability.gatewayConfigured,
    anthropicConfigured: availability.anthropicConfigured,
    openaiConfigured: availability.openaiConfigured,
    freeReady: availability.freeReady,
    ollamaReady: availability.ollamaReady,
    ollamaModels: availability.ollamaModels,
    ftReady: availability.ftReady,
    groqConfigured: availability.groqConfigured,
    openrouterConfigured: availability.openrouterConfigured,
  });
});

app.put("/api/models/selected", async (req, res) => {
  const workspace = workspaceFromQuery(req.body?.workspace);
  const modelId = String(req.body?.modelId ?? "");
  const profile = getHelixModel(modelId);
  const saved = await saveHelixSettings(workspace, { modelId: profile.id });
  res.json({ ok: true, selected: saved.modelId, profile });
});

app.get("/api/skills", async (_req, res) => {
  const { listSkills } = await import("../agent/skills.js");
  res.json({ skills: await listSkills() });
});

app.get("/api/plugins", async (_req, res) => {
  const { loadPlugins } = await import("../agent/plugins.js");
  const plugins = await loadPlugins();
  res.json({ plugins: plugins.map((plugin) => plugin.manifest) });
});

app.get("/api/project/map", async (req, res) => {
  try {
    const workspace = workspaceFromQuery(
      typeof req.query.workspace === "string" ? req.query.workspace : undefined
    );
    const { buildProjectMap } = await import("../agent/projectMap.js");
    res.json(await buildProjectMap(workspace));
  } catch (error) {
    res.status(500).json({
      error: error instanceof Error ? error.message : "Map failed",
    });
  }
});

app.get("/api/fs/tree", async (req, res) => {
  try {
    const workspace = workspaceFromQuery(
      typeof req.query.workspace === "string" ? req.query.workspace : undefined
    );
    const relative =
      typeof req.query.path === "string" && req.query.path ? req.query.path : ".";
    const dir = assertInside(workspace, relative);
    const entries = await fs.readdir(dir, { withFileTypes: true });
    const ignore = new Set(["node_modules", ".git", "dist", ".helix"]);
    res.json({
      path: relative,
      entries: entries
        .filter((e) => !ignore.has(e.name))
        .map((e) => ({
          name: e.name,
          type: e.isDirectory() ? "dir" : "file",
          path: path.posix.join(relative.replaceAll("\\", "/"), e.name),
        }))
        .sort((a, b) => {
          if (a.type !== b.type) return a.type === "dir" ? -1 : 1;
          return a.name.localeCompare(b.name);
        }),
    });
  } catch (error) {
    res.status(400).json({
      error: error instanceof Error ? error.message : "Tree failed",
    });
  }
});

app.get("/api/fs/file", async (req, res) => {
  try {
    const workspace = workspaceFromQuery(
      typeof req.query.workspace === "string" ? req.query.workspace : undefined
    );
    const relative = typeof req.query.path === "string" ? req.query.path : "";
    if (!relative) {
      res.status(400).json({ error: "path required" });
      return;
    }
    const filePath = assertInside(workspace, relative);
    const content = await fs.readFile(filePath, "utf8");
    res.json({ path: relative, content });
  } catch (error) {
    res.status(400).json({
      error: error instanceof Error ? error.message : "Read failed",
    });
  }
});

app.put("/api/fs/file", async (req, res) => {
  try {
    const workspace = workspaceFromQuery(req.body?.workspace);
    const relative = req.body?.path as string;
    const content = req.body?.content as string;
    if (!relative || typeof content !== "string") {
      res.status(400).json({ error: "path and content required" });
      return;
    }
    const filePath = assertInside(workspace, relative);
    await fs.mkdir(path.dirname(filePath), { recursive: true });
    await fs.writeFile(filePath, content, "utf8");
    res.json({ ok: true, path: relative, absolutePath: filePath });
  } catch (error) {
    res.status(400).json({
      error: error instanceof Error ? error.message : "Write failed",
    });
  }
});

app.post("/api/fs/mkdir", async (req, res) => {
  try {
    const workspace = workspaceFromQuery(req.body?.workspace);
    const relative = String(req.body?.path ?? "").trim();
    if (!relative) {
      res.status(400).json({ error: "path required" });
      return;
    }
    const dirPath = assertInside(workspace, relative);
    await fs.mkdir(dirPath, { recursive: true });
    res.json({ ok: true, path: relative, absolutePath: dirPath });
  } catch (error) {
    res.status(400).json({
      error: error instanceof Error ? error.message : "mkdir failed",
    });
  }
});

app.get("/api/fs/workspace", async (_req, res) => {
  const workspace = process.env.HELIX_WORKSPACE || (await getDefaultSettings()).workspace;
  res.json({
    workspace,
    projectsRoot: path.dirname(workspace),
  });
});

app.get("/api/git/status", async (req, res) => {
  const workspace = workspaceFromQuery(
    typeof req.query.workspace === "string" ? req.query.workspace : undefined
  );
  const { getGitStatus } = await import("../agent/gitDiff.js");
  res.json({ files: await getGitStatus(workspace) });
});

app.get("/api/git/diff", async (req, res) => {
  try {
    const workspace = workspaceFromQuery(
      typeof req.query.workspace === "string" ? req.query.workspace : undefined
    );
    const relative = typeof req.query.path === "string" ? req.query.path : "";
    if (!relative) {
      res.status(400).json({ error: "path required" });
      return;
    }
    const { getFileDiff } = await import("../agent/gitDiff.js");
    res.json(await getFileDiff(workspace, relative));
  } catch (error) {
    res.status(400).json({
      error: error instanceof Error ? error.message : "Diff failed",
    });
  }
});

app.post("/api/git/diff", async (req, res) => {
  try {
    const workspace = workspaceFromQuery(req.body?.workspace);
    const relative = String(req.body?.path ?? "");
    if (!relative) {
      res.status(400).json({ error: "path required" });
      return;
    }
    const { getFileDiff } = await import("../agent/gitDiff.js");
    res.json(await getFileDiff(workspace, relative, req.body?.content));
  } catch (error) {
    res.status(400).json({
      error: error instanceof Error ? error.message : "Diff failed",
    });
  }
});

app.get("/api/sessions", async (req, res) => {
  const workspace = workspaceFromQuery(
    typeof req.query.workspace === "string" ? req.query.workspace : undefined
  );
  res.json({ sessions: await listSessions(workspace) });
});

app.post("/api/sessions", async (req, res) => {
  const workspace = workspaceFromQuery(req.body?.workspace);
  res.json({
    session: await createSession(workspace, {
      title: req.body?.title,
      mode: req.body?.mode,
      skillIds: req.body?.skillIds,
    }),
  });
});

app.get("/api/sessions/:id", async (req, res) => {
  const workspace = workspaceFromQuery(
    typeof req.query.workspace === "string" ? req.query.workspace : undefined
  );
  const session = await getSession(workspace, req.params.id);
  if (!session) {
    res.status(404).json({ error: "not found" });
    return;
  }
  res.json({ session });
});

app.put("/api/sessions/:id", async (req, res) => {
  const workspace = workspaceFromQuery(req.body?.workspace);
  const existing = await getSession(workspace, req.params.id);
  if (!existing) {
    res.status(404).json({ error: "not found" });
    return;
  }
  const next = await saveSession(workspace, {
    ...existing,
    ...(req.body as Partial<StoredSession>),
    id: existing.id,
  });
  // Continuous learning: ingest every saved conversation locally
  const { ingestMessages } = await import("../agent/learning.js");
  const learn = await ingestMessages(workspace, next.messages, "session").catch((error: unknown) => {
    console.warn("[helix] learning ingest:", error instanceof Error ? error.message : error);
    return null;
  });
  res.json({ session: next, learning: learn });
});

app.get("/api/learning", async (req, res) => {
  const workspace = workspaceFromQuery(
    typeof req.query.workspace === "string" ? req.query.workspace : undefined
  );
  const { learningStatus } = await import("../agent/learning.js");
  res.json(await learningStatus(workspace));
});

app.put("/api/learning/settings", async (req, res) => {
  const workspace = workspaceFromQuery(req.body?.workspace);
  const { saveLearningSettings } = await import("../agent/learning.js");
  const settings = await saveLearningSettings(workspace, req.body ?? {});
  res.json({ settings });
});

app.post("/api/learning/ingest", async (req, res) => {
  const workspace = workspaceFromQuery(req.body?.workspace);
  const messages = Array.isArray(req.body?.messages) ? req.body.messages : [];
  const { ingestMessages } = await import("../agent/learning.js");
  const result = await ingestMessages(workspace, messages, req.body?.source ?? "chat");
  res.json(result);
});

app.post("/api/learning/feedback", async (req, res) => {
  const workspace = workspaceFromQuery(req.body?.workspace);
  const learning = await import("../agent/learning.js");
  const result = await learning.recordFeedback(workspace, {
    userText: String(req.body?.userText ?? ""),
    assistantText: String(req.body?.assistantText ?? ""),
    rating: req.body?.rating === "down" ? "down" : "up",
    correction: typeof req.body?.correction === "string" ? req.body.correction : undefined,
  });
  const settings = await learning.loadLearningSettings(workspace);
  let retrainStarted = false;
  if (
    result.added > 0 &&
    settings.autoRetrain &&
    settings.pendingSinceTrain >= settings.retrainEvery
  ) {
    retrainStarted = learning.startRetrainJob(workspace);
  }
  res.json({ ...result, retrainStarted });
});

app.post("/api/learning/retrain", async (req, res) => {
  const workspace = workspaceFromQuery(req.body?.workspace);
  const { startRetrainJob, learningStatus } = await import("../agent/learning.js");
  const started = startRetrainJob(workspace);
  res.json({ ok: true, started, status: await learningStatus(workspace) });
});

app.post("/api/learning/observe", async (req, res) => {
  const workspace = workspaceFromQuery(req.body?.workspace);
  const { observeUserInput } = await import("../agent/learning.js");
  const result = await observeUserInput(workspace, {
    text: String(req.body?.text ?? ""),
    kind: typeof req.body?.kind === "string" ? req.body.kind : "user",
    meta: req.body?.meta && typeof req.body.meta === "object" ? req.body.meta : undefined,
  });
  res.json(result);
});

app.delete("/api/sessions/:id", async (req, res) => {
  const workspace = workspaceFromQuery(
    typeof req.query.workspace === "string" ? req.query.workspace : undefined
  );
  await deleteSession(workspace, req.params.id);
  res.json({ ok: true });
});

app.get("/api/mcp", async (req, res) => {
  const workspace = workspaceFromQuery(
    typeof req.query.workspace === "string" ? req.query.workspace : undefined
  );
  const mcp = await import("../agent/mcp.js");
  const config = await mcp.ensureDefaultMcpConfig(workspace);
  res.json({ config, servers: mcp.listMcpStates(config) });
});

app.put("/api/mcp/config", async (req, res) => {
  const workspace = workspaceFromQuery(req.body?.workspace);
  const mcp = await import("../agent/mcp.js");
  const config = await mcp.saveMcpConfig(workspace, req.body?.config);
  const servers = await mcp.reconnectMcpServers(workspace);
  res.json({ config, servers });
});

app.post("/api/mcp/reconnect", async (req, res) => {
  const workspace = workspaceFromQuery(req.body?.workspace);
  const mcp = await import("../agent/mcp.js");
  const servers = await mcp.reconnectMcpServers(workspace);
  const config = await mcp.loadMcpConfig(workspace);
  res.json({ config, servers });
});

app.get("/api/ship/pipeline", async (req, res) => {
  const workspace = workspaceFromQuery(
    typeof req.query.workspace === "string" ? req.query.workspace : undefined
  );
  const build = await import("../agent/build.js");
  res.json(await build.detectBuildPipeline(workspace));
});

app.get("/api/ship/artifacts", async (req, res) => {
  const workspace = workspaceFromQuery(
    typeof req.query.workspace === "string" ? req.query.workspace : undefined
  );
  const build = await import("../agent/build.js");
  const pipeline = await build.detectBuildPipeline(workspace);
  res.json({
    artifacts: await build.listBuildArtifacts(workspace, pipeline.artifactGlobs),
    pipeline,
  });
});

app.post("/api/ship/run", async (req, res) => {
  try {
    const workspace = workspaceFromQuery(req.body?.workspace);
    const build = await import("../agent/build.js");
    res.json(await build.runFullShip(workspace));
  } catch (error) {
    res.status(500).json({
      error: error instanceof Error ? error.message : "Ship failed",
    });
  }
});

app.get("/api/hosting/status", async (req, res) => {
  const workspace = workspaceFromQuery(
    typeof req.query.workspace === "string" ? req.query.workspace : undefined
  );
  const hosting = await import("../agent/hosting.js");
  const settings = await hosting.getHostingSettings(workspace);
  const session = await hosting.getHostingSession(workspace);
  res.json({
    allowCredentialedSetup: settings.allowCredentialedSetup,
    preferredHost: settings.preferredHost,
    hasVercelToken: Boolean(settings.vercelToken),
    hasNetlifyToken: Boolean(settings.netlifyToken),
    hasCloudflareToken: Boolean(settings.cloudflareToken),
    hasCloudflareAccountId: Boolean(settings.cloudflareAccountId),
    session,
  });
});

app.put("/api/hosting/settings", async (req, res) => {
  try {
    const workspace = workspaceFromQuery(req.body?.workspace);
    const hosting = await import("../agent/hosting.js");
    const settings = await hosting.saveHostingSettings(workspace, {
      allowCredentialedSetup: Boolean(req.body?.allowCredentialedSetup),
      preferredHost: req.body?.preferredHost,
      vercelToken: typeof req.body?.vercelToken === "string" ? req.body.vercelToken : undefined,
      netlifyToken: typeof req.body?.netlifyToken === "string" ? req.body.netlifyToken : undefined,
      cloudflareToken:
        typeof req.body?.cloudflareToken === "string" ? req.body.cloudflareToken : undefined,
      cloudflareAccountId:
        typeof req.body?.cloudflareAccountId === "string"
          ? req.body.cloudflareAccountId
          : undefined,
      clearTokens: Boolean(req.body?.clearTokens),
    });
    res.json({
      ok: true,
      allowCredentialedSetup: settings.allowCredentialedSetup,
      preferredHost: settings.preferredHost,
      hasVercelToken: Boolean(settings.vercelToken),
      hasNetlifyToken: Boolean(settings.netlifyToken),
      hasCloudflareToken: Boolean(settings.cloudflareToken),
      hasCloudflareAccountId: Boolean(settings.cloudflareAccountId),
    });
  } catch (error) {
    res.status(500).json({
      error: error instanceof Error ? error.message : "Hosting settings failed",
    });
  }
});

app.get("/api/hosting/recommend", async (req, res) => {
  const workspace = workspaceFromQuery(
    typeof req.query.workspace === "string" ? req.query.workspace : undefined
  );
  const hosting = await import("../agent/hosting.js");
  res.json(await hosting.recommendHost(workspace));
});

app.post("/api/hosting/start", async (req, res) => {
  try {
    const workspace = workspaceFromQuery(req.body?.workspace);
    const mode = req.body?.mode === "credentialed" ? "credentialed" : "assisted";
    const hosting = await import("../agent/hosting.js");
    res.json(
      await hosting.startWebsiteSetup(workspace, {
        mode,
        provider: req.body?.provider,
        projectName: req.body?.projectName,
        relativeRoot: req.body?.relativeRoot,
      })
    );
  } catch (error) {
    res.status(500).json({
      error: error instanceof Error ? error.message : "Hosting start failed",
    });
  }
});

app.post("/api/hosting/confirm-login", async (req, res) => {
  try {
    const workspace = workspaceFromQuery(req.body?.workspace);
    const hosting = await import("../agent/hosting.js");
    res.json(await hosting.confirmHostingLogin(workspace));
  } catch (error) {
    res.status(500).json({
      error: error instanceof Error ? error.message : "Confirm login failed",
    });
  }
});

app.post("/api/hosting/assisted-deploy", async (req, res) => {
  try {
    const workspace = workspaceFromQuery(req.body?.workspace);
    const hosting = await import("../agent/hosting.js");
    res.json(
      await hosting.assistedHostingDeploy(workspace, {
        projectName: req.body?.projectName,
        relativeRoot: req.body?.relativeRoot,
      })
    );
  } catch (error) {
    res.status(500).json({
      error: error instanceof Error ? error.message : "Assisted deploy failed",
    });
  }
});

app.get("/api/trading/status", async (req, res) => {
  try {
    const workspace = workspaceFromQuery(
      typeof req.query.workspace === "string" ? req.query.workspace : undefined
    );
    const trading = await import("../agent/trading.js");
    res.json(await trading.tradingStatus(workspace));
  } catch (error) {
    res.status(500).json({
      error: error instanceof Error ? error.message : "Trading status failed",
    });
  }
});

app.put("/api/trading/settings", async (req, res) => {
  try {
    const workspace = workspaceFromQuery(req.body?.workspace);
    const trading = await import("../agent/trading.js");
    const settings = await trading.saveTradingSettings(workspace, req.body ?? {});
    res.json({
      ok: true,
      settings: {
        ...settings,
        binanceApiKey: undefined,
        binanceApiSecret: undefined,
        hasBinanceKey: Boolean(settings.binanceApiKey),
        hasBinanceSecret: Boolean(settings.binanceApiSecret),
      },
    });
  } catch (error) {
    res.status(500).json({
      error: error instanceof Error ? error.message : "Trading settings failed",
    });
  }
});

app.post("/api/trading/scan", async (req, res) => {
  try {
    const workspace = workspaceFromQuery(req.body?.workspace);
    const trading = await import("../agent/trading.js");
    res.json(await trading.scanBestTrades(workspace, req.body?.symbols));
  } catch (error) {
    res.status(500).json({
      error: error instanceof Error ? error.message : "Trading scan failed",
    });
  }
});

app.post("/api/trading/discover-memes", async (req, res) => {
  try {
    const workspace = workspaceFromQuery(req.body?.workspace);
    const limit = Number(req.body?.limit ?? 15);
    const trading = await import("../agent/trading.js");
    res.json(await trading.discoverMemecoins(workspace, limit));
  } catch (error) {
    res.status(500).json({
      error: error instanceof Error ? error.message : "Meme discovery failed",
    });
  }
});

app.post("/api/trading/cycle", async (req, res) => {
  try {
    const workspace = workspaceFromQuery(req.body?.workspace);
    const trading = await import("../agent/trading.js");
    res.json(await trading.runTradingCycle(workspace));
  } catch (error) {
    res.status(500).json({
      error: error instanceof Error ? error.message : "Trading cycle failed",
    });
  }
});

app.post("/api/trading/reset", async (req, res) => {
  try {
    const workspace = workspaceFromQuery(req.body?.workspace);
    const trading = await import("../agent/trading.js");
    res.json({ ok: true, portfolio: await trading.resetPaperPortfolio(workspace) });
  } catch (error) {
    res.status(500).json({
      error: error instanceof Error ? error.message : "Reset failed",
    });
  }
});

app.get("/api/trading/settings", async (req, res) => {
  const workspace = workspaceFromQuery(
    typeof req.query.workspace === "string" ? req.query.workspace : undefined
  );
  const trading = await import("../agent/trading.js");
  const settings = await trading.loadTradingSettings(workspace);
  res.json({
    ...settings,
    binanceApiKey: undefined,
    binanceApiSecret: undefined,
    hasBinanceKey: Boolean(settings.binanceApiKey),
    hasBinanceSecret: Boolean(settings.binanceApiSecret),
  });
});

app.get("/api/github/status", async (req, res) => {
  const workspace = workspaceFromQuery(
    typeof req.query.workspace === "string" ? req.query.workspace : undefined
  );
  const { githubStatus } = await import("../agent/github.js");
  res.json(await githubStatus(workspace));
});

app.post("/api/github/connect", async (req, res) => {
  try {
    const workspace = workspaceFromQuery(req.body?.workspace);
    const token = String(req.body?.token ?? "").trim();
    if (!token) {
      res.status(400).json({ error: "token required" });
      return;
    }
    const { saveSecrets, githubStatus } = await import("../agent/github.js");
    const secrets = await saveSecrets(workspace, { githubToken: token });
    const status = await githubStatus(workspace);
    if (status.user) {
      await saveSecrets(workspace, { githubUser: status.user });
    }
    res.json({ ok: true, status: await githubStatus(workspace), saved: Boolean(secrets.githubToken) });
  } catch (error) {
    res.status(500).json({
      error: error instanceof Error ? error.message : "Connect failed",
    });
  }
});

app.post("/api/github/disconnect", async (req, res) => {
  const workspace = workspaceFromQuery(req.body?.workspace);
  const { saveSecrets, loadSecrets, githubStatus } = await import("../agent/github.js");
  await saveSecrets(workspace, { githubToken: "", githubUser: "" });
  const secrets = await loadSecrets(workspace);
  // clear empty strings
  await fs.writeFile(
    path.join(workspace, ".helix", "secrets.json"),
    JSON.stringify(
      {
        ...secrets,
        githubToken: undefined,
        githubUser: undefined,
      },
      null,
      2
    )
  );
  delete process.env.GITHUB_TOKEN;
  res.json({ ok: true, status: await githubStatus(workspace) });
});

app.post("/api/github/commit", async (req, res) => {
  try {
    const workspace = workspaceFromQuery(req.body?.workspace);
    const message = String(req.body?.message ?? "").trim();
    if (!message) {
      res.status(400).json({ error: "message required" });
      return;
    }
    const { gitCommit } = await import("../agent/github.js");
    res.json(await gitCommit(workspace, message, req.body?.paths));
  } catch (error) {
    res.status(500).json({
      error: error instanceof Error ? error.message : "Commit failed",
    });
  }
});

app.post("/api/github/push", async (req, res) => {
  try {
    const workspace = workspaceFromQuery(req.body?.workspace);
    const { gitPush } = await import("../agent/github.js");
    res.json(await gitPush(workspace, req.body?.setUpstream !== false));
  } catch (error) {
    res.status(500).json({
      error: error instanceof Error ? error.message : "Push failed",
    });
  }
});

app.post("/api/chat", async (req, res) => {
  try {
    const {
      messages,
      skillIds,
      provider,
      model,
      workspace,
      mode,
      helixModelId,
    }: {
      messages: UIMessage[];
      skillIds?: string[];
      provider?: ProviderKind;
      model?: string;
      workspace?: string;
      mode?: AgentMode;
      helixModelId?: string;
    } = req.body ?? {};

    if (!Array.isArray(messages)) {
      res.status(400).json({ error: "messages array required" });
      return;
    }

    const [{ convertToModelMessages }, { runAgentStream }] = await Promise.all([
      import("ai"),
      import("../agent/runtime.js"),
    ]);

    const result = await runAgentStream({
      messages: convertToModelMessages(messages),
      skillIds,
      provider,
      model,
      workspace,
      mode,
      helixModelId,
    });

    result.pipeUIMessageStreamToResponse(res, {
      sendReasoning: true,
      sendSources: false,
      onError: (error) => {
        const message = error instanceof Error ? error.message : String(error);
        console.error("[helix] chat stream error:", message);
        return message;
      },
    });
  } catch (error) {
    console.error("[helix] chat error", error);
    res.status(500).json({
      error: error instanceof Error ? error.message : "Chat failed",
    });
  }
});

const uiDist = process.env.HELIX_ROOT
  ? path.join(path.resolve(process.env.HELIX_ROOT), "dist", "ui")
  : path.resolve(__dirname, "../../dist/ui");
app.use(express.static(uiDist));
app.get(/^(?!\/api).*/, (_req, res, next) => {
  res.sendFile(path.join(uiDist, "index.html"), (err) => {
    if (err) next();
  });
});

void getDefaultSettings()
  .then((settings) => {
    console.log(
      `Helix model: ${settings.helixModelName} (${settings.helixModelId}) → ${settings.model}`
    );
    console.log(`Workspace: ${settings.workspace}`);
  })
  .catch(() => undefined);
