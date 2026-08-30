from __future__ import annotations

from typing import TYPE_CHECKING

import discord

from utils.embeds import cart_embed, error_embed, format_price, success_embed
from utils.view_helpers import SafeView
from config import DEFAULT_PAYEE, PAYMENT_NOTICE

if TYPE_CHECKING:
    from bot import ShopBot


class ShopPanelView(discord.ui.View):
    """Persistentes Shop-Panel mit Kategorie-Auswahl."""

    def __init__(self, bot: ShopBot) -> None:
        super().__init__(timeout=None)
        self.bot = bot

    @discord.ui.button(
        label="Kategorien anzeigen",
        style=discord.ButtonStyle.primary,
        custom_id="shop:browse",
        emoji="🛒",
    )
    async def browse(
        self, interaction: discord.Interaction, button: discord.ui.Button
    ) -> None:
        await _browse_categories(self.bot, interaction)

    @discord.ui.button(
        label="Warenkorb",
        style=discord.ButtonStyle.secondary,
        custom_id="shop:cart",
        emoji="🧺",
    )
    async def open_cart(
        self, interaction: discord.Interaction, button: discord.ui.Button
    ) -> None:
        assert interaction.guild is not None
        view = CartView(self.bot, interaction.user.id, interaction.guild.id)
        await view.refresh(interaction)


class BuyPanelView(discord.ui.View):
    """Persistentes Buy-Panel — optional auf eine Kategorie beschränkt."""

    def __init__(self, bot: ShopBot, category_id: int | None = None) -> None:
        super().__init__(timeout=None)
        self.bot = bot
        self.category_id = category_id
        suffix = f":{category_id}" if category_id is not None else ":all"

        buy_btn = discord.ui.Button(
            label="Kaufen",
            style=discord.ButtonStyle.success,
            custom_id=f"buy:start{suffix}",
            emoji="💳",
        )
        buy_btn.callback = self._buy
        self.add_item(buy_btn)

        cart_btn = discord.ui.Button(
            label="Warenkorb",
            style=discord.ButtonStyle.primary,
            custom_id=f"buy:cart{suffix}",
            emoji="🧺",
        )
        cart_btn.callback = self._cart
        self.add_item(cart_btn)

        info_btn = discord.ui.Button(
            label="Info",
            style=discord.ButtonStyle.secondary,
            custom_id=f"buy:info{suffix}",
            emoji="ℹ️",
        )
        info_btn.callback = self._info
        self.add_item(info_btn)

    async def _buy(
        self, interaction: discord.Interaction, button: discord.ui.Button
    ) -> None:
        await _browse_categories(self.bot, interaction, category_id=self.category_id)

    async def _cart(
        self, interaction: discord.Interaction, button: discord.ui.Button
    ) -> None:
        assert interaction.guild is not None
        view = CartView(self.bot, interaction.user.id, interaction.guild.id)
        await view.refresh(interaction)

    async def _info(
        self, interaction: discord.Interaction, button: discord.ui.Button
    ) -> None:
        assert interaction.guild is not None
        settings = await self.bot.db.ensure_guild(interaction.guild.id)
        name = settings.get("payee_a_label") or DEFAULT_PAYEE
        details = (settings.get("payee_a_details") or "").strip()
        pay_line = f"4. **Gesamten Betrag** an **{name}** überweisen"
        if details:
            pay_line += f"\n{details}"
        await interaction.response.send_message(
            embed=success_embed(
                "So funktioniert der Kauf",
                "1. **Kaufen** → Kategorie & Item wählen\n"
                "2. Danach **Weiter einkaufen**, **Warenkorb** oder **Kaufen**\n"
                "3. Im Warenkorb oder direkt **Kaufen** → privates Ticket\n"
                f"{pay_line}\n"
                "5. Payment beweisen (Bild + IGN)\n"
                "6. Staff bestätigt → Pack + Rollen\n\n"
                f"**{PAYMENT_NOTICE}**",
            ),
            ephemeral=True,
        )


