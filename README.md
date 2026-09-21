# Helix

Local coding AI **desktop IDE** — same UI in the Electron window as in the browser preview.

## Desktop (recommended)

```bash
cp .env.example .env
npm install
npm run desktop
```

This opens the **Helix desktop app** loading the exact same React UI / CSS as `http://127.0.0.1:5173` (frameless window, in-app chrome — no separate desktop skin).

### Installers

```bash
npm run dist        # current OS
npm run dist:win
npm run dist:mac
npm run dist:linux
```

Outputs go to `release/`.

## Browser preview (same UI)

```bash
npm run dev
```

Open http://127.0.0.1:5173 — pixel-identical layout to the desktop shell.

## Features

- Project map first · web/GitHub research · Monaco editor + diffs
- MCP host · GitHub commit/push · Bug hunt · Preview/Browser tabs
- Chat sessions saved under `.helix/sessions/`
