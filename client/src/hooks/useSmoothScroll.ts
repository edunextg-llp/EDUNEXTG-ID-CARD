import { useEffect } from "react";
import Lenis from "lenis";
import "lenis/dist/lenis.css";

let lenisInstance: Lenis | null = null;
let activeSubscribers = 0;

/**
 * Returns the current Lenis instance, or null if none is active.
 * Use this to imperatively scroll (e.g. scrollTo(0)) or to
 * stop/start Lenis when a modal or drawer locks body scroll.
 */
export function getLenis(): Lenis | null {
  return lenisInstance;
}

/**
 * Creates a single Lenis smooth-scroll instance and tears it down when
 * all public pages unmount. Uses reference counting so route transitions
 * between public pages do not destroy and recreate the instance.
 *
 * Everything runs inside useEffect so it is safe for SSR / Vite
 * prerender (no DOM access at import time).
 */
export function useSmoothScroll(): void {
  useEffect(() => {
    activeSubscribers++;

    if (!lenisInstance && typeof window !== "undefined") {
      lenisInstance = new Lenis({
        autoRaf: true,
        anchors: true,
        allowNestedScroll: true,
        stopInertiaOnNavigate: true,
      });
    }

    return () => {
      activeSubscribers--;
      if (activeSubscribers <= 0) {
        activeSubscribers = 0;
        lenisInstance?.destroy();
        lenisInstance = null;
      }
    };
  }, []);
}
