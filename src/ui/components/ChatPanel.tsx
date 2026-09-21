import { useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { MessageSquarePlus, Trash2 } from "lucide-react";
import type { AgentMode, AgentSettings, PluginManifest, SkillSummary } from "../../shared/types";
import {
  applyAgentEvent,
  createAssistantMessage,
  createUserMessage,
  runAgentStream,
  type ChatStatus,
  type LocalMessage,
} from "../lib/agentStream";

type SessionSummary = {
  id: string;
  title: string;
  updatedAt: string;
  mode: AgentMode;
};

export function ChatPanel({
  settings,
  helixModelId,
  mode,
  onModeChange,
  skills,
  plugins,
  activeSkills,
  onToggleSkill,
}: {
  settings: AgentSettings | null;
  helixModelId: string;
  mode: AgentMode;
  onModeChange: (mode: AgentMode) => void;
  skills: SkillSummary[];
  plugins: PluginManifest[];
  activeSkills: string[];
  onToggleSkill: (id: string) => void;
}) {
  const [input, setInput] = useState("");
  const [sessions, setSessions] = useState<SessionSummary[]>([]);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [messages, setMessages] = useState<LocalMessage[]>([]);
  const [status, setStatus] = useState<ChatStatus>("ready");
  const [error, setError] = useState<Error | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const saveTimer = useRef<number | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const busy = status === "submitted" || status === "streaming";

  async function refreshSessions() {
    const res = await fetch("/api/sessions");
    const data = await res.json();
    setSessions(
      (data.sessions ?? []).map((s: SessionSummary) => ({
        id: s.id,
        title: s.title,
        updatedAt: s.updatedAt,
        mode: s.mode,
      }))
    );
  }

  async function ensureSession() {
    const res = await fetch("/api/sessions");
    const data = await res.json();
    const list = data.sessions ?? [];
    if (list.length > 0) {
      await loadSession(list[0].id);
      setSessions(
        list.map((s: SessionSummary) => ({
          id: s.id,
          title: s.title,
          updatedAt: s.updatedAt,
          mode: s.mode,
        }))
      );
      return;
    }
    await createNewSession();
  }

  async function createNewSession() {
    const res = await fetch("/api/sessions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mode, skillIds: activeSkills }),
    });
    const data = await res.json();
    setSessionId(data.session.id);
    setMessages([]);
    setError(null);
    await refreshSessions();
  }

  async function loadSession(id: string) {
    const res = await fetch(`/api/sessions/${id}`);
    const data = await res.json();
    if (!data.session) return;
    setSessionId(data.session.id);
    onModeChange(data.session.mode ?? "chat");
    setMessages((data.session.messages as LocalMessage[]) ?? []);
    setError(null);
  }

  async function removeSession(id: string) {
    await fetch(`/api/sessions/${id}`, { method: "DELETE" });
    if (sessionId === id) {
      setSessionId(null);
      setMessages([]);
      await ensureSession();
    } else {
      await refreshSessions();
    }
  }

  useEffect(() => {
    void ensureSession();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, status]);

  useEffect(() => {
    if (!sessionId || busy) return;
    if (saveTimer.current) window.clearTimeout(saveTimer.current);
    saveTimer.current = window.setTimeout(() => {
      void fetch(`/api/sessions/${sessionId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages,
          mode,
          skillIds: activeSkills,
        }),
      }).then(() => refreshSessions());
    }, 400);
    return () => {
      if (saveTimer.current) window.clearTimeout(saveTimer.current);
    };
  }, [messages, sessionId, busy, mode, activeSkills]);

  async function submitPrompt(text: string) {
    const trimmed = text.trim();
    if (!trimmed || busy || !sessionId) return;

    const userMsg = createUserMessage(trimmed);
    const assistantMsg = createAssistantMessage();
    const nextMessages = [...messages, userMsg];
    setMessages([...nextMessages, assistantMsg]);
    setInput("");
    setError(null);
    setStatus("submitted");

    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    let live = assistantMsg;
    try {
      setStatus("streaming");
      await runAgentStream({
        messages: nextMessages,
        skillIds: activeSkills,
        provider: settings?.provider,
        model: settings?.model,
        workspace: settings?.workspace,
        mode,
        helixModelId,
        signal: controller.signal,
        onEvent: (event) => {
          live = applyAgentEvent(live, event);
          setMessages([...nextMessages, live]);
          if (event.type === "error") {
            setError(new Error(String(event.data.message ?? "Agent error")));
          }
        },
      });
      setStatus("ready");
    } catch (err) {
      if ((err as Error).name === "AbortError") {
        setStatus("ready");
        return;
      }
      setStatus("error");
      setError(err instanceof Error ? err : new Error(String(err)));
    }
  }

  const starters =
    mode === "bug-hunt"
      ? [
          "Hunt bugs in this project: map it, scan risky areas, and fix the highest-severity issue.",
          "Find and fix TypeScript / runtime errors.",
        ]
      : mode === "ship"
        ? [
            "Detect the build pipeline, compile the project, package the final product, and list artifacts.",
            "Run typecheck + production build + installers. Fix any compile errors until ship succeeds.",
          ]
        : [
            "Map the project, research existing libraries online, then propose the best way to improve Helix.",
            "Search GitHub for similar IDE agent UIs and adapt the best patterns here.",
          ];

  return (
    <div className="chat-panel">
      <div className="session-rail">
        <button type="button" className="ghost-btn" onClick={() => void createNewSession()}>
          <MessageSquarePlus size={14} /> New
        </button>
        <div className="session-list">
          {sessions.map((session) => (
            <div
              key={session.id}
              className={`session-item${session.id === sessionId ? " active" : ""}`}
            >
              <button type="button" className="session-open" onClick={() => void loadSession(session.id)}>
                {session.title}
              </button>
              <button
                type="button"
                className="tab-close"
                aria-label="Delete session"
                onClick={() => void removeSession(session.id)}
              >
                <Trash2 size={12} />
              </button>
            </div>
          ))}
        </div>
      </div>

      <div className="chat-toolbar">
        <div className="mode-toggle">
          <button
            type="button"
            className={mode === "chat" ? "active" : ""}
            onClick={() => onModeChange("chat")}
          >
            Build
          </button>
          <button
            type="button"
            className={mode === "ship" ? "active" : ""}
            onClick={() => onModeChange("ship")}
          >
            Ship
          </button>
          <button
            type="button"
            className={mode === "bug-hunt" ? "active" : ""}
            onClick={() => onModeChange("bug-hunt")}
          >
            Bug hunt
          </button>
        </div>
        {busy ? <div className="status-dot" title="Working" /> : null}
      </div>

      <div className="chat-skills">
        {skills.map((skill) => {
          const active = activeSkills.includes(skill.id);
          return (
            <button
              key={skill.id}
              type="button"
              className={`skill-chip${active ? " active" : ""}`}
              onClick={() => onToggleSkill(skill.id)}
              title={skill.description}
            >
              {skill.name}
            </button>
          );
        })}
      </div>

      <div className="chat-stage compact">
        {messages.length === 0 ? (
          <div className="empty-state compact">
            <h2>
              {mode === "bug-hunt" ? "Bug hunt" : mode === "ship" ? "Ship" : "Agent"}
            </h2>
            <p>
              Sessions save to disk automatically. Plugins:{" "}
              {plugins.map((p) => p.name).join(", ") || "none"}.
            </p>
            <div className="prompt-chips">
              {starters.map((prompt) => (
                <button
                  key={prompt}
                  type="button"
                  className="prompt-chip"
                  onClick={() => void submitPrompt(prompt)}
                >
                  {prompt}
                </button>
              ))}
            </div>
          </div>
        ) : (
          messages.map((message) => (
            <article key={message.id} className="message">
              <div className={`avatar ${message.role}`}>
                {message.role === "user" ? "You" : "Hx"}
              </div>
              <div className="message-body">
                <div className="role-label">{message.role === "user" ? "You" : "Helix"}</div>
                <div className="markdown">
                  {(message.parts ?? []).map((part, index) => {
                    if (part.type === "text" && part.text) {
                      return (
                        <ReactMarkdown key={`${message.id}-${index}`} remarkPlugins={[remarkGfm]}>
                          {part.text}
                        </ReactMarkdown>
                      );
                    }
                    if (part.type === "tool" || part.type === "status") {
                      return (
                        <pre key={`${message.id}-${index}`}>
                          {part.tool ? `${part.tool} · ${part.state ?? ""}` : part.text}
                        </pre>
                      );
                    }
                    return null;
                  })}
                </div>
              </div>
            </article>
          ))
        )}
        {error ? (
          <div className="pane-error">
            {error.message}
            <div className="muted">
              Tip: use Ollama or set cloud API keys in <code>.env</code>.
            </div>
          </div>
        ) : null}
        <div ref={bottomRef} />
      </div>

      <form
        className="composer compact"
        onSubmit={(e) => {
          e.preventDefault();
          void submitPrompt(input);
        }}
      >
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={
            mode === "bug-hunt"
              ? "Describe the bug or ask Helix to hunt…"
              : mode === "ship"
                ? "Ask Helix to compile and package the final product…"
                : "Ask Helix to map, research, and ship a change…"
          }
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              void submitPrompt(input);
            }
          }}
        />
        <div className="composer-footer">
          <span className="hint">Unlimited tokens · Python agents · Enter send</span>
          <button className="send-btn" type="submit" disabled={busy || !input.trim()}>
            {busy ? "Working…" : "Send"}
          </button>
        </div>
      </form>
    </div>
  );
}
