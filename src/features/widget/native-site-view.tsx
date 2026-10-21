import { LogicalPosition, LogicalSize } from "@tauri-apps/api/dpi";
import { Webview } from "@tauri-apps/api/webview";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { Globe2 } from "lucide-react";
import { useContext, useEffect, useRef, useState } from "react";
import { CanvasRuntime } from "./canvas-runtime";
import { createInvalidationScheduler } from "@/lib/invalidation-scheduler";

/** Keep native views within their DOM slot, including canvas zoom and clipping. */
export function NativeSiteView({
  sectionId,
  url,
  pageZoom,
  reloadKey,
}: {
  sectionId: string;
  url: string;
  pageZoom: number;
  reloadKey: number;
}) {
  const host = useRef<HTMLDivElement>(null);
  const runtime = useContext(CanvasRuntime);
  const latest = useRef({ ...runtime, pageZoom });
  latest.current = { ...runtime, pageZoom };
  const [error, setError] = useState("");
  const [ready, setReady] = useState(false);
  const [activated, setActivated] = useState(false);
  const invalidate = useRef<() => void>(() => {});

  // Do not allocate a browser renderer for a website the user has not visited yet.
  // Once opened, keep it alive so moving offscreen does not discard forms or navigation.
  useEffect(() => {
    if (!host.current) return;
    const observer = new IntersectionObserver((entries) => {
      if (entries.some((entry) => entry.isIntersecting)) {
        setActivated(true);
        observer.disconnect();
      }
    });
    observer.observe(host.current);
    return () => observer.disconnect();
  }, []);
  useEffect(() => invalidate.current());

  useEffect(() => {
    if (!host.current || !url || !activated) return;
    let disposed = false;
    let shown = false;
    let signature = "";
    let initialized = false;
    setError("");
    setReady(false);
    // Start offscreen. React StrictMode may unmount before the native creation event.
    const child = new Webview(getCurrentWindow(), `site-${sectionId}-${crypto.randomUUID()}`, {
      url,
      x: -10000,
      y: -10000,
      width: 1,
      height: 1,
      focus: false,
      dragDropEnabled: false,
      backgroundColor: "#ffffff",
    });
    const created = new Promise<boolean>((resolve) => {
      void child.once("tauri://created", () => resolve(true));
      void child.once("tauri://error", (event) => {
        if (!disposed) setError(String(event.payload));
        resolve(false);
      });
    });
    void created
      .then(async (ok) => {
        if (!ok) return;
        if (disposed) {
          await child.close().catch(() => {});
          return;
        }
        await child.hide();
        initialized = true;
        scheduler.invalidate();
      })
      .catch((reason) => {
        if (!disposed) setError(String(reason));
      });

    const sync = async () => {
      if (!initialized || disposed || !host.current) return;
      if (document.hidden || latest.current.suspended) {
        if (shown) {
          await child.hide();
          shown = false;
        }
        return;
      }
      const element = host.current;
      const rect = element.getBoundingClientRect();
      const card = element.closest(".canvas-card")?.getBoundingClientRect();
      const clip =
        element.closest(".fullscreen-layer.is-open")?.getBoundingClientRect() ??
        element.closest(".canvas-viewport")?.getBoundingClientRect();
      // Native websites sit above HTML; reserve screen-pixel gutters for resize handles.
      const left = Math.max(rect.left + 1, (card?.left ?? 0) + 8, (clip?.left ?? 0) + 8, 8);
      const top = Math.max(rect.top + 1, (card?.top ?? 0) + 8, (clip?.top ?? 0) + 20, 0);
      const right = Math.min(
        rect.right - 1,
        (card?.right ?? window.innerWidth) - 8,
        (clip?.right ?? window.innerWidth) - 8,
        window.innerWidth - 8,
      );
      const bottom = Math.min(
        rect.bottom - 1,
        (card?.bottom ?? window.innerHeight) - 8,
        (clip?.bottom ?? window.innerHeight) - 18,
        window.innerHeight,
      );
      const width = right - left;
      const height = bottom - top;
      // Native views are above HTML. Hide when a menu, dialog or another card covers them.
      const unobstructed =
        width > 12 &&
        height > 12 &&
        [
          [left + 3, top + 3],
          [right - 3, top + 3],
          [left + 3, bottom - 3],
          [right - 3, bottom - 3],
          [(left + right) / 2, (top + bottom) / 2],
        ].every(([x, y]) => {
          const target = document.elementFromPoint(x, y);
          return target !== null && element.contains(target);
        });
      const chromeVisible = Boolean(
        document.querySelector(
          ".window-chrome:hover,.window-chrome:focus-within,.chrome-forced-open,.minimap-dock.is-open",
        ),
      );
      const visible = !latest.current.suspended && !chromeVisible && unobstructed;
      if (!visible) {
        if (shown) {
          await child.hide();
          shown = false;
        }
        return;
      }
      const zoom = Math.max(0.15, Math.min(3, latest.current.scale * latest.current.pageZoom));
      const next = [left, top, width, height, zoom].map((value) => value.toFixed(2)).join(",");
      if (signature !== next) {
        // Serialize geometry changes so an older resize cannot overwrite a newer pan.
        if (shown) {
          await child.hide();
          shown = false;
        }
        await child.setPosition(new LogicalPosition(left, top));
        await child.setSize(new LogicalSize(width, height));
        await child.setZoom(zoom);
        signature = next;
      }
      if (!disposed && !document.hidden && !latest.current.suspended && !chromeVisible && !shown) {
        await child.show();
        shown = true;
        setReady(true);
      }
    };
    const scheduler = createInvalidationScheduler(sync, (reason) => setError(String(reason)));
    invalidate.current = scheduler.invalidate;
    const resize = new ResizeObserver(scheduler.invalidate);
    resize.observe(host.current);
    // Transforms, card stacking and overlays change clipping without resizing the slot.
    const mutations = new MutationObserver(scheduler.invalidate);
    mutations.observe(document.body, {
      subtree: true,
      childList: true,
      attributes: true,
      attributeFilter: ["style", "class"],
    });
    const events = [
      "visibilitychange",
      "pointerover",
      "pointerout",
      "focusin",
      "focusout",
      "transitionend",
      "scroll",
    ];
    events.forEach((event) => document.addEventListener(event, scheduler.invalidate, true));
    window.addEventListener("resize", scheduler.invalidate);
    scheduler.invalidate();
    return () => {
      disposed = true;
      invalidate.current = () => {};
      scheduler.dispose();
      resize.disconnect();
      mutations.disconnect();
      events.forEach((event) => document.removeEventListener(event, scheduler.invalidate, true));
      window.removeEventListener("resize", scheduler.invalidate);
      void created.then(async (ok) => {
        if (ok) {
          await child.hide().catch(() => {});
          await child.close().catch(() => {});
        }
      });
    };
  }, [sectionId, url, reloadKey, activated]);

  return (
    <div ref={host} className="native-site-host">
      <div className="native-site-placeholder">
        <Globe2 size={24} />
        <span>
          {error
            ? "Unable to display website"
            : !activated
              ? "Website loads when visible"
              : runtime.suspended
                ? "Resuming after movement"
                : ready
                  ? "Live website"
                  : "Opening website…"}
        </span>
        {error && <small>{error}</small>}
      </div>
    </div>
  );
}
