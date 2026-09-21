import { useEffect, useState } from "react";
import { Bug, Eye, FolderGit2, Globe, Package, Plug, Rocket, SquareCode, CandlestickChart } from "lucide-react";
import type { AgentMode, AgentSettings, IdeTab, PluginManifest, SkillSummary } from "../shared/types";
import { FileTree } from "./components/FileTree";
import { EditorPane, type OpenFile } from "./components/EditorPane";
import { ChatPanel } from "./components/ChatPanel";
import { BrowserPanel, PreviewPanel } from "./components/FramePanels";
import { GitHubPanel } from "./components/GitHubPanel";
import { McpPanel } from "./components/McpPanel";
import { ShipPanel } from "./components/ShipPanel";
import { HostingPanel } from "./components/HostingPanel";
import { TradingPanel } from "./components/TradingPanel";
import { WindowControls, useIsDesktop } from "./components/WindowControls";
import { ModelPicker } from "./components/ModelPicker";
import { WelcomeGate } from "./components/WelcomeGate";

const ESSENTIAL_SKILLS = [
  "coding",
  "debugging",
  "testing",
  "refactor",
  "docs",
  "security",
  "git-workflow",
  "complex-projects",
  "code-quality",
  "agent-curriculum",
];

export function App() {
  const isDesktop = useIsDesktop();
  const [settings, setSettings] = useState<AgentSettings | null>(null);
  const [skills, setSkills] = useState<SkillSummary[]>([]);
  const [plugins, setPlugins] = useState<PluginManifest[]>([]);
  const [activeSkills, setActiveSkills] = useState(ESSENTIAL_SKILLS);
  const [helixModelId, setHelixModelId] = useState("helix-free");
  const [mode, setMode] = useState<AgentMode>("chat");
  const [tab, setTab] = useState<IdeTab>("editor");
  const [files, setFiles] = useState<OpenFile[]>([]);
  const [activePath, setActivePath] = useState<string | null>(null);
  const [showDiff, setShowDiff] = useState(false);
  const [previewUrl, setPreviewUrl] = useState("http://127.0.0.1:5173");
  const [browserUrl, setBrowserUrl] = useState(
    "https://github.com/search?q=coding+agent+ide&type=repositories"
  );
  const [mapSummary, setMapSummary] = useState<string>("");
  const [ftReady, setFtReady] = useState(false);
  const [showMoreTabs, setShowMoreTabs] = useState(false);

  useEffect(() => {
    void Promise.all([
      fetch("/api/settings").then((r) => r.json()),
      fetch("/api/skills").then((r) => r.json()),
      fetch("/api/plugins").then((r) => r.json()),
      fetch("/api/project/map").then((r) => r.json()),
      fetch("/api/models").then((r) => r.json()),
    ]).then(([settingsData, skillsData, pluginsData, mapData, modelsData]) => {
      setSettings(settingsData);
      if (settingsData.helixModelId) setHelixModelId(settingsData.helixModelId);
      else setHelixModelId("helix-free");
      setSkills(skillsData.skills ?? []);
      setPlugins(pluginsData.plugins ?? []);
      setMapSummary(mapData.summary ?? "");
      setFtReady(Boolean(modelsData.ftReady));
      // Keep essential skills on by default; merge any known ids
      const ids = new Set([
        ...ESSENTIAL_SKILLS,
        ...((skillsData.skills as SkillSummary[]) ?? []).map((s) => s.id),
      ]);
      setActiveSkills([...ids].filter((id) => ESSENTIAL_SKILLS.includes(id) || ["design", "research", "ship", "coding"].includes(id)));
    });
  }, []);

  async function selectHelixModel(id: string) {
    setHelixModelId(id);
    await fetch("/api/models/selected", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ modelId: id }),
    });
    const settingsData = await fetch("/api/settings").then((r) => r.json());
    setSettings(settingsData);
  }

  async function openFile(path: string) {
    const existing = files.find((f) => f.path === path);
    if (existing) {
      setActivePath(path);
      setTab("editor");
      return;
    }
    const [fileRes, diffRes] = await Promise.all([
      fetch(`/api/fs/file?path=${encodeURIComponent(path)}`),
      fetch(`/api/git/diff?path=${encodeURIComponent(path)}`),
    ]);
    const data = await fileRes.json();
    const diff = await diffRes.json();
    if (data.error) return;
    const next: OpenFile = {
      path,
      content: data.content ?? "",
      savedContent: data.content ?? "",
      originalContent: diff.original ?? data.content ?? "",
    };
    setFiles((prev) => [...prev, next]);
    setActivePath(path);
    setTab("editor");
  }

  async function saveFile(path: string) {
    const file = files.find((f) => f.path === path);
    if (!file) return;
    const res = await fetch("/api/fs/file", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ path, content: file.content }),
    });
    if (!res.ok) return;
    setFiles((prev) =>
      prev.map((f) => (f.path === path ? { ...f, savedContent: f.content } : f))
    );
  }

  function closeFile(path: string) {
    setFiles((prev) => {
      const next = prev.filter((f) => f.path !== path);
      if (activePath === path) {
        setActivePath(next[next.length - 1]?.path ?? null);
      }
      return next;
    });
  }

  function toggleSkill(id: string) {
    setActiveSkills((current) =>
      current.includes(id) ? current.filter((x) => x !== id) : [...current, id]
    );
  }

  const workspaceLabel = settings?.workspace?.split(/[/\\]/).pop() || "workspace";

  return (
    <div className={`ide-shell${isDesktop ? " is-desktop" : ""}${isDesktop && window.helixDesktop?.platform === "darwin" ? " is-mac" : ""}`}>
      <WelcomeGate
        trained={ftReady}
        onStart={() => {
          setTab("editor");
          setMode("chat");
          void selectHelixModel("helix-free");
        }}
      />
      <header className="ide-topbar titlebar-drag">
        <div className="brand-mark no-drag">
          <div className="brand-glyph" aria-hidden />
          <div>
            <strong>Helix</strong>
            <span className="muted"> · {workspaceLabel}</span>
          </div>
        </div>
        <div className="meta-pills no-drag">
          <ModelPicker selectedId={helixModelId} onSelect={(id) => void selectHelixModel(id)} />
          {ftReady ? (
            <span className="pill">
              weights <strong>LoRA</strong>
            </span>
          ) : null}
          {isDesktop ? (
            <span className="pill">
              shell <strong>desktop</strong>
            </span>
          ) : null}
        </div>
        <nav className="ide-tabs no-drag">
          {(
            [
              ["editor", "Editor", SquareCode],
              ["ship", "Ship", Package],
              ["host", "Host", Rocket],
              ["trade", "Trade", CandlestickChart],
              ...(showMoreTabs
                ? ([
                    ["preview", "Preview", Eye],
                    ["browser", "Browser", Globe],
                    ["bugs", "Bugs", Bug],
                    ["github", "GitHub", FolderGit2],
                    ["mcp", "MCP", Plug],
                  ] as const)
                : []),
            ] as const
          ).map(([id, label, Icon]) => (
            <button
              key={id}
              type="button"
              className={tab === id ? "active" : ""}
              onClick={() => {
                setTab(id as IdeTab);
                if (id === "bugs") setMode("bug-hunt");
                if (id === "ship") setMode("ship");
              }}
            >
              <Icon size={14} />
              {label}
            </button>
          ))}
          <button
            type="button"
            className="ghost-btn tab-more"
            onClick={() => setShowMoreTabs((v) => !v)}
          >
            {showMoreTabs ? "Weniger" : "Mehr"}
          </button>
        </nav>
        <WindowControls />
      </header>

      <div className="ide-body">
        <aside className="ide-left">
          <FileTree onOpenFile={(path) => void openFile(path)} activePath={activePath} />
          <div className="map-card">
            <div className="pane-label">Project map</div>
            <pre>{mapSummary || "Loading map…"}</pre>
          </div>
        </aside>

        <section className="ide-center">
          {tab === "editor" ? (
            <EditorPane
              files={files}
              activePath={activePath}
              onSelect={setActivePath}
              onClose={closeFile}
              onChange={(path, value) =>
                setFiles((prev) => prev.map((f) => (f.path === path ? { ...f, content: value } : f)))
              }
              onSave={(path) => void saveFile(path)}
              showDiff={showDiff}
              onToggleDiff={() => setShowDiff((v) => !v)}
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
                Agent mode is Bug hunt. It maps the project, checks known issues online, isolates
                root causes, patches, and verifies.
              </p>
            </div>
          ) : null}
          {tab === "github" ? <GitHubPanel /> : null}
          {tab === "mcp" ? <McpPanel /> : null}
          {tab === "ship" ? (
            <ShipPanel onAskAgent={() => setMode("ship")} />
          ) : null}
          {tab === "host" ? (
            <HostingPanel
              onAskAgent={(prompt) => {
                setMode("chat");
                window.dispatchEvent(new CustomEvent("helix:prefill-chat", { detail: { prompt } }));
              }}
            />
          ) : null}
          {tab === "trade" ? <TradingPanel /> : null}
        </section>

        <aside className="ide-right">
          <ChatPanel
            settings={settings}
            helixModelId={helixModelId}
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
