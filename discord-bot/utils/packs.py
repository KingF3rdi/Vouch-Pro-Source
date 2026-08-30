from __future__ import annotations

import re
from pathlib import Path

import discord

from config import DATA_DIR

PACKS_DIR = DATA_DIR / "packs"
PACKS_DIR.mkdir(parents=True, exist_ok=True)

# Discord upload limit for bots is typically 25MB (without boosts we keep a safe cap)
MAX_PACK_BYTES = 25 * 1024 * 1024


def _safe_filename(name: str) -> str:
    name = Path(name).name
    name = re.sub(r"[^\w.\-]+", "_", name, flags=re.UNICODE)
    return name[:180] or "pack.bin"


async def save_pack_attachment(item_id: int, attachment: discord.Attachment) -> str:
    """Speichert Anhang unter data/packs/ und gibt relativen Pfad zurück."""
    if attachment.size and attachment.size > MAX_PACK_BYTES:
        raise ValueError(f"Datei zu groß (max. {MAX_PACK_BYTES // (1024 * 1024)} MB).")

    filename = _safe_filename(attachment.filename or "pack.bin")
    rel = f"packs/{item_id}_{filename}"
    dest = DATA_DIR / rel
    dest.parent.mkdir(parents=True, exist_ok=True)
    await attachment.save(dest)
    return rel.replace("\\", "/")


def resolve_pack_path(pack_file: str | None) -> Path | None:
    if not pack_file:
        return None
    path = DATA_DIR / pack_file
    if path.is_file():
        return path
    return None
