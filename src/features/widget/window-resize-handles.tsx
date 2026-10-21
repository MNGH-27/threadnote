import { getCurrentWindow } from "@tauri-apps/api/window";
import type { PointerEvent } from "react";

type ResizeDirection = Parameters<ReturnType<typeof getCurrentWindow>["startResizeDragging"]>[0];
const edgeClasses = {
  North: "window-resize-North",
  South: "window-resize-South",
  West: "window-resize-West",
  East: "window-resize-East",
  NorthWest: "window-resize-NorthWest",
  NorthEast: "window-resize-NorthEast",
  SouthWest: "window-resize-SouthWest",
};

export function WindowResizeHandles() {
  const resize = (event: PointerEvent<HTMLButtonElement>, direction: ResizeDirection) => {
    if (event.button !== 0) return;
    event.preventDefault();
    event.stopPropagation();
    void getCurrentWindow().startResizeDragging(direction);
  };
  return (
    <>
      {(["North", "South", "West", "East", "NorthWest", "NorthEast", "SouthWest"] as const).map(
        (direction) => (
          <button
            key={direction}
            tabIndex={-1}
            type="button"
            aria-label={`Resize window ${direction}`}
            title={`Drag to resize ${direction}`}
            className={`window-resize-edge ${edgeClasses[direction]}`}
            onPointerDown={(event) => resize(event, direction)}
          />
        ),
      )}
      <button
        type="button"
        className="window-resize-corner"
        aria-label="Resize window SouthEast"
        title="Drag to resize window"
        onPointerDown={(event) => resize(event, "SouthEast")}
      >
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
          <path
            d="M4 12 12 4M8 12l4-4M12 12h.01"
            stroke="currentColor"
            strokeWidth="1.7"
            strokeLinecap="round"
          />
        </svg>
      </button>
    </>
  );
}
