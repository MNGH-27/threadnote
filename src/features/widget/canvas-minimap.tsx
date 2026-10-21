import { Map, Scan, X } from "lucide-react";
import { useRef, useState, type PointerEvent } from "react";
import type { NoteConnection } from "@/types/widget";
import { connectionPath, enclosingBounds, type CardGeometry, type Point } from "./canvas-geometry";

interface Props {
  cards: Map<string, CardGeometry>;
  colors: Map<string, string>;
  connections: NoteConnection[];
  viewport: CardGeometry;
  onNavigate: (point: Point) => void;
  onFit: () => void;
  onOpenChange: (open: boolean) => void;
}

export function CanvasMinimap({
  cards,
  colors,
  connections,
  viewport,
  onNavigate,
  onFit,
  onOpenChange,
}: Props) {
  const [open, setOpen] = useState(false);
  const [touchOpen, setTouchOpen] = useState(false);
  const [dragBounds, setDragBounds] = useState<CardGeometry | null>(null);
  const navigating = useRef(false);
  const bounds = dragBounds ?? enclosingBounds([...cards.values(), viewport], 80);
  const changeOpen = (value: boolean) => {
    setOpen(value);
    onOpenChange(value);
  };
  const navigate = (event: PointerEvent<SVGSVGElement>) => {
    const matrix = event.currentTarget.getScreenCTM();
    if (!matrix) return;
    const point = new DOMPoint(event.clientX, event.clientY).matrixTransform(matrix.inverse());
    onNavigate({ x: point.x, y: point.y });
  };
  const finish = () => {
    navigating.current = false;
    setDragBounds(null);
  };
  return (
    <div
      className={`minimap-dock ${open || touchOpen ? "is-open" : ""}`}
      onPointerEnter={() => changeOpen(true)}
      onPointerLeave={() => {
        if (!navigating.current && !touchOpen) changeOpen(false);
      }}
      onFocusCapture={() => changeOpen(true)}
      onBlurCapture={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node) && !touchOpen)
          changeOpen(false);
      }}
    >
      <button
        className="minimap-peek"
        aria-label="Canvas map"
        aria-expanded={open || touchOpen}
        title="Canvas map"
        onClick={() => {
          const next = !touchOpen;
          setTouchOpen(next);
          changeOpen(next);
        }}
      >
        <Map size={14} />
      </button>
      <div className="minimap-panel" aria-label="Canvas minimap">
        <div className="minimap-heading">
          <span>Canvas map</span>
          <div>
            <button aria-label="Fit all cards" title="Fit all cards" onClick={onFit}>
              <Scan size={13} />
            </button>
            <button
              aria-label="Close map"
              onClick={() => {
                setTouchOpen(false);
                changeOpen(false);
              }}
            >
              <X size={12} />
            </button>
          </div>
        </div>
        <svg
          className="minimap-svg"
          viewBox={`${bounds.x} ${bounds.y} ${bounds.width} ${bounds.height}`}
          preserveAspectRatio="xMidYMid meet"
          role="application"
          aria-label="Click or drag the map to navigate the canvas"
          tabIndex={0}
          onPointerDown={(event) => {
            event.preventDefault();
            event.stopPropagation();
            navigating.current = true;
            setDragBounds(bounds);
            event.currentTarget.setPointerCapture(event.pointerId);
            navigate(event);
          }}
          onPointerMove={(event) => {
            if (navigating.current) {
              event.preventDefault();
              navigate(event);
            }
          }}
          onPointerUp={finish}
          onPointerCancel={finish}
          onLostPointerCapture={finish}
          onKeyDown={(event) => {
            const offsets: Record<string, Point> = {
              ArrowLeft: { x: -80, y: 0 },
              ArrowRight: { x: 80, y: 0 },
              ArrowUp: { x: 0, y: -80 },
              ArrowDown: { x: 0, y: 80 },
            };
            if (event.key === "Home") {
              event.preventDefault();
              onFit();
            }
            const offset = offsets[event.key];
            if (offset) {
              event.preventDefault();
              onNavigate({
                x: viewport.x + viewport.width / 2 + offset.x,
                y: viewport.y + viewport.height / 2 + offset.y,
              });
            }
          }}
        >
          {connections.map((connection) => {
            const from = cards.get(connection.fromNode);
            const to = cards.get(connection.toNode);
            return from && to ? (
              <path
                key={connection.id}
                className="minimap-connection"
                d={connectionPath(from, to).path}
              />
            ) : null;
          })}
          {[...cards.entries()].map(([id, card]) => (
            <rect
              key={id}
              x={card.x}
              y={card.y}
              width={card.width}
              height={card.height}
              rx={14}
              fill={colors.get(id) ?? "#94a3b8"}
              className="minimap-card"
            />
          ))}
          <rect
            x={viewport.x}
            y={viewport.y}
            width={viewport.width}
            height={viewport.height}
            rx={12}
            className="minimap-viewport"
          />
        </svg>
      </div>
    </div>
  );
}
