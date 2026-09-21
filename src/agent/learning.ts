/**
 * Continuous local learning from user interactions.
 * Everything stays in the workspace (.helix/learning) — never uploaded.
 */

import fs from "node:fs/promises";
import path from "node:path";
import { createHash, randomUUID } from "node:crypto";
import { spawn } from "node:child_process";

export type LearningSettings = {
  enabled: boolean;
  autoIngest: boolean;
  autoRetrain: boolean;
  retrainEvery: number;
  pendingSinceTrain: number;
  lastTrainAt: string | null;
  totalExamples: number;
  privacy: "local-only";
};

export type LearningExample = {
  id: string;
  createdAt: string;
  source: "chat" | "feedback" | "correction" | "session";
  rating?: "up" | "down";
  messages: Array<{ role: "system" | "user" | "assistant"; content: string }>;
  fingerprint: string;
};

const SYSTEM =
  "You are Helix Own, a weight-trained coding agent that learns from this user's workspace. Write correct, typed, minimal code. Prefer tools and verification.";

function learningDir(workspace: string) {
  return path.join(workspace, ".helix", "learning");
}

function settingsPath(workspace: string) {
  return path.join(learningDir(workspace), "settings.json");
}

function examplesPath(workspace: string) {
  return path.join(learningDir(workspace), "user_examples.jsonl");
}

function mergedDatasetPath(workspace: string) {
  return path.join(learningDir(workspace), "merged_sft.jsonl");
}

async function ensureDir(workspace: string) {
  await fs.mkdir(learningDir(workspace), { recursive: true });
}

export async function loadLearningSettings(workspace: string): Promise<LearningSettings> {
  await ensureDir(workspace);
  try {
    const raw = await fs.readFile(settingsPath(workspace), "utf8");
    return { ...defaultSettings(), ...(JSON.parse(raw) as Partial<LearningSettings>) };
  } catch {
    const defaults = defaultSettings();
    await fs.writeFile(settingsPath(workspace), JSON.stringify(defaults, null, 2));
    return defaults;
  }
}

function defaultSettings(): LearningSettings {
  return {
    enabled: true,
    autoIngest: true,
    autoRetrain: true,
    retrainEvery: 8,
    pendingSinceTrain: 0,
    lastTrainAt: null,
    totalExamples: 0,
    privacy: "local-only",
  };
}

export async function saveLearningSettings(
  workspace: string,
  patch: Partial<LearningSettings>
): Promise<LearningSettings> {
  await ensureDir(workspace);
  let current: LearningSettings = defaultSettings();
  try {
    const raw = await fs.readFile(settingsPath(workspace), "utf8");
    current = { ...defaultSettings(), ...(JSON.parse(raw) as Partial<LearningSettings>) };
  } catch {
    // first write
  }
  const next: LearningSettings = {
    ...current,
    ...patch,
    privacy: "local-only",
  };
  await fs.writeFile(settingsPath(workspace), JSON.stringify(next, null, 2));
  return next;
}

function fingerprint(messages: LearningExample["messages"]): string {
  const payload = messages.map((m) => `${m.role}:${m.content}`).join("\n");
  return createHash("sha256").update(payload).digest("hex").slice(0, 24);
}

function textFromParts(message: {
  role?: string;
  content?: string;
  parts?: Array<{
    type?: string;
    text?: string;
    state?: string;
    output?: unknown;
    input?: unknown;
  }>;
}): string {
  if (typeof message.content === "string" && message.content.trim()) {
    return message.content.trim();
  }
  const parts = message.parts ?? [];
  const texts = parts
    .filter((p) => p.type === "text" && p.text)
    .map((p) => p.text!.trim())
    .filter(Boolean);
  // Fold tool use into the learning signal so Helix learns how the user works
  const tools = parts
    .filter((p) => typeof p.type === "string" && p.type.startsWith("tool-"))
    .map((p) => {
      const name = String(p.type).replace(/^tool-/, "");
      const state = p.state ?? "";
      let detail = "";
      if (p.output !== undefined) {
        detail =
          typeof p.output === "string"
            ? p.output.slice(0, 800)
            : JSON.stringify(p.output).slice(0, 800);
      } else if (p.input !== undefined) {
        detail =
          typeof p.input === "string"
            ? p.input.slice(0, 400)
            : JSON.stringify(p.input).slice(0, 400);
      }
      return `[tool:${name}${state ? ` ${state}` : ""}]${detail ? ` ${detail}` : ""}`;
    });
  return [...texts, ...tools].filter(Boolean).join("\n").trim();
}