async def _browse_categories(
    bot: ShopBot,
    interaction: discord.Interaction,
    category_id: int | None = None,
) -> None:
    from views.selectors import CategorySearchView

    assert interaction.guild is not None

    if category_id is not None:
        cat = await bot.db.get_category(category_id)
        if not cat or int(cat["guild_id"]) != interaction.guild.id:
            await interaction.response.send_message(
                embed=error_embed("Kategorie nicht gefunden"),
                ephemeral=True,
            )
            return
        items = await bot.db.list_items(interaction.guild.id, category_id=category_id)
        if not items:
            await interaction.response.send_message(
                embed=error_embed("Leer", "Diese Kategorie hat keine Items."),
                ephemeral=True,
            )
            return
        view = ItemSelectView(bot, items, cat["name"])
        await interaction.response.send_message(
            f"**{cat['name']}** — Item wählen:",
            view=view,
            ephemeral=True,
        )
        view.message = await interaction.original_response()
        return

    cats = await bot.db.list_categories(interaction.guild.id)
    if not cats:
        await interaction.response.send_message(
            embed=error_embed("Shop leer", "Es gibt noch keine Kategorien."),
            ephemeral=True,
        )
        return

    async def on_pick(inter: discord.Interaction, cat: dict) -> None:
        items = await bot.db.list_items(
            inter.guild.id, category_id=int(cat["id"])  # type: ignore[union-attr]
        )
        if not items:
            await inter.response.send_message(
                embed=error_embed("Leer", "Diese Kategorie hat keine Items."),
                ephemeral=True,
            )
            return
        view = ItemSelectView(bot, items, cat["name"])
        await inter.response.send_message(
            f"**{cat['name']}** — Item wählen:",
            view=view,
            ephemeral=True,
        )
        view.message = await inter.original_response()

    view = CategorySearchView(
        bot,
        interaction.guild.id,
        cats,
        on_pick=on_pick,
        placeholder="Kategorie suchen / wählen…",
    )
    await interaction.response.send_message(
        content="Wähle eine Kategorie (Suche möglich):",
        view=view,
        ephemeral=True,
    )


async def start_checkout(bot: ShopBot, interaction: discord.Interaction) -> None:
    """Erstellt das Kauf-Ticket aus dem aktuellen Warenkorb."""
    from cogs.tickets import create_order_ticket

    assert interaction.guild is not None
    if not interaction.response.is_done():
        await interaction.response.defer(ephemeral=True)
    try:
        channel = await create_order_ticket(bot, interaction)
    except ValueError as e:
        await interaction.followup.send(
            embed=error_embed("Kauf fehlgeschlagen", str(e)[:1500]),
            ephemeral=True,
        )
        return
    except Exception as e:
        await interaction.followup.send(
            embed=error_embed(
                "Kauf fehlgeschlagen",
                f"Unerwarteter Fehler: `{type(e).__name__}: {e}`",
            ),
            ephemeral=True,
        )
        return
    await interaction.followup.send(
        embed=success_embed(
            "Ticket erstellt",
            f"Dein Kauf-Ticket: {channel.mention}\n\n**{PAYMENT_NOTICE}**",
        ),
        ephemeral=True,
    )


class CategorySelectView(discord.ui.View):
    def __init__(self, bot: ShopBot, categories: list[dict]) -> None:
        super().__init__(timeout=120)
        self.bot = bot
        options = []
        for cat in categories[:25]:
            label = cat["name"][:100]
            emoji = (cat.get("emoji") or "").strip() or None
            desc = (cat.get("description") or "")[:100] or None
            try:
                opt = discord.SelectOption(
                    label=label,
                    value=str(cat["id"]),
                    description=desc,
                    emoji=emoji,
                )
            except (TypeError, ValueError):
                opt = discord.SelectOption(
                    label=label, value=str(cat["id"]), description=desc
                )
            options.append(opt)
        select = discord.ui.Select(
            placeholder="Kategorie wählen…",
            options=options,
            custom_id="shop:cat_select",
        )
        select.callback = self._on_select  # type: ignore[method-assign]
        self.add_item(select)

    async def _on_select(self, interaction: discord.Interaction) -> None:
        select: discord.ui.Select = self.children[0]  # type: ignore[assignment]
        cat_id = int(select.values[0])
        assert interaction.guild is not None
        items = await self.bot.db.list_items(interaction.guild.id, category_id=cat_id)
        cat = await self.bot.db.get_category(cat_id)
        if not items:
            await interaction.response.send_message(
                embed=error_embed("Leer", "Diese Kategorie hat keine Items."),
                ephemeral=True,
            )
            return
        view = ItemSelectView(self.bot, items, cat["name"] if cat else "Items")
        await interaction.response.send_message(
            f"**{cat['name'] if cat else 'Items'}** — Item wählen:",
            view=view,
            ephemeral=True,
        )


