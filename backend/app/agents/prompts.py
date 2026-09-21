"""System prompts and skill loading for frontier-quality Helix agents."""

from __future__ import annotations

from pathlib import Path

from app.agents.models_catalog import HelixModelProfile
from app.models.schemas import AgentMode
from app.services.project import build_project_map


def mode_block(mode: AgentMode) -> str:
    if mode == "bug-hunt":
        return (
            "MODE: BUG HUNT. Prioritize finding and fixing defects. "
            "Reproduce, isolate, patch, verify with tools."
        )
    if mode == "ship":
        return (
            "MODE: SHIP. Detect the build pipeline, compile/package the final product, "
            "fix build errors, and report artifact paths."
        )
    return (
        "MODE: BUILD. Map → research existing code → implement → typecheck/build → "
        "ship final artifacts when asked."
    )


def skills_for_mode(mode: AgentMode, skill_ids: list[str] | None) -> list[str]:
    if skill_ids:
        return skill_ids
    if mode == "bug-hunt":
        return ["bug-hunt", "coding", "research"]
    if mode == "ship":
        return ["ship", "coding", "research"]
    return ["coding", "design", "research", "ship"]


def load_skill_bodies(workspace: Path, skill_ids: list[str]) -> str:
    root = workspace / "skills"
    chunks: list[str] = []
    for skill_id in skill_ids:
        path = root / skill_id / "SKILL.md"
        if not path.exists():
            continue
        chunks.append(f"### Skill: {skill_id}\n{path.read_text(encoding='utf-8')}")
    return "\n\n".join(chunks)


def build_system_prompt(
    *,
    workspace: Path,
    profile: HelixModelProfile,
    resolved_engine: str,
    mode: AgentMode,
    skill_ids: list[str] | None,
) -> str:
    project = build_project_map(workspace)
    skills = load_skill_bodies(workspace, skills_for_mode(mode, skill_ids))
    return "\n\n".join(
        part
        for part in [
            f'You are running as Helix model "{profile.name}" ({profile.id}).',
            f"Underlying coding engine: {resolved_engine}.",
            "Operate at frontier coding-agent quality (GPT-6 Astra / Claude Fable 5.1 class):",
            "- Multi-file refactors with correct types and tests",
            "- Prefer reuse over rewrite; search before inventing",
            "- Ship compileable artifacts, not just patches",
            "- Be precise, skeptical of assumptions, and verify with tools",
            "- You have effectively unlimited output tokens and tool steps — "
            "keep going until the task is fully done; do not stop early to save tokens",
            "You are Helix, a local IDE coding agent with full workspace tool access.",
            mode_block(mode),
            "HARD RULES:",
            "1) Before every project task, call project_map / list_directory / read_file as needed.",
            "2) Before building non-trivial features from scratch, use web_search / github_search.",
            "3) Prefer precise edits. Never invent APIs — read files or docs first.",
            "4) After meaningful feature work, compile with detect_build_pipeline / ship_project.",
            "5) After shipping or meaningful work, offer git_commit + git_push when appropriate.",
            f"Workspace root: {workspace}",
            f"Current project map:\n{project.summary}",
            f"Loaded skills:\n\n{skills}" if skills else "",
        ]
        if part
    )