/** Turn UI / stored messages into user→assistant SFT pairs. */
export function examplesFromMessages(
  messages: unknown[],
  source: LearningExample["source"] = "chat"
): LearningExample[] {
  const turns: Array<{ role: string; content: string }> = [];
  for (const raw of messages) {
    const msg = raw as {
      role?: string;
      content?: string;
      parts?: Array<{ type?: string; text?: string }>;
    };
    if (msg.role !== "user" && msg.role !== "assistant") continue;
    const content = textFromParts(msg);
    if (!content) continue;
    // Skip pure tool-noise assistant stubs
    if (msg.role === "assistant" && content.length < 8) continue;
    turns.push({ role: msg.role, content });
  }

  const out: LearningExample[] = [];
  for (let i = 0; i < turns.length - 1; i++) {
    if (turns[i]?.role !== "user" || turns[i + 1]?.role !== "assistant") continue;
    const messagesPair = [
      { role: "system" as const, content: SYSTEM },
      { role: "user" as const, content: turns[i]!.content },
      { role: "assistant" as const, content: turns[i + 1]!.content },
    ];
    out.push({
      id: randomUUID(),
      createdAt: new Date().toISOString(),
      source,
      messages: messagesPair,
      fingerprint: fingerprint(messagesPair),
    });
  }
  return out;
}

async function knownFingerprints(workspace: string): Promise<Set<string>> {
  const known = new Set<string>();
  try {
    const raw = await fs.readFile(examplesPath(workspace), "utf8");
    for (const line of raw.split(/\r?\n/)) {
      if (!line.trim()) continue;
      try {
        const row = JSON.parse(line) as LearningExample;
        if (row.fingerprint) known.add(row.fingerprint);
      } catch {
        // skip
      }
    }
  } catch {
    // none yet
  }
  return known;
}

export async function appendExamples(
  workspace: string,
  examples: LearningExample[]
): Promise<{ added: number; settings: LearningSettings }> {
  await ensureDir(workspace);
  const settings = await loadLearningSettings(workspace);
  if (!settings.enabled) return { added: 0, settings };

  const known = await knownFingerprints(workspace);
  let added = 0;
  const lines: string[] = [];
  for (const example of examples) {
    if (known.has(example.fingerprint)) continue;
    // Skip downvotes from auto-train corpus (keep for analytics only if rated down)
    if (example.rating === "down") continue;
    known.add(example.fingerprint);
    lines.push(JSON.stringify(example));
    added += 1;
  }
  if (lines.length) {
    await fs.appendFile(examplesPath(workspace), lines.join("\n") + "\n", "utf8");
  }

  const next = await saveLearningSettings(workspace, {
    pendingSinceTrain: settings.pendingSinceTrain + added,
    totalExamples: settings.totalExamples + added,
  });
  return { added, settings: next };
}

export async function ingestMessages(
  workspace: string,
  messages: unknown[],
  source: LearningExample["source"] = "chat"
): Promise<{ added: number; settings: LearningSettings; retrainStarted: boolean }> {
  const settings = await loadLearningSettings(workspace);
  if (!settings.enabled || !settings.autoIngest) {
    return { added: 0, settings, retrainStarted: false };
  }
  const examples = examplesFromMessages(messages, source);
  const { added, settings: next } = await appendExamples(workspace, examples);
  let retrainStarted = false;
  if (
    added > 0 &&
    next.autoRetrain &&
    next.pendingSinceTrain >= next.retrainEvery
  ) {
    retrainStarted = startRetrainJob(workspace);
  }
  return { added, settings: next, retrainStarted };
}

export async function recordFeedback(
  workspace: string,
  input: {
    userText: string;
    assistantText: string;
    rating: "up" | "down";
    correction?: string;
  }
): Promise<{ added: number; settings: LearningSettings }> {
  const assistant =
    input.rating === "up"
      ? input.assistantText
      : input.correction?.trim() || input.assistantText;
  if (input.rating === "down" && !input.correction?.trim()) {
    // Store negative signal lightly — don't train on bad answers
    await ensureDir(workspace);
    const logPath = path.join(learningDir(workspace), "downvotes.jsonl");
    await fs.appendFile(
      logPath,
      JSON.stringify({
        at: new Date().toISOString(),
        userText: input.userText,
        assistantText: input.assistantText,
      }) + "\n"
    );
    return { added: 0, settings: await loadLearningSettings(workspace) };
  }

  const messages = [
    { role: "system" as const, content: SYSTEM },
    { role: "user" as const, content: input.userText },
    { role: "assistant" as const, content: assistant },
  ];
  const example: LearningExample = {
    id: randomUUID(),
    createdAt: new Date().toISOString(),
    source: input.correction ? "correction" : "feedback",
    rating: input.rating,
    messages,
    fingerprint: fingerprint(messages),
  };
  return appendExamples(workspace, [example]);
}

