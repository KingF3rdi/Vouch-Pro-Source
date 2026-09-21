from __future__ import annotations

from typing import Any, Literal

from pydantic import BaseModel, Field


ProviderKind = Literal["ollama", "openai", "anthropic", "gateway", "groq", "openrouter", "free-auto"]
AgentMode = Literal["chat", "bug-hunt", "ship"]
HelixModelId = Literal[
    "helix-free",
    "helix-code",
    "helix-astra",
    "helix-fable",
    "helix-local",
    "helix-groq",
    "helix-openrouter",
]


class HealthResponse(BaseModel):
    ok: bool = True
    name: str = "helix-agent"
    version: str = "0.5.0"
    backend: str = "python-fastapi"


class AgentSettings(BaseModel):
    provider: str
    model: str
    workspace: str
    helix_model_id: str = Field(alias="helixModelId")
    helix_model_name: str = Field(alias="helixModelName")
    max_tokens: int | str = Field(default="unlimited", alias="maxTokens")
    max_steps: int | str = Field(default="unlimited", alias="maxSteps")
    hard_step_cap: int = Field(default=1000, alias="hardStepCap")

    model_config = {"populate_by_name": True}


class HelixModelProfile(BaseModel):
    id: HelixModelId
    name: str
    description: str
    badge: str
    engine: str
    route: Literal["gateway", "anthropic", "openai", "ollama", "groq", "openrouter", "free-auto"]


class ModelsResponse(BaseModel):
    models: list[HelixModelProfile]
    selected: HelixModelId
    gateway_configured: bool = Field(alias="gatewayConfigured")
    anthropic_configured: bool = Field(alias="anthropicConfigured")
    openai_configured: bool = Field(alias="openaiConfigured")

    model_config = {"populate_by_name": True}


class SelectModelRequest(BaseModel):
    model_id: HelixModelId = Field(alias="modelId")
    workspace: str | None = None

    model_config = {"populate_by_name": True}


class SelectModelResponse(BaseModel):
    ok: bool = True
    selected: HelixModelId
    profile: HelixModelProfile


class UIMessagePart(BaseModel):
    type: str
    text: str | None = None
    # Tool / other parts allowed as loose payload
    model_config = {"extra": "allow"}


class UIMessage(BaseModel):
    id: str
    role: Literal["system", "user", "assistant"]
    parts: list[dict[str, Any]] = Field(default_factory=list)
    content: str | None = None


class ChatRequest(BaseModel):
    messages: list[UIMessage]
    skill_ids: list[str] | None = Field(default=None, alias="skillIds")
    provider: ProviderKind | None = None
    model: str | None = None
    workspace: str | None = None
    mode: AgentMode = "chat"
    helix_model_id: HelixModelId | None = Field(default=None, alias="helixModelId")

    model_config = {"populate_by_name": True}


class SkillSummary(BaseModel):
    id: str
    name: str
    description: str


class PluginManifest(BaseModel):
    id: str
    name: str
    description: str
    version: str
    enabled: bool = True


class ProjectMap(BaseModel):
    root: str
    top_level: list[str] = Field(alias="topLevel")
    markers: list[str]
    likely_stack: list[str] = Field(alias="likelyStack")
    key_files: list[str] = Field(alias="keyFiles")
    summary: str

    model_config = {"populate_by_name": True}


class FsEntry(BaseModel):
    name: str
    type: Literal["dir", "file"]
    path: str


class FsTreeResponse(BaseModel):
    path: str
    entries: list[FsEntry]


class FsFileResponse(BaseModel):
    path: str
    content: str


class FsWriteRequest(BaseModel):
    path: str
    content: str
    workspace: str | None = None


class BuildStep(BaseModel):
    id: str
    label: str
    command: str
    kind: Literal["typecheck", "build", "test", "package", "compile"]


class BuildPipeline(BaseModel):
    stack: list[str]
    steps: list[BuildStep]
    artifact_globs: list[str] = Field(alias="artifactGlobs")
    notes: list[str]

    model_config = {"populate_by_name": True}


class Artifact(BaseModel):
    path: str
    size: int
    mtime: str


class AgentEvent(BaseModel):
    """WebSocket / SSE event from Python agents to the TypeScript UI."""

    type: Literal[
        "status",
        "token",
        "tool_start",
        "tool_result",
        "error",
        "done",
    ]
    data: dict[str, Any] = Field(default_factory=dict)


class StoredSession(BaseModel):
    id: str
    title: str
    created_at: str = Field(alias="createdAt")
    updated_at: str = Field(alias="updatedAt")
    mode: AgentMode = "chat"
    skill_ids: list[str] = Field(default_factory=list, alias="skillIds")
    messages: list[dict[str, Any]] = Field(default_factory=list)

    model_config = {"populate_by_name": True}


class CreateSessionRequest(BaseModel):
    title: str | None = None
    mode: AgentMode = "chat"
    skill_ids: list[str] | None = Field(default=None, alias="skillIds")
    workspace: str | None = None

    model_config = {"populate_by_name": True}


class UpdateSessionRequest(BaseModel):
    title: str | None = None
    mode: AgentMode | None = None
    skill_ids: list[str] | None = Field(default=None, alias="skillIds")
    messages: list[dict[str, Any]] | None = None
    workspace: str | None = None

    model_config = {"populate_by_name": True}


class GitDiffRequest(BaseModel):
    path: str
    content: str | None = None
    workspace: str | None = None


class ShipRunRequest(BaseModel):
    workspace: str | None = None


class GithubConnectRequest(BaseModel):
    token: str
    workspace: str | None = None


class GithubCommitRequest(BaseModel):
    message: str
    paths: list[str] | None = None
    workspace: str | None = None


class GithubPushRequest(BaseModel):
    set_upstream: bool = Field(default=True, alias="setUpstream")
    workspace: str | None = None

    model_config = {"populate_by_name": True}


class McpConfigRequest(BaseModel):
    config: dict[str, Any]
    workspace: str | None = None
