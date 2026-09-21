const { app, BrowserWindow, shell, ipcMain, Menu, dialog } = require("electron");
const path = require("path");
const { spawn } = require("child_process");
const http = require("http");
const fs = require("fs");
const { pathToFileURL } = require("url");
const Module = require("module");

const PORT = Number(process.env.HELIX_PORT || 8787);
const DEV_UI = process.env.HELIX_UI_URL || "http://127.0.0.1:5173";
let serverChild = null;
let mainWindow = null;
let logStream = null;

function logLine(message) {
  const line = `[helix] ${new Date().toISOString()} ${message}\n`;
  try {
    if (!logStream) {
      const logPath = path.join(app.getPath("userData"), "helix-desktop.log");
      fs.mkdirSync(app.getPath("userData"), { recursive: true });
      logStream = fs.createWriteStream(logPath, { flags: "a" });
      logStream.write(`\n--- session ${new Date().toISOString()} ---\n`);
    }
    logStream.write(line);
  } catch {
    // ignore
  }
  console.log(message);
}

function waitForUrl(url, attempts = 200, intervalMs = 40) {
  return new Promise((resolve, reject) => {
    let left = attempts;
    const tick = () => {
      const req = http.get(url, (res) => {
        res.resume();
        if (res.statusCode && res.statusCode < 500) resolve(undefined);
        else retry();
      });
      req.on("error", retry);
      req.setTimeout(800, () => {
        req.destroy();
        retry();
      });
    };
    const retry = () => {
      left -= 1;
      if (left <= 0) reject(new Error(`Timed out waiting for ${url}`));
      else setTimeout(tick, intervalMs);
    };
    tick();
  });
}

function resolveAppRoot() {
  if (!app.isPackaged) return path.join(__dirname, "..");
  const appPath = app.getAppPath();
  const candidates = [
    appPath,
    path.join(process.resourcesPath, "app"),
    path.dirname(__dirname),
  ];
  for (const candidate of candidates) {
    if (fs.existsSync(path.join(candidate, "dist", "server", "index.js"))) {
      return candidate;
    }
  }
  return appPath;
}

/**
 * Start the agent HTTP server IN-PROCESS via dynamic ESM import.
 * Never spawn Helix.exe — electron-builder portable extracts to Temp and
 * child spawn of the same exe fails with ENOENT.
 */
async function startPackagedServerInProcess(appRoot) {
  const entry = path.join(appRoot, "dist", "server", "index.js");
  if (!fs.existsSync(entry)) {
    throw new Error(`Missing server entry:\n${entry}`);
  }

  process.env.HELIX_PORT = String(PORT);
  process.env.HELIX_ROOT = appRoot;
  process.env.HELIX_WORKSPACE =
    process.env.HELIX_WORKSPACE || app.getPath("userData");
  process.env.HELIX_DESKTOP = "1";
  process.env.HELIX_MAX_TOKENS = process.env.HELIX_MAX_TOKENS || "0";
  process.env.HELIX_MAX_STEPS = process.env.HELIX_MAX_STEPS || "0";

  try {
    process.chdir(appRoot);
  } catch (err) {
    logLine(`chdir failed: ${err.message}`);
  }

  const prevPaths = Module._nodeModulePaths;
  Module._nodeModulePaths = function (from) {
    const paths = prevPaths.call(this, from);
    const appModules = path.join(appRoot, "node_modules");
    if (!paths.includes(appModules)) paths.unshift(appModules);
    return paths;
  };

  const url = pathToFileURL(entry).href;
  logLine(`import in-process server ${url}`);
  await import(url);
  return true;
}

function startDevServer() {
  const root = path.join(__dirname, "..");
  const env = {
    ...process.env,
    HELIX_PORT: String(PORT),
    HELIX_ROOT: root,
    HELIX_WORKSPACE: process.env.HELIX_WORKSPACE || process.cwd(),
    HELIX_DESKTOP: "1",
    HELIX_MAX_TOKENS: process.env.HELIX_MAX_TOKENS || "0",
    HELIX_MAX_STEPS: process.env.HELIX_MAX_STEPS || "0",
  };
  serverChild = spawn("npx", ["tsx", "src/server/index.ts"], {
    cwd: root,
    env,
    stdio: ["ignore", "pipe", "pipe"],
    shell: process.platform === "win32",
  });
  serverChild.stdout?.on("data", (buf) => logLine(String(buf).trimEnd()));
  serverChild.stderr?.on("data", (buf) => logLine(String(buf).trimEnd()));
  serverChild.on("exit", (code, signal) => {
    logLine(`dev server exited code=${code} signal=${signal}`);
    serverChild = null;
  });
  serverChild.on("error", (err) => logLine(`dev server error: ${err.message}`));
  return serverChild;
}

