from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    database_url: str = "sqlite+aiosqlite:///./shop.db"
    secret_key: str = "change-me-in-production"
    bot_api_key: str = "change-bot-api-key"
    discord_client_id: str = ""
    discord_client_secret: str = ""
    discord_redirect_uri: str = "http://localhost:3000/api/auth/discord/callback"
    discord_bot_token: str = ""
    discord_guild_id: str = ""
    discord_ticket_category_id: str = ""
    discord_purchase_log_channel_id: str = ""
    discord_vouch_channel_id: str = ""
    discord_invite_url: str = "https://discord.gg/UjH99aR5ph"
    frontend_url: str = "http://localhost:3000"
    upload_dir: str = "./uploads"
    default_discount_percent: int = 10
    admin_discord_ids: str = ""
    shop_owner_ign: str = ""
    shop_bot_ign: str = "ShopBot"

    @property
    def payment_recipient_ign(self) -> str:
        """Zahlungsempfänger = Bot-Account, sofern kein eigener Shop-Owner gesetzt."""
        override = self.shop_owner_ign.strip()
        if override:
            return override
        return self.shop_bot_ign

    def get_admin_discord_ids(self) -> list[str]:
        if not self.admin_discord_ids.strip():
            return []
        return [part.strip() for part in self.admin_discord_ids.split(",") if part.strip()]

    def is_admin_discord_id(self, discord_id: str | None) -> bool:
        if not discord_id:
            return False
        return discord_id in self.get_admin_discord_ids()

    # Rate limits: (max_requests, window_seconds)
    rate_limit_default_max: int = 120
    rate_limit_default_window: int = 60
    rate_limit_search_max: int = 40
    rate_limit_search_window: int = 60
    rate_limit_write_max: int = 30
    rate_limit_write_window: int = 60
    rate_limit_auth_max: int = 15
    rate_limit_auth_window: int = 60

    @property
    def rate_limit_default(self) -> tuple[int, int]:
        return (self.rate_limit_default_max, self.rate_limit_default_window)

    @property
    def rate_limit_search(self) -> tuple[int, int]:
        return (self.rate_limit_search_max, self.rate_limit_search_window)

    @property
    def rate_limit_write(self) -> tuple[int, int]:
        return (self.rate_limit_write_max, self.rate_limit_write_window)

    @property
    def rate_limit_auth(self) -> tuple[int, int]:
        return (self.rate_limit_auth_max, self.rate_limit_auth_window)

    class Config:
        env_file = ".env"


settings = Settings()
