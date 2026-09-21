const { app, BrowserWindow, shell, ipcMain, Menu, dialog, utilityProcess } = require("electron");
const path = require("path");
const { spawn } = require("child_process");
const http = require("http");
const fs = require("fs");

const PORT = Number(process.env.HELIX_PORT || 8787);
const PYTHON_PORT = Number(process.env.HELIX_PYTHON_PORT || 8788);
const DEV_UI = process.env.HELIX_UI_URL || "http://127.0.0.1:5173";
let serverProcess = null;
let serverChild = null; // ChildProcess fallback
let pythonProcess = null;
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

function waitForUrl(url, attempts = 120) {
  return new Promise((resolve, reject) => {
    let left = attempts;
    const tick = () => {
      const req = http.get(url, (res) => {
        res.resume();
        if (res.statusCode && res.statusCode < 500) resolve(undefined);
        else retry();
      });
      req.on("error", retry);
    };
    const retry = () => {
      left -= 1;
      if (left <= 0) reject(new Error(`Timed out waiting for ${url}`));
      else setTimeout(tick, 250);
    };
    tick();
  });
}

/** App files root (no asar — real paths for Windows portable). */
function resolveAppRoot() {
  if (!app.isPackaged) return path.join(__dirname, "..");
  // With asar:false, getAppPath() is the resources/app folder
  const appPath = app.getAppPath();
  if (fs.existsSync(path.join(appPath, "dist", "server", "index.js"))) return appPath;
  const unpacked = appPath.replace(/app\.asar$/i, "app.asar.unpacked");
  if (fs.existsSync(path.join(unpacked, "dist", "server", "index.js"))) return unpacked;
  if (fs.existsSync(path.join(process.resourcesPath, "app", "dist", "server", "index.js"))) {
    return path.join(process.resourcesPath, "app");
  }
  return appPath;
}

function resolvePython() {
  return process.env.HELIX_PYTHON || (process.platform === "win32" ? "python" : "python3");
}

function resolveBackendDir() {
  if (app.isPackaged) {
    const candidates = [
      path.join(process.resourcesPath, "backend"),
      path.join(resolveAppRoot(), "backend"),
    ];
    for (const candidate of candidates) {
      if (fs.existsSync(path.join(candidate, "main.py"))) return candidate;
    }
  }
  return path.join(__dirname, "..", "backend");
}

function resolveServerEntry(appRoot) {
  const candidates = [
    path.join(appRoot, "dist", "server", "index.js"),
    path.join(appRoot, "src", "server", "index.ts"),
  ];
  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) return candidate;
  }
  return null;
}

/** Primary agent server — never re-spawn Helix.exe (portable Temp ENOENT). */
function startTsServer() {
  if (serverProcess || serverChild) return serverProcess || serverChild;
  const appRoot = resolveAppRoot();
  const env = {
    ...process.env,
    HELIX_PORT: String(PORT),
    HELIX_ROOT: appRoot,
    HELIX_WORKSPACE:
      process.env.HELIX_WORKSPACE ||
      (app.isPackaged ? app.getPath("userData") : process.cwd()),
    HELIX_DESKTOP: "1",
    HELIX_MAX_TOKENS: process.env.HELIX_MAX_TOKENS || "0",
    HELIX_MAX_STEPS: process.env.HELIX_MAX_STEPS || "0",
  };

  if (app.isPackaged) {
    const entry = resolveServerEntry(appRoot);
    if (!entry) {
      logLine(`ERROR: no server entry under ${appRoot}`);
      return null;
    }

    // Prefer boot script next to main (always outside asar when electron/ is packed in asar —
    // copy boot into unpacked via asarUnpack, or resolve from __dirname which is app.asar/electron)
    const bootCandidates = [
      path.join(appRoot, "electron", "server-boot.cjs"),
      path.join(__dirname, "server-boot.cjs"),
    ];
    const boot = bootCandidates.find((p) => fs.existsSync(p));
    if (!boot) {
      logLine("ERROR: missing electron/server-boot.cjs");
      return null;
    }

    const forkEnv = {
      ...env,
      HELIX_SERVER_ENTRY: entry,
    };

    logLine(`starting utilityProcess boot=${boot} entry=${entry}`);
    try {
      serverProcess = utilityProcess.fork(boot, [], {
        cwd: appRoot,
        env: forkEnv,
        stdio: "pipe",
        serviceName: "helix-server",
      });
      serverProcess.on("exit", (code) => {
        logLine(`utilityProcess exited code=${code}`);
        serverProcess = null;
      });
      if (serverProcess.stdout) {
        serverProcess.stdout.on("data", (buf) => logLine(String(buf).trimEnd()));
      }
      if (serverProcess.stderr) {
        serverProcess.stderr.on("data", (buf) => logLine(String(buf).trimEnd()));
      }
      return serverProcess;
    } catch (error) {
      logLine(
        `utilityProcess.fork failed: ${error instanceof Error ? error.message : error}`
      );
      // Last resort: system node if present (not Helix.exe)
      const nodeCmd = process.platform === "win32" ? "node.exe" : "node";
      try {
        serverChild = spawn(nodeCmd, [boot], {
          cwd: appRoot,
          env: forkEnv,
          stdio: ["ignore", "pipe", "pipe"],
          windowsHide: true,
          shell: false,
        });
        serverChild.stdout?.on("data", (buf) => logLine(String(buf).trimEnd()));
        serverChild.stderr?.on("data", (buf) => logLine(String(buf).trimEnd()));
        serverChild.on("exit", (code, signal) => {
          logLine(`node child exited code=${code} signal=${signal}`);
          serverChild = null;
        });
        serverChild.on("error", (err) => {
          logLine(`node child error: ${err.message}`);
        });
        return serverChild;
      } catch (err2) {
        logLine(`fallback node spawn failed: ${err2 instanceof Error ? err2.message : err2}`);
        return null;
      }
    }
  }

  const root = path.join(__dirname, "..");
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
  return serverChild;
}

