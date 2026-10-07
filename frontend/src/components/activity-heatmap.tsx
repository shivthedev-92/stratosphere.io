"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { api } from "@/lib/api";
import {
  buildWeeks,
  LEVEL_LABELS,
  summarize,
  type DayCounts,
  type HeatmapDay,
} from "@/lib/heatmap";

const CELL = 11;
const GAP = 3;
const STEP = CELL + GAP;
const LEFT = 30; // weekday labels
const TOP = 18; // month labels
const WEEKDAY_ROWS: [number, string][] = [
  [0, "Mon"],
  [2, "Wed"],
  [4, "Fri"],
];

const dayLong = new Intl.DateTimeFormat(undefined, { weekday: "short", day: "numeric", month: "short", year: "numeric" });
const monthShort = new Intl.DateTimeFormat(undefined, { month: "short" });

function plural(n: number, word: string): string {
  return `${n} ${word}${n === 1 ? "" : "s"}`;
}

function describe(day: HeatmapDay): string {
  const parts = [`${day.done} done`];
  if (day.notDone) parts.push(`${day.notDone} reflected on while open`);
  if (day.meaningful) parts.push(`${day.meaningful} felt meaningful`);
  return `${dayLong.format(day.date)} · ${day.done || day.notDone || day.meaningful ? parts.join(" · ") : "nothing logged"}`;
}

/**
 * GitHub-style year of tasks done per day. React draws the SVG; d3-time and
 * d3-scale (in lib/heatmap) do the calendar and colour-level maths.
 *
 * One tab stop: arrow keys move a selected day (←/→ a week, ↑/↓ a day), and
 * its details are announced in the live line below. Hover and tap select too.
 */
