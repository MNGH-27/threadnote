import { Link2, NotebookPen, Scan, Trash2, X, ZoomIn, ZoomOut } from "lucide-react";
import {
  memo,
  useMemo,
  useEffect,
  useRef,
  useState,
  type PointerEvent,
  type ReactNode,
} from "react";
import { connectionRepository } from "@/repositories/widget-repository";
import type { NoteConnection, NoteSection, NoteSectionType } from "@/types/widget";
import { CanvasCard } from "./canvas-card";
import {
  connectionPath,
  enclosingBounds,
  readPoint,
  sectionGeometry,
  visibleCanvasRect,
  type CardGeometry,
  type Point,
} from "./canvas-geometry";
import { CanvasRuntime } from "./canvas-runtime";
import { CanvasMinimap } from "./canvas-minimap";

interface Props {
  noteId: string;
  accentColor: string;
  sections: NoteSection[];
  noteContent: ReactNode;
  sectionInfo: (section: NoteSection) => { title: string; icon: ReactNode };
  renderSection: (section: NoteSection) => ReactNode;
  renderAdd: (
    add: (type: NoteSectionType) => void,
    onOpenChange: (open: boolean) => void,
  ) => ReactNode;
  addSection: (type: NoteSectionType, position: Point) => void;
  removeSection: (section: NoteSection) => Promise<void>;
  updateSection: (section: NoteSection, config: Record<string, unknown>) => void;
}

// Moving a card changes its frame, not its email list, editor or task contents.
// Keep the context value stable so canvas movement does not repaint every section.
const SectionBody = memo(function SectionBody({
  section,
  render,
  scale,
  suspended,
}: {
  section: NoteSection;
  render: Props["renderSection"];
  scale: number;
  suspended: boolean;
}) {
  const runtime = useMemo(() => ({ scale, suspended }), [scale, suspended]);
  return <CanvasRuntime.Provider value={runtime}>{render(section)}</CanvasRuntime.Provider>;
});

