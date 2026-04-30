"use client";

import { FormEvent, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  api,
  clearToken,
  type GoalOut,
  type Priority,
  type UserOut,
} from "@/lib/api";
import { EmptyGoalsIllustration, InsightIllustration } from "@/components/illustrations";

const priorities: Priority[] = ["low", "medium", "high"];

export default function DashboardPage() {
  const router = useRouter();
  const [user, setUser] = useState<UserOut | null>(null);
  const [goals, setGoals] = useState<GoalOut[]>([]);
  const [title, setTitle] = useState("");
  const [notes, setNotes] = useState("");
  const [isTimed, setIsTimed] = useState(false);
  const [scheduledFor, setScheduledFor] = useState("");
  const [priority, setPriority] = useState<Priority>("medium");
  const [activeGoal, setActiveGoal] = useState<GoalOut | null>(null);
  const [completed, setCompleted] = useState(true);
  const [reflection, setReflection] = useState("");
  const [soulful, setSoulful] = useState<boolean | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    Promise.all([api.me(), api.goals()])
      .then(([userData, goalData]) => {
        setUser(userData);
        setGoals(goalData);
      })
      .catch(() => router.push("/login"))
      .finally(() => setLoading(false));
  }, [router]);

  function handleLogout() {
    clearToken();
    router.push("/");
  }

  async function handleCreateGoal(e: FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;
    setError("");
    setSaving(true);
    try {
      const goal = await api.createGoal({
        title: title.trim(),
        notes: notes.trim() || null,
        is_timed: isTimed,
        scheduled_for: isTimed && scheduledFor ? new Date(scheduledFor).toISOString() : null,
        priority,
      });
      setGoals((current) => [goal, ...current]);
      setTitle("");
      setNotes("");
      setIsTimed(false);
      setScheduledFor("");
      setPriority("medium");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Could not add action item");
    } finally {
      setSaving(false);
    }
  }

  async function handleLogGoal(e: FormEvent) {
    e.preventDefault();
    if (!activeGoal || !reflection.trim()) return;
    setError("");
    setSaving(true);
    try {
      await api.createGoalLog(activeGoal.id, {
        completed,
        reflection: reflection.trim(),
        soulful,
      });
      setActiveGoal(null);
      setReflection("");
      setSoulful(null);
      setCompleted(true);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Could not save reflection");
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <p className="text-neutral-500 p-8">Loading...</p>;
  if (!user) return null;

  return (
    <main className="min-h-screen bg-neutral-950 text-white">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-8 px-4 py-6 sm:px-8 sm:py-10">
        <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm text-neutral-500">Today</p>
            <h1 className="text-2xl font-bold">Hello, {user.name}</h1>
          </div>
          <div className="flex flex-wrap gap-3">
            <Link
              href="/chat"
              className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold transition-colors hover:bg-indigo-500"
            >
              Life Coach
            </Link>
            <button
              onClick={handleLogout}
              className="rounded-lg border border-neutral-700 px-4 py-2 text-sm font-semibold transition-colors hover:border-neutral-500"
            >
              Sign out
            </button>
          </div>
        </header>

        <section className="rounded-lg border border-neutral-800 bg-neutral-900 p-5">
          <p className="text-center text-sm italic text-neutral-300">
            &ldquo;A Success or a Failure in Goal is Defined only by you. Please use this
            data as a helper rather than a definition of what you are.&rdquo;
          </p>
        </section>

        {error && (
          <div className="rounded-lg border border-red-900/60 bg-red-950/40 p-4 text-sm text-red-200">
            {error}
          </div>
        )}

        <div className="grid gap-8 lg:grid-cols-[360px_1fr]">
          <section className="rounded-lg border border-neutral-800 bg-neutral-900 p-5">
            <h2 className="text-base font-semibold">Add Action Item</h2>
            <p className="mt-1 text-sm text-neutral-500">
              Capture the goal and the moment where it may naturally fit today.
            </p>

            <form onSubmit={handleCreateGoal} className="mt-5 space-y-4">
              <label className="block">
                <span className="mb-1 block text-sm text-neutral-300">Title</span>
                <input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  required
                  maxLength={200}
                  className="w-full rounded-lg border border-neutral-700 bg-neutral-800 px-3 py-2 text-sm outline-none focus:border-indigo-500"
                  placeholder="Read for 15 minutes"
                />
              </label>

              <label className="block">
                <span className="mb-1 block text-sm text-neutral-300">Specific notes</span>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={4}
                  maxLength={2000}
                  className="w-full resize-none rounded-lg border border-neutral-700 bg-neutral-800 px-3 py-2 text-sm outline-none focus:border-indigo-500"
                  placeholder="Where, why, or what might get in the way?"
                />
              </label>

              <div>
                <span className="mb-2 block text-sm text-neutral-300">Priority</span>
                <div className="grid grid-cols-3 gap-2">
                  {priorities.map((item) => (
                    <button
                      key={item}
                      type="button"
                      onClick={() => setPriority(item)}
                      className={`rounded-lg border px-3 py-2 text-sm capitalize ${
                        priority === item
                          ? "border-indigo-500 bg-indigo-600 text-white"
                          : "border-neutral-700 bg-neutral-800 text-neutral-300"
                      }`}
                    >
                      {item}
                    </button>
                  ))}
                </div>
              </div>

              <label className="flex items-center gap-3 text-sm text-neutral-300">
                <input
                  type="checkbox"
                  checked={isTimed}
                  onChange={(e) => setIsTimed(e.target.checked)}
                  className="h-4 w-4 accent-indigo-600"
                />
                This has a specific time
              </label>

              {isTimed && (
                <input
                  type="datetime-local"
                  value={scheduledFor}
                  onChange={(e) => setScheduledFor(e.target.value)}
                  className="w-full rounded-lg border border-neutral-700 bg-neutral-800 px-3 py-2 text-sm outline-none focus:border-indigo-500"
                />
              )}

              <button
                type="submit"
                disabled={saving || !title.trim()}
                className="w-full rounded-lg bg-indigo-600 px-4 py-3 text-sm font-semibold transition-colors hover:bg-indigo-500 disabled:opacity-50"
              >
                {saving ? "Saving..." : "Add to today"}
              </button>
            </form>
          </section>

          <section className="rounded-lg border border-neutral-800 bg-neutral-900">
            <div className="border-b border-neutral-800 px-5 py-4">
              <h2 className="text-base font-semibold">Today&apos;s Action Items</h2>
              <p className="mt-1 text-sm text-neutral-500">
                Mark an item when you are ready, then reflect without judgment.
              </p>
            </div>

            <div className="divide-y divide-neutral-800">
              {goals.length === 0 ? (
                <div className="flex flex-col items-center px-6 py-10 text-center">
                  <EmptyGoalsIllustration className="mb-4 h-32 w-full max-w-64" />
                  <h3 className="text-sm font-semibold text-neutral-200">No action items yet</h3>
                  <p className="mt-2 max-w-sm text-sm text-neutral-500">
                    Add one small goal for today. Keep it realistic enough that returning to it feels easy.
                  </p>
                </div>
              ) : (
                goals.map((goal) => (
                  <article key={goal.id} className="p-5">
                    <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="break-words font-semibold text-white">{goal.title}</h3>
                          <span className="rounded border border-neutral-700 px-2 py-0.5 text-xs capitalize text-neutral-400">
                            {goal.priority}
                          </span>
                        </div>
                        {goal.notes && (
                          <p className="mt-2 whitespace-pre-wrap break-words text-sm text-neutral-400">
                            {goal.notes}
                          </p>
                        )}
                        <p className="mt-3 text-xs text-neutral-500">
                          {goal.is_timed && goal.scheduled_for
                            ? `Timed for ${new Date(goal.scheduled_for).toLocaleString()}`
                            : "Moment-based goal"}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          setActiveGoal(goal);
                          setCompleted(true);
                        }}
                        className="shrink-0 rounded-lg bg-neutral-800 px-4 py-2 text-sm font-semibold transition-colors hover:bg-neutral-700"
                      >
                        Reflect
                      </button>
                    </div>
                  </article>
                ))
              )}
            </div>
          </section>
        </div>

        <div className="grid gap-6 md:grid-cols-3">
          <Placeholder
            title="Where Your Time Is Going"
            body="Struggle breakdown chart coming soon."
            variant="chart"
          />
          <Placeholder
            title="Your Day in Motion"
            body="Location map requires explicit permission."
            variant="map"
          />
          <Placeholder
            title="Things I Keep Pushing Away"
            body="Backlog list coming soon."
            variant="list"
          />
        </div>
      </div>

      {activeGoal && (
        <div className="fixed inset-0 z-10 flex items-end bg-black/70 p-4 sm:items-center sm:justify-center">
          <form
            onSubmit={handleLogGoal}
            className="w-full max-w-lg rounded-lg border border-neutral-800 bg-neutral-900 p-5 shadow-2xl"
          >
            <h2 className="text-lg font-semibold">{activeGoal.title}</h2>
            <p className="mt-1 text-sm text-neutral-500">
              What went well, what got in the way, and does this still feel meaningful?
            </p>

            <div className="mt-5 grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setCompleted(true)}
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
                onClick={() => setCompleted(false)}
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
              rows={5}
              required
              maxLength={2000}
              className="mt-4 w-full resize-none rounded-lg border border-neutral-700 bg-neutral-800 px-3 py-2 text-sm outline-none focus:border-indigo-500"
              placeholder="Write a short reflection..."
            />

            <div className="mt-4">
              <span className="mb-2 block text-sm text-neutral-300">
                Does this goal still feel meaningful?
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

            <div className="mt-5 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => {
                  setActiveGoal(null);
                  setReflection("");
                }}
                className="rounded-lg border border-neutral-700 px-4 py-2 text-sm font-semibold"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={saving || !reflection.trim()}
                className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold hover:bg-indigo-500 disabled:opacity-50"
              >
                {saving ? "Saving..." : "Save reflection"}
              </button>
            </div>
          </form>
        </div>
      )}
    </main>
  );
}

function Placeholder({
  title,
  body,
  variant,
}: {
  title: string;
  body: string;
  variant: "chart" | "map" | "list";
}) {
  return (
    <section className="rounded-lg border border-neutral-800 bg-neutral-900 p-5">
      <InsightIllustration variant={variant} className="mb-4 h-20 w-full" />
      <h2 className="text-sm font-semibold text-white">{title}</h2>
      <p className="mt-2 text-sm text-neutral-500">{body}</p>
    </section>
  );
}
