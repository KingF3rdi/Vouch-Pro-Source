import { useCallback, useEffect, useState } from "react";
import { ChevronDown, ChevronRight, FileCode2, FilePlus2, Folder, FolderPlus, RefreshCw } from "lucide-react";

type Entry = { name: string; type: "dir" | "file"; path: string };
type GitStatusMap = Record<string, string>;

export function FileTree({
  onOpenFile,
  activePath,
}: {
  onOpenFile: (path: string) => void;
  activePath: string | null;
}) {
  const [root, setRoot] = useState<Entry[]>([]);
  const [expanded, setExpanded] = useState<Record<string, Entry[]>>({});
  const [gitStatus, setGitStatus] = useState<GitStatusMap>({});
  const [error, setError] = useState<string | null>(null);
  const [workspaceAbs, setWorkspaceAbs] = useState<string>("");

  async function refreshGit() {
    const res = await fetch("/api/git/status");
    const data = await res.json();
    const map: GitStatusMap = {};
    for (const file of data.files ?? []) {
      map[file.path] = file.status;
    }
    setGitStatus(map);
  }

  const loadRoot = useCallback(async () => {
    const [treeRes, wsRes] = await Promise.all([
      fetch("/api/fs/tree"),
      fetch("/api/fs/workspace"),
    ]);
    const data = await treeRes.json();
    const ws = await wsRes.json().catch(() => ({}));
    if (data.error) setError(data.error);
    else {
      setError(null);
      setRoot(data.entries ?? []);
    }
    if (ws.workspace) setWorkspaceAbs(ws.workspace);
  }, []);

  useEffect(() => {
    void loadRoot();
    void refreshGit();
    const timer = window.setInterval(() => void refreshGit(), 5000);
    return () => window.clearInterval(timer);
  }, [loadRoot]);

  async function toggleDir(entry: Entry) {
    if (expanded[entry.path]) {
      setExpanded((prev) => {
        const next = { ...prev };
        delete next[entry.path];
        return next;
      });
      return;
    }
    const res = await fetch(`/api/fs/tree?path=${encodeURIComponent(entry.path)}`);
    const data = await res.json();
    setExpanded((prev) => ({ ...prev, [entry.path]: data.entries ?? [] }));
  }

  async function reloadExpanded() {
    const paths = Object.keys(expanded);
    const next: Record<string, Entry[]> = {};
    await Promise.all(
      paths.map(async (p) => {
        const res = await fetch(`/api/fs/tree?path=${encodeURIComponent(p)}`);
        const data = await res.json();
        next[p] = data.entries ?? [];
      })
    );
    setExpanded(next);
  }

  async function createFolder() {
    const name = window.prompt("Neuer Ordner (relativ zum Workspace):", "src/feature");
    if (!name?.trim()) return;
    const res = await fetch("/api/fs/mkdir", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ path: name.trim().replace(/\\/g, "/") }),
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error || "mkdir failed");
      return;
    }
    await loadRoot();
    await reloadExpanded();
    if (data.absolutePath && window.helixDesktop?.revealInFolder) {
      void window.helixDesktop.revealInFolder(data.absolutePath);
    }
  }

  async function createFile() {
    const name = window.prompt("Neue Datei (relativ zum Workspace):", "src/new-file.ts");
    if (!name?.trim()) return;
    const res = await fetch("/api/fs/file", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ path: name.trim().replace(/\\/g, "/"), content: "" }),
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error || "create file failed");
      return;
    }
    await loadRoot();
    await reloadExpanded();
    onOpenFile(data.path || name.trim());
    if (data.absolutePath && window.helixDesktop?.revealInFolder) {
      void window.helixDesktop.revealInFolder(data.absolutePath);
    }
  }

  function statusFor(path: string) {
    if (gitStatus[path]) return gitStatus[path];
    const child = Object.keys(gitStatus).find((p) => p.startsWith(path + "/"));
    return child ? "M" : "";
  }

  function renderEntries(entries: Entry[], depth = 0) {
    return entries.map((entry) => {
      const isDir = entry.type === "dir";
      const isOpen = Boolean(expanded[entry.path]);
      const isActive = activePath === entry.path;
      const status = statusFor(entry.path);
      return (
        <div key={entry.path}>
          <button
            type="button"
            className={`tree-row${isActive ? " active" : ""}${status ? " dirty" : ""}`}
            style={{ paddingLeft: `${0.55 + depth * 0.75}rem` }}
            onClick={() => {
              if (isDir) void toggleDir(entry);
              else onOpenFile(entry.path);
            }}
          >
            <span className="tree-icon">
              {isDir ? (isOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />) : (
                <FileCode2 size={14} />
              )}
            </span>
            {isDir ? <Folder size={14} /> : null}
            <span className="tree-name">{entry.name}</span>
            {status ? <span className="git-badge">{status}</span> : null}
          </button>
          {isDir && isOpen ? renderEntries(expanded[entry.path] ?? [], depth + 1) : null}
        </div>
      );
    });
  }

  return (
    <div className="file-tree">
      <div className="pane-label-row">
        <div className="pane-label">Explorer</div>
        <div className="tree-actions">
          <button type="button" className="ghost-btn tree-action" title="Neuer Ordner" onClick={() => void createFolder()}>
            <FolderPlus size={13} />
          </button>
          <button type="button" className="ghost-btn tree-action" title="Neue Datei" onClick={() => void createFile()}>
            <FilePlus2 size={13} />
          </button>
          <button
            type="button"
            className="ghost-btn tree-action"
            title="Aktualisieren"
            onClick={() => {
              void loadRoot();
              void reloadExpanded();
              void refreshGit();
            }}
          >
            <RefreshCw size={13} />
          </button>
        </div>
      </div>
      {workspaceAbs ? (
        <div className="tree-root-path" title={workspaceAbs}>
          {workspaceAbs}
        </div>
      ) : null}
      {error ? <div className="pane-error">{error}</div> : null}
      <div className="tree-scroll">{renderEntries(root)}</div>
    </div>
  );
}
