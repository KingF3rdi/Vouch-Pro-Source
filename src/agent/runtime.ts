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
import { understandProject } from "./understand.js";
import {
  getHelixModel,
  helixModelSystemPreamble,
  loadHelixSettings,
  resolveHelixLanguageModelAsync,
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
  if (mode === "bug-hunt") {
    return [
      "bug-hunt",
      "debugging",
      "testing",
      "coding",
      "research",
      "code-quality",
      "security",
      "agent-curriculum",
    ];
  }
  if (mode === "ship") {
    return [
      "ship",
      "coding",
      "testing",
      "docs",
      "research",
      "code-quality",
      "complex-projects",
      "agent-curriculum",
    ];
  }
  return [
    "coding",
    "design",
    "research",
    "ship",
    "debugging",
    "testing",
    "refactor",
    "docs",
    "security",
    "git-workflow",
    "complex-projects",
    "code-quality",
    "agent-curriculum",
  ];
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
  const { model, resolvedEngine } = await resolveHelixLanguageModelAsync(profile, {
    provider: input.provider,
    model: input.model,
  });

  const skillIds = [
    ...skillsForMode(mode, input.skillIds),
    // Helix Own / free models always get the full training pack
    "agent-curriculum",
    "complex-projects",
    "code-quality",
  ];
  const uniqueSkillIds = [...new Set(skillIds)];

  const [skills, plugins, projectMap, understanding] = await Promise.all([
    loadSkillBodies(uniqueSkillIds),
    loadPlugins(),
    buildProjectMap(workspace),
    understandProject(workspace).catch(() => null),
  ]);

  const tools = {
    ...createAgentTools(workspace),
    ...createWebTools(),
    ...createGitTools(workspace),
    ...createMcpTools(),
    ...createBuildTools(workspace),
    ...mergePluginTools(plugins),
  };

  const maxStepsEnv = Number(process.env.HELIX_MAX_STEPS ?? "0");
  const hardCap = Number(process.env.HELIX_HARD_STEP_CAP ?? "1000");
  const maxSteps =
    maxStepsEnv <= 0
      ? hardCap
      : Math.min(maxStepsEnv, hardCap);

  const system = [
    helixModelSystemPreamble({ ...profile, engine: resolvedEngine }),
    "You are Helix Own — a trained local coding agent (TypeScript runtime).",
    "You write quality code, create complex multi-file projects, and understand codebases before editing.",
    modeBlock(mode),
    "You have effectively unlimited output tokens and tool steps — finish the task fully.",
    "HARD RULES:",
    "1) Call understand_project (or project_map) before non-trivial work.",
    "2) For greenfield complex apps, use scaffold_project then fill real logic.",
    "3) Prefer precise edits. Never invent APIs — read files or docs first.",
    "4) After meaningful edits, call quality_check and fix failures.",
    "5) After shipping or meaningful work, offer git_commit + git_push when GitHub is connected.",
    `Workspace root: ${workspace}`,
    `Current project map:\n${projectMap.summary}`,
    understanding
      ? `Project understanding:\n${understanding.narrative}\nArchitecture: ${understanding.architecture.join(
          "; "
        )}\nEntrypoints: ${understanding.entrypoints.join(", ")}`
      : "",
    pluginSystemPrompt(plugins),
    skills ? `Loaded skills / training:\n\n${skills}` : "",
  ]
    .filter(Boolean)
    .join("\n\n");

  return streamText({
    model,
    system,
    messages: input.messages,
    tools,
    stopWhen: stepCountIs(maxSteps),
  });
}