export function CanvasWorkspace({
  noteId,
  accentColor,
  sections,
  noteContent,
  sectionInfo,
  renderSection,
  renderAdd,
  addSection,
  removeSection,
  updateSection,
}: Props) {
  const viewport = useRef<HTMLDivElement>(null);
  const [fullscreenHost, setFullscreenHost] = useState<HTMLDivElement | null>(null);
  const [pan, setPan] = useState(() =>
    readPoint(`threadnote.canvas.pan.${noteId}`, { x: 24, y: 24 }),
  );
  const [zoom, setZoom] = useState(() =>
    Math.min(
      1.5,
      Math.max(0.2, Number(localStorage.getItem(`threadnote.canvas.zoom.${noteId}`)) || 1),
    ),
  );
  const [rootGeometry, setRootGeometry] = useState<CardGeometry>(() => {
    const position = readPoint(`threadnote.canvas.note.${noteId}`, { x: 48, y: 60 });
    const size = readPoint(`threadnote.canvas.note-size.${noteId}`, { x: 330, y: 300 });
    return { ...position, width: Math.max(280, size.x), height: Math.max(180, size.y) };
  });
  const [drafts, setDrafts] = useState<Record<string, CardGeometry>>({});
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const [connections, setConnections] = useState<NoteConnection[]>([]);
  const [connectingFrom, setConnectingFrom] = useState<string | null>(null);
  const [fullscreenId, setFullscreenId] = useState<string | null>(null);
  const [activeId, setActiveId] = useState("root");
  const [gesture, setGesture] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [toolsHovered, setToolsHovered] = useState(false);
  const [mapOpen, setMapOpen] = useState(false);
  const [viewportSize, setViewportSize] = useState({ width: 400, height: 500 });
  const [pendingDelete, setPendingDelete] = useState<NoteSection | NoteConnection | null>(null);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [error, setError] = useState("");
  const cancelButton = useRef<HTMLButtonElement>(null);
  const previousFocus = useRef<HTMLElement | null>(null);
  const panDrag = useRef<{ x: number; y: number; origin: Point } | null>(null);

  useEffect(() => {
    const element = viewport.current;
    if (!element) return;
    const observer = new ResizeObserver(([entry]) => {
      setViewportSize({ width: entry.contentRect.width, height: entry.contentRect.height });
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    void connectionRepository
      .list(noteId)
      .then(setConnections)
      .catch((reason) => setError(String(reason)));
  }, [noteId]);
  useEffect(() => {
    const timer = setTimeout(
      () => localStorage.setItem(`threadnote.canvas.pan.${noteId}`, JSON.stringify(pan)),
      150,
    );
    return () => clearTimeout(timer);
  }, [noteId, pan]);
  useEffect(() => {
    localStorage.setItem(`threadnote.canvas.zoom.${noteId}`, String(zoom));
  }, [noteId, zoom]);
  useEffect(() => {
    if (!pendingDelete) return;
    previousFocus.current = document.activeElement as HTMLElement;
    cancelButton.current?.focus();
    return () => previousFocus.current?.focus();
  }, [pendingDelete]);
  useEffect(() => {
    const escape = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      if (pendingDelete && !deleteBusy) setPendingDelete(null);
      else if (connectingFrom) setConnectingFrom(null);
      else setFullscreenId(null);
    };
    window.addEventListener("keydown", escape);
    return () => window.removeEventListener("keydown", escape);
  }, [pendingDelete, connectingFrom, deleteBusy]);
  useEffect(() => {
    document.documentElement.classList.toggle("canvas-gesturing", gesture);
    if (gesture) window.getSelection()?.removeAllRanges();
    return () => document.documentElement.classList.remove("canvas-gesturing");
  }, [gesture]);

  const startPan = (event: PointerEvent<HTMLDivElement>) => {
    const target = event.target as Element;
    if (
      fullscreenId ||
      event.button !== 0 ||
      target.closest(
        ".canvas-card,.canvas-toolbar,.minimap-dock,.connection-hit,.delete-dialog,.canvas-notice",
      )
    )
      return;
    event.preventDefault();
    window.getSelection()?.removeAllRanges();
    (document.activeElement as HTMLElement)?.blur();
    event.currentTarget.setPointerCapture(event.pointerId);
    panDrag.current = { x: event.clientX, y: event.clientY, origin: pan };
    setGesture(true);
  };
  const movePan = (event: PointerEvent<HTMLDivElement>) => {
    if (!panDrag.current) return;
    event.preventDefault();
    setPan({
      x: panDrag.current.origin.x + event.clientX - panDrag.current.x,
      y: panDrag.current.origin.y + event.clientY - panDrag.current.y,
    });
  };
  const endPan = () => {
    if (panDrag.current) {
      panDrag.current = null;
      setGesture(false);
    }
  };
  const zoomAtCenter = (next: number) => {
    const value = Math.min(1.5, Math.max(0.2, next));
    const width = viewport.current?.clientWidth ?? 400;
    const height = viewport.current?.clientHeight ?? 500;
    setPan({
      x: width / 2 - ((width / 2 - pan.x) * value) / zoom,
      y: height / 2 - ((height / 2 - pan.y) * value) / zoom,
    });
    setZoom(value);
  };
  const connect = async (nodeId: string) => {
    if (!connectingFrom) {
      setConnectingFrom(nodeId);
      return;
    }
    if (connectingFrom === nodeId) {
      setConnectingFrom(null);
      return;
    }
    try {
      if (!connections.some((item) => item.fromNode === connectingFrom && item.toNode === nodeId)) {
        const created = await connectionRepository.create(noteId, connectingFrom, nodeId);
        setConnections((items) => [...items, created]);
      }
      setConnectingFrom(null);
    } catch (reason) {
      setError(String(reason));
    }
  };
  const confirmDelete = async () => {
    if (!pendingDelete || deleteBusy) return;
    setDeleteBusy(true);
    setError("");
    try {
      if ("fromNode" in pendingDelete) {
        await connectionRepository.remove(pendingDelete.id);
        setConnections((items) => items.filter((item) => item.id !== pendingDelete.id));
      } else {
        // Do not touch connections until deletion has actually been confirmed.
        await removeSection(pendingDelete);
        setConnections((items) =>
          items.filter(
            (item) => item.fromNode !== pendingDelete.id && item.toNode !== pendingDelete.id,
          ),
        );
        if (fullscreenId === pendingDelete.id) setFullscreenId(null);
      }
      setPendingDelete(null);
    } catch (reason) {
      setError(String(reason));
    } finally {
      setDeleteBusy(false);
    }
  };
  const geometryOf = (section: NoteSection, index: number) =>
    drafts[section.id] ?? sectionGeometry(section.config.layout, index, section.type === "site");
  const root = drafts.root ?? rootGeometry;
  const geometry = new Map<string, CardGeometry>([["root", root]]);
  sections.forEach((section, index) =>
    geometry.set(section.id, {
      ...geometryOf(section, index),
      ...(collapsed[section.id] ? { height: 44 } : {}),
    }),
  );
  const markerId = `arrow-${noteId}`;
  const paused = gesture || pickerOpen || toolsHovered || mapOpen || Boolean(pendingDelete);
  const colors = new Map<string, string>([["root", accentColor]]);
  const typeColors: Record<NoteSectionType, string> = {
    note: "#fbbf24",
    email: "#60a5fa",
    calendar: "#c4b5fd",
    tasks: "#34d399",
    mindmap: "#a78bfa",
    image: "#fb7185",
    site: "#22d3ee",
  };
  sections.forEach((section) => colors.set(section.id, typeColors[section.type]));
  const navigateTo = (point: Point) =>
    setPan({
      x: viewportSize.width / 2 - point.x * zoom,
      y: viewportSize.height / 2 - point.y * zoom,
    });
  const fitAll = () => {
    const bounds = enclosingBounds([...geometry.values()], 36);
    const value = Math.min(
      1.2,
      Math.max(
        0.2,
        Math.min(viewportSize.width / bounds.width, viewportSize.height / bounds.height),
      ),
    );
    setZoom(value);
    setPan({
      x: viewportSize.width / 2 - (bounds.x + bounds.width / 2) * value,
      y: viewportSize.height / 2 - (bounds.y + bounds.height / 2) * value,
    });
  };

  return (
    <div
      ref={viewport}
      className={`canvas-viewport ${gesture ? "is-gesturing" : ""}`}
      data-canvas-plane
      style={{
        backgroundPosition: `${pan.x}px ${pan.y}px`,
        backgroundSize: `${22 * zoom}px ${22 * zoom}px`,
      }}
      onPointerDown={startPan}
      onPointerMove={movePan}
      onPointerUp={endPan}
      onPointerCancel={endPan}
      onLostPointerCapture={endPan}
      onWheel={(event) => {
        if (fullscreenId || pendingDelete) return;
        if (
          !event.ctrlKey &&
          (event.target as Element).closest(
            ".section-content,.note-editor,.canvas-toolbar,.minimap-dock",
          )
        )
          return;
        event.preventDefault();
        if (event.ctrlKey) zoomAtCenter(zoom - event.deltaY * 0.001);
        else setPan((value) => ({ x: value.x - event.deltaX, y: value.y - event.deltaY }));
      }}
    >
      {!fullscreenId && (
        <div
          className={`canvas-toolbar ${pickerOpen ? "is-open" : ""}`}
          onPointerEnter={() => setToolsHovered(true)}
          onPointerLeave={() => setToolsHovered(false)}
          onFocusCapture={() => setToolsHovered(true)}
          onBlurCapture={(event) => {
            if (!event.currentTarget.contains(event.relatedTarget as Node)) setToolsHovered(false);
          }}
        >
          {renderAdd((type) => {
            const bounds = viewport.current;
            addSection(type, {
              x: Math.max(20, ((bounds?.clientWidth ?? 600) / 2 - pan.x) / zoom - 150),
              y: Math.max(20, ((bounds?.clientHeight ?? 500) / 2 - pan.y) / zoom - 90),
            });
          }, setPickerOpen)}
          <span className="canvas-toolbar-divider" />
          <button aria-label="Zoom out" onClick={() => zoomAtCenter(zoom - 0.1)}>
            <ZoomOut size={14} />
          </button>
          <button
            className="zoom-value"
            title="Reset view"
            onClick={() => {
              setPan({ x: 24, y: 24 });
              setZoom(1);
            }}
          >
            {Math.round(zoom * 100)}%
          </button>
          <button aria-label="Zoom in" onClick={() => zoomAtCenter(zoom + 0.1)}>
            <ZoomIn size={14} />
          </button>
          <button aria-label="Fit all cards" title="Fit all cards" onClick={fitAll}>
            <Scan size={14} />
          </button>
        </div>
      )}
      <div
        className="canvas-plane"
        data-canvas-plane
        style={{ transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})` }}
      >
        <svg className="connection-layer">
          <defs>
            <marker
              id={markerId}
              markerWidth="8"
              markerHeight="8"
              refX="8"
              refY="4"
              orient="auto"
              markerUnits="userSpaceOnUse"
            >
              <path d="M0,0 L0,8 L8,4 z" />
            </marker>
          </defs>
          {connections.map((connection) => {
            const from = geometry.get(connection.fromNode);
            const to = geometry.get(connection.toNode);
            if (!from || !to) return null;
            const line = connectionPath(from, to);
            return (
              <g key={connection.id} data-connection-id={connection.id}>
                <path
                  className="connection-hit"
                  d={line.path}
                  onDoubleClick={() => setPendingDelete(connection)}
                />
                <path className="connection-line" d={line.path} markerEnd={`url(#${markerId})`} />
                <circle className="connection-port" cx={line.start.x} cy={line.start.y} r="3" />
              </g>
            );
          })}
        </svg>
        <CanvasRuntime.Provider
          value={{ scale: fullscreenId === "root" ? 1 : zoom, suspended: paused }}
        >
          <CanvasCard
            id="root"
            title="Main note"
            icon={
              <span className="root-card-icon">
                <NotebookPen size={15} />
              </span>
            }
            geometry={root}
            zoom={zoom}
            collapsed={false}
            fullscreen={fullscreenId === "root"}
            fullscreenHost={fullscreenHost}
            connecting={connectingFrom === "root"}
            active={activeId === "root"}
            onActivate={() => setActiveId("root")}
            onGesture={setGesture}
            onGeometry={(value, commit) => {
              setDrafts((items) => ({ ...items, root: value }));
              if (commit) {
                setRootGeometry(value);
                localStorage.setItem(
                  `threadnote.canvas.note.${noteId}`,
                  JSON.stringify({ x: value.x, y: value.y }),
                );
                localStorage.setItem(
                  `threadnote.canvas.note-size.${noteId}`,
                  JSON.stringify({ x: value.width, y: value.height }),
                );
              }
            }}
            onFullscreen={() => setFullscreenId((value) => (value === "root" ? null : "root"))}
            onConnect={() => void connect("root")}
          >
            {noteContent}
          </CanvasCard>
        </CanvasRuntime.Provider>
        {sections.map((section, index) => {
          const info = sectionInfo(section);
          const fullscreen = fullscreenId === section.id;
          return (
            <CanvasCard
              key={section.id}
              id={section.id}
              title={info.title}
              icon={info.icon}
              geometry={geometryOf(section, index)}
              zoom={zoom}
              collapsed={Boolean(collapsed[section.id])}
              fullscreen={fullscreen}
              fullscreenHost={fullscreenHost}
              connecting={connectingFrom === section.id}
              active={activeId === section.id}
              onActivate={() => setActiveId(section.id)}
              onGesture={setGesture}
              onGeometry={(value, commit) => {
                setDrafts((items) => ({ ...items, [section.id]: value }));
                if (commit) updateSection(section, { ...section.config, layout: value });
              }}
              onCollapse={() =>
                setCollapsed((items) => ({ ...items, [section.id]: !items[section.id] }))
              }
              onFullscreen={() =>
                setFullscreenId((value) => (value === section.id ? null : section.id))
              }
              onConnect={() => void connect(section.id)}
              onRemove={() => setPendingDelete(section)}
            >
              <SectionBody
                section={section}
                render={renderSection}
                scale={fullscreen ? 1 : zoom}
                suspended={paused || Boolean(fullscreenId && !fullscreen)}
              />
            </CanvasCard>
          );
        })}
      </div>
      <div
        ref={setFullscreenHost}
        className={`fullscreen-layer ${fullscreenId ? "is-open" : ""}`}
      />
      {!fullscreenId && (
        <CanvasMinimap
          cards={geometry}
          colors={colors}
          connections={connections}
          viewport={visibleCanvasRect(pan, zoom, viewportSize)}
          onNavigate={navigateTo}
          onFit={fitAll}
          onOpenChange={setMapOpen}
        />
      )}
      {!fullscreenId && connectingFrom && (
        <div className="canvas-help is-connecting">
          <Link2 size={12} />
          Click the link button on the destination card · Esc to cancel
        </div>
      )}
      {error && (
        <div className="canvas-notice" dir="ltr">
          {error}
          <button onClick={() => setError("")}>
            <X size={14} />
          </button>
        </div>
      )}
      {pendingDelete && (
        <div className="delete-backdrop" onPointerDown={(event) => event.stopPropagation()}>
          <div
            className="delete-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="delete-title"
            dir="ltr"
            onKeyDown={(event) => {
              if (event.key === "Tab") {
                const buttons = Array.from(
                  event.currentTarget.querySelectorAll<HTMLButtonElement>("button:not(:disabled)"),
                );
                const first = buttons[0];
                const last = buttons[buttons.length - 1];
                if (event.shiftKey && document.activeElement === first) {
                  event.preventDefault();
                  last?.focus();
                } else if (!event.shiftKey && document.activeElement === last) {
                  event.preventDefault();
                  first?.focus();
                }
              }
            }}
          >
            <span className="delete-dialog-icon">
              <Trash2 size={20} />
            </span>
            <h2 id="delete-title">
              {"fromNode" in pendingDelete
                ? "Delete this connection?"
                : `Delete the ${sectionInfo(pendingDelete).title} section?`}
            </h2>
            <p>
              {"fromNode" in pendingDelete
                ? "Your cards will be kept."
                : "This section and its connections will be deleted."}
            </p>
            <div>
              <button
                ref={cancelButton}
                className="soft-button"
                disabled={deleteBusy}
                onClick={() => setPendingDelete(null)}
              >
                Cancel
              </button>
              <button
                className="confirm-delete-button"
                disabled={deleteBusy}
                onClick={() => void confirmDelete()}
              >
                {deleteBusy ? "Deleting…" : "Delete"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
