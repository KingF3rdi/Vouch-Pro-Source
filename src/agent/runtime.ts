import {
  stepCountIs,
  streamText,
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
import { createMcpTools } from "./mcp.js";
import { createBuildTools } from "./build.js";
import {
  getHelixModel,
  helixModelSystemPreamble,
  loadHelixSettings,
  resolveHelixLanguageModel,
  type HelixModelId,
} from "./models.js";
import type { AgentMode, ProviderKind } from "../shared/types.js";

export type { AgentMode };

export type RunAgentInput = {
  messages: ModelMessage[];
  workspace?: string;
  skillIds?: string[];
  provider?: ProviderKind;
  model?: string;
  helixModelId?: HelixModelId | string;
  mode?: AgentMode;
};

export async function getDefaultSettings() {
  const workspace = path.resolve(process.env.HELIX_WORKSPACE ?? process.cwd());
  const saved = await loadHelixSettings(workspace);
  const profile = getHelixModel(saved.modelId);

  return {
    provider: profile.route === "gateway" ? "gateway" : profile.route === "ollama" ? "ollama" : profile.route,
    model: profile.engine,
    helixModelId: profile.id,
    helixModelName: profile.name,
    workspace,
  };
}

function skillsForMode(mode: AgentMode, skillIds?: string[]) {
  if (skillIds?.length) return skillIds;
  if (mode === "bug-hunt") return ["bug-hunt", "coding", "research"];
  if (mode === "ship") return ["ship", "coding", "research"];
  return ["coding", "design", "research", "ship"];
}

function modeBlock(mode: AgentMode) {
  if (mode === "bug-hunt") {
    return "MODE: BUG HUNT. Prioritize finding and fixing defects. Reproduce, isolate, patch, verify.";
  }
  if (mode === "ship") {
    return "MODE: SHIP. Detect the build pipeline, compile/package the final product, fix build errors, and report artifact paths.";
  }
  return "MODE: BUILD. Map → research existing code → implement → typecheck/build → ship final artifacts when asked.";
}

export async function runAgentStream(input: RunAgentInput) {
  const defaults = await getDefaultSettings();
  const workspace = path.resolve(input.workspace ?? defaults.workspace);
  const mode = input.mode ?? "chat";

  const secrets = await loadSecrets(workspace);
  if (secrets.githubToken) {
    process.env.GITHUB_TOKEN = secrets.githubToken;
  }

  const saved = await loadHelixSettings(workspace);
  const profile = getHelixModel(input.helixModelId ?? saved.modelId);
  const { model, resolvedEngine } = resolveHelixLanguageModel(profile, {
    provider: input.provider,
    model: input.model,
  });

  const skillIds = skillsForMode(mode, input.skillIds);

  const [skills, plugins, projectMap] = await Promise.all([
    loadSkillBodies(skillIds),
    loadPlugins(),
    buildProjectMap(workspace),
  ]);

  const tools = {
    ...createAgentTools(workspace),
    ...createWebTools(),
    ...createGitTools(workspace),
    ...createMcpTools(),
    ...createBuildTools(workspace),
    ...mergePluginTools(plugins),
  };

  const system = [
    helixModelSystemPreamble({ ...profile, engine: resolvedEngine }),
    "You are Helix, a local IDE coding agent.",
    modeBlock(mode),
    "HARD RULES:",
    "1) Before every project task, use the injected project map and call project_map / list_directory / read_file as needed.",
    "2) Before building non-trivial features from scratch, search the web / GitHub for existing libraries or code to reuse.",
    "3) Prefer precise edits. Never invent APIs — read files or docs first.",
    "4) After meaningful feature work, compile to a final product with detect_build_pipeline / ship_project / run_build_step.",
    "5) After shipping or meaningful work, offer git_commit + git_push when GitHub is connected.",
    `Workspace root: ${workspace}`,
    `Current project map:\n${projectMap.summary}`,
    pluginSystemPrompt(plugins),
    skills ? `Loaded skills:\n\n${skills}` : "",
  ]
    .filter(Boolean)
    .join("\n\n");

  return streamText({
    model,
    system,
    messages: input.messages,
    tools,
    stopWhen: stepCountIs(mode === "ship" ? 32 : 24),
  });
}
