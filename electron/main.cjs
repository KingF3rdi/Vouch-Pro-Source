const { app, BrowserWindow, shell } = require("electron");
const path = require("path");
const { spawn } = require("child_process");
const http = require("http");

const PORT = Number(process.env.HELIX_PORT || 8787);
const DEV_UI = process.env.HELIX_UI_URL || "http://127.0.0.1:5173";
let serverProcess = null;

function waitForHealth(url, attempts = 60) {
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
      if (left <= 0) reject(new Error("Helix server did not start"));
      else setTimeout(tick, 250);
    };
    tick();
  });
}

function startServer() {
  if (serverProcess) return serverProcess;
  const env = {
    ...process.env,
    HELIX_PORT: String(PORT),
    HELIX_WORKSPACE: process.env.HELIX_WORKSPACE || process.cwd(),
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
    serverProcess = spawn(
      process.platform === "win32" ? "npx.cmd" : "npx",
      ["tsx", "src/server/index.ts"],
      {
        cwd: path.join(__dirname, ".."),
        env,
        stdio: "inherit",
        shell: process.platform === "win32",
      }
    );
  }

  serverProcess.on("exit", () => {
    serverProcess = null;
  });
  return serverProcess;
}

function createWindow(loadUrl) {
  const win = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1100,
    minHeight: 700,
    backgroundColor: "#0b0d10",
    title: "Helix",
    show: false,
    autoHideMenuBar: true,
    titleBarStyle: process.platform === "darwin" ? "hiddenInset" : "default",
    trafficLightPosition: { x: 14, y: 14 },
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  win.once("ready-to-show", () => win.show());
  win.webContents.setWindowOpenHandler(({ url }) => {
    void shell.openExternal(url);
    return { action: "deny" };
  });
  win.loadURL(loadUrl);
}

app.whenReady().then(async () => {
  startServer();
  const health = `http://127.0.0.1:${PORT}/api/health`;
  await waitForHealth(health);

  // Packaged: same UI the browser serves from the API host.
  // Dev: Vite UI (identical CSS/React) with API proxied.
  const url = app.isPackaged ? `http://127.0.0.1:${PORT}` : DEV_UI;
  createWindow(url);

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow(url);
  });
});

app.on("window-all-closed", () => {
  if (serverProcess) {
    serverProcess.kill();
    serverProcess = null;
  }
  if (process.platform !== "darwin") app.quit();
});

app.on("before-quit", () => {
  if (serverProcess) {
    serverProcess.kill();
    serverProcess = null;
  }
});
