"""LangChain StructuredTool registry for the coding agent."""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any

from langchain_core.tools import StructuredTool
from pydantic import BaseModel, Field

from app.agents.tools import fs_tools, web_tools
from app.services import github_svc
from app.services.project import build_project_map, detect_build_pipeline, list_artifacts
from app.services.ship import run_full_ship


class EmptyArgs(BaseModel):
    pass


class ListDirArgs(BaseModel):
    relative_path: str = Field(default=".", description="Directory relative to workspace")


class ReadFileArgs(BaseModel):
    relative_path: str = Field(description="File path relative to workspace")
    max_chars: int | None = Field(
        default=None,
        description="Optional cap; omit or null for unlimited (full file)",
    )


class WriteFileArgs(BaseModel):
    relative_path: str
    content: str


class SearchFilesArgs(BaseModel):
    query: str
    glob_pattern: str = "**/*.{ts,tsx,js,jsx,py,md,json,css,html}"
    max_matches: int = 80


class TerminalArgs(BaseModel):
    command: str
    timeout_ms: int = Field(default=600_000, description="Timeout in ms (default 10 minutes)")


class WebSearchArgs(BaseModel):
    query: str
    limit: int = 8


class WebFetchArgs(BaseModel):
    url: str
    max_chars: int = Field(default=0, description="0 = unlimited (up to 2MB guard)")


class GithubSearchArgs(BaseModel):
    query: str
    limit: int = 8


class GitCommitArgs(BaseModel):
    message: str
    paths: list[str] | None = None


class GitPushArgs(BaseModel):
    set_upstream: bool = True


def _json(data: Any) -> str:
    return json.dumps(data, ensure_ascii=False, default=str)


def build_agent_tools(workspace: Path) -> list[StructuredTool]:
    def project_map_fn() -> str:
        return _json(build_project_map(workspace).model_dump(by_alias=True))

    def list_directory(relative_path: str = ".") -> str:
        return _json(fs_tools.list_directory(workspace, relative_path))

    def read_file(relative_path: str, max_chars: int | None = None) -> str:
        return _json(fs_tools.read_file(workspace, relative_path, max_chars))

    def write_file(relative_path: str, content: str) -> str:
        return _json(fs_tools.write_file(workspace, relative_path, content))

    def search_files(
        query: str,
        glob_pattern: str = "**/*.{ts,tsx,js,jsx,py,md,json,css,html}",
        max_matches: int = 80,
    ) -> str:
        return _json(fs_tools.search_files(workspace, query, glob_pattern, max_matches))

    def run_terminal(command: str, timeout_ms: int = 600_000) -> str:
        return _json(fs_tools.run_terminal(workspace, command, timeout_ms))

    def detect_pipeline() -> str:
        return _json(detect_build_pipeline(workspace).model_dump(by_alias=True))

    def list_build_artifacts_fn() -> str:
        pipe = detect_build_pipeline(workspace)
        return _json(list_artifacts(workspace, pipe.artifact_globs))

    async def ship_project() -> str:
        return _json(await run_full_ship(workspace))

    def git_commit(message: str, paths: list[str] | None = None) -> str:
        return _json(github_svc.git_commit(workspace, message, paths))

    def git_push(set_upstream: bool = True) -> str:
        return _json(github_svc.git_push(workspace, set_upstream))

    async def web_search(query: str, limit: int = 8) -> str:
        return _json(await web_tools.web_search(query, limit))

    async def web_fetch(url: str, max_chars: int = 0) -> str:
        return _json(await web_tools.web_fetch(url, max_chars))

    async def github_search(query: str, limit: int = 8) -> str:
        return _json(await web_tools.github_search(query, limit))

    return [
        StructuredTool.from_function(
            func=project_map_fn,
            name="project_map",
            description="Map workspace structure, stack markers, and key files. Call at task start.",
        ),
        StructuredTool.from_function(
            func=list_directory,
            name="list_directory",
            description="List files and folders relative to the workspace.",
            args_schema=ListDirArgs,
        ),
        StructuredTool.from_function(
            func=read_file,
            name="read_file",
            description="Read a workspace text file. Omit max_chars for the full file.",
            args_schema=ReadFileArgs,
        ),
        StructuredTool.from_function(
            func=write_file,
            name="write_file",
            description="Create or overwrite a text file in the workspace.",
            args_schema=WriteFileArgs,
        ),
        StructuredTool.from_function(
            func=search_files,
            name="search_files",
            description="Search file contents with a case-insensitive substring.",
            args_schema=SearchFilesArgs,
        ),
        StructuredTool.from_function(
            func=run_terminal,
            name="run_terminal",
            description="Run a shell command in the workspace (builds, tests, git).",
            args_schema=TerminalArgs,
        ),
        StructuredTool.from_function(
            func=detect_pipeline,
            name="detect_build_pipeline",
            description="Detect how to typecheck/build/package this project.",
        ),
        StructuredTool.from_function(
            func=list_build_artifacts_fn,
            name="list_build_artifacts",
            description="List compiled/packaged artifact files.",
        ),
        StructuredTool.from_function(
            coroutine=ship_project,
            name="ship_project",
            description="Run the full ship pipeline (typecheck → build → package).",
            args_schema=EmptyArgs,
        ),
        StructuredTool.from_function(
            func=git_commit,
            name="git_commit",
            description="Stage and commit changes with a message.",
            args_schema=GitCommitArgs,
        ),
        StructuredTool.from_function(
            func=git_push,
            name="git_push",
            description="Push the current branch to origin.",
            args_schema=GitPushArgs,
        ),
        StructuredTool.from_function(
            coroutine=web_search,
            name="web_search",
            description="Search the web for libraries, docs, and patterns to reuse.",
            args_schema=WebSearchArgs,
        ),
        StructuredTool.from_function(
            coroutine=web_fetch,
            name="web_fetch",
            description="Fetch a URL and return its text content.",
            args_schema=WebFetchArgs,
        ),
        StructuredTool.from_function(
            coroutine=github_search,
            name="github_search",
            description="Search GitHub repositories for reusable code.",
            args_schema=GithubSearchArgs,
        ),
    ]


def tool_by_name(tools: list[StructuredTool]) -> dict[str, StructuredTool]:
    return {t.name: t for t in tools}
