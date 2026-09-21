/**
 * Smoke test for continuous local learning from user chats.
 */
import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import {
  appendExamples,
  buildMergedDataset,
  examplesFromMessages,
  ingestMessages,
  learningStatus,
  observeUserInput,
  recordFeedback,
  saveLearningSettings,
} from "../src/agent/learning.js";

const tmp = await fs.mkdtemp(path.join(os.tmpdir(), "helix-learn-"));

await saveLearningSettings(tmp, {
  enabled: true,
  autoIngest: true,
  autoRetrain: false,
  retrainEvery: 8,
});

const observed = await observeUserInput(tmp, {
  text: "Please fix the TypeScript build errors in src/server.",
  kind: "prompt",
});
console.log("observe", observed);

const messages = [
  { role: "user", content: "Add a health endpoint that returns ok." },
  {
    role: "assistant",
    content: "I'll add GET /api/health returning { ok: true }.",
    parts: [
      { type: "text", text: "I'll add GET /api/health returning { ok: true }." },
      {
        type: "tool-write_file",
        state: "output-available",
        output: { path: "src/server/index.ts", ok: true },
      },
    ],
  },
  { role: "user", content: "Also return the version." },
  {
    role: "assistant",
    parts: [{ type: "text", text: "Updated /api/health to include version from package.json." }],
  },
];

const pairs = examplesFromMessages(messages, "chat");
console.log("pairs", pairs.length);
if (pairs.length < 2) throw new Error("expected >=2 SFT pairs");

const ingest = await ingestMessages(tmp, messages, "chat");
console.log("ingest", ingest.added, ingest.settings.totalExamples);
if (ingest.added < 2) throw new Error("ingest should add examples");

const feedback = await recordFeedback(tmp, {
  userText: "Return ok from health",
  assistantText: "res.json({ ok: true })",
  rating: "up",
});
console.log("feedback", feedback.added);

const down = await recordFeedback(tmp, {
  userText: "bad answer case",
  assistantText: "wrong",
  rating: "down",
});
console.log("downvote_skipped", down.added === 0);

const status = await learningStatus(tmp);
console.log("status", status.settings.totalExamples, status.exampleFileBytes > 0);

const merged = await buildMergedDataset(tmp);
const mergedRaw = await fs.readFile(merged, "utf8");
console.log("merged_lines", mergedRaw.trim().split("\n").length);
if (!mergedRaw.includes("health")) throw new Error("merged dataset missing user data");

// Dedupe: re-ingest same messages should add 0
const again = await appendExamples(tmp, examplesFromMessages(messages, "chat"));
console.log("dedupe", again.added === 0);

console.log("smoke_learning_ok", tmp);
