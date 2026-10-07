import type { ReactNode } from "react";

/**
 * A placeholder block that pulses while content loads. Decorative only: the
 * LoadingRegion around it is what assistive tech announces. Stays still for
 * people who prefer reduced motion.
 */
export function Skeleton({ className = "" }: { className?: string }) {
  return (
    <div
      aria-hidden="true"
      className={`animate-pulse rounded-control bg-raised motion-reduce:animate-none ${className}`}
    />
  );
}

/** Wraps skeletons so screen readers hear one "Loading…" message, not empty shapes. */
export function LoadingRegion({
  label,
  className = "",
  children,
}: {
  label: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <div role="status" aria-busy="true" className={className}>
      <span className="sr-only">{label}</span>
      {children}
    </div>
  );
}
