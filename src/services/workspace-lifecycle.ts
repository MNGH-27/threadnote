import { flushBeforeShutdown, type FlushResult } from "@/lib/workspace-shutdown";
import { invoke } from "@tauri-apps/api/core";
import { emitTo, listen } from "@tauri-apps/api/event";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { WebviewWindow } from "@tauri-apps/api/webviewWindow";

interface FlushRequest {
  requestId: string;
  replyTo: string;
}
/** Every note must acknowledge persistence before an explicit process exit. */
let pendingQuit: Promise<void> | null = null;
export function quitAfterSaving(): Promise<void> {
  if (pendingQuit) return pendingQuit;
  pendingQuit = saveAndQuit().finally(() => {
    pendingQuit = null;
  });
  return pendingQuit;
}
async function saveAndQuit() {
  const windows = await WebviewWindow.getAll();
  const requestId = crypto.randomUUID();
  const replyTo = getCurrentWindow().label;
  await flushBeforeShutdown({
    labels: windows
      .map((window) => window.label)
      .filter((label) => label === "widget" || label.startsWith("threadnote-widget-")),
    requestId,
    listen: (accept) => listen<FlushResult>("workspace:flushed", ({ payload }) => accept(payload)),
    send: (label) =>
      emitTo(label, "workspace:flush", { requestId, replyTo } satisfies FlushRequest),
    quit: () => invoke("quit_app"),
  });
}

export function listenForWorkspaceFlush(flush: () => Promise<void>) {
  return listen<FlushRequest>("workspace:flush", ({ payload }) => {
    void (async () => {
      let success = true;
      try {
        await flush();
      } catch {
        success = false;
      }
      await emitTo(payload.replyTo, "workspace:flushed", {
        requestId: payload.requestId,
        label: getCurrentWindow().label,
        success,
      } satisfies FlushResult);
    })().catch(() => {
      /* The requesting window may close while saving. */
    });
  });
}
