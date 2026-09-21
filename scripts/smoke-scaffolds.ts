import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { scaffoldProject, type ScaffoldKind } from "../src/agent/scaffold.js";

const kinds: ScaffoldKind[] = [
  "website",
  "game-canvas",
  "mod-fabric",
  "browser-extension",
  "electron-app",
];

const tmp = await fs.mkdtemp(path.join(os.tmpdir(), "helix-scaf-"));
for (const kind of kinds) {
  const r = await scaffoldProject(tmp, {
    kind,
    name: `demo-${kind}`,
    relativeRoot: kind,
  });
  if (!r.ok || r.filesCreated.length < 2) {
    throw new Error(`scaffold failed: ${kind}`);
  }
  console.log(kind, r.filesCreated.length, r.nextSteps[0]);
}
console.log("scaffold_smoke_ok", tmp);
