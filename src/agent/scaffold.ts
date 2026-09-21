/**
 * Scaffold complex multi-file projects with a sane architecture.
 */

import fs from "node:fs/promises";
import path from "node:path";

function assertInside(workspace: string, target: string) {
  const root = path.resolve(workspace);
  const resolved = path.resolve(root, target);
  if (resolved !== root && !resolved.startsWith(root + path.sep)) {
    throw new Error(`Path escapes workspace: ${target}`);
  }
  return resolved;
}

export type ScaffoldKind =
  | "ts-api"
  | "react-vite"
  | "fullstack-ts"
  | "python-fastapi"
  | "monorepo-lite"
  | "website"
  | "electron-app"
  | "game-canvas"
  | "mod-fabric"
  | "browser-extension";

export type ScaffoldResult = {
  ok: boolean;
  kind: ScaffoldKind;
  root: string;
  filesCreated: string[];
  nextSteps: string[];
};

async function write(
  workspace: string,
  rel: string,
  content: string,
  created: string[]
) {
  const full = assertInside(workspace, rel);
  await fs.mkdir(path.dirname(full), { recursive: true });
  try {
    await fs.access(full);
    // do not overwrite existing files
    return;
  } catch {
    // create
  }
  await fs.writeFile(full, content, "utf8");
  created.push(rel);
}

