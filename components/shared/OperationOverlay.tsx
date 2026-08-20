"use client";

import { useOperation } from "@/hooks/use-operation";
import { Loader2 } from "lucide-react";

export function OperationOverlay() {
  const { active, title } = useOperation();

  if (!active) return null;

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center">
      <div className="absolute inset-0 bg-background/80 backdrop-blur-md" />
      <div className="relative z-10 flex flex-col items-center gap-4 rounded-xl border border-border/70 bg-card p-8 shadow-2xl">
        <Loader2 className="h-8 w-8 animate-spin text-copper" />
        <p className="font-display text-lg tracking-tight">{title}</p>
      </div>
    </div>
  );
}
