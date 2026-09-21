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
  | "monorepo-lite";

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

  await write(
    workspace,
    `${rootRel}/README.md`,
    `# ${name}

Scaffolded by **Helix Own**.

## Next
1. Install dependencies
2. Implement domain logic
3. Add tests and typecheck
4. Ship a runnable build
`,
    created
  );

  const nextSteps =
    kind === "python-fastapi"
      ? [
          `cd ${rootRel} && python3 -m pip install -r requirements.txt`,
          `cd ${rootRel} && python3 -m uvicorn main:app --reload --port 8000`,
        ]
      : [
          `cd ${rootRel} && npm install`,
          `cd ${rootRel} && npm run typecheck`,
          `cd ${rootRel} && npm run dev`,
        ];

  return { ok: true, kind, root: rootRel, filesCreated: created, nextSteps };
}
