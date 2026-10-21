import { getCurrentWindow } from "@tauri-apps/api/window";
import { Maximize2, Pin, PinOff, Plus, Settings, X } from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";
import type { WidgetNote } from "@/types/widget";
import { addNoteWidget, removeNoteWidget } from "./widget-manager";
import { accentColors } from "./section-catalog";
import { useWindowBounds } from "./use-window-bounds";
import { WindowResizeHandles } from "./window-resize-handles";

export function WidgetFrame({
  id,
  note,
  saved,
  beforeClose,
  onSettings,
  children,
}: {
  id: string;
  note: WidgetNote | null;
  saved: boolean;
  beforeClose: () => Promise<void>;
  onSettings: () => void;
  children: ReactNode;
}) {
  const root = id === "root-note";
  const [pinned, setPinned] = useState(
    () => localStorage.getItem(`threadnote.pinned.${id}`) === "true",
  );
  const [chromeOpen, setChromeOpen] = useState(false);
  useWindowBounds(id);
  useEffect(() => {
    void getCurrentWindow().setAlwaysOnTop(pinned);
  }, []);
  useEffect(() => {
    const escape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setChromeOpen(false);
    };
    window.addEventListener("keydown", escape);
    return () => window.removeEventListener("keydown", escape);
  }, []);
  const close = async () => {
    // A failed flush keeps the note open instead of silently dropping edits.
    try {
      await beforeClose();
      if (root) await getCurrentWindow().hide();
      else {
        removeNoteWidget(id);
        await getCurrentWindow().destroy();
      }
    } catch {
      /* Persistence errors are shown by the workspace hook. */
    }
  };
  const togglePin = async () => {
    const next = !pinned;
    await getCurrentWindow().setAlwaysOnTop(next);
    localStorage.setItem(`threadnote.pinned.${id}`, String(next));
    setPinned(next);
  };
  return (
    <main className={`widget-shell ${chromeOpen ? "chrome-forced-open" : ""}`}>
      <div
        className="accent-line"
        style={{ backgroundColor: accentColors[note?.color ?? "amber"] }}
      />
      <div className="widget-content">{children}</div>
      <div className="window-chrome">
        <button
          className="chrome-peek"
          aria-label="Show window controls"
          aria-expanded={chromeOpen}
          title="Controls"
          onClick={() => setChromeOpen((value) => !value)}
        >
          <span />
        </button>
        <header data-tauri-drag-region className="widget-header">
          <span
            data-tauri-drag-region
            className="window-note-dot"
            style={{ backgroundColor: accentColors[note?.color ?? "amber"] }}
          />
          <p
            data-tauri-drag-region
            className="window-note-title"
            title={saved ? "Saved" : "Saving…"}
          >
            {note?.title.trim() || "New note"}
          </p>
          <div className="window-actions">
            <button
              className="icon-button"
              onClick={() => void addNoteWidget()}
              title="New note window"
              aria-label="New note window"
            >
              <Plus size={15} />
            </button>
            <button
              className={`icon-button ${pinned ? "!text-amber-300" : ""}`}
              onClick={() => void togglePin()}
              title="Always on top"
            >
              {pinned ? <PinOff size={13} /> : <Pin size={13} />}
            </button>
            <button
              className="icon-button"
              onClick={() => void getCurrentWindow().toggleMaximize()}
              title="Maximize window"
              aria-label="Maximize window"
            >
              <Maximize2 size={13} />
            </button>
            <button className="icon-button" onClick={onSettings} title="Settings">
              <Settings size={13} />
            </button>
            <button
              className="icon-button window-close"
              onClick={() => void close()}
              title="Close window"
            >
              <X size={14} />
            </button>
          </div>
        </header>
      </div>
      <WindowResizeHandles />
    </main>
  );
}
