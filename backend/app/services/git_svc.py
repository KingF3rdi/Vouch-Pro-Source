"""Git status and file diffs for the IDE (Python)."""

from __future__ import annotations

import difflib
import subprocess
from pathlib import Path


def get_git_status(workspace: Path) -> list[dict[str, str]]:
    try:
        completed = subprocess.run(
            ["git", "status", "--porcelain"],
            cwd=str(workspace),
            capture_output=True,
            text=True,
            check=False,
        )
    except OSError:
        return []
    if completed.returncode != 0:
        return []
    files: list[dict[str, str]] = []
    for line in completed.stdout.splitlines():
        if not line.strip():
            continue
        status = line[:2].strip() or "??"
        file_path = line[3:].strip().strip('"').replace("\\ ", " ")
        if " -> " in file_path:
            file_path = file_path.split(" -> ")[-1]
        files.append({"path": file_path, "status": status})
    return files


def get_original_file_content(workspace: Path, relative_path: str) -> str:
    try:
        completed = subprocess.run(
            ["git", "show", f"HEAD:{relative_path}"],
            cwd=str(workspace),
            capture_output=True,
            text=True,
            check=False,
        )
        if completed.returncode == 0:
            return completed.stdout
    except OSError:
        pass
    path = workspace / relative_path
    try:
        return path.read_text(encoding="utf-8", errors="replace")
    except OSError:
        return ""


def get_file_diff(
    workspace: Path,
    relative_path: str,
    current_content: str | None = None,
) -> dict[str, str]:
    original = get_original_file_content(workspace, relative_path)
    if current_content is not None:
        modified = current_content
    else:
        path = workspace / relative_path
        try:
            modified = path.read_text(encoding="utf-8", errors="replace")
        except OSError:
            modified = ""
    patch = "".join(
        difflib.unified_diff(
            original.splitlines(keepends=True),
            modified.splitlines(keepends=True),
            fromfile=f"a/{relative_path}",
            tofile=f"b/{relative_path}",
        )
    )
    return {"original": original, "modified": modified, "patch": patch}
