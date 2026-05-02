import type { GoalLogOut, GoalOut } from "@/lib/api";

function formatDateTime(date: string) {
  return new Date(date).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function formatDuration(start: string, end: string) {
  const diffMs = Math.max(0, new Date(end).getTime() - new Date(start).getTime());
  const totalMinutes = Math.max(1, Math.round(diffMs / 60000));
  const days = Math.floor(totalMinutes / 1440);
  const hours = Math.floor((totalMinutes % 1440) / 60);
  const minutes = totalMinutes % 60;

  if (days > 0) return `${days}d ${hours}h`;
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
}

function getStatus(log: GoalLogOut) {
  if (!log.completed) return "Not done";
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
  const goalsById = new Map(goals.map((goal) => [goal.id, goal]));
  const completedLogs = logs
    .filter((log) => log.completed)
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

  return (
    <section className="rounded-lg border border-white/10 bg-neutral-900/85 p-5 shadow-lg shadow-black/15 backdrop-blur">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-base font-semibold text-white">Completed Reflections</h2>
          <p className="mt-1 text-sm text-neutral-500">
            Review completed tasks, reflection notes, status, and time taken.
          </p>
        </div>
        <div className="rounded-lg border border-white/10 bg-neutral-950/60 px-3 py-2 text-sm text-neutral-300">
          {completedLogs.length} completed
        </div>
      </div>

      <div className="mt-5 overflow-x-auto">
        {completedLogs.length === 0 ? (
          <div className="rounded-lg border border-white/10 bg-neutral-950/45 p-6 text-center text-sm text-neutral-500">
            Completed reflections will appear here after you save them.
          </div>
        ) : (
          <table className="min-w-full text-left text-sm">
            <thead className="border-b border-neutral-800 text-xs uppercase tracking-wide text-neutral-500">
              <tr>
                <th className="py-3 pr-4 font-semibold">Completed</th>
                <th className="py-3 pr-4 font-semibold">Reflection</th>
                <th className="py-3 pr-4 font-semibold">Status</th>
                <th className="py-3 pr-4 font-semibold">Time Completed</th>
                <th className="py-3 pr-4 font-semibold">Took</th>
                <th className="py-3 font-semibold">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-800">
              {completedLogs.map((log) => {
                const goal = goalsById.get(log.goal_id);
                return (
                  <tr key={log.id} className="align-top text-neutral-300">
                    <td className="max-w-56 py-4 pr-4 font-semibold text-white">
                      {goal?.title ?? "Deleted goal"}
                    </td>
                    <td className="max-w-md py-4 pr-4 text-neutral-400">
                      {log.reflection}
                    </td>
                    <td className="py-4 pr-4">
                      <span className="rounded border border-white/10 bg-neutral-950/60 px-2 py-1 text-xs text-neutral-300">
                        {getStatus(log)}
                      </span>
                    </td>
                    <td className="py-4 pr-4 text-neutral-400">{formatDateTime(log.created_at)}</td>
                    <td className="py-4 text-neutral-400">
                      {goal ? formatDuration(goal.created_at, log.created_at) : "N/A"}
                    </td>
                    <td className="py-4">
                      {goal ? (
                        <button
                          type="button"
                          onClick={() => onReuseGoal(goal)}
                          className="rounded-lg border border-neutral-700 px-3 py-1.5 text-xs font-semibold text-neutral-300 transition-colors hover:border-neutral-500 hover:text-white"
                        >
                          Reuse
                        </button>
                      ) : (
                        <span className="text-xs text-neutral-600">Unavailable</span>
                      )}
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
