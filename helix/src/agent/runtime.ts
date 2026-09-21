import { createAnthropic } from "@ai-sdk/anthropic";
import { createOpenAI } from "@ai-sdk/openai";
import {
  stepCountIs,
  streamText,
  type LanguageModel,
  type ModelMessage,
} from "ai";
import path from "node:path";
import { createAgentTools } from "./tools.js";
import { loadSkillBodies } from "./skills.js";
import {
  loadPlugins,
  mergePluginTools,
  pluginSystemPrompt,
} from "./plugins.js";
import type { ProviderKind } from "../shared/types.js";

export type RunAgentInput = {
  messages: ModelMessage[];
  workspace?: string;
  skillIds?: string[];
  provider?: ProviderKind;
  model?: string;
};

function resolveModel(provider: ProviderKind, modelName: string): LanguageModel {
  if (provider === "anthropic") {
    const anthropic = createAnthropic({
      apiKey: process.env.ANTHROPIC_API_KEY,
    });
    return anthropic(modelName);
  }

  if (provider === "openai") {
    const openai = createOpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });
    return openai(modelName);
  }

  const ollama = createOpenAI({
    baseURL: process.env.OLLAMA_BASE_URL ?? "http://127.0.0.1:11434/v1",
    apiKey: process.env.OLLAMA_API_KEY ?? "ollama",
  });
  return ollama(modelName);
}

export function getDefaultSettings() {
  const provider = (process.env.HELIX_PROVIDER ?? "ollama") as ProviderKind;
  const model =
    process.env.OLLAMA_MODEL ??
    process.env.OPENAI_MODEL ??
    process.env.ANTHROPIC_MODEL ??
    (provider === "anthropic"
      ? "claude-sonnet-4-20250514"
      : provider === "openai"
        ? "gpt-4.1-mini"
        : "llama3.2");

  return {
    provider,
    model,
    workspace: path.resolve(process.env.HELIX_WORKSPACE ?? process.cwd()),
  };
}

export async function runAgentStream(input: RunAgentInput) {
  const defaults = getDefaultSettings();
  const provider = input.provider ?? defaults.provider;
  const modelName = input.model ?? defaults.model;
  const workspace = path.resolve(input.workspace ?? defaults.workspace);

  const skills = await loadSkillBodies(input.skillIds);
  const plugins = await loadPlugins();
  const tools = {
    ...createAgentTools(workspace),
    ...mergePluginTools(plugins),
  };

  const system = [
    "You are Helix, a local coding agent that runs on the user's machine.",
    "You work like Cursor / Claude Code: inspect the workspace, edit files, run commands, and ship working changes.",
    "Prefer precise, minimal edits. Explain briefly what you did.",
    "Never invent file contents — read first when unsure.",
    `Workspace root: ${workspace}`,
    pluginSystemPrompt(plugins),
    skills ? `Loaded skills:\n\n${skills}` : "",
  ]
    .filter(Boolean)
    .join("\n\n");

  return streamText({
    model: resolveModel(provider, modelName),
    system,
    messages: input.messages,
    tools,
    stopWhen: stepCountIs(12),
  });
}
