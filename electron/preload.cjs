const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("helixDesktop", {
  isDesktop: true,
  platform: process.platform,
  minimize: () => ipcRenderer.invoke("window:minimize"),
  maximize: () => ipcRenderer.invoke("window:maximize"),
  close: () => ipcRenderer.invoke("window:close"),
  isMaximized: () => ipcRenderer.invoke("window:isMaximized"),
  revealInFolder: (targetPath) => ipcRenderer.invoke("fs:reveal", targetPath),
  openPath: (targetPath) => ipcRenderer.invoke("fs:openPath", targetPath),
  onMaximizedChange: (callback) => {
    const handler = (_event, value) => callback(value);
    ipcRenderer.on("window:maximized", handler);
    return () => ipcRenderer.removeListener("window:maximized", handler);
  },
});
