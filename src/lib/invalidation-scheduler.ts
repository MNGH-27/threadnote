/** Coalesce layout changes without a permanent animation loop or overlapping IPC. */
export function createInvalidationScheduler(
  run: () => Promise<void>,
  onError: (reason: unknown) => void,
  request: (callback: () => void) => number = requestAnimationFrame,
  cancel: (id: number) => void = cancelAnimationFrame,
) {
  let frame: number | null = null;
  let busy = false;
  let dirty = false;
  let disposed = false;
  const invalidate = () => {
    if (disposed) return;
    dirty = true;
    if (busy || frame !== null) return;
    frame = request(() => {
      frame = null;
      dirty = false;
      busy = true;
      void Promise.resolve()
        .then(() => {
          if (!disposed) return run();
        })
        .catch((reason) => {
          if (!disposed) onError(reason);
        })
        .finally(() => {
          busy = false;
          if (dirty) invalidate();
        });
    });
  };
  return {
    invalidate,
    dispose() {
      disposed = true;
      if (frame !== null) cancel(frame);
      frame = null;
    },
  };
}
