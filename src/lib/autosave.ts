interface AutosaveOptions {
  delay?: number;
  onSaved?: () => void;
  onError?: (reason: unknown) => void;
}

/** Coalesce pending edits and serialize writes so older data cannot win a race. */
export function createAutosave<T>(
  write: (value: T) => Promise<void>,
  options: AutosaveOptions = {},
) {
  let revision = 0;
  let pending: { value: T; revision: number } | undefined;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let tail = Promise.resolve();
  let failure: unknown;
  let failed = false;

  const flush = (): Promise<void> => {
    clearTimeout(timer);
    const next = pending;
    if (!next)
      return tail.then(() => {
        if (failed) throw failure;
      });
    pending = undefined;
    tail = tail
      .then(() => write(next.value))
      .then(
        () => {
          failure = undefined;
          failed = false;
          if (next.revision === revision) options.onSaved?.();
        },
        (reason: unknown) => {
          failure = reason;
          failed = true;
          // Keep the newest failed edit available for an explicit retry/close flush.
          if (next.revision === revision && !pending) pending = next;
          options.onError?.(reason);
        },
      );
    return tail.then(() => {
      if (failed) throw failure;
    });
  };

  return {
    schedule(value: T) {
      pending = { value, revision: ++revision };
      clearTimeout(timer);
      timer = setTimeout(() => {
        void flush().catch(() => {});
      }, options.delay ?? 350);
    },
    flush,
  };
}