class ItemSelectView(SafeView):
    """Mehrfachauswahl von Items (Checkboxen) mit Bestätigen + Zurück-Button."""

    def __init__(self, bot: ShopBot, items: list[dict], category_name: str) -> None:
        super().__init__(timeout=180)
        self.bot = bot
        self.items = items
        self.category_name = category_name
        self.selected_ids: set[int] = set()
        self._build()

    def _build(self) -> None:
        self.clear_items()
        options = []
        for item in self.items[:25]:
            item_id = int(item["id"])
            options.append(
                discord.SelectOption(
                    label=f"{item['name'][:80]}",
                    value=str(item_id),
                    description=f"{format_price(float(item['price']))}"[:100],
                    default=item_id in self.selected_ids,
                )
            )
        select = discord.ui.Select(
            placeholder=f"Items aus {self.category_name} auswählen (mehrfach möglich)…",
            options=options,
            min_values=0,
            max_values=len(options) if options else 1,
            row=0,
        )
        select.callback = self._on_select  # type: ignore[method-assign]
        self.add_item(select)

        confirm_btn = discord.ui.Button(
            label="Auswahl bestätigen",
            style=discord.ButtonStyle.success,
            emoji="✅",
            row=1,
        )
        confirm_btn.callback = self._confirm  # type: ignore[method-assign]
        self.add_item(confirm_btn)

        back_btn = discord.ui.Button(
            label="Weiter einkaufen",
            style=discord.ButtonStyle.secondary,
            emoji="🛍️",
            row=2,
        )
        back_btn.callback = self._back  # type: ignore[method-assign]
        self.add_item(back_btn)

        cart_btn = discord.ui.Button(
            label="Warenkorb",
            style=discord.ButtonStyle.primary,
            emoji="🧺",
            row=2,
        )
        cart_btn.callback = self._open_cart  # type: ignore[method-assign]
        self.add_item(cart_btn)

        buy_btn = discord.ui.Button(
            label="Kaufen",
            style=discord.ButtonStyle.success,
            emoji="💳",
            row=2,
        )
        buy_btn.callback = self._buy  # type: ignore[method-assign]
        self.add_item(buy_btn)

    async def _on_select(self, interaction: discord.Interaction) -> None:
        select: discord.ui.Select = [
            c for c in self.children if isinstance(c, discord.ui.Select)
        ][0]
        self.selected_ids = {int(v) for v in select.values}
        self._build()
        await interaction.response.edit_message(view=self)

    async def _add_selected(self, interaction: discord.Interaction) -> list[str]:
        added: list[str] = []
        if not self.selected_ids:
            return added
        assert interaction.guild is not None
        for item_id in self.selected_ids:
            item = next((i for i in self.items if int(i["id"]) == item_id), None)
            if item is None:
                continue
            await self.bot.db.cart_add(
                interaction.user.id, interaction.guild.id, item_id, 1
            )
            added.append(item["name"])
        self.selected_ids = set()
        self._build()
        return added

    async def _confirm(self, interaction: discord.Interaction) -> None:
        added = await self._add_selected(interaction)
        if not added:
            await interaction.response.send_message(
                embed=error_embed("Keine Auswahl", "Bitte zuerst Items ankreuzen."),
                ephemeral=True,
            )
            return

        view = PostAddToCartView(self.bot)
        await interaction.response.send_message(
            embed=success_embed(
                "Zum Warenkorb hinzugefügt",
                "\n".join(f"• **{n}**" for n in added)
                + "\n\n**Weiter einkaufen**, **Warenkorb** oder **Kaufen**:"
                + f"\n\n*{PAYMENT_NOTICE}*",
            ),
            view=view,
            ephemeral=True,
        )
        view.message = await interaction.original_response()

    async def _back(self, interaction: discord.Interaction) -> None:
        await self._add_selected(interaction)
        await _browse_categories(self.bot, interaction)

    async def _open_cart(self, interaction: discord.Interaction) -> None:
        await self._add_selected(interaction)
        assert interaction.guild is not None
        view = CartView(self.bot, interaction.user.id, interaction.guild.id)
        await view.refresh(interaction)

    async def _buy(self, interaction: discord.Interaction) -> None:
        await self._add_selected(interaction)
        await start_checkout(self.bot, interaction)


