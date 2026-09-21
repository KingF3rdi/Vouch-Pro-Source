from __future__ import annotations

import json
from datetime import datetime, timezone
from pathlib import Path

from app.models.schemas import BuildPipeline, BuildStep, ProjectMap


IGNORE = {"node_modules", ".git", "dist", ".helix", "__pycache__", ".venv", "release"}


def build_project_map(workspace: Path) -> ProjectMap:
    top_level: list[str] = []
    if workspace.exists():
        for entry in sorted(workspace.iterdir(), key=lambda p: p.name.lower()):
            if entry.name in IGNORE:
                continue
            top_level.append(f"{entry.name}/" if entry.is_dir() else entry.name)

    markers = [
        name
        for name in [
            "package.json",
            "pyproject.toml",
            "requirements.txt",
            "Cargo.toml",
            "go.mod",
            "tsconfig.json",
            "vite.config.ts",
            "README.md",
            ".env.example",
            "ARCHITECTURE.md",
        ]
        if (workspace / name).exists()
    ]

    stack: list[str] = []
    if "package.json" in markers:
        stack.append("Node/JS")
    if "vite.config.ts" in markers:
        stack.append("Vite")
    if "tsconfig.json" in markers:
        stack.append("TypeScript")
    if "pyproject.toml" in markers or "requirements.txt" in markers:
        stack.append("Python")
    if (workspace / "backend").is_dir():
        stack.append("FastAPI")

    key_files: list[str] = []
    for pattern in ("**/*.ts", "**/*.tsx", "**/*.py", "**/*.md"):
        for path in workspace.glob(pattern):
            if any(part in IGNORE for part in path.parts):
                continue
            key_files.append(str(path.relative_to(workspace)).replace("\\", "/"))
            if len(key_files) >= 40:
                break
        if len(key_files) >= 40:
            break

    summary = "\n".join(
        [
            f"Workspace: {workspace}",
            f"Stack hints: {', '.join(stack) or 'unknown'}",
            f"Markers: {', '.join(markers) or 'none'}",
            f"Top-level: {', '.join(top_level[:40])}",
        ]
    )

    return ProjectMap(
        root=str(workspace),
        topLevel=top_level,
        markers=markers,
        likelyStack=stack,
        keyFiles=key_files,
        summary=summary,
    )


def detect_build_pipeline(workspace: Path) -> BuildPipeline:
    steps: list[BuildStep] = []
    stack: list[str] = []
    notes: list[str] = []
    globs: list[str] = []

    pkg = workspace / "package.json"
    if pkg.exists():
        stack.append("Node/JS")
        data = json.loads(pkg.read_text(encoding="utf-8"))
        scripts = data.get("scripts") or {}
        if scripts.get("typecheck"):
            steps.append(
                BuildStep(
                    id="typecheck",
                    label="Typecheck",
                    command="npm run typecheck",
                    kind="typecheck",
                )
            )
        if scripts.get("build"):
            steps.append(
                BuildStep(
                    id="build",
                    label="Production build",
                    command="npm run build",
                    kind="build",
                )
            )
            globs.extend(["dist/**/*", "build/**/*"])
        if scripts.get("dist") or scripts.get("pack"):
            steps.append(
                BuildStep(
                    id="package",
                    label="Package installer / final product",
                    command="npm run dist" if scripts.get("dist") else "npm run pack",
                    kind="package",
                )
            )
            globs.append("release/**/*")

    req = workspace / "backend" / "requirements.txt"
    if req.exists() or (workspace / "backend").is_dir():
        stack.append("Python")
        notes.append("Python FastAPI agents: install with pip install -r backend/requirements.txt")

    return BuildPipeline(
        stack=stack or ["unknown"],
        steps=steps,
        artifactGlobs=list(dict.fromkeys(globs)),
        notes=notes,
    )


def list_artifacts(workspace: Path, globs: list[str]) -> list[dict[str, object]]:
    from datetime import datetime

    found: list[dict[str, object]] = []
    for pattern in globs:
        for path in workspace.glob(pattern):
            if not path.is_file():
                continue
            if any(part in IGNORE for part in path.parts):
                continue
            stat = path.stat()
            found.append(
                {
                    "path": str(path.relative_to(workspace)).replace("\\", "/"),
                    "size": stat.st_size,
                    "mtime": datetime.fromtimestamp(stat.st_mtime, tz=timezone.utc).isoformat(),
                }
            )
    found.sort(key=lambda a: (-int(a["size"]), str(a["path"])))  # type: ignore[arg-type]
    return found[:80]
