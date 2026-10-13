import { useEffect, useState } from "react";

/**
 * Thin progress bar for top of screen during route suspense transitions
 */
export default function TopProgressBar() {
  const [progress, setProgress] = useState(25);

  useEffect(() => {
    const t1 = setTimeout(() => setProgress(65), 100);
    const t2 = setTimeout(() => setProgress(90), 250);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, []);

  return (
    <div
      role="progressbar"
      aria-label="Loading page content"
      aria-valuenow={progress}
      aria-valuemin={0}
      aria-valuemax={100}
      className="fixed top-0 left-0 right-0 z-[9999] h-[3px] bg-transparent pointer-events-none"
    >
      <div
        className="h-full bg-gradient-to-r from-[#00894d] via-[#0b6aa2] to-[#7ed957] transition-all duration-300 ease-out shadow-[0_0_8px_rgba(0,137,77,0.6)]"
        style={{ width: `${progress}%` }}
      />
    </div>
  );
}
