import { useEffect, useState } from "react";
import { ArrowLeft, CandlestickChart, Package, Rocket, SquareCode } from "lucide-react";
import type { AgentSettings, PluginManifest, SkillSummary } from "../shared/types";
import { FileTree } from "./components/FileTree";
import { EditorPane, type OpenFile } from "./components/EditorPane";
import { AgentWindow } from "./components/AgentWindow";
import { ShipPanel } from "./components/ShipPanel";
import { HostingPanel } from "./components/HostingPanel";
import { TradingPanel } from "./components/TradingPanel";
import { WindowControls, useIsDesktop } from "./components/WindowControls";
import { ModelPicker } from "./components/ModelPicker";
import { WelcomeGate } from "./components/WelcomeGate";
import type { AgentPanel } from "./components/AgentSidebar";

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
  "build-products",
  "games-mods",
  "ship",
  "website-hosting",
  "trading-bot",
];

type ShellView = "agent" | AgentPanel;

const PANEL_META: Record<
  Exclude<ShellView, "agent">,
  { title: string; scope: string }
> = {
  ide: { title: "IDE", scope: "build" },
  ship: { title: "Ship", scope: "compile" },
  host: { title: "Hosting", scope: "deploy" },
  trade: { title: "Trading", scope: "paper" },
};

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
    let cancelled = false;

    // Critical path first — unblock chat/workspace ASAP
    void fetch("/api/project")
      .then((r) => r.json())
      .catch(() => null)
      .then(() => fetch("/api/settings").then((r) => r.json()))
      .then((settingsData) => {
        if (cancelled || !settingsData) return;
        setSettings(settingsData);
        const savedId = settingsData.helixModelId || "helix-free";
        setHelixModelId(savedId);
      });

    void fetch("/api/models")
      .then((r) => r.json())
      .then((modelsData) => {
        if (cancelled) return;
        setFtReady(Boolean(modelsData.ftReady));
        const freeReady = Boolean(modelsData.freeReady);
        setHelixModelId((savedId) => {
          const preferFree =
            freeReady &&
            (savedId === "helix-code" ||
              savedId === "helix-astra" ||
              savedId === "helix-fable") &&
            !modelsData.gatewayConfigured &&
            !modelsData.openaiConfigured &&
            !modelsData.anthropicConfigured;
          const nextId = preferFree ? "helix-free" : savedId;
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
          return nextId;
        });
      });

    // Secondary — does not block first paint / chat ready
    void Promise.all([
      fetch("/api/skills").then((r) => r.json()),
      fetch("/api/plugins").then((r) => r.json()),
      fetch("/api/project/map").then((r) => r.json()),
    ]).then(([skillsData, pluginsData, mapData]) => {
      if (cancelled) return;
      setSkills(skillsData.skills ?? []);
      setPlugins(pluginsData.plugins ?? []);
      setMapSummary(mapData.summary ?? "");
      const ids = new Set([
        ...ESSENTIAL_SKILLS,
        ...((skillsData.skills as SkillSummary[]) ?? []).map((s) => s.id),
      ]);
      setActiveSkills(
        [...ids].filter(
          (id) =>
            ESSENTIAL_SKILLS.includes(id) ||
            ["design", "research", "coding", "ship", "website-hosting", "trading-bot"].includes(id)
        )
      );
    });

    return () => {
      cancelled = true;
    };
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

  function openPanel(panel: AgentPanel) {
    setView(panel);
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
  const panelMeta = view !== "agent" ? PANEL_META[view] : null;

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

      {/* Keep Agent mounted when switching panels — unmounting aborted chat/streams */}
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
            <button type="button" className="pill panel-pill" onClick={() => openPanel("ship")}>
              <Package size={12} /> Ship
            </button>
            <button type="button" className="pill panel-pill" onClick={() => openPanel("host")}>
              <Rocket size={12} /> Host
            </button>
            <button type="button" className="pill panel-pill" onClick={() => openPanel("trade")}>
              <CandlestickChart size={12} /> Trade
            </button>
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
          onOpenPanel={openPanel}
        />
      </div>

      {view !== "agent" ? (
        <div className="shell-layer is-active">
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
                <span className="muted">
                  {" "}
                  · {panelMeta?.title} · {workspaceLabel}
                </span>
              </div>
            </div>
            <nav className="ide-tabs no-drag panel-switch">
              {(
                [
                  ["ide", "IDE", SquareCode],
                  ["ship", "Ship", Package],
                  ["host", "Host", Rocket],
                  ["trade", "Trade", CandlestickChart],
                ] as const
              ).map(([id, label, Icon]) => (
                <button
                  key={id}
                  type="button"
                  className={view === id ? "active" : ""}
                  onClick={() => setView(id)}
                >
                  <Icon size={14} />
                  {label}
                </button>
              ))}
            </nav>
            <div className="meta-pills no-drag">
              <ModelPicker
                selectedId={helixModelId}
                onSelect={(id) => void selectHelixModel(id)}
              />
              <span className="pill">
                scope <strong>{panelMeta?.scope ?? "build"}</strong>
              </span>
            </div>
            <WindowControls />
          </header>

          {view === "ide" ? (
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
          ) : null}

          {view === "ship" ? (
            <div className="ide-body ide-body-only panel-body">
              <ShipPanel
                onAskAgent={(prompt) => {
                  setView("agent");
                  window.dispatchEvent(
                    new CustomEvent("helix:prefill-chat", {
                      detail: {
                        prompt:
                          prompt ||
                          "Detect the build pipeline, compile the project, package the final product, and list artifacts.",
                      },
                    })
                  );
                }}
              />
            </div>
          ) : null}

          {view === "host" ? (
            <div className="ide-body ide-body-only panel-body">
              <HostingPanel
                onAskAgent={(prompt) => {
                  setView("agent");
                  window.dispatchEvent(
                    new CustomEvent("helix:prefill-chat", { detail: { prompt } })
                  );
                }}
              />
            </div>
          ) : null}

          {view === "trade" ? (
            <div className="ide-body ide-body-only panel-body">
              <TradingPanel
                onAskAgent={(prompt) => {
                  setView("agent");
                  window.dispatchEvent(
                    new CustomEvent("helix:prefill-chat", { detail: { prompt } })
                  );
                }}
              />
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
