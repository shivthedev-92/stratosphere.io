import type { EmotionLabel, GoalLogOut, GoalOut } from "../api";

export const EMOTION_OPTIONS: Array<{ label: string; value: EmotionLabel }> = [
  { label: "Happy", value: "happy" },
  { label: "Sad", value: "sad" },
  { label: "Excited", value: "excited" },
  { label: "Calm", value: "calm" },
  { label: "Anxious", value: "anxious" },
  { label: "Overwhelmed", value: "overwhelmed" },
  { label: "Hopeful", value: "hopeful" },
  { label: "Tired", value: "tired" },
  { label: "Unable to describe", value: "unable_to_describe" },
  { label: "Other", value: "other" },
];

export const NEGATIVE_EMOTIONS = new Set<EmotionLabel>(["sad", "anxious", "overwhelmed", "tired"]);

export const COUNTRY_CODE_OPTIONS = [
  { label: "India", value: "+91" },
  { label: "US/Canada", value: "+1" },
  { label: "UK", value: "+44" },
  { label: "UAE", value: "+971" },
  { label: "Australia", value: "+61" },
];

export const WEEKDAY_LABELS = ["S", "M", "T", "W", "T", "F", "S"];

export function getDateKey(value: string | null) {
  const date = value ? new Date(value) : new Date();
  return getDateKeyFromDate(date);
}

export function getDateKeyFromDate(date: Date) {
  return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
}

export function getGoalDate(goal: GoalOut) {
  return goal.scheduled_for ?? goal.created_at;
}

export function formatGoalTime(goal: GoalOut) {
  if (!goal.is_timed || !goal.scheduled_for) return "Moment-based";
  return new Date(goal.scheduled_for).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function formatLogDate(value: string) {
  return new Date(value).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function formatRelativeDate(value: string) {
  const date = new Date(value);
  const days = Math.floor((Date.now() - date.getTime()) / 86_400_000);
  if (days <= 0) return "Today";
  if (days === 1) return "Yesterday";
  if (days < 7) return `${days} days ago`;
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

export function formatMonthLabel(date: Date) {
  return date.toLocaleDateString(undefined, { month: "long", year: "numeric" });
}

export function formatDayTitle(date: Date) {
  return date.toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" });
}

export function formatTodayEyebrow(date = new Date()) {
  return date.toLocaleDateString(undefined, { weekday: "long", month: "short", day: "numeric" });
}

export function getCalendarDays(monthDate: Date) {
  const firstDay = new Date(monthDate.getFullYear(), monthDate.getMonth(), 1);
  const gridStart = new Date(firstDay);
  gridStart.setDate(firstDay.getDate() - firstDay.getDay());

  return Array.from({ length: 42 }, (_, index) => {
    const date = new Date(gridStart);
    date.setDate(gridStart.getDate() + index);
    return {
      date,
      dateKey: getDateKeyFromDate(date),
      isCurrentMonth: date.getMonth() === monthDate.getMonth(),
    };
  });
}

/** YYYY-MM-DD in local time. */
export function formatDateInput(date: Date) {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function parseDateInput(value: string, fallback = new Date()) {
  if (!value) return fallback;
  const [year, month, day] = value.split("-").map(Number);
  if (!year || !month || !day) return fallback;
  return new Date(year, month - 1, day);
}

export function formatTimeInput(date: Date) {
  const hours = `${date.getHours()}`.padStart(2, "0");
  const minutes = `${date.getMinutes()}`.padStart(2, "0");
  return `${hours}:${minutes}`;
}

export function parseTimeInput(value: string) {
  const [hours, minutes] = value.split(":").map(Number);
  const date = new Date();
  date.setHours(Number.isFinite(hours) ? hours : 9, Number.isFinite(minutes) ? minutes : 0, 0, 0);
  return date;
}

export function formatScheduledFor(dateValue: string, timeValue: string) {
  return `${dateValue}T${timeValue || "09:00"}:00`;
}

export function getTaskScheduledDate(goal: GoalOut) {
  return goal.is_timed && goal.scheduled_for ? formatDateInput(new Date(goal.scheduled_for)) : "";
}

export function getTaskScheduledTime(goal: GoalOut) {
  return goal.is_timed && goal.scheduled_for ? formatTimeInput(new Date(goal.scheduled_for)) : "09:00";
}

export function getCountryCodeOption(value: string) {
  return COUNTRY_CODE_OPTIONS.find((option) => option.value === value) ?? COUNTRY_CODE_OPTIONS[0];
}

export function splitPhoneNumber(value: string | null) {
  const trimmed = value?.trim() ?? "";
  const matchedCode = COUNTRY_CODE_OPTIONS.find((option) => trimmed.startsWith(option.value));
  if (!matchedCode) {
    return { countryCode: "+91", localPhone: trimmed.replace(/[^\d]/g, "") };
  }
  return {
    countryCode: matchedCode.value,
    localPhone: trimmed.slice(matchedCode.value.length).replace(/[^\d]/g, ""),
  };
}

export function formatPhoneForStorage(countryCode: string, localPhone: string) {
  const digits = localPhone.replace(/[^\d]/g, "");
  return digits ? `${countryCode}${digits}` : null;
}

export function formatPhoneDisplay(value: string | null) {
  if (!value) return "Not added";
  const parsed = splitPhoneNumber(value);
  return parsed.localPhone ? `${parsed.countryCode} ${parsed.localPhone}` : value;
}

export function formatDobDisplay(value: string | null) {
  if (!value) return "Not added";
  return parseDateInput(value).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

export function getLogMeaning(log: GoalLogOut) {
  if (log.soulful === true) return "Meaningful";
  if (log.soulful === false) return "Not meaningful";
  return "Unsure";
}

export function getEmotionLabel(value: EmotionLabel | null) {
  if (!value) return null;
  return EMOTION_OPTIONS.find((option) => option.value === value)?.label ?? value;
}