class PostAddToCartView(SafeView):
    """Buttons nach dem Hinzufügen: weiter einkaufen, Warenkorb oder kaufen."""

    def __init__(self, bot: ShopBot) -> None:
        super().__init__(timeout=180)
        self.bot = bot

    @discord.ui.button(
        label="Weiter einkaufen", style=discord.ButtonStyle.primary, emoji="🛍️"
    )
    async def continue_shopping(
        self, interaction: discord.Interaction, button: discord.ui.Button
    ) -> None:
        await _browse_categories(self.bot, interaction)

    @discord.ui.button(
        label="Warenkorb", style=discord.ButtonStyle.secondary, emoji="🧺"
    )
    async def open_cart(
        self, interaction: discord.Interaction, button: discord.ui.Button
    ) -> None:
        assert interaction.guild is not None
        view = CartView(self.bot, interaction.user.id, interaction.guild.id)
        await view.refresh(interaction)

    @discord.ui.button(
        label="Kaufen", style=discord.ButtonStyle.success, emoji="💳"
    )
    async def buy_now(
        self, interaction: discord.Interaction, button: discord.ui.Button
    ) -> None:
        await start_checkout(self.bot, interaction)


class AddToCartView(SafeView):
    def __init__(self, bot: ShopBot, item: dict) -> None:
        super().__init__(timeout=120)
        self.bot = bot
        self.item = item

    @discord.ui.button(label="In den Warenkorb", style=discord.ButtonStyle.success)
    async def add(
        self, interaction: discord.Interaction, button: discord.ui.Button
    ) -> None:
        assert interaction.guild is not None
        await self.bot.db.cart_add(
            interaction.user.id, interaction.guild.id, int(self.item["id"]), 1
        )
        await interaction.response.send_message(
            embed=success_embed(
                "Hinzugefügt",
                f"**{self.item['name']}** ist im Warenkorb.\n"
                "**Weiter einkaufen**, **Warenkorb** oder **Kaufen**."
                f"\n\n*{PAYMENT_NOTICE}*",
            ),
            view=PostAddToCartView(self.bot),
            ephemeral=True,
        )


