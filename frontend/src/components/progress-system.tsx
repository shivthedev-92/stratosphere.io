import type { GoalLogOut, GoalOut, Priority } from "@/lib/api";

const priorityLabels: Record<Priority, string> = {
  low: "Low",
  medium: "Medium",
  high: "High",
};

type TrendPoint = {
  id: string;
  x: number;
  y: number;
  label: string;
  date: string;
};

function getLogImpact(logs: GoalLogOut[]) {
  return logs.reduce((total, log) => {
    if (!log.completed) return total - 10;
    if (log.soulful === null) return total;
    return total + 10;
  }, 0);
}

function buildMonthlyTrend(logs: GoalLogOut[]): TrendPoint[] {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const logsByDay = logs.reduce<Record<number, GoalLogOut[]>>((acc, log) => {
    const date = new Date(log.created_at);
    if (date.getFullYear() !== year || date.getMonth() !== month) return acc;
    const day = date.getDate();
    acc[day] = [...(acc[day] ?? []), log];
    return acc;
  }, {});
  let score = 50;

  return Array.from({ length: daysInMonth }, (_, index) => {
    const day = index + 1;
    const dayLogs = logsByDay[day] ?? [];
    score += getLogImpact(dayLogs);
    score = Math.min(94, Math.max(12, score));
    const hasDone = dayLogs.some((log) => log.completed && log.soulful !== null);
    const hasNotDone = dayLogs.some((log) => !log.completed);

    return {
      id: `day-${day}`,
      x: daysInMonth === 1 ? 50 : 8 + (index / (daysInMonth - 1)) * 84,
      y: 100 - score,
      label: dayLogs.length === 0 ? "No reflections" : hasNotDone ? "Down" : hasDone ? "Up" : "Plateau",
      date: new Date(year, month, day).toLocaleDateString(undefined, {
        month: "short",
        day: "numeric",
      }),
    };
  });
}

export function ProgressSystem({ goals, logs }: { goals: GoalOut[]; logs: GoalLogOut[] }) {
  const priorityCounts = goals.reduce<Record<Priority, number>>(
    (counts, goal) => ({ ...counts, [goal.priority]: counts[goal.priority] + 1 }),
    { low: 0, medium: 0, high: 0 },
  );
  const maxPriorityCount = Math.max(1, ...Object.values(priorityCounts));
  const trendPoints = buildMonthlyTrend(logs);
  const trendLine = trendPoints.map((point) => `${point.x},${point.y}`).join(" ");
  const latestTrend = trendPoints.at(-1);
  const completedLogs = logs.filter((log) => log.completed && log.soulful !== null).length;
  const unsureLogs = logs.filter((log) => log.completed && log.soulful === null).length;
  const notDoneLogs = logs.filter((log) => !log.completed).length;

  return (
    <section className="rounded-card border border-line bg-surface p-5 shadow-lg shadow-black/15 backdrop-blur">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-base font-semibold text-fg">Progress Path</h2>
          <p className="mt-1 text-sm text-fg-subtle">
            Current month momentum from daily reflection outcomes.
          </p>
        </div>
        <div className="rounded-control border border-line bg-surface px-3 py-2 text-sm text-fg-muted">
          {logs.length} reflections
        </div>
      </div>

      <div className="mt-5 grid gap-5 lg:grid-cols-[1.2fr_0.8fr]">
        <div className="relative min-h-64 overflow-hidden rounded-card border border-line bg-surface p-4">
          <div className="relative z-10 max-w-xs">
            <p className="text-sm font-semibold text-fg">Reflection Trend</p>
            <p className="mt-1 text-sm text-fg-muted">
              Each day aggregates reflections: done lifts, unsure holds, and not done moves down.
            </p>
          </div>

          <svg
            aria-label="Reflection trend line"
            viewBox="0 0 100 100"
            preserveAspectRatio="none"
            className="absolute inset-x-4 bottom-4 top-24 h-auto w-[calc(100%-2rem)]"
          >
            <defs>
              <linearGradient id="trendFill" x1="0" x2="0" y1="0" y2="1">
                <stop offset="0%" stopColor="#34d399" stopOpacity="0.24" />
                <stop offset="100%" stopColor="#34d399" stopOpacity="0" />
              </linearGradient>
            </defs>
            {[25, 50, 75].map((line) => (
              <line
                key={line}
                x1="0"
                x2="100"
                y1={line}
                y2={line}
                stroke="rgba(255,255,255,0.09)"
                strokeWidth="0.5"
              />
            ))}
            <polygon points={`0,100 ${trendLine} 100,100`} fill="url(#trendFill)" />
            <polyline
              points={trendLine}
              fill="none"
              stroke="#34d399"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              vectorEffect="non-scaling-stroke"
            />
            {trendPoints
              .filter((point) => point.label !== "No reflections")
              .map((point) => (
                <circle
                  key={point.id}
                  cx={point.x}
                  cy={point.y}
                  r="2.6"
                  fill="#0a0a0a"
                  stroke={point.label === "Down" ? "#f59e0b" : point.label === "Plateau" ? "#38bdf8" : "#a7f3d0"}
                  strokeWidth="1.8"
                  vectorEffect="non-scaling-stroke"
                />
              ))}
          </svg>

          <div className="absolute bottom-4 left-4 right-4 flex items-center justify-between text-xs text-fg-subtle">
            <span>{trendPoints[0]?.date ?? "Start"}</span>
            <span>{latestTrend ? `${latestTrend.label} · ${latestTrend.date}` : "No reflections yet"}</span>
          </div>
        </div>

        <div className="grid gap-4">
          <div className="grid grid-cols-3 gap-3">
            <Stat label="Done" value={completedLogs} />
            <Stat label="Unsure" value={unsureLogs} />
            <Stat label="Not Done" value={notDoneLogs} />
          </div>

          <div className="rounded-card border border-line bg-surface p-4">
            <h3 className="text-sm font-semibold text-fg">Priority Mix</h3>
            <div className="mt-4 space-y-3">
              {(Object.keys(priorityCounts) as Priority[]).map((priority) => (
                <div key={priority}>
                  <div className="mb-1 flex items-center justify-between text-xs text-fg-muted">
                    <span>{priorityLabels[priority]}</span>
                    <span>{priorityCounts[priority]}</span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-raised">
                    <div
                      className="h-full rounded-full bg-accent"
                      style={{ width: `${(priorityCounts[priority] / maxPriorityCount) * 100}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-control border border-line bg-surface p-3">
      <p className="text-xs text-fg-subtle">{label}</p>
      <p className="mt-1 text-xl font-bold text-fg">{value}</p>
    </div>
  );
}