function createWindow(loadUrl) {
  mainWindow = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1100,
    minHeight: 700,
    backgroundColor: "#121212",
    title: "Helix",
    show: false,
    frame: false,
    autoHideMenuBar: true,
    trafficLightPosition: { x: 16, y: 16 },
    titleBarStyle: process.platform === "darwin" ? "hiddenInset" : undefined,
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
      backgroundThrottling: false,
    },
  });

  Menu.setApplicationMenu(null);

  mainWindow.once("ready-to-show", () => {
    mainWindow?.show();
  });

  mainWindow.on("maximize", () => mainWindow.webContents.send("window:maximized", true));
  mainWindow.on("unmaximize", () => mainWindow.webContents.send("window:maximized", false));

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    void shell.openExternal(url);
    return { action: "deny" };
  });

  void mainWindow.loadURL(loadUrl);
}

function showBootPage(title, body) {
  const html = `data:text/html;charset=utf-8,${encodeURIComponent(`<!doctype html>
<html><head><meta charset="utf-8"/><title>Helix</title>
<style>
  html,body{height:100%;margin:0;background:#121212;color:#e8ecf3;font:15px/1.45 Segoe UI,system-ui,sans-serif}
  main{min-height:100%;display:grid;place-content:center;gap:.75rem;padding:2rem;text-align:center}
  h1{margin:0;font-size:1.6rem;letter-spacing:-.03em}
  p{margin:0;opacity:.75;max-width:36rem}
  .dot{width:.55rem;height:.55rem;border-radius:999px;background:#3ecf8e;margin:.4rem auto 0;animation:pulse 1s ease infinite}
  @keyframes pulse{50%{opacity:.35;transform:scale(.85)}}
</style></head><body><main><h1>${title}</h1><p>${body}</p><div class="dot"></div></main></body></html>`)}`;
  createWindow(html);
}

ipcMain.handle("window:minimize", () => {
  mainWindow?.minimize();
});
ipcMain.handle("window:maximize", () => {
  if (!mainWindow) return false;
  if (mainWindow.isMaximized()) mainWindow.unmaximize();
  else mainWindow.maximize();
  return mainWindow.isMaximized();
});
ipcMain.handle("window:close", () => {
  mainWindow?.close();
});
ipcMain.handle("window:isMaximized", () => Boolean(mainWindow?.isMaximized()));

app.whenReady().then(async () => {
  const t0 = Date.now();
  process.on("uncaughtException", (error) => {
    logLine(`uncaughtException: ${error?.stack || error}`);
  });
  process.on("unhandledRejection", (reason) => {
    logLine(`unhandledRejection: ${reason}`);
  });

  logLine(`ready packaged=${app.isPackaged} platform=${process.platform} exe=${process.execPath}`);
  showBootPage("Helix", "Starting…");

  try {
    if (app.isPackaged) {
      const appRoot = resolveAppRoot();
      logLine(`appRoot=${appRoot}`);
      await startPackagedServerInProcess(appRoot);
    } else {
      startDevServer();
    }
    await waitForUrl(`http://127.0.0.1:${PORT}/api/health`);
    logLine(`health ok in ${Date.now() - t0}ms`);

    const url = app.isPackaged ? `http://127.0.0.1:${PORT}` : DEV_UI;
    if (!app.isPackaged) {
      await waitForUrl(DEV_UI).catch(() => undefined);
    }
    await mainWindow.loadURL(url);
    logLine(`ui loaded in ${Date.now() - t0}ms`);
  } catch (error) {
    const logPath = path.join(app.getPath("userData"), "helix-desktop.log");
    const message = error instanceof Error ? error.message : String(error);
    logLine(`startup failed: ${message}`);
    dialog.showErrorBox(
      "Helix start failed",
      `${message}\n\nLog:\n${logPath}\n\nPrefer the ZIP build: extract the folder, then run Helix.exe from inside that folder.`
    );
    if (mainWindow) {
      await mainWindow.loadURL(
        `data:text/html;charset=utf-8,${encodeURIComponent(
          `<h1 style="font-family:system-ui">Start failed</h1><pre>${message}\n\n${logPath}</pre>`
        )}`
      );
      mainWindow.show();
    }
  }
});

function shutdown() {
  if (serverChild) {
    try {
      serverChild.kill();
    } catch {
      // ignore
    }
    serverChild = null;
  }
  try {
    logStream?.end();
  } catch {
    // ignore
  }
}

app.on("window-all-closed", () => {
  shutdown();
  if (process.platform !== "darwin") app.quit();
});

app.on("before-quit", shutdown);
