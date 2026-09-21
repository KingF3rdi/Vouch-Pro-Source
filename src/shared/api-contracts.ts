/**
 * Mirrored API contracts for the Python FastAPI back-end.
 * Keep in sync with backend/app/models/schemas.py
 */

export type ProviderKind = "ollama" | "openai" | "anthropic" | "gateway";
export type AgentMode = "chat" | "bug-hunt" | "ship";
export type HelixModelId = "helix-code" | "helix-astra" | "helix-fable" | "helix-local";

export interface HealthResponse {
  ok: boolean;
  name: string;
  version: string;
  backend: string;
}

export interface AgentSettings {
  provider: string;
  model: string;
  workspace: string;
  helixModelId: string;
  helixModelName: string;
}

export interface HelixModelProfile {
  id: HelixModelId;
  name: string;
  description: string;
  badge: string;
  engine: string;
  route: "gateway" | "anthropic" | "openai" | "ollama";
}

export interface ModelsResponse {
  models: HelixModelProfile[];
  selected: HelixModelId;
  gatewayConfigured: boolean;
  anthropicConfigured: boolean;
  openaiConfigured: boolean;
}

export interface UIMessage {
  id: string;
  role: "system" | "user" | "assistant";
  parts: Array<Record<string, unknown>>;
  content?: string;
}

export interface ChatRequest {
  messages: UIMessage[];
  skillIds?: string[];
  provider?: ProviderKind;
  model?: string;
  workspace?: string;
  mode?: AgentMode;
  helixModelId?: HelixModelId;
}

export interface AgentEvent {
  type: "status" | "token" | "tool_start" | "tool_result" | "error" | "done";
  data: Record<string, unknown>;
}

export interface SkillSummary {
  id: string;
  name: string;
  description: string;
}

export interface PluginManifest {
  id: string;
  name: string;
  description: string;
  version: string;
  enabled: boolean;
}

export interface ProjectMap {
  root: string;
  topLevel: string[];
  markers: string[];
  likelyStack: string[];
  keyFiles: string[];
  summary: string;
}

export interface FsEntry {
  name: string;
  type: "dir" | "file";
  path: string;
}

export interface BuildStep {
  id: string;
  label: string;
  command: string;
  kind: "typecheck" | "build" | "test" | "package" | "compile";
}

export interface BuildPipeline {
  stack: string[];
  steps: BuildStep[];
  artifactGlobs: string[];
  notes: string[];
}

export interface StoredSession {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  mode: AgentMode;
  skillIds: string[];
  messages: UIMessage[];
}

export interface GitFileStatus {
  path: string;
  status: string;
}

export interface FileDiff {
  original: string;
  modified: string;
  patch: string;
}

export interface GithubStatus {
  connected: boolean;
  user: string | null;
  remote: string | null;
  branch: string | null;
  dirty: boolean;
  hasEnvToken: boolean;
}

export interface McpServerState {
  id: string;
  status: "connected" | "disconnected" | "error" | "disabled";
  tools: string[];
  error?: string;
}
