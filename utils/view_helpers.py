from __future__ import annotations

import traceback

import discord

from utils.embeds import error_embed


class SafeView(discord.ui.View):
    """Basis-View mit Fehler- und Timeout-Behandlung.

    Ohne das hier bleibt eine Discord-Interaktion für den Nutzer für immer
    hängen ("Die Anwendung reagiert nicht"), sobald in einem Button-/Select-
    Callback eine Exception auftritt oder die View bereits getimeoutet ist.
    SafeView fängt beides ab:
      - on_error: loggt den Traceback und antwortet dem Nutzer trotzdem
        (statt die Interaktion unbeantwortet zu lassen).
      - on_timeout: deaktiviert alle Buttons/Selects sichtbar, statt sie
        tot aber anklickbar aussehen zu lassen.
    Dafür muss `self.message` nach dem Senden gesetzt werden, z. B.:
        view.message = await interaction.original_response()
    """

    def __init__(self, *args, **kwargs) -> None:
        super().__init__(*args, **kwargs)
        self.message: discord.Message | None = None

    async def on_error(
        self,
        interaction: discord.Interaction,
        error: Exception,
        item: discord.ui.Item,
    ) -> None:
        print(f"[View-Fehler] {self.__class__.__name__} / {item}: {error!r}")
        traceback.print_exception(type(error), error, error.__traceback__)
        embed = error_embed(
            "Fehler",
            "Da ist etwas schiefgelaufen. Bitte versuch es erneut "
            "(ggf. Panel neu öffnen).",
        )
        try:
            if interaction.response.is_done():
                await interaction.followup.send(embed=embed, ephemeral=True)
            else:
                await interaction.response.send_message(embed=embed, ephemeral=True)
        except discord.HTTPException:
            pass

    async def on_timeout(self) -> None:
        for child in self.children:
            if hasattr(child, "disabled"):
                child.disabled = True  # type: ignore[attr-defined]
        if self.message is not None:
            try:
                await self.message.edit(view=self)
            except (discord.HTTPException, discord.NotFound):
                pass
