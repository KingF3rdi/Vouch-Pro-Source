import { useEffect, useState } from "react";
import { Plug, RefreshCw } from "lucide-react";

type McpServer = {
  id: string;
  status: string;
  tools: string[];
  error?: string;
};

export function McpPanel() {
  const [servers, setServers] = useState<McpServer[]>([]);
  const [configText, setConfigText] = useState("");
  const [log, setLog] = useState("");
  const [busy, setBusy] = useState(false);

  async function refresh() {
    const res = await fetch("/api/mcp");
    const data = await res.json();
    setServers(data.servers ?? []);
    setConfigText(JSON.stringify(data.config ?? { mcpServers: {} }, null, 2));
  }

  useEffect(() => {
    void refresh();
  }, []);

  async function reconnect() {
    setBusy(true);
    setLog("");
    try {
      const res = await fetch("/api/mcp/reconnect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      const data = await res.json();
      setServers(data.servers ?? []);
      setLog("Reconnected MCP servers");
    } catch (e) {
      setLog(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  async function saveConfig() {
    setBusy(true);
    setLog("");
    try {
      const config = JSON.parse(configText);
      const res = await fetch("/api/mcp/config", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ config }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Save failed");
      setServers(data.servers ?? []);
      setLog("Saved .helix/mcp.json and reconnected");
    } catch (e) {
      setLog(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="side-panel">
      <div className="pane-label">MCP plugin host</div>
      <p className="panel-copy">
        Connect Model Context Protocol servers from <code>.helix/mcp.json</code>. Helix exposes
        their tools to the agent via <code>mcp_list_servers</code> / <code>mcp_call_tool</code>.
      </p>

      <div className="mcp-list">
        {servers.length === 0 ? (
          <div className="muted">No MCP servers configured yet.</div>
        ) : (
          servers.map((server) => (
            <div key={server.id} className="status-card">
              <div className="mcp-row">
                <Plug size={14} />
                <strong>{server.id}</strong>
                <span className={`mcp-status ${server.status}`}>{server.status}</span>
              </div>
              {server.tools?.length ? (
                <div className="muted">{server.tools.join(", ")}</div>
              ) : null}
              {server.error ? <div className="pane-error">{server.error}</div> : null}
            </div>
          ))
        )}
      </div>

      <div className="stack-form" style={{ marginTop: "1rem" }}>
        <textarea
          className="config-editor"
          value={configText}
          onChange={(e) => setConfigText(e.target.value)}
          spellCheck={false}
        />
        <div className="row-actions">
          <button type="button" className="ghost-btn" disabled={busy} onClick={() => void reconnect()}>
            <RefreshCw size={14} /> Reconnect
          </button>
          <button type="button" className="send-btn" disabled={busy} onClick={() => void saveConfig()}>
            Save config
          </button>
        </div>
      </div>
      {log ? <pre className="panel-log">{log}</pre> : null}
    </div>
  );
}
