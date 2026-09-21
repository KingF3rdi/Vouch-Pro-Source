"""GitHub connect / commit / push helpers (Python)."""

from __future__ import annotations

import json
import subprocess
from pathlib import Path
from typing import Any

import httpx

from app.core.config import get_settings


def _secrets_path(workspace: Path) -> Path:
    return workspace / ".helix" / "secrets.json"


def load_secrets(workspace: Path) -> dict[str, Any]:
    path = _secrets_path(workspace)
    if not path.exists():
        return {}
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        return {}


def save_secrets(workspace: Path, patch: dict[str, Any]) -> dict[str, Any]:
    current = load_secrets(workspace)
    next_secrets = {**current, **patch}
    path = _secrets_path(workspace)
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(next_secrets, indent=2), encoding="utf-8")
    return next_secrets


def _git_out(workspace: Path, *args: str) -> str | None:
    try:
        completed = subprocess.run(
            ["git", *args],
            cwd=str(workspace),
            capture_output=True,
            text=True,
            check=False,
        )
        if completed.returncode != 0:
            return None
        return completed.stdout.strip()
    except OSError:
        return None


def _redact_remote(remote: str | None) -> str | None:
    if not remote:
        return remote
    # Avoid leaking tokens embedded in remote URLs (e.g. https://x-access-token:…@github.com/…)
    if "@" in remote and "://" in remote:
        scheme, rest = remote.split("://", 1)
        if "@" in rest:
            host_path = rest.split("@", 1)[1]
            return f"{scheme}://{host_path}"
    return remote


async def github_status(workspace: Path) -> dict[str, Any]:
    secrets = load_secrets(workspace)
    settings = get_settings()
    token = secrets.get("githubToken") or settings.github_token
    remote = _redact_remote(_git_out(workspace, "remote", "get-url", "origin"))
    branch = _git_out(workspace, "rev-parse", "--abbrev-ref", "HEAD")
    status = _git_out(workspace, "status", "--porcelain")
    dirty = bool(status)

    user = secrets.get("githubUser")
    if token and not user:
        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                res = await client.get(
                    "https://api.github.com/user",
                    headers={
                        "Authorization": f"Bearer {token}",
                        "Accept": "application/vnd.github+json",
                        "User-Agent": "HelixAgent/0.5",
                    },
                )
                if res.is_success:
                    user = res.json().get("login")
        except httpx.HTTPError:
            user = None

    return {
        "connected": bool(token),
        "user": user,
        "remote": remote,
        "branch": branch,
        "dirty": dirty,
        "hasEnvToken": bool(settings.github_token),
    }


def git_commit(workspace: Path, message: str, paths: list[str] | None = None) -> dict[str, Any]:
    if paths:
        cmd = ["git", "add", "--", *paths]
    else:
        cmd = ["git", "add", "-A"]
    subprocess.run(cmd, cwd=str(workspace), capture_output=True, text=True, check=False)
    status = _git_out(workspace, "status", "--porcelain")
    if not status:
        return {"ok": True, "committed": False, "reason": "nothing to commit"}
    completed = subprocess.run(
        ["git", "commit", "-m", message],
        cwd=str(workspace),
        capture_output=True,
        text=True,
        check=False,
    )
    return {
        "ok": completed.returncode == 0,
        "committed": completed.returncode == 0,
        "stdout": (completed.stdout or "")[:8_000],
        "stderr": (completed.stderr or "")[:4_000],
    }


def git_push(workspace: Path, set_upstream: bool = True) -> dict[str, Any]:
    branch = _git_out(workspace, "rev-parse", "--abbrev-ref", "HEAD") or "HEAD"
    cmd = ["git", "push"]
    if set_upstream:
        cmd.extend(["-u", "origin", branch])
    completed = subprocess.run(cmd, cwd=str(workspace), capture_output=True, text=True, check=False)
    return {
        "ok": completed.returncode == 0,
        "stdout": (completed.stdout or "")[:8_000],
        "stderr": (completed.stderr or "")[:4_000],
    }
