"""Coding agent — modular tool-use agent with clear error boundaries."""

from __future__ import annotations

from collections.abc import AsyncIterator
from pathlib import Path
from typing import Any

from app.agents.models_catalog import get_helix_model
from app.agents.tools.fs_tools import ToolError, CODING_TOOLS
from app.models.schemas import AgentEvent, AgentMode, ChatRequest, UIMessage


class CodingAgent:
    """
    Responsibility: explore workspace, edit files, run commands, stream progress.
    Error boundary: tool failures become AgentEvent(type=error|tool_result), never crash the API.
    """

    name = "coding-agent"

    def __init__(self, workspace: Path) -> None:
        self.workspace = workspace

    async def run_stream(self, request: ChatRequest) -> AsyncIterator[AgentEvent]:
        profile = get_helix_model(request.helix_model_id)
        yield AgentEvent(
            type="status",
            data={
                "agent": self.name,
                "mode": request.mode,
                "helixModelId": profile.id,
                "engine": profile.engine,
                "message": "Agent started",
            },
        )

        user_text = _last_user_text(request.messages)
        yield AgentEvent(
            type="token",
            data={
                "text": (
                    f"Helix ({profile.name}) received your request on the Python agent runtime.\n\n"
                    f"> {user_text[:400]}\n\n"
                    "I will map the workspace and use tools as needed. "
                    "Wire LLM function-calling (LangChain) with your API keys for full autonomy.\n"
                )
            },
        )

        # Deterministic first tool: list workspace root (demonstrates tool-use path)
        try:
            listing = CODING_TOOLS["list_directory"]["fn"](self.workspace, ".")
            yield AgentEvent(
                type="tool_start",
                data={"tool": "list_directory", "args": {"relative_path": "."}},
            )
            yield AgentEvent(
                type="tool_result",
                data={"tool": "list_directory", "ok": True, "result": listing[:40]},
            )
            yield AgentEvent(
                type="token",
                data={
                    "text": f"Workspace has {len(listing)} top-level entries. "
                    "Continue in Ship / Bug-hunt modes once LLM keys are configured.\n"
                },
            )
        except ToolError as exc:
            yield AgentEvent(type="error", data={"tool": "list_directory", "message": str(exc)})

        yield AgentEvent(type="done", data={"agent": self.name, "ok": True})


def _last_user_text(messages: list[UIMessage]) -> str:
    for message in reversed(messages):
        if message.role != "user":
            continue
        if message.content:
            return message.content
        texts = [
            part.get("text", "")
            for part in message.parts
            if isinstance(part, dict) and part.get("type") == "text"
        ]
        return "\n".join(t for t in texts if t)
    return ""


def agent_for_mode(mode: AgentMode, workspace: Path) -> CodingAgent:
    # Future: ShipAgent, BugHuntAgent with separate responsibilities
    return CodingAgent(workspace)
