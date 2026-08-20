import { cn } from "@/lib/utils";
import type { ProductVisualKey } from "@/types";

type Props = {
  visualKey: ProductVisualKey;
  accent?: string;
  className?: string;
  /** Show a soft vignette/grain overlay for editorial surfaces */
  editorial?: boolean;
};

/**
 * ProductVisual renders a hand-drawn, cohesive SVG illustration for each
 * product type. It is the primary product imagery system for the storefront,
 * giving every product a distinct, recognizable visual without depending on
 * external image files (which may be unavailable in the sandbox).
 *
 * Illustrations are line-art + soft fills, tinted by the product's accent
 * colour on a warm paper backdrop — the same restraint the rest of the site
 * uses.
 */
export function ProductVisual({
  visualKey,
  accent = "oklch(0.6 0.13 55)",
  className,
  editorial = false,
}: Props) {
  return (
    <div
      className={cn(
        "relative grid place-items-center overflow-hidden bg-[color-mix(in_oklch,var(--card)_82%,var(--accent))]",
        className
      )}
      style={{ ["--accent" as string]: accent }}
      aria-hidden="true"
    >
      {/* Subtle radial wash from the accent */}
      <div
        className="pointer-events-none absolute inset-0 opacity-60"
        style={{
          background: `radial-gradient(120% 120% at 50% 18%, color-mix(in oklch, ${accent} 22%, transparent), transparent 60%)`,
        }}
      />
      {editorial && <div className="pointer-events-none absolute inset-0 grain opacity-[0.04]" />}
      <svg
        viewBox="0 0 400 400"
        className="relative h-[78%] w-[78%] drop-shadow-[0_18px_30px_rgba(0,0,0,0.10)]"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <Illustration k={visualKey} accent={accent} />
      </svg>
    </div>
  );
}

