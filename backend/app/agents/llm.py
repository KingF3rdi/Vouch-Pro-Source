"""Resolve Helix models → LangChain chat models (frontier quality, unlimited tokens)."""

from __future__ import annotations

from typing import Any

import httpx
from langchain_core.language_models.chat_models import BaseChatModel
from langchain_openai import ChatOpenAI

from app.agents.models_catalog import HelixModelProfile
from app.core.config import Settings, get_settings

GATEWAY_BASE = "https://ai-gateway.vercel.sh/v1"


class ModelConfigError(RuntimeError):
    """User-facing configuration problem (missing keys / offline local model)."""


def _output_token_kwargs(settings: Settings, *, require_max_tokens: bool = False) -> dict[str, Any]:
    """
    HELIX_MAX_TOKENS=0 → unlimited.
    OpenAI-compatible APIs: omit max_tokens for full provider budget.
    Anthropic: requires an explicit max_tokens — use 128k when unlimited.
    """
    mt = settings.effective_max_tokens
    if mt is None:
        if require_max_tokens:
            return {"max_tokens": 128_000}
        return {}
    return {"max_tokens": mt}


def _ollama_reachable(base_url: str) -> bool:
    # base_url like http://127.0.0.1:11434/v1 → probe /api/tags on host
    root = base_url.rstrip("/")
    if root.endswith("/v1"):
        root = root[:-3]
    try:
        res = httpx.get(f"{root}/api/tags", timeout=1.5)
        return res.status_code < 500
    except httpx.HTTPError:
        return False


def resolve_chat_model(
    profile: HelixModelProfile,
    *,
    settings: Settings | None = None,
    provider_override: str | None = None,
    model_override: str | None = None,
) -> tuple[BaseChatModel, str, str]:
    """Returns (llm, resolved_engine, route_used)."""
    cfg = settings or get_settings()
    common: dict[str, Any] = {
        "temperature": cfg.temperature,
        "streaming": True,
        **_output_token_kwargs(cfg),
    }

    if provider_override == "ollama" and model_override:
        return _ollama(model_override, cfg, common)

    if provider_override == "openai" and model_override:
        if not cfg.openai_api_key:
            raise ModelConfigError("OPENAI_API_KEY is missing in .env")
        llm = ChatOpenAI(model=model_override, api_key=cfg.openai_api_key, **common)
        return llm, model_override, "openai"

    if provider_override == "anthropic" and model_override:
        return _anthropic(model_override, cfg)

    if provider_override == "gateway" and model_override:
        return _gateway(model_override, cfg, common)

    # Helix Local → Ollama
    if profile.route == "ollama":
        engine = cfg.helix_local_model if profile.id == "helix-local" else profile.engine
        return _ollama(engine, cfg, common)

    # Frontier via AI Gateway
    gateway_key = cfg.ai_gateway_api_key or cfg.vercel_oidc_token
    if gateway_key:
        return _gateway(profile.engine, cfg, common)

    # Direct provider keys
    if profile.engine.startswith("anthropic/") and cfg.anthropic_api_key:
        return _anthropic(profile.engine.split("/", 1)[1], cfg)

    if profile.engine.startswith("openai/") and cfg.openai_api_key:
        model_id = profile.engine.split("/", 1)[1]
        llm = ChatOpenAI(model=model_id, api_key=cfg.openai_api_key, **common)
        return llm, profile.engine, "openai"

    # Optional graceful local fallback only if Ollama is actually up
    if _ollama_reachable(cfg.ollama_base_url):
        return _ollama(cfg.helix_local_model, cfg, common)

    raise ModelConfigError(
        "No frontier LLM credentials configured and Ollama is not reachable. "
        "For Helix Code / Astra / Fable quality, set AI_GATEWAY_API_KEY "
        "(or OPENAI_API_KEY / ANTHROPIC_API_KEY) in .env. "
        "For offline use: install Ollama, run `ollama pull qwen2.5-coder:14b`, "
        "and select Helix Local. "
        "Token limits stay unlimited (HELIX_MAX_TOKENS=0, HELIX_MAX_STEPS=0)."
    )


def _gateway(
    engine: str,
    cfg: Settings,
    common: dict[str, Any],
) -> tuple[BaseChatModel, str, str]:
    key = cfg.ai_gateway_api_key or cfg.vercel_oidc_token
    if not key:
        raise ModelConfigError("AI_GATEWAY_API_KEY (or VERCEL_OIDC_TOKEN) is missing")
    llm = ChatOpenAI(
        model=engine,
        api_key=key,
        base_url=cfg.ai_gateway_base_url or GATEWAY_BASE,
        **common,
    )
    return llm, engine, "gateway"


def _ollama(
    engine: str,
    cfg: Settings,
    common: dict[str, Any],
) -> tuple[BaseChatModel, str, str]:
    if not _ollama_reachable(cfg.ollama_base_url):
        raise ModelConfigError(
            f"Ollama is not reachable at {cfg.ollama_base_url}. "
            "Start Ollama and pull your local coder, e.g. "
            f"`ollama pull {engine}`."
        )
    llm = ChatOpenAI(
        model=engine,
        api_key=cfg.ollama_api_key,
        base_url=cfg.ollama_base_url,
        **common,
    )
    return llm, engine, "ollama"


def _anthropic(model_id: str, cfg: Settings) -> tuple[BaseChatModel, str, str]:
    try:
        from langchain_anthropic import ChatAnthropic
    except ImportError as exc:
        raise ModelConfigError("langchain-anthropic is required for Anthropic models") from exc
    if not cfg.anthropic_api_key:
        raise ModelConfigError("ANTHROPIC_API_KEY is missing in .env")
    max_tokens = cfg.effective_max_tokens or 128_000
    llm = ChatAnthropic(
        model=model_id,
        api_key=cfg.anthropic_api_key,
        temperature=cfg.temperature,
        max_tokens=max_tokens,
        streaming=True,
    )
    return llm, f"anthropic/{model_id}", "anthropic"