export async function learningStatus(workspace: string) {
  const settings = await loadLearningSettings(workspace);
  let exampleFileBytes = 0;
  try {
    const st = await fs.stat(examplesPath(workspace));
    exampleFileBytes = st.size;
  } catch {
    // missing
  }
  return {
    settings,
    exampleFile: examplesPath(workspace),
    exampleFileBytes,
    trainRunning: Boolean(retrainChild),
  };
}

let retrainChild: ReturnType<typeof spawn> | null = null;

export function startRetrainJob(workspace: string): boolean {
  if (retrainChild) return false;
  const root = path.resolve(process.cwd());
  const trainScript = path.join(root, "training", "train_lora.py");
  const outDir = path.join(root, "training", "output", "helix-own-lora");

  void (async () => {
    try {
      await fs.access(trainScript);
      await buildMergedDataset(workspace);
      const merged = mergedDatasetPath(workspace);
      const steps = Number(process.env.HELIX_FT_STEPS ?? "20");
      retrainChild = spawn(
        process.env.HELIX_PYTHON || "python3",
        [trainScript, "--data", merged, "--out", outDir, "--steps", String(steps)],
        {
          cwd: root,
          stdio: "inherit",
          env: process.env,
        }
      );
      retrainChild.on("exit", (code) => {
        retrainChild = null;
        void saveLearningSettings(workspace, {
          pendingSinceTrain: 0,
          lastTrainAt: new Date().toISOString(),
        }).then(() => {
          console.log(`[helix-learn] retrain finished code=${code}`);
        });
      });
    } catch (error) {
      retrainChild = null;
      console.warn("[helix-learn] retrain failed", error);
    }
  })();
  return true;
}

export async function buildMergedDataset(workspace: string): Promise<string> {
  await ensureDir(workspace);
  const helixRoot = path.resolve(process.cwd());
  const workspaceRoot = path.resolve(workspace);
  const baseCandidates = [
    path.join(helixRoot, "training", "dataset", "helix_own_sft.jsonl"),
    path.join(workspaceRoot, "training", "dataset", "helix_own_sft.jsonl"),
  ];
  let base = "";
  for (const candidate of baseCandidates) {
    try {
      await fs.access(candidate);
      base = await fs.readFile(candidate, "utf8");
      break;
    } catch {
      // try next
    }
  }

  let user = "";
  try {
    const raw = await fs.readFile(examplesPath(workspace), "utf8");
    // Convert LearningExample → plain {messages}
    user = raw
      .split(/\r?\n/)
      .filter(Boolean)
      .map((line) => {
        const row = JSON.parse(line) as LearningExample;
        return JSON.stringify({ messages: row.messages });
      })
      .join("\n");
  } catch {
    // no user data yet
  }

  const merged = [base.trim(), user.trim()].filter(Boolean).join("\n") + "\n";
  const out = mergedDatasetPath(workspace);
  await fs.writeFile(out, merged, "utf8");
  return out;
}

/** Archive every raw user signal (prompts, pasted code, corrections) — local only. */
export async function observeUserInput(
  workspace: string,
  input: { text: string; kind?: string; meta?: Record<string, unknown> }
): Promise<{ ok: boolean }> {
  const settings = await loadLearningSettings(workspace);
  if (!settings.enabled) return { ok: false };
  const text = input.text.trim();
  if (!text) return { ok: false };
  await ensureDir(workspace);
  const inbox = path.join(learningDir(workspace), "user_inbox.jsonl");
  await fs.appendFile(
    inbox,
    JSON.stringify({
      at: new Date().toISOString(),
      kind: input.kind ?? "user",
      text: text.slice(0, 20000),
      meta: input.meta ?? {},
    }) + "\n",
    "utf8"
  );
  return { ok: true };
}
