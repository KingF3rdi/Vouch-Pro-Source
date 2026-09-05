"""Vouch-Channel immer auf die aktuelle Vouch-Anzahl umbenennen."""

from __future__ import annotations

from typing import TYPE_CHECKING

import discord

if TYPE_CHECKING:
    from bot import ShopBot


def format_vouch_channel_name(count: int) -> str:
    """Discord-Channel-Name mit Vouch-Zähler (max. 100 Zeichen)."""
    n = max(0, int(count))
    return f"⭐・vouches・{n}"[:100]


async def rename_vouch_channel(
    bot: "ShopBot",
    guild_id: int,
    *,
    count: int | None = None,
) -> str | None:
    """Benennt den konfigurierten Vouch-Channel nach Anzahl um.

    Returns den neuen Namen oder None bei Fehler/Skip.
    """
    settings = await bot.db.ensure_guild(guild_id)
    channel_id = settings.get("vouch_channel_id")
    if not channel_id:
        return None

    if count is None:
        count = await bot.db.count_vouches(guild_id)

    new_name = format_vouch_channel_name(count)

    guild = bot.get_guild(guild_id)
    if guild is None:
        try:
            guild = await bot.fetch_guild(guild_id)
        except discord.HTTPException as exc:
            print(f"[VouchChannel] Guild {guild_id} nicht ladbar: {exc!r}")
            return None

    channel = guild.get_channel(int(channel_id))
    if channel is None:
        try:
            fetched = await guild.fetch_channel(int(channel_id))
        except discord.HTTPException as exc:
            print(f"[VouchChannel] Channel {channel_id} nicht ladbar: {exc!r}")
            return None
        channel = fetched if isinstance(fetched, discord.TextChannel) else None
    elif not isinstance(channel, discord.TextChannel):
        channel = None

    if channel is None:
        return None

    if channel.name == new_name:
        return new_name

    try:
        await channel.edit(
            name=new_name,
            reason=f"Vouch-Zähler aktualisiert ({count})",
        )
        print(f"[VouchChannel] Umbenannt → #{new_name} ({count})")
        return new_name
    except discord.Forbidden:
        print(
            "[VouchChannel] Keine Berechtigung zum Umbenennen "
            "(Recht „Kanäle verwalten“ nötig)."
        )
    except discord.HTTPException as exc:
        print(f"[VouchChannel] Umbenennen fehlgeschlagen: {exc!r}")
    return None
