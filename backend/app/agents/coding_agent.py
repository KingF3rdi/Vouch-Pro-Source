"""Coding agent — modular tool-use agent with frontier quality and unlimited tokens."""

from __future__ import annotations

import json
from collections.abc import AsyncIterator
from pathlib import Path
from typing import Any

from langchain_core.messages import (
    AIMessage,
    BaseMessage,
    HumanMessage,
    SystemMessage,
    ToolMessage,
)

from app.agents.llm import ModelConfigError, resolve_chat_model
from app.agents.models_catalog import get_helix_model
from app.agents.prompts import build_system_prompt
from app.agents.tools.registry import build_agent_tools, tool_by_name
from app.core.config import get_settings
from app.models.schemas import AgentEvent, AgentMode, ChatRequest, UIMessage


class CodingAgent:
    """
    Responsibility: explore workspace, edit files, research, build, stream progress.
    Error boundary: tool/LLM failures become AgentEvent(type=error|tool_result), never crash the API.
    Token policy: HELIX_MAX_TOKENS=0 and HELIX_MAX_STEPS=0 → no soft limits (hard step cap only).
    """

    name = "coding-agent"

    def __init__(self, workspace: Path) -> None:
        self.workspace = workspace

    async def run_stream(self, request: ChatRequest) -> AsyncIterator[AgentEvent]:
        settings = get_settings()
        profile = get_helix_model(request.helix_model_id)
        max_steps = settings.effective_max_steps

        try:
            llm, engine, route = resolve_chat_model(
                profile,
                settings=settings,
                provider_override=request.provider,
                model_override=request.model,
            )
        except ModelConfigError as exc:
            yield AgentEvent(type="error", data={"message": str(exc), "code": "model_config"})
            yield AgentEvent(
                type="token",
                data={
                    "text": (
                        "### Helix needs a model backend\n\n"
                        "Frontier agent quality (Astra / Fable class) requires API access:\n\n"
                        "1. Set `AI_GATEWAY_API_KEY` in `.env` for **Helix Code / Astra / Fable**, or\n"
                        "2. Set `OPENAI_API_KEY` / `ANTHROPIC_API_KEY`, or\n"
                        "3. Run Ollama locally and pick **Helix Local**\n\n"
                        "Once connected, Helix runs with **unlimited tokens** "
                        "(`HELIX_MAX_TOKENS=0`) and up to "
                        f"**{settings.effective_max_steps} tool steps** "
                        "(`HELIX_MAX_STEPS=0` = no soft limit).\n"
                    )
                },
            )
            yield AgentEvent(type="done", data={"agent": self.name, "ok": False})
            return
        except Exception as exc:  # noqa: BLE001
            yield AgentEvent(type="error", data={"message": f"Model resolve failed: {exc}"})
            yield AgentEvent(type="done", data={"agent": self.name, "ok": False})
            return

        yield AgentEvent(
            type="status",
            data={
                "agent": self.name,
                "mode": request.mode,
                "helixModelId": profile.id,
                "engine": engine,
                "route": route,
                "maxSteps": max_steps,
                "maxTokens": settings.max_tokens if settings.max_tokens > 0 else "unlimited",
                "message": f"Helix {profile.name} ready ({engine}) — unlimited token budget",
            },
        )

        tools = build_agent_tools(self.workspace)
        tools_map = tool_by_name(tools)
        llm_with_tools = llm.bind_tools(tools)

        system = build_system_prompt(
            workspace=self.workspace,
            profile=profile,
            resolved_engine=engine,
            mode=request.mode,
            skill_ids=request.skill_ids,
        )
        messages: list[BaseMessage] = [
            SystemMessage(content=system),
            *_ui_messages_to_langchain(request.messages),
        ]

        try:
            async for event in self._tool_loop(
                llm_with_tools=llm_with_tools,
                tools_map=tools_map,
                messages=messages,
                max_steps=max_steps,
            ):
                yield event
        except Exception as exc:  # noqa: BLE001 — agent boundary
            yield AgentEvent(type="error", data={"message": str(exc)})
            yield AgentEvent(type="done", data={"agent": self.name, "ok": False})
            return

        yield AgentEvent(type="done", data={"agent": self.name, "ok": True, "stepsUsed": True})

    async def _tool_loop(
        self,
        *,
        llm_with_tools: Any,
        tools_map: dict[str, Any],
        messages: list[BaseMessage],
        max_steps: int,
    ) -> AsyncIterator[AgentEvent]:
        for step in range(1, max_steps + 1):
            yield AgentEvent(
                type="status",
                data={"message": f"Thinking (step {step})", "step": step},
            )

            gathered: AIMessage | None = None
            async for chunk in llm_with_tools.astream(messages):
                text = _content_to_text(chunk.content)
                if text:
                    yield AgentEvent(type="token", data={"text": text, "step": step})
                gathered = chunk if gathered is None else gathered + chunk  # type: ignore[operator]

            if gathered is None:
                yield AgentEvent(type="error", data={"message": "Empty model response"})
                return

            # Ensure we have an AIMessage with tool_calls attribute
            ai_message = gathered if isinstance(gathered, AIMessage) else AIMessage(
                content=gathered.content if hasattr(gathered, "content") else "",
                tool_calls=getattr(gathered, "tool_calls", None) or [],
            )
            messages.append(ai_message)

            tool_calls = getattr(ai_message, "tool_calls", None) or []
            if not tool_calls:
                return

            for call in tool_calls:
                name = call.get("name") if isinstance(call, dict) else getattr(call, "name", "")
                call_id = (
                    call.get("id") if isinstance(call, dict) else getattr(call, "id", name)
                ) or name
                args = (
                    call.get("args") if isinstance(call, dict) else getattr(call, "args", {})
                ) or {}
                if isinstance(args, str):
                    try:
                        args = json.loads(args)
                    except json.JSONDecodeError:
                        args = {"input": args}

                yield AgentEvent(
                    type="tool_start",
                    data={"tool": name, "args": args, "step": step},
                )

                tool = tools_map.get(name)
                if not tool:
                    result = {"ok": False, "error": f"Unknown tool: {name}"}
                    ok = False
                else:
                    try:
                        raw = await tool.ainvoke(args)
                        result = raw if isinstance(raw, (dict, list)) else {"result": raw}
                        ok = True
                    except Exception as exc:  # noqa: BLE001
                        result = {"ok": False, "error": str(exc)}
                        ok = False

                yield AgentEvent(
                    type="tool_result",
                    data={"tool": name, "ok": ok, "result": result, "step": step},
                )

                content = result if isinstance(result, str) else json.dumps(result, default=str)
                messages.append(ToolMessage(content=content, tool_call_id=str(call_id), name=name))

        yield AgentEvent(
            type="token",
            data={
                "text": (
                    f"\n\nReached the hard step safety cap ({max_steps}). "
                    "Increase HELIX_HARD_STEP_CAP if the task needs more tool rounds.\n"
                )
            },
        )


