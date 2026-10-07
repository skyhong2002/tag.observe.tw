/** Serialize refreshes, retry one transient failure, and confirm an outage. */
export function createFeedPoller<T>(options: { connection: (online: boolean) => void; wait?: () => Promise<void> }) {
  let busy = false;
  let stopped = false;
  let failures = 0;
  let online = true;
  const connection = (next: boolean) => {
    if (online !== next) {
      online = next;
      options.connection(next);
    }
  };
  return {
    async poll(load: () => Promise<T | null>): Promise<T | null> {
      if (busy || stopped) return null;
      busy = true;
      try {
        let value: T | null = null;
        for (let attempt = 0; attempt < 2 && !stopped; attempt++) {
          try {
            value = await load();
          } catch {
            value = null;
          }
          if (value !== null || stopped) break;
          if (attempt === 0) await (options.wait?.() ?? new Promise<void>((resolve) => setTimeout(resolve, 1000)));
        }
        if (stopped) return null;
        if (value !== null) {
          failures = 0;
          connection(true);
        } else if (++failures >= 3) connection(false);
        return value;
      } finally {
        busy = false;
      }
    },
    stop() {
      stopped = true;
    },
  };
}
