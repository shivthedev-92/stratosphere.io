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

import { CrisisOverlay } from "@/components/crisis-notice";
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
  type SafetyNoticeOut,
} from "@/lib/api";
import { BackgroundShell } from "@/components/background-shell";
import { ContactForm } from "@/components/contact-form";
import { CompletedReflectionsTable } from "@/components/completed-reflections-table";
import { EmptyGoalsIllustration } from "@/components/illustrations";
import { MonthPriorityCalendar } from "@/components/month-priority-calendar";
import {
  Alarm,
  Bell,
  CaretDown,
  ChatCircleText,
  CheckCircle,
  ClockCounterClockwise,
  Compass,
  PencilSimple,
  Trash,
} from "@phosphor-icons/react";
import { carriedOverLabel, getGoalEffectiveDate, isCarriedOver } from "@/lib/carry-over";
import { DayIcon, PriorityIcon } from "@/components/icons";
import { MotivationalBanner } from "@/components/motivational-banner";
import { TelegramSettings } from "@/components/telegram-settings";
import { ThemeSwitcher } from "@/components/theme";
import { AvatarPicker, UserAvatar } from "@/components/avatar-picker";
import { ProgressSystem } from "@/components/progress-system";
import { ReflectGoalModal } from "@/components/reflect-goal-modal";
import { TaskDetailModal } from "@/components/task-detail-modal";

const priorities: Priority[] = ["low", "medium", "high"];
type ActionItemView = "list" | "cards";
type ActionFilter = "today" | "upcoming" | "all";
const ACTION_VIEW_KEY = "stratosphere-action-item-view";

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

/** Today view: today's items first, then unfinished ones from earlier days (oldest first). */
function groupTodayView(goals: GoalOut[]) {
  const now = new Date();
  const carried = goals.filter((goal) => isCarriedOver(goal, now));
  const today = goals.filter((goal) => !isCarriedOver(goal, now));
  const groups = groupGoalsByDate(today);
  if (carried.length > 0) {
    groups.push({
      key: "still-open",
      label: "Still open",
      goals: [...carried].sort(
        (a, b) => getGoalEffectiveDate(a).getTime() - getGoalEffectiveDate(b).getTime(),
      ),
    });
  }
  return groups;
}

