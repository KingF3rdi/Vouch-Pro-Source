# Helix

Local coding AI **IDE** with a Cursor / Claude-quality agent. Runs on your PC.

## What it does

- **Maps the project** before work (always injected + `project_map` tool)
- **Searches the web / GitHub** for existing code so it does not reinvent everything
- **Own IDE**: file tree, Monaco editor, chat agent
- **Bug hunt** mode for systematic debugging
- **Preview** and **Browser** tabs
- **GitHub connect** for automated commit & push

## Quick start

```bash
cp .env.example .env
npm install
ollama pull llama3.2   # optional local model
npm run dev
```

Open **http://127.0.0.1:5173**

Desktop window:

```bash
npm run dev:electron
```

## GitHub

1. Open the **GitHub** tab in the IDE
2. Paste a personal access token with `repo` scope
3. Use **Commit & Push**, or ask the agent to `git_commit` / `git_push`

Tokens are stored in `.helix/secrets.json` (gitignored). You can also set `GITHUB_TOKEN` in `.env`.

## Skills

| Skill | Role |
| --- | --- |
| Coding | Senior-engineer workflow: map → research → edit → verify |
| Design | Distinctive UI craft |
| Research | Find reusable libraries / snippets online |
| Bug hunt | Reproduce, isolate, patch, verify |

## Agent tools

`project_map`, `list_directory`, `read_file`, `write_file`, `search_files`, `run_terminal`, `web_search`, `github_code_search`, `web_fetch`, `git_commit`, `git_push`, plus plugins in `plugins/`.
