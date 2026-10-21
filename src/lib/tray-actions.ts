interface TrayActions {
  settings: () => void;
  newNote: () => Promise<unknown>;
  quit: () => Promise<void>;
  error: (message: string) => void;
}

/** Serialize tray commands so double-clicking Quit cannot start two save handshakes. */
export function createTrayActionHandler(actions: TrayActions) {
  let busy = false;
  return async (action: unknown) => {
    if (busy) return;
    busy = true;
    try {
      if (action === "settings") actions.settings();
      else if (action === "new-note") await actions.newNote();
      else if (action === "quit") await actions.quit();
      else if (action === "startup-error")
        actions.error("Could not update the Windows startup setting.");
    } catch {
      actions.error(
        action === "quit"
          ? "Could not save all notes. The app is still running. Please check your notes and retry."
          : "Could not complete the tray action. Please try again.",
      );
    } finally {
      busy = false;
    }
  };
}