/** Optional: Python FastAPI agents on a separate port. */
function startPythonAgents() {
  if (process.env.HELIX_ENABLE_PYTHON_AGENTS !== "1") return null;
  if (pythonProcess) return pythonProcess;
  const backendDir = resolveBackendDir();
  if (!fs.existsSync(path.join(backendDir, "main.py"))) return null;

  pythonProcess = spawn(
    resolvePython(),
    ["-m", "uvicorn", "main:app", "--host", "127.0.0.1", "--port", String(PYTHON_PORT)],
    {
      cwd: backendDir,
      env: {
        ...process.env,
        HELIX_PORT: String(PYTHON_PORT),
        HELIX_WORKSPACE:
          process.env.HELIX_WORKSPACE ||
          (app.isPackaged ? app.getPath("userData") : process.cwd()),
      },
      stdio: "ignore",
      windowsHide: true,
    }
  );
  pythonProcess.on("exit", () => {
    pythonProcess = null;
  });
  return pythonProcess;
}

function createWindow(loadUrl) {
  mainWindow = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1100,
    minHeight: 700,
    backgroundColor: "#0b0d10",
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
    },
  });

  Menu.setApplicationMenu(null);

  mainWindow.once("ready-to-show", () => mainWindow.show());
  mainWindow.on("maximize", () => mainWindow.webContents.send("window:maximized", true));
  mainWindow.on("unmaximize", () => mainWindow.webContents.send("window:maximized", false));

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    void shell.openExternal(url);
    return { action: "deny" };
  });

  mainWindow.loadURL(loadUrl);

  if (process.env.HELIX_CAPTURE_SCREENSHOT) {
    mainWindow.webContents.once("did-finish-load", async () => {
      await new Promise((r) => setTimeout(r, 2000));
      const image = await mainWindow.capturePage();
      const out = process.env.HELIX_CAPTURE_SCREENSHOT;
      fs.writeFileSync(out, image.toPNG());
      console.log(`[helix] wrote desktop screenshot ${out}`);
      app.quit();
    });
  }
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
  logLine(`ready packaged=${app.isPackaged} platform=${process.platform}`);
  const started = startTsServer();
  startPythonAgents();

  try {
    if (!started && app.isPackaged) {
      throw new Error(
        "Could not start Helix server (missing dist/server). Reinstall or use npm start."
      );
    }
    await waitForUrl(`http://127.0.0.1:${PORT}/api/health`);
    logLine("health ok");
  } catch (error) {
    const logPath = path.join(app.getPath("userData"), "helix-desktop.log");
    const message = error instanceof Error ? error.message : String(error);
    logLine(`startup failed: ${message}`);
    dialog.showErrorBox(
      "Helix start failed",
      `${message}\n\nLog file:\n${logPath}\n\nTip: install Node is not required — this build embeds the runtime. If antivirus blocked Helix, allow it and retry.`
    );
    app.quit();
    return;
  }

  const url = app.isPackaged ? `http://127.0.0.1:${PORT}` : DEV_UI;
  if (!app.isPackaged) {
    await waitForUrl(DEV_UI).catch(() => undefined);
  }

  createWindow(url);

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow(url);
  });
});

function shutdown() {
  if (serverProcess) {
    try {
      serverProcess.kill();
    } catch {
      // ignore
    }
    serverProcess = null;
  }
  if (serverChild) {
    try {
      serverChild.kill();
    } catch {
      // ignore
    }
    serverChild = null;
  }
  if (pythonProcess) {
    try {
      pythonProcess.kill();
    } catch {
      // ignore
    }
    pythonProcess = null;
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
