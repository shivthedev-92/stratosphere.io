"use client";

import { CrisisOverlay } from "@/components/crisis-notice";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { FormEvent, useEffect, useState } from "react";
import { BackgroundShell } from "@/components/background-shell";
import { api, type GoalLogOut, type GoalOut, type Priority,
  type SafetyNoticeOut,
} from "@/lib/api";

const priorityMeta: Record<Priority, { emoji: string; label: string; classes: string }> = {
  low: {
    emoji: "🌱",
    label: "Low",
    classes: "border-emerald-700/70 bg-emerald-950/60 text-emerald-200",
  },
  medium: {
    emoji: "⚡",
    label: "Medium",
    classes: "border-sky-700/70 bg-sky-950/60 text-sky-200",
  },
  high: {
    emoji: "🔥",
    label: "High",
    classes: "border-amber-700/70 bg-amber-950/60 text-amber-200",
  },
};

function formatDateTime(value: string) {
  return new Date(value).toLocaleString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function getLogStatus(log: GoalLogOut) {
  if (log.completed) return "Completed";
  return "Not completed";
}

function getSoulfulStatus(log: GoalLogOut) {
  if (log.soulful === true) return "Meaningful";
  if (log.soulful === false) return "Not meaningful";
  return "Unsure";
}

export default function TaskJournalPage() {
  const params = useParams<{ goalId: string }>();
  const router = useRouter();
  const goalId = params.goalId;
  const [goal, setGoal] = useState<GoalOut | null>(null);
  const [logs, setLogs] = useState<GoalLogOut[]>([]);
  const [reflection, setReflection] = useState("");
  const [completed, setCompleted] = useState(true);
  const [soulful, setSoulful] = useState<boolean | null>(true);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    Promise.all([api.goal(goalId), api.goalLogsForGoal(goalId)])
      .then(([goalData, logData]) => {
        setGoal(goalData);
        setLogs(logData);
      })
      .catch((err: unknown) => {
        if (err instanceof Error && err.message.includes("401")) {
          router.push("/login");
          return;
        }
        setError(err instanceof Error ? err.message : "Could not load task journal");
      })
      .finally(() => setLoading(false));
  }, [goalId, router]);

  const [safetyNotice, setSafetyNotice] = useState<SafetyNoticeOut | null>(null);

  async function handleAddEntry(e: FormEvent) {
    e.preventDefault();
    if (!reflection.trim()) return;
    setSaving(true);
    setError("");
    try {
      const log = await api.createGoalLog(goalId, {
        completed,
        reflection: reflection.trim(),
        soulful,
      });
      setLogs((current) => [log, ...current]);
      // The entry is already saved; this only surfaces resources.
      if (log.safety) setSafetyNotice(log.safety);
      setReflection("");
      setCompleted(true);
      setSoulful(true);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Could not save journal entry");
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <p className="p-8 text-neutral-500">Loading...</p>;

  if (!goal) {
    return (
      <BackgroundShell className="min-h-screen text-white" showSwitcher>
        <div className="relative z-10 mx-auto max-w-3xl px-4 py-10">
          <Link href="/dashboard" className="text-sm font-semibold text-neutral-400 hover:text-white">
            ← Dashboard
          </Link>
          <div className="mt-6 rounded-lg border border-red-900/60 bg-red-950/40 p-4 text-sm text-red-200">
            {error || "Task not found"}
          </div>
        </div>
      </BackgroundShell>
    );
  }

  const sortedLogs = [...logs].sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
  );

  return (
    <>
      {safetyNotice && (
        <CrisisOverlay notice={safetyNotice} onClose={() => setSafetyNotice(null)} />
      )}
    <BackgroundShell className="min-h-screen text-white" showSwitcher>
      <div className="relative z-10 mx-auto flex w-full max-w-5xl flex-col gap-6 px-4 py-6 sm:px-8 sm:py-10">
        <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <Link href="/dashboard" className="text-sm font-semibold text-neutral-400 hover:text-white">
              ← Dashboard
            </Link>
            <h1 className="mt-3 break-words text-3xl font-bold">{goal.title}</h1>
            <div className="mt-3 flex flex-wrap gap-2">
              <span className={`rounded border px-2 py-0.5 text-xs ${priorityMeta[goal.priority].classes}`}>
                <span aria-hidden="true">{priorityMeta[goal.priority].emoji}</span>{" "}
                {priorityMeta[goal.priority].label}
              </span>
              <span className="rounded border border-white/10 bg-neutral-950/50 px-2 py-0.5 text-xs text-neutral-300">
                {goal.is_timed && goal.scheduled_for
                  ? `⏰ ${formatDateTime(goal.scheduled_for)}`
                  : "🧭 Moment-based goal"}
              </span>
              <span className="rounded border border-white/10 bg-neutral-950/50 px-2 py-0.5 text-xs text-neutral-300">
                {sortedLogs.length} {sortedLogs.length === 1 ? "entry" : "entries"}
              </span>
            </div>
          </div>
        </header>

        {goal.notes && (
          <section className="rounded-lg border border-white/10 bg-neutral-900/80 p-5 shadow-lg shadow-black/15 backdrop-blur">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-neutral-500">
              Task context
            </h2>
            <p className="mt-2 whitespace-pre-wrap break-words text-sm leading-6 text-neutral-300">
              {goal.notes}
            </p>
          </section>
        )}

        {error && (
          <div className="rounded-lg border border-red-900/60 bg-red-950/40 p-4 text-sm text-red-200">
            {error}
          </div>
        )}

        <section className="grid gap-6 lg:grid-cols-[340px_minmax(0,1fr)]">
          <form
            onSubmit={handleAddEntry}
            className="rounded-lg border border-white/10 bg-neutral-900/85 p-5 shadow-lg shadow-black/15 backdrop-blur"
          >
            <h2 className="text-base font-semibold">Add journal entry</h2>
            <p className="mt-1 text-sm text-neutral-500">
              Add another reflection as the task evolves.
            </p>

            <div className="mt-5 grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => {
                  setCompleted(true);
                  setSoulful(true);
                }}
                className={`rounded-lg border px-3 py-2 text-sm ${
                  completed
                    ? "border-emerald-500 bg-emerald-700 text-white"
                    : "border-neutral-700 bg-neutral-800 text-neutral-300"
                }`}
              >
                Done
              </button>
              <button
                type="button"
                onClick={() => {
                  setCompleted(false);
                  setSoulful(false);
                }}
                className={`rounded-lg border px-3 py-2 text-sm ${
                  !completed
                    ? "border-amber-500 bg-amber-700 text-white"
                    : "border-neutral-700 bg-neutral-800 text-neutral-300"
                }`}
              >
                Not done
              </button>
            </div>

            <textarea
              value={reflection}
              onChange={(e) => setReflection(e.target.value)}
              required
              rows={7}
              maxLength={2000}
              className="mt-4 w-full resize-none rounded-lg border border-neutral-700 bg-neutral-800 px-3 py-2 text-sm outline-none focus:border-indigo-500"
              placeholder="Add the latest detail, obstacle, decision, or reflection..."
            />

            <div className="mt-4">
              <span className="mb-2 block text-sm text-neutral-300">
                Does this still feel meaningful?
              </span>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { label: "Yes", value: true },
                  { label: "Unsure", value: null },
                  { label: "No", value: false },
                ].map((item) => (
                  <button
                    key={item.label}
                    type="button"
                    onClick={() => setSoulful(item.value)}
                    className={`rounded-lg border px-3 py-2 text-sm ${
                      soulful === item.value
                        ? "border-indigo-500 bg-indigo-600 text-white"
                        : "border-neutral-700 bg-neutral-800 text-neutral-300"
                    }`}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            </div>

            <button
              type="submit"
              disabled={saving || !reflection.trim()}
              className="mt-5 w-full rounded-lg bg-indigo-600 px-4 py-3 text-sm font-semibold transition-colors hover:bg-indigo-500 disabled:opacity-50"
            >
              {saving ? "Saving..." : "Add entry"}
            </button>
          </form>

          <section className="rounded-lg border border-white/10 bg-neutral-900/85 p-5 shadow-lg shadow-black/15 backdrop-blur">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <h2 className="text-base font-semibold">Journal timeline</h2>
                <p className="mt-1 text-sm text-neutral-500">
                  Every user entry is kept here, with the latest entry shown first.
                </p>
              </div>
              <span className="rounded-lg border border-white/10 bg-neutral-950/50 px-3 py-1.5 text-sm text-neutral-300">
                {sortedLogs.length} total
              </span>
            </div>

            {sortedLogs.length === 0 ? (
              <div className="mt-6 rounded-lg border border-dashed border-white/15 bg-neutral-950/35 p-6 text-sm text-neutral-400">
                No journal entries yet. Add the first reflection to start the timeline.
              </div>
            ) : (
              <ol className="relative mt-6 space-y-5 border-l border-sky-800/70 pl-6">
                {sortedLogs.map((log) => (
                  <li key={log.id} className="relative">
                    <span className="absolute -left-[34px] top-1 grid h-5 w-5 place-items-center rounded-full bg-sky-500 text-[10px] shadow-lg shadow-sky-950/60">
                      🔵
                    </span>
                    <article className="rounded-lg border border-white/10 bg-neutral-950/45 p-4">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="flex flex-wrap gap-2">
                          <span className="rounded border border-sky-700/70 bg-sky-950/50 px-2 py-0.5 text-xs font-semibold text-sky-200">
                            User log
                          </span>
                          <span className="rounded border border-white/10 px-2 py-0.5 text-xs text-neutral-300">
                            {getLogStatus(log)}
                          </span>
                          <span className="rounded border border-white/10 px-2 py-0.5 text-xs text-neutral-300">
                            {getSoulfulStatus(log)}
                          </span>
                        </div>
                        <time className="text-xs text-neutral-500" dateTime={log.created_at}>
                          {formatDateTime(log.created_at)}
                        </time>
                      </div>
                      <p className="mt-3 whitespace-pre-wrap break-words text-sm leading-6 text-neutral-200">
                        {log.reflection}
                      </p>
                    </article>
                  </li>
                ))}
              </ol>
            )}
          </section>
        </section>
      </div>
    </BackgroundShell>
    </>
  );
}
