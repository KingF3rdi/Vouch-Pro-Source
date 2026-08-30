from __future__ import annotations

from typing import TYPE_CHECKING

import discord

from config import DEFAULT_PAYEE, PAYMENT_NOTICE
from utils.embeds import base_embed

if TYPE_CHECKING:
    from bot import ShopBot


def buy_panel_suffix(category_id: int | None) -> str:
    return str(category_id) if category_id is not None else "all"


def build_buy_panel_embed(
    *,
    categories: list[dict],
    settings: dict,
    category: dict | None = None,
    title: str | None = None,
) -> discord.Embed:
    if category:
        panel_title = title or category["name"]
        description = (
            (category.get("description") or "").strip()
            or f"Kaufe Artikel aus **{category['name']}**.\n\n"
            "• **Kaufen** — Items dieser Kategorie wählen\n"
            "• **Warenkorb** — Überblick & Checkout\n"
            "• **Info** — Zahlungsablauf"
        )
        embed = base_embed(panel_title, description)
        emoji = (category.get("emoji") or "").strip() or "•"
        embed.add_field(
            name="Kategorie",
            value=f"{emoji} **{category['name']}**",
            inline=False,
        )
    else:
        panel_title = title or "Buy Panel"
        description = (
            "Hier kannst du Artikel kaufen.\n\n"
            "• **Kaufen** — Kategorie & Item wählen, in den Warenkorb legen\n"
            "• **Warenkorb** — Überblick, Gesamtpreis, Checkout\n"
            "• **Info** — Zahlungsablauf"
        )
        embed = base_embed(panel_title, description)
        if categories:
            embed.add_field(
                name="Kategorien",
                value="\n".join(
                    f"{c.get('emoji') or '•'} **{c['name']}**" for c in categories[:20]
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
    embed.add_field(name="Zahlung", value=f"**{PAYMENT_NOTICE}**", inline=False)
    embed.set_footer(text=f"{PAYMENT_NOTICE} · Zahlung an {name}")
    return embed


async def register_buy_panel_views(bot: "ShopBot") -> None:
    """Registriert persistente Buy-Panel-Views (allgemein + pro Kategorie)."""
    registered: set[str] = getattr(bot, "_buy_panel_registered", set())

    def _register(category_id: int | None) -> None:
        from views.shop_views import BuyPanelView

        suffix = buy_panel_suffix(category_id)
        if suffix in registered:
            return
        bot.add_view(BuyPanelView(bot, category_id=category_id))
        registered.add(suffix)

    _register(None)
    rows = await bot.db.list_all_categories()
    for row in rows:
        _register(int(row["id"]))

    bot._buy_panel_registered = registered


async def ensure_buy_panel_view(bot: "ShopBot", category_id: int | None) -> None:
    registered: set[str] = getattr(bot, "_buy_panel_registered", set())
    suffix = buy_panel_suffix(category_id)
    if suffix in registered:
        return
    from views.shop_views import BuyPanelView

    bot.add_view(BuyPanelView(bot, category_id=category_id))
    registered.add(suffix)
    bot._buy_panel_registered = registered
