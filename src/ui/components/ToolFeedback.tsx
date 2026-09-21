import { useState } from "react";
import {
  Check,
  ChevronDown,
  ChevronRight,
  CircleAlert,
  LoaderCircle,
  Wrench,
} from "lucide-react";

export type ToolPartLike = {
  type: string;
  toolCallId?: string;
  toolName?: string;
  state?: string;
  input?: unknown;
  output?: unknown;
  errorText?: string;
};

function toolNameOf(part: ToolPartLike): string {
  if (part.toolName) return part.toolName;
  return part.type.replace(/^tool-/, "") || "tool";
}

function preview(value: unknown, max = 420): string {
  if (value == null) return "";
  if (typeof value === "string") {
    return value.length > max ? `${value.slice(0, max)}…` : value;
  }
  try {
    const text = JSON.stringify(value, null, 2);
    return text.length > max ? `${text.slice(0, max)}…` : text;
  } catch {
    return String(value);
  }
}

function stateMeta(state?: string): {
  label: string;
  tone: "run" | "ok" | "err" | "wait";
} {
  switch (state) {
    case "input-streaming":
      return { label: "Preparing…", tone: "wait" };
    case "input-available":
      return { label: "Running…", tone: "run" };
    case "output-available":
      return { label: "Done", tone: "ok" };
    case "output-error":
      return { label: "Failed", tone: "err" };
    default:
      return { label: state || "Working…", tone: "run" };
  }
}

export function isToolRunning(state?: string): boolean {
  return state === "input-streaming" || state === "input-available" || !state;
}

export function ToolFeedbackCard({
  part,
  defaultOpen,
}: {
  part: ToolPartLike;
  defaultOpen?: boolean;
}) {
  const name = toolNameOf(part);
  const meta = stateMeta(part.state);
  const running = isToolRunning(part.state);
  const [open, setOpen] = useState(Boolean(defaultOpen ?? running));
  const inputText = preview(part.input);
  const outputText =
    part.state === "output-error"
      ? part.errorText || "Tool failed"
      : preview(part.output);
  const hasBody = Boolean(inputText || outputText);

  return (
    <div className={`tool-card tone-${meta.tone}${running ? " is-live" : ""}`}>
      <button
        type="button"
        className="tool-card-head"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
      >
        <span className="tool-card-icon" aria-hidden>
          {meta.tone === "ok" ? (
            <Check size={13} />
          ) : meta.tone === "err" ? (
            <CircleAlert size={13} />
          ) : running ? (
            <LoaderCircle size={13} className="spin" />
          ) : (
            <Wrench size={13} />
          )}
        </span>
        <span className="tool-card-title">
          <strong>{name}</strong>
          <span className="tool-card-state">{meta.label}</span>
        </span>
        {hasBody ? (
          open ? (
            <ChevronDown size={14} className="tool-card-chevron" />
          ) : (
            <ChevronRight size={14} className="tool-card-chevron" />
          )
        ) : null}
      </button>
      {open && hasBody ? (
        <div className="tool-card-body">
          {inputText ? (
            <div className="tool-card-block">
              <div className="tool-card-label">Input</div>
              <pre>{inputText}</pre>
            </div>
          ) : null}
          {outputText ? (
            <div className="tool-card-block">
              <div className="tool-card-label">
                {part.state === "output-error" ? "Error" : "Output"}
              </div>
              <pre className={part.state === "output-error" ? "is-error" : ""}>
                {outputText}
              </pre>
            </div>
          ) : running ? (
            <div className="tool-card-live">Streaming result…</div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

export function summarizeToolActivity(parts: ToolPartLike[]): {
  running: ToolPartLike[];
  done: number;
  failed: number;
  label: string;
} {
  const tools = parts.filter((p) => p.type.startsWith("tool-") || p.type === "dynamic-tool");
  const running = tools.filter((p) => isToolRunning(p.state));
  const done = tools.filter((p) => p.state === "output-available").length;
  const failed = tools.filter((p) => p.state === "output-error").length;
  const current = running[running.length - 1];
  let label = "Thinking…";
  if (current) {
    label = `Läuft ${toolNameOf(current)}…`;
  } else if (tools.length > 0 && done + failed === tools.length) {
    label = "Schreibt Antwort…";
  } else if (tools.length > 0) {
    label = "Tools werden ausgeführt…";
  }
  return { running, done, failed, label };
}
