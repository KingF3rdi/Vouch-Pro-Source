import { gateway } from "@ai-sdk/gateway";
import { createAnthropic } from "@ai-sdk/anthropic";
import { createOpenAI } from "@ai-sdk/openai";
import type { LanguageModel } from "ai";
import fs from "node:fs/promises";
import path from "node:path";

/**
 * Helix's branded coding models.
 * These are first-class Helix model IDs that route to frontier coding engines
 * (GPT‑6 Astra, Claude Fable 5.1) or a strong local coder via Ollama.
 */
export type HelixModelId =
  | "helix-code"
  | "helix-astra"
  | "helix-fable"
  | "helix-local";

export type HelixModelProfile = {
  id: HelixModelId;
  name: string;
  description: string;
  badge: string;
  /** Underlying provider model used for inference */
  engine: string;
  route: "gateway" | "anthropic" | "openai" | "ollama";
};

export const HELIX_MODELS: HelixModelProfile[] = [
  {
    id: "helix-code",
    name: "Helix Code",
    description:
      "Helix’s flagship coding model — frontier agent coding quality (Astra / Fable class).",
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
    id: "helix-local",
    name: "Helix Local",
    description:
      "Fully local coding model via Ollama (qwen2.5-coder). Offline-friendly; quality depends on your GPU.",
    badge: "offline",
    engine: process.env.HELIX_LOCAL_MODEL || "qwen2.5-coder:14b",
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

export function resolveHelixLanguageModel(
  profile: HelixModelProfile,
  overrides?: { provider?: string; model?: string }
): { model: LanguageModel; profile: HelixModelProfile; resolvedEngine: string } {
  // Allow raw provider overrides from legacy env / API callers
  if (overrides?.provider === "ollama" && overrides.model) {
    const ollama = createOpenAI({
      baseURL: process.env.OLLAMA_BASE_URL ?? "http://127.0.0.1:11434/v1",
      apiKey: process.env.OLLAMA_API_KEY ?? "ollama",
    });
    return {
      model: ollama(overrides.model),
      profile,
      resolvedEngine: overrides.model,
    };
  }
  if (overrides?.provider === "anthropic" && overrides.model) {
    return {
      model: createAnthropic({ apiKey: process.env.ANTHROPIC_API_KEY })(
        overrides.model
      ),
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

  if (profile.route === "ollama") {
    const ollama = createOpenAI({
      baseURL: process.env.OLLAMA_BASE_URL ?? "http://127.0.0.1:11434/v1",
      apiKey: process.env.OLLAMA_API_KEY ?? "ollama",
    });
    return {
      model: ollama(profile.engine),
      profile,
      resolvedEngine: profile.engine,
    };
  }

  // Frontier Helix models → AI Gateway (GPT‑6 Astra / Claude Fable 5.1)
  // Requires AI_GATEWAY_API_KEY or Vercel OIDC.
  if (process.env.AI_GATEWAY_API_KEY || process.env.VERCEL_OIDC_TOKEN) {
    return {
      model: gateway(profile.engine) as unknown as LanguageModel,
      profile,
      resolvedEngine: profile.engine,
    };
  }

  // Fallback without gateway: direct provider keys
  if (profile.engine.startsWith("anthropic/")) {
    const id = profile.engine.replace(/^anthropic\//, "");
    return {
      model: createAnthropic({ apiKey: process.env.ANTHROPIC_API_KEY })(id),
      profile,
      resolvedEngine: profile.engine,
    };
  }
  if (profile.engine.startsWith("openai/")) {
    const id = profile.engine.replace(/^openai\//, "");
    return {
      model: createOpenAI({ apiKey: process.env.OPENAI_API_KEY })(id),
      profile,
      resolvedEngine: profile.engine,
    };
  }

  // Last resort: local
  const local = HELIX_MODELS.find((m) => m.id === "helix-local")!;
  const ollama = createOpenAI({
    baseURL: process.env.OLLAMA_BASE_URL ?? "http://127.0.0.1:11434/v1",
    apiKey: process.env.OLLAMA_API_KEY ?? "ollama",
  });
  return {
    model: ollama(local.engine),
    profile: local,
    resolvedEngine: local.engine,
  };
}

export function helixModelSystemPreamble(profile: HelixModelProfile): string {
  return [
    `You are running as Helix model “${profile.name}” (${profile.id}).`,
    `Underlying coding engine: ${profile.engine}.`,
    "Operate at frontier coding-agent quality (GPT‑6 Astra / Claude Fable 5.1 class):",
    "- Multi-file refactors with correct types and tests",
    "- Prefer reuse over rewrite; search before inventing",
    "- Ship compileable artifacts, not just patches",
    "- Be precise, skeptical of assumptions, and verify with tools",
  ].join("\n");
}
