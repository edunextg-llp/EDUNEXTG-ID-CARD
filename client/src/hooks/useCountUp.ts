import { useEffect, useRef, useState } from "react";

export interface UseCountUpOptions {
  duration?: number;
  suffix?: string;
  prefix?: string;
  start?: number;
}

/**
 * useCountUp hook:
 * - Starts when the element enters the viewport (IntersectionObserver), runs once.
 * - Easing out over duration (default 1500ms).
 * - Prerendered HTML / SSR displays the final formatted target so crawlers see it immediately.
 * - Applies animated start state only after client-side JS executes.
 * - Respects prefers-reduced-motion (shows final state with no motion).
 */
export function useCountUp(
  target: number,
  duration: number = 1500,
  suffix: string = "+"
) {
  const ref = useRef<HTMLDivElement | null>(null);

  // Initial state renders the target figure immediately for SSR / SEO / crawlers
  const [count, setCount] = useState<number>(target);
  const [hasStarted, setHasStarted] = useState<boolean>(false);
  const hasAnimatedRef = useRef<boolean>(false);

  useEffect(() => {
    // If reduced motion is preferred, keep final state with no motion
    const prefersReducedMotion =
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    if (prefersReducedMotion) {
      setCount(target);
      return;
    }

    const element = ref.current;
    if (!element) return;

    // Apply the start state of 0 only after JS runs on client
    if (!hasAnimatedRef.current) {
      setCount(0);
    }

    const observer = new IntersectionObserver(
      (entries) => {
        const [entry] = entries;
        if (entry && entry.isIntersecting && !hasAnimatedRef.current) {
          hasAnimatedRef.current = true;
          setHasStarted(true);
          observer.disconnect();

          const startTime = performance.now();
          const startVal = 0;
          const endVal = target;

          const animate = (currentTime: number) => {
            const elapsed = currentTime - startTime;
            const progress = Math.min(elapsed / duration, 1);
            // Cubic ease-out
            const easeOut = 1 - Math.pow(1 - progress, 3);
            const current = Math.floor(startVal + (endVal - startVal) * easeOut);

            setCount(current);

            if (progress < 1) {
              requestAnimationFrame(animate);
            } else {
              setCount(endVal);
            }
          };

          requestAnimationFrame(animate);
        }
      },
      { threshold: 0.15 }
    );

    observer.observe(element);

    return () => {
      observer.disconnect();
    };
  }, [target, duration]);

  const formattedNumber = count.toLocaleString("en-IN");
  const displayValue = `${formattedNumber}${suffix}`;

  return {
    ref,
    count,
    displayValue,
    hasStarted,
  };
}
