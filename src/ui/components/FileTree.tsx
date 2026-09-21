import { useEffect, useState } from "react";
import { ChevronDown, ChevronRight, FileCode2, Folder } from "lucide-react";

type Entry = { name: string; type: "dir" | "file"; path: string };

export function FileTree({
  onOpenFile,
  activePath,
}: {
  onOpenFile: (path: string) => void;
  activePath: string | null;
}) {
  const [root, setRoot] = useState<Entry[]>([]);
  const [expanded, setExpanded] = useState<Record<string, Entry[]>>({});
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void fetch("/api/fs/tree")
      .then((r) => r.json())
      .then((data) => {
        if (data.error) setError(data.error);
        else setRoot(data.entries ?? []);
      })
      .catch((e) => setError(String(e)));
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

  function renderEntries(entries: Entry[], depth = 0) {
    return entries.map((entry) => {
      const isDir = entry.type === "dir";
      const isOpen = Boolean(expanded[entry.path]);
      const isActive = activePath === entry.path;
      return (
        <div key={entry.path}>
          <button
            type="button"
            className={`tree-row${isActive ? " active" : ""}`}
            style={{ paddingLeft: `${0.55 + depth * 0.75}rem` }}
            onClick={() => {
              if (isDir) void toggleDir(entry);
              else onOpenFile(entry.path);
            }}
          >
            <span className="tree-icon">
              {isDir ? (
                isOpen ? (
                  <ChevronDown size={14} />
                ) : (
                  <ChevronRight size={14} />
                )
              ) : (
                <FileCode2 size={14} />
              )}
            </span>
            {isDir ? <Folder size={14} /> : null}
            <span className="tree-name">{entry.name}</span>
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
