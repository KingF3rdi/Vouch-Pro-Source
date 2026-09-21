"""Persisted chat sessions on disk under .helix/sessions (Python)."""

from __future__ import annotations

import json
import uuid
from datetime import datetime, timezone
from pathlib import Path
from app.models.schemas import AgentMode, StoredSession


def _sessions_dir(workspace: Path) -> Path:
    return workspace / ".helix" / "sessions"


def _session_path(workspace: Path, session_id: str) -> Path:
    return _sessions_dir(workspace) / f"{session_id}.json"


def _ensure_dir(workspace: Path) -> None:
    _sessions_dir(workspace).mkdir(parents=True, exist_ok=True)


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def list_sessions(workspace: Path) -> list[StoredSession]:
    _ensure_dir(workspace)
    sessions: list[StoredSession] = []
    for path in _sessions_dir(workspace).glob("*.json"):
        try:
            data = json.loads(path.read_text(encoding="utf-8"))
            sessions.append(StoredSession.model_validate(data))
        except (OSError, json.JSONDecodeError, ValueError):
            continue
    sessions.sort(key=lambda s: s.updated_at, reverse=True)
    return sessions


def get_session(workspace: Path, session_id: str) -> StoredSession | None:
    path = _session_path(workspace, session_id)
    if not path.exists():
        return None
    try:
        return StoredSession.model_validate(json.loads(path.read_text(encoding="utf-8")))
    except (OSError, json.JSONDecodeError, ValueError):
        return None


def create_session(
    workspace: Path,
    *,
    title: str | None = None,
    mode: AgentMode = "chat",
    skill_ids: list[str] | None = None,
) -> StoredSession:
    _ensure_dir(workspace)
    now = _now()
    session = StoredSession(
        id=str(uuid.uuid4()),
        title=(title or "").strip() or "New chat",
        createdAt=now,
        updatedAt=now,
        mode=mode,
        skillIds=skill_ids or ["coding", "design", "research"],
        messages=[],
    )
    _write(workspace, session)
    return session


def save_session(workspace: Path, session: StoredSession) -> StoredSession:
    _ensure_dir(workspace)
    next_session = session.model_copy(update={"updated_at": _now()})
    next_session = next_session.model_copy(update={"title": _derive_title(next_session)})
    _write(workspace, next_session)
    return next_session


def delete_session(workspace: Path, session_id: str) -> None:
    path = _session_path(workspace, session_id)
    path.unlink(missing_ok=True)


def _write(workspace: Path, session: StoredSession) -> None:
    path = _session_path(workspace, session.id)
    path.write_text(
        json.dumps(session.model_dump(by_alias=True), indent=2, ensure_ascii=False),
        encoding="utf-8",
    )


def _derive_title(session: StoredSession) -> str:
    if session.title and session.title != "New chat":
        return session.title
    for message in session.messages:
        if not isinstance(message, dict):
            continue
        if message.get("role") != "user":
            continue
        parts = message.get("parts") or []
        texts = [
            p.get("text", "")
            for p in parts
            if isinstance(p, dict) and p.get("type") == "text" and p.get("text")
        ]
        text = " ".join(texts) or (message.get("content") or "")
        if isinstance(text, str) and text.strip():
            return text.strip()[:72]
    return session.title or "New chat"
