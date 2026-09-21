import { useEffect, useState } from "react";
import { Minus, Square, X } from "lucide-react";

type HelixDesktop = {
  isDesktop: boolean;
  platform: string;
  minimize: () => Promise<void>;
  maximize: () => Promise<boolean>;
  close: () => Promise<void>;
  isMaximized: () => Promise<boolean>;
  onMaximizedChange: (cb: (value: boolean) => void) => () => void;
};

declare global {
  interface Window {
    helixDesktop?: HelixDesktop;
  }
}

export function useIsDesktop() {
  return Boolean(window.helixDesktop?.isDesktop);
}

/** Custom window controls so the desktop shell matches the browser preview chrome. */
export function WindowControls() {
  const desktop = window.helixDesktop;
  const [maximized, setMaximized] = useState(false);

  useEffect(() => {
    if (!desktop) return;
    void desktop.isMaximized().then(setMaximized);
    return desktop.onMaximizedChange(setMaximized);
  }, [desktop]);

  if (!desktop || desktop.platform === "darwin") {
    // macOS uses traffic lights; leave space via CSS padding only.
    return null;
  }

  return (
    <div className="window-controls no-drag" aria-label="Window controls">
      <button type="button" className="win-btn" title="Minimize" onClick={() => void desktop.minimize()}>
        <Minus size={14} />
      </button>
      <button
        type="button"
        className="win-btn"
        title={maximized ? "Restore" : "Maximize"}
        onClick={() => void desktop.maximize()}
      >
        <Square size={12} />
      </button>
      <button type="button" className="win-btn close" title="Close" onClick={() => void desktop.close()}>
        <X size={14} />
      </button>
    </div>
  );
}
