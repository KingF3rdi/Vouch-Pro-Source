import path from "node:path";
import {
  getHelixModel,
  loadHelixSettings,
} from "./models.js";
import { defaultWorkspacePath } from "./projectInstall.js";

/** Lightweight settings — safe to call at startup without loading agent tools. */
export async function getDefaultSettings() {
  const workspace = path.resolve(
    process.env.HELIX_WORKSPACE || defaultWorkspacePath()
  );
  const saved = await loadHelixSettings(workspace);
  const profile = getHelixModel(saved.modelId);

  return {
    provider:
      profile.route === "gateway"
        ? "gateway"
        : profile.route === "ollama"
          ? "ollama"
          : profile.route,
    model: profile.engine,
    helixModelId: profile.id,
    helixModelName: profile.name,
    workspace,
  };
}
