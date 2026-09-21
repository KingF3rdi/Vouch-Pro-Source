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
    vercel_oidc_token: str | None = Field(default=None, validation_alias="VERCEL_OIDC_TOKEN")
    openai_api_key: str | None = Field(default=None, validation_alias="OPENAI_API_KEY")
    anthropic_api_key: str | None = Field(default=None, validation_alias="ANTHROPIC_API_KEY")
    ollama_base_url: str = Field(
        default="http://127.0.0.1:11434/v1",
        validation_alias="OLLAMA_BASE_URL",
    )
    ollama_api_key: str = Field(default="ollama", validation_alias="OLLAMA_API_KEY")
    helix_local_model: str = Field(
        default="qwen2.5-coder:14b",
        validation_alias="HELIX_LOCAL_MODEL",
    )
    github_token: str | None = Field(default=None, validation_alias="GITHUB_TOKEN")
    ai_gateway_base_url: str = Field(
        default="https://ai-gateway.vercel.sh/v1",
        validation_alias="AI_GATEWAY_BASE_URL",
    )
    # 0 = unlimited (use provider maximum / no soft stop)
    max_tokens: int = Field(default=0, validation_alias="HELIX_MAX_TOKENS")
    max_steps: int = Field(default=0, validation_alias="HELIX_MAX_STEPS")
    # Absolute safety ceiling so a broken loop cannot run forever
    hard_step_cap: int = Field(default=1000, validation_alias="HELIX_HARD_STEP_CAP")
    # 0 = no truncation on tool file reads
    tool_read_max_chars: int = Field(default=0, validation_alias="HELIX_TOOL_READ_MAX_CHARS")
    temperature: float = Field(default=0.2, validation_alias="HELIX_TEMPERATURE")

    def model_post_init(self, __context: object) -> None:  # noqa: ANN001
        ws = self.workspace
        if not ws.is_absolute():
            ws = (Path.cwd() / ws).resolve()
        object.__setattr__(self, "workspace", ws)

    @property
    def effective_max_tokens(self) -> int | None:
        """None / omitted means unlimited (provider max)."""
        if self.max_tokens <= 0:
            return None
        return self.max_tokens

    @property
    def effective_max_steps(self) -> int:
        if self.max_steps <= 0:
            return max(1, self.hard_step_cap)
        return min(self.max_steps, self.hard_step_cap)


@lru_cache
def get_settings() -> Settings:
    return Settings()
