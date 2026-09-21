import fs from "node:fs/promises";
import path from "node:path";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { tool, type ToolSet } from "ai";
import { z } from "zod";

export type McpServerConfig = {
  command: string;
  args?: string[];
  env?: Record<string, string>;
  disabled?: boolean;
};

export type McpConfigFile = {
  mcpServers: Record<string, McpServerConfig>;
};

export type McpServerState = {
  id: string;
  status: "connected" | "disconnected" | "error" | "disabled";
  tools: string[];
  error?: string;
};

type ConnectedServer = {
  id: string;
  client: Client;
  transport: StdioClientTransport;
  tools: string[];
};

const connected = new Map<string, ConnectedServer>();

export function mcpConfigPath(workspace: string) {
  return path.join(workspace, ".helix", "mcp.json");
}

export async function loadMcpConfig(workspace: string): Promise<McpConfigFile> {
  try {
    const raw = await fs.readFile(mcpConfigPath(workspace), "utf8");
    const parsed = JSON.parse(raw) as McpConfigFile;
    return { mcpServers: parsed.mcpServers ?? {} };
  } catch {
    return { mcpServers: {} };
  }
}

export async function saveMcpConfig(
  workspace: string,
  config: McpConfigFile
): Promise<McpConfigFile> {
  await fs.mkdir(path.dirname(mcpConfigPath(workspace)), { recursive: true });
  await fs.writeFile(mcpConfigPath(workspace), JSON.stringify(config, null, 2));
  return config;
}

export async function ensureDefaultMcpConfig(workspace: string) {
  const existing = await loadMcpConfig(workspace);
  if (Object.keys(existing.mcpServers).length > 0) return existing;
  const defaults: McpConfigFile = {
    mcpServers: {
      // Example stub — disabled until the user enables a real MCP server
      example_memory: {
        command: "npx",
        args: ["-y", "@modelcontextprotocol/server-memory"],
        disabled: true,
      },
    },
  };
  return saveMcpConfig(workspace, defaults);
}

export async function disconnectAllMcp() {
  for (const [id, server] of connected) {
    try {
      await server.client.close();
    } catch {
      // ignore
    }
    connected.delete(id);
  }
}

export async function reconnectMcpServers(workspace: string): Promise<McpServerState[]> {
  await disconnectAllMcp();
  const config = await ensureDefaultMcpConfig(workspace);
  const states: McpServerState[] = [];

  for (const [id, serverConfig] of Object.entries(config.mcpServers)) {
    if (serverConfig.disabled) {
      states.push({ id, status: "disabled", tools: [] });
      continue;
    }
    try {
      const transport = new StdioClientTransport({
        command: serverConfig.command,
        args: serverConfig.args ?? [],
        env: { ...process.env, ...serverConfig.env } as Record<string, string>,
      });
      const client = new Client({ name: "helix-agent", version: "0.2.0" });
      await client.connect(transport);
      const listed = await client.listTools();
      const toolNames = (listed.tools ?? []).map((t) => t.name);
      connected.set(id, { id, client, transport, tools: toolNames });
      states.push({ id, status: "connected", tools: toolNames });
    } catch (error) {
      states.push({
        id,
        status: "error",
        tools: [],
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  return states;
}

export function listMcpStates(workspaceConfig: McpConfigFile): McpServerState[] {
  return Object.entries(workspaceConfig.mcpServers).map(([id, cfg]) => {
    if (cfg.disabled) return { id, status: "disabled" as const, tools: [] };
    const live = connected.get(id);
    if (live) return { id, status: "connected" as const, tools: live.tools };
    return { id, status: "disconnected" as const, tools: [] };
  });
}

export function createMcpTools(): ToolSet {
  const tools: ToolSet = {};

  tools.mcp_list_servers = tool({
    description: "List configured MCP servers and their connection status/tools.",
    inputSchema: z.object({}),
    execute: async () => {
      return [...connected.values()].map((s) => ({
        id: s.id,
        tools: s.tools,
        status: "connected",
      }));
    },
  });

  tools.mcp_call_tool = tool({
    description:
      "Call a tool on a connected MCP server. Use mcp_list_servers first to discover tool names.",
    inputSchema: z.object({
      serverId: z.string(),
      toolName: z.string(),
      arguments: z.record(z.string(), z.unknown()).default({}),
    }),
    execute: async ({ serverId, toolName, arguments: args }) => {
      const server = connected.get(serverId);
      if (!server) {
        return { error: `MCP server not connected: ${serverId}` };
      }
      const result = await server.client.callTool({
        name: toolName,
        arguments: args,
      });
      return result;
    },
  });

  return tools;
}
