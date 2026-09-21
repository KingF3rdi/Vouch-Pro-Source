import { DiffEditor, Editor } from "@monaco-editor/react";
import { useEffect, useMemo, useState } from "react";
import { Columns2, FileCode2, X } from "lucide-react";

const LANGUAGE_BY_EXT: Record<string, string> = {
  ts: "typescript",
  tsx: "typescript",
  js: "javascript",
  jsx: "javascript",
  json: "json",
  md: "markdown",
  css: "css",
  html: "html",
  py: "python",
  rs: "rust",
  go: "go",
  yml: "yaml",
  yaml: "yaml",
};

function languageFor(path: string) {
  const ext = path.split(".").pop()?.toLowerCase() ?? "";
  return LANGUAGE_BY_EXT[ext] ?? "plaintext";
}

export type OpenFile = {
  path: string;
  content: string;
  savedContent: string;
  originalContent: string;
};

export function EditorPane({
  files,
  activePath,
  onSelect,
  onClose,
  onChange,
  onSave,
  showDiff,
  onToggleDiff,
}: {
  files: OpenFile[];
  activePath: string | null;
  onSelect: (path: string) => void;
  onClose: (path: string) => void;
  onChange: (path: string, value: string) => void;
  onSave: (path: string) => void;
  showDiff: boolean;
  onToggleDiff: () => void;
}) {
  const active = useMemo(
    () => files.find((f) => f.path === activePath) ?? null,
    [files, activePath]
  );
  const [diffOriginal, setDiffOriginal] = useState("");

  useEffect(() => {
    if (!active || !showDiff) return;
    let cancelled = false;
    void fetch("/api/git/diff", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ path: active.path, content: active.content }),
    })
      .then((r) => r.json())
      .then((data) => {
        if (!cancelled) setDiffOriginal(data.original ?? active.originalContent);
      });
    return () => {
      cancelled = true;
    };
  }, [active, showDiff]);

  if (!active) {
    return (
      <div className="editor-empty">
        <h2>Helix IDE</h2>
        <p>Open a file from the explorer. Dirty files show a diff against git HEAD.</p>
      </div>
    );
  }

  const dirty = active.content !== active.savedContent;

  return (
    <div className="editor-pane">
      <div className="editor-tabs">
        {files.map((file) => {
          const isDirty = file.content !== file.savedContent;
          return (
            <div
              key={file.path}
              className={`editor-tab${file.path === activePath ? " active" : ""}`}
              onClick={() => onSelect(file.path)}
            >
              <FileCode2 size={12} />
              <span>
                {file.path.split("/").pop()}
                {isDirty ? " •" : ""}
              </span>
              <button
                type="button"
                className="tab-close"
                aria-label={`Close ${file.path}`}
                onClick={(e) => {
                  e.stopPropagation();
                  onClose(file.path);
                }}
              >
                <X size={12} />
              </button>
            </div>
          );
        })}
      </div>

      <div className="editor-toolbar">
        <span className="editor-path">
          {active.path}
          {dirty ? " · unsaved" : ""}
          {showDiff ? " · diff" : ""}
        </span>
        <div className="editor-actions">
          <button
            type="button"
            className={`ghost-btn${showDiff ? " active" : ""}`}
            onClick={onToggleDiff}
            title="Toggle diff preview"
          >
            <Columns2 size={14} /> Diff
          </button>
          <button
            type="button"
            className="ghost-btn"
            onClick={() => onSave(active.path)}
            disabled={!dirty}
          >
            Save
          </button>
        </div>
      </div>

      <div className="editor-body">
        {showDiff ? (
          <DiffEditor
            height="100%"
            theme="vs-dark"
            language={languageFor(active.path)}
            original={diffOriginal || active.originalContent}
            modified={active.content}
            options={{
              fontFamily: "IBM Plex Mono, ui-monospace, monospace",
              fontSize: 13,
              readOnly: false,
              renderSideBySide: true,
              minimap: { enabled: false },
              automaticLayout: true,
            }}
            onMount={(editor) => {
              const modified = editor.getModifiedEditor();
              modified.onDidChangeModelContent(() => {
                onChange(active.path, modified.getValue());
              });
            }}
          />
        ) : (
          <Editor
            height="100%"
            theme="vs-dark"
            path={active.path}
            language={languageFor(active.path)}
            value={active.content}
            onChange={(next) => onChange(active.path, next ?? "")}
            options={{
              fontFamily: "IBM Plex Mono, ui-monospace, monospace",
              fontSize: 13,
              minimap: { enabled: false },
              smoothScrolling: true,
              padding: { top: 12 },
              automaticLayout: true,
            }}
            onMount={(editor, monaco) => {
              editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS, () =>
                onSave(active.path)
              );
            }}
          />
        )}
      </div>
    </div>
  );
}
