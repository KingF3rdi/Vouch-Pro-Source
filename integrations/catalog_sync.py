"""Synchronisiert Kategorien und Produkte von der Website-Shop-API."""

from __future__ import annotations

import time
from typing import TYPE_CHECKING

from integrations.shop_api import shop_api
from utils.panels import ensure_buy_panel_view

if TYPE_CHECKING:
    from bot import ShopBot

CATALOG_SYNC_COOLDOWN_SEC = 300


def _parse_role_id(value: str | int | None) -> int | None:
    if value is None:
        return None
    try:
        return int(value)
    except (TypeError, ValueError):
        return None


async def sync_shop_catalog(bot: "ShopBot", guild_id: int) -> dict:
    """Übernimmt Kategorien und Produkte automatisch von der Website."""
    if not shop_api.enabled:
        return {"skipped": True, "reason": "shop_api_disabled"}

    catalog = await shop_api.fetch_catalog()
    if catalog is None:
        return {"error": "fetch_failed"}

    api_category_ids: list[int] = []
    api_item_ids: list[int] = []
    categories_synced = 0
    items_synced = 0

    for idx, cat in enumerate(catalog.get("categories", [])):
        api_cat_id = int(cat["id"])
        api_category_ids.append(api_cat_id)
        product_count = int(cat.get("product_count") or len(cat.get("products", [])))
        description = f"Website · {product_count} Produkt(e)"

        local_cat_id = await bot.db.upsert_category_from_api(
            guild_id,
            api_id=api_cat_id,
            name=str(cat["name"]),
            description=description,
            sort_order=idx,
        )
        categories_synced += 1
        await ensure_buy_panel_view(bot, local_cat_id)

        for product in cat.get("products", []):
            api_item_id = int(product["id"])
            api_item_ids.append(api_item_id)
            slug = str(product.get("slug") or "")
            pack_link = f"{shop_api.api_url}/product/{slug}" if slug else ""
            await bot.db.upsert_item_from_api(
                guild_id=guild_id,
                category_id=local_cat_id,
                api_id=api_item_id,
                name=str(product["name"]),
                price=float(product["price"]),
                description=str(product.get("description") or "")[:500],
                pack_link=pack_link,
                role_id=_parse_role_id(product.get("discord_role_id")),
            )
            items_synced += 1

    removed_categories = await bot.db.delete_api_categories_not_in(
        guild_id, api_category_ids
    )
    removed_items = await bot.db.delete_api_items_not_in(guild_id, api_item_ids)

    return {
        "categories": categories_synced,
        "items": items_synced,
        "removed_categories": removed_categories,
        "removed_items": removed_items,
    }


async def maybe_sync_shop_catalog(bot: "ShopBot", guild_id: int) -> dict | None:
    """Sync mit Cooldown — für Shop-Interaktionen ohne API-Spam."""
    if not shop_api.enabled:
        return None
    now = time.monotonic()
    last = getattr(bot, "_last_catalog_sync", 0.0)
    if now - last < CATALOG_SYNC_COOLDOWN_SEC:
        return None
    result = await sync_shop_catalog(bot, guild_id)
    if not result.get("skipped") and not result.get("error"):
        bot._last_catalog_sync = now
    return result
