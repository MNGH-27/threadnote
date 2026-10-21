import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { useEffect, useState } from "react";
import { createTrayActionHandler } from "@/lib/tray-actions";
import { quitAfterSaving } from "@/services/workspace-lifecycle";
import { addNoteWidget } from "./widget-manager";

/** Only the persistent main note receives commands from the native tray. */
export function useTrayControls(id: string, setSettings: (open: boolean) => void) {
  const [error, setError] = useState("");
  useEffect(() => {
    if (id !== "root-note") return;
    let disposed = false;
    let unlisten: (() => void) | undefined;
    const handle = createTrayActionHandler({
      settings: () => setSettings(true),
      newNote: () => addNoteWidget(),
      quit: quitAfterSaving,
      error: (message) => {
        if (!disposed) setError(message);
      },
    });
    void listen<unknown>("tray:action", ({ payload }) => {
      if (!disposed) void handle(payload);
    })
      .then(async (stop) => {
        if (disposed) {
          stop();
          return;
        }
        unlisten = stop;
        // Do not offer save-dependent commands until their event handler exists.
        await invoke("tray_frontend_ready");
      })
      .catch(() => {
        if (!disposed) setError("Could not initialize tray controls. Restart Threadnote to retry.");
      });
    return () => {
      disposed = true;
      unlisten?.();
    };
  }, [id, setSettings]);
  return { error, clearError: () => setError("") };
}
