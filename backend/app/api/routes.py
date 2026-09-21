from __future__ import annotations

import json
from pathlib import Path

from fastapi import APIRouter, HTTPException, WebSocket, WebSocketDisconnect
from fastapi.responses import StreamingResponse

from app.agents.coding_agent import agent_for_mode
from app.agents.models_catalog import (
    HELIX_MODELS,
    get_helix_model,
    load_selected_model,
    save_selected_model,
)
from app.agents.tools.fs_tools import list_directory, read_file, write_file
from app.core.config import get_settings
from app.models.schemas import (
    AgentSettings,
    ChatRequest,
    CreateSessionRequest,
    FsFileResponse,
    FsTreeResponse,
    FsWriteRequest,
    GithubCommitRequest,
    GithubConnectRequest,
    GithubPushRequest,
    GitDiffRequest,
    HealthResponse,
    McpConfigRequest,
    ModelsResponse,
    PluginManifest,
    SelectModelRequest,
    SelectModelResponse,
    ShipRunRequest,
    SkillSummary,
    UpdateSessionRequest,
)
from app.services import github_svc, git_svc, mcp_svc, sessions
from app.services.project import build_project_map, detect_build_pipeline, list_artifacts
from app.services.ship import run_full_ship

router = APIRouter()


def _workspace(raw: str | None = None) -> Path:
    settings = get_settings()
    return Path(raw).resolve() if raw else settings.workspace


@router.get("/health", response_model=HealthResponse)
def health() -> HealthResponse:
    return HealthResponse()


@router.get("/settings", response_model=AgentSettings)
def settings() -> AgentSettings:
    cfg = get_settings()
    selected = load_selected_model(cfg.workspace)
    profile = get_helix_model(selected)
    return AgentSettings(
        provider=profile.route,
        model=profile.engine,
        workspace=str(cfg.workspace),
        helixModelId=profile.id,
        helixModelName=profile.name,
        maxTokens="unlimited" if cfg.max_tokens <= 0 else cfg.max_tokens,
        maxSteps="unlimited" if cfg.max_steps <= 0 else cfg.max_steps,
        hardStepCap=cfg.hard_step_cap,
    )


@router.get("/models", response_model=ModelsResponse)
def models() -> ModelsResponse:
    cfg = get_settings()
    selected = load_selected_model(cfg.workspace)
    return ModelsResponse(
        models=HELIX_MODELS,
        selected=selected,
        gatewayConfigured=bool(cfg.ai_gateway_api_key),
        anthropicConfigured=bool(cfg.anthropic_api_key),
        openaiConfigured=bool(cfg.openai_api_key),
    )


@router.put("/models/selected", response_model=SelectModelResponse)
def select_model(body: SelectModelRequest) -> SelectModelResponse:
    workspace = _workspace(body.workspace)
    selected = save_selected_model(workspace, body.model_id)
    profile = get_helix_model(selected)
    return SelectModelResponse(selected=selected, profile=profile)


@router.get("/skills")
def skills() -> dict[str, list[SkillSummary]]:
    root = get_settings().workspace / "skills"
    out: list[SkillSummary] = []
    if root.exists():
        for folder in sorted(root.iterdir()):
            skill_md = folder / "SKILL.md"
            if not skill_md.exists():
                continue
            text = skill_md.read_text(encoding="utf-8")
            name = folder.name
            description = "Helix skill"
            for line in text.splitlines():
                if line.startswith("name:"):
                    name = line.split(":", 1)[1].strip().strip("\"'")
                if line.startswith("description:"):
                    description = line.split(":", 1)[1].strip().strip("\"'")
            out.append(SkillSummary(id=folder.name, name=name, description=description))
    return {"skills": out}


@router.get("/plugins")
def plugins() -> dict[str, list[PluginManifest]]:
    return {
        "plugins": [
            PluginManifest(
                id="python-fs",
                name="Python FS Tools",
                description="Workspace list/read/write/terminal tools on the FastAPI agent runtime.",
                version="0.1.0",
                enabled=True,
            )
        ]
    }


@router.get("/project/map")
def project_map(workspace: str | None = None):
    return build_project_map(_workspace(workspace))


@router.get("/fs/tree", response_model=FsTreeResponse)
def fs_tree(path: str = ".", workspace: str | None = None) -> FsTreeResponse:
    ws = _workspace(workspace)
    entries = list_directory(ws, path)
    return FsTreeResponse(path=path, entries=entries)  # type: ignore[arg-type]


@router.get("/fs/file", response_model=FsFileResponse)
def fs_file(path: str, workspace: str | None = None) -> FsFileResponse:
    result = read_file(_workspace(workspace), path)
    return FsFileResponse(path=path, content=result["content"])


@router.put("/fs/file")
def fs_write(body: FsWriteRequest) -> dict[str, object]:
    return write_file(_workspace(body.workspace), body.path, body.content)


@router.get("/git/status")
def git_status(workspace: str | None = None):
    return {"files": git_svc.get_git_status(_workspace(workspace))}


@router.get("/git/diff")
def git_diff_get(path: str, workspace: str | None = None):
    return git_svc.get_file_diff(_workspace(workspace), path)


@router.post("/git/diff")
def git_diff_post(body: GitDiffRequest):
    return git_svc.get_file_diff(_workspace(body.workspace), body.path, body.content)


@router.get("/sessions")
def sessions_list(workspace: str | None = None):
    items = sessions.list_sessions(_workspace(workspace))
    return {"sessions": [s.model_dump(by_alias=True) for s in items]}


