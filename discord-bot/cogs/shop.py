from __future__ import annotations

from typing import TYPE_CHECKING

import discord
from discord import app_commands
from discord.ext import commands

from integrations.catalog_sync import sync_shop_catalog
from integrations.shop_api import shop_api
from utils.embeds import base_embed, success_embed
from utils.panels import (
    PanelFilter,
    apply_panel_filter,
    build_buy_panel_embed,
    ensure_buy_panel_slot_view,
    ensure_buy_panel_view,
    get_panel_filter_for_slot,
    panel_filter_summary,
    refresh_slot_panel,
)
from views.shop_views import BuyPanelView, CartView, ShopPanelView
from config import PAYMENT_NOTICE

if TYPE_CHECKING:
    from bot import ShopBot


async def _resolve_target_channel(
    interaction: discord.Interaction,
    channel: discord.TextChannel | None,
) -> discord.TextChannel | None:
    if channel is not None:
        return channel
    if isinstance(interaction.channel, discord.TextChannel):
        return interaction.channel
    return None


async def _ensure_catalog(bot: ShopBot, guild_id: int) -> dict | None:
    """Synchronisiert Kategorien von der Website, wenn API konfiguriert ist."""
    if not shop_api.enabled:
        return None
    return await sync_shop_catalog(bot, guild_id)


async def _post_slot_panel(
    bot: ShopBot,
    guild: discord.Guild,
    target: discord.TextChannel,
    slot: int,
    *,
    title: str | None = None,
) -> discord.Message:
    cats = await bot.db.list_categories(guild.id)
    settings = await bot.db.ensure_guild(guild.id)
    panel_filter, stored_title = await get_panel_filter_for_slot(bot, guild.id, slot)
    panel_title = title or stored_title
    await ensure_buy_panel_slot_view(bot, slot)
    filtered = apply_panel_filter(cats, panel_filter)
    embed = build_buy_panel_embed(
        categories=filtered,
        settings=settings,
        title=panel_title,
        panel_filter=panel_filter,
        slot=slot,
    )
    view = BuyPanelView(bot, panel_slot=slot)
    row = await bot.db.ensure_buy_panel_slot(guild.id, slot)
    channel_id = row.get("channel_id")
    message_id = row.get("message_id")
    if channel_id and message_id and int(channel_id) == target.id:
        try:
            old = await target.fetch_message(int(message_id))
            await old.edit(embed=embed, view=view)
            return old
        except discord.NotFound:
            pass
    msg = await target.send(embed=embed, view=view)
    await bot.db.update_buy_panel_message(
        guild.id, slot, channel_id=target.id, message_id=msg.id
    )
    return msg


async def _refresh_slot_panel(bot: ShopBot, guild: discord.Guild, slot: int) -> str:
    return await refresh_slot_panel(bot, guild, slot)


