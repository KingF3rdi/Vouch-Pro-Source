import { useChat } from "@ai-sdk/react";
import {
  DefaultChatTransport,
  isReasoningUIPart,
  isToolOrDynamicToolUIPart,
  isToolUIPart,
  type UIMessage,
} from "ai";
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
} from "lucide-react";
import type { AgentSettings, PluginManifest, SkillSummary } from "../../shared/types";
import { AgentSidebar, type AgentSessionItem } from "./AgentSidebar";
import {
  summarizeToolActivity,
  ToolFeedbackCard,
  type ToolPartLike,
} from "./ToolFeedback";

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

function asToolPart(part: unknown): ToolPartLike {
  const p = part as ToolPartLike;
  return p;
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
  const loadingSessionRef = useRef(false);
  const skipEmptySaveRef = useRef(false);
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

  // Stable chat id — tying useChat to sessionId remounts and wipes messages
  // when switching sessions / after ensureSession, so the chat looked empty.
  const chatInstanceId = useRef(`helix-${crypto.randomUUID()}`);

  const { messages, sendMessage, status, error, setMessages, stop } = useChat({
    id: chatInstanceId.current,
    transport,
  });
  const busy = status === "submitted" || status === "streaming";

  const lastAssistant = useMemo(
    () => [...messages].reverse().find((m) => m.role === "assistant"),
    [messages]
  );

  const activity = useMemo(() => {
    const parts = (lastAssistant?.parts ?? [])
      .filter((p) => isToolOrDynamicToolUIPart(p) || isToolUIPart(p))
      .map((p) => asToolPart(p));
    return summarizeToolActivity(parts);
  }, [lastAssistant]);

  const approxTokens = useMemo(() => {
    const chars = messages.reduce((n, m) => n + messageText(m).length, 0);
    return Math.max(0, Math.round(chars / 4));
  }, [messages]);

  const phaseLabel = useMemo(() => {
    if (!busy) return "Bereit";
    if (status === "submitted" && !lastAssistant) return "Anfrage gesendet…";
    if (activity.running.length) return activity.label;
    if (lastAssistant && messageText(lastAssistant)) return "Schreibt Antwort…";
    return activity.label || "Denkt nach…";
  }, [busy, status, lastAssistant, activity]);

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
    if (busy) {
      try {
        stop();
      } catch {
        // ignore
      }
    }
    const res = await fetch("/api/sessions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(withWorkspace({ mode, skillIds: activeSkills })),
    });
    const data = await res.json();
    setMessages([]);
    setSessionId(data.session.id);
    await refreshSessions();
  }

  async function loadSession(id: string) {
    loadingSessionRef.current = true;
    skipEmptySaveRef.current = true;
    try {
      const res = await fetch(`/api/sessions/${id}${qs}`);
      const data = await res.json();
      if (!data.session) return;
      if (busy) {
        try {
          stop();
        } catch {
          // ignore
        }
      }
      const loaded = (data.session.messages as UIMessage[]) ?? [];
      setSessionId(data.session.id);
      setMessages(loaded);
      lastLearnedCount.current = loaded.length;
    } finally {
      window.setTimeout(() => {
        loadingSessionRef.current = false;
        skipEmptySaveRef.current = false;
      }, 500);
    }
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
    if (!settings?.workspace) return;
    void ensureSession();
    void refreshLearning();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workspace]);

  // Don't start chats until settings (workspace + model) are loaded
  const chatReady = Boolean(settings?.workspace && sessionId);

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
    if (loadingSessionRef.current) return;
    // Don't overwrite a loaded session with empty messages during switch
    if (skipEmptySaveRef.current && messages.length === 0) return;
    if (saveTimer.current) window.clearTimeout(saveTimer.current);
    saveTimer.current = window.setTimeout(() => {
      if (loadingSessionRef.current) return;
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
    if (!trimmed || busy || !chatReady) return;
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
  const toolCount =
    (lastAssistant?.parts ?? []).filter((p) => isToolOrDynamicToolUIPart(p) || isToolUIPart(p))
      .length;

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
          <div className="agent-scope-pill no-drag">
            {busy ? (
              <>
                <LoaderCircle size={12} className="spin" />
                {phaseLabel}
              </>
            ) : (
              "Build in IDE only"
            )}
          </div>
        </header>

        <div className="agent-stage">
          {messages.length === 0 ? (
            <div className="agent-empty">
              <h1>Helix Agent</h1>
              <p>
                For now you can only build in the IDE — edit files, scaffold features, fix
                TypeScript, and keep the project compiling. Hosting & trading come later.
              </p>
              {settings?.workspace ? (
                <p className="agent-workspace-path muted">
                  Project folder: <code>{settings.workspace}</code>
                </p>
              ) : null}
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
            messages.map((message, messageIndex) => {
              const isLastAssistant =
                message.role === "assistant" && messageIndex === messages.length - 1;
              return (
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
                    <div className="markdown agent-stream">
                      {(message.parts ?? []).map((part, index) => {
                        if (part.type === "text") {
                          const streamingTail =
                            busy && isLastAssistant && index === (message.parts?.length ?? 0) - 1;
                          return (
                            <div key={`${message.id}-${index}`} className="agent-text-block">
                              <ReactMarkdown remarkPlugins={[remarkGfm]}>
                                {part.text}
                              </ReactMarkdown>
                              {streamingTail ? <span className="stream-caret" aria-hidden /> : null}
                            </div>
                          );
                        }
                        if (isReasoningUIPart(part)) {
                          return (
                            <div key={`${message.id}-${index}`} className="agent-reasoning">
                              <div className="agent-reasoning-label">Thinking</div>
                              <pre>{part.text}</pre>
                            </div>
                          );
                        }
                        if (isToolOrDynamicToolUIPart(part) || isToolUIPart(part)) {
                          return (
                            <ToolFeedbackCard
                              key={`${message.id}-${index}`}
                              part={asToolPart(part)}
                              defaultOpen={
                                busy &&
                                isLastAssistant &&
                                (part.state === "input-streaming" ||
                                  part.state === "input-available")
                              }
                            />
                          );
                        }
                        if (part.type === "step-start") {
                          return (
                            <div key={`${message.id}-${index}`} className="agent-step-mark">
                              Step
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
              );
            })
          )}

          {error ? (
            <div className="agent-error">
              {error.message || "Chat failed"}
              <div className="muted">
                Model: {modelLabel}. Prefer <strong>Helix Own</strong> (local). For cloud models set
                keys in <code>.env</code>. Switching Agent ↔ IDE no longer resets the chat.
              </div>
            </div>
          ) : null}

          {!settings ? (
            <div className="agent-thinking-pulse">
              <LoaderCircle size={14} className="spin" />
              <span>Loading workspace…</span>
            </div>
          ) : null}

          {busy &&
          (!lastAssistant ||
            !(lastAssistant.parts ?? []).some(
              (p) =>
                p.type === "text" ||
                isToolUIPart(p) ||
                isToolOrDynamicToolUIPart(p) ||
                isReasoningUIPart(p)
            )) ? (
            <div className="agent-thinking-pulse">
              <LoaderCircle size={14} className="spin" />
              <span>{phaseLabel}</span>
              <span className="thinking-dots" aria-hidden>
                <i />
                <i />
                <i />
              </span>
            </div>
          ) : null}
          <div ref={bottomRef} />
        </div>

        {busy || toolCount > 0 ? (
          <div className={`agent-status-bar${busy ? " is-live" : ""}`}>
            <div className="agent-running">
              {busy ? <LoaderCircle size={14} className="spin" /> : null}
              <span>{phaseLabel}</span>
            </div>
            <div className="agent-stats">
              <span>{elapsed}</span>
              <span>·</span>
              <span>{approxTokens} Tokens</span>
              <span>·</span>
              <span>
                {toolCount} Tool{toolCount === 1 ? "" : "s"}
                {activity.done ? ` · ${activity.done} ok` : ""}
                {activity.failed ? ` · ${activity.failed} fehlgeschlagen` : ""}
              </span>
              <span>·</span>
              <span>{busy ? "1 laufende Aufgabe" : "Fertig"}</span>
            </div>
            {activity.running.length ? (
              <div className="agent-live-tools">
                {activity.running.map((part, i) => (
                  <span key={`${part.toolCallId ?? i}`} className="agent-live-chip">
                    <LoaderCircle size={11} className="spin" />
                    {(part.toolName || part.type.replace(/^tool-/, "")).slice(0, 28)}
                  </span>
                ))}
              </div>
            ) : null}
          </div>
        ) : null}

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
                disabled={busy || !input.trim() || !chatReady}
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
