export type ChatRole = "user" | "assistant" | "system";

export type ChatMessage = {
  id: string;
  role: ChatRole;
  content: string;
};

export type ProviderKind = "ollama" | "openai" | "anthropic";

export type AgentSettings = {
  provider: ProviderKind;
  model: string;
  workspace: string;
};

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
