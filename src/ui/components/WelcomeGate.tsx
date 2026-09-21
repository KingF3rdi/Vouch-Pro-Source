import { useState } from "react";

/**
 * First-run welcome — one clear action to start Helix Own.
 */
export function WelcomeGate({
  onStart,
  trained,
}: {
  onStart: () => void;
  trained: boolean;
}) {
  const [hidden, setHidden] = useState(
    () =>
      typeof localStorage !== "undefined" &&
      localStorage.getItem("helix.welcome.done") === "1"
  );

  if (hidden) return null;

  return (
    <div className="welcome-gate">
      <div className="welcome-card">
        <div className="brand-glyph" aria-hidden />
        <h1>Helix Own</h1>
        <p>
          Agent für Apps, Websites, Games & Mods — plus Ship, Hosting und Paper-Trading.
          {trained ? " LoRA-Weights geladen." : " Startet mit lokalem Modell."}
        </p>
        <button
          type="button"
          className="send-btn welcome-cta"
          onClick={() => {
            localStorage.setItem("helix.welcome.done", "1");
            setHidden(true);
            onStart();
          }}
        >
          Loslegen
        </button>
        <button
          type="button"
          className="ghost-btn"
          onClick={() => {
            localStorage.setItem("helix.welcome.done", "1");
            setHidden(true);
          }}
        >
          Überspringen
        </button>
      </div>
    </div>
  );
}
