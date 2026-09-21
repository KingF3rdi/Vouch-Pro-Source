export type ChatRole = "user" | "assistant" | "system";

export type ChatMessage = {
  id: string;
  role: ChatRole;
  content: string;
};

export type ProviderKind = "ollama" | "openai" | "anthropic" | "gateway";

export type AgentSettings = {
  provider: ProviderKind | string;
  model: string;
  workspace: string;
  helixModelId?: string;
  helixModelName?: string;
};

export type AgentMode = "chat" | "bug-hunt" | "ship";

export type IdeTab = "editor" | "preview" | "browser" | "bugs" | "github" | "mcp" | "ship" | "host";

export type PluginManifest = {
  id: string;
  name: string;
  description: string;
  version: string;
  enabled: boolean;
};

export type SkillSummary = {
  id: string;
  name: string;
  description: string;
};
