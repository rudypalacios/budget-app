export type DebouncedWriter<T> = {
  // Queues `value`, replacing any value still waiting; the write fires once
  // `delayMs` pass with no further schedule() call.
  schedule: (value: T) => void;
  // Writes the waiting value right now (no-op if nothing is waiting) — e.g.
  // on unmount, so leaving the screen mid-debounce doesn't drop the change.
  flush: () => void;
  // Drops the waiting value without writing it.
  cancel: () => void;
};

// Coalesces a burst of rapid changes (e.g. tapping a stepper's "+" four
// times) into a single write of the last value. Only the write is delayed —
// callers keep their own local state for what's shown on screen, so the UI
// still updates on every tap (Ajustes redesign, §4.5).
export function createDebouncedWriter<T>(
  write: (value: T) => void,
  delayMs: number,
): DebouncedWriter<T> {
  let timer: ReturnType<typeof setTimeout> | null = null;
  let pending: { value: T } | null = null;

  function clear() {
    if (timer) clearTimeout(timer);
    timer = null;
  }

  function flush() {
    clear();
    if (!pending) return;
    const { value } = pending;
    pending = null;
    write(value);
  }

  function schedule(value: T) {
    clear();
    pending = { value };
    timer = setTimeout(flush, delayMs);
  }

  function cancel() {
    clear();
    pending = null;
  }

  return { schedule, flush, cancel };
}
