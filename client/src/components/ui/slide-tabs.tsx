import React, { useRef, useState, useEffect } from "react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

export interface SlideTabItem {
  id?: string;
  label: React.ReactNode;
  value?: string;
  icon?: React.ReactNode;
}

export interface SlideTabsProps {
  tabs?: (string | SlideTabItem)[];
  activeTab?: number | string;
  onChange?: (index: number, value?: string) => void;
  className?: string;
  tabClassName?: string;
  cursorClassName?: string;
}

interface Position {
  left: number;
  width: number;
  opacity: number;
}

export const SlideTabs: React.FC<SlideTabsProps> = ({
  tabs = ["Home", "Pricing", "Features", "Docs", "Blog"],
  activeTab,
  onChange,
  className,
  tabClassName,
  cursorClassName,
}) => {
  const [position, setPosition] = useState<Position>({
    left: 0,
    width: 0,
    opacity: 0,
  });

  const [internalSelected, setInternalSelected] = useState(0);

  const selectedIndex =
    typeof activeTab === "number"
      ? activeTab
      : typeof activeTab === "string"
      ? tabs.findIndex((t) => (typeof t === "string" ? t === activeTab : t.value === activeTab || t.id === activeTab))
      : internalSelected;

  const activeIndex = selectedIndex >= 0 ? selectedIndex : 0;
  const tabsRef = useRef<(HTMLLIElement | null)[]>([]);

  const updateCursorToActive = () => {
    const selectedTab = tabsRef.current[activeIndex];
    if (selectedTab) {
      setPosition({
        left: selectedTab.offsetLeft,
        width: selectedTab.offsetWidth,
        opacity: 1,
      });
    }
  };

  useEffect(() => {
    updateCursorToActive();
  }, [activeIndex, tabs.length]);

  return (
    <ul
      className={cn(
        "relative flex w-full items-center justify-between rounded-2xl border border-border bg-muted/70 p-1 shadow-inner",
        className,
      )}
    >
      {tabs.map((tab, i) => {
        const label = typeof tab === "string" ? tab : tab.label;
        const icon = typeof tab === "object" ? tab.icon : null;
        const value = typeof tab === "object" ? tab.value ?? tab.id : undefined;
        const isSelected = i === activeIndex;

        return (
          <Tab
            key={typeof tab === "string" ? tab : tab.value ?? tab.id ?? i}
            ref={(el) => {
              tabsRef.current[i] = el;
            }}
            onClick={() => {
              setInternalSelected(i);
              onChange?.(i, value);
            }}
            isSelected={isSelected}
            className={tabClassName}
          >
            {icon && <span className="shrink-0">{icon}</span>}
            <span>{label}</span>
          </Tab>
        );
      })}

      <Cursor position={position} className={cursorClassName} />
    </ul>
  );
};

interface TabProps {
  children: React.ReactNode;
  onClick: () => void;
  isSelected?: boolean;
  className?: string;
}

const Tab = React.forwardRef<HTMLLIElement, TabProps>(
  ({ children, onClick, isSelected, className }, ref) => {
    return (
      <li
        ref={ref}
        onClick={onClick}
        className={cn(
          "relative z-10 flex flex-1 cursor-pointer items-center justify-center gap-1.5 py-2 px-3 text-xs font-extrabold select-none transition-colors duration-200",
          isSelected
            ? "text-primary-foreground font-black"
            : "text-muted-foreground hover:text-foreground",
          className,
        )}
      >
        {children}
      </li>
    );
  },
);

Tab.displayName = "Tab";

interface CursorProps {
  position: Position;
  className?: string;
}

const Cursor: React.FC<CursorProps> = ({ position, className }) => {
  return (
    <motion.li
      initial={false}
      animate={{
        left: position.left,
        width: position.width,
        opacity: position.opacity,
      }}
      transition={{
        type: "spring",
        stiffness: 450,
        damping: 35,
      }}
      className={cn(
        "absolute z-0 h-[calc(100%-8px)] rounded-xl bg-primary shadow-sm pointer-events-none",
        className,
      )}
    />
  );
};

export default SlideTabs;
