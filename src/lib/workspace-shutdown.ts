export interface FlushResult {
  requestId: string;
  label: string;
  success: boolean;
}

interface ShutdownOptions {
  labels: string[];
  requestId: string;
  listen: (accept: (result: FlushResult) => void) => Promise<() => void>;
  send: (label: string) => Promise<void>;
  quit: () => Promise<void>;
  timeoutMs?: number;
}

/** A pure coordinator: native IPC is injected so failure paths can be tested. */
export async function flushBeforeShutdown(options: ShutdownOptions) {
  const pending = new Set(options.labels);
  let timer: ReturnType<typeof setTimeout> | undefined;
  let finish: () => void = () => {};
  let fail: (reason: Error) => void = () => {};
  const completed = new Promise<void>((resolve, reject) => {
    finish = resolve;
    fail = reject;
  });
  const unlisten = await options.listen((result) => {
    if (result.requestId !== options.requestId || !pending.has(result.label)) return;
    if (!result.success) {
      fail(new Error("A note could not be saved."));
      return;
    }
    pending.delete(result.label);
    if (!pending.size) finish();
  });
  try {
    timer = setTimeout(
      () => fail(new Error("Timed out saving notes.")),
      options.timeoutMs ?? 10_000,
    );
    if (!pending.size) finish();
    await Promise.all([completed, ...[...pending].map(options.send)]);
    await options.quit();
  } finally {
    clearTimeout(timer);
    unlisten();
  }
}