function filterGoals(goals: GoalOut[], filter: ActionFilter, selectedDateKey: string | null) {
  const today = new Date();
  const todayKey = getDateKey(today);

  return goals.filter((goal) => {
    const goalDate = getGoalEffectiveDate(goal);
    const goalKey = getDateKey(goalDate);
    if (selectedDateKey) return goalKey === selectedDateKey;
    // Today also keeps every unfinished task from earlier days, until it is
    // marked complete. A "Done" reflection alone does not take it off.
    if (filter === "today") return goalKey === todayKey || isCarriedOver(goal, today);
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
  const [avatarError, setAvatarError] = useState("");
  // Avatar saves run one at a time: "wanted" is the latest pick, "confirmed"
  // the last value the server accepted. The loop in handleAvatarChange keeps
  // saving until they match, so the final server write is the final pick.
  const avatarWanted = useRef<string | null>(null);
  const avatarConfirmed = useRef<string | null>(null);
  const avatarSaving = useRef(false);
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
  const [expandedReflections, setExpandedReflections] = useState<Set<string>>(() => new Set());
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
        avatarWanted.current = userData.avatar_id;
        avatarConfirmed.current = userData.avatar_id;
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
    // The session cookie is HttpOnly and only the server can clear it, so a
    // failed logout must not look like a successful one.
    try {
      await api.logout();
    } catch {
      setError("Couldn't sign you out. Check your connection and try again.");
      return;
    }
    clearToken();
    router.push("/");
  }

  async function handleAvatarChange(avatarId: string | null) {
    if (!user || avatarId === avatarWanted.current) return;
    avatarWanted.current = avatarId;
    setAvatarError("");
    setUser((current) => (current ? { ...current, avatar_id: avatarId } : current));
    if (avatarSaving.current) return; // the running loop below picks up this pick
    avatarSaving.current = true;
    try {
      while (avatarWanted.current !== avatarConfirmed.current) {
        const target = avatarWanted.current;
        try {
          await api.updateAvatar(target);
          avatarConfirmed.current = target;
        } catch (err: unknown) {
          // A newer pick arrived while this save was failing: try that one.
          if (avatarWanted.current !== target) continue;
          // Roll back to what the server last accepted.
          const confirmed = avatarConfirmed.current;
          avatarWanted.current = confirmed;
          setUser((current) => (current ? { ...current, avatar_id: confirmed } : current));
          setAvatarError(err instanceof Error ? err.message : "Could not save your avatar");
          break;
        }
      }
    } finally {
      avatarSaving.current = false;
    }
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

  const [safetyNotice, setSafetyNotice] = useState<SafetyNoticeOut | null>(null);

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
      // The reflection is already saved; this only surfaces resources.
      if (log.safety) setSafetyNotice(log.safety);
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
      // PATCH replaces every field, so send the icon back or the edit clears it.
      const updated = await api.updateGoal(detailGoal.id, { ...goal, emoji: detailGoal.emoji });
      setGoals((current) => current.map((item) => (item.id === updated.id ? updated : item)));
      setDetailGoal(null);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Could not update action item");
    } finally {
      setSaving(false);
    }
  }

  async function handleSetGoalCompleted(goal: GoalOut, completed: boolean) {
    setError("");
    setSaving(true);
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
      setGoals((current) => current.map((item) => (item.id === updated.id ? updated : item)));
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

  if (loading) return <p className="text-fg-subtle p-8">Loading...</p>;
  if (!user) return null;

  const visibleGoals = filterGoals(goals, actionFilter, selectedCalendarDate);
  const groupedGoals =
    actionFilter === "today" && !selectedCalendarDate
      ? groupTodayView(visibleGoals)
      : groupGoalsByDate(visibleGoals);
  const now = new Date();
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
    <BackgroundShell className="min-h-screen text-fg" showSwitcher>
      <div className="relative z-10 mx-auto flex w-full max-w-6xl flex-col gap-8 px-4 py-6 sm:px-8 sm:py-10">
        <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-4">
            <button
              type="button"
              onClick={() => setShowSettings(true)}
              className={`shrink-0 shadow-lg shadow-tint transition-transform duration-200 ease-calm hover:scale-105 motion-reduce:transition-none motion-reduce:hover:scale-100 ${
                user.avatar_id ? "rounded-full" : "rounded-control"
              }`}
              aria-label="Open profile settings"
              title="Profile settings"
            >
              <UserAvatar avatarId={user.avatar_id} name={user.name} size={56} />
            </button>
            <div>
              <p className="inline-flex items-center gap-1.5 text-sm text-fg-muted">
                <DayIcon /> Today
              </p>
              <h1 className="text-2xl font-bold">Hello, {user.name}</h1>
            </div>
          </div>
          <div className="flex flex-wrap gap-3">
            <button
              onClick={() => setShowNotifications((current) => !current)}
              className="relative rounded-control border border-line-strong px-3 py-2 text-sm font-semibold transition-colors hover:border-fg-subtle"
              aria-label="Notifications"
            >
              <Bell size={18} aria-hidden="true" />
              {unreadNotifications > 0 ? (
                <span className="absolute -right-2 -top-2 grid h-5 min-w-5 place-items-center rounded-full bg-danger px-1 text-[10px] font-black text-white">
                  {Math.min(unreadNotifications, 9)}
                </span>
              ) : null}
            </button>
            <Link
              href="/chat"
              className="rounded-control bg-accent text-white px-4 py-2 text-sm font-semibold transition-colors hover:bg-accent-hover"
            >
              Life Coach
            </Link>
            <button
              onClick={() => setShowSettings(true)}
              className="rounded-control border border-line-strong px-4 py-2 text-sm font-semibold transition-colors hover:border-fg-subtle"
            >
              Settings
            </button>
            <button
              onClick={handleLogout}
              className="rounded-control border border-line-strong px-4 py-2 text-sm font-semibold transition-colors hover:border-fg-subtle"
            >
              Sign out
            </button>
          </div>
        </header>

        {showNotifications ? (
          <div className="fixed inset-0 z-50 flex items-end justify-center bg-scrim p-4 sm:items-center">
            <button
              className="absolute inset-0 cursor-default"
              aria-label="Close notifications"
              onClick={() => setShowNotifications(false)}
            />
            <section className="relative z-10 max-h-[82vh] w-full max-w-xl rounded-panel border border-line bg-surface-solid p-5 shadow-2xl shadow-tint">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h2 className="text-lg font-bold">Notifications</h2>
                  <p className="mt-1 text-sm text-fg-muted">{unreadNotifications} unread updates.</p>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={handleMarkAllNotificationsRead}
                    className="rounded-control border border-line-strong px-3 py-2 text-sm font-semibold transition-colors hover:border-fg-subtle"
                  >
                    Read all
                  </button>
                  <button
                    onClick={() => setShowNotifications(false)}
                    className="rounded-control border border-line-strong px-3 py-2 text-sm font-semibold transition-colors hover:border-fg-subtle"
                  >
                    Close
                  </button>
                </div>
              </div>
              <div className="mt-4 max-h-[58vh] overflow-y-auto divide-y divide-line pr-1">
                {notifications.length === 0 ? (
                  <p className="py-4 text-sm text-fg-muted">No notifications yet.</p>
                ) : (
                  notifications.slice(0, 20).map((notification) => (
                    <div key={notification.id} className="flex gap-3 py-3">
                      <span
                        className={`mt-1 h-2.5 w-2.5 shrink-0 rounded-full ${
                          notification.read_at ? "bg-fg-subtle" : "bg-accent"
                        }`}
                      />
                      <div>
                        <p className="text-sm font-bold text-fg">{notification.title}</p>
                        <p className="mt-1 text-sm text-fg-muted">{notification.body}</p>
                        <p className="mt-1 text-xs text-fg-subtle">
                          {new Date(notification.created_at).toLocaleString()}
                        </p>
                        {notification.category === "reminder" && !notification.acknowledged_at ? (
                          <div className="mt-3 flex gap-2">
                            <button
                              onClick={() => handleAcknowledgeNotification(notification)}
                              className="rounded-md bg-accent px-3 py-1.5 text-xs font-bold text-white transition-colors hover:bg-accent-hover"
                            >
                              Yes
                            </button>
                            <button
                              onClick={() => handleAcknowledgeNotification(notification)}
                              className="rounded-md border border-line-strong px-3 py-1.5 text-xs font-bold text-fg transition-colors hover:border-fg-subtle"
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
          <div className="fixed inset-0 z-50 flex items-end justify-center bg-scrim p-4 sm:items-center">
            <button
              className="absolute inset-0 cursor-default"
              aria-label="Close settings"
              onClick={() => setShowSettings(false)}
            />
            <section className="relative z-10 max-h-[82vh] w-full max-w-2xl overflow-y-auto rounded-panel border border-line bg-surface-solid p-5 shadow-2xl shadow-tint">
              <div className="mb-5 flex items-start justify-between gap-4">
                <div>
                  <h2 className="text-lg font-bold">Profile settings</h2>
                  <p className="mt-1 text-sm text-fg-muted">Manage your account details and support requests.</p>
                </div>
                <button
                  onClick={() => setShowSettings(false)}
                  className="rounded-control border border-line-strong px-3 py-2 text-sm font-semibold transition-colors hover:border-fg-subtle"
                >
                  Close
                </button>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="rounded-card border border-line bg-surface p-4">
                  <p className="text-xs font-bold uppercase text-fg-subtle">Name</p>
                  <p className="mt-2 break-words text-sm font-semibold text-fg">{user.name}</p>
                </div>
                <div className="rounded-card border border-line bg-surface p-4">
                  <p className="text-xs font-bold uppercase text-fg-subtle">Email</p>
                  <p className="mt-2 break-words text-sm font-semibold text-fg">{user.email}</p>
                </div>
              </div>
              <div className="mt-6 rounded-card border border-line bg-field p-4">
                <h3 className="text-base font-bold">Profile avatar</h3>
                <p className="mt-1 text-sm text-fg-muted">
                  Pick a crew helmet or a piece of sky. It shows at the top of your dashboard.
                </p>
                <div className="mt-4">
                  <AvatarPicker value={user.avatar_id} onChange={handleAvatarChange} />
                </div>
                {avatarError ? (
                  <p role="alert" className="mt-3 text-sm text-danger">
                    {avatarError}
                  </p>
                ) : null}
              </div>
              <div className="mt-6 rounded-card border border-line bg-field p-4">
                <h3 className="text-base font-bold">Appearance</h3>
                <p className="mt-1 text-sm text-fg-muted">
                  Night sky or dawn. System follows your device&apos;s light or dark setting.
                </p>
                <ThemeSwitcher className="mt-4 max-w-md" />
              </div>
              <TelegramSettings />
              <div className="mt-6 rounded-card border border-line bg-surface p-4">
                <h3 className="text-base font-bold">Contact us</h3>
                <p className="mt-1 text-sm text-fg-muted">
                  Raise a ticket from your signed-in account so support requests stay tied to the right user.
                </p>
                <div className="mt-5">
                  <ContactForm defaultName={user.name} defaultEmail={user.email} source="web" />
                </div>
              </div>
              <div className="mt-6 rounded-control border border-danger/30 bg-danger-bg p-4">
                <h3 className="text-base font-bold text-danger">Delete account</h3>
                <p className="mt-1 text-sm text-fg-muted">
                  Permanently removes your profile, tasks, reflections, chats, notifications, and support tickets.
                </p>
                <button
                  type="button"
                  onClick={handleDeleteAccount}
                  disabled={saving}
                  className="mt-4 rounded-control border border-danger/30 px-4 py-2 text-sm font-semibold text-danger hover:bg-danger-bg disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  Delete my account
                </button>
              </div>
            </section>
          </div>
        ) : null}

        <MotivationalBanner />

        {error && (
          <div className="rounded-control border border-danger/30 bg-danger-bg p-4 text-sm text-danger">
            {error}
          </div>
        )}

        <div className="grid items-start gap-8 lg:grid-cols-[360px_minmax(0,1fr)]">
          <section
            ref={addCardRef}
            className="rounded-card border border-line bg-surface p-5 shadow-lg shadow-tint backdrop-blur"
          >
            <h2 className="text-base font-semibold">Add Action Item</h2>
            <p className="mt-1 text-sm text-fg-subtle">
              Capture the goal and the moment where it may naturally fit today.
            </p>

            <form onSubmit={handleCreateGoal} className="mt-5 space-y-4">
              <label className="block">
                <span className="mb-1 block text-sm text-fg-muted">Title</span>
                <input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  required
                  maxLength={200}
                  className="w-full rounded-control border border-line-strong bg-field px-3 py-2 text-sm outline-none focus:border-accent"
                  placeholder="Read for 15 minutes"
                />
              </label>

              <label className="block">
                <span className="mb-1 block text-sm text-fg-muted">Specific notes</span>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={4}
                  maxLength={2000}
                  className="w-full resize-none rounded-control border border-line-strong bg-field px-3 py-2 text-sm outline-none focus:border-accent"
                  placeholder="Where, why, or what might get in the way?"
                />
              </label>

              <div>
                <span className="mb-2 block text-sm text-fg-muted">Priority</span>
                <div className="grid grid-cols-3 gap-2">
                  {priorities.map((item) => (
                    <button
                      key={item}
                      type="button"
                      onClick={() => setPriority(item)}
                      className={`h-11 rounded-control border px-3 text-sm capitalize transition-colors ${
                        priority === item
                          ? priorityMeta[item].selected
                          : "border-line-strong bg-field text-fg-muted hover:border-fg-subtle"
                      }`}
                    >
                      <span className="inline-flex items-center gap-1.5">
                        <PriorityIcon priority={item} selected={priority === item} />
                        {priorityMeta[item].label}
                      </span>
                    </button>
                  ))}
                </div>
              </div>

              <label className="flex items-center gap-3 text-sm text-fg-muted">
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
                  className="w-full rounded-control border border-line-strong bg-field px-3 py-2 text-sm outline-none focus:border-accent"
                />
              )}

              <button
                type="submit"
                disabled={saving || !title.trim()}
                className="w-full rounded-control bg-accent px-4 py-3 text-sm font-semibold transition-colors hover:bg-accent-hover disabled:opacity-40 disabled:cursor-not-allowed"
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
            className="flex min-h-0 flex-col overflow-hidden rounded-control border border-line bg-surface shadow-lg shadow-tint backdrop-blur"
            style={actionListHeight ? { height: actionListHeight } : undefined}
          >
            <div className="shrink-0 border-b border-line px-5 py-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <h2 className="text-base font-semibold">Today&apos;s Action Items</h2>
                  <p className="mt-1 text-sm text-fg-subtle">
                    Mark an item when you are ready, then reflect without judgment.
                  </p>
                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    <div role="group" aria-label="Filter action items" className="inline-flex gap-1 rounded-control border border-line bg-field p-1">
                    {[
                      { label: "Today", value: "today" },
                      { label: "Upcoming", value: "upcoming" },
                      { label: "All", value: "all" },
                    ].map((item) => (
                      <button
                        key={item.value}
                        type="button"
                        onClick={() => handleFilterChange(item.value as ActionFilter)}
                        aria-pressed={actionFilter === item.value && !selectedCalendarDate}
                        className={`h-8 rounded-[9px] px-3 text-xs font-semibold transition-colors ${
                          actionFilter === item.value && !selectedCalendarDate
                            ? "bg-accent text-white"
                            : "text-fg-muted hover:text-fg"
                        }`}
                      >
                        {item.label}
                      </button>
                    ))}
                    </div>
                    {selectedCalendarDate && (
                      <button
                        type="button"
                        onClick={() => setSelectedCalendarDate(null)}
                        className="h-8 rounded-control border border-accent/50 bg-accent/10 px-3 text-xs font-semibold text-accent-soft"
                      >
                        Clear date
                      </button>
                    )}
                  </div>
                </div>
                <div role="group" aria-label="Layout" className="grid grid-cols-2 gap-1 rounded-control border border-line bg-field p-1 text-xs font-semibold">
                  {[
                    { label: "List", value: "list" },
                    { label: "Cards", value: "cards" },
                  ].map((item) => (
                    <button
                      key={item.value}
                      type="button"
                      onClick={() => handleViewChange(item.value as ActionItemView)}
                      aria-pressed={actionItemView === item.value}
                      className={`h-8 rounded-[9px] px-3 transition-colors ${
                        actionItemView === item.value
                          ? "bg-accent text-white"
                          : "text-fg-muted hover:text-fg"
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
                  <h3 className="text-sm font-semibold text-fg">No action items here</h3>
                  <p className="mt-2 max-w-sm text-sm text-fg-subtle">
                    Change the filter or pick another day from the calendar.
                  </p>
                </div>
              ) : (
                <div className={actionItemView === "cards" ? "space-y-4 p-4" : ""}>
                  {groupedGoals.map((group) => (
                    <section key={group.key}>
                      <div
                        className={`sticky top-0 z-10 border-y border-line bg-surface-solid px-5 py-2 text-xs font-semibold uppercase tracking-wide text-fg-muted backdrop-blur ${
                          actionItemView === "cards" ? "-mx-4 mb-3" : ""
                        }`}
                      >
                        {group.label} <span className="text-fg-subtle">({group.goals.length})</span>
                      </div>
                      <div
                        className={
                          actionItemView === "cards"
                            ? "grid gap-3 xl:grid-cols-2"
                            : "divide-y divide-line"
                        }
                      >
                        {group.goals.map((goal) => {
                          const isAddressed = addressedGoalIds.has(goal.id);
                          const latestLog = latestLogByGoalId[goal.id];
                          const logCount = logCountByGoalId[goal.id] ?? 0;
                          const reflectionExpanded = expandedReflections.has(goal.id);
                          return (
                          <article
                            key={goal.id}
                            className={
                              actionItemView === "cards"
                                ? "rounded-card border border-line bg-surface p-4"
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
                              <div className="min-w-0">
                              <button
                                type="button"
                                onClick={() => router.push(`/tasks/${goal.id}`)}
                                className="block min-w-0 text-left"
                              >
                                <div className="flex flex-wrap items-center gap-2">
                                  <h3
                                    className={`break-words font-semibold ${
                                      goal.completed ? "text-fg-muted line-through" : "text-fg"
                                    }`}
                                  >
                                    {goal.title}
                                  </h3>
                                  {goal.completed && (
                                    <span className="inline-flex items-center gap-1 rounded border border-accent/30 bg-accent/10 px-2 py-0.5 text-xs font-semibold text-accent-soft">
                                      <CheckCircle size={14} weight="fill" aria-hidden="true" />
                                      Completed
                                    </span>
                                  )}
                                  {!goal.completed && isAddressed && (
                                    <span className="rounded border border-low/30 bg-low-bg px-2 py-0.5 text-xs font-semibold text-low">
                                      Addressed
                                    </span>
                                  )}
                                  <span className={`inline-flex items-center gap-1 rounded-chip px-2.5 py-1 text-[13px] font-semibold ${priorityMeta[goal.priority].chip}`}>
                                    <PriorityIcon priority={goal.priority} size={14} />
                                    {priorityMeta[goal.priority].label}
                                  </span>
                                </div>
                                {goal.notes && (
                                  <p className="mt-2 whitespace-pre-wrap break-words text-sm text-fg-muted">
                                    {goal.notes}
                                  </p>
                                )}
                              </button>
                              <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-fg-subtle">
                                <p className="inline-flex items-center gap-1.5">
                                  {goal.is_timed && goal.scheduled_for ? (
                                    <>
                                      <Alarm size={14} aria-hidden="true" />
                                      Timed for {new Date(goal.scheduled_for).toLocaleString()}
                                    </>
                                  ) : (
                                    <>
                                      <Compass size={14} aria-hidden="true" />
                                      Moment-based goal
                                    </>
                                  )}
                                </p>
                                {isCarriedOver(goal, now) && (
                                  <p className="inline-flex items-center gap-1.5 font-medium text-fg-muted">
                                    <ClockCounterClockwise size={14} aria-hidden="true" />
                                    {carriedOverLabel(goal, now)}
                                  </p>
                                )}
                                {latestLog && (
                                  <button
                                    type="button"
                                    onClick={() =>
                                      setExpandedReflections((prev) => {
                                        const next = new Set(prev);
                                        if (next.has(goal.id)) next.delete(goal.id);
                                        else next.add(goal.id);
                                        return next;
                                      })
                                    }
                                    aria-expanded={reflectionExpanded}
                                    aria-controls={`reflection-${goal.id}`}
                                    className="inline-flex items-center gap-1.5 rounded-control font-semibold transition-colors hover:text-fg"
                                  >
                                    <ChatCircleText size={14} aria-hidden="true" />
                                    {reflectionExpanded ? "Hide" : "Show"} latest reflection
                                    <span className="font-normal">
                                      · {logCount} {logCount === 1 ? "entry" : "entries"}
                                    </span>
                                    <CaretDown
                                      size={12}
                                      aria-hidden="true"
                                      className={`transition-transform ${reflectionExpanded ? "rotate-180" : ""}`}
                                    />
                                  </button>
                                )}
                              </div>
                              {latestLog && (
                                // Stays in the DOM while collapsed so the toggle's
                                // aria-controls always points at a real element.
                                <div
                                  id={`reflection-${goal.id}`}
                                  hidden={!reflectionExpanded}
                                  className="mt-2 rounded-control border border-line bg-surface px-3 py-2"
                                >
                                  <p className="line-clamp-4 whitespace-pre-wrap break-words font-serif text-[15px] italic text-fg-muted">
                                    {latestLog.reflection}
                                  </p>
                                </div>
                              )}
                              </div>
                              <div
                                className={`flex shrink-0 gap-2 ${
                                  actionItemView === "cards" ? "w-full flex-col" : "sm:flex-col"
                                }`}
                              >
                                <button
                                  type="button"
                                  onClick={() => startReflection(goal)}
                                  className={`rounded-control bg-raised px-4 py-2 text-sm font-semibold transition-colors hover:bg-raised/70 ${
                                    actionItemView === "cards" ? "w-full" : ""
                                  }`}
                              >
                                {isAddressed ? "Re-work" : "Reflect"}
                              </button>
                              <button
                                type="button"
                                onClick={() => handleSetGoalCompleted(goal, !goal.completed)}
                                disabled={saving}
                                aria-pressed={goal.completed}
                                className={`inline-flex items-center justify-center gap-1.5 rounded-control border px-4 py-2 text-sm font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${
                                  goal.completed
                                    ? "border-line-strong text-fg-muted hover:bg-raised"
                                    : "border-accent/50 text-accent-soft hover:bg-accent/10"
                                } ${actionItemView === "cards" ? "w-full" : ""}`}
                              >
                                {goal.completed ? (
                                  "Reopen"
                                ) : (
                                  <>
                                    <CheckCircle size={16} aria-hidden="true" />
                                    Mark complete
                                  </>
                                )}
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
                                  className="grid h-10 w-10 place-items-center rounded-control border border-line-strong text-sm transition-colors hover:border-fg-subtle hover:bg-raised"
                                >
                                  <PencilSimple size={18} aria-hidden="true" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleDeleteGoalFromList(goal.id)}
                                  disabled={saving}
                                  aria-label={`Delete ${goal.title}`}
                                  title="Delete task"
                                  className="grid h-10 w-10 place-items-center rounded-control border border-danger/30 text-sm transition-colors hover:border-danger hover:bg-danger-bg disabled:opacity-40 disabled:cursor-not-allowed"
                                >
                                  <Trash size={18} aria-hidden="true" />
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

      {safetyNotice && (
        <CrisisOverlay notice={safetyNotice} onClose={() => setSafetyNotice(null)} />
      )}

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
