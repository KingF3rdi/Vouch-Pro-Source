"""Helix Python API — agents, tools, and orchestration live here only."""

from __future__ import annotations

from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles

from app.api.routes import router
from app.core.config import get_settings
from app.core.workspace import ensure_helix_dirs

BACKEND_DIR = Path(__file__).resolve().parent
# Dev: <repo>/dist/ui · Packaged Electron: <resources>/ui beside backend/
UI_DIST = next(
    (
        p
        for p in (BACKEND_DIR.parent / "dist" / "ui", BACKEND_DIR.parent / "ui")
        if p.is_dir()
    ),
    BACKEND_DIR.parent / "dist" / "ui",
)


@asynccontextmanager
async def lifespan(_app: FastAPI):
    settings = get_settings()
    ensure_helix_dirs(settings.workspace)
    yield


app = FastAPI(
    title="Helix Agent API",
    version="0.5.0",
    description="Python back-end for Helix coding agents (FastAPI + Pydantic).",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(router, prefix="/api")

if UI_DIST.is_dir():
    assets = UI_DIST / "assets"
    if assets.is_dir():
        app.mount("/assets", StaticFiles(directory=assets), name="assets")

    @app.get("/{full_path:path}")
    async def spa_fallback(full_path: str):  # noqa: ARG001
        index = UI_DIST / "index.html"
        if index.exists() and not full_path.startswith("api"):
            return FileResponse(index)
        return FileResponse(index) if index.exists() else {"error": "UI not built"}


def run() -> None:
    import uvicorn

    settings = get_settings()
    uvicorn.run(
        "main:app",
        host="127.0.0.1",
        port=settings.port,
        reload=True,
        app_dir=str(Path(__file__).parent),
    )


if __name__ == "__main__":
    run()
