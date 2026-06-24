// ############################################################################
// #    _____ __             __                   __                     _     
// #   / ___// /__________ _/ /_____  _________  / /_  ___  ________    (_)___ 
// #   \__ \/ __/ ___/ __ `/ __/ __ \/ ___/ __ \/ __ \/ _ \/ ___/ _ \  / / __ \
// #  ___/ / /_/ /  / /_/ / /_/ /_/ (__  ) /_/ / / / /  __/ /  /  __/ / / /_/ /
// # /____/\__/_/   \__,_/\__/\____/____/ .___/_/ /_/\___/_/   \___(_)_/\____/ 
// #                                   /_/                                     
// ############################################################################
// # Copyright (c) 2024. Sivarajan kakamaniyan. All rights reserved.
// # Statosphere is a product of Sivarajan Kakamaniyan. 
// # Unauthorized copying of this file, via any medium is strictly prohibited.
// # Version 0.1.0 | 2024-06
// ############################################################################


"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  api,
  clearToken,
  type GoalLogOut,
  type GoalOut,
  type NotificationOut,
  type Priority,
  type UserOut,
} from "@/lib/api";
import { BackgroundShell } from "@/components/background-shell";
import { ContactForm } from "@/components/contact-form";
import { CompletedReflectionsTable } from "@/components/completed-reflections-table";
import { EmptyGoalsIllustration } from "@/components/illustrations";
import { MonthPriorityCalendar } from "@/components/month-priority-calendar";
import { ProgressSystem } from "@/components/progress-system";
import { ReflectGoalModal } from "@/components/reflect-goal-modal";
import { TaskDetailModal } from "@/components/task-detail-modal";

const priorities: Priority[] = ["low", "medium", "high"];
type ActionItemView = "list" | "cards";
type ActionFilter = "today" | "upcoming" | "all";
const ACTION_VIEW_KEY = "stratosphere-action-item-view";

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

function getInitials(name: string) {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
}

function getDayEmoji() {
  const hour = new Date().getHours();
  if (hour < 12) return "🌤️";
  if (hour < 17) return "☀️";
  return "🌙";
}

function getSubmitLabel(isSaving: boolean, isTimed: boolean, scheduledFor: string) {
  if (isSaving) return "Saving...";
  if (!isTimed || !scheduledFor) return "Add to today";

  const selectedDate = new Date(scheduledFor);
  const today = new Date();
  const tomorrow = new Date();
  tomorrow.setDate(today.getDate() + 1);

  if (selectedDate.toDateString() === today.toDateString()) return "Add to today";
  if (selectedDate.toDateString() === tomorrow.toDateString()) return "Add to tomorrow";

  return `Add to ${selectedDate.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  })}`;
}

function getGoalEffectiveDate(goal: GoalOut) {
  return new Date(goal.scheduled_for ?? goal.created_at);
}

function getDateKey(date: Date) {
  return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
}

function getDateHeading(date: Date) {
  const today = new Date();
  const tomorrow = new Date();
  tomorrow.setDate(today.getDate() + 1);
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);

  if (date.toDateString() === today.toDateString()) return "Today";
  if (date.toDateString() === tomorrow.toDateString()) return "Tomorrow";
  if (date.toDateString() === yesterday.toDateString()) return "Yesterday";

  return date.toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function groupGoalsByDate(goals: GoalOut[]) {
  const sortedGoals = [...goals].sort((a, b) => {
    const aDate = getGoalEffectiveDate(a).getTime();
    const bDate = getGoalEffectiveDate(b).getTime();
    if (aDate !== bDate) return aDate - bDate;
    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
  });

  return sortedGoals.reduce<Array<{ key: string; label: string; goals: GoalOut[] }>>(
    (groups, goal) => {
      const date = getGoalEffectiveDate(goal);
      const key = date.toDateString();
      const group = groups.find((item) => item.key === key);
      if (group) {
        group.goals.push(goal);
      } else {
        groups.push({ key, label: getDateHeading(date), goals: [goal] });
      }
      return groups;
    },
    [],
  );
}

