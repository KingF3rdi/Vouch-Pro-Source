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
    frontend_url: str = "http://localhost:3000"
    upload_dir: str = "./uploads"
    default_discount_percent: int = 10

    class Config:
        env_file = ".env"


settings = Settings()
