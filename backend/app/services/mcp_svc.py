"""MCP host config + connection state (Python). Full stdio MCP client follows LangChain tools."""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any


DEFAULT_MCP: dict[str, Any] = {
    "mcpServers": {
        "example_memory": {
            "command": "npx",
            "args": ["-y", "@modelcontextprotocol/server-memory"],
            "disabled": True,
        }
    }
}


def mcp_config_path(workspace: Path) -> Path:
    return workspace / ".helix" / "mcp.json"


def load_mcp_config(workspace: Path) -> dict[str, Any]:
    path = mcp_config_path(workspace)
    if not path.exists():
        return {"mcpServers": {}}
    try:
        data = json.loads(path.read_text(encoding="utf-8"))
        return {"mcpServers": data.get("mcpServers") or {}}
    except (OSError, json.JSONDecodeError):
        return {"mcpServers": {}}


def save_mcp_config(workspace: Path, config: dict[str, Any]) -> dict[str, Any]:
    path = mcp_config_path(workspace)
    path.parent.mkdir(parents=True, exist_ok=True)
    cleaned = {"mcpServers": config.get("mcpServers") or {}}
    path.write_text(json.dumps(cleaned, indent=2), encoding="utf-8")
    return cleaned


def ensure_default_mcp_config(workspace: Path) -> dict[str, Any]:
    existing = load_mcp_config(workspace)
    if existing.get("mcpServers"):
        return existing
    return save_mcp_config(workspace, DEFAULT_MCP)


def list_mcp_states(config: dict[str, Any]) -> list[dict[str, Any]]:
    """Report configured servers. Live stdio connect is deferred to agent tool layer."""
    states: list[dict[str, Any]] = []
    for server_id, server in (config.get("mcpServers") or {}).items():
        if server.get("disabled"):
            states.append({"id": server_id, "status": "disabled", "tools": []})
        else:
            states.append(
                {
                    "id": server_id,
                    "status": "disconnected",
                    "tools": [],
                    "error": "MCP stdio host runs via Python agent tools — enable and reconnect after wiring.",
                }
            )
    return states


async def reconnect_mcp_servers(workspace: Path) -> list[dict[str, Any]]:
    config = ensure_default_mcp_config(workspace)
    return list_mcp_states(config)
