"use client";

// Design system icons (Phosphor, Regular weight; Fill for the selected state).
// Mapping from design/handoff/README.md: UI emoji are replaced by these.
import { Flame, Lightning, Moon, Plant, Sun, SunHorizon, type Icon } from "@phosphor-icons/react";
import type { Priority } from "@/lib/api";

export const PRIORITY_ICONS: Record<Priority, Icon> = {
  low: Plant,
  medium: Lightning,
  high: Flame,
};

export function PriorityIcon({
  priority,
  selected = false,
  size = 16,
}: {
  priority: Priority;
  selected?: boolean;
  size?: number;
}) {
  const PriorityGlyph = PRIORITY_ICONS[priority];
  return <PriorityGlyph size={size} weight={selected ? "fill" : "regular"} aria-hidden="true" />;
}

/** Greeting icon for the time of day (was 🌤️ / ☀️ / 🌙). */
export function DayIcon({ size = 16 }: { size?: number }) {
  const hour = new Date().getHours();
  const DayGlyph = hour < 12 ? SunHorizon : hour < 17 ? Sun : Moon;
  return <DayGlyph size={size} aria-hidden="true" />;
}
