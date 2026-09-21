export function PreviewPanel({
  url,
  onUrlChange,
}: {
  url: string;
  onUrlChange: (url: string) => void;
}) {
  return (
    <div className="frame-panel">
      <form
        className="frame-bar"
        onSubmit={(e) => {
          e.preventDefault();
          const form = new FormData(e.currentTarget);
          onUrlChange(String(form.get("url") ?? url));
        }}
      >
        <span className="frame-label">Preview</span>
        <input name="url" defaultValue={url} key={url} placeholder="http://127.0.0.1:5173" />
        <button type="submit" className="ghost-btn">
          Reload
        </button>
      </form>
      <iframe title="preview" className="frame-view" src={url} />
    </div>
  );
}

export function BrowserPanel({
  url,
  onUrlChange,
}: {
  url: string;
  onUrlChange: (url: string) => void;
}) {
  return (
    <div className="frame-panel">
      <form
        className="frame-bar"
        onSubmit={(e) => {
          e.preventDefault();
          const form = new FormData(e.currentTarget);
          let next = String(form.get("url") ?? url).trim();
          if (next && !/^https?:\/\//i.test(next)) next = `https://${next}`;
          onUrlChange(next);
        }}
      >
        <span className="frame-label">Browser</span>
        <input name="url" defaultValue={url} key={url} placeholder="https://example.com" />
        <button type="submit" className="ghost-btn">
          Go
        </button>
      </form>
      <iframe title="browser" className="frame-view" src={url} sandbox="allow-scripts allow-same-origin allow-forms allow-popups" />
      <p className="frame-note">
        Some sites block embedding. Use Preview for your local app; open external docs in a system
        browser when iframe is blocked.
      </p>
    </div>
  );
}
