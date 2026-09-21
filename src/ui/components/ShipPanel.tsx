import { useEffect, useState } from "react";
import { Package, Play, RefreshCw, Wrench } from "lucide-react";

type Step = { id: string; label: string; command: string; kind: string };
type Artifact = { path: string; size: number; mtime: string };
type StepResult = {
  step?: Step;
  ok?: boolean;
  stderr?: string;
  stdout?: string;
  command?: string;
};

function formatBytes(n: number) {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

export function ShipPanel({
  onAskAgent,
}: {
  onAskAgent?: (prompt?: string) => void;
}) {
  const [steps, setSteps] = useState<Step[]>([]);
  const [notes, setNotes] = useState<string[]>([]);
  const [stack, setStack] = useState<string[]>([]);
  const [artifacts, setArtifacts] = useState<Artifact[]>([]);
  const [log, setLog] = useState("");
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState<{
    step?: Step;
    errorSummary: string;
  } | null>(null);

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
    setFailed(null);
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
      const results = (data.results ?? []) as StepResult[];
      const failedStep = results.find((r) => r.ok === false);
      if (!data.ok || failedStep) {
        const summary =
          data.errorSummary ||
          failedStep?.stderr?.slice(-2000) ||
          failedStep?.stdout?.slice(-1200) ||
          "Build failed";
        const failInfo = {
          step: data.failedStep ?? failedStep?.step,
          errorSummary: String(summary),
        };
        setFailed(failInfo);
        setLog(
          JSON.stringify(
            {
              ok: false,
              failedStep: data.failedStep?.id ?? failedStep?.step?.id,
              errorSummary: String(summary).slice(-800),
              diagnostics: data.diagnostics ?? [],
              steps: results.map((r) => ({
                id: r.step?.id,
                ok: r.ok,
                stderrTail: r.stderr?.slice(-400),
              })),
            },
            null,
            2
          )
        );
        // Auto-hand off to the agent so failed builds get fixed, not left red.
        if (onAskAgent) {
          const stepLabel = failInfo.step?.label || failInfo.step?.command || "build";
          onAskAgent(
            `The ship/build FAILED on “${stepLabel}”. You MUST fix it now: call fix_failed_build, read diagnostics, apply_patch each error, and re-run ship_project until ok:true. Do not stop while mustFix is true.\n\nError:\n${failInfo.errorSummary.slice(-1800)}`
          );
        }
      } else {
        setFailed(null);
        setLog(
          JSON.stringify(
            {
              ok: true,
              steps: results.map((r) => ({
                id: r.step?.id,
                ok: r.ok,
              })),
              artifactCount: data.artifacts?.length ?? 0,
            },
            null,
            2
          )
        );
      }
      await refresh();
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setFailed({ errorSummary: msg });
      setLog(msg);
    } finally {
      setBusy(false);
    }
  }

  function askFix() {
    const stepLabel = failed?.step?.label || failed?.step?.command || "build";
    const err = failed?.errorSummary?.slice(-1800) || "unknown error";
    onAskAgent?.(
      `The ship/build failed on “${stepLabel}”. Fix the code until typecheck and production build succeed, then re-run ship_project.\n\nError:\n${err}`
    );
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

      {failed ? (
        <div className="status-card ship-fail">
          <strong>Build failed</strong>
          {failed.step ? (
            <div className="muted">
              Step: {failed.step.label} · <code>{failed.step.command}</code>
            </div>
          ) : null}
          <pre className="panel-log ship-fail-log">{failed.errorSummary.slice(-1600)}</pre>
          {onAskAgent ? (
            <button type="button" className="send-btn" onClick={askFix}>
              <Wrench size={14} /> Fix with agent
            </button>
          ) : null}
        </div>
      ) : null}

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
        <button
          type="button"
          className="prompt-chip"
          style={{ marginTop: "0.75rem" }}
          onClick={() =>
            onAskAgent(
              "Detect the build pipeline, compile the project, package the final product, and list artifacts. If anything fails, fix it and re-run until ship succeeds."
            )
          }
        >
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
