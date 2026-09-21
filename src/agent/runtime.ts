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
import { buildProjectMap } from "./projectMap.js";
import { createWebTools } from "./web.js";
import { createGitTools, loadSecrets } from "./github.js";
import type { ProviderKind } from "../shared/types.js";

export type AgentMode = "chat" | "bug-hunt";

export type RunAgentInput = {
  messages: ModelMessage[];
  workspace?: string;
  skillIds?: string[];
  provider?: ProviderKind;
  model?: string;
  mode?: AgentMode;
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
  const mode = input.mode ?? "chat";

  const secrets = await loadSecrets(workspace);
  if (secrets.githubToken) {
    process.env.GITHUB_TOKEN = secrets.githubToken;
  }

  const skillIds =
    input.skillIds?.length
      ? input.skillIds
      : mode === "bug-hunt"
        ? ["bug-hunt", "coding", "research"]
        : ["coding", "design", "research"];

  const [skills, plugins, projectMap] = await Promise.all([
    loadSkillBodies(skillIds),
    loadPlugins(),
    buildProjectMap(workspace),
  ]);

  const tools = {
    ...createAgentTools(workspace),
    ...createWebTools(),
    ...createGitTools(workspace),
    ...mergePluginTools(plugins),
  };

  const modeBlock =
    mode === "bug-hunt"
      ? "MODE: BUG HUNT. Prioritize finding and fixing defects. Reproduce, isolate, patch, verify."
      : "MODE: BUILD. Map → research existing code on the web → implement → verify.";

  const system = [
    "You are Helix, a local IDE coding agent. Match the quality bar of Cursor and Claude Code.",
    modeBlock,
    "HARD RULES:",
    "1) Before every project task, use the injected project map and call project_map / list_directory / read_file as needed.",
    "2) Before building non-trivial features from scratch, search the web / GitHub for existing libraries or code to reuse.",
    "3) Prefer precise edits. Never invent APIs — read files or docs first.",
    "4) After meaningful work, offer or perform git_commit + git_push when GitHub is connected and the user wants it saved.",
    `Workspace root: ${workspace}`,
    `Current project map:\n${projectMap.summary}`,
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
    stopWhen: stepCountIs(24),
  });
}
