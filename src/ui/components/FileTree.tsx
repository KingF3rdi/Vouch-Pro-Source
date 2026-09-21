import { useEffect, useState } from "react";
import { ChevronDown, ChevronRight, FileCode2, Folder } from "lucide-react";

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

  async function refreshGit() {
    const res = await fetch("/api/git/status");
    const data = await res.json();
    const map: GitStatusMap = {};
    for (const file of data.files ?? []) {
      map[file.path] = file.status;
    }
    setGitStatus(map);
  }

  useEffect(() => {
    void fetch("/api/fs/tree")
      .then((r) => r.json())
      .then((data) => {
        if (data.error) setError(data.error);
        else setRoot(data.entries ?? []);
      })
      .catch((e) => setError(String(e)));
    void refreshGit();
    const timer = window.setInterval(() => void refreshGit(), 5000);
    return () => window.clearInterval(timer);
  }, []);

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

  function statusFor(path: string) {
    if (gitStatus[path]) return gitStatus[path];
    // directory dirty if any child dirty
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
      <div className="pane-label">Explorer</div>
      {error ? <div className="pane-error">{error}</div> : null}
      <div className="tree-scroll">{renderEntries(root)}</div>
    </div>
  );
}
