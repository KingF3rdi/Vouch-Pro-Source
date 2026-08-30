"""Optionale Anbindung an die TxTEmpire Website-Shop-API."""

from __future__ import annotations

import httpx

import config


class ShopApiClient:
    def __init__(self) -> None:
        self.api_url = (config.SHOP_API_URL or "").rstrip("/")
        self.api_key = config.BOT_API_KEY or ""
        self.enabled = bool(self.api_url and self.api_key)

    async def sync_vouch(
        self,
        *,
        giver_name: str,
        message: str,
        is_positive: bool,
        external_id: int | None = None,
    ) -> bool:
        if not self.enabled:
            return False
        try:
            async with httpx.AsyncClient(timeout=15) as client:
                resp = await client.post(
                    f"{self.api_url}/api/bot/vouches/sync",
                    headers={
                        "X-Bot-Api-Key": self.api_key,
                        "Content-Type": "application/json",
                    },
                    json={
                        "giver_name": giver_name,
                        "message": message,
                        "is_positive": is_positive,
                        "external_id": external_id,
                    },
                )
                return resp.status_code < 400
        except Exception as exc:
            print(f"[Shop API] Vouch sync fehlgeschlagen: {exc}")
            return False


shop_api = ShopApiClient()
