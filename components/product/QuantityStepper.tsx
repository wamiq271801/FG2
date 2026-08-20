"use client";

import { Minus, Plus } from "lucide-react";
import { cn } from "@/lib/utils";

type Props = {
  value: number;
  onChange: (next: number) => void;
  min?: number;
  max?: number;
  className?: string;
  /** Disable the whole stepper (e.g. when product is sold out) */
  disabled?: boolean;
  /** Optional label for screen readers */
  label?: string;
};

/**
 * QuantityStepper — a tactile, keyboard-accessible quantity control.
 *
 * Controlled: parent owns the value. Clamps to [min, max] (default 1–10).
 * The numeric value is also editable directly via the input for keyboard
 * users who prefer typing.
 */
export function QuantityStepper({
  value,
  onChange,
  min = 1,
  max = 10,
  className,
  disabled = false,
  label = "Quantity",
}: Props) {
  const atMin = value <= min;
  const atMax = value >= max;

  function clamp(n: number) {
    return Math.min(Math.max(Math.floor(n) || min, min), max);
  }

  function step(delta: number) {
    if (disabled) return;
    onChange(clamp(value + delta));
  }

  return (
    <div
      className={cn(
        "inline-flex items-center rounded-md border border-border bg-card",
        disabled && "opacity-50",
        className
      )}
    >
      <button
        type="button"
        onClick={() => step(-1)}
        disabled={disabled || atMin}
        aria-label="Decrease quantity"
        className="press grid h-9 w-9 place-items-center text-muted-foreground hover:text-foreground disabled:pointer-events-none disabled:opacity-40"
      >
        <Minus className="h-3.5 w-3.5" />
      </button>
      <label className="sr-only" htmlFor={`qty-${label.replace(/\s/g, "-").toLowerCase()}`}>
        {label}
      </label>
      <input
        id={`qty-${label.replace(/\s/g, "-").toLowerCase()}`}
        type="number"
        inputMode="numeric"
        pattern="[0-9]*"
        value={value}
        min={min}
        max={max}
        disabled={disabled}
        aria-label={label}
        onChange={(e) => onChange(clamp(parseInt(e.target.value, 10)))}
        onBlur={(e) => {
          const v = parseInt(e.target.value, 10);
          if (Number.isNaN(v) || v < min) onChange(min);
          else if (v > max) onChange(max);
        }}
        className="h-9 w-10 border-x border-border bg-transparent text-center text-sm font-medium tabular-nums outline-none focus-visible:ring-2 focus-visible:ring-copper/40 [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
      />
      <button
        type="button"
        onClick={() => step(1)}
        disabled={disabled || atMax}
        aria-label="Increase quantity"
        className="press grid h-9 w-9 place-items-center text-muted-foreground hover:text-foreground disabled:pointer-events-none disabled:opacity-40"
      >
        <Plus className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}
