import { PhysicalPosition, PhysicalSize } from "@tauri-apps/api/dpi";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { useEffect } from "react";

/** Persist real native bounds, not placeholder coordinates from the first event. */
export function useWindowBounds(id: string) {
  useEffect(() => {
    const appWindow = getCurrentWindow();
    const key = `threadnote.bounds.${id}`;
    let disposed = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const unlisteners: Array<() => void> = [];
    const persist = () => {
      clearTimeout(timer);
      timer = setTimeout(() => {
        void Promise.all([appWindow.outerPosition(), appWindow.innerSize()])
          .then(([position, size]) => {
            if (!disposed)
              localStorage.setItem(
                key,
                JSON.stringify({
                  x: position.x,
                  y: position.y,
                  width: size.width,
                  height: size.height,
                }),
              );
          })
          .catch(() => {
            /* A window may close while its native bounds are being read. */
          });
      }, 200);
    };
    const initialize = async () => {
      try {
        const raw = localStorage.getItem(key);
        if (raw) {
          try {
            const value = JSON.parse(raw) as Record<string, unknown>;
            if (
              !value ||
              !["x", "y", "width", "height"].every(
                (field) => typeof value[field] === "number" && Number.isFinite(value[field]),
              )
            )
              throw new Error("Invalid bounds");
            await appWindow.setSize(
              new PhysicalSize(
                Math.max(310, Number(value.width)),
                Math.max(320, Number(value.height)),
              ),
            );
            if (!disposed)
              await appWindow.setPosition(new PhysicalPosition(Number(value.x), Number(value.y)));
          } catch {
            localStorage.removeItem(key);
          }
        }
        if (disposed) return;
        const listeners = await Promise.all([
          appWindow.onMoved(persist),
          appWindow.onResized(persist),
        ]);
        if (disposed) listeners.forEach((unlisten) => unlisten());
        else unlisteners.push(...listeners);
      } catch {
        /* Bounds restoration must not prevent a note from opening. */
      }
    };
    void initialize();
    return () => {
      disposed = true;
      clearTimeout(timer);
      unlisteners.forEach((unlisten) => unlisten());
    };
  }, [id]);
}
