"""Filesystem and terminal tools for Helix coding agents (Python only)."""

from __future__ import annotations

import subprocess
from pathlib import Path
from typing import Any


class ToolError(Exception):
    """Bounded tool failure — agents must catch and surface cleanly."""


IGNORE_DIRS = {"node_modules", ".git", "dist", ".helix", "__pycache__", ".venv", "release"}


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


def read_file(workspace: Path, relative_path: str, max_chars: int = 80_000) -> dict[str, Any]:
    path = _assert_inside(workspace, relative_path)
    text = path.read_text(encoding="utf-8", errors="replace")
    if len(text) > max_chars:
        return {"truncated": True, "content": text[:max_chars], "note": f"Truncated to {max_chars}"}
    return {"truncated": False, "content": text}


def write_file(workspace: Path, relative_path: str, content: str) -> dict[str, Any]:
    path = _assert_inside(workspace, relative_path)
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(content, encoding="utf-8")
    return {"ok": True, "path": relative_path}


def run_terminal(
    workspace: Path,
    command: str,
    timeout_ms: int = 120_000,
) -> dict[str, Any]:
    try:
        completed = subprocess.run(
            command,
            shell=True,
            cwd=str(workspace),
            capture_output=True,
            text=True,
            timeout=timeout_ms / 1000,
        )
        return {
            "ok": completed.returncode == 0,
            "code": completed.returncode,
            "stdout": (completed.stdout or "")[:20_000],
            "stderr": (completed.stderr or "")[:8_000],
        }
    except subprocess.TimeoutExpired as exc:
        raise ToolError(f"Command timed out: {command}") from exc
    except OSError as exc:
        raise ToolError(str(exc)) from exc


CODING_TOOLS: dict[str, dict[str, Any]] = {
    "list_directory": {
        "description": "List files and folders relative to the workspace.",
        "fn": list_directory,
    },
    "read_file": {
        "description": "Read a text file from the workspace.",
        "fn": read_file,
    },
    "write_file": {
        "description": "Create or overwrite a text file in the workspace.",
        "fn": write_file,
    },
    "run_terminal": {
        "description": "Run a shell command inside the workspace (builds, tests, git).",
        "fn": run_terminal,
    },
}
