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
  SouthEast: "window-resize-SouthEast",
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
      {(
        [
          "North",
          "South",
          "West",
          "East",
          "NorthWest",
          "NorthEast",
          "SouthWest",
          "SouthEast",
        ] as const
      ).map((direction) => (
        <button
          key={direction}
          tabIndex={-1}
          type="button"
          aria-label={`Resize window ${direction}`}
          title={`Drag to resize ${direction}`}
          className={`window-resize-edge ${edgeClasses[direction]}`}
          onPointerDown={(event) => resize(event, direction)}
        />
      ))}
    </>
  );
}