export function ActivityHeatmap({ refreshKey = 0 }: { refreshKey?: number | string }) {
  const [counts, setCounts] = useState<Map<string, DayCounts> | null>(null);
  const [failed, setFailed] = useState(false);
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const scroller = useRef<HTMLDivElement>(null);
  // Loads can overlap (the page loads while a reflection is being saved);
  // only the newest request may update the grid, whatever order they land.
  const latestRequest = useRef(0);

  const load = useCallback(() => {
    const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
    const request = ++latestRequest.current;
    setFailed(false);
    api
      .progressDaily(timeZone)
      .then((data) => {
        if (request !== latestRequest.current) return;
        setCounts(
          new Map(
            data.days.map((d) => [d.date, { done: d.done, notDone: d.not_done, meaningful: d.meaningful }]),
          ),
        );
      })
      .catch(() => {
        if (request === latestRequest.current) setFailed(true);
      });
  }, []);

  useEffect(() => {
    load();
  }, [load, refreshKey]);

  const weeks = useMemo(() => buildWeeks(new Date(), counts ?? new Map()), [counts]);
  const days = useMemo(() => weeks.flat(), [weeks]);
  const summary = useMemo(() => summarize(days), [days]);
  const indexByKey = useMemo(() => new Map(days.map((d, i) => [d.key, i])), [days]);
  const selected = days[indexByKey.get(selectedKey ?? "") ?? days.length - 1];

  // Open on the current month: phones scroll the year sideways.
  useEffect(() => {
    const el = scroller.current;
    if (el) el.scrollLeft = el.scrollWidth;
  }, [weeks.length]);

  const monthLabels = useMemo(() => {
    const labels: { x: number; text: string }[] = [];
    weeks.forEach((week, col) => {
      const first = week.find((d) => d.date.getDate() === 1);
      if (!first) return;
      // Skip a label that would collide with the previous one.
      if (labels.length && col - labels[labels.length - 1].x / STEP < 3) return;
      labels.push({ x: col * STEP, text: monthShort.format(first.date) });
    });
    return labels;
  }, [weeks]);

  function onKeyDown(event: React.KeyboardEvent) {
    const moves: Record<string, number> = { ArrowLeft: -7, ArrowRight: 7, ArrowUp: -1, ArrowDown: 1 };
    let next: number | undefined;
    const current = indexByKey.get(selected.key) ?? days.length - 1;
    if (event.key in moves) next = current + moves[event.key];
    if (event.key === "Home") next = 0;
    if (event.key === "End") next = days.length - 1;
    if (next === undefined) return;
    event.preventDefault();
    setSelectedKey(days[Math.min(days.length - 1, Math.max(0, next))].key);
  }

  const width = LEFT + weeks.length * STEP;
  const height = TOP + 7 * STEP;
  const loading = counts === null && !failed;

  return (
    <div className="rounded-card border border-line bg-surface p-4">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <p className="text-sm font-semibold text-fg">Tasks done, day by day</p>
        {counts ? (
          <p className="text-xs text-fg-muted tabular-nums">
            {summary.totalDone === 0
              ? "Finish a task and its day lights up here."
              : `${summary.totalDone} done in the last year · ${plural(summary.activeDays, "active day")} · ` +
                `streak ${plural(summary.currentStreak, "day")} (best ${summary.longestStreak})`}
          </p>
        ) : null}
      </div>

      {failed ? (
        <p role="alert" className="mt-4 text-sm text-danger">
          Couldn&apos;t load your progress.{" "}
          <button type="button" onClick={load} className="font-semibold underline">
            Try again
          </button>
        </p>
      ) : (
        <>
          <div ref={scroller} className="mt-3 overflow-x-auto pb-1">
            {/* Fills the card on wide screens; below its natural size it keeps
                that size and the row scrolls sideways instead of shrinking. */}
            <svg
              viewBox={`0 0 ${width} ${height}`}
              style={{ minWidth: width }}
              role="img"
              aria-label={
                counts
                  ? `Year of tasks done. ${summary.totalDone} tasks done on ${summary.activeDays} days. Use arrow keys to read each day.`
                  : "Loading your year of progress"
              }
              tabIndex={0}
              onKeyDown={onKeyDown}
              className={`block h-auto w-full rounded-chip ${loading ? "animate-pulse motion-reduce:animate-none" : ""}`}
            >
              {monthLabels.map((m) => (
                <text key={m.x} x={LEFT + m.x} y={11} className="fill-fg-subtle text-[10px]">
                  {m.text}
                </text>
              ))}
              {WEEKDAY_ROWS.map(([row, text]) => (
                <text key={text} x={0} y={TOP + row * STEP + CELL - 2} className="fill-fg-subtle text-[10px]">
                  {text}
                </text>
              ))}
              {weeks.map((week, col) =>
                week.map((day, row) => {
                  const isSelected = counts !== null && day.key === selected.key;
                  return (
                    <rect
                      key={day.key}
                      x={LEFT + col * STEP}
                      y={TOP + row * STEP}
                      width={CELL}
                      height={CELL}
                      rx={2.5}
                      fill={`var(--heat-${day.level})`}
                      stroke={isSelected ? "var(--focus)" : "none"}
                      strokeWidth={isSelected ? 2 : 0}
                      onMouseEnter={() => counts && setSelectedKey(day.key)}
                      onClick={() => counts && setSelectedKey(day.key)}
                    />
                  );
                }),
              )}
            </svg>
          </div>

          <div className="mt-2 flex flex-wrap items-center justify-between gap-3 text-xs text-fg-muted">
            <p aria-live="polite" className="min-h-4 tabular-nums">
              {counts && selected ? describe(selected) : ""}
            </p>
            <div className="flex items-center gap-1.5" aria-label="Colour key: fewer to more tasks done">
              <span>Less</span>
              {LEVEL_LABELS.map((label, level) => (
                <svg key={label} width={CELL} height={CELL} aria-hidden="true">
                  <title>{label}</title>
                  <rect width={CELL} height={CELL} rx={2.5} fill={`var(--heat-${level})`} />
                </svg>
              ))}
              <span>More</span>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
