// Minimal in-memory mock of the chrome.* APIs used by the extension's
// non-UI logic. Realistic enough that storage.sync/local round-trips and
// onChanged events behave like the real thing (callback style + change events).

type ChangeListener = (
  changes: Record<string, { oldValue?: unknown; newValue?: unknown }>,
  areaName: string,
) => void;

interface AreaState {
  store: Record<string, unknown>;
  // counts real round-trips so tests can assert the cache actually skips reads
  getCount: number;
  setCount: number;
  // when set, the next set() reports this via chrome.runtime.lastError and does
  // NOT persist — lets tests exercise write-failure handling.
  failNextSet?: string;
}

function makeArea(
  state: AreaState,
  areaName: string,
  listeners: ChangeListener[],
  runtime: { lastError?: { message: string } },
) {
  return {
    get(keys: string[] | string | null, cb: (items: Record<string, unknown>) => void) {
      state.getCount++;
      const out: Record<string, unknown> = {};
      const list = keys == null ? Object.keys(state.store) : Array.isArray(keys) ? keys : [keys];
      for (const k of list) {
        if (k in state.store) out[k] = state.store[k];
      }
      // async like the real API
      Promise.resolve().then(() => cb(out));
    },
    set(items: Record<string, unknown>, cb?: () => void) {
      state.setCount++;
      if (state.failNextSet) {
        const message = state.failNextSet;
        state.failNextSet = undefined;
        Promise.resolve().then(() => {
          runtime.lastError = { message };
          if (cb) cb();
          runtime.lastError = undefined; // real chrome clears it after the callback
        });
        return;
      }
      const changes: Record<string, { oldValue?: unknown; newValue?: unknown }> = {};
      for (const [k, v] of Object.entries(items)) {
        changes[k] = { oldValue: state.store[k], newValue: v };
        state.store[k] = v;
      }
      Promise.resolve().then(() => {
        if (cb) cb();
        for (const l of listeners) l(changes, areaName);
      });
    },
  };
}

export interface ChromeMock {
  chrome: typeof globalThis.chrome;
  sync: AreaState;
  local: AreaState;
  changeListeners: ChangeListener[];
  /** drain pending microtasks so async get/set callbacks have fired */
  flush(): Promise<void>;
}

export function installChromeMock(): ChromeMock {
  const sync: AreaState = { store: {}, getCount: 0, setCount: 0 };
  const local: AreaState = { store: {}, getCount: 0, setCount: 0 };
  const changeListeners: ChangeListener[] = [];
  const runtime: { lastError?: { message: string } } = { lastError: undefined };

  const chrome = {
    storage: {
      sync: makeArea(sync, 'sync', changeListeners, runtime),
      local: makeArea(local, 'local', changeListeners, runtime),
      onChanged: {
        addListener(fn: ChangeListener) {
          changeListeners.push(fn);
        },
      },
    },
    runtime,
  } as unknown as typeof globalThis.chrome;

  (globalThis as { chrome?: unknown }).chrome = chrome;

  return {
    chrome,
    sync,
    local,
    changeListeners,
    async flush() {
      // two ticks: one for get/set scheduling, one for the listener fan-out
      await Promise.resolve();
      await Promise.resolve();
    },
  };
}
