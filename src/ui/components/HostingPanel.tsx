import { useEffect, useState } from "react";
import { Globe, ShieldCheck, MousePointerClick } from "lucide-react";

type HostingStatus = {
  allowCredentialedSetup: boolean;
  preferredHost: string;
  hasVercelToken: boolean;
  hasNetlifyToken: boolean;
  hasCloudflareToken: boolean;
  hasCloudflareAccountId: boolean;
  session: {
    mode: string;
    provider: string;
    status: string;
    message: string;
    url?: string;
    steps?: string[];
    loginUrl?: string;
  } | null;
};

export function HostingPanel({ onAskAgent }: { onAskAgent?: (prompt: string) => void }) {
  const [status, setStatus] = useState<HostingStatus | null>(null);
  const [allow, setAllow] = useState(false);
  const [preferredHost, setPreferredHost] = useState("auto");
  const [vercelToken, setVercelToken] = useState("");
  const [netlifyToken, setNetlifyToken] = useState("");
  const [cloudflareToken, setCloudflareToken] = useState("");
  const [cloudflareAccountId, setCloudflareAccountId] = useState("");
  const [log, setLog] = useState("");
  const [busy, setBusy] = useState(false);

  async function refresh() {
    const res = await fetch("/api/hosting/status");
    const data = (await res.json()) as HostingStatus;
    setStatus(data);
    setAllow(Boolean(data.allowCredentialedSetup));
    setPreferredHost(data.preferredHost || "auto");
  }

  useEffect(() => {
    void refresh();
  }, []);

  async function saveSettings(extra: Record<string, unknown> = {}) {
    setBusy(true);
    setLog("");
    try {
      const res = await fetch("/api/hosting/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          allowCredentialedSetup: allow,
          preferredHost,
          vercelToken: vercelToken.trim() || undefined,
          netlifyToken: netlifyToken.trim() || undefined,
          cloudflareToken: cloudflareToken.trim() || undefined,
          cloudflareAccountId: cloudflareAccountId.trim() || undefined,
          ...extra,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Save failed");
      setVercelToken("");
      setNetlifyToken("");
      setCloudflareToken("");
      setLog("Hosting settings saved locally (.helix/secrets.json).");
      await refresh();
    } catch (e) {
      setLog(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  async function start(mode: "credentialed" | "assisted") {
    setBusy(true);
    setLog(mode === "assisted" ? "Opening host login on your PC…" : "Deploying with allowed tokens…");
    try {
      const res = await fetch("/api/hosting/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode, provider: preferredHost }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Start failed");
      setLog(JSON.stringify(data, null, 2));
      await refresh();
    } catch (e) {
      setLog(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  async function confirmLogin() {
    setBusy(true);
    try {
      const res = await fetch("/api/hosting/confirm-login", { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Confirm failed");
      const cont = await fetch("/api/hosting/assisted-deploy", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "{}",
      });
      const contData = await cont.json();
      setLog(JSON.stringify({ confirm: data, deploy: contData }, null, 2));
      await refresh();
    } catch (e) {
      setLog(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="side-panel">
      <div className="pane-label">Host website</div>
      <p className="panel-copy">
        Helix can put your site live in two ways: <strong>credentialed</strong> (uses tokens you
        allow) or <strong>assisted</strong> (opens the host on your PC — you log in, Helix clicks
        through).
      </p>

      <div className="status-card" style={{ marginBottom: "0.75rem" }}>
        <label className="host-allow">
          <input
            type="checkbox"
            checked={allow}
            onChange={(e) => setAllow(e.target.checked)}
          />
          <span>
            <ShieldCheck size={14} /> Allow credentialed host setup
          </span>
        </label>
        <p className="muted" style={{ margin: "0.35rem 0 0" }}>
          Tokens only — never account passwords. Stored locally in <code>.helix/secrets.json</code>.
        </p>
      </div>

      <div className="stack-form">
        <label className="muted">Preferred host</label>
        <select value={preferredHost} onChange={(e) => setPreferredHost(e.target.value)}>
          <option value="auto">Auto (Helix chooses)</option>
          <option value="vercel">Vercel</option>
          <option value="netlify">Netlify</option>
          <option value="cloudflare-pages">Cloudflare Pages</option>
          <option value="github-pages">GitHub Pages</option>
        </select>

        <input
          type="password"
          placeholder={status?.hasVercelToken ? "Vercel token (saved · paste to replace)" : "Vercel token (optional)"}
          value={vercelToken}
          onChange={(e) => setVercelToken(e.target.value)}
        />
        <input
          type="password"
          placeholder={status?.hasNetlifyToken ? "Netlify token (saved · paste to replace)" : "Netlify token (optional)"}
          value={netlifyToken}
          onChange={(e) => setNetlifyToken(e.target.value)}
        />
        <input
          type="password"
          placeholder={status?.hasCloudflareToken ? "Cloudflare token (saved)" : "Cloudflare API token (optional)"}
          value={cloudflareToken}
          onChange={(e) => setCloudflareToken(e.target.value)}
        />
        <input
          placeholder={status?.hasCloudflareAccountId ? "CF account id (saved)" : "Cloudflare account id (optional)"}
          value={cloudflareAccountId}
          onChange={(e) => setCloudflareAccountId(e.target.value)}
        />
        <button type="button" className="send-btn" disabled={busy} onClick={() => void saveSettings()}>
          Save hosting settings
        </button>
      </div>

      <div className="host-actions">
        <button
          type="button"
          className="send-btn"
          disabled={busy || !allow}
          title={!allow ? "Enable allow first" : "Deploy with saved tokens"}
          onClick={() => void start("credentialed")}
        >
          <Globe size={14} /> Auto setup (tokens)
        </button>
        <button
          type="button"
          className="send-btn"
          disabled={busy}
          onClick={() => void start("assisted")}
        >
          <MousePointerClick size={14} /> Assisted (I log in)
        </button>
        <button
          type="button"
          className="ghost-btn"
          disabled={busy || status?.session?.status !== "awaiting-login"}
          onClick={() => void confirmLogin()}
        >
          I&apos;m logged in — continue
        </button>
      </div>

      {status?.session ? (
        <div className="status-card" style={{ marginTop: "0.75rem" }}>
          <div>
            Session: <strong>{status.session.provider}</strong> · {status.session.mode} ·{" "}
            {status.session.status}
          </div>
          <div className="muted">{status.session.message}</div>
          {status.session.url ? (
            <div>
              Live:{" "}
              <a href={status.session.url} target="_blank" rel="noreferrer">
                {status.session.url}
              </a>
            </div>
          ) : null}
          {status.session.steps?.length ? (
            <ol className="host-steps">
              {status.session.steps.map((step) => (
                <li key={step}>{step}</li>
              ))}
            </ol>
          ) : null}
        </div>
      ) : null}

      <div className="stack-form" style={{ marginTop: "0.75rem" }}>
        <button
          type="button"
          className="ghost-btn"
          onClick={() =>
            onAskAgent?.(
              "Set up this website on a host. Prefer assisted mode unless I already allowed credentialed tokens. Recommend a host, then run the hosting tools end-to-end."
            )
          }
        >
          Ask Helix to host this site
        </button>
      </div>

      {log ? <pre className="panel-log">{log}</pre> : null}
    </div>
  );
}
