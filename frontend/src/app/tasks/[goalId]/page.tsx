"use client";

import { CrisisOverlay } from "@/components/crisis-notice";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { FormEvent, useEffect, useState } from "react";
import { BackgroundShell } from "@/components/background-shell";
import { Alarm, Compass } from "@phosphor-icons/react";
import { PriorityIcon } from "@/components/icons";
import { api, type GoalLogOut, type GoalOut, type Priority,
  type SafetyNoticeOut,
} from "@/lib/api";

const priorityMeta: Record<Priority, { label: string; chip: string; selected: string }> = {
  low: {
    label: "Low",
    chip: "bg-low-bg text-low",
    selected: "border-low bg-low-bg font-semibold text-low",
  },
  medium: {
    label: "Medium",
    chip: "bg-med-bg text-med",
    selected: "border-med bg-med-bg font-semibold text-med",
  },
  high: {
    label: "High",
    chip: "bg-high-bg text-high",
    selected: "border-high bg-high-bg font-semibold text-high",
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

  if (loading) return <p className="p-8 text-fg-subtle">Loading...</p>;

  if (!goal) {
    return (
      <BackgroundShell className="min-h-screen text-fg" showSwitcher>
        <div className="relative z-10 mx-auto max-w-3xl px-4 py-10">
          <Link href="/dashboard" className="text-sm font-semibold text-fg-muted hover:text-fg">
            ← Dashboard
          </Link>
          <div className="mt-6 rounded-control border border-danger/30 bg-danger-bg p-4 text-sm text-danger">
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
    <BackgroundShell className="min-h-screen text-fg" showSwitcher>
      <div className="relative z-10 mx-auto flex w-full max-w-5xl flex-col gap-6 px-4 py-6 sm:px-8 sm:py-10">
        <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <Link href="/dashboard" className="text-sm font-semibold text-fg-muted hover:text-fg">
              ← Dashboard
            </Link>
            <h1 className="mt-3 break-words text-3xl font-bold">{goal.title}</h1>
            <div className="mt-3 flex flex-wrap gap-2">
              <span className={`inline-flex items-center gap-1 rounded-chip px-2.5 py-1 text-[13px] font-semibold ${priorityMeta[goal.priority].chip}`}>
                <PriorityIcon priority={goal.priority} size={14} />
                {priorityMeta[goal.priority].label}
              </span>
              <span className="inline-flex items-center gap-1 rounded border border-line bg-surface px-2 py-0.5 text-xs text-fg-muted">
                {goal.is_timed && goal.scheduled_for ? (
                  <>
                    <Alarm size={14} aria-hidden="true" />
                    {formatDateTime(goal.scheduled_for)}
                  </>
                ) : (
                  <>
                    <Compass size={14} aria-hidden="true" />
                    Moment-based goal
                  </>
                )}
              </span>
              <span className="rounded border border-line bg-surface px-2 py-0.5 text-xs text-fg-muted">
                {sortedLogs.length} {sortedLogs.length === 1 ? "entry" : "entries"}
              </span>
            </div>
          </div>
        </header>

        {goal.notes && (
          <section className="rounded-card border border-line bg-surface p-5 shadow-lg shadow-tint backdrop-blur">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-fg-subtle">
              Task context
            </h2>
            <p className="mt-2 whitespace-pre-wrap break-words text-sm leading-6 text-fg-muted">
              {goal.notes}
            </p>
          </section>
        )}

        {error && (
          <div className="rounded-control border border-danger/30 bg-danger-bg p-4 text-sm text-danger">
            {error}
          </div>
        )}

        <section className="grid gap-6 lg:grid-cols-[340px_minmax(0,1fr)]">
          <form
            onSubmit={handleAddEntry}
            className="rounded-card border border-line bg-surface p-5 shadow-lg shadow-tint backdrop-blur"
          >
            <h2 className="text-base font-semibold">Add journal entry</h2>
            <p className="mt-1 text-sm text-fg-subtle">
              Add another reflection as the task evolves.
            </p>

            <div className="mt-5 grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => {
                  setCompleted(true);
                  setSoulful(true);
                }}
                className={`rounded-control border px-3 py-2 text-sm ${
                  completed
                    ? "border-low bg-low-bg font-semibold text-low"
                    : "border-line-strong bg-raised text-fg-muted"
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
                className={`rounded-control border px-3 py-2 text-sm ${
                  !completed
                    ? "border-notdone bg-raised font-semibold text-fg"
                    : "border-line-strong bg-raised text-fg-muted"
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
              className="mt-4 w-full resize-none rounded-control border border-line-strong bg-field px-3 py-2 text-sm outline-none focus:border-accent"
              placeholder="Add the latest detail, obstacle, decision, or reflection..."
            />

            <div className="mt-4">
              <span className="mb-2 block text-sm text-fg-muted">
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
                    className={`rounded-control border px-3 py-2 text-sm ${
                      soulful === item.value
                        ? "border-accent bg-accent text-white"
                        : "border-line-strong bg-raised text-fg-muted"
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
              className="mt-5 w-full rounded-control bg-accent text-white px-4 py-3 text-sm font-semibold transition-colors hover:bg-accent-hover disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {saving ? "Saving..." : "Add entry"}
            </button>
          </form>

          <section className="rounded-card border border-line bg-surface p-5 shadow-lg shadow-tint backdrop-blur">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <h2 className="text-base font-semibold">Journal timeline</h2>
                <p className="mt-1 text-sm text-fg-subtle">
                  Every user entry is kept here, with the latest entry shown first.
                </p>
              </div>
              <span className="rounded-control border border-line bg-surface px-3 py-1.5 text-sm text-fg-muted">
                {sortedLogs.length} total
              </span>
            </div>

            {sortedLogs.length === 0 ? (
              <div className="mt-6 rounded-control border border-dashed border-line-strong bg-surface p-6 text-sm text-fg-muted">
                No journal entries yet. Add the first reflection to start the timeline.
              </div>
            ) : (
              <ol className="relative mt-6 space-y-5 border-l border-line-strong pl-6">
                {sortedLogs.map((log) => (
                  <li key={log.id} className="relative">
                    <span
                      aria-hidden="true"
                      className="absolute -left-[31px] top-1.5 h-3.5 w-3.5 rounded-full border-2 border-accent-soft bg-accent"
                    />
                    <article className="rounded-card border border-line bg-surface p-4">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="flex flex-wrap gap-2">
                          <span className="rounded-chip border border-line bg-raised px-2 py-0.5 text-xs font-semibold text-accent-soft">
                            User log
                          </span>
                          <span className="rounded border border-line px-2 py-0.5 text-xs text-fg-muted">
                            {getLogStatus(log)}
                          </span>
                          <span className="rounded border border-line px-2 py-0.5 text-xs text-fg-muted">
                            {getSoulfulStatus(log)}
                          </span>
                        </div>
                        <time className="text-xs text-fg-subtle" dateTime={log.created_at}>
                          {formatDateTime(log.created_at)}
                        </time>
                      </div>
                      <p className="mt-3 whitespace-pre-wrap break-words leading-6 text-fg font-serif italic text-[15px]">
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
