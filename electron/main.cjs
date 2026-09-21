const { app, BrowserWindow, shell, ipcMain, Menu } = require("electron");
const path = require("path");
const { spawn } = require("child_process");
const http = require("http");
const fs = require("fs");

const PORT = Number(process.env.HELIX_PORT || 8787);
const PYTHON_PORT = Number(process.env.HELIX_PYTHON_PORT || 8788);
const DEV_UI = process.env.HELIX_UI_URL || "http://127.0.0.1:5173";
let serverProcess = null;
let pythonProcess = null;
let mainWindow = null;

function waitForUrl(url, attempts = 80) {
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

function resolvePython() {
  return process.env.HELIX_PYTHON || (process.platform === "win32" ? "python" : "python3");
}

function resolveBackendDir() {
  if (app.isPackaged) {
    const candidates = [
      path.join(process.resourcesPath, "backend"),
      path.join(app.getAppPath(), "backend"),
    ];
    for (const candidate of candidates) {
      if (fs.existsSync(path.join(candidate, "main.py"))) return candidate;
    }
  }
  return path.join(__dirname, "..", "backend");
}

/** Primary: TypeScript agent server (AI SDK). */
function startTsServer() {
  if (serverProcess) return serverProcess;
  const root = path.join(__dirname, "..");
  const env = {
    ...process.env,
    HELIX_PORT: String(PORT),
    HELIX_WORKSPACE: process.env.HELIX_WORKSPACE || (app.isPackaged ? app.getPath("userData") : process.cwd()),
    HELIX_DESKTOP: "1",
    HELIX_MAX_TOKENS: process.env.HELIX_MAX_TOKENS || "0",
    HELIX_MAX_STEPS: process.env.HELIX_MAX_STEPS || "0",
  };

  if (app.isPackaged) {
    const appPath = app.getAppPath();
    const tsxCli = path.join(appPath, "node_modules", "tsx", "dist", "cli.mjs");
    const serverEntry = path.join(appPath, "src", "server", "index.ts");
    serverProcess = spawn(process.execPath, [tsxCli, serverEntry], {
      cwd: appPath,
      env: { ...env, ELECTRON_RUN_AS_NODE: "1" },
      stdio: "inherit",
    });
  } else {
    serverProcess = spawn("npx", ["tsx", "src/server/index.ts"], {
      cwd: root,
      env,
      stdio: "inherit",
      shell: process.platform === "win32",
    });
  }

  serverProcess.on("exit", () => {
    serverProcess = null;
  });
  return serverProcess;
}

/** Optional: Python FastAPI agents on a separate port. */
function startPythonAgents() {
  if (process.env.HELIX_ENABLE_PYTHON_AGENTS === "0") return null;
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
        HELIX_WORKSPACE: process.env.HELIX_WORKSPACE || (app.isPackaged ? app.getPath("userData") : process.cwd()),
      },
      stdio: "inherit",
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
  startTsServer();
  startPythonAgents();
  await waitForUrl(`http://127.0.0.1:${PORT}/api/health`);

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
    serverProcess.kill();
    serverProcess = null;
  }
  if (pythonProcess) {
    pythonProcess.kill();
    pythonProcess = null;
  }
}

app.on("window-all-closed", () => {
  shutdown();
  if (process.platform !== "darwin") app.quit();
});

app.on("before-quit", shutdown);
