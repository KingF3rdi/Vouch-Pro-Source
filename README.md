# Helix

Local coding AI agent with a Cursor / Claude-style interface. Runs on your PC, works with **Ollama** (fully local) or cloud providers, and ships with built-in **plugins** plus **coding** and **design** skills.

## Quick start

```bash
cp .env.example .env
npm install

# Optional local model
ollama pull llama3.2

npm run dev
```

Open **http://127.0.0.1:5173** (UI) — the agent API listens on **http://127.0.0.1:8787**.

Desktop window (Electron):

```bash
npm run dev:electron
```

## What you get

| Piece | Role |
| --- | --- |
| Cursor-like chat UI | Streaming chat, skill toggles, plugin list |
| Agent tools | `list_directory`, `read_file`, `write_file`, `search_files`, `run_terminal` |
| Skills | `skills/coding`, `skills/design` (markdown instructions loaded into the system prompt) |
| Plugins | Drop a `.ts` file in `plugins/` that exports `id`, `name`, `createTools`, etc. |
| Providers | `ollama` (default), `openai`, `anthropic` via `.env` |

## Configure

Edit `.env`:

- `HELIX_PROVIDER=ollama|openai|anthropic`
- `HELIX_WORKSPACE=/path/to/project` (defaults to the process cwd)
- Provider keys / model names as in `.env.example`

## Extend

**New skill** — add `skills/<id>/SKILL.md` with YAML frontmatter (`name`, `description`).

**New plugin** — add `plugins/my-plugin.ts`:

```ts
export const id = "my-plugin";
export const name = "My Plugin";
export const description = "Does a useful thing";
export function createTools() {
  return { /* ai-sdk tools */ };
}
```

## Roadmap (next)

- Diff preview / file tree pane
- MCP plugin host
- Packaged installers (Windows / macOS / Linux)
- Multi-session history on disk