export async function scaffoldProject(
  workspace: string,
  input: {
    kind: ScaffoldKind;
    name: string;
    relativeRoot?: string;
  }
): Promise<ScaffoldResult> {
  const name = input.name.trim().replace(/[^a-zA-Z0-9-_]/g, "-") || "app";
  const rootRel = (input.relativeRoot || name).replace(/^\//, "");
  const created: string[] = [];
  const kind = input.kind;

  if (kind === "ts-api" || kind === "fullstack-ts" || kind === "monorepo-lite") {
    await write(
      workspace,
      `${rootRel}/package.json`,
      JSON.stringify(
        {
          name,
          private: true,
          type: "module",
          scripts: {
            dev: "tsx watch src/server.ts",
            build: "tsc -p tsconfig.json",
            typecheck: "tsc -p tsconfig.json --noEmit",
            start: "node dist/server.js",
          },
          dependencies: {
            express: "^5.1.0",
            cors: "^2.8.5",
            zod: "^3.25.0",
          },
          devDependencies: {
            typescript: "^5.9.2",
            tsx: "^4.20.5",
            "@types/express": "^5.0.3",
            "@types/cors": "^2.8.19",
            "@types/node": "^24.3.1",
          },
        },
        null,
        2
      ) + "\n",
      created
    );
    await write(
      workspace,
      `${rootRel}/tsconfig.json`,
      JSON.stringify(
        {
          compilerOptions: {
            target: "ES2022",
            module: "NodeNext",
            moduleResolution: "NodeNext",
            strict: true,
            outDir: "dist",
            rootDir: "src",
            skipLibCheck: true,
          },
          include: ["src"],
        },
        null,
        2
      ) + "\n",
      created
    );
    await write(
      workspace,
      `${rootRel}/src/server.ts`,
      `import express from "express";
import cors from "cors";
import { z } from "zod";

const app = express();
app.use(cors());
app.use(express.json());

const Health = z.object({ ok: z.literal(true), name: z.string() });

app.get("/api/health", (_req, res) => {
  res.json(Health.parse({ ok: true, name: "${name}" }));
});

const port = Number(process.env.PORT ?? 3000);
app.listen(port, "127.0.0.1", () => {
  console.log("${name} API on http://127.0.0.1:" + port);
});
`,
      created
    );
  }

  if (kind === "react-vite" || kind === "fullstack-ts" || kind === "monorepo-lite") {
    const uiRoot = kind === "react-vite" ? rootRel : `${rootRel}/web`;
    await write(
      workspace,
      `${uiRoot}/package.json`,
      JSON.stringify(
        {
          name: `${name}-web`,
          private: true,
          type: "module",
          scripts: {
            dev: "vite",
            build: "tsc -b && vite build",
            preview: "vite preview",
          },
          dependencies: {
            react: "^19.1.1",
            "react-dom": "^19.1.1",
          },
          devDependencies: {
            typescript: "^5.9.2",
            vite: "^7.1.5",
            "@vitejs/plugin-react": "^5.0.2",
            "@types/react": "^19.1.12",
            "@types/react-dom": "^19.1.9",
          },
        },
        null,
        2
      ) + "\n",
      created
    );
    await write(
      workspace,
      `${uiRoot}/index.html`,
      `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${name}</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
`,
      created
    );
    await write(
      workspace,
      `${uiRoot}/src/main.tsx`,
      `import { createRoot } from "react-dom/client";
import { App } from "./App";
import "./styles.css";

createRoot(document.getElementById("root")!).render(<App />);
`,
      created
    );
    await write(
      workspace,
      `${uiRoot}/src/App.tsx`,
      `export function App() {
  return (
    <main className="app">
      <h1>${name}</h1>
      <p>Scaffolded by Helix Own — replace this with your product UI.</p>
    </main>
  );
}
`,
      created
    );
    await write(
      workspace,
      `${uiRoot}/src/styles.css`,
      `:root { font-family: ui-sans-serif, system-ui, sans-serif; color: #e8eaed; background: #0f1218; }
body { margin: 0; }
.app { min-height: 100vh; display: grid; place-content: center; gap: 0.5rem; padding: 2rem; }
h1 { margin: 0; letter-spacing: -0.03em; }
p { opacity: 0.75; }
`,
      created
    );
    await write(
      workspace,
      `${uiRoot}/vite.config.ts`,
      `import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: { host: "127.0.0.1", port: 5173 },
});
`,
      created
    );
  }

  if (kind === "python-fastapi") {
    await write(
      workspace,
      `${rootRel}/requirements.txt`,
      `fastapi>=0.116.0
uvicorn[standard]>=0.35.0
pydantic>=2.11.0
`,
      created
    );
    await write(
      workspace,
      `${rootRel}/main.py`,
      `from fastapi import FastAPI

app = FastAPI(title="${name}")

@app.get("/api/health")
def health():
    return {"ok": True, "name": "${name}"}
`,
      created
    );
  }

  if (kind === "website") {
    await write(
      workspace,
      `${rootRel}/package.json`,
      JSON.stringify(
        {
          name,
          private: true,
          type: "module",
          scripts: {
            dev: "vite",
            build: "vite build",
            preview: "vite preview",
          },
          devDependencies: {
            vite: "^7.1.5",
          },
        },
        null,
        2
      ) + "\n",
      created
    );
    await write(
      workspace,
      `${rootRel}/index.html`,
      `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${name}</title>
    <link rel="stylesheet" href="/styles.css" />
  </head>
  <body>
    <header class="hero">
      <p class="brand">${name}</p>
      <h1>Build something people can use today.</h1>
      <p class="lede">Scaffolded by Helix — replace copy, ship a fast site.</p>
      <a class="cta" href="#start">Get started</a>
    </header>
    <main id="start" class="section">
      <h2>Why this stack</h2>
      <p>Static Vite site: tiny deps, instant preview, production <code>dist/</code>.</p>
    </main>
    <script type="module" src="/main.js"></script>
  </body>
</html>
`,
      created
    );
    await write(
      workspace,
      `${rootRel}/styles.css`,
      `:root {
  --bg: #0c1210;
  --text: #e7f0ea;
  --muted: #9bb0a4;
  --accent: #3ecf8e;
  --font: "Segoe UI", system-ui, sans-serif;
}
* { box-sizing: border-box; }
body {
  margin: 0;
  font-family: var(--font);
  color: var(--text);
  background:
    radial-gradient(900px 420px at 12% -10%, rgba(62, 207, 142, 0.16), transparent 55%),
    linear-gradient(180deg, #101814, var(--bg));
}
.hero {
  min-height: 100vh;
  display: grid;
  align-content: center;
  gap: 0.75rem;
  padding: 2.5rem clamp(1.25rem, 4vw, 4rem);
}
.brand { margin: 0; font-weight: 700; letter-spacing: 0.04em; color: var(--accent); }
h1 { margin: 0; max-width: 14ch; font-size: clamp(2.4rem, 6vw, 4.2rem); letter-spacing: -0.04em; line-height: 1.05; }
.lede { margin: 0; max-width: 42ch; color: var(--muted); font-size: 1.1rem; }
.cta {
  width: fit-content;
  margin-top: 0.5rem;
  padding: 0.7rem 1.1rem;
  border-radius: 999px;
  background: var(--accent);
  color: #042016;
  text-decoration: none;
  font-weight: 600;
}
.section { padding: 4rem clamp(1.25rem, 4vw, 4rem); border-top: 1px solid rgba(231, 240, 234, 0.08); }
`,
      created
    );
    await write(
      workspace,
      `${rootRel}/main.js`,
      `document.documentElement.dataset.ready = "1";
console.log("${name} site ready");
`,
      created
    );
    await write(
      workspace,
      `${rootRel}/vite.config.js`,
      `import { defineConfig } from "vite";
export default defineConfig({ server: { host: "127.0.0.1", port: 5173 } });
`,
      created
    );
  }

  if (kind === "electron-app") {
    await write(
      workspace,
      `${rootRel}/package.json`,
      JSON.stringify(
        {
          name,
          private: true,
          main: "electron/main.cjs",
          scripts: {
            start: "electron .",
            dev: "vite",
            build: "vite build",
          },
          dependencies: {
            react: "^19.1.1",
            "react-dom": "^19.1.1",
          },
          devDependencies: {
            electron: "^38.0.0",
            vite: "^7.1.5",
            "@vitejs/plugin-react": "^5.0.2",
            typescript: "^5.9.2",
            "@types/react": "^19.1.12",
            "@types/react-dom": "^19.1.9",
          },
        },
        null,
        2
      ) + "\n",
      created
    );
    await write(
      workspace,
      `${rootRel}/electron/main.cjs`,
      `const { app, BrowserWindow } = require("electron");
const path = require("path");

function createWindow() {
  const win = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: { contextIsolation: true },
  });
  const prod = path.join(__dirname, "..", "dist", "index.html");
  if (require("fs").existsSync(prod)) win.loadFile(prod);
  else win.loadURL("http://127.0.0.1:5173");
}

app.whenReady().then(createWindow);
`,
      created
    );
    await write(
      workspace,
      `${rootRel}/index.html`,
      `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${name}</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
`,
      created
    );
    await write(
      workspace,
      `${rootRel}/src/main.tsx`,
      `import { createRoot } from "react-dom/client";
import { App } from "./App";

createRoot(document.getElementById("root")!).render(<App />);
`,
      created
    );
    await write(
      workspace,
      `${rootRel}/src/App.tsx`,
      `export function App() {
  return (
    <main style={{ fontFamily: "system-ui", padding: 24 }}>
      <h1>${name}</h1>
      <p>Electron desktop shell — build your app UI here.</p>
    </main>
  );
}
`,
      created
    );
    await write(
      workspace,
      `${rootRel}/vite.config.ts`,
      `import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  base: "./",
  server: { host: "127.0.0.1", port: 5173 },
});
`,
      created
    );
  }

  if (kind === "game-canvas") {
    await write(
      workspace,
      `${rootRel}/package.json`,
      JSON.stringify(
        {
          name,
          private: true,
          type: "module",
          scripts: {
            dev: "vite",
            build: "tsc && vite build",
            preview: "vite preview",
          },
          devDependencies: {
            typescript: "^5.9.2",
            vite: "^7.1.5",
          },
        },
        null,
        2
      ) + "\n",
      created
    );
    await write(
      workspace,
      `${rootRel}/index.html`,
      `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${name}</title>
    <style>
      html, body { margin: 0; height: 100%; background: #0b0f14; }
      #game { display: block; margin: 0 auto; background: #111820; }
      .hud { color: #cfe3ff; font: 14px ui-monospace, monospace; text-align: center; padding: 8px; }
    </style>
  </head>
  <body>
    <div class="hud">${name} — arrows / WASD move · space boost</div>
    <canvas id="game" width="800" height="450"></canvas>
    <script type="module" src="/src/main.ts"></script>
  </body>
</html>
`,
      created
    );
    await write(
      workspace,
      `${rootRel}/tsconfig.json`,
      JSON.stringify(
        {
          compilerOptions: {
            target: "ES2022",
            module: "ESNext",
            moduleResolution: "Bundler",
            strict: true,
            noEmit: true,
            skipLibCheck: true,
          },
          include: ["src"],
        },
        null,
        2
      ) + "\n",
      created
    );
    await write(
      workspace,
      `${rootRel}/src/main.ts`,
      `const canvas = document.getElementById("game") as HTMLCanvasElement;
const ctx = canvas.getContext("2d")!;

const keys = new Set<string>();
addEventListener("keydown", (e) => keys.add(e.key.toLowerCase()));
addEventListener("keyup", (e) => keys.delete(e.key.toLowerCase()));

const player = { x: 120, y: 200, vx: 0, vy: 0, r: 14, score: 0 };
const coin = { x: 500, y: 180, r: 10 };

function update(dt: number) {
  const speed = keys.has(" ") ? 420 : 260;
  player.vx = (keys.has("arrowright") || keys.has("d") ? 1 : 0) - (keys.has("arrowleft") || keys.has("a") ? 1 : 0);
  player.vy = (keys.has("arrowdown") || keys.has("s") ? 1 : 0) - (keys.has("arrowup") || keys.has("w") ? 1 : 0);
  const len = Math.hypot(player.vx, player.vy) || 1;
  player.x = Math.max(player.r, Math.min(canvas.width - player.r, player.x + (player.vx / len) * speed * dt));
  player.y = Math.max(player.r, Math.min(canvas.height - player.r, player.y + (player.vy / len) * speed * dt));
  const dx = player.x - coin.x;
  const dy = player.y - coin.y;
  if (Math.hypot(dx, dy) < player.r + coin.r) {
    player.score += 1;
    coin.x = 40 + Math.random() * (canvas.width - 80);
    coin.y = 40 + Math.random() * (canvas.height - 80);
  }
}

function draw() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = "#1a2330";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = "#f5c542";
  ctx.beginPath();
  ctx.arc(coin.x, coin.y, coin.r, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#3ecf8e";
  ctx.beginPath();
  ctx.arc(player.x, player.y, player.r, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#cfe3ff";
  ctx.font = "16px ui-monospace, monospace";
  ctx.fillText("score " + player.score, 16, 28);
}

let last = performance.now();
function frame(now: number) {
  const dt = Math.min(0.033, (now - last) / 1000);
  last = now;
  update(dt);
  draw();
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
`,
      created
    );
    await write(
      workspace,
      `${rootRel}/vite.config.ts`,
      `import { defineConfig } from "vite";
export default defineConfig({ server: { host: "127.0.0.1", port: 5173 } });
`,
      created
    );
  }

  if (kind === "mod-fabric") {
    await write(
      workspace,
      `${rootRel}/README.md`,
      `# ${name} (Fabric mod skeleton)

Scaffolded by Helix Own for **Minecraft Fabric**.

## Important
- Set \`minecraft_version\`, \`yarn_mappings\`, and \`fabric_version\` from https://fabricmc.net/develop/
- Requires JDK 21+ for modern Minecraft versions

## Build
\`\`\`bash
cd ${rootRel}
./gradlew build
# jar → build/libs/
\`\`\`

## First feature
Edit \`src/main/java/.../ExampleMod.java\` and add a tiny item/command, then test in a Fabric profile.
`,
      created
    );
    await write(
      workspace,
      `${rootRel}/gradle.properties`,
      `org.gradle.jvmargs=-Xmx2G
minecraft_version=1.21.1
yarn_mappings=1.21.1+build.3
loader_version=0.16.5
fabric_version=0.105.0+1.21.1
mod_version=0.1.0
maven_group=com.example
archives_base_name=${name}
`,
      created
    );
    await write(
      workspace,
      `${rootRel}/settings.gradle`,
      `rootProject.name = "${name}"
`,
      created
    );
    await write(
      workspace,
      `${rootRel}/build.gradle`,
      `plugins {
  id 'fabric-loom' version '1.8-SNAPSHOT'
  id 'maven-publish'
}

version = project.mod_version
group = project.maven_group

base {
  archivesName = project.archives_base_name
}

repositories {
  mavenCentral()
  maven { url = 'https://maven.fabricmc.net/' }
}

dependencies {
  minecraft "com.mojang:minecraft:\${project.minecraft_version}"
  mappings "net.fabricmc:yarn:\${project.yarn_mappings}:v2"
  modImplementation "net.fabricmc:fabric-loader:\${project.loader_version}"
  modImplementation "net.fabricmc.fabric-api:fabric-api:\${project.fabric_version}"
}

java {
  withSourcesJar()
  sourceCompatibility = JavaVersion.VERSION_21
  targetCompatibility = JavaVersion.VERSION_21
}

tasks.withType(JavaCompile).configureEach {
  it.options.release = 21
}
`,
      created
    );
    await write(
      workspace,
      `${rootRel}/src/main/resources/fabric.mod.json`,
      JSON.stringify(
        {
          schemaVersion: 1,
          id: name.toLowerCase().replace(/[^a-z0-9_]/g, "_"),
          version: "${version}",
          name,
          description: "Scaffolded by Helix Own",
          authors: ["Helix"],
          contact: {},
          license: "MIT",
          environment: "*",
          entrypoints: {
            main: ["com.example.ExampleMod"],
          },
          depends: {
            fabricloader: ">=0.16.0",
            minecraft: "~1.21.1",
            java: ">=21",
          },
        },
        null,
        2
      ) + "\n",
      created
    );
    await write(
      workspace,
      `${rootRel}/src/main/java/com/example/ExampleMod.java`,
      `package com.example;

import net.fabricmc.api.ModInitializer;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

public class ExampleMod implements ModInitializer {
  public static final String MOD_ID = "${name.toLowerCase().replace(/[^a-z0-9_]/g, "_")}";
  public static final Logger LOGGER = LoggerFactory.getLogger(MOD_ID);

  @Override
  public void onInitialize() {
    LOGGER.info("${name} loaded — replace this with your first feature.");
  }
}
`,
      created
    );
  }

  if (kind === "browser-extension") {
    await write(
      workspace,
      `${rootRel}/manifest.json`,
      JSON.stringify(
        {
          manifest_version: 3,
          name,
          version: "0.1.0",
          description: "Scaffolded by Helix Own",
          action: {
            default_popup: "popup.html",
            default_title: name,
          },
          permissions: ["storage"],
          content_scripts: [
            {
              matches: ["<all_urls>"],
              js: ["content.js"],
              run_at: "document_idle",
            },
          ],
          background: {
            service_worker: "background.js",
          },
        },
        null,
        2
      ) + "\n",
      created
    );
    await write(
      workspace,
      `${rootRel}/popup.html`,
      `<!doctype html>
<html>
  <head>
    <meta charset="UTF-8" />
    <title>${name}</title>
    <style>
      body { font: 14px system-ui; margin: 12px; min-width: 220px; }
      button { padding: 6px 10px; }
    </style>
  </head>
  <body>
    <strong>${name}</strong>
    <p>MV3 extension skeleton.</p>
    <button id="ping">Ping page</button>
    <script src="popup.js"></script>
  </body>
</html>
`,
      created
    );
    await write(
      workspace,
      `${rootRel}/popup.js`,
      `document.getElementById("ping")?.addEventListener("click", async () => {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (tab?.id) chrome.tabs.sendMessage(tab.id, { type: "PING" });
});
`,
      created
    );
    await write(
      workspace,
      `${rootRel}/content.js`,
      `chrome.runtime.onMessage.addListener((msg) => {
  if (msg?.type === "PING") {
    console.log("[${name}] ping from popup");
    document.documentElement.style.outline = "2px solid #3ecf8e";
    setTimeout(() => { document.documentElement.style.outline = ""; }, 600);
  }
});
`,
      created
    );
    await write(
      workspace,
      `${rootRel}/background.js`,
      `chrome.runtime.onInstalled.addListener(() => {
  console.log("${name} installed");
});
`,
      created
    );
  }

  // Avoid double README for mod-fabric (already written with mod-specific docs)
  if (kind !== "mod-fabric") {
    await write(
      workspace,
      `${rootRel}/README.md`,
      `# ${name}

Scaffolded by **Helix Own** (\`${kind}\`).

## Next
1. Install dependencies (if any)
2. Implement the core user/player flow
3. Add tests and typecheck where applicable
4. Ship a runnable build / package
`,
      created
    );
  }

  const nextSteps =
    kind === "python-fastapi"
      ? [
          `cd ${rootRel} && python3 -m pip install -r requirements.txt`,
          `cd ${rootRel} && python3 -m uvicorn main:app --reload --port 8000`,
        ]
      : kind === "mod-fabric"
        ? [
            `cd ${rootRel} && # set Fabric versions from https://fabricmc.net/develop/`,
            `cd ${rootRel} && ./gradlew build`,
          ]
        : kind === "browser-extension"
          ? [
              `Load unpacked extension from ${rootRel} in chrome://extensions`,
            ]
          : kind === "electron-app"
            ? [
                `cd ${rootRel} && npm install`,
                `cd ${rootRel} && npm run dev`,
                `cd ${rootRel} && npm start`,
              ]
            : [
                `cd ${rootRel} && npm install`,
                `cd ${rootRel} && npm run build`,
                `cd ${rootRel} && npm run dev`,
              ];

  return { ok: true, kind, root: rootRel, filesCreated: created, nextSteps };
}
