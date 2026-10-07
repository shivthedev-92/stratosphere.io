import type { GoalLogOut, GoalOut, Priority } from "@/lib/api";
import { ActivityHeatmap } from "@/components/activity-heatmap";
import { CheckCircle, Circle, Sparkle, type Icon as PhosphorIcon } from "@phosphor-icons/react";

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
  const doneGoals = goals.filter((goal) => goal.completed).length;
  const openGoals = goals.length - doneGoals;
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
        {/* Refetch when a task is finished or reopened, or a reflection is added. */}
        <ActivityHeatmap refreshKey={`${doneGoals}-${logs.length}`} />
      </div>

      <div className="mt-5 grid gap-4 lg:grid-cols-[1fr_1fr]">
        <div className="grid grid-cols-3 gap-3">
          <Stat label="Done" value={doneGoals} icon={CheckCircle} tone="text-low" />
          <Stat label="Still open" value={openGoals} icon={Circle} tone="text-fg-muted" />
          <Stat label="Felt meaningful" value={meaningfulLogs} icon={Sparkle} tone="text-accent-soft" />
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

function Stat({
  label,
  value,
  icon: Icon,
  tone,
}: {
  label: string;
  value: number;
  icon: PhosphorIcon;
  tone: string;
}) {
  return (
    <div className="flex min-h-28 flex-col justify-between gap-4 rounded-control border border-line bg-surface p-4">
      <div className={`flex items-start justify-between gap-2 ${tone}`}>
        <p className="text-xs font-semibold leading-tight text-fg-subtle">{label}</p>
        <Icon size={18} weight="duotone" aria-hidden="true" className="shrink-0" />
      </div>
      <p className={`text-4xl font-semibold leading-none tracking-tight tabular-nums sm:text-5xl ${tone}`}>
        {value}
      </p>
    </div>
  );
}
