from __future__ import annotations

from typing import TYPE_CHECKING

import discord

from utils.embeds import error_embed, success_embed
from utils.packs import resolve_pack_path, save_pack_attachment

if TYPE_CHECKING:
    from bot import ShopBot


async def apply_pack_attachment(
    bot: ShopBot,
    item_id: int,
    attachment: discord.Attachment,
    *,
    channel: discord.abc.Messageable | None = None,
) -> tuple[str, str]:
    """
    Speichert Pack lokal und setzt pack_link auf eine Discord-URL.
    Gibt (pack_file_rel, pack_link_url) zurück.
    """
    rel = await save_pack_attachment(item_id, attachment)
    pack_link = attachment.url

    if channel is not None:
        path = resolve_pack_path(rel)
        if path is not None:
            try:
                posted = await channel.send(
                    content=f"📦 Pack für Item `{item_id}` — bitte nicht löschen.",
                    file=discord.File(path, filename=path.name),
                )
                if posted.attachments:
                    pack_link = posted.attachments[0].url
            except discord.HTTPException:
                pass

    await bot.db.update_item(item_id, pack_file=rel, pack_link=pack_link[:500])
    return rel, pack_link


async def collect_pack_from_user(
    bot: ShopBot,
    interaction: discord.Interaction,
    item_id: int,
) -> None:
    """
    Nimmt Pack per Drag & Drop entgegen.

    Ohne Message-Content-Intent sind Anhänge in Guild-Channels leer.
    Deshalb: Datei per DM an den Bot (DMs behalten Attachments) oder
    Slash `/item setpack` mit Anhang.
    """
    user = interaction.user
    timeout_s = 120.0

    # 1) Versuch: DM (Attachments ohne Privileged Intent verfügbar)
    dm: discord.DMChannel | None = None
    try:
        dm = await user.create_dm()
        await dm.send(
            embed=success_embed(
                f"Pack für Item `{item_id}`",
                "Ziehe die Pack-Datei per **Drag & Drop** in diesen Chat "
                f"und sende sie (innerhalb {int(timeout_s)} Sekunden).",
            )
        )
        await interaction.followup.send(
            embed=success_embed(
                "DM geöffnet",
                f"{user.mention}: Schau in deine **Direktnachrichten** mit dem Bot "
                "und sende dort die Pack-Datei per Drag & Drop.",
            ),
            ephemeral=True,
        )

        def dm_check(message: discord.Message) -> bool:
            return (
                message.author.id == user.id
                and isinstance(message.channel, discord.DMChannel)
                and bool(message.attachments)
            )

        message = await bot.wait_for("message", check=dm_check, timeout=timeout_s)
        attachment = message.attachments[0]
        _rel, pack_link = await apply_pack_attachment(
            bot, item_id, attachment, channel=dm
        )
        await dm.send(
            embed=success_embed(
                "Pack-Link gesetzt",
                f"**{attachment.filename}** gespeichert.\nLink: {pack_link}",
            )
        )
        await interaction.followup.send(
            embed=success_embed(
                "Pack-Link gesetzt",
                f"**{attachment.filename}** → Item `{item_id}`\n{pack_link}",
            ),
            ephemeral=True,
        )
        return
    except discord.Forbidden:
        pass
    except TimeoutError:
        await interaction.followup.send(
            embed=error_embed(
                "Zeit abgelaufen",
                "Keine Datei in der DM erhalten.\n"
                f"Alternative: `/item setpack item_id:{item_id}` und Datei anhängen.",
            ),
            ephemeral=True,
        )
        return

    # 2) Fallback: Slash-Command Hinweis (Guild-Attachments brauchen Message Content Intent)
    await interaction.followup.send(
        embed=error_embed(
            "DMs geschlossen",
            "Der Bot konnte dir keine DM schreiben.\n\n"
            f"**So geht's trotzdem:**\n"
            f"`/item setpack` → Item wählen → **Datei anhängen** (Drag & Drop am Slash-Command).\n"
            f"Item-ID: `{item_id}`",
        ),
        ephemeral=True,
    )


class PackUploadView(discord.ui.View):
    """Ein Klick startet den Pack-Upload (DM Drag & Drop)."""

    def __init__(self, bot: ShopBot, item_id: int, user_id: int) -> None:
        super().__init__(timeout=180)
        self.bot = bot
        self.item_id = item_id
        self.user_id = user_id

    async def interaction_check(self, interaction: discord.Interaction) -> bool:
        if interaction.user.id != self.user_id:
            await interaction.response.send_message(
                "Nur der Admin, der das Item angelegt hat.", ephemeral=True
            )
            return False
        return True

    @discord.ui.button(
        label="Pack per Drag & Drop senden",
        style=discord.ButtonStyle.success,
        emoji="📎",
    )
    async def upload(
        self, interaction: discord.Interaction, button: discord.ui.Button
    ) -> None:
        await interaction.response.defer(ephemeral=True)
        await collect_pack_from_user(self.bot, interaction, self.item_id)
        self.stop()
