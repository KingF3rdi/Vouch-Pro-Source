"""Filesystem and terminal tools for Helix coding agents (Python only)."""

from __future__ import annotations

import subprocess
from pathlib import Path
from typing import Any

from app.core.config import get_settings


class ToolError(Exception):
    """Bounded tool failure — agents must catch and surface cleanly."""


IGNORE_DIRS = {
    "node_modules",
    ".git",
    "dist",
    ".helix",
    "__pycache__",
    ".venv",
    "release",
    ".next",
    "target",
}


def _assert_inside(workspace: Path, relative: str) -> Path:
    root = workspace.resolve()
    target = (root / relative).resolve()
    if target != root and not str(target).startswith(str(root) + "/"):
        raise ToolError(f"Path escapes workspace: {relative}")
    return target


def list_directory(workspace: Path, relative_path: str = ".") -> list[dict[str, str]]:
    directory = _assert_inside(workspace, relative_path or ".")
    entries: list[dict[str, str]] = []
    for entry in sorted(directory.iterdir(), key=lambda p: (not p.is_dir(), p.name.lower())):
        if entry.name in IGNORE_DIRS:
            continue
        entries.append(
            {
                "name": entry.name,
                "type": "dir" if entry.is_dir() else "file",
                "path": str(entry.relative_to(workspace)).replace("\\", "/"),
            }
        )
    return entries


def read_file(
    workspace: Path,
    relative_path: str,
    max_chars: int | None = None,
) -> dict[str, Any]:
    path = _assert_inside(workspace, relative_path)
    text = path.read_text(encoding="utf-8", errors="replace")
    limit = max_chars
    if limit is None:
        configured = get_settings().tool_read_max_chars
        limit = None if configured <= 0 else configured
    if limit is not None and len(text) > limit:
        return {
            "truncated": True,
            "content": text[:limit],
            "note": f"Truncated to {limit} characters (set HELIX_TOOL_READ_MAX_CHARS=0 for full files)",
            "total_chars": len(text),
        }
    return {"truncated": False, "content": text, "total_chars": len(text)}


def write_file(workspace: Path, relative_path: str, content: str) -> dict[str, Any]:
    path = _assert_inside(workspace, relative_path)
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(content, encoding="utf-8")
    return {"ok": True, "path": relative_path, "bytes": len(content.encode("utf-8"))}


def search_files(
    workspace: Path,
    query: str,
    glob_pattern: str = "**/*.{ts,tsx,js,jsx,py,md,json,css,html}",
    max_matches: int = 80,
) -> dict[str, Any]:
    needle = query.lower()
    matches: list[dict[str, Any]] = []
    # Expand simple brace globs manually for pathlib
    patterns = _expand_brace_glob(glob_pattern)
    seen: set[Path] = set()
    for pattern in patterns:
        for path in workspace.glob(pattern):
            if path in seen or not path.is_file():
                continue
            if any(part in IGNORE_DIRS for part in path.parts):
                continue
            seen.add(path)
            try:
                text = path.read_text(encoding="utf-8", errors="replace")
            except OSError:
                continue
            if needle not in text.lower():
                continue
            lines = text.splitlines()
            hits = [
                {"line": i + 1, "text": line[:240]}
                for i, line in enumerate(lines)
                if needle in line.lower()
            ][:8]
            matches.append(
                {
                    "path": str(path.relative_to(workspace)).replace("\\", "/"),
                    "hits": hits,
                }
            )
            if len(matches) >= max_matches:
                return {"matches": matches, "count": len(matches)}
    return {"matches": matches, "count": len(matches)}


def _expand_brace_glob(pattern: str) -> list[str]:
    if "{" not in pattern or "}" not in pattern:
        return [pattern]
    start = pattern.index("{")
    end = pattern.index("}")
    prefix = pattern[:start]
    suffix = pattern[end + 1 :]
    options = pattern[start + 1 : end].split(",")
    return [f"{prefix}{opt}{suffix}" for opt in options]


def run_terminal(
    workspace: Path,
    command: str,
    timeout_ms: int = 600_000,
) -> dict[str, Any]:
    """Long default timeout — builds/ship must not be cut short."""
    try:
        completed = subprocess.run(
            command,
            shell=True,
            cwd=str(workspace),
            capture_output=True,
            text=True,
            timeout=timeout_ms / 1000,
        )
        # Large capture — agent quality needs full logs, not tiny slices
        return {
            "ok": completed.returncode == 0,
            "code": completed.returncode,
            "stdout": completed.stdout or "",
            "stderr": completed.stderr or "",
        }
    except subprocess.TimeoutExpired as exc:
        raise ToolError(f"Command timed out after {timeout_ms}ms: {command}") from exc
    except OSError as exc:
        raise ToolError(str(exc)) from exc


CODING_TOOLS: dict[str, dict[str, Any]] = {
    "list_directory": {
        "description": "List files and folders relative to the workspace.",
        "fn": list_directory,
    },
    "read_file": {
        "description": "Read a text file from the workspace (full file when HELIX_TOOL_READ_MAX_CHARS=0).",
        "fn": read_file,
    },
    "write_file": {
        "description": "Create or overwrite a text file in the workspace.",
        "fn": write_file,
    },
    "search_files": {
        "description": "Search file contents with a case-insensitive substring.",
        "fn": search_files,
    },
    "run_terminal": {
        "description": "Run a shell command inside the workspace (builds, tests, git).",
        "fn": run_terminal,
    },
}
