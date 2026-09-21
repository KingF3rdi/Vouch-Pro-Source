from pathlib import Path


def ensure_helix_dirs(workspace: Path) -> None:
    base = workspace / ".helix"
    (base / "sessions").mkdir(parents=True, exist_ok=True)
    base.mkdir(parents=True, exist_ok=True)
