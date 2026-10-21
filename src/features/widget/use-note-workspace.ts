import { listen } from "@tauri-apps/api/event";
import { useEffect, useMemo, useRef, useState } from "react";
import { createAutosave } from "@/lib/autosave";
import { listenForWorkspaceFlush } from "@/services/workspace-lifecycle";
import { noteRepository, sectionRepository } from "@/repositories/widget-repository";
import type { NoteSection, NoteSectionType, WidgetNote } from "@/types/widget";
import type { Point } from "./canvas-geometry";

/** Own persistence here; section renderers only describe edits, never write SQL. */
export function useNoteWorkspace(id: string) {
  const [note, setNote] = useState<WidgetNote | null>(null);
  const [sections, setSections] = useState<NoteSection[]>([]);
  const [saved, setSaved] = useState(true);
  const [error, setError] = useState("");
  const [settings, setSettings] = useState(false);
  const currentNote = useRef<WidgetNote | null>(null);
  const active = useRef(false);
  const sectionWrites = useRef(new Map<string, ReturnType<typeof createAutosave<NoteSection>>>());
  const editRevision = useRef(0);
  const flushSections = async () => {
    await Promise.all([...sectionWrites.current.values()].map((writer) => writer.flush()));
  };
  const reportError = () => {
    if (active.current)
      setError("Could not save your workspace. Your latest edits may not be stored.");
  };
  const autosave = useMemo(
    () =>
      createAutosave(noteRepository.update, {
        onSaved: () => {
          if (active.current) {
            setSaved(true);
            setError("");
          }
        },
        onError: reportError,
      }),
    [id],
  );

  useEffect(() => {
    active.current = true;
    let live = true;
    let generation = 0;
    const load = async () => {
      const ticket = ++generation;
      const revision = editRevision.current;
      try {
        // Finish local edits before accepting a cross-window refresh.
        await autosave.flush();
        await flushSections();
        const [loadedNote, loadedSections] = await Promise.all([
          noteRepository.getOrCreate(id),
          sectionRepository.list(id),
        ]);
        if (!live || ticket !== generation || revision !== editRevision.current) return;
        currentNote.current = loadedNote;
        setNote(loadedNote);
        setSections(loadedSections);
      } catch {
        if (live) setError("Could not open your workspace. Please restart the app and try again.");
      }
    };
    const listener = listen<{ noteId: string | null }>("workspace:changed", ({ payload }) => {
      if (payload.noteId === id) void load();
    });
    void listener.then(load).catch(() => {
      void load();
    });
    const flushListener = listenForWorkspaceFlush(async () => {
      await autosave.flush();
      await flushSections();
    });
    return () => {
      live = false;
      active.current = false;
      // React cleanup cannot await, but flushing still queues the final edit.
      void autosave.flush().catch(reportError);
      void flushSections().catch(reportError);
      void listener.then((unlisten) => unlisten()).catch(() => {});
      void flushListener.then((unlisten) => unlisten()).catch(() => {});
    };
  }, [id, autosave]);

  const patchNote = (values: Partial<WidgetNote>) => {
    if (!currentNote.current) return;
    const next = { ...currentNote.current, ...values, updatedAt: Date.now() };
    currentNote.current = next;
    editRevision.current++;
    setNote(next);
    setSaved(false);
    autosave.schedule(next);
  };

  const addSection = async (type: NoteSectionType, position: Point) => {
    try {
      const section = await sectionRepository.create(id, type, {
        ...position,
        width: type === "site" ? 460 : 340,
        height: type === "site" ? 430 : 310,
      });
      editRevision.current++;
      if (active.current) setSections((items) => [...items, section]);
    } catch {
      reportError();
    }
  };
  const removeSection = async (section: NoteSection) => {
    await sectionWrites.current.get(section.id)?.flush();
    await sectionRepository.remove(section.id);
    sectionWrites.current.delete(section.id);
    editRevision.current++;
    setSections((items) => items.filter((item) => item.id !== section.id));
  };
  const updateSection = (section: NoteSection, config: Record<string, unknown>) => {
    const next = { ...section, config, updatedAt: Date.now() };
    editRevision.current++;
    setSections((items) => items.map((item) => (item.id === section.id ? next : item)));
    // Queue all config writes, including resize commits, in user-edit order.
    let writer = sectionWrites.current.get(section.id);
    if (!writer) {
      writer = createAutosave(sectionRepository.updateConfig, { delay: 0, onError: reportError });
      sectionWrites.current.set(section.id, writer);
    }
    writer.schedule(next);
  };
  const flush = async () => {
    try {
      await autosave.flush();
      await flushSections();
      setError("");
    } catch (reason) {
      reportError();
      throw reason;
    }
  };
  return {
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
  };
}
