from functools import lru_cache
from pathlib import Path

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=(".env", "../.env"),
        env_file_encoding="utf-8",
        extra="ignore",
        populate_by_name=True,
    )

    port: int = Field(default=8787, validation_alias="HELIX_PORT")
    workspace: Path = Field(default=Path(".."), validation_alias="HELIX_WORKSPACE")
    helix_model: str = Field(default="helix-code", validation_alias="HELIX_MODEL")
    ai_gateway_api_key: str | None = Field(default=None, validation_alias="AI_GATEWAY_API_KEY")
    openai_api_key: str | None = Field(default=None, validation_alias="OPENAI_API_KEY")
    anthropic_api_key: str | None = Field(default=None, validation_alias="ANTHROPIC_API_KEY")
    ollama_base_url: str = Field(
        default="http://127.0.0.1:11434/v1",
        validation_alias="OLLAMA_BASE_URL",
    )
    helix_local_model: str = Field(
        default="qwen2.5-coder:14b",
        validation_alias="HELIX_LOCAL_MODEL",
    )
    github_token: str | None = Field(default=None, validation_alias="GITHUB_TOKEN")

    def model_post_init(self, __context: object) -> None:  # noqa: ANN001
        ws = self.workspace
        if not ws.is_absolute():
            # backend/ cwd → repo root by default
            ws = (Path.cwd() / ws).resolve()
        object.__setattr__(self, "workspace", ws)


@lru_cache
def get_settings() -> Settings:
    return Settings()
