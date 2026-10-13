import React from "react";
import { type LucideIcon } from "lucide-react";
import { useCountUp } from "@/hooks/useCountUp";

interface StatItemProps {
  icon: LucideIcon;
  target: number;
  suffix?: string;
  label: string;
}

export default function StatItem({ icon: Icon, target, suffix = "+", label }: StatItemProps) {
  const { ref, displayValue } = useCountUp(target, 1500, suffix);

  return (
    <div ref={ref} className="lp-stat-item" tabIndex={0} aria-label={`${label}: ${target}${suffix}`}>
      <Icon size={52} className="lp-stat-icon" aria-hidden="true" />
      <div className="lp-stat-text">
        <h3 className="tabular-nums" style={{ fontVariantNumeric: "tabular-nums" }}>
          {displayValue}
        </h3>
        <p>{label}</p>
      </div>
    </div>
  );
}
