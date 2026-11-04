/**
 * Runs an async worker over a list with bounded concurrency and a minimum gap
 * between dispatches — the single place bulk sends throttle themselves to avoid
 * tripping SMTP rate caps, connection limits, or provider abuse guards.
 *
 * - concurrency: at most this many in flight at once (default 2).
 * - minGapMs:    smallest spacing between two worker starts (default 350 ms).
 *
 * Errors do not abort the batch — each item's result (ok or error) is returned
 * so the caller can tally failures and report them. This matches our bulk UX:
 * HR wants a full per-candidate report, not the first failure.
 */
export interface PacedResult<T> {
  item: T;
  status: "ok" | "error";
  error?: string;
}

export interface PacedOptions {
  concurrency?: number;
  minGapMs?: number;
}

export async function runPaced<T, R = unknown>(
  items: readonly T[],
  worker: (item: T, index: number) => Promise<R>,
  opts: PacedOptions = {},
): Promise<PacedResult<T>[]> {
  const concurrency = Math.max(1, Math.floor(opts.concurrency ?? 2));
  const minGapMs    = Math.max(0, Math.floor(opts.minGapMs    ?? 350));

  const results: PacedResult<T>[] = new Array(items.length);
  let cursor = 0;
  let lastStart = 0;

  async function next(): Promise<void> {
    while (true) {
      const i = cursor++;
      if (i >= items.length) return;
      if (minGapMs > 0) {
        const now = Date.now();
        const wait = lastStart + minGapMs - now;
        if (wait > 0) await new Promise((r) => setTimeout(r, wait));
        lastStart = Date.now();
      }
      try {
        await worker(items[i], i);
        results[i] = { item: items[i], status: "ok" };
      } catch (e) {
        results[i] = { item: items[i], status: "error", error: e instanceof Error ? e.message : String(e) };
      }
    }
  }

  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, () => next()));
  return results;
}
