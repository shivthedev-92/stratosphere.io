import { scaleThreshold } from "d3-scale";
import { timeDay, timeMonday } from "d3-time";

export type DayCounts = { done: number; notDone: number; meaningful: number };

export type HeatmapDay = DayCounts & {
  date: Date;
  key: string;
  level: 0 | 1 | 2 | 3 | 4;
};

/** Colour level by tasks done: 0 · 1 · 2 · 3-4 · 5+. */
export const levelFor = scaleThreshold<number, HeatmapDay["level"]>()
  .domain([1, 2, 3, 5])
  .range([0, 1, 2, 3, 4]);

export const LEVEL_LABELS = ["No tasks done", "1 done", "2 done", "3–4 done", "5 or more done"];

/** Local-calendar key, e.g. 2026-09-26 (matches the API's dates). */
export function dayKey(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/** Parses an API date (YYYY-MM-DD) as local midnight, never as UTC. */
export function parseDayKey(key: string): Date {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(y, m - 1, d);
}

/**
 * Weeks (Monday first) covering the 52 weeks up to `today`, each an array of
 * up to 7 days. Days after today are left out, so the last column is partial.
 */
export function buildWeeks(today: Date, counts: Map<string, DayCounts>): HeatmapDay[][] {
  const end = timeDay.floor(today);
  const firstMonday = timeMonday.floor(timeDay.offset(end, -364));
  const weeks: HeatmapDay[][] = [];
  for (const monday of timeMonday.range(firstMonday, timeDay.offset(end, 1))) {
    const week: HeatmapDay[] = [];
    for (const date of timeDay.range(monday, timeDay.offset(monday, 7))) {
      if (date > end) break;
      const key = dayKey(date);
      const c = counts.get(key) ?? { done: 0, notDone: 0, meaningful: 0 };
      week.push({ ...c, date, key, level: levelFor(c.done) });
    }
    weeks.push(week);
  }
  return weeks;
}

export type HeatmapSummary = {
  totalDone: number;
  activeDays: number;
  currentStreak: number;
  longestStreak: number;
};

/**
 * A streak is consecutive days with at least one task done. The current
 * streak still counts if today has nothing yet (the day isn't over), as long
 * as yesterday had a task done.
 */
export function summarize(days: HeatmapDay[]): HeatmapSummary {
  let totalDone = 0;
  let activeDays = 0;
  let longestStreak = 0;
  let run = 0;
  for (const day of days) {
    totalDone += day.done;
    if (day.done > 0) {
      activeDays += 1;
      run += 1;
      longestStreak = Math.max(longestStreak, run);
    } else {
      run = 0;
    }
  }
  let currentStreak = 0;
  let i = days.length - 1;
  if (i >= 0 && days[i].done === 0) i -= 1; // today not done yet
  for (; i >= 0 && days[i].done > 0; i -= 1) currentStreak += 1;
  return { totalDone, activeDays, currentStreak, longestStreak };
}