function filterGoals(goals: GoalOut[], filter: ActionFilter, selectedDateKey: string | null) {
  const today = new Date();
  const todayKey = getDateKey(today);

  return goals.filter((goal) => {
    const goalDate = getGoalEffectiveDate(goal);
    const goalKey = getDateKey(goalDate);
    if (selectedDateKey) return goalKey === selectedDateKey;
    if (filter === "today") return goalKey === todayKey;
    if (filter === "upcoming") return goalDate > today && goalKey !== todayKey;
    return true;
  });
}

export default function DashboardPage() {
  const router = useRouter();
  const [user, setUser] = useState<UserOut | null>(null);
  const [goals, setGoals] = useState<GoalOut[]>([]);
  const [goalLogs, setGoalLogs] = useState<GoalLogOut[]>([]);
  const [notifications, setNotifications] = useState<NotificationOut[]>([]);
  const [unreadNotifications, setUnreadNotifications] = useState(0);
  const [showNotifications, setShowNotifications] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [title, setTitle] = useState("");
  const [notes, setNotes] = useState("");
  const [isTimed, setIsTimed] = useState(false);
  const [scheduledFor, setScheduledFor] = useState("");
  const [priority, setPriority] = useState<Priority>("medium");
  const [activeGoal, setActiveGoal] = useState<GoalOut | null>(null);
  const [detailGoal, setDetailGoal] = useState<GoalOut | null>(null);
  const [completed, setCompleted] = useState(true);
  const [reflection, setReflection] = useState("");
  const [soulful, setSoulful] = useState<boolean | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [actionItemView, setActionItemView] = useState<ActionItemView>("list");
  const [actionFilter, setActionFilter] = useState<ActionFilter>("today");
  const [selectedCalendarDate, setSelectedCalendarDate] = useState<string | null>(null);
  const addCardRef = useRef<HTMLElement>(null);
  const [actionListHeight, setActionListHeight] = useState<number | null>(null);

  useEffect(() => {
    Promise.all([
      api.me(),
      api.goals(),
      api.goalLogs(),
      api.notifications(),
      api.notificationSummary(),
      api.dueNotifications(),
    ])
      .then(([userData, goalData, logData, notificationData, notificationSummary, dueNotificationData]) => {
        setUser(userData);
        setGoals(goalData);
        setGoalLogs(logData);
        setNotifications([
          ...dueNotificationData,
          ...notificationData.filter(
            (notification) =>
              !dueNotificationData.some((dueNotification) => dueNotification.id === notification.id),
          ),
        ]);
        setUnreadNotifications(Math.max(notificationSummary.unread_count, dueNotificationData.length));
      })
      .catch(() => router.push("/login"))
      .finally(() => setLoading(false));
  }, [router]);

  useEffect(() => {
    const savedView = window.localStorage.getItem(ACTION_VIEW_KEY);
    if (savedView === "list" || savedView === "cards") {
      setActionItemView(savedView);
    }
  }, []);

  useEffect(() => {
    const card = addCardRef.current;
    if (!card) return;

    function syncHeight() {
      const currentCard = addCardRef.current;
      if (!currentCard) return;
      if (window.innerWidth < 1024) {
        setActionListHeight(null);
        return;
      }
      setActionListHeight(currentCard.getBoundingClientRect().height);
    }

    syncHeight();
    const observer = new ResizeObserver(syncHeight);
    observer.observe(card);
    window.addEventListener("resize", syncHeight);

    return () => {
      observer.disconnect();
      window.removeEventListener("resize", syncHeight);
    };
  }, [goals.length, isTimed]);

  async function handleLogout() {
    await api.logout().catch(() => undefined);
    clearToken();
    router.push("/");
  }

  async function handleDeleteAccount() {
    const confirmed = window.confirm(
      "Permanently delete your account, tasks, reflections, chats, and support tickets? This cannot be undone.",
    );
    if (!confirmed) return;
    setSaving(true);
    try {
      await api.deleteMe();
      clearToken();
      router.push("/");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Could not delete account");
    } finally {
      setSaving(false);
    }
  }

  async function handleMarkAllNotificationsRead() {
    await api.markAllNotificationsRead();
    setUnreadNotifications(0);
    setNotifications((current) =>
      current.map((notification) => ({
        ...notification,
        read_at: notification.read_at ?? new Date().toISOString(),
      })),
    );
  }

  async function handleAcknowledgeNotification(notification: NotificationOut) {
    const updated = await api.acknowledgeNotification(notification.id);
    setNotifications((current) => current.map((item) => (item.id === updated.id ? updated : item)));
    const summary = await api.notificationSummary();
    setUnreadNotifications(summary.unread_count);
  }

  function handleViewChange(view: ActionItemView) {
    setActionItemView(view);
    window.localStorage.setItem(ACTION_VIEW_KEY, view);
  }

  function handleFilterChange(filter: ActionFilter) {
    setActionFilter(filter);
    setSelectedCalendarDate(null);
  }

  function startReflection(goal: GoalOut) {
    setActiveGoal(goal);
    setCompleted(true);
    setSoulful(true);
  }

  function handleReuseGoal(goal: GoalOut) {
    setTitle(goal.title);
    setNotes(goal.notes ?? "");
    setPriority(goal.priority);
    setIsTimed(false);
    setScheduledFor("");
    addCardRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
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
      const log = await api.createGoalLog(activeGoal.id, {
        completed,
        reflection: reflection.trim(),
        soulful,
      });
      setGoalLogs((current) => [...current, log]);
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

  async function handleUpdateGoal(goal: {
    title: string;
    notes: string | null;
    is_timed: boolean;
    scheduled_for: string | null;
    priority: Priority;
  }) {
    if (!detailGoal) return;
    setError("");
    setSaving(true);
    try {
      const updated = await api.updateGoal(detailGoal.id, goal);
      setGoals((current) => current.map((item) => (item.id === updated.id ? updated : item)));
      setDetailGoal(null);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Could not update action item");
    } finally {
      setSaving(false);
    }
  }

  async function handleDeleteGoal() {
    if (!detailGoal) return;
    setError("");
    setSaving(true);
    try {
      await api.deleteGoal(detailGoal.id);
      setGoals((current) => current.filter((item) => item.id !== detailGoal.id));
      setGoalLogs((current) => current.filter((log) => log.goal_id !== detailGoal.id));
      setDetailGoal(null);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Could not delete action item");
    } finally {
      setSaving(false);
    }
  }

  async function handleDeleteGoalFromList(goalId: string) {
    setError("");
    setSaving(true);
    try {
      await api.deleteGoal(goalId);
      setGoals((current) => current.filter((item) => item.id !== goalId));
      setGoalLogs((current) => current.filter((log) => log.goal_id !== goalId));
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Could not delete action item");
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <p className="text-neutral-500 p-8">Loading...</p>;
  if (!user) return null;

  const visibleGoals = filterGoals(goals, actionFilter, selectedCalendarDate);
  const groupedGoals = groupGoalsByDate(visibleGoals);
  const addressedGoalIds = new Set(
    goalLogs
      .filter((log) => log.completed)
      .map((log) => log.goal_id),
  );
  const latestLogByGoalId = goalLogs.reduce<Record<string, GoalLogOut>>((latestLogs, log) => {
    const current = latestLogs[log.goal_id];
    if (!current || new Date(log.created_at).getTime() > new Date(current.created_at).getTime()) {
      latestLogs[log.goal_id] = log;
    }
    return latestLogs;
  }, {});
  const logCountByGoalId = goalLogs.reduce<Record<string, number>>((counts, log) => {
    counts[log.goal_id] = (counts[log.goal_id] ?? 0) + 1;
    return counts;
  }, {});

  return (
    <BackgroundShell className="min-h-screen text-white" showSwitcher>
      <div className="relative z-10 mx-auto flex w-full max-w-6xl flex-col gap-8 px-4 py-6 sm:px-8 sm:py-10">
        <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-4">
            <button
              type="button"
              onClick={() => setShowSettings(true)}
              className="grid h-14 w-14 shrink-0 place-items-center rounded-lg border border-white/15 bg-neutral-900/80 text-base font-bold shadow-lg shadow-black/20 transition-colors hover:border-sky-500"
              aria-label="Open profile settings"
              title="Profile settings"
            >
              {getInitials(user.name) || "U"}
            </button>
            <div>
              <p className="text-sm text-neutral-400">{getDayEmoji()} Today</p>
              <h1 className="text-2xl font-bold">Hello, {user.name}</h1>
            </div>
          </div>
          <div className="flex flex-wrap gap-3">
            <button
              onClick={() => setShowNotifications((current) => !current)}
              className="relative rounded-lg border border-neutral-700 px-3 py-2 text-sm font-semibold transition-colors hover:border-neutral-500"
              aria-label="Notifications"
            >
              🔔
              {unreadNotifications > 0 ? (
                <span className="absolute -right-2 -top-2 grid h-5 min-w-5 place-items-center rounded-full bg-red-500 px-1 text-[10px] font-black text-white">
                  {Math.min(unreadNotifications, 9)}
                </span>
              ) : null}
            </button>
            <Link
              href="/chat"
              className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold transition-colors hover:bg-indigo-500"
            >
              Life Coach
            </Link>
            <button
              onClick={() => setShowSettings(true)}
              className="rounded-lg border border-neutral-700 px-4 py-2 text-sm font-semibold transition-colors hover:border-neutral-500"
            >
              Settings
            </button>
            <button
              onClick={handleLogout}
              className="rounded-lg border border-neutral-700 px-4 py-2 text-sm font-semibold transition-colors hover:border-neutral-500"
            >
              Sign out
            </button>
          </div>
        </header>

        {showNotifications ? (
          <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 p-4 sm:items-center">
            <button
              className="absolute inset-0 cursor-default"
              aria-label="Close notifications"
              onClick={() => setShowNotifications(false)}
            />
            <section className="relative z-10 max-h-[82vh] w-full max-w-xl rounded-lg border border-white/10 bg-neutral-900 p-5 shadow-2xl shadow-black/50">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h2 className="text-lg font-bold">Notifications</h2>
                  <p className="mt-1 text-sm text-neutral-400">{unreadNotifications} unread updates.</p>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={handleMarkAllNotificationsRead}
                    className="rounded-lg border border-neutral-700 px-3 py-2 text-sm font-semibold transition-colors hover:border-neutral-500"
                  >
                    Read all
                  </button>
                  <button
                    onClick={() => setShowNotifications(false)}
                    className="rounded-lg border border-neutral-700 px-3 py-2 text-sm font-semibold transition-colors hover:border-neutral-500"
                  >
                    Close
                  </button>
                </div>
              </div>
              <div className="mt-4 max-h-[58vh] overflow-y-auto divide-y divide-white/10 pr-1">
                {notifications.length === 0 ? (
                  <p className="py-4 text-sm text-neutral-400">No notifications yet.</p>
                ) : (
                  notifications.slice(0, 20).map((notification) => (
                    <div key={notification.id} className="flex gap-3 py-3">
                      <span
                        className={`mt-1 h-2.5 w-2.5 shrink-0 rounded-full ${
                          notification.read_at ? "bg-neutral-600" : "bg-sky-400"
                        }`}
                      />
                      <div>
                        <p className="text-sm font-bold text-white">{notification.title}</p>
                        <p className="mt-1 text-sm text-neutral-400">{notification.body}</p>
                        <p className="mt-1 text-xs text-neutral-500">
                          {new Date(notification.created_at).toLocaleString()}
                        </p>
                        {notification.category === "reminder" && !notification.acknowledged_at ? (
                          <div className="mt-3 flex gap-2">
                            <button
                              onClick={() => handleAcknowledgeNotification(notification)}
                              className="rounded-md bg-indigo-600 px-3 py-1.5 text-xs font-bold text-white transition-colors hover:bg-indigo-500"
                            >
                              Yes
                            </button>
                            <button
                              onClick={() => handleAcknowledgeNotification(notification)}
                              className="rounded-md border border-neutral-700 px-3 py-1.5 text-xs font-bold text-neutral-200 transition-colors hover:border-neutral-500"
                            >
                              No
                            </button>
                          </div>
                        ) : null}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </section>
          </div>
        ) : null}

        {showSettings ? (
          <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 p-4 sm:items-center">
            <button
              className="absolute inset-0 cursor-default"
              aria-label="Close settings"
              onClick={() => setShowSettings(false)}
            />
            <section className="relative z-10 max-h-[82vh] w-full max-w-2xl overflow-y-auto rounded-lg border border-white/10 bg-neutral-900 p-5 shadow-2xl shadow-black/50">
              <div className="mb-5 flex items-start justify-between gap-4">
                <div>
                  <h2 className="text-lg font-bold">Profile settings</h2>
                  <p className="mt-1 text-sm text-neutral-400">Manage your account details and support requests.</p>
                </div>
                <button
                  onClick={() => setShowSettings(false)}
                  className="rounded-lg border border-neutral-700 px-3 py-2 text-sm font-semibold transition-colors hover:border-neutral-500"
                >
                  Close
                </button>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="rounded-lg border border-white/10 bg-neutral-950/60 p-4">
                  <p className="text-xs font-bold uppercase text-neutral-500">Name</p>
                  <p className="mt-2 break-words text-sm font-semibold text-white">{user.name}</p>
                </div>
                <div className="rounded-lg border border-white/10 bg-neutral-950/60 p-4">
                  <p className="text-xs font-bold uppercase text-neutral-500">Email</p>
                  <p className="mt-2 break-words text-sm font-semibold text-white">{user.email}</p>
                </div>
              </div>
              <div className="mt-6 rounded-lg border border-white/10 bg-neutral-950/60 p-4">
                <h3 className="text-base font-bold">Contact us</h3>
                <p className="mt-1 text-sm text-neutral-400">
                  Raise a ticket from your signed-in account so support requests stay tied to the right user.
                </p>
                <div className="mt-5">
                  <ContactForm defaultName={user.name} defaultEmail={user.email} source="web" />
                </div>
              </div>
              <div className="mt-6 rounded-lg border border-red-900/70 bg-red-950/20 p-4">
                <h3 className="text-base font-bold text-red-200">Delete account</h3>
                <p className="mt-1 text-sm text-neutral-400">
                  Permanently removes your profile, tasks, reflections, chats, notifications, and support tickets.
                </p>
                <button
                  type="button"
                  onClick={handleDeleteAccount}
                  disabled={saving}
                  className="mt-4 rounded-lg border border-red-700 px-4 py-2 text-sm font-semibold text-red-200 hover:bg-red-950/60 disabled:opacity-50"
                >
                  Delete my account
                </button>
              </div>
            </section>
          </div>
        ) : null}

        <section className="rounded-lg border border-white/10 bg-neutral-900/80 p-5 shadow-lg shadow-black/15 backdrop-blur">
          <p className="text-center text-sm italic text-neutral-300">
            ✦ &ldquo;A Success or a Failure in Goal is Defined only by you. Please use this
            data as a helper rather than a definition of what you are.&rdquo;
          </p>
        </section>

        {error && (
          <div className="rounded-lg border border-red-900/60 bg-red-950/40 p-4 text-sm text-red-200">
            {error}
          </div>
        )}

        <div className="grid items-start gap-8 lg:grid-cols-[360px_minmax(0,1fr)]">
          <section
            ref={addCardRef}
            className="rounded-lg border border-white/10 bg-neutral-900/85 p-5 shadow-lg shadow-black/15 backdrop-blur"
          >
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
                          ? priorityMeta[item].classes
                          : "border-neutral-700 bg-neutral-800 text-neutral-300"
                      }`}
                    >
                      <span aria-hidden="true">{priorityMeta[item].emoji}</span>{" "}
                      {priorityMeta[item].label}
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
                {getSubmitLabel(saving, isTimed, scheduledFor)}
              </button>
            </form>

            <MonthPriorityCalendar
              goals={goals}
              selectedDateKey={selectedCalendarDate}
              onDateSelect={(dateKey) => {
                setSelectedCalendarDate((current) => (current === dateKey ? null : dateKey));
                setActionFilter("all");
              }}
            />
          </section>

          <section
            className="flex min-h-0 flex-col overflow-hidden rounded-lg border border-white/10 bg-neutral-900/85 shadow-lg shadow-black/15 backdrop-blur"
            style={actionListHeight ? { height: actionListHeight } : undefined}
          >
            <div className="shrink-0 border-b border-neutral-800 px-5 py-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <h2 className="text-base font-semibold">Today&apos;s Action Items</h2>
                  <p className="mt-1 text-sm text-neutral-500">
                    Mark an item when you are ready, then reflect without judgment.
                  </p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {[
                      { label: "Today", value: "today" },
                      { label: "Upcoming", value: "upcoming" },
                      { label: "All", value: "all" },
                    ].map((item) => (
                      <button
                        key={item.value}
                        type="button"
                        onClick={() => handleFilterChange(item.value as ActionFilter)}
                        className={`rounded-md border px-2.5 py-1 text-xs font-semibold transition ${
                          actionFilter === item.value && !selectedCalendarDate
                            ? "border-indigo-500 bg-indigo-600 text-white"
                            : "border-white/10 bg-neutral-950/40 text-neutral-400 hover:text-white"
                        }`}
                      >
                        {item.label}
                      </button>
                    ))}
                    {selectedCalendarDate && (
                      <button
                        type="button"
                        onClick={() => setSelectedCalendarDate(null)}
                        className="rounded-md border border-indigo-500/60 bg-indigo-950/50 px-2.5 py-1 text-xs font-semibold text-indigo-200"
                      >
                        Clear date
                      </button>
                    )}
                  </div>
                </div>
                <div className="grid grid-cols-2 rounded-lg border border-white/10 bg-neutral-950/50 p-1 text-xs font-semibold">
                  {[
                    { label: "List", value: "list" },
                    { label: "Cards", value: "cards" },
                  ].map((item) => (
                    <button
                      key={item.value}
                      type="button"
                      onClick={() => handleViewChange(item.value as ActionItemView)}
                      className={`rounded-md px-3 py-1.5 transition ${
                        actionItemView === item.value
                          ? "bg-indigo-600 text-white"
                          : "text-neutral-400 hover:text-white"
                      }`}
                    >
                      {item.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
              {visibleGoals.length === 0 ? (
                <div className="flex flex-col items-center px-6 py-10 text-center">
                  <EmptyGoalsIllustration className="mb-4 h-32 w-full max-w-64" />
                  <h3 className="text-sm font-semibold text-neutral-200">No action items here</h3>
                  <p className="mt-2 max-w-sm text-sm text-neutral-500">
                    Change the filter or pick another day from the calendar.
                  </p>
                </div>
              ) : (
                <div className={actionItemView === "cards" ? "space-y-4 p-4" : ""}>
                  {groupedGoals.map((group) => (
                    <section key={group.key}>
                      <div
                        className={`sticky top-0 z-10 border-y border-neutral-800 bg-neutral-900/95 px-5 py-2 text-xs font-semibold uppercase tracking-wide text-neutral-400 backdrop-blur ${
                          actionItemView === "cards" ? "-mx-4 mb-3" : ""
                        }`}
                      >
                        {group.label} <span className="text-neutral-600">({group.goals.length})</span>
                      </div>
                      <div
                        className={
                          actionItemView === "cards"
                            ? "grid gap-3 xl:grid-cols-2"
                            : "divide-y divide-neutral-800"
                        }
                      >
                        {group.goals.map((goal) => {
                          const isAddressed = addressedGoalIds.has(goal.id);
                          const latestLog = latestLogByGoalId[goal.id];
                          const logCount = logCountByGoalId[goal.id] ?? 0;
                          return (
                          <article
                            key={goal.id}
                            className={
                              actionItemView === "cards"
                                ? "rounded-lg border border-white/10 bg-neutral-950/45 p-4"
                                : "p-5"
                            }
                          >
                            <div
                              className={`flex flex-col gap-4 ${
                                actionItemView === "list"
                                  ? "sm:flex-row sm:items-start sm:justify-between"
                                  : ""
                              }`}
                            >
                              <button
                                type="button"
                                onClick={() => router.push(`/tasks/${goal.id}`)}
                                className="min-w-0 text-left"
                              >
                                <div className="flex flex-wrap items-center gap-2">
                                  <h3 className="break-words font-semibold text-white">{goal.title}</h3>
                                  {isAddressed && (
                                    <span className="rounded border border-emerald-700/70 bg-emerald-950/70 px-2 py-0.5 text-xs font-semibold text-emerald-200">
                                      Addressed
                                    </span>
                                  )}
                                  <span className={`rounded border px-2 py-0.5 text-xs ${priorityMeta[goal.priority].classes}`}>
                                    <span aria-hidden="true">{priorityMeta[goal.priority].emoji}</span>{" "}
                                    {priorityMeta[goal.priority].label}
                                  </span>
                                </div>
                                {goal.notes && (
                                  <p className="mt-2 whitespace-pre-wrap break-words text-sm text-neutral-400">
                                    {goal.notes}
                                  </p>
                                )}
                                <p className="mt-3 text-xs text-neutral-500">
                                  {goal.is_timed && goal.scheduled_for
                                    ? `⏰ Timed for ${new Date(goal.scheduled_for).toLocaleString()}`
                                    : "🧭 Moment-based goal"}
                                </p>
                                {latestLog && (
                                  <div className="mt-3 rounded-lg border border-white/10 bg-neutral-950/45 px-3 py-2">
                                    <div className="flex flex-wrap items-center justify-between gap-2">
                                      <p className="text-xs font-semibold uppercase tracking-wide text-neutral-500">
                                        Latest reflection
                                      </p>
                                      <span className="text-xs text-neutral-500">
                                        {logCount} {logCount === 1 ? "entry" : "entries"}
                                      </span>
                                    </div>
                                    <p className="mt-1 line-clamp-2 whitespace-pre-wrap break-words text-sm text-neutral-300">
                                      {latestLog.reflection}
                                    </p>
                                  </div>
                                )}
                              </button>
                              <div
                                className={`flex shrink-0 gap-2 ${
                                  actionItemView === "cards" ? "w-full flex-col" : "sm:flex-col"
                                }`}
                              >
                                <button
                                  type="button"
                                  onClick={() => startReflection(goal)}
                                  className={`rounded-lg bg-neutral-800 px-4 py-2 text-sm font-semibold transition-colors hover:bg-neutral-700 ${
                                    actionItemView === "cards" ? "w-full" : ""
                                  }`}
                              >
                                {isAddressed ? "Re-work" : "Reflect"}
                              </button>
                              <div
                                className={`flex gap-2 ${
                                  actionItemView === "cards" ? "w-full" : "justify-end"
                                }`}
                              >
                                <button
                                  type="button"
                                  onClick={() => setDetailGoal(goal)}
                                  aria-label={`Edit ${goal.title}`}
                                  title="Edit task"
                                  className="grid h-10 w-10 place-items-center rounded-lg border border-neutral-700 text-sm transition-colors hover:border-neutral-500 hover:bg-neutral-800"
                                >
                                  <span aria-hidden="true">✏️</span>
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleDeleteGoalFromList(goal.id)}
                                  disabled={saving}
                                  aria-label={`Delete ${goal.title}`}
                                  title="Delete task"
                                  className="grid h-10 w-10 place-items-center rounded-lg border border-red-900/70 text-sm transition-colors hover:border-red-600 hover:bg-red-950/30 disabled:opacity-50"
                                >
                                  <span aria-hidden="true">🗑️</span>
                                </button>
                              </div>
                              </div>
                            </div>
                          </article>
                          );
                        })}
                      </div>
                    </section>
                  ))}
                </div>
              )}
            </div>
          </section>
        </div>

        <ProgressSystem goals={goals} logs={goalLogs} />
        <CompletedReflectionsTable goals={goals} logs={goalLogs} onReuseGoal={handleReuseGoal} />
      </div>

      {activeGoal && (
        <ReflectGoalModal
          goal={activeGoal}
          completed={completed}
          reflection={reflection}
          soulful={soulful}
          saving={saving}
          onCompletedChange={(value) => {
            setCompleted(value);
            setSoulful(value ? true : false);
          }}
          onReflectionChange={setReflection}
          onSoulfulChange={setSoulful}
          onCancel={() => {
            setActiveGoal(null);
            setReflection("");
          }}
          onSubmit={handleLogGoal}
        />
      )}

      {detailGoal && (
        <TaskDetailModal
          goal={detailGoal}
          saving={saving}
          onClose={() => setDetailGoal(null)}
          onSave={handleUpdateGoal}
          onDelete={handleDeleteGoal}
        />
      )}
    </BackgroundShell>
  );
}
