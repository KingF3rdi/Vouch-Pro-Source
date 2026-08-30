from __future__ import annotations

from typing import TYPE_CHECKING

import discord
from discord import app_commands
from discord.ext import commands

from utils.embeds import base_embed, success_embed
from views.shop_views import BuyPanelView, CartView, ShopPanelView
from config import DEFAULT_PAYEE, PAYMENT_NOTICE

if TYPE_CHECKING:
    from bot import ShopBot


class ShopCog(commands.Cog):
    def __init__(self, bot: ShopBot) -> None:
        self.bot = bot

    @app_commands.command(
        name="buypanel",
        description="Buy-Panel in diesen Channel posten (Kaufen / Warenkorb)",
    )
    @app_commands.default_permissions(manage_guild=True)
    async def buypanel(self, interaction: discord.Interaction) -> None:
        assert interaction.guild is not None
        cats = await self.bot.db.list_categories(interaction.guild.id)
        settings = await self.bot.db.ensure_guild(interaction.guild.id)

        embed = base_embed(
            "Buy Panel",
            "Hier kannst du Artikel kaufen.\n\n"
            "• **Kaufen** — Kategorie & Item wählen, in den Warenkorb legen\n"
            "• **Warenkorb** — Überblick, Gesamtpreis, Checkout\n"
            "• **Info** — Zahlungsablauf\n\n"
            f"**{PAYMENT_NOTICE}**",
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
                value="Noch keine Kategorien — Admin: `/adminpanel`.",
                inline=False,
            )
        name = settings.get("payee_a_label") or DEFAULT_PAYEE
        embed.set_footer(text=f"{PAYMENT_NOTICE} · Zahlung an {name}")

        await interaction.response.send_message(
            embed=success_embed("Buy-Panel gepostet"),
            ephemeral=True,
        )
        channel = interaction.channel
        if isinstance(channel, discord.TextChannel):
            await channel.send(embed=embed, view=BuyPanelView(self.bot))

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
            "_Tipp: `/buypanel` für das Buy-Panel mit Kauf-Button._",
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
