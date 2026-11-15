import { useRef } from "react";

/** Wraps an async click handler so a quick second click (before the screen redraws) cannot start a second write. */
export function useGuard() {
  const busy = useRef(false);
  return <T extends unknown[]>(fn: (...args: T) => Promise<void>) =>
    async (...args: T) => {
      if (busy.current) return;
      busy.current = true;
      try {
        await fn(...args);
      } finally {
        busy.current = false;
      }
    };
}
