import { useEffect, useState } from "react";

type GhStatus = {
  connected: boolean;
  user: string | null;
  remote: string | null;
  branch: string | null;
  dirty: boolean;
};

export function GitHubPanel() {
  const [status, setStatus] = useState<GhStatus | null>(null);
  const [token, setToken] = useState("");
  const [message, setMessage] = useState("chore: save work from Helix");
  const [log, setLog] = useState<string>("");
  const [busy, setBusy] = useState(false);

  async function refresh() {
    const res = await fetch("/api/github/status");
    setStatus(await res.json());
  }

  useEffect(() => {
    void refresh();
  }, []);

  async function connect() {
    setBusy(true);
    setLog("");
    try {
      const res = await fetch("/api/github/connect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Connect failed");
      setToken("");
      setStatus(data.status);
      setLog(`Connected as ${data.status.user ?? "user"}`);
    } catch (e) {
      setLog(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  async function commitAndPush() {
    setBusy(true);
    setLog("");
    try {
      const commitRes = await fetch("/api/github/commit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message }),
      });
      const commitData = await commitRes.json();
      if (!commitRes.ok) throw new Error(commitData.error || "Commit failed");

      const pushRes = await fetch("/api/github/push", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      const pushData = await pushRes.json();
      if (!pushRes.ok) throw new Error(pushData.error || "Push failed");

      setLog(
        JSON.stringify({ commit: commitData, push: { branch: pushData.branch, ok: pushData.ok } }, null, 2)
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
      <div className="pane-label">GitHub</div>
      <p className="panel-copy">
        Connect a personal access token (repo scope) for automated commits and pushes. Tokens are
        stored locally in <code>.helix/secrets.json</code>.
      </p>

      {status?.connected ? (
        <div className="status-card">
          <div>
            Connected as <strong>{status.user ?? "GitHub user"}</strong>
          </div>
          <div className="muted">
            {status.branch ?? "no branch"} · {status.remote ?? "no remote"}
            {status.dirty ? " · dirty" : " · clean"}
          </div>
        </div>
      ) : (
        <div className="stack-form">
          <input
            type="password"
            placeholder="ghp_… personal access token"
            value={token}
            onChange={(e) => setToken(e.target.value)}
          />
          <button type="button" className="send-btn" disabled={busy || !token.trim()} onClick={() => void connect()}>
            Connect GitHub
          </button>
        </div>
      )}

      <div className="stack-form" style={{ marginTop: "1rem" }}>
        <input value={message} onChange={(e) => setMessage(e.target.value)} placeholder="Commit message" />
        <button
          type="button"
          className="send-btn"
          disabled={busy || !status?.connected}
          onClick={() => void commitAndPush()}
        >
          Commit & Push
        </button>
      </div>

      {log ? <pre className="panel-log">{log}</pre> : null}
    </div>
  );
}
