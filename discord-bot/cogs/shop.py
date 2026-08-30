from __future__ import annotations

from typing import TYPE_CHECKING

import discord
from discord import app_commands
from discord.ext import commands

from utils.embeds import base_embed, success_embed
from utils.panels import (
    build_buy_panel_embed,
    ensure_buy_panel_view,
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


class ShopCog(commands.Cog):
    def __init__(self, bot: ShopBot) -> None:
        self.bot = bot

    @app_commands.command(
        name="buypanel",
        description="Buy-Panel posten (allgemein oder für eine Kategorie)",
    )
    @app_commands.describe(
        category="Optional: Panel nur für diese Kategorie",
        channel="Optional: Ziel-Channel (Standard: aktueller Channel)",
        title="Optional: eigener Panel-Titel",
    )
    @app_commands.default_permissions(manage_guild=True)
    async def buypanel(
        self,
        interaction: discord.Interaction,
        category: int | None = None,
        channel: discord.TextChannel | None = None,
        title: str | None = None,
    ) -> None:
        assert interaction.guild is not None
        cats = await self.bot.db.list_categories(interaction.guild.id)
        settings = await self.bot.db.ensure_guild(interaction.guild.id)

        cat: dict | None = None
        if category is not None:
            cat = await self.bot.db.get_category(category)
            if not cat or int(cat["guild_id"]) != interaction.guild.id:
                from utils.embeds import error_embed

                await interaction.response.send_message(
                    embed=error_embed("Kategorie nicht gefunden"),
                    ephemeral=True,
                )
                return

        await ensure_buy_panel_view(self.bot, category)

        embed = build_buy_panel_embed(
            categories=cats,
            settings=settings,
            category=cat,
            title=title,
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

        label = cat["name"] if cat else "Buy Panel"
        await interaction.response.send_message(
            embed=success_embed("Buy-Panel gepostet", f"**{label}** → {target.mention}"),
            ephemeral=True,
        )
        await target.send(embed=embed, view=BuyPanelView(self.bot, category_id=category))

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
        description="Ein Buy-Panel pro Kategorie posten",
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
        cats = await self.bot.db.list_categories(interaction.guild.id)
        if not cats:
            from utils.embeds import error_embed

            await interaction.response.send_message(
                embed=error_embed(
                    "Keine Kategorien",
                    "Lege zuerst Kategorien an (`/adminpanel` oder `/category add`).",
                ),
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
        cats = await self.bot.db.list_categories(interaction.guild.id)
        embed = base_embed(
            "Shop",
            "Wähle **Kategorien anzeigen**, um Artikel in den Warenkorb zu legen.\n"
            "Danach **Weiter einkaufen**, **Warenkorb** oder **Kaufen**.\n\n"
            f"**{PAYMENT_NOTICE}**\n\n"
            "_Tipp: `/buypanel` für ein allgemeines Panel, `/buypanels` für je Kategorie._",
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
                value="Noch keine Kategorien — Admin: `/adminpanel` oder `/category add`.",
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
