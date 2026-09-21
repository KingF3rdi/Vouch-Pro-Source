/**
 * Parse compiler / typecheck stderr into actionable diagnostics.
 */

export type BuildDiagnostic = {
  file: string;
  line: number;
  column?: number;
  code?: string;
  message: string;
};

/** TypeScript / tsc / vite-ish paths: path(line,col): error TSxxxx: message */
const TSC_RE =
  /([^\s:(]+)\((\d+),(\d+)\):\s+error\s+(TS\d+):\s*(.+)/g;
const TSC_COLON_RE =
  /([^\s:]+):(\d+):(\d+)\s+-\s+error\s+(TS\d+):\s*(.+)/g;
/** Generic path:line:col: message */
const GENERIC_RE = /([^\s:(]+\.[a-zA-Z0-9]+):(\d+)(?::(\d+))?:\s*(.+)/g;

export function parseBuildDiagnostics(text: string, limit = 40): BuildDiagnostic[] {
  if (!text?.trim()) return [];
  const out: BuildDiagnostic[] = [];
  const seen = new Set<string>();

  const push = (d: BuildDiagnostic) => {
    const key = `${d.file}:${d.line}:${d.message}`;
    if (seen.has(key) || out.length >= limit) return;
    seen.add(key);
    out.push(d);
  };

  for (const re of [TSC_RE, TSC_COLON_RE]) {
    re.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = re.exec(text)) && out.length < limit) {
      push({
        file: m[1]!,
        line: Number(m[2]),
        column: Number(m[3]),
        code: m[4],
        message: m[5]!.trim(),
      });
    }
  }

  if (out.length === 0) {
    GENERIC_RE.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = GENERIC_RE.exec(text)) && out.length < limit) {
      const msg = m[4]!.trim();
      if (/error|Error|TS\d+|failed|Cannot|is not/i.test(msg)) {
        push({
          file: m[1]!,
          line: Number(m[2]),
          column: m[3] ? Number(m[3]) : undefined,
          message: msg.slice(0, 400),
        });
      }
    }
  }

  return out;
}

export function enrichFailure(text: string) {
  const diagnostics = parseBuildDiagnostics(text);
  return {
    diagnostics,
    mustFix: true as const,
    nextSteps: [
      "Read each diagnostic file with read_file or explain_code.",
      "Fix with apply_patch (preferred) or write_file.",
      "Re-run quality_check or ship_project until ok:true.",
      "Do not stop or summarize as done while mustFix is true.",
    ],
  };
}
