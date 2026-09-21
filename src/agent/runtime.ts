import {
  stepCountIs,
  streamText,
  smoothStream,
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
import { createHostingTools } from "./hosting.js";
import { createTradingTools } from "./trading.js";
import { createTodoTools } from "./todos.js";
import {
  getHelixModel,
  helixModelSystemPreamble,
  loadHelixSettings,
  resolveHelixLanguageModelAsync,
  type HelixModelId,
} from "./models.js";
import { getDefaultSettings } from "./settings.js";
import type { AgentMode, ProviderKind } from "../shared/types.js";

export type { AgentMode };
export { getDefaultSettings };

export type RunAgentInput = {
  messages: ModelMessage[];
  workspace?: string;
  skillIds?: string[];
  provider?: ProviderKind;
  model?: string;
  helixModelId?: HelixModelId | string;
  mode?: AgentMode;
};

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
      "build-products",
      "games-mods",
      "website-hosting",
      "trading-bot",
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
    "build-products",
    "games-mods",
    "website-hosting",
    "trading-bot",
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
  return "MODE: BUILD. Optimized for apps, websites, games, mods, and any code product. Map → scaffold/reuse → implement → verify → ship.";
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
  // When a Helix model id is set, resolve from that profile only —
  // ignore stale provider/model echoes from the client settings object.
  const { model, resolvedEngine } = await resolveHelixLanguageModelAsync(
    profile,
    input.helixModelId
      ? undefined
      : {
          provider: input.provider,
          model: input.model,
        }
  );

  const skillIds = [
    ...skillsForMode(mode, input.skillIds),
    // Helix Own / free models always get the full training pack
    "agent-curriculum",
    "complex-projects",
    "build-products",
    "games-mods",
    "website-hosting",
    "trading-bot",
    "code-quality",
  ];
  const uniqueSkillIds = [...new Set(skillIds)];

  const [skills, plugins, projectMap] = await Promise.all([
    loadSkillBodies(uniqueSkillIds),
    loadPlugins(),
    buildProjectMap(workspace),
  ]);

  const tools = {
    ...createAgentTools(workspace),
    ...createTodoTools(workspace),
    ...createWebTools(),
    ...createGitTools(workspace),
    ...createMcpTools(),
    ...createBuildTools(workspace),
    ...createHostingTools(workspace),
    ...createTradingTools(workspace),
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
    "You are Helix Own — behave like Cursor Agent / Claude Code on the user's machine.",
    "Agency: take initiative, use tools in a long loop, edit real files, create folders, run commands, and keep going until the task is done or truly blocked.",
    "Workflow: (1) brief plan with todo_write for multi-step work (2) tools in parallel when independent (3) verify with quality_check / run_terminal (4) fix failures and continue — never stop after one tool call.",
    "Communication: short status updates between tool batches. Prefer concrete file paths and commands over essays.",
    modeBlock(mode),
    "You have effectively unlimited output tokens and tool steps — finish the task fully.",
    "BUILD FAILURE RULE (non-negotiable): If quality_check, ship_project, run_build_step, or fix_failed_build returns ok:false or mustFix:true, you MUST keep fixing (read_file → apply_patch → re-run) until ok:true. Never end the turn with a failed build. Never say you are done while mustFix is true.",
    "HARD RULES:",
    "1) Call project_map or understand_project before non-trivial work on existing repos.",
    "2) For greenfield products, use scaffold_project with the matching kind (website, game-canvas, mod-fabric, electron-app, fullstack-ts, …) then fill real logic. Create folders with create_directory and files with write_file / apply_patch.",
    "3) Prefer precise edits. Never invent host APIs (Fabric/Forge, browser MV3, game engines) — read docs or samples first.",
    "4) After meaningful edits, call quality_check. On failure call fix_failed_build and repair every diagnostic.",
    "5) After shipping or meaningful work, offer git_commit + git_push when GitHub is connected.",
    "6) Optimize for a playable/runnable slice early — then harden.",
    "7) For going live: use hosting_* tools. Two modes — credentialed (only if user allowed + saved host tokens) or assisted (open host on their PC; they log in; you click through).",
    "8) For markets: use trading_* tools. Default focus is memecoins (CEX + rug-filtered DEX). Paper by default. Never promise profits. Live stays gated.",
    `Workspace root (real folder on this PC): ${workspace}`,
    `Current project map:\n${projectMap.summary}`,
    pluginSystemPrompt(plugins),
    skills ? `Loaded skills / training:\n\n${skills}` : "",
  ]
    .filter(Boolean)
    .join("\n\n");

  let stepCounter = 0;
  let pendingBuildFix = false;

  return streamText({
    model,
    system,
    messages: input.messages,
    tools,
    stopWhen: stepCountIs(maxSteps),
    experimental_transform: smoothStream({ delayInMs: 12 }),
    prepareStep: async ({ stepNumber, steps }) => {
      const last = steps[steps.length - 1];
      if (last?.toolResults?.length) {
        for (const tr of last.toolResults) {
          const name = (tr as { toolName?: string }).toolName || "";
          const output = (tr as { output?: unknown }).output;
          if (!output || typeof output !== "object") continue;
          const o = output as { ok?: boolean; mustFix?: boolean };
          const buildTool =
            /quality_check|ship_project|run_build_step|fix_failed_build|run_tests/.test(name);
          if (buildTool && (o.mustFix === true || o.ok === false)) {
            pendingBuildFix = true;
          }
          if (buildTool && o.ok === true) {
            pendingBuildFix = false;
          }
        }
      }

      // After a failed build, force tool use until green — do not allow a text-only “done”.
      if (pendingBuildFix) {
        return {
          toolChoice: "required" as const,
          activeTools: [
            "fix_failed_build",
            "quality_check",
            "ship_project",
            "run_build_step",
            "read_file",
            "apply_patch",
            "write_file",
            "create_directory",
            "run_terminal",
            "todo_write",
            "todo_read",
            "project_map",
            "list_directory",
            "search_files",
            "explain_code",
          ],
        };
      }

      if (mode === "ship" && stepNumber === 0) {
        return { toolChoice: "required" as const };
      }

      if (stepNumber === 0) {
        return { toolChoice: "auto" as const };
      }
      return {};
    },
    onStepFinish: ({ toolCalls, toolResults, finishReason }) => {
      stepCounter += 1;
      const toolsUsed = toolCalls.map((t) => t.toolName).join(", ") || "none";
      for (const tr of toolResults) {
        const name = (tr as { toolName?: string }).toolName || "";
        const output = (tr as { output?: unknown }).output;
        if (!output || typeof output !== "object") continue;
        const o = output as { ok?: boolean; mustFix?: boolean };
        const buildTool =
          /quality_check|ship_project|run_build_step|fix_failed_build|run_tests/.test(name);
        if (buildTool && (o.mustFix === true || o.ok === false)) pendingBuildFix = true;
        if (buildTool && o.ok === true) pendingBuildFix = false;
      }
      console.log(
        `[helix] step ${stepCounter} · tools=${toolsUsed} · results=${toolResults.length} · ${finishReason} · pendingBuildFix=${pendingBuildFix}`
      );
    },
  });
}
