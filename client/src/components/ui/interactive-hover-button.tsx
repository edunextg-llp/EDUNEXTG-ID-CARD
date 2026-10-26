import React from "react";
import { ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";

interface InteractiveHoverButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  text?: string;
}

const InteractiveHoverButton = React.forwardRef<
  HTMLButtonElement,
  InteractiveHoverButtonProps
>(({ text, className, children, ...props }, ref) => {
  const content = text ?? (typeof children === "string" ? children : "Button");

  return (
    <button
      ref={ref}
      className={cn(
        "group relative inline-flex h-11 min-w-36 cursor-pointer items-center justify-center overflow-hidden rounded-full border border-border bg-background px-6 py-2 text-sm font-semibold text-foreground shadow-xs transition-all duration-300 hover:border-primary focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50",
        className,
      )}
      {...props}
    >
      <span className="inline-flex items-center translate-x-1 transition-all duration-300 group-hover:translate-x-12 group-hover:opacity-0">
        {content}
      </span>
      <div className="absolute inset-0 z-10 flex h-full w-full translate-x-12 items-center justify-center gap-2 text-primary-foreground opacity-0 transition-all duration-300 group-hover:translate-x-0 group-hover:opacity-100">
        <span>{content}</span>
        <ArrowRight className="h-4 w-4 shrink-0" />
      </div>
      <div className="absolute left-[15%] top-[40%] h-2 w-2 scale-100 rounded-full bg-primary transition-all duration-300 group-hover:left-0 group-hover:top-0 group-hover:h-full group-hover:w-full group-hover:scale-150 group-hover:rounded-none group-hover:bg-primary"></div>
    </button>
  );
});

InteractiveHoverButton.displayName = "InteractiveHoverButton";

export { InteractiveHoverButton, type InteractiveHoverButtonProps };