def _content_to_text(content: Any) -> str:
    if content is None:
        return ""
    if isinstance(content, str):
        return content
    if isinstance(content, list):
        parts: list[str] = []
        for block in content:
            if isinstance(block, str):
                parts.append(block)
            elif isinstance(block, dict) and block.get("type") == "text":
                parts.append(str(block.get("text") or ""))
            elif hasattr(block, "text"):
                parts.append(str(getattr(block, "text")))
        return "".join(parts)
    return str(content)


def _ui_messages_to_langchain(messages: list[UIMessage]) -> list[BaseMessage]:
    out: list[BaseMessage] = []
    for message in messages:
        text = message.content or ""
        if not text:
            texts = [
                str(part.get("text") or "")
                for part in message.parts
                if isinstance(part, dict) and part.get("type") == "text"
            ]
            text = "\n".join(t for t in texts if t)
        if not text.strip():
            continue
        if message.role == "user":
            out.append(HumanMessage(content=text))
        elif message.role == "assistant":
            out.append(AIMessage(content=text))
        elif message.role == "system":
            out.append(SystemMessage(content=text))
    return out


def agent_for_mode(mode: AgentMode, workspace: Path) -> CodingAgent:
    # Modes share CodingAgent; prompts/skills differ via ChatRequest.mode
    _ = mode
    return CodingAgent(workspace)
