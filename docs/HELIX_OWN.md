# Helix Own — weight training

Real **LoRA SFT** on `Qwen/Qwen2.5-Coder-0.5B-Instruct` using our curriculum dataset.

```bash
npm run train:weights          # LoRA train → training/output/helix-own-lora
npm run serve:ft               # OpenAI-compatible server :11435
npm start                      # train if needed + IDE
```

## Artifacts

- Dataset: `training/dataset/helix_own_sft.jsonl`
- Adapter: `training/output/helix-own-lora/adapter/` (~28MB)
- Meta: `training/output/helix-own-lora/helix_own_ft.json`

Helix Free / Helix Own prefers the FT server when `:11435` is healthy.

## Product builder focus

Helix Own is optimized for:

| Product | Scaffold |
| --- | --- |
| Apps / SaaS | `fullstack-ts`, `electron-app`, `react-vite`, `ts-api` |
| Websites | `website` |
| Games | `game-canvas` |
| Minecraft mods | `mod-fabric` |
| Browser extensions | `browser-extension` |

Skills: `build-products`, `games-mods`, plus coding/ship/curriculum.

## Website hosting (two modes)

1. **Credentialed** — enable “Allow credentialed host setup” in the **Host** tab, paste a Vercel/Netlify/Cloudflare token (not your password). Helix picks a host and deploys.
2. **Assisted** — Helix opens the host on your PC; **you** log in; Helix clicks through project/deploy. Never types your password.

```bash
npx tsx scripts/smoke-hosting.ts
```

## Continuous learning (from every user)

Helix learns **locally** from everything the user sends:

1. Every prompt → `.helix/learning/user_inbox.jsonl` (raw archive)
2. Every chat turn (incl. tool use) → `.helix/learning/user_examples.jsonl`
3. Thumbs up/down (+ optional correction) → feedback examples
4. After N new examples (`retrainEvery`, default 8) → automatic LoRA retrain on base + user data

Toggle **Learning on** in the chat toolbar. Data never leaves the machine (`privacy: local-only`).

```bash
npx tsx scripts/smoke-learning.ts
curl -X POST http://127.0.0.1:8787/api/learning/retrain
```

## Simple usage

1. `npm start`
2. Welcome → **Loslegen**
3. Chat with Helix Own (essential skills + tools on by default)