class CartView(SafeView):
    def __init__(self, bot: ShopBot, user_id: int, guild_id: int) -> None:
        super().__init__(timeout=180)
        self.bot = bot
        self.user_id = user_id
        self.guild_id = guild_id

    async def interaction_check(self, interaction: discord.Interaction) -> bool:
        if interaction.user.id != self.user_id:
            await interaction.response.send_message(
                "Das ist nicht dein Warenkorb.", ephemeral=True
            )
            return False
        return True

    async def refresh(self, interaction: discord.Interaction) -> None:
        items = await self.bot.db.cart_get(self.user_id, self.guild_id)
        total = await self.bot.db.cart_total(self.user_id, self.guild_id)
        self.clear_items()

        if items:
            options = [
                discord.SelectOption(
                    label=f"{r['name'][:70]} ×{r['qty']}",
                    value=str(r["item_id"]),
                    description=format_price(float(r["price"]) * int(r["qty"]))[:100],
                )
                for r in items[:25]
            ]
            select = discord.ui.Select(
                placeholder="Item zum Anpassen wählen…", options=options
            )
            select.callback = self._on_item_select  # type: ignore[method-assign]
            self.add_item(select)

            buy_btn = discord.ui.Button(
                label="Kaufen", style=discord.ButtonStyle.success, emoji="💳"
            )
            buy_btn.callback = self._buy  # type: ignore[method-assign]
            self.add_item(buy_btn)

            clear_btn = discord.ui.Button(
                label="Leeren", style=discord.ButtonStyle.danger
            )
            clear_btn.callback = self._clear  # type: ignore[method-assign]
            self.add_item(clear_btn)

        shop_btn = discord.ui.Button(
            label="Weiter einkaufen",
            style=discord.ButtonStyle.primary,
            emoji="🛍️",
        )
        shop_btn.callback = self._continue  # type: ignore[method-assign]
        self.add_item(shop_btn)

        embed = cart_embed(items, total)
        if interaction.response.is_done():
            await interaction.followup.send(embed=embed, view=self, ephemeral=True)
        else:
            await interaction.response.send_message(
                embed=embed, view=self, ephemeral=True
            )
        try:
            self.message = await interaction.original_response()
        except discord.HTTPException:
            pass

    async def _on_item_select(self, interaction: discord.Interaction) -> None:
        select: discord.ui.Select = [
            c for c in self.children if isinstance(c, discord.ui.Select)
        ][0]
        item_id = int(select.values[0])
        view = CartItemAdjustView(self.bot, self.user_id, self.guild_id, item_id, self)
        await interaction.response.send_message(
            "Menge anpassen:", view=view, ephemeral=True
        )
        view.message = await interaction.original_response()

    async def _clear(self, interaction: discord.Interaction) -> None:
        await self.bot.db.cart_clear(self.user_id, self.guild_id)
        await interaction.response.send_message(
            embed=success_embed("Warenkorb geleert"), ephemeral=True
        )

    async def _continue(self, interaction: discord.Interaction) -> None:
        await _browse_categories(self.bot, interaction)

    async def _buy(self, interaction: discord.Interaction) -> None:
        await start_checkout(self.bot, interaction)


class CartItemAdjustView(SafeView):
    def __init__(
        self,
        bot: ShopBot,
        user_id: int,
        guild_id: int,
        item_id: int,
        parent: CartView,
    ) -> None:
        super().__init__(timeout=60)
        self.bot = bot
        self.user_id = user_id
        self.guild_id = guild_id
        self.item_id = item_id
        self.parent = parent

    async def _current_qty(self) -> int:
        items = await self.bot.db.cart_get(self.user_id, self.guild_id)
        for r in items:
            if int(r["item_id"]) == self.item_id:
                return int(r["qty"])
        return 0

    @discord.ui.button(label="+1", style=discord.ButtonStyle.success)
    async def plus(
        self, interaction: discord.Interaction, button: discord.ui.Button
    ) -> None:
        qty = await self._current_qty()
        await self.bot.db.cart_set_qty(
            self.user_id, self.guild_id, self.item_id, qty + 1
        )
        await interaction.response.send_message(
            embed=success_embed("Menge erhöht", f"Neue Menge: {qty + 1}"),
            ephemeral=True,
        )

    @discord.ui.button(label="-1", style=discord.ButtonStyle.secondary)
    async def minus(
        self, interaction: discord.Interaction, button: discord.ui.Button
    ) -> None:
        qty = await self._current_qty()
        new_qty = max(0, qty - 1)
        await self.bot.db.cart_set_qty(
            self.user_id, self.guild_id, self.item_id, new_qty
        )
        await interaction.response.send_message(
            embed=success_embed(
                "Aktualisiert",
                f"Neue Menge: {new_qty}" if new_qty else "Item entfernt.",
            ),
            ephemeral=True,
        )

    @discord.ui.button(label="Entfernen", style=discord.ButtonStyle.danger)
    async def remove(
        self, interaction: discord.Interaction, button: discord.ui.Button
    ) -> None:
        await self.bot.db.cart_remove(self.user_id, self.guild_id, self.item_id)
        await interaction.response.send_message(
            embed=success_embed("Entfernt", "Item aus dem Warenkorb entfernt."),
            ephemeral=True,
        )