@router.post("/sessions")
def sessions_create(body: CreateSessionRequest):
    session = sessions.create_session(
        _workspace(body.workspace),
        title=body.title,
        mode=body.mode,
        skill_ids=body.skill_ids,
    )
    return {"session": session.model_dump(by_alias=True)}


@router.get("/sessions/{session_id}")
def sessions_get(session_id: str, workspace: str | None = None):
    session = sessions.get_session(_workspace(workspace), session_id)
    if not session:
        raise HTTPException(status_code=404, detail="not found")
    return {"session": session.model_dump(by_alias=True)}


@router.put("/sessions/{session_id}")
def sessions_put(session_id: str, body: UpdateSessionRequest):
    ws = _workspace(body.workspace)
    existing = sessions.get_session(ws, session_id)
    if not existing:
        raise HTTPException(status_code=404, detail="not found")
    updates: dict = {}
    if body.title is not None:
        updates["title"] = body.title
    if body.mode is not None:
        updates["mode"] = body.mode
    if body.skill_ids is not None:
        updates["skill_ids"] = body.skill_ids
    if body.messages is not None:
        updates["messages"] = body.messages
    next_session = sessions.save_session(ws, existing.model_copy(update=updates))
    return {"session": next_session.model_dump(by_alias=True)}


@router.delete("/sessions/{session_id}")
def sessions_delete(session_id: str, workspace: str | None = None):
    sessions.delete_session(_workspace(workspace), session_id)
    return {"ok": True}


@router.get("/mcp")
async def mcp_get(workspace: str | None = None):
    ws = _workspace(workspace)
    config = mcp_svc.ensure_default_mcp_config(ws)
    return {"config": config, "servers": mcp_svc.list_mcp_states(config)}


@router.put("/mcp/config")
async def mcp_put(body: McpConfigRequest):
    ws = _workspace(body.workspace)
    config = mcp_svc.save_mcp_config(ws, body.config)
    servers = await mcp_svc.reconnect_mcp_servers(ws)
    return {"config": config, "servers": servers}


@router.post("/mcp/reconnect")
async def mcp_reconnect(body: dict | None = None):
    ws = _workspace((body or {}).get("workspace"))
    servers = await mcp_svc.reconnect_mcp_servers(ws)
    config = mcp_svc.load_mcp_config(ws)
    return {"config": config, "servers": servers}


@router.get("/ship/pipeline")
def ship_pipeline(workspace: str | None = None):
    return detect_build_pipeline(_workspace(workspace)).model_dump(by_alias=True)


@router.get("/ship/artifacts")
def ship_artifacts(workspace: str | None = None):
    ws = _workspace(workspace)
    pipeline = detect_build_pipeline(ws)
    return {
        "artifacts": list_artifacts(ws, pipeline.artifact_globs),
        "pipeline": pipeline.model_dump(by_alias=True),
    }


@router.post("/ship/run")
async def ship_run(body: ShipRunRequest):
    return await run_full_ship(_workspace(body.workspace))


@router.get("/github/status")
async def github_status(workspace: str | None = None):
    return await github_svc.github_status(_workspace(workspace))


@router.post("/github/connect")
async def github_connect(body: GithubConnectRequest):
    token = body.token.strip()
    if not token:
        raise HTTPException(status_code=400, detail="token required")
    ws = _workspace(body.workspace)
    github_svc.save_secrets(ws, {"githubToken": token})
    status = await github_svc.github_status(ws)
    if status.get("user"):
        github_svc.save_secrets(ws, {"githubUser": status["user"]})
    return {"ok": True, "status": await github_svc.github_status(ws), "saved": True}


@router.post("/github/disconnect")
async def github_disconnect(body: dict | None = None):
    ws = _workspace((body or {}).get("workspace"))
    secrets = github_svc.load_secrets(ws)
    secrets.pop("githubToken", None)
    secrets.pop("githubUser", None)
    path = ws / ".helix" / "secrets.json"
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(secrets, indent=2), encoding="utf-8")
    return {"ok": True, "status": await github_svc.github_status(ws)}


@router.post("/github/commit")
def github_commit(body: GithubCommitRequest):
    message = body.message.strip()
    if not message:
        raise HTTPException(status_code=400, detail="message required")
    return github_svc.git_commit(_workspace(body.workspace), message, body.paths)


@router.post("/github/push")
def github_push(body: GithubPushRequest):
    return github_svc.git_push(_workspace(body.workspace), body.set_upstream)


@router.post("/chat")
async def chat(body: ChatRequest):
    """
    Stream agent events as NDJSON over HTTP.
    TypeScript client should prefer /api/ws/agent for interactive sessions.
    """
    ws = _workspace(body.workspace)
    agent = agent_for_mode(body.mode, ws)

    async def generate():
        async for event in agent.run_stream(body):
            yield json.dumps(event.model_dump()) + "\n"

    return StreamingResponse(generate(), media_type="application/x-ndjson")


@router.websocket("/ws/agent")
async def agent_ws(websocket: WebSocket) -> None:
    await websocket.accept()
    try:
        raw = await websocket.receive_text()
        payload = ChatRequest.model_validate_json(raw)
        workspace = _workspace(payload.workspace)
        agent = agent_for_mode(payload.mode, workspace)
        async for event in agent.run_stream(payload):
            await websocket.send_json(event.model_dump())
    except WebSocketDisconnect:
        return
    except Exception as exc:  # noqa: BLE001 — boundary at socket edge
        try:
            await websocket.send_json({"type": "error", "data": {"message": str(exc)}})
        except Exception:  # noqa: BLE001
            return
