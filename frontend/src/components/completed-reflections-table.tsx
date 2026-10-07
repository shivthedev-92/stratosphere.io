import type { GoalLogOut, GoalOut } from "@/lib/api";
import { formatDuration } from "@/lib/duration";

function formatDateTime(date: string) {
  return new Date(date).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function getStatus(log: GoalLogOut | undefined) {
  if (!log) return "Not reflected";
  if (log.soulful === null) return "Unsure";
  return log.soulful ? "Meaningful" : "Not meaningful";
}

export function CompletedReflectionsTable({
  goals,
  logs,
  onReuseGoal,
}: {
  goals: GoalOut[];
  logs: GoalLogOut[];
  onReuseGoal: (goal: GoalOut) => void;
}) {
  // Tasks marked complete, newest first, each with its latest reflection.
  const latestLogByGoalId = new Map<string, GoalLogOut>();
  for (const log of logs) {
    const current = latestLogByGoalId.get(log.goal_id);
    if (!current || new Date(log.created_at) > new Date(current.created_at)) {
      latestLogByGoalId.set(log.goal_id, log);
    }
  }
  const completedGoals = goals
    .filter((goal): goal is GoalOut & { completed_at: string } => goal.completed && !!goal.completed_at)
    .sort((a, b) => new Date(b.completed_at).getTime() - new Date(a.completed_at).getTime());

  return (
    <section className="rounded-card border border-line bg-surface p-5 shadow-lg shadow-tint backdrop-blur">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-base font-semibold text-fg">Completed Tasks</h2>
          <p className="mt-1 text-sm text-fg-subtle">
            Review completed tasks, your latest reflection on each, and time taken.
          </p>
        </div>
        <div className="rounded-control border border-line bg-surface px-3 py-2 text-sm text-fg-muted">
          {completedGoals.length} completed
        </div>
      </div>

      <div className="mt-5 overflow-x-auto">
        {completedGoals.length === 0 ? (
          <div className="rounded-card border border-line bg-surface p-6 text-center text-sm text-fg-subtle">
            Tasks you mark complete will appear here.
          </div>
        ) : (
          <table className="min-w-full text-left text-sm">
            <thead className="border-b border-line text-xs uppercase tracking-wide text-fg-subtle">
              <tr>
                <th className="py-3 pr-4 font-semibold">Task</th>
                <th className="py-3 pr-4 font-semibold">Reflection</th>
                <th className="py-3 pr-4 font-semibold">Status</th>
                <th className="py-3 pr-4 font-semibold">Time Completed</th>
                <th className="py-3 pr-4 font-semibold">Took</th>
                <th className="py-3 font-semibold">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {completedGoals.map((goal) => {
                const log = latestLogByGoalId.get(goal.id);
                return (
                  <tr key={goal.id} className="align-top text-fg-muted">
                    <td className="max-w-56 py-4 pr-4 font-semibold text-fg">{goal.title}</td>
                    <td className="max-w-md py-4 pr-4 text-fg-muted font-serif italic text-[15px]">
                      {log?.reflection ?? <span className="font-sans not-italic text-fg-subtle">-</span>}
                    </td>
                    <td className="py-4 pr-4">
                      <span className="rounded border border-line bg-surface px-2 py-1 text-xs text-fg-muted">
                        {getStatus(log)}
                      </span>
                    </td>
                    <td className="py-4 pr-4 text-fg-muted">{formatDateTime(goal.completed_at)}</td>
                    <td className="py-4 text-fg-muted">{formatDuration(goal.created_at, goal.completed_at)}</td>
                    <td className="py-4">
                      <button
                        type="button"
                        onClick={() => onReuseGoal(goal)}
                        className="rounded-control border border-line-strong px-3 py-1.5 text-xs font-semibold text-fg-muted transition-colors hover:border-fg-subtle hover:text-fg"
                      >
                        Reuse
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </section>
  );
}
