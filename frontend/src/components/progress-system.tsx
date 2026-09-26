import type { GoalLogOut, GoalOut, Priority } from "@/lib/api";
import { ActivityHeatmap } from "@/components/activity-heatmap";

const priorityLabels: Record<Priority, string> = {
  low: "Low",
  medium: "Medium",
  high: "High",
};

export function ProgressSystem({ goals, logs }: { goals: GoalOut[]; logs: GoalLogOut[] }) {
  const priorityCounts = goals.reduce<Record<Priority, number>>(
    (counts, goal) => ({ ...counts, [goal.priority]: counts[goal.priority] + 1 }),
    { low: 0, medium: 0, high: 0 },
  );
  const maxPriorityCount = Math.max(1, ...Object.values(priorityCounts));
  const doneLogs = logs.filter((log) => log.completed).length;
  const notDoneLogs = logs.filter((log) => !log.completed).length;
  const meaningfulLogs = logs.filter((log) => log.soulful === true).length;

  return (
    <section className="rounded-card border border-line bg-surface p-5 shadow-lg shadow-tint backdrop-blur">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-base font-semibold text-fg">Progress Path</h2>
          <p className="mt-1 text-sm text-fg-subtle">
            Every day you finish a task lights up. Missed days stay quiet, never red.
          </p>
        </div>
        <div className="rounded-control border border-line bg-surface px-3 py-2 text-sm text-fg-muted">
          {logs.length} reflections
        </div>
      </div>

      <div className="mt-5">
        {/* Refetch when a reflection is added or removed. */}
        <ActivityHeatmap refreshKey={logs.length} />
      </div>

      <div className="mt-5 grid gap-4 lg:grid-cols-[1fr_1fr]">
        <div className="grid grid-cols-3 gap-3">
          <Stat label="Done" value={doneLogs} />
          <Stat label="Not done" value={notDoneLogs} />
          <Stat label="Felt meaningful" value={meaningfulLogs} />
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
    </section>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-control border border-line bg-surface p-3">
      <p className="text-xs text-fg-subtle">{label}</p>
      <p className="mt-1 text-xl font-bold text-fg tabular-nums">{value}</p>
    </div>
  );
}
