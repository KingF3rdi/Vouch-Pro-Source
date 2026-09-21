import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport, isToolUIPart } from "ai";
import { useEffect, useMemo, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { PluginManifest, SkillSummary, AgentSettings } from "../shared/types";

const STARTERS = [
  "Map this workspace and tell me what kind of project it is.",
  "Add a small README section explaining how to run Helix locally.",
  "Review the UI and suggest a tighter visual hierarchy.",
];

function messageText(message: { parts?: Array<{ type: string; text?: string }> }) {
  return (message.parts ?? [])
    .filter((part) => part.type === "text" && part.text)
    .map((part) => part.text)
    .join("\n\n");
}

export function App() {
  const [settings, setSettings] = useState<AgentSettings | null>(null);
  const [skills, setSkills] = useState<SkillSummary[]>([]);
  const [plugins, setPlugins] = useState<PluginManifest[]>([]);
  const [activeSkills, setActiveSkills] = useState<string[]>(["coding", "design"]);
  const [input, setInput] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);
  const bodyRef = useRef({
    skillIds: activeSkills,
    provider: undefined as AgentSettings["provider"] | undefined,
    model: undefined as string | undefined,
    workspace: undefined as string | undefined,
  });

  bodyRef.current = {
    skillIds: activeSkills,
    provider: settings?.provider,
    model: settings?.model,
    workspace: settings?.workspace,
  };

  const transport = useMemo(
    () =>
      new DefaultChatTransport({
        api: "/api/chat",
        body: () => bodyRef.current,
      }),
    []
  );

  const { messages, sendMessage, status, error } = useChat({ transport });

  useEffect(() => {
    void Promise.all([
      fetch("/api/settings").then((r) => r.json()),
      fetch("/api/skills").then((r) => r.json()),
      fetch("/api/plugins").then((r) => r.json()),
    ]).then(([settingsData, skillsData, pluginsData]) => {
      setSettings(settingsData);
      setSkills(skillsData.skills ?? []);
      setPlugins(pluginsData.plugins ?? []);
    });
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, status]);

  const busy = status === "submitted" || status === "streaming";

  const workspaceLabel = useMemo(() => {
    if (!settings?.workspace) return "…";
    const parts = settings.workspace.split(/[/\\]/);
    return parts[parts.length - 1] || settings.workspace;
  }, [settings]);

  function toggleSkill(id: string) {
    setActiveSkills((current) =>
      current.includes(id) ? current.filter((x) => x !== id) : [...current, id]
    );
  }

  function submitPrompt(text: string) {
    const trimmed = text.trim();
    if (!trimmed || busy) return;
    void sendMessage({ text: trimmed });
    setInput("");
  }

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-mark">
            <div className="brand-glyph" aria-hidden />
            <h1>Helix</h1>
          </div>
          <p>Local coding agent · Cursor-style chat · plugins & skills on your machine</p>
        </div>

        <section className="side-section">
          <h2>Skills</h2>
          <div className="side-list">
            {skills.map((skill) => {
              const active = activeSkills.includes(skill.id);
              return (
                <button
                  key={skill.id}
                  type="button"
                  className={`side-item${active ? " active" : ""}`}
                  onClick={() => toggleSkill(skill.id)}
                >
                  <strong>{skill.name}</strong>
                  <span>{skill.description}</span>
                </button>
              );
            })}
          </div>
        </section>

        <section className="side-section">
          <h2>Plugins</h2>
          <div className="side-list">
            {plugins.map((plugin) => (
              <div key={plugin.id} className="side-item active">
                <strong>{plugin.name}</strong>
                <span>{plugin.description}</span>
              </div>
            ))}
          </div>
        </section>
      </aside>

      <main className="main">
        <header className="topbar">
          <div className="meta-pills">
            <span className="pill">
              provider <strong>{settings?.provider ?? "…"}</strong>
            </span>
            <span className="pill">
              model <strong>{settings?.model ?? "…"}</strong>
            </span>
            <span className="pill">
              workspace <strong>{workspaceLabel}</strong>
            </span>
          </div>
          {busy ? <div className="status-dot" title="Working" /> : null}
        </header>

        <div className="chat-stage">
          <div className="chat-inner">
            {messages.length === 0 ? (
              <div className="empty-state">
                <h2>Build with a coding agent that stays on your PC.</h2>
                <p>
                  Helix reads your files, edits code, runs terminal commands, and loads
                  design + coding skills — offline-friendly when you use Ollama.
                </p>
                <div className="prompt-chips">
                  {STARTERS.map((prompt) => (
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
                    <div className="role-label">
                      {message.role === "user" ? "You" : "Helix"}
                    </div>
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
                      {!message.parts?.length && messageText(message) ? (
                        <ReactMarkdown remarkPlugins={[remarkGfm]}>
                          {messageText(message)}
                        </ReactMarkdown>
                      ) : null}
                    </div>
                  </div>
                </article>
              ))
            )}
            {error ? (
              <article className="message">
                <div className="avatar assistant">!</div>
                <div className="message-body">
                  <div className="role-label">Error</div>
                  <div className="markdown">
                    <p>{error.message}</p>
                    <p>
                      Tip: start Ollama (`ollama serve` + `ollama pull llama3.2`) or set
                      cloud keys in <code>helix/.env</code>.
                    </p>
                  </div>
                </div>
              </article>
            ) : null}
            <div ref={bottomRef} />
          </div>
        </div>

        <div className="composer-wrap">
          <form
            className="composer"
            onSubmit={(event) => {
              event.preventDefault();
              submitPrompt(input);
            }}
          >
            <textarea
              value={input}
              onChange={(event) => setInput(event.target.value)}
              placeholder="Ask Helix to inspect, design, or ship a change…"
              onKeyDown={(event) => {
                if (event.key === "Enter" && !event.shiftKey) {
                  event.preventDefault();
                  submitPrompt(input);
                }
              }}
            />
            <div className="composer-footer">
              <span className="hint">Enter to send · Shift+Enter for newline</span>
              <button className="send-btn" type="submit" disabled={busy || !input.trim()}>
                {busy ? "Working…" : "Send"}
              </button>
            </div>
          </form>
        </div>
      </main>
    </div>
  );
}
