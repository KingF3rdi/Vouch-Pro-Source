/**
 * Client for Python FastAPI agent streams (NDJSON + WebSocket).
 * Mirrors backend/app/models/schemas.py AgentEvent / ChatRequest.
 */

import type { AgentEvent, AgentMode, ChatRequest, HelixModelId, ProviderKind, UIMessage } from "../../shared/api-contracts";

export type ChatStatus = "ready" | "submitted" | "streaming" | "error";

export type LocalMessage = {
  id: string;
  role: "user" | "assistant" | "system";
  parts: Array<{ type: string; text?: string; tool?: string; state?: string; [key: string]: unknown }>;
};

function uid(): string {
  return crypto.randomUUID();
}

function wsUrl(path: string): string {
  const proto = window.location.protocol === "https:" ? "wss:" : "ws:";
  // Prefer same-origin (Vite proxies /api with ws:true)
  return `${proto}//${window.location.host}${path}`;
}

async function streamNdjson(
  body: ChatRequest,
  onEvent: (event: AgentEvent) => void,
  signal?: AbortSignal
): Promise<void> {
  const res = await fetch("/api/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/x-ndjson" },
    body: JSON.stringify(body),
    signal,
  });
  if (!res.ok || !res.body) {
    const text = await res.text().catch(() => "");
    throw new Error(text || `Chat failed (${res.status})`);
  }
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";
    for (const line of lines) {
      if (!line.trim()) continue;
      onEvent(JSON.parse(line) as AgentEvent);
    }
  }
  if (buffer.trim()) {
    onEvent(JSON.parse(buffer) as AgentEvent);
  }
}

function streamWebsocket(
  body: ChatRequest,
  onEvent: (event: AgentEvent) => void,
  signal?: AbortSignal
): Promise<void> {
  return new Promise((resolve, reject) => {
    const socket = new WebSocket(wsUrl("/api/ws/agent"));
    const abort = () => {
      socket.close();
      reject(new DOMException("Aborted", "AbortError"));
    };
    signal?.addEventListener("abort", abort, { once: true });

    socket.onopen = () => {
      socket.send(JSON.stringify(body));
    };
    socket.onmessage = (msg) => {
      try {
        const event = JSON.parse(String(msg.data)) as AgentEvent;
        onEvent(event);
        if (event.type === "done" || event.type === "error") {
          socket.close();
        }
      } catch (err) {
        socket.close();
        reject(err);
      }
    };
    socket.onerror = () => {
      reject(new Error("WebSocket agent connection failed"));
    };
    socket.onclose = () => {
      signal?.removeEventListener("abort", abort);
      resolve();
    };
  });
}

export type RunAgentOptions = {
  messages: LocalMessage[];
  skillIds?: string[];
  provider?: ProviderKind | string;
  model?: string;
  workspace?: string;
  mode?: AgentMode;
  helixModelId?: HelixModelId | string;
  preferWs?: boolean;
  signal?: AbortSignal;
  onEvent: (event: AgentEvent) => void;
};

export async function runAgentStream(options: RunAgentOptions): Promise<void> {
  const body: ChatRequest = {
    messages: options.messages as UIMessage[],
    skillIds: options.skillIds,
    provider: options.provider as ProviderKind | undefined,
    model: options.model,
    workspace: options.workspace,
    mode: options.mode ?? "chat",
    helixModelId: options.helixModelId as HelixModelId | undefined,
  };

  if (options.preferWs !== false) {
    try {
      await streamWebsocket(body, options.onEvent, options.signal);
      return;
    } catch (err) {
      if (options.signal?.aborted) throw err;
      // Fall back to NDJSON REST
    }
  }
  await streamNdjson(body, options.onEvent, options.signal);
}

export function applyAgentEvent(
  assistant: LocalMessage,
  event: AgentEvent
): LocalMessage {
  const next = { ...assistant, parts: [...assistant.parts] };
  if (event.type === "token") {
    const text = String(event.data.text ?? "");
    const last = next.parts[next.parts.length - 1];
    if (last?.type === "text") {
      next.parts[next.parts.length - 1] = { ...last, text: (last.text ?? "") + text };
    } else {
      next.parts.push({ type: "text", text });
    }
  } else if (event.type === "status") {
    next.parts.push({
      type: "status",
      text: String(event.data.message ?? "Working…"),
    });
  } else if (event.type === "tool_start") {
    next.parts.push({
      type: "tool",
      tool: String(event.data.tool ?? "tool"),
      state: "running",
      text: `${event.data.tool}…`,
    });
  } else if (event.type === "tool_result") {
    next.parts.push({
      type: "tool",
      tool: String(event.data.tool ?? "tool"),
      state: event.data.ok === false ? "error" : "done",
      text: `${event.data.tool} · ${event.data.ok === false ? "error" : "done"}`,
    });
  } else if (event.type === "error") {
    next.parts.push({
      type: "text",
      text: `\n\n**Error:** ${event.data.message ?? "Agent error"}`,
    });
  }
  return next;
}

export function createUserMessage(text: string): LocalMessage {
  return {
    id: uid(),
    role: "user",
    parts: [{ type: "text", text }],
  };
}

export function createAssistantMessage(): LocalMessage {
  return {
    id: uid(),
    role: "assistant",
    parts: [],
  };
}
