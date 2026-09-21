import { useEffect, useState } from "react";
import { ArrowLeft } from "lucide-react";
import type { AgentSettings, PluginManifest, SkillSummary } from "../shared/types";
import { FileTree } from "./components/FileTree";
import { EditorPane, type OpenFile } from "./components/EditorPane";
import { AgentWindow } from "./components/AgentWindow";
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

type ShellView = "agent" | "ide";

export function App() {
  const isDesktop = useIsDesktop();
  const [view, setView] = useState<ShellView>("agent");
  const [settings, setSettings] = useState<AgentSettings | null>(null);
  const [skills, setSkills] = useState<SkillSummary[]>([]);
  const [plugins, setPlugins] = useState<PluginManifest[]>([]);
  const [activeSkills, setActiveSkills] = useState(ESSENTIAL_SKILLS);
  const [helixModelId, setHelixModelId] = useState("helix-free");
  const [modelLabel, setModelLabel] = useState("Helix Own");
  const [files, setFiles] = useState<OpenFile[]>([]);
  const [activePath, setActivePath] = useState<string | null>(null);
  const [showDiff, setShowDiff] = useState(false);
  const [mapSummary, setMapSummary] = useState<string>("");
  const [ftReady, setFtReady] = useState(false);

  useEffect(() => {
    void Promise.all([
      fetch("/api/settings").then((r) => r.json()),
      fetch("/api/skills").then((r) => r.json()),
      fetch("/api/plugins").then((r) => r.json()),
      fetch("/api/project/map").then((r) => r.json()),
      fetch("/api/models").then((r) => r.json()),
    ]).then(([settingsData, skillsData, pluginsData, mapData, modelsData]) => {
      setSettings(settingsData);
      // Prefer Helix Own when free backends are ready — paid models without keys break chat
      const freeReady = Boolean(modelsData.freeReady);
      const savedId = settingsData.helixModelId || "helix-free";
      const preferFree =
        freeReady &&
        (savedId === "helix-code" ||
          savedId === "helix-astra" ||
          savedId === "helix-fable") &&
        !modelsData.gatewayConfigured &&
        !modelsData.openaiConfigured &&
        !modelsData.anthropicConfigured;
      const nextId = preferFree ? "helix-free" : savedId;
      setHelixModelId(nextId);
      if (preferFree) {
        void fetch("/api/models/selected", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ modelId: "helix-free" }),
        });
      }
      const models = modelsData.models ?? [];
      const selected = models.find((m: { id: string }) => m.id === nextId) ?? models[0];
      if (selected?.name) setModelLabel(selected.name);
      setSkills(skillsData.skills ?? []);
      setPlugins(pluginsData.plugins ?? []);
      setMapSummary(mapData.summary ?? "");
      setFtReady(Boolean(modelsData.ftReady));
      const ids = new Set([
        ...ESSENTIAL_SKILLS,
        ...((skillsData.skills as SkillSummary[]) ?? []).map((s) => s.id),
      ]);
      setActiveSkills(
        [...ids].filter(
          (id) => ESSENTIAL_SKILLS.includes(id) || ["design", "research", "coding"].includes(id)
        )
      );
    });
  }, []);

  async function selectHelixModel(id: string) {
    setHelixModelId(id);
    await fetch("/api/models/selected", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ modelId: id }),
    });
    const [settingsData, modelsData] = await Promise.all([
      fetch("/api/settings").then((r) => r.json()),
      fetch("/api/models").then((r) => r.json()),
    ]);
    setSettings(settingsData);
    const selected = (modelsData.models ?? []).find((m: { id: string }) => m.id === id);
    if (selected?.name) setModelLabel(selected.name);
  }

  async function openFile(path: string) {
    const existing = files.find((f) => f.path === path);
    if (existing) {
      setActivePath(path);
      setView("ide");
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
    setView("ide");
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

  const workspaceLabel = settings?.workspace?.split(/[/\\]/).pop() || "workspace";

  return (
    <div
      className={`ide-shell agent-shell${isDesktop ? " is-desktop" : ""}${
        isDesktop && window.helixDesktop?.platform === "darwin" ? " is-mac" : ""
      }`}
    >
      <WelcomeGate
        trained={ftReady}
        onStart={() => {
          setView("agent");
          void selectHelixModel("helix-free");
        }}
      />

      {/* Keep Agent mounted when switching to IDE — unmounting aborted chat/streams */}
      <div className={`shell-layer${view === "agent" ? " is-active" : " is-hidden"}`}>
        <div className="agent-chrome titlebar-drag">
          <div className="brand-mark no-drag">
            <div className="brand-glyph" aria-hidden />
            <div>
              <strong>Helix</strong>
              <span className="muted"> · Agent</span>
            </div>
          </div>
          <div className="meta-pills no-drag">
            <ModelPicker
              selectedId={helixModelId}
              onSelect={(id) => void selectHelixModel(id)}
            />
          </div>
          <WindowControls />
        </div>
        <AgentWindow
          settings={settings}
          helixModelId={helixModelId}
          modelLabel={modelLabel}
          skills={skills}
          plugins={plugins}
          activeSkills={activeSkills}
          workspaceLabel={workspaceLabel}
          onOpenIde={() => setView("ide")}
        />
      </div>

      <div className={`shell-layer${view === "ide" ? " is-active" : " is-hidden"}`}>
        <header className="ide-topbar titlebar-drag">
          <button
            type="button"
            className="ghost-btn no-drag back-agent"
            onClick={() => setView("agent")}
          >
            <ArrowLeft size={14} />
            Agent
          </button>
          <div className="brand-mark no-drag">
            <div className="brand-glyph" aria-hidden />
            <div>
              <strong>Helix</strong>
              <span className="muted"> · IDE · {workspaceLabel}</span>
            </div>
          </div>
          <div className="meta-pills no-drag">
            <ModelPicker
              selectedId={helixModelId}
              onSelect={(id) => void selectHelixModel(id)}
            />
            <span className="pill">
              scope <strong>build</strong>
            </span>
          </div>
          <WindowControls />
        </header>

        <div className="ide-body ide-body-only">
          <aside className="ide-left">
            <FileTree onOpenFile={(path) => void openFile(path)} activePath={activePath} />
            <div className="map-card">
              <div className="pane-label">Project map</div>
              <pre>{mapSummary || "Loading map…"}</pre>
            </div>
          </aside>
          <section className="ide-center">
            <EditorPane
              files={files}
              activePath={activePath}
              onSelect={setActivePath}
              onClose={closeFile}
              onChange={(path, value) =>
                setFiles((prev) =>
                  prev.map((f) => (f.path === path ? { ...f, content: value } : f))
                )
              }
              onSave={(path) => void saveFile(path)}
              showDiff={showDiff}
              onToggleDiff={() => setShowDiff((v) => !v)}
            />
          </section>
        </div>
      </div>
    </div>
  );
}
