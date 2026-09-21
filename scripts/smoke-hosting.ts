import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import {
  getHostingSettings,
  recommendHost,
  saveHostingSettings,
  startWebsiteSetup,
} from "../src/agent/hosting.js";

const tmp = await fs.mkdtemp(path.join(os.tmpdir(), "helix-host-"));
await fs.writeFile(
  path.join(tmp, "package.json"),
  JSON.stringify({
    name: "demo-site",
    private: true,
    scripts: { build: "echo build" },
    devDependencies: { vite: "^7.0.0" },
  })
);
await fs.writeFile(path.join(tmp, "index.html"), "<!doctype html><title>x</title>");

const rec = await recommendHost(tmp);
console.log("recommend", rec.provider, rec.reason.slice(0, 80));

const locked = await startWebsiteSetup(tmp, { mode: "credentialed", provider: "vercel" });
console.log("locked_status", locked.status);
if (locked.status !== "awaiting-allow") throw new Error("expected awaiting-allow");

await saveHostingSettings(tmp, {
  allowCredentialedSetup: true,
  preferredHost: "vercel",
  vercelToken: "test-token-not-real",
});
const settings = await getHostingSettings(tmp);
console.log("allowed", settings.allowCredentialedSetup, Boolean(settings.vercelToken));

console.log("smoke_hosting_ok", tmp);
