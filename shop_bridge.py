"""
TxTEmpire Shop Bridge — automatische Einbindung in den Discord Bot.
Wird von main.py und adminCommands.py genutzt.
"""

import os

_shop_instance = None


def get_shop():
    global _shop_instance
    if _shop_instance is None:
        try:
            from discord_integration.discord_integration import ShopIntegration

            _shop_instance = ShopIntegration(
                api_url=os.getenv("SHOP_API_URL", "http://localhost:8000"),
                api_key=os.getenv("BOT_API_KEY", "change-bot-api-key"),
            )
        except Exception as e:
            print(f"[TxTEmpire Shop] Integration nicht geladen: {e}")
            _shop_instance = None
    return _shop_instance


async def handle_shop_command(message) -> bool:
    shop = get_shop()
    if not shop:
        return False
    return await shop.handle_command(message)


async def sync_vouch_to_shop(giver_name: str, message: str, is_positive: bool, external_id: int):
    shop = get_shop()
    if not shop:
        return
    try:
        await shop.sync_vouch(giver_name, message, is_positive, external_id)
    except Exception as e:
        print(f"[TxTEmpire Shop] Vouch sync fehlgeschlagen: {e}")
