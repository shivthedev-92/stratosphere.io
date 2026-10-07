"use client";

import { CrisisOverlay } from "@/components/crisis-notice";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { FormEvent, KeyboardEvent, useEffect, useRef, useState } from "react";
import { BackgroundShell } from "@/components/background-shell";
import {
  Alarm,
  ArrowCounterClockwise,
  CheckCircle,
  Compass,
  ListChecks,
  NotePencil,
} from "@phosphor-icons/react";
import { ChecklistCard } from "@/components/checklist-card";
import { ChecklistForm } from "@/components/checklist-form";
import { TaskJournalSkeleton, TimelineEntrySkeleton } from "@/components/page-skeletons";
import { PriorityIcon } from "@/components/icons";
import { TaskActionButton } from "@/components/task-action-button";
import {
  api,
  type ChecklistCreate,
  type ChecklistOut,
  type GoalLogOut,
  type GoalOut,
  type Priority,
  type SafetyNoticeOut,
} from "@/lib/api";

const ENTRY_TABS = [
  { id: "journal", label: "Journal entry", icon: NotePencil },
  { id: "checklist", label: "Checklist", icon: ListChecks },
] as const;
type EntryTab = (typeof ENTRY_TABS)[number]["id"];

type TimelineEntry =
  | { kind: "log"; createdAt: string; log: GoalLogOut }
  | { kind: "checklist"; createdAt: string; checklist: ChecklistOut };

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
  const [checklists, setChecklists] = useState<ChecklistOut[]>([]);
  const [checklistsLoading, setChecklistsLoading] = useState(true);
  const [entryTab, setEntryTab] = useState<EntryTab>("journal");
  // Set after Mark complete here, to invite a reflection; cleared once one is saved.
  const [justCompleted, setJustCompleted] = useState(false);
  const journalRef = useRef<HTMLTextAreaElement>(null);
  const tabRefs = useRef<Record<EntryTab, HTMLButtonElement | null>>({ journal: null, checklist: null });
  const [reflection, setReflection] = useState("");
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

  // Separate from the task and its reflections: if checklists fail to load,
  // the journal still shows and only this part reports the problem.
  useEffect(() => {
    api
      .checklistsForGoal(goalId)
      .then(setChecklists)
      .catch((err: unknown) => {
        if (err instanceof Error && err.message.includes("401")) return; // the load above redirects
        setError("Could not load checklists. Your reflections are shown; refresh to try again.");
      })
      .finally(() => setChecklistsLoading(false));
  }, [goalId]);

  const [safetyNotice, setSafetyNotice] = useState<SafetyNoticeOut | null>(null);

  async function handleAddEntry(e: FormEvent) {
    e.preventDefault();
    if (!reflection.trim()) return;
    setSaving(true);
    setError("");
    try {
      // No "completed" here: the server records whether the task is complete.
      const log = await api.createGoalLog(goalId, {
        reflection: reflection.trim(),
        soulful,
      });
      setLogs((current) => [log, ...current]);
      // The entry is already saved; this only surfaces resources.
      if (log.safety) setSafetyNotice(log.safety);
      setReflection("");
      setSoulful(true);
      setJustCompleted(false);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Could not save journal entry");
    } finally {
      setSaving(false);
    }
  }

  async function handleCreateChecklist(data: ChecklistCreate) {
    setSaving(true);
    setError("");
    try {
      const checklist = await api.createChecklist(goalId, data);
      setChecklists((current) => [checklist, ...current]);
      return true;
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Could not save checklist");
      return false;
    } finally {
      setSaving(false);
    }
  }

  async function handleSetCompleted(completed: boolean) {
    if (!goal) return;
    setSaving(true);
    setError("");
    try {
      // PATCH replaces every field, so resend the goal as-is with the new status.
      const updated = await api.updateGoal(goal.id, {
        title: goal.title,
        emoji: goal.emoji,
        notes: goal.notes,
        is_timed: goal.is_timed,
        scheduled_for: goal.scheduled_for,
        priority: goal.priority,
        completed,
      });
      setGoal(updated);
      setJustCompleted(completed);
      if (completed) {
        // Finishing is the natural moment to reflect; the journal is right here.
        setEntryTab("journal");
        requestAnimationFrame(() => journalRef.current?.focus());
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Could not update task");
    } finally {
      setSaving(false);
    }
  }

  function handleTabKeyDown(e: KeyboardEvent<HTMLButtonElement>) {
    if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
    e.preventDefault();
    const next = entryTab === "journal" ? "checklist" : "journal";
    setEntryTab(next);
    tabRefs.current[next]?.focus();
  }

  if (loading) return <TaskJournalSkeleton />;

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

  const timeline: TimelineEntry[] = [
    ...logs.map((log) => ({ kind: "log" as const, createdAt: log.created_at, log })),
    ...checklists.map((checklist) => ({
      kind: "checklist" as const,
      createdAt: checklist.created_at,
      checklist,
    })),
  ].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

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
              {goal.completed && (
                <span className="inline-flex items-center gap-1 rounded border border-accent/30 bg-accent/10 px-2 py-0.5 text-xs font-semibold text-accent-soft">
                  <CheckCircle size={14} weight="fill" aria-hidden="true" />
                  Completed
                </span>
              )}
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
                {timeline.length} {timeline.length === 1 ? "entry" : "entries"}
              </span>
            </div>
          </div>
          <TaskActionButton
            icon={goal.completed ? ArrowCounterClockwise : CheckCircle}
            label={goal.completed ? "Reopen task" : "Mark task complete"}
            tooltip={goal.completed ? "Reopen" : "Mark complete"}
            tone={goal.completed ? "neutral" : "accent"}
            disabled={saving}
            onClick={() => handleSetCompleted(!goal.completed)}
          />
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
          <div className="rounded-card border border-line bg-surface p-5 shadow-lg shadow-tint backdrop-blur">
            <h2 className="sr-only">Add to the journal</h2>
            <div role="tablist" aria-label="Add to the journal" className="grid grid-cols-2 gap-1 rounded-control bg-raised p-1">
              {ENTRY_TABS.map(({ id, label, icon: Icon }) => {
                const selected = entryTab === id;
                return (
                  <button
                    key={id}
                    ref={(el) => {
                      tabRefs.current[id] = el;
                    }}
                    type="button"
                    role="tab"
                    id={`entry-tab-${id}`}
                    aria-selected={selected}
                    aria-controls={`entry-panel-${id}`}
                    tabIndex={selected ? 0 : -1}
                    onClick={() => setEntryTab(id)}
                    onKeyDown={handleTabKeyDown}
                    className={`inline-flex items-center justify-center gap-1.5 rounded-control px-3 py-2 text-sm font-semibold transition-colors ${
                      selected ? "bg-surface-solid text-fg shadow-sm" : "text-fg-muted hover:text-fg"
                    }`}
                  >
                    <Icon size={16} aria-hidden="true" />
                    {label}
                  </button>
                );
              })}
            </div>

            <div
              role="tabpanel"
              id="entry-panel-journal"
              aria-labelledby="entry-tab-journal"
              hidden={entryTab !== "journal"}
            >
            <form onSubmit={handleAddEntry}>
              {justCompleted ? (
                <p className="mt-4 inline-flex items-center gap-1.5 text-sm font-semibold text-low">
                  <CheckCircle size={16} weight="fill" aria-hidden="true" />
                  Marked complete. Want to reflect on it?
                </p>
              ) : (
                <p className="mt-4 text-sm text-fg-subtle">Add another reflection as the task evolves.</p>
              )}
  
              <textarea
                ref={journalRef}
                aria-label="Journal entry"
                value={reflection}
                onChange={(e) => setReflection(e.target.value)}
                required
                rows={7}
                maxLength={2000}
                className="mt-5 w-full resize-none rounded-control border border-line-strong bg-field px-3 py-2 text-sm outline-none focus:border-accent"
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
            </div>

            <div
              role="tabpanel"
              id="entry-panel-checklist"
              aria-labelledby="entry-tab-checklist"
              hidden={entryTab !== "checklist"}
            >
              <p className="mt-4 text-sm text-fg-subtle">
                List what this needs. Tick items off in the timeline as you go.
              </p>
              <ChecklistForm saving={saving} onSubmit={handleCreateChecklist} />
            </div>
          </div>

          <section className="rounded-card border border-line bg-surface p-5 shadow-lg shadow-tint backdrop-blur">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <h2 className="text-base font-semibold">Journal timeline</h2>
                <p className="mt-1 text-sm text-fg-subtle">
                  Reflections and checklists, with the latest shown first.
                </p>
              </div>
              <span className="rounded-control border border-line bg-surface px-3 py-1.5 text-sm text-fg-muted">
                {timeline.length} total
              </span>
            </div>

            {timeline.length === 0 && checklistsLoading ? (
              <div className="mt-6 border-l border-line-strong pl-6">
                <TimelineEntrySkeleton lines={["w-3/4", "w-1/2"]} />
              </div>
            ) : timeline.length === 0 ? (
              <div className="mt-6 rounded-control border border-dashed border-line-strong bg-surface p-6 text-sm text-fg-muted">
                Nothing here yet. Add a reflection or a checklist to start the timeline.
              </div>
            ) : (
              <ol className="relative mt-6 space-y-5 border-l border-line-strong pl-6">
                {timeline.map((entry) => (
                  <li key={entry.kind === "log" ? entry.log.id : entry.checklist.id} className="relative">
                    <span
                      aria-hidden="true"
                      className="absolute -left-[31px] top-1.5 h-3.5 w-3.5 rounded-full border-2 border-accent-soft bg-accent"
                    />
                    {entry.kind === "checklist" ? (
                      <ChecklistCard
                        checklist={entry.checklist}
                        taskCompleted={goal.completed}
                        onChange={(update) =>
                          setChecklists((current) =>
                            current.map((c) => (c.id === entry.checklist.id ? update(c) : c)),
                          )
                        }
                        onDelete={() =>
                          setChecklists((current) => current.filter((c) => c.id !== entry.checklist.id))
                        }
                        onCompleteTask={() => handleSetCompleted(true)}
                        onError={setError}
                      />
                    ) : (
                      <article className="rounded-card border border-line bg-surface p-4">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div className="flex flex-wrap gap-2">
                            <span className="rounded-chip border border-line bg-raised px-2 py-0.5 text-xs font-semibold text-accent-soft">
                              Reflection
                            </span>
                            <span className="rounded border border-line px-2 py-0.5 text-xs text-fg-muted">
                              {getSoulfulStatus(entry.log)}
                            </span>
                          </div>
                          <time className="text-xs text-fg-subtle" dateTime={entry.log.created_at}>
                            {formatDateTime(entry.log.created_at)}
                          </time>
                        </div>
                        <p className="mt-3 whitespace-pre-wrap break-words leading-6 text-fg font-serif italic text-[15px]">
                          {entry.log.reflection}
                        </p>
                      </article>
                    )}
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
