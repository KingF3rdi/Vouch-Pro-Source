/**
 * CJS bootstrap for packaged Helix server (ESM).
 * Avoids re-spawning Helix.exe (breaks electron-builder portable → ENOENT).
 */
const path = require("path");
const { pathToFileURL } = require("url");

const entry =
  process.env.HELIX_SERVER_ENTRY ||
  path.join(__dirname, "..", "dist", "server", "index.js");

import(pathToFileURL(entry).href).catch((error) => {
  console.error("[helix] server boot failed:", error);
  process.exit(1);
});
