import { understandProject } from "../src/agent/understand.js";
import { scaffoldProject } from "../src/agent/scaffold.js";
import { runQualityCheck } from "../src/agent/quality.js";
import { pickOllamaCoder, probeOllama } from "../src/agent/freeProviders.js";
import { resolveHelixLanguageModelAsync, getHelixModel } from "../src/agent/models.js";
import { generateText } from "ai";

const u = await understandProject("/workspace");
console.log("understand_ok", u.entrypoints.length > 0, u.narrative.slice(0, 160));

const probe = await probeOllama();
console.log("model", pickOllamaCoder(probe.models));

const r = await resolveHelixLanguageModelAsync(getHelixModel("helix-free"));
console.log("resolved", r.resolvedEngine, r.profile.name);

const out = await generateText({
  model: r.model,
  prompt: "In one short sentence: what is Helix Own trained to do?",
});
console.log("reply", out.text.slice(0, 240));

const s = await scaffoldProject("/tmp", {
  kind: "ts-api",
  name: "demo-api",
  relativeRoot: "helix-own-demo",
});
console.log("scaffold_files", s.filesCreated.length);
