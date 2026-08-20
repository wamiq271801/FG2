import { cn } from "@/lib/utils";
import type { RatingDistribution } from "@/types";

export function RatingDistribution({
  distribution,
  count,
}: {
  distribution: RatingDistribution;
  count: number;
}) {
  const rows: { stars: 5 | 4 | 3 | 2 | 1; label: string }[] = [
    { stars: 5, label: "5" },
    { stars: 4, label: "4" },
    { stars: 3, label: "3" },
    { stars: 2, label: "2" },
    { stars: 1, label: "1" },
  ];
  return (
    <ul className="space-y-1.5" aria-label="Rating distribution">
      {rows.map((r) => {
        const n = distribution[r.stars];
        const pct = count > 0 ? Math.round((n / count) * 100) : 0;
        return (
          <li key={r.stars} className="flex items-center gap-2 text-xs">
            <span className="w-6 text-muted-foreground">{r.label}★</span>
            <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
              <div
                className={cn("h-full bg-copper/70")}
                style={{ width: `${pct}%` }}
              />
            </div>
            <span className="w-8 text-right text-muted-foreground">{n}</span>
          </li>
        );
      })}
    </ul>
  );
}
