import { gateway } from "@ai-sdk/gateway";
import { createAnthropic } from "@ai-sdk/anthropic";
import { createOpenAI } from "@ai-sdk/openai";
import type { LanguageModel } from "ai";
import fs from "node:fs/promises";
import path from "node:path";
import {
  createFreeLanguageModel,
  freeBackendStatus,
  pickOllamaCoder,
  probeFineTuneServer,
  probeOllama,
} from "./freeProviders.js";

/**
 * Helix branded models — paid frontier routes + free/local Helix Free agent.
 */
export type HelixModelId =
  | "helix-free"
  | "helix-code"
  | "helix-astra"
  | "helix-fable"
  | "helix-local"
  | "helix-groq"
  | "helix-openrouter";

export type HelixModelProfile = {
  id: HelixModelId;
  name: string;
  description: string;
  badge: string;
  engine: string;
  route: "gateway" | "anthropic" | "openai" | "ollama" | "groq" | "openrouter" | "free-auto";
};

export const HELIX_MODELS: HelixModelProfile[] = [
  {
    id: "helix-free",
    name: "Helix Own",
    description:
      "Weight-trained builder for apps, websites, games, mods, and any code — LoRA + tools.",
    badge: "trained",
    engine: process.env.HELIX_LOCAL_MODEL || "helix-own-ft",
    route: "free-auto",
  },
  {
    id: "helix-code",
    name: "Helix Code",
    description:
      "Helix’s flagship coding model — frontier agent coding quality (Astra / Fable class). Needs API key.",
    badge: "recommended",
    engine: "openai/gpt-6-astra",
    route: "gateway",
  },
  {
    id: "helix-astra",
    name: "Helix Astra",
    description: "Helix profile tuned on GPT‑6 Astra for deep multi-file coding agents.",
    badge: "gpt-6-astra",
    engine: "openai/gpt-6-astra",
    route: "gateway",
  },
  {
    id: "helix-fable",
    name: "Helix Fable",
    description: "Helix profile tuned on Claude Fable 5.1 for careful refactors and reasoning.",
    badge: "claude-fable-5.1",
    engine: "anthropic/claude-fable-5.1",
    route: "gateway",
  },
  {
    id: "helix-groq",
    name: "Helix Groq",
    description: "Free-tier Groq cloud (set GROQ_API_KEY). Fast open models.",
    badge: "free-tier",
    engine: process.env.HELIX_GROQ_MODEL || "llama-3.3-70b-versatile",
    route: "groq",
  },
  {
    id: "helix-openrouter",
    name: "Helix OpenRouter",
    description: "OpenRouter free/open models (set OPENROUTER_API_KEY).",
    badge: "free-tier",
    engine: process.env.HELIX_OPENROUTER_MODEL || "openrouter/auto",
    route: "openrouter",
  },
  {
    id: "helix-local",
    name: "Helix Local",
    description:
      "Fully local coding model via Ollama. Offline-friendly; quality depends on your GPU/CPU.",
    badge: "offline",
    engine: process.env.HELIX_LOCAL_MODEL || "qwen2.5-coder:3b",
    route: "ollama",
  },
];

export function getHelixModel(id?: string | null): HelixModelProfile {
  const found = HELIX_MODELS.find((m) => m.id === id);
  if (found) return found;
  const fromEnv = HELIX_MODELS.find((m) => m.id === process.env.HELIX_MODEL);
  return fromEnv ?? HELIX_MODELS[0]!;
}

function settingsPath(workspace: string) {
  return path.join(workspace, ".helix", "settings.json");
}

export async function loadHelixSettings(workspace: string): Promise<{
  modelId: HelixModelId;
}> {
  try {
    const raw = await fs.readFile(settingsPath(workspace), "utf8");
    const parsed = JSON.parse(raw) as { modelId?: string };
    return { modelId: getHelixModel(parsed.modelId).id };
  } catch {
    // No paid keys → default Helix Free
    const status = freeBackendStatus();
    const hasPaid =
      status.gatewayConfigured || status.openaiConfigured || status.anthropicConfigured;
    if (!hasPaid) return { modelId: "helix-free" };
    return { modelId: getHelixModel(process.env.HELIX_MODEL).id };
  }
}

export async function saveHelixSettings(
  workspace: string,
  patch: { modelId?: string }
) {
  const current = await loadHelixSettings(workspace);
  const next = {
    modelId: getHelixModel(patch.modelId ?? current.modelId).id,
  };
  await fs.mkdir(path.dirname(settingsPath(workspace)), { recursive: true });
  await fs.writeFile(settingsPath(workspace), JSON.stringify(next, null, 2));
  return next;
}

