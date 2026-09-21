import express from "express";
import cors from "cors";
import path from "node:path";
import fs from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { convertToModelMessages, type UIMessage } from "ai";
import { getDefaultSettings, runAgentStream, type AgentMode } from "../agent/runtime.js";
import { listSkills } from "../agent/skills.js";
import { loadPlugins } from "../agent/plugins.js";
import { buildProjectMap } from "../agent/projectMap.js";
import {
  githubStatus,
  gitCommit,
  gitPush,
  saveSecrets,
  loadSecrets,
} from "../agent/github.js";
import { getFileDiff, getGitStatus } from "../agent/gitDiff.js";
import {
  createSession,
  deleteSession,
  getSession,
  listSessions,
  saveSession,
  type StoredSession,
} from "../agent/sessions.js";
import {
  ensureDefaultMcpConfig,
  listMcpStates,
  loadMcpConfig,
  reconnectMcpServers,
  saveMcpConfig,
  type McpConfigFile,
} from "../agent/mcp.js";
import {
  detectBuildPipeline,
  listBuildArtifacts,
  runFullShip,
} from "../agent/build.js";
import {
  HELIX_MODELS,
  getHelixModel,
  loadHelixSettings,
  saveHelixSettings,
} from "../agent/models.js";
import type { ProviderKind } from "../shared/types.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.HELIX_PORT ?? 8787);

async function loadEnvFile() {
  try {
    const envPath = path.resolve(process.cwd(), ".env");
    const raw = await fs.readFile(envPath, "utf8");
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

await loadEnvFile();

const app = express();
app.use(cors());
app.use(express.json({ limit: "8mb" }));

// Warm MCP connections from .helix/mcp.json (disabled servers are skipped)
void getDefaultSettings()
  .then((settings) => reconnectMcpServers(settings.workspace))
  .catch((error) => {
    console.warn("[helix] MCP startup:", error instanceof Error ? error.message : error);
  });

app.get("/api/health", (_req, res) => {
  res.json({ ok: true, name: "helix-agent", version: "0.5.0" });
});

app.get("/api/settings", async (_req, res) => {
  res.json(await getDefaultSettings());
});

app.get("/api/models", async (req, res) => {
  const workspace = workspaceFromQuery(
    typeof req.query.workspace === "string" ? req.query.workspace : undefined
  );
  const saved = await loadHelixSettings(workspace);
  res.json({
    models: HELIX_MODELS,
    selected: saved.modelId,
    gatewayConfigured: Boolean(
      process.env.AI_GATEWAY_API_KEY || process.env.VERCEL_OIDC_TOKEN
    ),
    anthropicConfigured: Boolean(process.env.ANTHROPIC_API_KEY),
    openaiConfigured: Boolean(process.env.OPENAI_API_KEY),
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
  res.json({ skills: await listSkills() });
});

app.get("/api/plugins", async (_req, res) => {
  const plugins = await loadPlugins();
  res.json({ plugins: plugins.map((plugin) => plugin.manifest) });
});

app.get("/api/project/map", async (req, res) => {
  try {
    const workspace = workspaceFromQuery(
      typeof req.query.workspace === "string" ? req.query.workspace : undefined
    );
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
    res.json({ ok: true, path: relative });
  } catch (error) {
    res.status(400).json({
      error: error instanceof Error ? error.message : "Write failed",
    });
  }
});

app.get("/api/git/status", async (req, res) => {
  const workspace = workspaceFromQuery(
    typeof req.query.workspace === "string" ? req.query.workspace : undefined
  );
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
  res.json({ session: next });
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
  const config = await ensureDefaultMcpConfig(workspace);
  res.json({ config, servers: listMcpStates(config) });
});

app.put("/api/mcp/config", async (req, res) => {
  const workspace = workspaceFromQuery(req.body?.workspace);
  const config = await saveMcpConfig(workspace, req.body?.config as McpConfigFile);
  const servers = await reconnectMcpServers(workspace);
  res.json({ config, servers });
});

app.post("/api/mcp/reconnect", async (req, res) => {
  const workspace = workspaceFromQuery(req.body?.workspace);
  const servers = await reconnectMcpServers(workspace);
  const config = await loadMcpConfig(workspace);
  res.json({ config, servers });
});

app.get("/api/ship/pipeline", async (req, res) => {
  const workspace = workspaceFromQuery(
    typeof req.query.workspace === "string" ? req.query.workspace : undefined
  );
  res.json(await detectBuildPipeline(workspace));
});

app.get("/api/ship/artifacts", async (req, res) => {
  const workspace = workspaceFromQuery(
    typeof req.query.workspace === "string" ? req.query.workspace : undefined
  );
  const pipeline = await detectBuildPipeline(workspace);
  res.json({
    artifacts: await listBuildArtifacts(workspace, pipeline.artifactGlobs),
    pipeline,
  });
});

app.post("/api/ship/run", async (req, res) => {
  try {
    const workspace = workspaceFromQuery(req.body?.workspace);
    res.json(await runFullShip(workspace));
  } catch (error) {
    res.status(500).json({
      error: error instanceof Error ? error.message : "Ship failed",
    });
  }
});

app.get("/api/github/status", async (req, res) => {
  const workspace = workspaceFromQuery(
    typeof req.query.workspace === "string" ? req.query.workspace : undefined
  );
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

    const result = await runAgentStream({
      messages: convertToModelMessages(messages),
      skillIds,
      provider,
      model,
      workspace,
      mode,
      helixModelId,
    });

    result.pipeUIMessageStreamToResponse(res);
  } catch (error) {
    console.error("[helix] chat error", error);
    res.status(500).json({
      error: error instanceof Error ? error.message : "Chat failed",
    });
  }
});

const uiDist = path.resolve(__dirname, "../../dist/ui");
app.use(express.static(uiDist));
app.get(/^(?!\/api).*/, (_req, res, next) => {
  res.sendFile(path.join(uiDist, "index.html"), (err) => {
    if (err) next();
  });
});

app.listen(PORT, "127.0.0.1", () => {
  void getDefaultSettings().then((settings) => {
    console.log(`Helix agent listening on http://127.0.0.1:${PORT}`);
    console.log(
      `Helix model: ${settings.helixModelName} (${settings.helixModelId}) → ${settings.model}`
    );
    console.log(`Workspace: ${settings.workspace}`);
  });
});
