import * as React from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export interface NSelectOption {
  value: string;
  label: string;
}

interface NSelectProps {
  value: string;
  onValueChange: (v: string) => void;
  options: NSelectOption[];
  placeholder?: string;
  /** Compact height for filter bars (default true) */
  compact?: boolean;
  className?: string;
  /** Min width for the trigger */
  minWidth?: number;
}

/**
 * NUVIA Select — Radix-based dropdown that fully respects NUVIA dark tokens.
 * Replaces native <select> in dark modules where OS dropdown styling cannot be overridden.
 */
export function NSelect({
  value,
  onValueChange,
  options,
  placeholder = "Seleccionar…",
  compact = true,
  className = "",
  minWidth,
}: NSelectProps) {
  return (
    <Select value={value} onValueChange={onValueChange}>
      <SelectTrigger
        className={`nuvia-select-trigger ${compact ? "nuvia-select-trigger-sm" : ""} ${className}`}
        style={minWidth ? { minWidth } : undefined}
      >
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent className="nuvia-select-content">
        {options.map((opt) => (
          <SelectItem key={opt.value} value={opt.value} className="nuvia-select-item">
            {opt.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
