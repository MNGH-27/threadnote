import { CornerDownRight, Plus, Scan, Trash2, ZoomIn, ZoomOut } from "lucide-react";
import { useContext, useEffect, useMemo, useRef, useState, type PointerEvent } from "react";
import type { NoteSection } from "@/types/widget";
import { layoutMindmap, normalizeMindNodes, removeMindNode } from "@/lib/mindmap";
import { CanvasRuntime } from "../canvas-runtime";

interface View {
  x: number;
  y: number;
  scale: number;
}

export function MindmapSection({
  section,
  onChange,
}: {
  section: NoteSection;
  onChange: (config: Record<string, unknown>) => void;
}) {
  const center = typeof section.config.center === "string" ? section.config.center : "Main topic";
  const nodes = useMemo(() => normalizeMindNodes(section.config.nodes), [section.config.nodes]);
  const graph = useMemo(() => layoutMindmap(center, nodes), [center, nodes]);
  const viewport = useRef<HTMLDivElement>(null);
  const inputs = useRef(new Map<string | null, HTMLInputElement>());
  const focusNext = useRef<string | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [size, setSize] = useState({ width: 300, height: 200 });
  const [manual, setManual] = useState<View | null>(null);
  const [fitAll, setFitAll] = useState(false);
  const [panning, setPanning] = useState(false);
  const outer = useContext(CanvasRuntime);
  const scale = Math.max(
    fitAll ? 0.08 : 0.65,
    Math.min(1, (size.width - 24) / graph.width, (size.height - 24) / graph.height),
  );
  const view = manual ?? {
    scale,
    x: fitAll
      ? (size.width - graph.width * scale) / 2
      : size.width / 2 - (graph.topics[0].x + graph.topics[0].width / 2) * scale,
    y: fitAll
      ? (size.height - graph.height * scale) / 2
      : size.height / 2 - (graph.topics[0].y + graph.topics[0].height / 2) * scale,
  };
  const latest = useRef({ view, outerScale: outer.scale });
  latest.current = { view, outerScale: outer.scale };
  const drag = useRef<{ x: number; y: number; origin: View } | null>(null);

  useEffect(() => {
    if (!viewport.current) return;
    const observer = new ResizeObserver(([entry]) =>
      setSize({ width: entry.contentRect.width, height: entry.contentRect.height }),
    );
    observer.observe(viewport.current);
    return () => observer.disconnect();
  }, []);
  useEffect(() => {
    const input = focusNext.current ? inputs.current.get(focusNext.current) : undefined;
    if (input) {
      input.focus({ preventScroll: true });
      input.select();
      focusNext.current = null;
    }
  }, [nodes]);

  const zoom = (factor: number, x = size.width / 2, y = size.height / 2) => {
    const current = latest.current.view;
    const next = Math.max(0.08, Math.min(2, current.scale * factor));
    setManual({
      scale: next,
      x: x - ((x - current.x) * next) / current.scale,
      y: y - ((y - current.y) * next) / current.scale,
    });
  };
  const wheelZoom = useRef(zoom);
  wheelZoom.current = zoom;
  useEffect(() => {
    const element = viewport.current;
    if (!element) return;
    const wheel = (event: WheelEvent) => {
      event.preventDefault();
      event.stopPropagation();
      const { view: current, outerScale } = latest.current;
      if (event.ctrlKey || event.metaKey) {
        const rect = element.getBoundingClientRect();
        wheelZoom.current(
          Math.exp(-Math.max(-100, Math.min(100, event.deltaY)) * 0.008),
          (event.clientX - rect.left) / outerScale,
          (event.clientY - rect.top) / outerScale,
        );
      } else {
        const unit = event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? element.clientHeight : 1;
        setManual({
          ...current,
          x: current.x - event.deltaX * unit,
          y: current.y - event.deltaY * unit,
        });
      }
    };
    element.addEventListener("wheel", wheel, { passive: false });
    return () => element.removeEventListener("wheel", wheel);
  }, []);

  const save = (next = nodes, topic = center) =>
    onChange({ ...section.config, center: topic, nodes: next });
  const add = (parentId: string | null) => {
    const id = crypto.randomUUID();
    focusNext.current = id;
    setSelected(id);
    const next = [...nodes, { id, text: "", parentId }];
    const topic = layoutMindmap(center, next).topics.find((item) => item.id === id)!;
    const nextScale = Math.max(0.8, latest.current.view.scale);
    setManual({
      scale: nextScale,
      x: size.width / 2 - (topic.x + topic.width / 2) * nextScale,
      y: size.height / 2 - (topic.y + topic.height / 2) * nextScale,
    });
    setFitAll(false);
    save(next);
  };
  const remove = () => {
    if (selected === null) return;
    save(removeMindNode(nodes, selected));
    setSelected(null);
    setFitAll(false);
    setManual(null);
  };
  const fit = () => {
    setFitAll(true);
    setManual(null);
  };
  const startPan = (event: PointerEvent<HTMLDivElement>) => {
    if (event.button !== 0 || (event.target as Element).closest(".mind-topic")) return;
    event.preventDefault();
    event.stopPropagation();
    window.getSelection()?.removeAllRanges();
    event.currentTarget.setPointerCapture(event.pointerId);
    drag.current = { x: event.clientX, y: event.clientY, origin: view };
    setPanning(true);
  };
  const stopPan = () => {
    drag.current = null;
    setPanning(false);
  };

  return (
    <div className="mindmap" dir="ltr">
      <div className="mind-toolbar" role="toolbar" aria-label="Mind map controls">
        <button
          type="button"
          className="mind-add"
          title="Add main branch"
          onClick={() => add(null)}
        >
          <Plus size={13} /> Branch
        </button>
        <button
          type="button"
          title="Add child to selected topic (Tab)"
          aria-label="Add child topic"
          onClick={() => add(selected)}
        >
          <CornerDownRight size={14} />
        </button>
        <button
          type="button"
          title="Delete selected topic; keep its children"
          aria-label="Delete selected topic"
          disabled={selected === null}
          onClick={remove}
        >
          <Trash2 size={13} />
        </button>
        <span className="mind-toolbar-space" />
        <button
          type="button"
          title="Zoom out"
          aria-label="Zoom out mind map"
          onClick={() => zoom(1 / 1.2)}
        >
          <ZoomOut size={13} />
        </button>
        <button type="button" className="mind-zoom" title="Fit map" onClick={fit}>
          {Math.round(view.scale * 100)}%
        </button>
        <button
          type="button"
          title="Zoom in"
          aria-label="Zoom in mind map"
          onClick={() => zoom(1.2)}
        >
          <ZoomIn size={13} />
        </button>
        <button type="button" title="Fit map" aria-label="Fit mind map" onClick={fit}>
          <Scan size={13} />
        </button>
      </div>
      <div
        ref={viewport}
        className={`mind-viewport ${panning ? "is-panning" : ""}`}
        aria-label="Mind map canvas"
        onPointerDown={startPan}
        onPointerMove={(event) => {
          if (!drag.current) return;
          event.preventDefault();
          event.stopPropagation();
          setManual({
            ...drag.current.origin,
            x: drag.current.origin.x + (event.clientX - drag.current.x) / outer.scale,
            y: drag.current.origin.y + (event.clientY - drag.current.y) / outer.scale,
          });
        }}
        onPointerUp={stopPan}
        onPointerCancel={stopPan}
        onLostPointerCapture={stopPan}
      >
        <div
          className="mind-plane"
          style={{
            width: graph.width,
            height: graph.height,
            transform: `translate(${view.x}px, ${view.y}px) scale(${view.scale})`,
          }}
        >
          <svg className="mind-edges" width={graph.width} height={graph.height} aria-hidden="true">
            {graph.edges.map((edge) => (
              <path key={edge.id} d={edge.path} />
            ))}
          </svg>
          {graph.topics.map((topic) => (
            <input
              key={topic.id === null ? "center" : `branch:${topic.id}`}
              ref={(element) => {
                if (element) inputs.current.set(topic.id, element);
                else inputs.current.delete(topic.id);
              }}
              className={`mind-topic ${topic.id === null ? "mind-topic-root" : ""}`}
              data-selected={selected === topic.id}
              aria-label={topic.id === null ? "Main topic" : "Branch topic"}
              title={topic.text || "New idea"}
              dir="auto"
              placeholder={topic.id === null ? "Main topic" : "New idea"}
              style={{ left: topic.x, top: topic.y, width: topic.width, height: topic.height }}
              value={topic.text}
              onFocus={() => setSelected(topic.id)}
              onChange={(event) =>
                topic.id === null
                  ? save(nodes, event.target.value)
                  : save(
                      nodes.map((node) =>
                        node.id === topic.id ? { ...node, text: event.target.value } : node,
                      ),
                    )
              }
              onKeyDown={(event) => {
                if (event.nativeEvent.isComposing) return;
                if (event.key === "Tab" && !event.shiftKey) {
                  event.preventDefault();
                  event.stopPropagation();
                  add(topic.id);
                } else if (event.key === "Enter") {
                  event.preventDefault();
                  event.stopPropagation();
                  add(topic.parentId);
                }
              }}
            />
          ))}
        </div>
      </div>
      <p className="mind-hint">
        Drag background · Ctrl + scroll to zoom
        <br />
        Enter: sibling · Tab: child
      </p>
    </div>
  );
}