let cachedOllamaModel: string | null = null;

async function resolveOllamaEngine(fallback: string): Promise<string> {
  if (cachedOllamaModel) return cachedOllamaModel;
  const probe = await probeOllama();
  if (probe.ready) {
    cachedOllamaModel = pickOllamaCoder(probe.models);
    return cachedOllamaModel;
  }
  return fallback;
}

export async function resolveHelixLanguageModelAsync(
  profile: HelixModelProfile,
  overrides?: { provider?: string; model?: string }
): Promise<{ model: LanguageModel; profile: HelixModelProfile; resolvedEngine: string }> {
  if (overrides?.provider === "ollama" && overrides.model) {
    return {
      model: createFreeLanguageModel("ollama", overrides.model),
      profile,
      resolvedEngine: overrides.model,
    };
  }
  if (overrides?.provider === "groq" && overrides.model) {
    return {
      model: createFreeLanguageModel("groq", overrides.model),
      profile,
      resolvedEngine: overrides.model,
    };
  }
  if (overrides?.provider === "anthropic" && overrides.model) {
    return {
      model: createAnthropic({ apiKey: process.env.ANTHROPIC_API_KEY })(overrides.model),
      profile,
      resolvedEngine: overrides.model,
    };
  }
  if (overrides?.provider === "openai" && overrides.model) {
    return {
      model: createOpenAI({ apiKey: process.env.OPENAI_API_KEY })(overrides.model),
      profile,
      resolvedEngine: overrides.model,
    };
  }

  // Helix Free: prefer weight-trained FT server, then Ollama, then free cloud
  if (profile.route === "free-auto" || profile.id === "helix-free") {
    if (await probeFineTuneServer()) {
      return {
        model: createFreeLanguageModel("ft", "helix-own-ft"),
        profile: getHelixModel("helix-free"),
        resolvedEngine: "helix-own-ft (LoRA)",
      };
    }
    const ollama = await probeOllama();
    if (ollama.ready) {
      const engine = pickOllamaCoder(ollama.models);
      return {
        model: createFreeLanguageModel("ollama", engine),
        profile: getHelixModel("helix-free"),
        resolvedEngine: engine,
      };
    }
    if (process.env.GROQ_API_KEY) {
      const engine = process.env.HELIX_GROQ_MODEL || "llama-3.3-70b-versatile";
      return {
        model: createFreeLanguageModel("groq", engine),
        profile: getHelixModel("helix-groq"),
        resolvedEngine: engine,
      };
    }
    if (process.env.OPENROUTER_API_KEY) {
      const engine = process.env.HELIX_OPENROUTER_MODEL || "openrouter/auto";
      return {
        model: createFreeLanguageModel("openrouter", engine),
        profile: getHelixModel("helix-openrouter"),
        resolvedEngine: engine,
      };
    }
    // Still point at Ollama — clearer error when generation fails
    const engine = process.env.HELIX_LOCAL_MODEL || "qwen2.5-coder:3b";
    return {
      model: createFreeLanguageModel("ollama", engine),
      profile: getHelixModel("helix-free"),
      resolvedEngine: engine,
    };
  }

  if (profile.route === "ollama" || profile.id === "helix-local") {
    const engine = await resolveOllamaEngine(profile.engine);
    return {
      model: createFreeLanguageModel("ollama", engine),
      profile: getHelixModel("helix-local"),
      resolvedEngine: engine,
    };
  }

  if (profile.route === "groq") {
    if (!process.env.GROQ_API_KEY) {
      // Fall through to free auto
      return resolveHelixLanguageModelAsync(getHelixModel("helix-free"));
    }
    return {
      model: createFreeLanguageModel("groq", profile.engine),
      profile,
      resolvedEngine: profile.engine,
    };
  }

  if (profile.route === "openrouter") {
    if (!process.env.OPENROUTER_API_KEY) {
      return resolveHelixLanguageModelAsync(getHelixModel("helix-free"));
    }
    return {
      model: createFreeLanguageModel("openrouter", profile.engine),
      profile,
      resolvedEngine: profile.engine,
    };
  }

  if (process.env.AI_GATEWAY_API_KEY || process.env.VERCEL_OIDC_TOKEN) {
    return {
      model: gateway(profile.engine) as unknown as LanguageModel,
      profile,
      resolvedEngine: profile.engine,
    };
  }

  if (profile.engine.startsWith("anthropic/") && process.env.ANTHROPIC_API_KEY) {
    const id = profile.engine.replace(/^anthropic\//, "");
    return {
      model: createAnthropic({ apiKey: process.env.ANTHROPIC_API_KEY })(id),
      profile,
      resolvedEngine: profile.engine,
    };
  }
  if (profile.engine.startsWith("openai/") && process.env.OPENAI_API_KEY) {
    const id = profile.engine.replace(/^openai\//, "");
    return {
      model: createOpenAI({ apiKey: process.env.OPENAI_API_KEY })(id),
      profile,
      resolvedEngine: profile.engine,
    };
  }

  // Paid model selected but no keys → Helix Free
  return resolveHelixLanguageModelAsync(getHelixModel("helix-free"));
}

/** Sync wrapper kept for callers that cannot await (prefer async). */
export function resolveHelixLanguageModel(
  profile: HelixModelProfile,
  overrides?: { provider?: string; model?: string }
): { model: LanguageModel; profile: HelixModelProfile; resolvedEngine: string } {
  // Best-effort sync path for ollama/groq/gateway without probe
  if (overrides?.provider === "ollama" && overrides.model) {
    return {
      model: createFreeLanguageModel("ollama", overrides.model),
      profile,
      resolvedEngine: overrides.model,
    };
  }
  if (profile.route === "free-auto" || profile.id === "helix-free" || profile.route === "ollama") {
    const engine =
      cachedOllamaModel ||
      process.env.HELIX_LOCAL_MODEL ||
      process.env.OLLAMA_MODEL ||
      profile.engine ||
      "qwen2.5-coder:3b";
    return {
      model: createFreeLanguageModel("ollama", engine),
      profile: getHelixModel(profile.id === "helix-local" ? "helix-local" : "helix-free"),
      resolvedEngine: engine,
    };
  }
  if (profile.route === "groq" && process.env.GROQ_API_KEY) {
    return {
      model: createFreeLanguageModel("groq", profile.engine),
      profile,
      resolvedEngine: profile.engine,
    };
  }
  if (process.env.AI_GATEWAY_API_KEY || process.env.VERCEL_OIDC_TOKEN) {
    return {
      model: gateway(profile.engine) as unknown as LanguageModel,
      profile,
      resolvedEngine: profile.engine,
    };
  }
  const engine = process.env.HELIX_LOCAL_MODEL || "qwen2.5-coder:3b";
  return {
    model: createFreeLanguageModel("ollama", engine),
    profile: getHelixModel("helix-free"),
    resolvedEngine: engine,
  };
}

export function helixModelSystemPreamble(profile: HelixModelProfile): string {
  const freeish =
    profile.id === "helix-free" ||
    profile.route === "ollama" ||
    profile.route === "free-auto" ||
    profile.route === "groq" ||
    profile.route === "openrouter";

  const common = [
    `You are running as Helix model “${profile.name}” (${profile.id}).`,
    `Underlying coding engine: ${profile.engine}.`,
    "Operate at frontier product-builder quality:",
    "- Build apps, websites, games, mods, and any code end-to-end",
    "- Multi-file refactors with correct types and tests",
    "- Prefer reuse over rewrite; search before inventing host APIs",
    "- Ship compileable / playable artifacts, not just patches",
    "- Be precise, skeptical of assumptions, and verify with tools",
    "- You have effectively unlimited tokens/steps — finish the task",
  ];

  if (freeish) {
    common.push(
      "You are Helix Free / open-model mode: follow the agent-curriculum skill strictly.",
      "Compensate for smaller weights with more tool use, tighter plans, and verification."
    );
  }

  return common.join("\n");
}

let availabilityCache:
  | { at: number; value: Awaited<ReturnType<typeof listModelAvailabilityUncached>> }
  | null = null;

async function listModelAvailabilityUncached() {
  const status = freeBackendStatus();
  const [ollama, ftReady] = await Promise.all([probeOllama(), probeFineTuneServer()]);
  return {
    ...status,
    ollamaReady: ollama.ready,
    ollamaModels: ollama.models,
    ftReady,
    freeReady: ftReady || ollama.ready || status.groqConfigured || status.openrouterConfigured,
  };
}

export async function listModelAvailability() {
  const now = Date.now();
  if (availabilityCache && now - availabilityCache.at < 20_000) {
    return availabilityCache.value;
  }
  const value = await listModelAvailabilityUncached();
  availabilityCache = { at: now, value };
  return value;
}
