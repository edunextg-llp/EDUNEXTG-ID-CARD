import { useState, useEffect } from "react";

/**
 * Hook to reveal elements as they scroll into view using IntersectionObserver.
 * Automatically respects `prefers-reduced-motion` by revealing immediately.
 */
export function useRevealOnScroll<T extends HTMLElement = HTMLDivElement>(
  threshold: number = 0.15,
  rootMargin: string = "0px 0px -40px 0px",
) {
  const [ref, setRef] = useState<T | null>(null);
  const [revealed, setRevealed] = useState(false);

  useEffect(() => {
    if (!ref) return;

    // Check if user prefers reduced motion
    if (
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
    ) {
      setRevealed(true);
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setRevealed(true);
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold, rootMargin },
    );

    observer.observe(ref);

    return () => {
      observer.disconnect();
    };
  }, [ref, threshold, rootMargin]);

  return { ref: setRef, revealed };
}
