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
        categories="Kategorie-IDs, kommagetrennt (z. B. 1,3,5) — bei Include/Exclude",
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

        filter_mode = mode.value
        category_ids: list[int] = []
        if filter_mode in ("include", "exclude"):
            if not categories or not categories.strip():
                await interaction.response.send_message(
                    embed=error_embed(
                        "Kategorien fehlen",
                        "Bei **Nur diese** oder **Alle außer** bitte `categories` "
                        "angeben (IDs kommagetrennt). Tipp: `/buypanelconfig` "
                        "Autocomplete bei categories.",
                    ),
                    ephemeral=True,
                )
                return
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

        await interaction.response.send_message(
            embed=success_embed(
                f"Buy Panel {slot} konfiguriert",
                f"**Filter:** {panel_filter_summary(pf)}\n"
                + (f"**Titel:** {title}\n" if title else "")
                + (f"**Sichtbar:** {names or '—'}\n\n" if filtered else "")
                + f"Posten mit `/buypanel slot:{slot}`",
            ),
            ephemeral=True,
        )

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
            view = BuyPanelView(self.bot, panel_slot=panel_slot)
        elif cat:
            label = cat["name"]
            view = BuyPanelView(self.bot, category_id=category)
        else:
            label = panel_title or "Buy Panel"
            view = BuyPanelView(self.bot, category_id=None)

        await interaction.response.send_message(
            embed=success_embed("Buy-Panel gepostet", f"**{label}** → {target.mention}"),
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
                "Keine Kategorien auf der Website gefunden."
                if shop_api.enabled
                else "Lege Kategorien an (`/adminpanel` oder `/category add`) "
                "oder konfiguriere `SHOP_API_URL` + `BOT_API_KEY`."
            )
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
                value="Noch keine Kategorien — Website-Sync mit `/syncshop` oder Admin-Panel.",
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
