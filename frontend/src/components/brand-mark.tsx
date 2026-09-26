/**
 * The Strata mark (logo 1a, design/handoff): a sphere cut into atmospheric
 * layers. Bands are plain paths rather than the handoff SVG's mask, so the
 * mark needs no element ids and several can share a page. Change the logo
 * here; app/icon.svg, app/apple-icon.png and app/favicon.ico are generated
 * from the same path.
 */
export const STRATA_PATH =
  "M32 5A27 27 0 0 1 55.09 18H8.91A27 27 0 0 1 32 5ZM7.72 20.2H56.28A27 27 0 0 1 58.77 28.5H5.23A27 27 0 0 1 7.72 20.2ZM5.01 31.3H58.99A27 27 0 0 1 57.79 40H6.21A27 27 0 0 1 5.01 31.3ZM7.52 43.4H56.48A27 27 0 0 1 32 59A27 27 0 0 1 7.52 43.4Z";

export function StrataSymbol({ size = 24, className = "" }: { size?: number; className?: string }) {
  return (
    <svg
      viewBox="0 0 64 64"
      width={size}
      height={size}
      className={`shrink-0 ${className}`}
      aria-hidden="true"
      focusable="false"
    >
      <path d={STRATA_PATH} fill="currentColor" />
    </svg>
  );
}

type BrandMarkProps = {
  /** Symbol only; the accessible name stays. */
  compact?: boolean;
  className?: string;
  size?: "sm" | "md" | "lg";
};

const sizes = {
  sm: { symbol: 22, text: "text-base tracking-[-0.02em]", gap: "gap-2" },
  md: { symbol: 30, text: "text-[22px] tracking-[-0.03em]", gap: "gap-2.5" },
  lg: { symbol: 44, text: "text-[32px] tracking-[-0.03em]", gap: "gap-3.5" },
};

/** Symbol + "Stratosphere" wordmark. Lavender on Night, indigo on Dawn. */
export function BrandMark({ compact = false, className = "", size = "sm" }: BrandMarkProps) {
  const s = sizes[size];
  return (
    <span className={`inline-flex items-center ${s.gap} ${className}`}>
      <StrataSymbol size={s.symbol} className="text-accent-soft" />
      {compact ? (
        <span className="sr-only">Stratosphere</span>
      ) : (
        <span className={`${s.text} font-semibold leading-none text-fg`}>Stratosphere</span>
      )}
    </span>
  );
}
