import { isEnabled, enable } from "@tauri-apps/plugin-autostart";
import { LoaderCircle } from "lucide-react";
import { useEffect } from "react";
import type { NoteSection } from "@/types/widget";
import { currentNoteId, restoreNoteWidgets } from "./widget-manager";
import { CanvasWorkspace } from "./canvas-workspace";
import { useGoogle } from "./google-account";
import { CalendarSection, GmailSection, GoogleTasksSection } from "./google-panels";
import { accentColors, noteColors, sectionMeta } from "./section-catalog";
import { Empty } from "./empty-state";
import { WidgetFrame } from "./widget-frame";
import { SettingsPanel } from "./settings-panel";
import { AddSection } from "./add-section";
import { LocalTasksSection } from "./sections/local-tasks-section";
import { MindmapSection } from "./sections/mindmap-section";
import { ImageSection } from "./sections/image-section";
import { TextNoteSection } from "./sections/text-note-section";
import { SiteSection } from "./sections/site-section";
import { useNoteWorkspace } from "./use-note-workspace";
import { reconcileAutostart } from "@/lib/autostart";
import { invoke } from "@tauri-apps/api/core";
import { useTrayControls } from "./use-tray-controls";

function NoteWidget({ id }: { id: string }) {
  const { status, setStatus } = useGoogle();
  const {
    note,
    sections,
    saved,
    error,
    settings,
    setSettings,
    patchNote,
    addSection,
    removeSection,
    updateSection,
    flush,
  } = useNoteWorkspace(id);
  const tray = useTrayControls(id, setSettings);
  useEffect(() => {
    if (id !== "root-note") return;
    for (const key of Object.keys(localStorage)) {
      if (key.startsWith("threadnote.plan-welcome.")) localStorage.removeItem(key);
    }
    void restoreNoteWidgets();
    void reconcileAutostart(
      Boolean(localStorage.getItem("threadnote.autostart.configured")),
      isEnabled,
      enable,
      () => localStorage.setItem("threadnote.autostart.configured", "true"),
    )
      .then(() => invoke("tray_sync_startup"))
      .catch(() => {
        /* Startup configuration failure must not prevent local notes from opening. */
      });
  }, [id]);
  const renderSection = (section: NoteSection) => {
    const change = (config: Record<string, unknown>) =>
      updateSection(section, { ...config, layout: section.config.layout });
    switch (section.type) {
      case "note":
        return <TextNoteSection section={section} onChange={change} />;
      case "email":
        return <GmailSection status={status} onStatus={setStatus} />;
      case "calendar":
        return <CalendarSection status={status} onStatus={setStatus} />;
      case "tasks":
        return (
          <>
            <GoogleTasksSection status={status} onStatus={setStatus} />
            <details className="local-tasks-details">
              <summary>Local tasks on this device</summary>
              <LocalTasksSection />
            </details>
          </>
        );
      case "mindmap":
        return <MindmapSection section={section} onChange={change} />;
      case "image":
        return <ImageSection section={section} onChange={change} />;
      case "site":
        return <SiteSection section={section} onChange={change} />;
    }
  };
  return (
    <WidgetFrame
      id={id}
      note={note}
      saved={saved}
      beforeClose={flush}
      onSettings={() => setSettings(true)}
    >
      {tray.error && (
        <div className="workspace-error" role="alert">
          {tray.error}
          <button className="soft-button" onClick={tray.clearError}>
            Dismiss
          </button>
        </div>
      )}
      {error && (
        <div className="workspace-error" role="alert">
          {error}
          <button className="soft-button" onClick={() => void flush().catch(() => {})}>
            Retry save
          </button>
        </div>
      )}
      {note && !settings ? (
        <CanvasWorkspace
          noteId={id}
          accentColor={accentColors[note.color]}
          sections={sections}
          sectionInfo={(section) => {
            const meta = sectionMeta[section.type];
            const Icon = meta.icon;
            return {
              title: meta.title,
              icon: (
                <span className={`section-type-icon ${meta.tone}`}>
                  <Icon size={15} />
                </span>
              ),
            };
          }}
          noteContent={
            <div className="note-editor" dir="ltr">
              <input
                dir="auto"
                className="note-title"
                placeholder="Note title"
                value={note.title}
                onChange={(event) => patchNote({ title: event.target.value })}
              />
              <div className="color-row">
                {noteColors.map((color) => (
                  <button
                    key={color}
                    aria-label={`Color ${color}`}
                    onClick={() => patchNote({ color })}
                    style={{ backgroundColor: accentColors[color] }}
                    className={note.color === color ? "active" : ""}
                  />
                ))}
              </div>
              <textarea
                dir="auto"
                className="note-body"
                placeholder="Write here…"
                value={note.body}
                onChange={(event) => patchNote({ body: event.target.value })}
              />
            </div>
          }
          renderAdd={(add, onOpenChange) => <AddSection onAdd={add} onOpenChange={onOpenChange} />}
          renderSection={renderSection}
          addSection={(type, position) => void addSection(type, position)}
          removeSection={removeSection}
          updateSection={updateSection}
        />
      ) : !settings ? (
        <Empty
          icon={<LoaderCircle className="animate-spin" size={18} />}
          title="Opening note…"
          text=""
        />
      ) : null}
      {settings && (
        <SettingsPanel status={status} onStatus={setStatus} onClose={() => setSettings(false)} />
      )}
    </WidgetFrame>
  );
}

export function DesktopWidget() {
  return <NoteWidget id={currentNoteId()} />;
}
