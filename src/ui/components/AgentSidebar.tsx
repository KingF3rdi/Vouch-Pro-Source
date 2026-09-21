import { useMemo, useState } from "react";
import {
  Search,
  Plus,
  Box,
  SlidersHorizontal,
  MoreHorizontal,
  Settings,
  SquareCode,
  Rocket,
  CandlestickChart,
  Package,
  Trash2,
} from "lucide-react";
import type { AgentMode } from "../../shared/types";

export type AgentSessionItem = {
  id: string;
  title: string;
  updatedAt: string;
  mode: AgentMode;
};

export type AgentPanel = "ide" | "ship" | "host" | "trade";

export function AgentSidebar({
  workspaceLabel,
  sessions,
  sessionId,
  onNew,
  onOpen,
  onDelete,
  onOpenPanel,
  userName = "Helix",
}: {
  workspaceLabel: string;
  sessions: AgentSessionItem[];
  sessionId: string | null;
  onNew: () => void;
  onOpen: (id: string) => void;
  onDelete: (id: string) => void;
  onOpenPanel: (panel: AgentPanel) => void;
  userName?: string;
}) {
  const [query, setQuery] = useState("");
  const [moreOpen, setMoreOpen] = useState(false);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return sessions;
    return sessions.filter((s) => s.title.toLowerCase().includes(q));
  }, [sessions, query]);

  const grouped = useMemo(() => {
    return [{ project: workspaceLabel || "workspace", items: filtered }];
  }, [filtered, workspaceLabel]);

  return (
    <aside className="agent-sidebar">
      <div className="agent-sidebar-top">
        <label className="agent-search">
          <Search size={14} aria-hidden />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Suchen"
            aria-label="Sessions suchen"
          />
        </label>

        <div className="agent-sidebar-actions">
          <button type="button" className="agent-side-btn" onClick={onNew}>
            <Plus size={14} />
            Neu
          </button>
          <button
            type="button"
            className="agent-side-btn"
            onClick={() => onOpenPanel("ship")}
            title="Ship / compile"
          >
            <Package size={14} />
            Ship
          </button>
          <button
            type="button"
            className="agent-side-btn"
            onClick={() => onOpenPanel("host")}
            title="Hosting"
          >
            <Rocket size={14} />
            Host
          </button>
          <button
            type="button"
            className="agent-side-btn"
            onClick={() => onOpenPanel("trade")}
            title="Memecoin paper trading"
          >
            <CandlestickChart size={14} />
            Trade
          </button>
          <div className="agent-more-wrap">
            <button
              type="button"
              className="agent-side-btn"
              onClick={() => setMoreOpen((v) => !v)}
            >
              <MoreHorizontal size={14} />
              Mehr
            </button>
            {moreOpen ? (
              <div className="agent-more-menu">
                <button
                  type="button"
                  onClick={() => {
                    setMoreOpen(false);
                    onOpenPanel("ide");
                  }}
                >
                  <SquareCode size={14} />
                  IDE öffnen
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setMoreOpen(false);
                    onOpenPanel("ship");
                  }}
                >
                  <Box size={14} />
                  Ship Artifacts
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setMoreOpen(false);
                    onOpenPanel("host");
                  }}
                >
                  <SlidersHorizontal size={14} />
                  Hosting anpassen
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setMoreOpen(false);
                    onOpenPanel("trade");
                  }}
                >
                  <CandlestickChart size={14} />
                  Trading
                </button>
              </div>
            ) : null}
          </div>
        </div>
      </div>

      <div className="agent-session-scroll">
        {grouped.map((group) => (
          <div key={group.project} className="agent-project-group">
            <div className="agent-project-label">{group.project}</div>
            {group.items.length === 0 ? (
              <p className="agent-empty-sessions">Keine Sessions</p>
            ) : (
              group.items.map((session) => (
                <div
                  key={session.id}
                  className={`agent-session-row${session.id === sessionId ? " active" : ""}`}
                >
                  <button
                    type="button"
                    className="agent-session-open"
                    onClick={() => onOpen(session.id)}
                    title={session.title}
                  >
                    {session.title}
                  </button>
                  <button
                    type="button"
                    className="agent-session-del"
                    aria-label="Session löschen"
                    onClick={() => onDelete(session.id)}
                  >
                    <Trash2 size={12} />
                  </button>
                </div>
              ))
            )}
          </div>
        ))}
      </div>

      <div className="agent-sidebar-foot">
        <button type="button" className="agent-new-session" onClick={onNew}>
          <Plus size={14} /> New session
        </button>
        <div className="agent-profile">
          <div className="agent-avatar" aria-hidden>
            {userName.slice(0, 1).toUpperCase()}
          </div>
          <div className="agent-profile-text">
            <strong>{userName}</strong>
            <span>Apps · Sites · Games · Mods</span>
          </div>
          <button
            type="button"
            className="agent-gear"
            onClick={() => onOpenPanel("ide")}
            title="IDE"
          >
            <Settings size={16} />
          </button>
        </div>
      </div>
    </aside>
  );
}
