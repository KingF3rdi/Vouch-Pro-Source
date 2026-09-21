---
name: Website hosting
description: Set up live websites via credentialed auto-deploy or assisted browser clicks where the user logs in.
---

# Website hosting — two solutions

Helix can take a site live using **exactly one** of these modes (ask the user which they prefer):

## 1) Credentialed (Helix logs in with allowed data)

**Only when the user explicitly allows it** in the Host tab (`allowCredentialedSetup`).

1. `hosting_recommend` — pick Vercel / Netlify / Cloudflare Pages / GitHub Pages.
2. Confirm tokens exist via `hosting_status` (never print token values).
3. `hosting_start_setup` with `mode=credentialed` **or** `hosting_deploy_credentialed`.
4. Helix builds the site and deploys with the stored **API token** (not account passwords).
5. Report the live URL.

Rules:
- Never use or ask to store account **passwords**. Tokens / PATs only.
- If allow is false → explain how to enable it; do not invent credentials.
- Tokens stay in `.helix/secrets.json` (local only).

## 2) Assisted (Helix clicks on their PC; user logs in)

1. `hosting_start_setup` with `mode=assisted` — opens the host login on the user’s machine (Playwright window or system browser).
2. User logs in themselves in that window.
3. `hosting_confirm_login` when they say they’re in.
4. `hosting_assisted_deploy` — Helix builds locally and clicks through new-project / deploy UI as far as the host allows.
5. If a click misses (hosts change UI often), leave clear next clicks + the local `dist/` path to upload.
6. Ask the user for the final URL when the host shows it.

Rules:
- Helix **never types the user’s password**.
- Prefer persistent browser profile under `.helix/browser-profile` so they stay logged in next time.

## When to choose which

| Situation | Mode |
| --- | --- |
| User pasted Vercel/Netlify/CF token + allowed credentialed | credentialed |
| User does not want to share tokens / prefers OAuth in browser | assisted |
| GitHub already connected | GitHub Pages (credentialed push or assisted Settings → Pages) |

## Always

- Build before deploy.
- Prefer the host that matches the stack (`hosting_recommend`).
- After go-live: summarize URL, host, and how to redeploy.
