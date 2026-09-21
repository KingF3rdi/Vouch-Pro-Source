import { useEffect, useState } from "react";
import { Package, Play, RefreshCw } from "lucide-react";

type Step = { id: string; label: string; command: string; kind: string };
type Artifact = { path: string; size: number; mtime: string };

function formatBytes(n: number) {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

export function ShipPanel({ onAskAgent }: { onAskAgent?: () => void }) {
  const [steps, setSteps] = useState<Step[]>([]);
  const [notes, setNotes] = useState<string[]>([]);
  const [stack, setStack] = useState<string[]>([]);
  const [artifacts, setArtifacts] = useState<Artifact[]>([]);
  const [log, setLog] = useState("");
  const [busy, setBusy] = useState(false);

  async function refresh() {
    const [pipeRes, artRes] = await Promise.all([
      fetch("/api/ship/pipeline"),
      fetch("/api/ship/artifacts"),
    ]);
    const pipeline = await pipeRes.json();
    const arts = await artRes.json();
    setSteps(pipeline.steps ?? []);
    setNotes(pipeline.notes ?? []);
    setStack(pipeline.stack ?? []);
    setArtifacts(arts.artifacts ?? []);
  }

  useEffect(() => {
    void refresh();
  }, []);

  async function runShip() {
    setBusy(true);
    setLog("Shipping… this can take several minutes for installers.");
    try {
      const res = await fetch("/api/ship/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Ship failed");
      setArtifacts(data.artifacts ?? []);
      setLog(
        JSON.stringify(
          {
            ok: data.ok,
            steps: (data.results ?? []).map(
              (r: { step?: { id?: string }; ok?: boolean; stderr?: string }) => ({
                id: r.step?.id,
                ok: r.ok,
                stderrTail: r.stderr?.slice(-400),
              })
            ),
            artifactCount: data.artifacts?.length ?? 0,
          },
          null,
          2
        )
      );
      await refresh();
    } catch (e) {
      setLog(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="side-panel">
      <div className="pane-label">Ship / compile</div>
      <p className="panel-copy">
        Helix detects the build pipeline and compiles the project into a final product (
        <code>dist/</code>, binaries, installers in <code>release/</code>).
      </p>

      <div className="status-card">
        <div>
          Stack: <strong>{stack.join(", ") || "unknown"}</strong>
        </div>
        {notes.map((note) => (
          <div key={note} className="muted">
            {note}
          </div>
        ))}
      </div>

      <div className="mcp-list" style={{ marginTop: "0.85rem" }}>
        {steps.map((step) => (
          <div key={step.id} className="status-card">
            <div className="mcp-row">
              <Package size={14} />
              <strong>{step.label}</strong>
              <span className="mcp-status">{step.kind}</span>
            </div>
            <code className="muted">{step.command}</code>
          </div>
        ))}
      </div>

      <div className="row-actions" style={{ marginTop: "1rem" }}>
        <button type="button" className="ghost-btn" disabled={busy} onClick={() => void refresh()}>
          <RefreshCw size={14} /> Refresh
        </button>
        <button type="button" className="send-btn" disabled={busy} onClick={() => void runShip()}>
          <Play size={14} /> {busy ? "Building…" : "Build final product"}
        </button>
      </div>

      {onAskAgent ? (
        <button type="button" className="prompt-chip" style={{ marginTop: "0.75rem" }} onClick={onAskAgent}>
          Ask the agent to ship (fix errors if build fails)
        </button>
      ) : null}

      <div className="pane-label" style={{ paddingLeft: 0 }}>
        Artifacts
      </div>
      {artifacts.length === 0 ? (
        <div className="muted">No build artifacts yet. Run a ship.</div>
      ) : (
        <div className="artifact-list">
          {artifacts.slice(0, 30).map((a) => (
            <div key={a.path} className="artifact-row">
              <span>{a.path}</span>
              <span className="muted">{formatBytes(a.size)}</span>
            </div>
          ))}
        </div>
      )}

      {log ? <pre className="panel-log">{log}</pre> : null}
    </div>
  );
}