class ShopCog(commands.Cog):
    def __init__(self, bot: ShopBot) -> None:
        self.bot = bot

    @app_commands.command(
        name="syncshop",
        description="Kategorien und Produkte von der Website übernehmen",
    )
    @app_commands.default_permissions(manage_guild=True)
    async def syncshop(self, interaction: discord.Interaction) -> None:
        assert interaction.guild is not None
        if not shop_api.enabled:
            from utils.embeds import error_embed

            await interaction.response.send_message(
                embed=error_embed(
                    "API nicht konfiguriert",
                    "Setze `SHOP_API_URL` und `BOT_API_KEY` in der `.env`.",
                ),
                ephemeral=True,
            )
            return

        await interaction.response.defer(ephemeral=True)
        result = await sync_shop_catalog(self.bot, interaction.guild.id)
        if result.get("error"):
            from utils.embeds import error_embed

            await interaction.followup.send(
                embed=error_embed(
                    "Sync fehlgeschlagen",
                    "Katalog konnte nicht von der Website geladen werden.",
                ),
                ephemeral=True,
            )
            return

        await interaction.followup.send(
            embed=success_embed(
                "Shop synchronisiert",
                f"**{result.get('categories', 0)}** Kategorien · "
                f"**{result.get('items', 0)}** Produkte übernommen"
                + (
                    f"\nEntfernt: {result.get('removed_categories', 0)} Kategorien, "
                    f"{result.get('removed_items', 0)} Produkte"
                    if result.get("removed_categories") or result.get("removed_items")
                    else ""
                ),
            ),
            ephemeral=True,
        )

    @app_commands.command(
        name="buypanelconfig",
        description="Buy Panel 1 oder 2 konfigurieren (Kategorien / alle außer)",
    )
    @app_commands.describe(
        slot="Panel 1 oder 2",
        mode="Kategorie-Filter",
        categories="Optional: Kategorie-IDs kommagetrennt (sonst interaktive Auswahl)",
        title="Optional: Panel-Titel",
    )
    @app_commands.choices(
        mode=[
            app_commands.Choice(name="Alle Kategorien", value="all"),
            app_commands.Choice(name="Nur diese Kategorien", value="include"),
            app_commands.Choice(name="Alle außer diese", value="exclude"),
        ]
    )
    @app_commands.default_permissions(manage_guild=True)
    async def buypanelconfig(
        self,
        interaction: discord.Interaction,
        slot: app_commands.Range[int, 1, 2],
        mode: app_commands.Choice[str],
        categories: str | None = None,
        title: str | None = None,
    ) -> None:
        assert interaction.guild is not None
        from utils.embeds import error_embed
        from views.panel_config import PanelCategoryConfigView

        filter_mode = mode.value
        category_ids: list[int] = []

        if filter_mode in ("include", "exclude") and categories and categories.strip():
            for part in categories.replace(" ", "").split(","):
                if not part:
                    continue
                try:
                    category_ids.append(int(part))
                except ValueError:
                    await interaction.response.send_message(
                        embed=error_embed(
                            "Ungültige ID",
                            f"`{part}` ist keine gültige Kategorie-ID.",
                        ),
                        ephemeral=True,
                    )
                    return
            cats = await self.bot.db.list_categories(interaction.guild.id)
            valid_ids = {int(c["id"]) for c in cats}
            invalid = [i for i in category_ids if i not in valid_ids]
            if invalid:
                await interaction.response.send_message(
                    embed=error_embed(
                        "Kategorie nicht gefunden",
                        f"Unbekannte IDs: {', '.join(str(i) for i in invalid)}",
                    ),
                    ephemeral=True,
                )
                return
            await self._save_buy_panel_config(
                interaction, slot, filter_mode, category_ids, title
            )
            return

        if filter_mode in ("include", "exclude"):
            cats = await self.bot.db.list_categories(interaction.guild.id)
            if not cats:
                await interaction.response.send_message(
                    embed=error_embed(
                        "Keine Kategorien",
                        "Erst Kategorien anlegen oder `/syncshop` ausführen.",
                    ),
                    ephemeral=True,
                )
                return

            mode_label = (
                "Nur diese Kategorien"
                if filter_mode == "include"
                else "Alle außer diese"
            )
            action = (
                "Wähle die Kategorien, die **sichtbar** sein sollen."
                if filter_mode == "include"
                else "Wähle die Kategorien, die **ausgeblendet** werden sollen."
            )
            header = (
                f"**{mode_label}** — Buy Panel **{slot}**\n"
                f"{action}\n"
                "Klicke Kategorien zum **An-/Abwählen** (✅ = aktiv). "
                "Danach **Speichern**."
            )
            if title:
                header += f"\n\n_Titel: {title}_"

            row = await self.bot.db.ensure_buy_panel_slot(interaction.guild.id, slot)
            pf = PanelFilter.from_slot_row(row)
            initial_ids = (
                set(pf.category_ids)
                if pf.mode == filter_mode and pf.category_ids
                else set()
            )

            async def on_confirm(
                inter: discord.Interaction, selected: list[dict]
            ) -> None:
                ids = [int(c["id"]) for c in selected]
                await self._save_buy_panel_config(
                    inter, slot, filter_mode, ids, title, edit=True
                )

            view = PanelCategoryConfigView(
                cats,
                on_confirm=on_confirm,
                header=header,
                initial_selected_ids=initial_ids,
            )
            msg = await interaction.response.send_message(
                content=view._status_text(),
                view=view,
                ephemeral=True,
            )
            view.message = msg
            return

        await self._save_buy_panel_config(
            interaction, slot, filter_mode, category_ids, title
        )

    async def _save_buy_panel_config(
        self,
        interaction: discord.Interaction,
        slot: int,
        filter_mode: str,
        category_ids: list[int],
        title: str | None,
        *,
        edit: bool = False,
    ) -> None:
        assert interaction.guild is not None

        await self.bot.db.set_buy_panel_slot(
            interaction.guild.id,
            slot,
            filter_mode=filter_mode,
            category_ids=category_ids,
            title=title,
        )
        await ensure_buy_panel_slot_view(self.bot, slot)

        pf = PanelFilter(mode=filter_mode, category_ids=tuple(category_ids))
        cats = await self.bot.db.list_categories(interaction.guild.id)
        filtered = apply_panel_filter(cats, pf)
        names = ", ".join(c["name"] for c in filtered[:10])
        if len(filtered) > 10:
            names += f" … (+{len(filtered) - 10})"

        refresh_note = ""
        row = await self.bot.db.get_buy_panel_slot(interaction.guild.id, slot)
        if row and row.get("message_id"):
            refresh_result = await refresh_slot_panel(
                self.bot, interaction.guild, slot
            )
            refresh_note = f"\n\n**Panel aktualisiert:** {refresh_result}"

        embed = success_embed(
            f"Buy Panel {slot} konfiguriert",
            f"**Filter:** {panel_filter_summary(pf)}\n"
            + (f"**Titel:** {title}\n" if title else "")
            + (f"**Sichtbar:** {names or '—'}\n\n" if filtered else "")
            + f"Posten mit `/buypanel slot:{slot}`"
            + refresh_note,
        )
        if edit:
            await interaction.response.edit_message(
                content=None, embed=embed, view=None
            )
        else:
            await interaction.response.send_message(embed=embed, ephemeral=True)

    @buypanelconfig.autocomplete("categories")
    async def buypanelconfig_categories_autocomplete(
        self,
        interaction: discord.Interaction,
        current: str,
    ) -> list[app_commands.Choice[str]]:
        from views.selectors import category_autocomplete

        choices = await category_autocomplete(self.bot, interaction, current)
        return [
            app_commands.Choice(name=c.name, value=str(c.value)) for c in choices[:25]
        ]

    @app_commands.command(
        name="buypanelstatus",
        description="Zeigt Konfiguration von Buy Panel 1 und 2",
    )
    @app_commands.default_permissions(manage_guild=True)
    async def buypanelstatus(self, interaction: discord.Interaction) -> None:
        assert interaction.guild is not None
        from utils.embeds import error_embed

        cats = await self.bot.db.list_categories(interaction.guild.id)
        lines: list[str] = []
        for slot in (1, 2):
            row = await self.bot.db.ensure_buy_panel_slot(
                interaction.guild.id, slot
            )
            pf = PanelFilter.from_slot_row(row)
            filtered = apply_panel_filter(cats, pf)
            names = ", ".join(c["name"] for c in filtered[:8]) or "—"
            if len(filtered) > 8:
                names += f" … (+{len(filtered) - 8})"
            msg_hint = ""
            if row.get("channel_id") and row.get("message_id"):
                ch = interaction.guild.get_channel(int(row["channel_id"]))
                if ch:
                    msg_hint = f"\n  Nachricht: {ch.mention} (`{row['message_id']}`)"
            lines.append(
                f"**Panel {slot}** — {panel_filter_summary(pf)}\n"
                f"  Kategorien ({len(filtered)}): {names}{msg_hint}"
            )
        await interaction.response.send_message(
            embed=success_embed("Buy Panel Status", "\n\n".join(lines)),
            ephemeral=True,
        )

    @app_commands.command(
        name="buypanelboth",
        description="Buy Panel 1 und 2 in diesen Channel posten",
    )
    @app_commands.describe(
        channel="Optional: Ziel-Channel (Standard: aktueller Channel)",
    )
    @app_commands.default_permissions(manage_guild=True)
    async def buypanelboth(
        self,
        interaction: discord.Interaction,
        channel: discord.TextChannel | None = None,
    ) -> None:
        assert interaction.guild is not None
        await _ensure_catalog(self.bot, interaction.guild.id)
        target = await _resolve_target_channel(interaction, channel)
        if target is None:
            from utils.embeds import error_embed

            await interaction.response.send_message(
                embed=error_embed("Kein Channel", "Bitte einen Text-Channel wählen."),
                ephemeral=True,
            )
            return
        await interaction.response.defer(ephemeral=True)
        posted: list[str] = []
        for slot in (1, 2):
            msg = await _post_slot_panel(
                self.bot, interaction.guild, target, slot
            )
            posted.append(f"Panel {slot} → {msg.jump_url}")
        await interaction.followup.send(
            embed=success_embed(
                "Beide Panels gepostet",
                "\n".join(posted)
                + "\n\n**Nächste Schritte:**\n"
                "1. `/buypanelconfig slot:1 mode:…` — Kategorien für Panel 1\n"
                "2. `/buypanelconfig slot:2 mode:…` — Kategorien für Panel 2\n"
                "3. `/buypanelstatus` — prüfen",
            ),
            ephemeral=True,
        )

    @app_commands.command(
        name="panelsetup",
        description="Buy Panel 1+2 posten/aktualisieren und Status anzeigen",
    )
    @app_commands.describe(
        channel="Optional: Ziel-Channel (Standard: aktueller Channel)",
    )
    @app_commands.default_permissions(manage_guild=True)
    async def panelsetup(
        self,
        interaction: discord.Interaction,
        channel: discord.TextChannel | None = None,
    ) -> None:
        """Alles-in-einem: Panels posten/aktualisieren + Kurzstatus."""
        assert interaction.guild is not None
        target = await _resolve_target_channel(interaction, channel)
        if target is None:
            from utils.embeds import error_embed

            await interaction.response.send_message(
                embed=error_embed("Kein Channel", "Bitte einen Text-Channel wählen."),
                ephemeral=True,
            )
            return
        await interaction.response.defer(ephemeral=True)
        posted: list[str] = []
        for slot in (1, 2):
            msg = await _post_slot_panel(
                self.bot, interaction.guild, target, slot
            )
            posted.append(f"**Panel {slot}** → {msg.jump_url}")
        cats = await self.bot.db.list_categories(interaction.guild.id)
        status_lines: list[str] = []
        for slot in (1, 2):
            pf, _ = await get_panel_filter_for_slot(
                self.bot, interaction.guild.id, slot
            )
            filtered = apply_panel_filter(cats, pf)
            status_lines.append(
                f"Panel {slot}: {panel_filter_summary(pf)} ({len(filtered)} sichtbar)"
            )
        await interaction.followup.send(
            embed=success_embed(
                "Panel-Setup abgeschlossen",
                "\n".join(posted)
                + "\n\n"
                + "\n".join(status_lines)
                + "\n\nKategorien ändern: `/buypanelconfig slot:1` oder `slot:2`",
            ),
            ephemeral=True,
        )

    @app_commands.command(
        name="buypanelrefresh",
        description="Gespeicherte Buy Panels 1/2 mit aktuellen Buttons aktualisieren",
    )
    @app_commands.describe(
        slot="Optional: nur Panel 1 oder 2 (Standard: beide)",
    )
    @app_commands.default_permissions(manage_guild=True)
    async def buypanelrefresh(
        self,
        interaction: discord.Interaction,
        slot: app_commands.Range[int, 1, 2] | None = None,
    ) -> None:
        assert interaction.guild is not None
        await interaction.response.defer(ephemeral=True)
        slots = [slot] if slot is not None else [1, 2]
        results = [
            await _refresh_slot_panel(self.bot, interaction.guild, s) for s in slots
        ]
        await interaction.followup.send(
            embed=success_embed("Panels aktualisiert", "\n".join(results)),
            ephemeral=True,
        )

    @app_commands.command(
        name="buypanel",
        description="Buy-Panel posten (Slot 1/2, allgemein oder eine Kategorie)",
    )
    @app_commands.describe(
        slot="Optional: Buy Panel 1 oder 2 (mit /buypanelconfig)",
        category="Optional: Panel nur für diese Kategorie (Legacy)",
        channel="Optional: Ziel-Channel (Standard: aktueller Channel)",
        title="Optional: eigener Panel-Titel",
    )
    @app_commands.default_permissions(manage_guild=True)
    async def buypanel(
        self,
        interaction: discord.Interaction,
        slot: app_commands.Range[int, 1, 2] | None = None,
        category: int | None = None,
        channel: discord.TextChannel | None = None,
        title: str | None = None,
    ) -> None:
        assert interaction.guild is not None
        await _ensure_catalog(self.bot, interaction.guild.id)

        cats = await self.bot.db.list_categories(interaction.guild.id)
        settings = await self.bot.db.ensure_guild(interaction.guild.id)

        cat: dict | None = None
        panel_filter: PanelFilter | None = None
        panel_slot: int | None = None
        panel_title = title

        if slot is not None and category is not None:
            from utils.embeds import error_embed

            await interaction.response.send_message(
                embed=error_embed(
                    "Konflikt",
                    "Bitte entweder `slot` (Panel 1/2) **oder** `category` angeben.",
                ),
                ephemeral=True,
            )
            return

        if slot is not None:
            panel_slot = slot
            panel_filter, stored_title = await get_panel_filter_for_slot(
                self.bot, interaction.guild.id, slot
            )
            if not panel_title and stored_title:
                panel_title = stored_title
            await ensure_buy_panel_slot_view(self.bot, slot)
        elif category is not None:
            cat = await self.bot.db.get_category(category)
            if not cat or int(cat["guild_id"]) != interaction.guild.id:
                from utils.embeds import error_embed

                await interaction.response.send_message(
                    embed=error_embed("Kategorie nicht gefunden"),
                    ephemeral=True,
                )
                return
            await ensure_buy_panel_view(self.bot, category)
        else:
            await ensure_buy_panel_view(self.bot, None)

        display_cats = (
            apply_panel_filter(cats, panel_filter)
            if panel_filter
            else cats
        )
        embed = build_buy_panel_embed(
            categories=display_cats if panel_filter else cats,
            settings=settings,
            category=cat,
            title=panel_title,
            panel_filter=panel_filter,
            slot=panel_slot,
        )
        target = await _resolve_target_channel(interaction, channel)
        if target is None:
            from utils.embeds import error_embed

            await interaction.response.send_message(
                embed=error_embed(
                    "Kein Channel",
                    "Bitte einen Text-Channel angeben oder den Befehl dort ausführen.",
                ),
                ephemeral=True,
            )
            return

        if panel_slot is not None:
            label = panel_title or f"Buy Panel {panel_slot}"
            await interaction.response.send_message(
                embed=success_embed(
                    "Buy-Panel gepostet", f"**{label}** → {target.mention}"
                ),
                ephemeral=True,
            )
            msg = await _post_slot_panel(
                self.bot,
                interaction.guild,
                target,
                panel_slot,
                title=panel_title,
            )
            return

        if cat:
            label = cat["name"]
            view = BuyPanelView(self.bot, category_id=category)
        else:
            label = panel_title or "Buy Panel"
            view = BuyPanelView(self.bot, category_id=None)

        tip = (
            "\n\n_Tipp: Für zwei parallele Panels `/buypanelboth` oder "
            "`slot:1` / `slot:2` nutzen._"
            if not cat
            else ""
        )
        await interaction.response.send_message(
            embed=success_embed(
                "Buy-Panel gepostet", f"**{label}** → {target.mention}{tip}"
            ),
            ephemeral=True,
        )
        await target.send(embed=embed, view=view)

    @buypanel.autocomplete("category")
    async def buypanel_category_autocomplete(
        self,
        interaction: discord.Interaction,
        current: str,
    ) -> list[app_commands.Choice[int]]:
        from views.selectors import category_autocomplete

        return await category_autocomplete(self.bot, interaction, current)

    @app_commands.command(
        name="buypanels",
        description="Ein Buy-Panel pro Kategorie posten (Kategorien von Website)",
    )
    @app_commands.describe(
        channel="Optional: Ziel-Channel (Standard: aktueller Channel)",
    )
    @app_commands.default_permissions(manage_guild=True)
    async def buypanels(
        self,
        interaction: discord.Interaction,
        channel: discord.TextChannel | None = None,
    ) -> None:
        assert interaction.guild is not None
        await _ensure_catalog(self.bot, interaction.guild.id)

        cats = await self.bot.db.list_categories(interaction.guild.id)
        if not cats:
            from utils.embeds import error_embed

            hint = (
                "Keine Kategorien gefunden. "
                "Lege welche an mit `/adminpanel` oder `/category add`."
            )
            if shop_api.enabled:
                hint += " Optional: `/syncshop` für Website-Sync."
            await interaction.response.send_message(
                embed=error_embed("Keine Kategorien", hint),
                ephemeral=True,
            )
            return

        target = await _resolve_target_channel(interaction, channel)
        if target is None:
            from utils.embeds import error_embed

            await interaction.response.send_message(
                embed=error_embed(
                    "Kein Channel",
                    "Bitte einen Text-Channel angeben oder den Befehl dort ausführen.",
                ),
                ephemeral=True,
            )
            return

        settings = await self.bot.db.ensure_guild(interaction.guild.id)
        posted: list[str] = []

        for cat in cats:
            category_id = int(cat["id"])
            await ensure_buy_panel_view(self.bot, category_id)
            embed = build_buy_panel_embed(
                categories=cats,
                settings=settings,
                category=cat,
            )
            await target.send(
                embed=embed,
                view=BuyPanelView(self.bot, category_id=category_id),
            )
            posted.append(cat["name"])

        await interaction.response.send_message(
            embed=success_embed(
                "Buy-Panels gepostet",
                f"{len(posted)} Panel(s) in {target.mention}:\n"
                + "\n".join(f"• **{n}**" for n in posted),
            ),
            ephemeral=True,
        )

    @app_commands.command(
        name="shoppanel", description="Shop-Panel in diesen Channel posten"
    )
    @app_commands.default_permissions(manage_guild=True)
    async def shoppanel(self, interaction: discord.Interaction) -> None:
        assert interaction.guild is not None
        await _ensure_catalog(self.bot, interaction.guild.id)

        cats = await self.bot.db.list_categories(interaction.guild.id)
        embed = base_embed(
            "Shop",
            "Wähle **Kategorien anzeigen**, um Artikel in den Warenkorb zu legen.\n"
            "Danach **Weiter einkaufen**, **Warenkorb** oder **Kaufen**.\n\n"
            f"**{PAYMENT_NOTICE}**\n\n"
            "_Tipp: `/buypanels` postet je Kategorie ein Panel (Website-Sync)._",
        )
        if cats:
            embed.add_field(
                name="Kategorien",
                value="\n".join(
                    f"{c.get('emoji') or '•'} **{c['name']}**" for c in cats[:20]
                ),
                inline=False,
            )
        else:
            embed.add_field(
                name="Hinweis",
                value="Noch keine Kategorien — `/adminpanel` oder `/category add`.",
                inline=False,
            )
        await interaction.response.send_message(
            embed=success_embed("Panel gepostet", "Shop-Panel wurde gesendet."),
            ephemeral=True,
        )
        channel = interaction.channel
        if isinstance(channel, discord.TextChannel):
            await channel.send(embed=embed, view=ShopPanelView(self.bot))

    @app_commands.command(name="cart", description="Deinen Warenkorb anzeigen")
    async def cart_cmd(self, interaction: discord.Interaction) -> None:
        assert interaction.guild is not None
        view = CartView(self.bot, interaction.user.id, interaction.guild.id)
        await view.refresh(interaction)


async def setup(bot: ShopBot) -> None:
    await bot.add_cog(ShopCog(bot))
