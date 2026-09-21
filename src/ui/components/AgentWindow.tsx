import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport, isToolUIPart, type UIMessage } from "ai";
import { useEffect, useMemo, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import {
  Plus,
  ArrowUp,
  SquareCode,
  ThumbsDown,
  ThumbsUp,
  LoaderCircle,
  ChevronRight,
} from "lucide-react";
import type { AgentSettings, PluginManifest, SkillSummary } from "../../shared/types";
import { AgentSidebar, type AgentSessionItem } from "./AgentSidebar";

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

function toolLabel(part: { type: string; state?: string }) {
  const name = part.type.replace(/^tool-/, "");
  return `${name} · ${part.state ?? "running"}`;
}

const IDE_STARTERS = [
  "Map this repo, then scaffold a clean feature folder and wire it into the app.",
  "Open the main entry files, fix TypeScript errors, and keep the IDE building.",
  "Add a new UI component in the editor, connect it, and verify the build.",
  "Refactor the messiest module — keep diffs small and leave the project compiling.",
];

export function AgentWindow({
  settings,
  helixModelId,
  modelLabel,
  skills,
  plugins,
  activeSkills,
  onOpenIde,
  workspaceLabel,
}: {
  settings: AgentSettings | null;
  helixModelId: string;
  modelLabel: string;
  skills: SkillSummary[];
  plugins: PluginManifest[];
  activeSkills: string[];
  onOpenIde: () => void;
  workspaceLabel: string;
}) {
  const mode = "chat" as const; // IDE build only for now
  const [input, setInput] = useState("");
  const [sessions, setSessions] = useState<AgentSessionItem[]>([]);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [learning, setLearning] = useState<LearningInfo | null>(null);
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const [elapsed, setElapsed] = useState("0s");
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

  const activeTools = useMemo(() => {
    const last = [...messages].reverse().find((m) => m.role === "assistant");
    if (!last) return [] as string[];
    return (last.parts ?? [])
      .filter((p) => isToolUIPart(p))
      .map((p) => toolLabel(p as { type: string; state?: string }));
  }, [messages]);

  const approxTokens = useMemo(() => {
    const chars = messages.reduce((n, m) => n + messageText(m).length, 0);
    return Math.max(0, Math.round(chars / 4));
  }, [messages]);

  useEffect(() => {
    if (busy && !startedAt) setStartedAt(Date.now());
    if (!busy) setStartedAt(null);
  }, [busy, startedAt]);

  useEffect(() => {
    if (!startedAt) {
      setElapsed("0s");
      return;
    }
    const tick = () => {
      const sec = Math.floor((Date.now() - startedAt) / 1000);
      const m = Math.floor(sec / 60);
      const s = sec % 60;
      setElapsed(m > 0 ? `${m}m ${s}s` : `${s}s`);
    };
    tick();
    const id = window.setInterval(tick, 1000);
    return () => window.clearInterval(id);
  }, [startedAt]);

  async function refreshSessions() {
    const res = await fetch(`/api/sessions${qs}`);
    const data = await res.json();
    setSessions(
      (data.sessions ?? []).map((s: AgentSessionItem) => ({
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
        list.map((s: AgentSessionItem) => ({
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

  async function rateAssistant(assistantId: string, rating: "up" | "down") {
    const idx = messages.findIndex((m) => m.id === assistantId);
    if (idx < 0) return;
    const assistant = messages[idx]!;
    const user = [...messages.slice(0, idx)].reverse().find((m) => m.role === "user");
    if (!user) return;
    let correction: string | undefined;
    if (rating === "down") {
      correction =
        window.prompt("Optional: better answer Helix should learn (local only).") || undefined;
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
        body: JSON.stringify(withWorkspace({ messages, mode, skillIds: activeSkills })),
      })
        .then((r) => r.json())
        .then((data) => {
          void refreshSessions();
          if (data.learning?.added) void refreshLearning();
        });
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
  }, [messages, sessionId, status, activeSkills]);

  function submitPrompt(text: string) {
    const trimmed = text.trim();
    if (!trimmed || busy || !sessionId) return;
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

  const activeSession = sessions.find((s) => s.id === sessionId);
  const runningLine = activeTools[activeTools.length - 1];

  return (
    <div className="agent-window">
      <AgentSidebar
        workspaceLabel={workspaceLabel}
        sessions={sessions}
        sessionId={sessionId}
        onNew={() => void createNewSession()}
        onOpen={(id) => void loadSession(id)}
        onDelete={(id) => void removeSession(id)}
        onOpenIde={onOpenIde}
      />

      <section className="agent-main">
        <header className="agent-tabs titlebar-drag">
          <div className="agent-tab-row no-drag">
            {activeSession ? (
              <button type="button" className="agent-tab active">
                {activeSession.title}
              </button>
            ) : (
              <button type="button" className="agent-tab active">
                New agent
              </button>
            )}
            <button type="button" className="agent-tab muted-tab" onClick={onOpenIde}>
              <SquareCode size={13} />
              IDE
            </button>
          </div>
          <div className="agent-scope-pill no-drag">Build in IDE only</div>
        </header>

        <div className="agent-stage">
          {messages.length === 0 ? (
            <div className="agent-empty">
              <h1>Helix Agent</h1>
              <p>
                For now you can only build in the IDE — edit files, scaffold features, fix
                TypeScript, and keep the project compiling. Hosting & trading come later.
              </p>
              <div className="agent-starters">
                {IDE_STARTERS.map((prompt) => (
                  <button
                    key={prompt}
                    type="button"
                    className="agent-starter"
                    onClick={() => submitPrompt(prompt)}
                  >
                    {prompt}
                  </button>
                ))}
              </div>
              <p className="agent-plugins muted">
                Skills: {skills.filter((s) => activeSkills.includes(s.id)).map((s) => s.name).join(", ") || "coding"}
                {plugins.length ? ` · Plugins: ${plugins.map((p) => p.name).join(", ")}` : ""}
              </p>
            </div>
          ) : (
            messages.map((message) => (
              <article
                key={message.id}
                className={`agent-msg ${message.role === "user" ? "user" : "assistant"}`}
              >
                {message.role === "user" ? (
                  <div className="agent-bubble">
                    {(message.parts ?? []).map((part, index) =>
                      part.type === "text" ? (
                        <p key={`${message.id}-${index}`}>{part.text}</p>
                      ) : null
                    )}
                  </div>
                ) : (
                  <div className="agent-assistant-body">
                    <div className="markdown">
                      {(message.parts ?? []).map((part, index) => {
                        if (part.type === "text") {
                          return (
                            <ReactMarkdown
                              key={`${message.id}-${index}`}
                              remarkPlugins={[remarkGfm]}
                            >
                              {part.text}
                            </ReactMarkdown>
                          );
                        }
                        if (isToolUIPart(part)) {
                          return (
                            <div key={`${message.id}-${index}`} className="agent-tool-chip">
                              <LoaderCircle size={12} className={part.state === "output-available" || part.state === "output-error" ? "" : "spin"} />
                              {toolLabel(part as { type: string; state?: string })}
                            </div>
                          );
                        }
                        return null;
                      })}
                    </div>
                    {!busy ? (
                      <div className="learn-actions">
                        <button
                          type="button"
                          className="ghost-btn"
                          title="Good"
                          onClick={() => void rateAssistant(message.id, "up")}
                        >
                          <ThumbsUp size={12} />
                        </button>
                        <button
                          type="button"
                          className="ghost-btn"
                          title="Bad"
                          onClick={() => void rateAssistant(message.id, "down")}
                        >
                          <ThumbsDown size={12} />
                        </button>
                      </div>
                    ) : null}
                  </div>
                )}
              </article>
            ))
          )}

          {error ? (
            <div className="agent-error">
              {error.message}
              <div className="muted">Check model settings in IDE, or set keys in `.env`.</div>
            </div>
          ) : null}
          <div ref={bottomRef} />
        </div>

        {(busy || runningLine) && (
          <div className="agent-status-bar">
            {runningLine ? (
              <div className="agent-running">
                Läuft {runningLine.split(" · ")[0]}…
                <ChevronRight size={14} />
              </div>
            ) : (
              <div className="agent-running">
                <LoaderCircle size={14} className="spin" />
                Agent arbeitet…
              </div>
            )}
            <div className="agent-stats">
              <span>{elapsed}</span>
              <span>·</span>
              <span>{approxTokens} Tokens</span>
              <span>·</span>
              <span>{busy ? "1 laufende Aufgabe" : "Bereit"}</span>
              <span>·</span>
              <span>{busy ? "Tools werden ausgeführt…" : "Idle"}</span>
            </div>
          </div>
        )}

        <form
          className="agent-composer"
          onSubmit={(e) => {
            e.preventDefault();
            submitPrompt(input);
          }}
        >
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Tippe / für Befehle — build in the IDE…"
            rows={2}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                submitPrompt(input);
              }
            }}
          />
          <div className="agent-composer-bar">
            <div className="agent-composer-left">
              <button type="button" className="agent-icon-btn" title="Attach" disabled>
                <Plus size={16} />
              </button>
              <span className="agent-mode-chip">Auto</span>
              <span className="agent-mode-chip soft">IDE build</span>
              {learning?.enabled ? (
                <span className="agent-mode-chip soft" title="Local learning">
                  Learn {learning.totalExamples}
                </span>
              ) : null}
            </div>
            <div className="agent-composer-right">
              <span className="agent-model-chip">{modelLabel}</span>
              <button
                type="submit"
                className="agent-send"
                disabled={busy || !input.trim()}
                aria-label="Send"
              >
                <ArrowUp size={16} />
              </button>
            </div>
          </div>
        </form>
      </section>
    </div>
  );
}
