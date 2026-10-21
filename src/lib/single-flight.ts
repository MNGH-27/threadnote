/** Share concurrent reads only; never retain completed responses or cache writes. */
export function createSingleFlight() {
  const pending = new Map<string, Promise<unknown>>();
  return {
    run<T>(key: string, read: () => Promise<T>): Promise<T> {
      const existing = pending.get(key);
      if (existing) return existing as Promise<T>;
      const operation = Promise.resolve().then(read);
      pending.set(key, operation);
      const cleanup = () => {
        if (pending.get(key) === operation) pending.delete(key);
      };
      void operation.then(cleanup, cleanup);
      return operation;
    },
    clear: () => pending.clear(),
  };
}
