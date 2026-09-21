import Editor from "@monaco-editor/react";

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

export function EditorPane({
  path,
  value,
  onChange,
  onSave,
  dirty,
}: {
  path: string | null;
  value: string;
  onChange: (value: string) => void;
  onSave: () => void;
  dirty: boolean;
}) {
  if (!path) {
    return (
      <div className="editor-empty">
        <h2>Helix IDE</h2>
        <p>Open a file from the explorer, or ask the agent to map and edit the project.</p>
      </div>
    );
  }

  return (
    <div className="editor-pane">
      <div className="editor-toolbar">
        <span className="editor-path">
          {path}
          {dirty ? " · unsaved" : ""}
        </span>
        <button type="button" className="ghost-btn" onClick={onSave} disabled={!dirty}>
          Save
        </button>
      </div>
      <Editor
        height="100%"
        theme="vs-dark"
        path={path}
        language={languageFor(path)}
        value={value}
        onChange={(next) => onChange(next ?? "")}
        options={{
          fontFamily: "IBM Plex Mono, ui-monospace, monospace",
          fontSize: 13,
          minimap: { enabled: false },
          smoothScrolling: true,
          padding: { top: 12 },
          automaticLayout: true,
        }}
        onMount={(editor, monaco) => {
          editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS, () => onSave());
        }}
      />
    </div>
  );
}
