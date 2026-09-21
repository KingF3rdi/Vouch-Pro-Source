import { useEffect, useState } from "react";
import { Bug, Eye, FolderGit2, Globe, SquareCode } from "lucide-react";
import type { AgentMode, AgentSettings, IdeTab, PluginManifest, SkillSummary } from "../shared/types";
import { FileTree } from "./components/FileTree";
import { EditorPane } from "./components/EditorPane";
import { ChatPanel } from "./components/ChatPanel";
import { BrowserPanel, PreviewPanel } from "./components/FramePanels";
import { GitHubPanel } from "./components/GitHubPanel";

export function App() {
  const [settings, setSettings] = useState<AgentSettings | null>(null);
  const [skills, setSkills] = useState<SkillSummary[]>([]);
  const [plugins, setPlugins] = useState<PluginManifest[]>([]);
  const [activeSkills, setActiveSkills] = useState(["coding", "design", "research"]);
  const [mode, setMode] = useState<AgentMode>("chat");
  const [tab, setTab] = useState<IdeTab>("editor");
  const [openPath, setOpenPath] = useState<string | null>(null);
  const [fileContent, setFileContent] = useState("");
  const [savedContent, setSavedContent] = useState("");
  const [previewUrl, setPreviewUrl] = useState("http://127.0.0.1:5173");
  const [browserUrl, setBrowserUrl] = useState("https://github.com/search?q=coding+agent+ide&type=repositories");
  const [mapSummary, setMapSummary] = useState<string>("");

  useEffect(() => {
    void Promise.all([
      fetch("/api/settings").then((r) => r.json()),
      fetch("/api/skills").then((r) => r.json()),
      fetch("/api/plugins").then((r) => r.json()),
      fetch("/api/project/map").then((r) => r.json()),
    ]).then(([settingsData, skillsData, pluginsData, mapData]) => {
      setSettings(settingsData);
      setSkills(skillsData.skills ?? []);
      setPlugins(pluginsData.plugins ?? []);
      setMapSummary(mapData.summary ?? "");
    });
  }, []);

  async function openFile(path: string) {
    const res = await fetch(`/api/fs/file?path=${encodeURIComponent(path)}`);
    const data = await res.json();
    if (data.error) return;
    setOpenPath(path);
    setFileContent(data.content ?? "");
    setSavedContent(data.content ?? "");
    setTab("editor");
  }

  async function saveFile() {
    if (!openPath) return;
    const res = await fetch("/api/fs/file", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ path: openPath, content: fileContent }),
    });
    if (res.ok) setSavedContent(fileContent);
  }

  function toggleSkill(id: string) {
    setActiveSkills((current) =>
      current.includes(id) ? current.filter((x) => x !== id) : [...current, id]
    );
  }

  const dirty = openPath !== null && fileContent !== savedContent;
  const workspaceLabel = settings?.workspace?.split(/[/\\]/).pop() || "workspace";

  return (
    <div className="ide-shell">
      <header className="ide-topbar">
        <div className="brand-mark">
          <div className="brand-glyph" aria-hidden />
          <div>
            <strong>Helix</strong>
            <span className="muted"> IDE · {workspaceLabel}</span>
          </div>
        </div>
        <div className="meta-pills">
          <span className="pill">
            provider <strong>{settings?.provider ?? "…"}</strong>
          </span>
          <span className="pill">
            model <strong>{settings?.model ?? "…"}</strong>
          </span>
        </div>
        <nav className="ide-tabs">
          {(
            [
              ["editor", "Editor", SquareCode],
              ["preview", "Preview", Eye],
              ["browser", "Browser", Globe],
              ["bugs", "Bug hunt", Bug],
              ["github", "GitHub", FolderGit2],
            ] as const
          ).map(([id, label, Icon]) => (
            <button
              key={id}
              type="button"
              className={tab === id ? "active" : ""}
              onClick={() => {
                setTab(id);
                if (id === "bugs") setMode("bug-hunt");
                if (id === "editor" && mode === "bug-hunt") setMode("chat");
              }}
            >
              <Icon size={14} />
              {label}
            </button>
          ))}
        </nav>
      </header>

      <div className="ide-body">
        <aside className="ide-left">
          <FileTree onOpenFile={(path) => void openFile(path)} activePath={openPath} />
          <div className="map-card">
            <div className="pane-label">Project map</div>
            <pre>{mapSummary || "Loading map…"}</pre>
          </div>
        </aside>

        <section className="ide-center">
          {tab === "editor" ? (
            <EditorPane
              path={openPath}
              value={fileContent}
              onChange={setFileContent}
              onSave={() => void saveFile()}
              dirty={dirty}
            />
          ) : null}
          {tab === "preview" ? (
            <PreviewPanel url={previewUrl} onUrlChange={setPreviewUrl} />
          ) : null}
          {tab === "browser" ? (
            <BrowserPanel url={browserUrl} onUrlChange={setBrowserUrl} />
          ) : null}
          {tab === "bugs" ? (
            <div className="side-panel bugs-hero">
              <div className="pane-label">Bug hunt</div>
              <h2>Hunt defects like a senior engineer</h2>
              <p>
                Switch the agent to Bug hunt mode (already on). It maps the project, searches for
                known issues online, isolates root causes, patches, and verifies.
              </p>
              <p className="muted">Use the chat on the right to start a hunt.</p>
            </div>
          ) : null}
          {tab === "github" ? <GitHubPanel /> : null}
        </section>

        <aside className="ide-right">
          <ChatPanel
            settings={settings}
            mode={mode}
            onModeChange={setMode}
            skills={skills}
            plugins={plugins}
            activeSkills={activeSkills}
            onToggleSkill={toggleSkill}
          />
        </aside>
      </div>
    </div>
  );
}
