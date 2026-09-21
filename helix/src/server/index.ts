import express from "express";
import cors from "cors";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { convertToModelMessages, type UIMessage } from "ai";
import { getDefaultSettings, runAgentStream } from "../agent/runtime.js";
import { listSkills } from "../agent/skills.js";
import { loadPlugins } from "../agent/plugins.js";
import type { ProviderKind } from "../shared/types.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.HELIX_PORT ?? 8787);

async function loadEnvFile() {
  try {
    const envPath = path.resolve(process.cwd(), ".env");
    const fs = await import("node:fs/promises");
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

await loadEnvFile();

const app = express();
app.use(cors());
app.use(express.json({ limit: "4mb" }));

app.get("/api/health", (_req, res) => {
  res.json({ ok: true, name: "helix-agent", version: "0.1.0" });
});

app.get("/api/settings", (_req, res) => {
  res.json(getDefaultSettings());
});

app.get("/api/skills", async (_req, res) => {
  res.json({ skills: await listSkills() });
});

app.get("/api/plugins", async (_req, res) => {
  const plugins = await loadPlugins();
  res.json({ plugins: plugins.map((plugin) => plugin.manifest) });
});

app.post("/api/chat", async (req, res) => {
  try {
    const {
      messages,
      skillIds,
      provider,
      model,
      workspace,
    }: {
      messages: UIMessage[];
      skillIds?: string[];
      provider?: ProviderKind;
      model?: string;
      workspace?: string;
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
  const settings = getDefaultSettings();
  console.log(`Helix agent listening on http://127.0.0.1:${PORT}`);
  console.log(`Provider: ${settings.provider} · Model: ${settings.model}`);
  console.log(`Workspace: ${settings.workspace}`);
});
