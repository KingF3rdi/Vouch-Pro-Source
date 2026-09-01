from __future__ import annotations

from typing import Awaitable, Callable

import discord

from utils.embeds import error_embed
from utils.view_helpers import SafeView

OnConfirmCallback = Callable[[discord.Interaction, list[dict]], Awaitable[None]]


class PanelCategoryConfigView(SafeView):
    """Panel-Kategorien per Klick an/aus — zuverlässiger als Multi-Select."""

    PAGE_SIZE = 10

    def __init__(
        self,
        categories: list[dict],
        *,
        on_confirm: OnConfirmCallback,
        header: str,
        initial_selected_ids: set[int] | list[int] | None = None,
        min_selected: int = 1,
        timeout: float = 600,
    ) -> None:
        super().__init__(timeout=timeout)
        self.all_categories = list(categories)
        self.filtered_categories = list(categories)
        self.on_confirm = on_confirm
        self.header = header
        self.min_selected = min_selected
        self.selected_ids: set[int] = {int(i) for i in (initial_selected_ids or ())}
        self.page = 0
        self._rebuild()

    def _selected_categories(self) -> list[dict]:
        by_id = {int(c["id"]): c for c in self.all_categories}
        return [by_id[i] for i in sorted(self.selected_ids) if i in by_id]

    def _max_page(self) -> int:
        n = len(self.filtered_categories)
        if n == 0:
            return 0
        return max(0, (n - 1) // self.PAGE_SIZE)

    def _status_text(self) -> str:
        selected = self._selected_categories()
        if selected:
            names = ", ".join(f"**{c['name']}**" for c in selected[:15])
            if len(selected) > 15:
                names += f" … (+{len(selected) - 15})"
            picked = f"**Ausgewählt ({len(selected)}):** {names}"
        else:
            picked = "_Noch keine Kategorien ausgewählt._"
        page_info = (
            f"Seite **{self.page + 1}/{self._max_page() + 1}** "
            f"({len(self.filtered_categories)} Kategorien)"
        )
        return (
            f"{self.header}\n\n"
            f"{page_info}\n"
            "Klicke eine Kategorie zum **An-/Abwählen** (✅ = aktiv).\n\n"
            f"{picked}"
        )

    def _rebuild(self) -> None:
        self.clear_items()
        if self.page > self._max_page():
            self.page = self._max_page()

        start = self.page * self.PAGE_SIZE
        page_cats = self.filtered_categories[start : start + self.PAGE_SIZE]

        for idx, cat in enumerate(page_cats):
            cat_id = int(cat["id"])
            selected = cat_id in self.selected_ids
            btn = discord.ui.Button(
                label=(cat["name"] or "?")[:80],
                style=(
                    discord.ButtonStyle.success
                    if selected
                    else discord.ButtonStyle.secondary
                ),
                emoji="✅" if selected else "⬜",
                row=idx // 5,
            )

            async def _toggle(interaction: discord.Interaction, cid: int = cat_id) -> None:
                if cid in self.selected_ids:
                    self.selected_ids.discard(cid)
                else:
                    self.selected_ids.add(cid)
                self.message = interaction.message
                self._rebuild()
                await interaction.response.edit_message(
                    content=self._status_text(), view=self
                )

            btn.callback = _toggle
            self.add_item(btn)

        nav_row = ((len(page_cats) - 1) // 5 + 1) if page_cats else 0
        action_row = min(nav_row + 1, 4)

        prev_btn = discord.ui.Button(
            label="◀",
            style=discord.ButtonStyle.secondary,
            disabled=self.page <= 0,
            row=nav_row,
        )
        prev_btn.callback = self._prev_page
        self.add_item(prev_btn)

        next_btn = discord.ui.Button(
            label="▶",
            style=discord.ButtonStyle.secondary,
            disabled=self.page >= self._max_page(),
            row=nav_row,
        )
        next_btn.callback = self._next_page
        self.add_item(next_btn)

        search_btn = discord.ui.Button(
            label="Suchen",
            style=discord.ButtonStyle.primary,
            emoji="🔍",
            row=nav_row,
        )
        search_btn.callback = self._open_search
        self.add_item(search_btn)

        clear_btn = discord.ui.Button(
            label="Alle abwählen",
            style=discord.ButtonStyle.secondary,
            disabled=not self.selected_ids,
            row=action_row,
        )
        clear_btn.callback = self._clear_all
        self.add_item(clear_btn)

        save_btn = discord.ui.Button(
            label="Speichern",
            style=discord.ButtonStyle.success,
            disabled=len(self.selected_ids) < self.min_selected,
            row=action_row,
        )
        save_btn.callback = self._save
        self.add_item(save_btn)

        cancel_btn = discord.ui.Button(
            label="Abbrechen",
            style=discord.ButtonStyle.danger,
            row=action_row,
        )
        cancel_btn.callback = self._cancel
        self.add_item(cancel_btn)

    async def _prev_page(self, interaction: discord.Interaction) -> None:
        self.page = max(0, self.page - 1)
        self.message = interaction.message
        self._rebuild()
        await interaction.response.edit_message(content=self._status_text(), view=self)

    async def _next_page(self, interaction: discord.Interaction) -> None:
        self.page = min(self._max_page(), self.page + 1)
        self.message = interaction.message
        self._rebuild()
        await interaction.response.edit_message(content=self._status_text(), view=self)

    async def _clear_all(self, interaction: discord.Interaction) -> None:
        self.selected_ids.clear()
        self.message = interaction.message
        self._rebuild()
        await interaction.response.edit_message(content=self._status_text(), view=self)

    async def _open_search(self, interaction: discord.Interaction) -> None:
        self.message = interaction.message
        await interaction.response.send_modal(_PanelSearchModal(self))

    async def apply_search(self, interaction: discord.Interaction, query: str) -> None:
        q = query.strip().lower()
        if not q:
            self.filtered_categories = list(self.all_categories)
        else:
            self.filtered_categories = [
                c
                for c in self.all_categories
                if q in (c.get("name") or "").lower()
                or q in (c.get("description") or "").lower()
                or q == str(c.get("id"))
            ]
        if not self.filtered_categories:
            await interaction.response.send_message(
                embed=error_embed("Keine Treffer", f"Nichts für `{query}`."),
                ephemeral=True,
            )
            return
        self.page = 0
        self.message = interaction.message
        self._rebuild()
        await interaction.response.edit_message(
            content=self._status_text(), view=self
        )

    async def _save(self, interaction: discord.Interaction) -> None:
        if len(self.selected_ids) < self.min_selected:
            await interaction.response.send_message(
                embed=error_embed(
                    "Zu wenig ausgewählt",
                    f"Mindestens **{self.min_selected}** Kategorie(n) nötig.",
                ),
                ephemeral=True,
            )
            return
        self.stop()
        if not interaction.response.is_done():
            await interaction.response.defer(ephemeral=True)
        await self.on_confirm(interaction, self._selected_categories())

    async def _cancel(self, interaction: discord.Interaction) -> None:
        self.stop()
        await interaction.response.edit_message(content="Abgebrochen.", view=None)


class _PanelSearchModal(discord.ui.Modal, title="Kategorie suchen"):
    query = discord.ui.TextInput(
        label="Suchbegriff",
        placeholder="Name oder ID…",
        max_length=100,
        required=True,
    )

    def __init__(self, parent: PanelCategoryConfigView) -> None:
        super().__init__()
        self.parent = parent

    async def on_submit(self, interaction: discord.Interaction) -> None:
        await self.parent.apply_search(interaction, str(self.query.value))
