from __future__ import annotations

from pathlib import Path

from app.models.schemas import HelixModelId, HelixModelProfile

HELIX_MODELS: list[HelixModelProfile] = [
    HelixModelProfile(
        id="helix-free",  # type: ignore[arg-type]
        name="Helix Free",
        description="Zero-cost coding agent via Ollama + curriculum (no paid API keys).",
        badge="free",
        engine="qwen2.5-coder:3b",
        route="ollama",
    ),
    HelixModelProfile(
        id="helix-code",
        name="Helix Code",
        description="Helix flagship coding model — frontier agent quality (Astra / Fable class).",
        badge="recommended",
        engine="openai/gpt-6-astra",
        route="gateway",
    ),
    HelixModelProfile(
        id="helix-astra",
        name="Helix Astra",
        description="Helix profile on GPT-6 Astra for deep multi-file coding agents.",
        badge="gpt-6-astra",
        engine="openai/gpt-6-astra",
        route="gateway",
    ),
    HelixModelProfile(
        id="helix-fable",
        name="Helix Fable",
        description="Helix profile on Claude Fable 5.1 for careful refactors and reasoning.",
        badge="claude-fable-5.1",
        engine="anthropic/claude-fable-5.1",
        route="gateway",
    ),
    HelixModelProfile(
        id="helix-local",
        name="Helix Local",
        description="Fully local coding model via Ollama (qwen2.5-coder).",
        badge="offline",
        engine="qwen2.5-coder:3b",
        route="ollama",
    ),
]


def get_helix_model(model_id: str | None) -> HelixModelProfile:
    for profile in HELIX_MODELS:
        if profile.id == model_id:
            return profile
    return HELIX_MODELS[0]



def settings_path(workspace: Path) -> Path:
    return workspace / ".helix" / "settings.json"


def load_selected_model(workspace: Path) -> HelixModelId:
    path = settings_path(workspace)
    if not path.exists():
        return "helix-code"
    import json

    raw = json.loads(path.read_text(encoding="utf-8"))
    return get_helix_model(raw.get("modelId")).id  # type: ignore[return-value]


def save_selected_model(workspace: Path, model_id: str) -> HelixModelId:
    import json

    profile = get_helix_model(model_id)
    path = settings_path(workspace)
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps({"modelId": profile.id}, indent=2), encoding="utf-8")
    return profile.id  # type: ignore[return-value]
