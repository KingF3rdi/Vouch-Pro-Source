"""Build / ship pipeline execution (Python)."""

from __future__ import annotations

import asyncio
from pathlib import Path
from typing import Any

from app.services.project import detect_build_pipeline, list_artifacts


async def run_build_command(
    workspace: Path,
    command: str,
    timeout_s: float = 600.0,
) -> dict[str, Any]:
    try:
        proc = await asyncio.create_subprocess_shell(
            command,
            cwd=str(workspace),
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
        )
        try:
            stdout_b, stderr_b = await asyncio.wait_for(proc.communicate(), timeout=timeout_s)
        except TimeoutError:
            proc.kill()
            await proc.communicate()
            return {
                "ok": False,
                "command": command,
                "code": -1,
                "stdout": "",
                "stderr": f"Timed out after {timeout_s}s",
            }
        stdout = (stdout_b or b"").decode("utf-8", errors="replace")[:40_000]
        stderr = (stderr_b or b"").decode("utf-8", errors="replace")[:20_000]
        return {
            "ok": proc.returncode == 0,
            "command": command,
            "code": proc.returncode,
            "stdout": stdout,
            "stderr": stderr,
        }
    except OSError as exc:
        return {
            "ok": False,
            "command": command,
            "code": 1,
            "stdout": "",
            "stderr": str(exc)[:20_000],
        }


async def run_full_ship(workspace: Path) -> dict[str, Any]:
    pipeline = detect_build_pipeline(workspace)
    ordered = [
        *[s for s in pipeline.steps if s.kind == "typecheck"],
        *[s for s in pipeline.steps if s.kind in ("build", "compile")],
        *[s for s in pipeline.steps if s.kind == "package"],
    ]
    results: list[dict[str, Any]] = []
    ok = True
    for step in ordered:
        result = await run_build_command(workspace, step.command)
        results.append({"step": step.model_dump(), **result})
        if not result["ok"]:
            ok = False
            break
    artifacts = list_artifacts(workspace, pipeline.artifact_globs)
    return {
        "ok": ok,
        "pipeline": pipeline.model_dump(by_alias=True),
        "results": results,
        "artifacts": artifacts,
    }
