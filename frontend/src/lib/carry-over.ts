/**
 * Carry-over: an unfinished task stays on Today until the user marks it
 * complete. Reflecting on a task (even with "Done") does not complete it;
 * only `goal.completed` does.
 *
 * All dates are compared in the user's local time, which is what "today"
 * means to them. Pure functions; `now` is a parameter so they can be tested.
 */

type CarryOverGoal = {
  scheduled_for: string | null;
  created_at: string;
  completed: boolean;
};

const DAY_MS = 86_400_000;

/** The day a task belongs to: its scheduled time, else when it was created. */
export function getGoalEffectiveDate(goal: Pick<CarryOverGoal, "scheduled_for" | "created_at">) {
  return new Date(goal.scheduled_for ?? goal.created_at);
}

function startOfDay(date: Date) {
  const day = new Date(date);
  day.setHours(0, 0, 0, 0);
  return day;
}

/** True for an incomplete task whose day is before today. */
export function isCarriedOver(goal: CarryOverGoal, now: Date = new Date()) {
  return !goal.completed && getGoalEffectiveDate(goal) < startOfDay(now);
}

/** Whole calendar days between the task's day and today. */
export function daysOpen(goal: CarryOverGoal, now: Date = new Date()) {
  const diff = startOfDay(now).getTime() - startOfDay(getGoalEffectiveDate(goal)).getTime();
  // Round, not floor: a day across a daylight-saving change is 23 or 25 hours.
  return Math.round(diff / DAY_MS);
}

/** Gentle wording for a carried task. Never "overdue". */
export function carriedOverLabel(goal: CarryOverGoal, now: Date = new Date()) {
  const days = daysOpen(goal, now);
  if (days <= 1) return "Open since yesterday";
  const since = getGoalEffectiveDate(goal).toLocaleDateString(
    undefined,
    days < 7 ? { weekday: "short" } : { month: "short", day: "numeric" },
  );
  return `Open since ${since} · ${days} days`;
}
