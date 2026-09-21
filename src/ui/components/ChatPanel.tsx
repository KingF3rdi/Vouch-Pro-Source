import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport, isToolUIPart, type UIMessage } from "ai";
import { useEffect, useMemo, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { MessageSquarePlus, ThumbsDown, ThumbsUp, Trash2, GraduationCap } from "lucide-react";
import type { AgentMode, AgentSettings, PluginManifest, SkillSummary } from "../../shared/types";

type SessionSummary = {
  id: string;
  title: string;
  updatedAt: string;
  mode: AgentMode;
};

type LearningInfo = {
  enabled: boolean;
  totalExamples: number;
  pendingSinceTrain: number;
  retrainEvery: number;
  trainRunning?: boolean;
};

function messageText(message: {
  role?: string;
  parts?: Array<{ type?: string; text?: string }>;
  content?: string;
}): string {
  if (typeof message.content === "string" && message.content.trim()) return message.content.trim();
  return (message.parts ?? [])
    .filter((p) => p.type === "text" && p.text)
    .map((p) => p.text!.trim())
    .filter(Boolean)
    .join("\n");
}
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
  const [learning, setLearning] = useState<LearningInfo | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const saveTimer = useRef<number | null>(null);
  const lastLearnedCount = useRef(0);
  const workspace = settings?.workspace;
  const qs = workspace ? `?workspace=${encodeURIComponent(workspace)}` : "";
  const withWorkspace = (body: Record<string, unknown> = {}) =>
    workspace ? { ...body, workspace } : body;
  const bodyRef = useRef({
    skillIds: activeSkills,
    provider: settings?.provider,
    model: settings?.model,
    workspace: settings?.workspace,
    mode,
    helixModelId,
  });

  bodyRef.current = {
    skillIds: activeSkills,
    provider: settings?.provider,
    model: settings?.model,
    workspace: settings?.workspace,
    mode,
    helixModelId,
  };

  const transport = useMemo(
    () =>
      new DefaultChatTransport({
        api: "/api/chat",
        body: () => bodyRef.current,
      }),
    []
  );

  const { messages, sendMessage, status, error, setMessages } = useChat({
    id: sessionId ?? "pending",
    transport,
  });
  const busy = status === "submitted" || status === "streaming";

  async function refreshSessions() {
    const res = await fetch(`/api/sessions${qs}`);
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
    const res = await fetch(`/api/sessions${qs}`);
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
      body: JSON.stringify(withWorkspace({ mode, skillIds: activeSkills })),
    });
    const data = await res.json();
    setSessionId(data.session.id);
    setMessages([]);
    await refreshSessions();
  }

  async function loadSession(id: string) {
    const res = await fetch(`/api/sessions/${id}${qs}`);
    const data = await res.json();
    if (!data.session) return;
    setSessionId(data.session.id);
    onModeChange(data.session.mode ?? "chat");
    setMessages((data.session.messages as UIMessage[]) ?? []);
  }

  async function removeSession(id: string) {
    await fetch(`/api/sessions/${id}${qs}`, { method: "DELETE" });
    if (sessionId === id) {
      setSessionId(null);
      setMessages([]);
      await ensureSession();
    } else {
      await refreshSessions();
    }
  }

  async function refreshLearning() {
    const res = await fetch(`/api/learning${qs}`);
    const data = await res.json();
    setLearning({
      enabled: Boolean(data.settings?.enabled),
      totalExamples: Number(data.settings?.totalExamples ?? 0),
      pendingSinceTrain: Number(data.settings?.pendingSinceTrain ?? 0),
      retrainEvery: Number(data.settings?.retrainEvery ?? 8),
      trainRunning: Boolean(data.trainRunning),
    });
  }

  async function toggleLearning(enabled: boolean) {
    await fetch("/api/learning/settings", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(withWorkspace({ enabled })),
    });
    await refreshLearning();
  }

  async function rateAssistant(assistantId: string, rating: "up" | "down") {
    const idx = messages.findIndex((m) => m.id === assistantId);
    if (idx < 0) return;
    const assistant = messages[idx]!;
    const user = [...messages.slice(0, idx)].reverse().find((m) => m.role === "user");
    if (!user) return;
    let correction: string | undefined;
    if (rating === "down") {
      correction =
        window.prompt(
          "Optional: write the better answer Helix should learn (local only)."
        ) || undefined;
    }
    await fetch("/api/learning/feedback", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(
        withWorkspace({
          userText: messageText(user),
          assistantText: messageText(assistant),
          rating,
          correction,
        })
      ),
    });
    await refreshLearning();
  }

  useEffect(() => {
    void ensureSession();
    void refreshLearning();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workspace]);

  useEffect(() => {
    function onPrefill(ev: Event) {
      const detail = (ev as CustomEvent<{ prompt?: string }>).detail;
      if (detail?.prompt) setInput(detail.prompt);
    }
    window.addEventListener("helix:prefill-chat", onPrefill);
    return () => window.removeEventListener("helix:prefill-chat", onPrefill);
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, status]);

  useEffect(() => {
    if (!sessionId || status === "streaming" || status === "submitted") return;
    if (saveTimer.current) window.clearTimeout(saveTimer.current);
    saveTimer.current = window.setTimeout(() => {
      void fetch(`/api/sessions/${sessionId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          withWorkspace({
            messages,
            mode,
            skillIds: activeSkills,
          })
        ),
      })
        .then((r) => r.json())
        .then((data) => {
          void refreshSessions();
          if (data.learning?.added) void refreshLearning();
        });
      // Also ingest immediately for continuous learning
      if (messages.length > lastLearnedCount.current) {
        lastLearnedCount.current = messages.length;
        void fetch("/api/learning/ingest", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(withWorkspace({ messages, source: "chat" })),
        }).then(() => refreshLearning());
      }
    }, 400);
    return () => {
      if (saveTimer.current) window.clearTimeout(saveTimer.current);
    };
  }, [messages, sessionId, status, mode, activeSkills]);

  function submitPrompt(text: string) {
    const trimmed = text.trim();
    if (!trimmed || busy || !sessionId) return;
    // Archive every user prompt locally before the reply arrives
    void fetch("/api/learning/observe", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(
        withWorkspace({ text: trimmed, kind: "prompt", meta: { mode, sessionId } })
      ),
    });
    void sendMessage({ text: trimmed });
    setInput("");
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
            "Scaffold a playable browser game with TypeScript canvas, then make movement and scoring feel good.",
            "Build a marketing website for my product — hero, clear CTA, responsive, then production build.",
            "Create a fullstack app (API + React UI) for a simple task manager and verify typecheck.",
            "Set up this website on a host: recommend one, then use assisted mode so I log in and you click through.",
            "Scan the markets with the trading bot, avoid rug risks, and run one paper auto-trade cycle.",
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
        <button
          type="button"
          className={`learn-toggle${learning?.enabled ? " active" : ""}`}
          title="Learn from every chat locally (LoRA). Data never leaves this machine."
          onClick={() => void toggleLearning(!(learning?.enabled ?? true))}
        >
          <GraduationCap size={14} />
          {learning?.enabled ? "Learning on" : "Learning off"}
          {learning ? (
            <span className="learn-count">
              {learning.totalExamples}
              {learning.trainRunning ? " · training…" : ""}
            </span>
          ) : null}
        </button>
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
              Optimized for apps, websites, games, mods — and anything with code.
              TypeScript agents · unlimited tokens. Plugins:{" "}
              {plugins.map((p) => p.name).join(", ") || "none"}.
            </p>
            <div className="prompt-chips">
              {starters.map((prompt) => (
                <button
                  key={prompt}
                  type="button"
                  className="prompt-chip"
                  onClick={() => submitPrompt(prompt)}
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
                    if (part.type === "text") {
                      return (
                        <ReactMarkdown key={`${message.id}-${index}`} remarkPlugins={[remarkGfm]}>
                          {part.text}
                        </ReactMarkdown>
                      );
                    }
                    if (isToolUIPart(part)) {
                      return (
                        <pre key={`${message.id}-${index}`}>
                          {part.type.replace("tool-", "")} · {part.state}
                        </pre>
                      );
                    }
                    return null;
                  })}
                </div>
                {message.role === "assistant" && !busy ? (
                  <div className="learn-actions">
                    <button
                      type="button"
                      className="ghost-btn"
                      title="Good — learn this"
                      onClick={() => void rateAssistant(message.id, "up")}
                    >
                      <ThumbsUp size={12} />
                    </button>
                    <button
                      type="button"
                      className="ghost-btn"
                      title="Bad — teach a better answer"
                      onClick={() => void rateAssistant(message.id, "down")}
                    >
                      <ThumbsDown size={12} />
                    </button>
                  </div>
                ) : null}
              </div>
            </article>
          ))
        )}
        {error ? (
          <div className="pane-error">
            {error.message}
            <div className="muted">
              Tip: use Ollama / Helix Own FT or set cloud API keys in <code>.env</code>.
            </div>
          </div>
        ) : null}
        <div ref={bottomRef} />
      </div>

      <form
        className="composer compact"
        onSubmit={(e) => {
          e.preventDefault();
          submitPrompt(input);
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
              submitPrompt(input);
            }
          }}
        />
        <div className="composer-footer">
          <span className="hint">
            Learns from your chats locally
            {learning
              ? ` · ${learning.pendingSinceTrain}/${learning.retrainEvery} until retrain`
              : ""}
          </span>
          <button className="send-btn" type="submit" disabled={busy || !input.trim()}>
            {busy ? "Working…" : "Send"}
          </button>
        </div>
      </form>
    </div>
  );
}
