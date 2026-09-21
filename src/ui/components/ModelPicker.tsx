import { useEffect, useState } from "react";

export type HelixModelInfo = {
  id: string;
  name: string;
  description: string;
  badge: string;
  engine: string;
};

export function ModelPicker({
  selectedId,
  onSelect,
}: {
  selectedId: string;
  onSelect: (id: string) => void;
}) {
  const [models, setModels] = useState<HelixModelInfo[]>([]);
  const [open, setOpen] = useState(false);
  const [gatewayConfigured, setGatewayConfigured] = useState(false);

  useEffect(() => {
    void fetch("/api/models")
      .then((r) => r.json())
      .then((data) => {
        setModels(data.models ?? []);
        setGatewayConfigured(Boolean(data.gatewayConfigured || data.openaiConfigured || data.anthropicConfigured));
      });
  }, []);

  const selected = models.find((m) => m.id === selectedId) ?? models[0];

  return (
    <div className="model-picker no-drag">
      <button
        type="button"
        className="model-trigger"
        onClick={() => setOpen((v) => !v)}
        title={selected?.description}
      >
        <span className="model-label">Helix model</span>
        <strong>{selected?.name ?? "…"}</strong>
        {selected?.badge ? <span className="model-badge">{selected.badge}</span> : null}
      </button>
      {open ? (
        <div className="model-menu">
          {!gatewayConfigured ? (
            <div className="model-hint">
              <strong>Helix Own</strong> needs no paid keys — run{" "}
              <code>npm run train:own</code> (local Ollama + curriculum). Optional free
              tiers: Groq / OpenRouter keys in <code>.env</code>. Helix Code / Astra / Fable
              need a paid gateway key.
            </div>
          ) : null}
          {models.map((model) => (
            <button
              key={model.id}
              type="button"
              className={`model-option${model.id === selectedId ? " active" : ""}`}
              onClick={() => {
                onSelect(model.id);
                setOpen(false);
              }}
            >
              <div className="model-option-title">
                <strong>{model.name}</strong>
                <span className="model-badge">{model.badge}</span>
              </div>
              <span className="muted">{model.description}</span>
              <span className="engine-line">{model.engine}</span>
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
