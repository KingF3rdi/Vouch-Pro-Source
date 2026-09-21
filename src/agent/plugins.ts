import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { tool, type ToolSet } from "ai";
import { z } from "zod";
import type { PluginManifest } from "../shared/types.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const helixRoot = process.env.HELIX_ROOT
  ? path.resolve(process.env.HELIX_ROOT)
  : path.resolve(__dirname, "../..");
export const PLUGINS_DIR = path.join(helixRoot, "plugins");

export type HelixPlugin = {
  manifest: PluginManifest;
  tools?: ToolSet;
  systemPrompt?: string;
};

type PluginModule = {
  id: string;
  name: string;
  description: string;
  version?: string;
  enabled?: boolean;
  systemPrompt?: string;
  createTools?: () => ToolSet | Promise<ToolSet>;
};

export async function loadPlugins(): Promise<HelixPlugin[]> {
  let entries: import("node:fs").Dirent[] = [];
  try {
    entries = await fs.readdir(PLUGINS_DIR, { withFileTypes: true });
  } catch {
    return [];
  }
  const plugins: HelixPlugin[] = [];
  const allowTs = !process.env.HELIX_DESKTOP || Boolean(process.env.HELIX_ALLOW_TS_PLUGINS);

  for (const entry of entries) {
    if (!entry.isFile()) continue;
    if (entry.name.startsWith("_")) continue;
    if (entry.name.endsWith(".ts") && !allowTs) continue;
    if (!entry.name.endsWith(".ts") && !entry.name.endsWith(".js") && !entry.name.endsWith(".mjs")) {
      continue;
    }

    const fullPath = path.join(PLUGINS_DIR, entry.name);
    try {
      const mod = (await import(pathToFileUrl(fullPath))) as PluginModule;
      const tools = mod.createTools ? await mod.createTools() : undefined;

      plugins.push({
        manifest: {
          id: mod.id,
          name: mod.name,
          description: mod.description,
          version: mod.version ?? "0.1.0",
          enabled: mod.enabled !== false,
        },
        tools,
        systemPrompt: mod.systemPrompt,
      });
    } catch (error) {
      console.warn(
        `[helix] skip plugin ${entry.name}:`,
        error instanceof Error ? error.message : error
      );
    }
  }

  return plugins.filter((plugin) => plugin.manifest.enabled);
}

export function mergePluginTools(plugins: HelixPlugin[]): ToolSet {
  const merged: ToolSet = {};
  for (const plugin of plugins) {
    if (!plugin.tools) continue;
    Object.assign(merged, plugin.tools);
  }
  return merged;
}

export function pluginSystemPrompt(plugins: HelixPlugin[]): string {
  return plugins
    .map((plugin) => plugin.systemPrompt)
    .filter(Boolean)
    .join("\n\n");
}

/** Example helper for plugin authors */
export function defineSimpleTool(
  name: string,
  description: string,
  schema: z.ZodObject<z.ZodRawShape>,
  execute: (input: Record<string, unknown>) => Promise<unknown> | unknown
) {
  return {
    [name]: tool({
      description,
      inputSchema: schema,
      execute,
    }),
  };
}

function pathToFileUrl(filePath: string): string {
  const resolved = path.resolve(filePath);
  return process.platform === "win32"
    ? `file:///${resolved.replace(/\\/g, "/")}`
    : `file://${resolved}`;
}
