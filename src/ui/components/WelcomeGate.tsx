import { useEffect, useState } from "react";

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
  const [hidden, setHidden] = useState(false);

  useEffect(() => {
    if (localStorage.getItem("helix.welcome.done") === "1") setHidden(true);
  }, []);

  if (hidden) return null;

  return (
    <div className="welcome-gate">
      <div className="welcome-card">
        <div className="brand-glyph" aria-hidden />
        <h1>Helix Own</h1>
        <p>
          Dein trainierter Coding-Agent. Ein Klick — verstehen, bauen, prüfen.
          Lernt lokal aus allem, was du schickst.
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
