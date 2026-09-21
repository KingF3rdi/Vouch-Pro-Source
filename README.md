# Helix

Local coding AI **IDE** — Cursor/Claude-quality agent, diffs, MCP, sessions, and desktop installers.

## Features

- **Project map first** on every agent task
- **Web + GitHub research** before building from scratch
- **IDE**: file tree (git badges), multi-file tabs, Monaco editor, **side-by-side diff**
- **Saved chats** in `.helix/sessions/`
- **MCP plugin host** via `.helix/mcp.json`
- **GitHub** connect → commit & push
- **Preview / Browser / Bug hunt** tabs
- **Desktop app** (Electron) that loads the **same UI** as the browser

## Quick start (browser)

```bash
cp .env.example .env
npm install
npm run dev
```

Open http://127.0.0.1:5173

## Desktop app (same look as browser)

```bash
npm run dev:electron
```

### Installers (Windows / macOS / Linux)

```bash
npm run dist        # current platform
npm run dist:win    # NSIS + portable
npm run dist:mac    # dmg + zip
npm run dist:linux  # AppImage + deb
```

Artifacts land in `release/`.

## GitHub

GitHub tab → paste a `repo`-scoped PAT → **Commit & Push**.  
Stored in `.helix/secrets.json` (gitignored). Or set `GITHUB_TOKEN` in `.env`.

## MCP

Edit the **MCP** tab (writes `.helix/mcp.json`), then **Save config** / **Reconnect**.  
Agent tools: `mcp_list_servers`, `mcp_call_tool`.

## Sessions

Chats auto-save under `.helix/sessions/`. Use **New** in the agent rail to start another thread.