function Illustration({ k, accent }: { k: ProductVisualKey; accent: string }) {
  const stroke = "color-mix(in oklch, var(--foreground) 78%, transparent)";
  const ink = "var(--foreground)";
  const paper = "var(--card)";
  const accentSoft = `color-mix(in oklch, ${accent} 30%, ${paper})`;
  const accentDeep = `color-mix(in oklch, ${accent} 62%, var(--foreground))`;

  switch (k) {
    case "headphones":
      return (
        <g stroke={stroke} strokeWidth="6" strokeLinecap="round" strokeLinejoin="round">
          <path d="M88 210 v-18 a112 112 0 0 1 224 0 v18" />
          <rect x="74" y="206" width="44" height="86" rx="20" fill={accentSoft} />
          <rect x="282" y="206" width="44" height="86" rx="20" fill={accentSoft} />
          <path d="M96 240 h20 M284 240 h20" stroke={paper} opacity="0.7" />
          <path d="M120 250 q40 -28 80 -28 t80 28" stroke={accentDeep} strokeWidth="3" opacity="0.6" />
        </g>
      );
    case "earbuds":
      return (
        <g stroke={stroke} strokeWidth="6" strokeLinecap="round" strokeLinejoin="round">
          <rect x="150" y="150" width="100" height="120" rx="26" fill={accentSoft} />
          <circle cx="200" cy="190" r="14" fill={paper} />
          <path d="M170 110 q30 -30 60 0" />
          <path d="M168 118 q-10 30 6 50" fill={accentSoft} />
          <path d="M232 118 q10 30 -6 50" fill={accentSoft} />
          <circle cx="174" cy="170" r="10" fill={accentDeep} />
          <circle cx="226" cy="170" r="10" fill={accentDeep} />
        </g>
      );
    case "speaker":
      return (
        <g stroke={stroke} strokeWidth="6" strokeLinecap="round" strokeLinejoin="round">
          <rect x="120" y="110" width="160" height="200" rx="22" fill={accentSoft} />
          <circle cx="200" cy="175" r="34" fill={paper} />
          <circle cx="200" cy="175" r="16" fill={accentDeep} />
          <circle cx="200" cy="262" r="20" fill={paper} />
          <path d="M150 130 h100" opacity="0.4" />
        </g>
      );
    case "keyboard":
      return (
        <g stroke={stroke} strokeWidth="6" strokeLinecap="round" strokeLinejoin="round">
          <path d="M70 150 h260 a18 18 0 0 1 18 18 v72 a18 18 0 0 1 -18 18 h-260 a18 18 0 0 1 -18 -18 v-72 a18 18 0 0 1 18 -18 z" fill={accentSoft} />
          {Array.from({ length: 4 }).map((_, r) =>
            Array.from({ length: 10 }).map((_, c) => (
              <rect
                key={`${r}-${c}`}
                x={88 + c * 24}
                y={172 + r * 20}
                width="14"
                height="12"
                rx="3"
                fill={paper}
                stroke="none"
              />
            ))
          )}
          <rect x="150" y="120" width="100" height="18" rx="9" fill={accentDeep} stroke="none" />
        </g>
      );
    case "mouse":
      return (
        <g stroke={stroke} strokeWidth="6" strokeLinecap="round" strokeLinejoin="round">
          <path d="M200 110 q70 0 70 90 v40 q0 60 -70 60 q-70 0 -70 -60 v-40 q0 -90 70 -90 z" fill={accentSoft} />
          <path d="M200 116 v60" />
          <path d="M200 136 q-22 0 -22 22" stroke={accentDeep} />
          <circle cx="200" cy="150" r="6" fill={accentDeep} stroke="none" />
        </g>
      );
    case "watch":
      return (
        <g stroke={stroke} strokeWidth="6" strokeLinecap="round" strokeLinejoin="round">
          <path d="M168 96 h64 l-8 38 h-48 z" fill={accentSoft} />
          <path d="M168 304 h64 l-8 -38 h-48 z" fill={accentSoft} />
          <rect x="148" y="134" width="104" height="132" rx="28" fill={accentSoft} />
          <rect x="164" y="150" width="72" height="100" rx="16" fill={paper} />
          <path d="M200 168 v32 l20 12" stroke={accentDeep} strokeWidth="5" />
          <circle cx="200" cy="200" r="4" fill={accentDeep} stroke="none" />
          <path d="M152 176 h-16 M152 224 h-16 M248 176 h16 M248 224 h16" opacity="0.6" />
        </g>
      );
    case "tracker":
      return (
        <g stroke={stroke} strokeWidth="6" strokeLinecap="round" strokeLinejoin="round">
          <rect x="150" y="120" width="100" height="170" rx="36" fill={accentSoft} />
          <rect x="166" y="138" width="68" height="100" rx="10" fill={paper} />
          <path d="M180 200 q20 18 40 0" stroke={accentDeep} strokeWidth="4" />
          <circle cx="200" cy="270" r="6" fill={accentDeep} stroke="none" />
          <path d="M170 300 q30 12 60 0" opacity="0.4" />
        </g>
      );
    case "camera":
      return (
        <g stroke={stroke} strokeWidth="6" strokeLinecap="round" strokeLinejoin="round">
          <path d="M120 150 h32 l14 -22 h68 l14 22 h32 a18 18 0 0 1 18 18 v108 a18 18 0 0 1 -18 18 h-160 a18 18 0 0 1 -18 -18 v-108 a18 18 0 0 1 18 -18 z" fill={accentSoft} />
          <circle cx="200" cy="210" r="52" fill={paper} />
          <circle cx="200" cy="210" r="34" fill={accentDeep} />
          <circle cx="200" cy="210" r="18" fill={paper} />
          <circle cx="214" cy="196" r="6" fill={paper} stroke="none" />
          <rect x="280" y="162" width="22" height="14" rx="4" fill={accentDeep} />
        </g>
      );
    case "lens":
      return (
        <g stroke={stroke} strokeWidth="6" strokeLinecap="round" strokeLinejoin="round">
          <rect x="160" y="120" width="80" height="170" rx="14" fill={accentSoft} />
          <circle cx="200" cy="150" r="14" fill={paper} />
          <circle cx="200" cy="205" r="54" fill={paper} />
          <circle cx="200" cy="205" r="38" fill={accentDeep} />
          <circle cx="200" cy="205" r="22" fill={paper} />
          <circle cx="186" cy="190" r="8" fill={paper} stroke="none" />
          <path d="M160 270 h80" opacity="0.4" />
        </g>
      );
    case "drone":
      return (
        <g stroke={stroke} strokeWidth="6" strokeLinecap="round" strokeLinejoin="round">
          <rect x="160" y="180" width="80" height="50" rx="12" fill={accentSoft} />
          <circle cx="120" cy="170" r="30" fill="none" />
          <circle cx="280" cy="170" r="30" fill="none" />
          <circle cx="120" cy="170" r="14" fill={accentDeep} stroke="none" />
          <circle cx="280" cy="170" r="14" fill={accentDeep} stroke="none" />
          <path d="M140 178 l40 12 M260 178 l-40 12" />
          <path d="M195 180 v-30 M205 180 v-30" />
        </g>
      );
    case "charger":
      return (
        <g stroke={stroke} strokeWidth="6" strokeLinecap="round" strokeLinejoin="round">
          <rect x="140" y="140" width="120" height="120" rx="20" fill={accentSoft} />
          <path d="M180 140 v-40 M220 140 v-40" />
          <circle cx="200" cy="200" r="30" fill={paper} />
          <path d="M190 200 h20 M200 190 v20" stroke={accentDeep} />
          <rect x="250" y="190" width="40" height="14" rx="4" fill={accentDeep} stroke="none" />
        </g>
      );
    case "cable":
      return (
        <g stroke={stroke} strokeWidth="6" strokeLinecap="round" strokeLinejoin="round">
          <path d="M100 200 q40 -60 80 0 t80 0 t40 0" fill="none" />
          <path d="M100 200 q40 -60 80 0 t80 0 t40 0" stroke={accentSoft} strokeWidth="16" opacity="0.6" />
          <rect x="92" y="188" width="20" height="24" rx="6" fill={accentDeep} />
          <rect x="288" y="188" width="20" height="24" rx="6" fill={accentDeep} />
        </g>
      );
    case "stand":
      return (
        <g stroke={stroke} strokeWidth="6" strokeLinecap="round" strokeLinejoin="round">
          <path d="M120 250 h160" />
          <path d="M140 250 v-70 l60 -40 60 40 v70" fill={accentSoft} />
          <path d="M140 180 h120" opacity="0.5" />
          <rect x="178" y="200" width="44" height="34" rx="6" fill={paper} />
          <path d="M120 250 q-10 18 6 24 h168 q16 -6 6 -24" fill={accentDeep} opacity="0.5" />
        </g>
      );
    case "lamp":
      return (
        <g stroke={stroke} strokeWidth="6" strokeLinecap="round" strokeLinejoin="round">
          <path d="M200 290 v-90" />
          <path d="M150 290 h100" />
          <path d="M140 200 q60 -70 120 0" fill={accentSoft} />
          <path d="M140 200 q60 30 120 0" stroke={accentDeep} opacity="0.6" />
          <path d="M200 210 v70" opacity="0.3" />
          <circle cx="200" cy="260" r="10" fill={accentDeep} stroke="none" />
        </g>
      );
    case "backpack":
      return (
        <g stroke={stroke} strokeWidth="6" strokeLinecap="round" strokeLinejoin="round">
          <path d="M150 130 q50 -30 100 0 l20 30 v150 a14 14 0 0 1 -14 14 h-112 a14 14 0 0 1 -14 -14 v-150 z" fill={accentSoft} />
          <path d="M170 130 q30 -40 60 0" opacity="0.6" />
          <rect x="170" y="190" width="60" height="60" rx="10" fill={paper} />
          <path d="M170 190 q30 20 60 0" stroke={accentDeep} opacity="0.5" />
          <path d="M150 150 q-20 30 0 50 M250 150 q20 30 0 50" opacity="0.4" />
        </g>
      );
    case "controller":
      return (
        <g stroke={stroke} strokeWidth="6" strokeLinecap="round" strokeLinejoin="round">
          <path d="M120 180 q40 -30 80 -30 t80 30 q40 30 30 80 q-8 38 -40 30 q-20 -6 -34 -26 h-72 q-14 20 -34 26 q-32 8 -40 -30 q-10 -50 30 -80 z" fill={accentSoft} />
          <circle cx="160" cy="210" r="10" fill={paper} />
          <circle cx="190" cy="200" r="10" fill={paper} />
          <circle cx="240" cy="210" r="14" fill={accentDeep} />
          <circle cx="260" cy="230" r="8" fill={accentDeep} />
        </g>
      );
    case "mic":
      return (
        <g stroke={stroke} strokeWidth="6" strokeLinecap="round" strokeLinejoin="round">
          <rect x="170" y="110" width="60" height="100" rx="30" fill={accentSoft} />
          <path d="M150 170 q50 50 100 0" />
          <path d="M200 220 v40" />
          <path d="M170 270 h60" />
          <path d="M180 130 h40 M180 150 h40 M180 170 h40" stroke={paper} opacity="0.6" />
        </g>
      );
    case "monitor":
      return (
        <g stroke={stroke} strokeWidth="6" strokeLinecap="round" strokeLinejoin="round">
          <rect x="90" y="120" width="220" height="140" rx="12" fill={accentSoft} />
          <rect x="106" y="136" width="188" height="108" rx="6" fill={paper} />
          <path d="M170 260 v30 M230 260 v30 M150 290 h100" />
          <path d="M124 200 q40 -40 80 0 t60 0" stroke={accentDeep} strokeWidth="4" opacity="0.7" />
        </g>
      );
    default:
      return (
        <g stroke={stroke} strokeWidth="6" strokeLinecap="round" strokeLinejoin="round">
          <rect x="120" y="120" width="160" height="160" rx="20" fill={accentSoft} />
          <circle cx="200" cy="200" r="40" fill={accentDeep} />
        </g>
      );
  }
}
