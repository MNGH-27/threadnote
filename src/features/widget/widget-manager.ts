import { WebviewWindow } from "@tauri-apps/api/webviewWindow";

export interface NoteWidgetInstance {
  id: string;
}

const storageKey = "threadnote.note.instances.v2";
const legacyStorageKey = "threadnote.widget.instances.v1";
const opening = new Map<string, Promise<void>>();

function readInstances(): NoteWidgetInstance[] {
  try {
    const saved = localStorage.getItem(storageKey);
    const source: unknown = JSON.parse(saved ?? localStorage.getItem(legacyStorageKey) ?? "[]");
    if (!Array.isArray(source)) return [];
    const unique = new Map<string, NoteWidgetInstance>();
    for (const item of source) {
      if (item && typeof item.id === "string" && /^[a-z\d_-]{1,128}$/i.test(item.id))
        unique.set(item.id, { id: item.id });
    }
    const items = [...unique.values()];
    if (!saved && items.length) writeInstances(items);
    return items;
  } catch {
    return [];
  }
}

function writeInstances(items: NoteWidgetInstance[]) {
  localStorage.setItem(storageKey, JSON.stringify(items));
}

async function openInstance(instance: NoteWidgetInstance) {
  // StrictMode and concurrent restores must share a single native creation.
  const existing = opening.get(instance.id);
  if (existing) return existing;
  const operation = createInstance(instance);
  opening.set(instance.id, operation);
  try {
    await operation;
  } finally {
    opening.delete(instance.id);
  }
}

async function createInstance(instance: NoteWidgetInstance) {
  const label = `threadnote-widget-${instance.id}`;
  if (await WebviewWindow.getByLabel(label)) return;
  const widget = new WebviewWindow(label, {
    url: `index.html?id=${encodeURIComponent(instance.id)}`,
    title: "Threadnote",
    width: 410,
    height: 590,
    minWidth: 310,
    minHeight: 320,
    decorations: false,
    transparent: true,
    shadow: false,
    resizable: true,
    skipTaskbar: true,
    center: true,
  });
  await new Promise<void>((resolve, reject) => {
    widget.once("tauri://created", () => resolve());
    widget.once("tauri://error", (event) => reject(event.payload));
  });
}

export async function addNoteWidget(noteId?: string) {
  const instance = { id: noteId ?? crypto.randomUUID() };
  const items = [...readInstances().filter((item) => item.id !== instance.id), instance];
  writeInstances(items);
  try {
    await openInstance(instance);
    return instance;
  } catch (error) {
    writeInstances(readInstances().filter((item) => item.id !== instance.id));
    throw error;
  }
}

export async function restoreNoteWidgets() {
  await Promise.all(readInstances().map(openInstance));
}

export function removeNoteWidget(id: string) {
  writeInstances(readInstances().filter((item) => item.id !== id));
}

export function currentNoteId() {
  return new URLSearchParams(window.location.search).get("id") ?? "root-note";
}
