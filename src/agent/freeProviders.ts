/**
 * Free / local LLM backends.
 * We never scrape or steal paid API keys — only legitimate free tiers + Ollama.
 */

import { createOpenAI } from "@ai-sdk/openai";
import type { LanguageModel } from "ai";

export type FreeBackend =
  | { id: "ollama"; label: string; model: string; ready: boolean }
  | { id: "groq"; label: string; model: string; ready: boolean }
  | { id: "openrouter"; label: string; model: string; ready: boolean }
  | { id: "gemini"; label: string; model: string; ready: boolean };

const OLLAMA_BASE = process.env.OLLAMA_BASE_URL ?? "http://127.0.0.1:11434/v1";
const FT_BASE = process.env.HELIX_FT_BASE_URL ?? "http://127.0.0.1:11435/v1";
const OLLAMA_TAGS = (process.env.OLLAMA_BASE_URL ?? "http://127.0.0.1:11434/v1").replace(
  /\/v1\/?$/,
  "/api/tags"
);

export async function probeFineTuneServer(): Promise<boolean> {
  try {
    const res = await fetch(FT_BASE.replace(/\/v1\/?$/, "/health"), {
      signal: AbortSignal.timeout(1200),
    });
    if (!res.ok) return false;
    const data = (await res.json()) as { ok?: boolean };
    return Boolean(data.ok);
  } catch {
    return false;
  }
}

export async function probeOllama(): Promise<{ ready: boolean; models: string[] }> {
  try {
    const res = await fetch(OLLAMA_TAGS, { signal: AbortSignal.timeout(1500) });
    if (!res.ok) return { ready: false, models: [] };
    const data = (await res.json()) as { models?: Array<{ name?: string }> };
    const models = (data.models ?? []).map((m) => m.name ?? "").filter(Boolean);
    return { ready: models.length > 0, models };
  } catch {
    return { ready: false, models: [] };
  }
}

export function pickOllamaCoder(models: string[]): string {
  const preferred = [
    process.env.HELIX_LOCAL_MODEL,
    process.env.OLLAMA_MODEL,
    "helix-own",
    "helix-own:latest",
    "qwen2.5-coder:14b",
    "qwen2.5-coder:7b",
    "qwen2.5-coder:3b",
    "deepseek-coder-v2:lite",
    "codellama:7b",
    "llama3.2:3b",
  ].filter(Boolean) as string[];

  for (const want of preferred) {
    const hit = models.find(
      (m) => m === want || m === `${want}:latest` || m.startsWith(`${want}:`) || m.startsWith(want)
    );
    if (hit) return hit;
  }
  const coder = models.find((m) => /coder|code|helix/i.test(m));
  return coder ?? models[0] ?? "qwen2.5-coder:3b";
}

/** Sync create of OpenAI-compatible free clients (keys from env only).
 * Always use `.chat()` — default `provider(model)` hits OpenAI Responses API,
 * which Ollama / Helix FT / Groq-compatible servers do not implement.
 */
export function createFreeLanguageModel(
  backend: "ollama" | "groq" | "openrouter" | "ft",
  modelId: string
): LanguageModel {
  if (backend === "ft") {
    const client = createOpenAI({
      name: "helix-ft",
      baseURL: FT_BASE,
      apiKey: "helix-own-ft",
    });
    return client.chat(modelId);
  }
  if (backend === "ollama") {
    const client = createOpenAI({
      name: "ollama",
      baseURL: OLLAMA_BASE,
      apiKey: process.env.OLLAMA_API_KEY ?? "ollama",
    });
    return client.chat(modelId);
  }
  if (backend === "groq") {
    const client = createOpenAI({
      name: "groq",
      baseURL: "https://api.groq.com/openai/v1",
      apiKey: process.env.GROQ_API_KEY,
    });
    return client.chat(modelId);
  }
  const client = createOpenAI({
    name: "openrouter",
    baseURL: "https://openrouter.ai/api/v1",
    apiKey: process.env.OPENROUTER_API_KEY,
    headers: {
      "HTTP-Referer": "https://helix.local",
      "X-Title": "Helix Agent",
    },
  });
  return client.chat(modelId);
}

export function freeBackendStatus() {
  return {
    ollamaBase: OLLAMA_BASE,
    groqConfigured: Boolean(process.env.GROQ_API_KEY),
    openrouterConfigured: Boolean(process.env.OPENROUTER_API_KEY),
    geminiConfigured: Boolean(
      process.env.GOOGLE_GENERATIVE_AI_API_KEY || process.env.GEMINI_API_KEY
    ),
    gatewayConfigured: Boolean(
      process.env.AI_GATEWAY_API_KEY || process.env.VERCEL_OIDC_TOKEN
    ),
    openaiConfigured: Boolean(process.env.OPENAI_API_KEY),
    anthropicConfigured: Boolean(process.env.ANTHROPIC_API_KEY),
  };
}
