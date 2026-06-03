import { localStats, applyClear } from './storage';

// Debounced, coalescing writer for the local statistics. A burst of clears
// (tab-close + keyboard + menu within a second, or several blacklist
// auto-clears) collapses into ONE read-modify-write of chrome.storage.local
// instead of one per clear. Pending clears are accumulated (summed), never
// overwritten, and flushed on a short timer — or immediately via flushStats()
// from chrome.runtime.onSuspend so a worker shutdown doesn't drop the window.

const FLUSH_MS = 1000;
const MAX_PENDING = 5; // flush eagerly once a burst reaches this many clears

interface PendingClear {
  domain: string;
  clearedTypes: string[];
}

let pending: PendingClear[] = [];
let timer: ReturnType<typeof setTimeout> | null = null;

export function recordClear(domain: string, clearedTypes: string[]): void {
  pending.push({ domain, clearedTypes });
  if (pending.length >= MAX_PENDING) {
    // Bound the worst-case data-loss window on a burst (e.g. blacklist
    // auto-clear across many tabs) by flushing immediately.
    void flushStats();
    return;
  }
  if (!timer) {
    timer = setTimeout(() => {
      void flushStats();
    }, FLUSH_MS);
  }
}

export async function flushStats(): Promise<void> {
  if (timer) {
    clearTimeout(timer);
    timer = null;
  }
  if (pending.length === 0) return;

  const batch = pending;
  pending = [];

  let stats = await localStats.get();
  for (const { domain, clearedTypes } of batch) {
    stats = applyClear(stats, domain, clearedTypes);
  }
  await localStats.set(stats);
}
