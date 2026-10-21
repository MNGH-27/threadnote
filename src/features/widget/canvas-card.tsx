import { ChevronDown, ChevronUp, Link2, Maximize2, Minimize2, Move, Trash2 } from "lucide-react";
import { createPortal } from "react-dom";
import { useEffect, useRef, type CSSProperties, type PointerEvent, type ReactNode } from "react";
import type { CardGeometry } from "./canvas-geometry";
import { resizeCard, resizeDirections, type CardResizeDirection } from "./card-resize";

// Literal class names keep Tailwind from removing directional hit areas in release builds.
const resizeClasses: Record<CardResizeDirection, string> = {
  North: "card-resize-North",
  South: "card-resize-South",
  East: "card-resize-East",
  West: "card-resize-West",
  NorthWest: "card-resize-NorthWest",
  NorthEast: "card-resize-NorthEast",
  SouthWest: "card-resize-SouthWest",
  SouthEast: "card-resize-SouthEast",
};

interface CardProps {
  id: string;
  title: string;
  icon: ReactNode;
  geometry: CardGeometry;
  zoom: number;
  collapsed: boolean;
  fullscreen: boolean;
  fullscreenHost: HTMLDivElement | null;
  connecting: boolean;
  active: boolean;
  onActivate: () => void;
  onGeometry: (geometry: CardGeometry, commit: boolean) => void;
  onGesture: (active: boolean) => void;
  onCollapse?: () => void;
  onFullscreen: () => void;
  onConnect: () => void;
  onRemove?: () => void;
  children: ReactNode;
}

export function CanvasCard(props: CardProps) {
  const {
    id,
    title,
    icon,
    geometry,
    zoom,
    collapsed,
    fullscreen,
    fullscreenHost,
    connecting,
    active,
    onActivate,
    onGeometry,
    onGesture,
    onCollapse,
    onFullscreen,
    onConnect,
    onRemove,
    children,
  } = props;
  const gesture = useRef<{
    mode: "move" | "resize";
    direction: CardResizeDirection;
    x: number;
    y: number;
    origin: CardGeometry;
    latest: CardGeometry;
  } | null>(null);
  useEffect(
    () => () => {
      // A removed card must not leave text selection globally disabled.
      if (gesture.current) {
        delete document.documentElement.dataset.canvasAction;
        onGesture(false);
      }
    },
    [onGesture],
  );
  const start = (
    event: PointerEvent<HTMLElement>,
    mode: "move" | "resize",
    direction: CardResizeDirection = "SouthEast",
  ) => {
    if (
      fullscreen ||
      event.button !== 0 ||
      (mode === "move" && (event.target as HTMLElement).closest("button,input,textarea,select"))
    )
      return;
    event.preventDefault();
    event.stopPropagation();
    window.getSelection()?.removeAllRanges();
    event.currentTarget.setPointerCapture(event.pointerId);
    gesture.current = {
      mode,
      direction,
      x: event.clientX,
      y: event.clientY,
      origin: geometry,
      latest: geometry,
    };
    document.documentElement.dataset.canvasAction = mode;
    onActivate();
    onGesture(true);
  };
  const move = (event: PointerEvent<HTMLElement>) => {
    const current = gesture.current;
    if (!current) return;
    event.preventDefault();
    event.stopPropagation();
    const dx = (event.clientX - current.x) / zoom;
    const dy = (event.clientY - current.y) / zoom;
    current.latest =
      current.mode === "move"
        ? {
            ...current.origin,
            x: Math.max(0, current.origin.x + dx),
            y: Math.max(0, current.origin.y + dy),
          }
        : resizeCard(current.origin, current.direction, { x: dx, y: dy });
    onGeometry(current.latest, false);
  };
  const finish = () => {
    if (!gesture.current) return;
    onGeometry(gesture.current.latest, true);
    gesture.current = null;
    onGesture(false);
    delete document.documentElement.dataset.canvasAction;
  };
  const card = (
    <article
      data-card-id={id}
      dir="ltr"
      className={`canvas-card ${fullscreen ? "canvas-card-fullscreen" : ""} ${active ? "canvas-card-active" : ""} ${connecting ? "canvas-card-connecting" : ""}`}
      style={
        fullscreen
          ? undefined
          : {
              left: geometry.x,
              top: geometry.y,
              width: geometry.width,
              height: collapsed ? 44 : geometry.height,
            }
      }
      onPointerDownCapture={onActivate}
      onPointerMove={move}
      onPointerUp={finish}
      onPointerCancel={finish}
      onLostPointerCapture={finish}
    >
      <header className="canvas-card-header" onPointerDown={(event) => start(event, "move")}>
        {!fullscreen && <Move size={12} className="card-grip" />}
        {icon}
        <strong>{title}</strong>
        <div className="card-actions">
          {!fullscreen && (
            <button
              className={`section-action ${connecting ? "is-connecting" : ""}`}
              onClick={onConnect}
              title="Connect to another card"
              aria-label="Connect to another card"
            >
              <Link2 size={14} />
            </button>
          )}
          <button
            className="section-action"
            onClick={onFullscreen}
            title={fullscreen ? "Back to canvas" : "Fullscreen"}
            aria-label={fullscreen ? "Back to canvas" : "Fullscreen"}
          >
            {fullscreen ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
          </button>
          {!fullscreen && onCollapse && (
            <button
              className="section-action"
              onClick={onCollapse}
              title={collapsed ? "Expand" : "Collapse"}
            >
              {collapsed ? <ChevronDown size={14} /> : <ChevronUp size={14} />}
            </button>
          )}
          {onRemove && (
            <button
              className="section-action card-delete"
              onClick={onRemove}
              title="Delete section"
              aria-label="Delete section"
            >
              <Trash2 size={13} />
            </button>
          )}
        </div>
      </header>
      {(!collapsed || fullscreen) && <div className="section-content">{children}</div>}
      {!collapsed &&
        !fullscreen &&
        resizeDirections.map((direction) => (
          <button
            key={direction}
            type="button"
            tabIndex={-1}
            className={`card-resize-edge ${resizeClasses[direction]} ${direction === "SouthEast" ? "resize-handle" : ""}`}
            style={
              {
                "--resize-edge": `${6 / zoom}px`,
                "--resize-corner": `${16 / zoom}px`,
                ...(direction === "SouthEast" ? { width: 28 / zoom, height: 28 / zoom } : {}),
              } as CSSProperties
            }
            onPointerDown={(event) => start(event, "resize", direction)}
            aria-label={`Resize card ${direction}`}
            title={`Drag to resize ${direction}`}
          >
            {direction === "SouthEast" && (
              <svg
                width={16 / zoom}
                height={16 / zoom}
                viewBox="0 0 16 16"
                fill="none"
                aria-hidden="true"
              >
                <path
                  d="M4 12 12 4M8 12l4-4M12 12h.01"
                  stroke="currentColor"
                  strokeWidth="1.7"
                  strokeLinecap="round"
                />
              </svg>
            )}
          </button>
        ))}
    </article>
  );
  return fullscreen && fullscreenHost ? createPortal(card, fullscreenHost) : card;
}
