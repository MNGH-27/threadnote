import { invoke } from "@tauri-apps/api/core";
import { ExternalLink, Globe2, RefreshCw } from "lucide-react";
import { useState } from "react";
import type { NoteSection } from "@/types/widget";
import { normalizeWebsite } from "@/lib/website";
import { NativeSiteView } from "../native-site-view";
import { Empty } from "../empty-state";

export function SiteSection({
  section,
  onChange,
}: {
  section: NoteSection;
  onChange: (config: Record<string, unknown>) => void;
}) {
  const savedUrl =
    typeof section.config.url === "string" ? (normalizeWebsite(section.config.url) ?? "") : "";
  const pageZoom =
    typeof section.config.pageZoom === "number" && Number.isFinite(section.config.pageZoom)
      ? Math.max(0.4, Math.min(1.5, section.config.pageZoom))
      : 0.85;
  const [draft, setDraft] = useState(savedUrl);
  const [error, setError] = useState("");
  const [reloadKey, setReloadKey] = useState(0);
  const apply = () => {
    const safe = normalizeWebsite(draft);
    if (!safe) {
      setError("Enter a valid website address.");
      return;
    }
    setError("");
    setDraft(safe);
    onChange({ ...section.config, url: safe, pageZoom });
    if (safe === savedUrl) setReloadKey((value) => value + 1);
  };
  return (
    <div className="site-section" dir="ltr">
      <form
        className="site-address-bar"
        onSubmit={(event) => {
          event.preventDefault();
          apply();
        }}
      >
        <input
          dir="auto"
          className="field ltr"
          aria-label="Website address"
          placeholder="https://example.com"
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
        />
        <button type="submit" className="soft-button">
          Show
        </button>
      </form>
      {savedUrl && (
        <div className="site-controls">
          <span>Website zoom</span>
          <button
            title="Zoom out"
            onClick={() => onChange({ ...section.config, pageZoom: Math.max(0.4, pageZoom - 0.1) })}
          >
            −
          </button>
          <button
            title="Reset website zoom"
            onClick={() => onChange({ ...section.config, pageZoom: 1 })}
          >
            {Math.round(pageZoom * 100)}%
          </button>
          <button
            title="Zoom in"
            onClick={() => onChange({ ...section.config, pageZoom: Math.min(1.5, pageZoom + 0.1) })}
          >
            +
          </button>
          <button title="Reload" onClick={() => setReloadKey((value) => value + 1)}>
            <RefreshCw size={13} />
          </button>
          <button
            title="Open in browser"
            onClick={() => void invoke("open_website", { url: savedUrl })}
          >
            <ExternalLink size={13} />
          </button>
        </div>
      )}
      {error && <p className="error-box mt-2">{error}</p>}
      {savedUrl ? (
        <NativeSiteView
          sectionId={section.id}
          url={savedUrl}
          pageZoom={pageZoom}
          reloadKey={reloadKey}
        />
      ) : (
        <Empty icon={<Globe2 size={18} />} title="Enter a website address" text="" />
      )}
    </div>
  );
}
