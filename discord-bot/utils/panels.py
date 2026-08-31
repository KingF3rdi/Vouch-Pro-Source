from __future__ import annotations

import json
from dataclasses import dataclass
from typing import TYPE_CHECKING, Any

import discord

from config import DEFAULT_PAYEE, PAYMENT_NOTICE
from utils.embeds import base_embed

if TYPE_CHECKING:
    from bot import ShopBot


@dataclass(frozen=True)
class PanelFilter:
    """Kategorie-Filter für ein Buy-Panel."""

    mode: str  # all | include | exclude | single
    category_ids: tuple[int, ...] = ()

    @classmethod
    def all_categories(cls) -> PanelFilter:
        return cls(mode="all")

    @classmethod
    def single(cls, category_id: int) -> PanelFilter:
        return cls(mode="single", category_ids=(category_id,))

    @classmethod
    def from_slot_row(cls, row: dict[str, Any] | None) -> PanelFilter:
        if not row:
            return cls.all_categories()
        mode = str(row.get("filter_mode") or "all")
        try:
            ids = tuple(int(i) for i in json.loads(row.get("category_ids") or "[]"))
        except (json.JSONDecodeError, TypeError, ValueError):
            ids = ()
        if mode not in ("all", "include", "exclude"):
            mode = "all"
        if mode == "include" and not ids:
            mode = "all"
        return cls(mode=mode, category_ids=ids)


def apply_panel_filter(
    categories: list[dict], panel_filter: PanelFilter
) -> list[dict]:
    if panel_filter.mode == "all":
        return categories
    id_set = set(panel_filter.category_ids)
    if panel_filter.mode == "single":
        if len(id_set) != 1:
            return []
        only = next(iter(id_set))
        return [c for c in categories if int(c["id"]) == only]
    if panel_filter.mode == "include":
        return [c for c in categories if int(c["id"]) in id_set]
    if panel_filter.mode == "exclude":
        return [c for c in categories if int(c["id"]) not in id_set]
    return categories


def panel_filter_summary(panel_filter: PanelFilter) -> str:
    if panel_filter.mode == "all":
        return "Alle Kategorien"
    if panel_filter.mode == "single":
        return "Eine Kategorie"
    if panel_filter.mode == "include":
        n = len(panel_filter.category_ids)
        return f"Nur {n} Kategorie(n)" if n else "Keine Kategorien (Include leer)"
    if panel_filter.mode == "exclude":
        n = len(panel_filter.category_ids)
        return f"Alle außer {n} Kategorie(n)" if n else "Alle Kategorien"
    return "Alle Kategorien"


def buy_panel_suffix(category_id: int | None) -> str:
    return str(category_id) if category_id is not None else "all"


def buy_panel_slot_suffix(slot: int) -> str:
    return f"slot:{slot}"


def build_buy_panel_embed(
    *,
    categories: list[dict],
    settings: dict,
    category: dict | None = None,
    title: str | None = None,
    panel_filter: PanelFilter | None = None,
    slot: int | None = None,
) -> discord.Embed:
    filtered = apply_panel_filter(categories, panel_filter or PanelFilter.all_categories())

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
        default_title = f"Buy Panel {slot}" if slot else "Buy Panel"
        panel_title = title or default_title
        description = (
            "Hier kannst du Artikel kaufen.\n\n"
            "• **Kaufen** — Kategorie & Item wählen, in den Warenkorb legen\n"
            "• **Warenkorb** — Überblick, Gesamtpreis, Checkout\n"
            "• **Info** — Zahlungsablauf"
        )
        embed = base_embed(panel_title, description)
        pf = panel_filter or PanelFilter.all_categories()
        if pf.mode != "all" or slot:
            embed.add_field(
                name="Filter",
                value=f"**{panel_filter_summary(pf)}**",
                inline=False,
            )
        if filtered:
            embed.add_field(
                name="Kategorien",
                value="\n".join(
                    f"{c.get('emoji') or '•'} **{c['name']}**" for c in filtered[:20]
                )
                + (f"\n_…und {len(filtered) - 20} weitere_" if len(filtered) > 20 else ""),
                inline=False,
            )
        else:
            embed.add_field(
                name="Hinweis",
                value="Keine Kategorien für dieses Panel — Admin: `/buypanelconfig`.",
                inline=False,
            )

    name = settings.get("payee_a_label") or DEFAULT_PAYEE
    embed.add_field(name="Zahlung", value=f"**{PAYMENT_NOTICE}**", inline=False)
    embed.set_footer(text=f"{PAYMENT_NOTICE} · Zahlung an {name}")
    return embed


async def get_panel_filter_for_slot(
    bot: "ShopBot", guild_id: int, slot: int
) -> tuple[PanelFilter, str | None]:
    row = await bot.db.ensure_buy_panel_slot(guild_id, slot)
    return PanelFilter.from_slot_row(row), row.get("title")


async def register_buy_panel_views(bot: "ShopBot") -> None:
    """Registriert persistente Buy-Panel-Views (allgemein + pro Kategorie + Slots 1/2)."""
    registered: set[str] = getattr(bot, "_buy_panel_registered", set())

    def _register(category_id: int | None) -> None:
        from views.shop_views import BuyPanelView

        suffix = buy_panel_suffix(category_id)
        if suffix in registered:
            return
        bot.add_view(BuyPanelView(bot, category_id=category_id))
        registered.add(suffix)

    def _register_slot(slot: int) -> None:
        from views.shop_views import BuyPanelView

        suffix = buy_panel_slot_suffix(slot)
        if suffix in registered:
            return
        bot.add_view(BuyPanelView(bot, panel_slot=slot))
        registered.add(suffix)

    _register(None)
    _register_slot(1)
    _register_slot(2)
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


async def ensure_buy_panel_slot_view(bot: "ShopBot", slot: int) -> None:
    registered: set[str] = getattr(bot, "_buy_panel_registered", set())
    suffix = buy_panel_slot_suffix(slot)
    if suffix in registered:
        return
    from views.shop_views import BuyPanelView

    bot.add_view(BuyPanelView(bot, panel_slot=slot))
    registered.add(suffix)
    bot._buy_panel_registered = registered
