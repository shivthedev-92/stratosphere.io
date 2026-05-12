import { StatusBar } from "expo-status-bar";
import * as SecureStore from "expo-secure-store";
import DateTimePicker from "@react-native-community/datetimepicker";
import { FormEvent, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Keyboard,
  KeyboardAvoidingView,
  ImageBackground,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableWithoutFeedback,
  View,
} from "react-native";
import { SafeAreaProvider, SafeAreaView } from "react-native-safe-area-context";
import {
  api,
  type ChatMessage,
  type ChatSessionOut,
  type EmotionLabel,
  type GoalLogOut,
  type GoalOut,
  type NotificationOut,
  type Priority,
  type UserOut,
} from "./src/api";
import { API_BASE_URL } from "./src/config";

const TOKEN_KEY = "stratosphere_access_token";
const THEME_KEY = "stratosphere_mobile_theme";
const APP_BACKGROUND_IMAGE = require("./assets/app-background.jpg");
const THEME_OPTIONS = [
  {
    label: "Dusk",
    value: "dusk",
    image: APP_BACKGROUND_IMAGE,
    overlay: "rgba(10, 10, 10, 0.78)",
    imageOpacity: 0.34,
    swatch: "#f9a8d4",
  },
  {
    label: "Dark",
    value: "dark",
    image: null,
    overlay: "#0a0a0a",
    imageOpacity: 0,
    swatch: "#171717",
  },
  {
    label: "Blue",
    value: "blue",
    image: null,
    overlay: "#07111f",
    imageOpacity: 0,
    swatch: "#2563eb",
  },
] as const;
type ThemeValue = (typeof THEME_OPTIONS)[number]["value"];
const EMOTION_OPTIONS: Array<{ label: string; value: EmotionLabel }> = [
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
const PRIORITY_OPTIONS: Array<{ label: string; value: Priority }> = [
  { label: "Low", value: "low" },
  { label: "Medium", value: "medium" },
  { label: "High", value: "high" },
];
const PRIORITY_DOT_COLORS: Record<Priority, string> = {
  high: "#f59e0b",
  medium: "#38bdf8",
  low: "#10b981",
};
const PRIORITY_BADGE_STYLES: Record<Priority, { backgroundColor: string; borderColor: string; color: string; emoji: string; label: string }> = {
  low: {
    backgroundColor: "#022c22",
    borderColor: "#047857",
    color: "#a7f3d0",
    emoji: "🌱",
    label: "Low",
  },
  medium: {
    backgroundColor: "#082f49",
    borderColor: "#0369a1",
    color: "#bae6fd",
    emoji: "⚡",
    label: "Medium",
  },
  high: {
    backgroundColor: "#451a03",
    borderColor: "#b45309",
    color: "#fde68a",
    emoji: "🔥",
    label: "High",
  },
};
const WEEKDAY_LABELS = ["S", "M", "T", "W", "T", "F", "S"];
const TASK_EMOJI_OPTIONS = ["✨", "🧠", "💪", "📚", "🏃", "💼", "🏠", "❤️", "💡", "🎯"];
const COUNTRY_CODE_OPTIONS = [
  { label: "India", value: "+91" },
  { label: "US/Canada", value: "+1" },
  { label: "UK", value: "+44" },
  { label: "UAE", value: "+971" },
  { label: "Australia", value: "+61" },
];
const COACH_STARTER_PROMPTS = [
  "Help me choose what to focus on next.",
  "What pattern do you see in my recent reflections?",
  "Help me make today's action items feel lighter.",
];

function getDateKey(value: string | null) {
  const date = value ? new Date(value) : new Date();
  return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
}

function getDateKeyFromDate(date: Date) {
  return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
}

function getGoalDate(goal: GoalOut) {
  return goal.scheduled_for ?? goal.created_at;
}

function formatGoalDate(goal: GoalOut) {
  if (!goal.is_timed || !goal.scheduled_for) return "Moment-based";
  return new Date(goal.scheduled_for).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function formatLogDate(value: string) {
  return new Date(value).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function formatMonthLabel(date: Date) {
  return date.toLocaleDateString(undefined, {
    month: "long",
    year: "numeric",
  });
}

function formatSelectedDateLabel(date: Date) {
  return date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
}

function getCalendarDays(monthDate: Date) {
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

function formatDateInput(date: Date) {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function getDatePickerValue(value: string) {
  if (!value) return new Date(1995, 0, 1);
  const [year, month, day] = value.split("-").map(Number);
  if (!year || !month || !day) return new Date(1995, 0, 1);
  return new Date(year, month - 1, day);
}

function getTaskDatePickerValue(value: string) {
  return value ? getDatePickerValue(value) : new Date();
}

function formatTimeInput(date: Date) {
  const hours = `${date.getHours()}`.padStart(2, "0");
  const minutes = `${date.getMinutes()}`.padStart(2, "0");
  return `${hours}:${minutes}`;
}

function getTimePickerValue(value: string) {
  const [hours, minutes] = value.split(":").map(Number);
  const date = new Date();
  date.setHours(Number.isFinite(hours) ? hours : 9, Number.isFinite(minutes) ? minutes : 0, 0, 0);
  return date;
}

function formatTaskScheduledForDate(dateValue: string, timeValue: string) {
  return `${dateValue}T${timeValue || "09:00"}:00`;
}

function getTaskScheduledDate(goal: GoalOut) {
  return goal.is_timed && goal.scheduled_for ? formatDateInput(new Date(goal.scheduled_for)) : "";
}

function getTaskScheduledTime(goal: GoalOut) {
  return goal.is_timed && goal.scheduled_for ? formatTimeInput(new Date(goal.scheduled_for)) : "09:00";
}

function getCountryCodeOption(value: string) {
  return COUNTRY_CODE_OPTIONS.find((option) => option.value === value) ?? COUNTRY_CODE_OPTIONS[0];
}

function splitPhoneNumber(value: string | null) {
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

function formatPhoneForStorage(countryCode: string, localPhone: string) {
  const digits = localPhone.replace(/[^\d]/g, "");
  return digits ? `${countryCode}${digits}` : null;
}

function formatPhoneDisplay(value: string | null) {
  if (!value) return "Not added";
  const parsedPhone = splitPhoneNumber(value);
  return parsedPhone.localPhone ? `${parsedPhone.countryCode} ${parsedPhone.localPhone}` : value;
}

function formatDobDisplay(value: string | null) {
  if (!value) return "Not added";
  return getDatePickerValue(value).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function getLogMeaning(log: GoalLogOut) {
  if (log.soulful === true) return "Meaningful";
  if (log.soulful === false) return "Not meaningful";
  return "Unsure";
}

function getEmotionLabel(value: EmotionLabel | null) {
  if (!value) return null;
  return EMOTION_OPTIONS.find((option) => option.value === value)?.label ?? value;
}

function getTaskEmoji(goal: GoalOut) {
  return goal.emoji || "✨";
}

function getPriorityBadgeStyle(priority: Priority) {
  const meta = PRIORITY_BADGE_STYLES[priority];
  return {
    backgroundColor: meta.backgroundColor,
    borderColor: meta.borderColor,
    color: meta.color,
  };
}

function getPriorityLabel(priority: Priority) {
  const meta = PRIORITY_BADGE_STYLES[priority];
  return `${meta.emoji} ${meta.label}`;
}

function getTaskStatus(goal: GoalOut) {
  if (!goal.completed) {
    return {
      icon: "○",
      style: {
        backgroundColor: "#171717",
        borderColor: "#404040",
        color: "#d4d4d4",
      },
    };
  }
  return {
    icon: "✓",
    style: {
      backgroundColor: "#052e16",
      borderColor: "#16a34a",
      color: "#bbf7d0",
    },
  };
}

export default function App() {
  const [booting, setBooting] = useState(true);
  const [token, setToken] = useState<string | null>(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [user, setUser] = useState<UserOut | null>(null);
  const [goals, setGoals] = useState<GoalOut[]>([]);
  const [allGoalLogs, setAllGoalLogs] = useState<GoalLogOut[]>([]);
  const [notifications, setNotifications] = useState<NotificationOut[]>([]);
  const [unreadNotifications, setUnreadNotifications] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [backendOnline, setBackendOnline] = useState<boolean | null>(null);
  const [themeValue, setThemeValue] = useState<ThemeValue>("dusk");
  const [selectedGoal, setSelectedGoal] = useState<GoalOut | null>(null);
  const [dayViewDate, setDayViewDate] = useState<Date | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [showAssistant, setShowAssistant] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [goalLogs, setGoalLogs] = useState<GoalLogOut[]>([]);
  const [logsLoading, setLogsLoading] = useState(false);
  const [reflection, setReflection] = useState("");
  const [completed, setCompleted] = useState(true);
  const [soulful, setSoulful] = useState<boolean | null>(true);
  const [taskFilter, setTaskFilter] = useState<"today" | "all" | "completed">("today");
  const [analyticsTab, setAnalyticsTab] = useState<"progress" | "reflections">("progress");
  const [calendarMonth, setCalendarMonth] = useState(() => new Date());
  const [selectedCalendarDate, setSelectedCalendarDate] = useState(() => new Date());
  const [emotionLabel, setEmotionLabel] = useState<EmotionLabel | null>(null);
  const [taskTitle, setTaskTitle] = useState("");
  const [taskEmoji, setTaskEmoji] = useState("✨");
  const [taskNotes, setTaskNotes] = useState("");
  const [taskPriority, setTaskPriority] = useState<Priority>("medium");
  const [taskScheduledDate, setTaskScheduledDate] = useState("");
  const [taskScheduledTime, setTaskScheduledTime] = useState("09:00");
  const [showTaskDatePicker, setShowTaskDatePicker] = useState(false);
  const [showTaskTimePicker, setShowTaskTimePicker] = useState(false);
  const [showDashboardAddTask, setShowDashboardAddTask] = useState(false);
  const [showDayAddTask, setShowDayAddTask] = useState(false);
  const [editingGoal, setEditingGoal] = useState(false);
  const [showReflectionForm, setShowReflectionForm] = useState(false);
  const [editingProfile, setEditingProfile] = useState(false);
  const [profileName, setProfileName] = useState("");
  const [profileCountryCode, setProfileCountryCode] = useState("+91");
  const [profileLocalPhone, setProfileLocalPhone] = useState("");
  const [profileDob, setProfileDob] = useState("");
  const [profileNotificationsEnabled, setProfileNotificationsEnabled] = useState(true);
  const [showDobPicker, setShowDobPicker] = useState(false);
  const [showCountryCodeMenu, setShowCountryCodeMenu] = useState(false);
  const [chatHistory, setChatHistory] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [chatLoading, setChatLoading] = useState(false);
  const [chatError, setChatError] = useState("");
  const [chatSessions, setChatSessions] = useState<ChatSessionOut[]>([]);
  const [activeChatSessionId, setActiveChatSessionId] = useState<string | null>(null);
  const [activeChatGoalId, setActiveChatGoalId] = useState<string | null>(null);
  const [supportSubject, setSupportSubject] = useState("");
  const [supportMessage, setSupportMessage] = useState("");
  const [supportStatus, setSupportStatus] = useState("");
  const [supportError, setSupportError] = useState("");
  const [supportSaving, setSupportSaving] = useState(false);

  const todayGoals = useMemo(() => {
    const todayKey = getDateKey(null);
    return goals.filter((goal) => getDateKey(getGoalDate(goal)) === todayKey);
  }, [goals]);
  const selectedDateKey = getDateKeyFromDate(selectedCalendarDate);
  const selectedDateGoals = useMemo(() => {
    return goals.filter((goal) => getDateKey(getGoalDate(goal)) === selectedDateKey);
  }, [goals, selectedDateKey]);
  const goalsByDateKey = useMemo(() => {
    return goals.reduce<Record<string, GoalOut[]>>((groupedGoals, goal) => {
      const dateKey = getDateKey(getGoalDate(goal));
      groupedGoals[dateKey] = [...(groupedGoals[dateKey] ?? []), goal];
      return groupedGoals;
    }, {});
  }, [goals]);
  const calendarDays = useMemo(() => getCalendarDays(calendarMonth), [calendarMonth]);
  const latestLogByGoalId = useMemo(() => {
    return allGoalLogs.reduce<Record<string, GoalLogOut>>((latestLogs, log) => {
      const current = latestLogs[log.goal_id];
      if (!current || new Date(log.created_at).getTime() > new Date(current.created_at).getTime()) {
        latestLogs[log.goal_id] = log;
      }
      return latestLogs;
    }, {});
  }, [allGoalLogs]);
  const completedGoals = useMemo(() => {
    return goals.filter((goal) => goal.completed);
  }, [goals]);
  const visibleGoals =
    taskFilter === "today" ? todayGoals : taskFilter === "completed" ? completedGoals : goals;
  const recentGoalLogs = useMemo(() => {
    return [...allGoalLogs]
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
      .slice(0, 5);
  }, [allGoalLogs]);
  const goalsById = useMemo(() => new Map(goals.map((goal) => [goal.id, goal])), [goals]);
  const activeTheme = THEME_OPTIONS.find((option) => option.value === themeValue) ?? THEME_OPTIONS[0];
  const completedGoalCount = goals.filter((goal) => goal.completed).length;
  const openGoalCount = Math.max(goals.length - completedGoalCount, 0);
  const reflectionChartData = useMemo(() => {
    return Array.from({ length: 7 }, (_, index) => {
      const date = new Date();
      date.setDate(date.getDate() - (6 - index));
      const dateKey = getDateKeyFromDate(date);
      return {
        count: allGoalLogs.filter((log) => getDateKey(log.created_at) === dateKey).length,
        label: date.toLocaleDateString(undefined, { weekday: "short" }),
      };
    });
  }, [allGoalLogs]);

  async function loadDashboard(nextToken: string) {
    setLoading(true);
    setError("");
    try {
      const [userData, goalData, logData, notificationData, notificationSummary, dueNotificationData, chatSessionData] = await Promise.all([
        api.me(nextToken),
        api.goals(nextToken),
        api.goalLogs(nextToken),
        api.notifications(nextToken),
        api.notificationSummary(nextToken),
        api.dueNotifications(nextToken),
        api.chatSessions(nextToken),
      ]);
      setUser(userData);
      const parsedPhone = splitPhoneNumber(userData.phone_number);
      setProfileName(userData.name);
      setProfileCountryCode(parsedPhone.countryCode);
      setProfileLocalPhone(parsedPhone.localPhone);
      setProfileDob(userData.date_of_birth ?? "");
      setProfileNotificationsEnabled(userData.in_app_notifications_enabled);
      setGoals(goalData);
      setAllGoalLogs(logData);
      const mergedNotifications = [
        ...dueNotificationData,
        ...notificationData.filter(
          (notification) => !dueNotificationData.some((dueNotification) => dueNotification.id === notification.id),
        ),
      ];
      setNotifications(mergedNotifications);
      setUnreadNotifications(Math.max(notificationSummary.unread_count, dueNotificationData.length));
      setChatSessions(chatSessionData);
      setToken(nextToken);
      await SecureStore.setItemAsync(TOKEN_KEY, nextToken);
    } catch (err) {
      await SecureStore.deleteItemAsync(TOKEN_KEY);
      setToken(null);
      setUser(null);
      setGoals([]);
      setAllGoalLogs([]);
      setNotifications([]);
      setUnreadNotifications(0);
      setChatSessions([]);
      setChatHistory([]);
      setActiveChatSessionId(null);
      setActiveChatGoalId(null);
      setSelectedGoal(null);
      setGoalLogs([]);
      setError(err instanceof Error ? err.message : "Could not load dashboard.");
    } finally {
      setLoading(false);
    }
  }

  async function checkBackend() {
    try {
      const response = await api.health();
      setBackendOnline(response.ok);
    } catch {
      setBackendOnline(false);
    }
  }

  useEffect(() => {
    async function restoreSession() {
      await checkBackend();
      const savedTheme = await SecureStore.getItemAsync(THEME_KEY);
      if (savedTheme && THEME_OPTIONS.some((option) => option.value === savedTheme)) {
        setThemeValue(savedTheme as ThemeValue);
      }
      const savedToken = await SecureStore.getItemAsync(TOKEN_KEY);
      if (savedToken) {
        await loadDashboard(savedToken);
      }
      setBooting(false);
    }

    restoreSession();
  }, []);

  async function handleThemeChange(nextTheme: ThemeValue) {
    setThemeValue(nextTheme);
    await SecureStore.setItemAsync(THEME_KEY, nextTheme);
  }

  async function handleLogin(e?: FormEvent) {
    e?.preventDefault();
    if (!email.trim() || !password) return;

    setLoading(true);
    setError("");
    try {
      const auth = await api.login(email.trim(), password);
      await loadDashboard(auth.access_token);
      setPassword("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not sign in.");
    } finally {
      setLoading(false);
    }
  }

  async function handleSignOut() {
    await SecureStore.deleteItemAsync(TOKEN_KEY);
    setToken(null);
    setUser(null);
    setGoals([]);
    setAllGoalLogs([]);
    setNotifications([]);
    setUnreadNotifications(0);
    setChatSessions([]);
    setChatHistory([]);
    setActiveChatSessionId(null);
    setActiveChatGoalId(null);
    setShowAssistant(false);
    setSelectedGoal(null);
    setGoalLogs([]);
    setPassword("");
    setError("");
  }

  async function handleSaveProfile() {
    if (!token || !profileName.trim()) return;
    setLoading(true);
    setError("");
    try {
      const updated = await api.updateMe(token, {
        name: profileName.trim(),
        phone_number: formatPhoneForStorage(profileCountryCode, profileLocalPhone),
        date_of_birth: profileDob || null,
        in_app_notifications_enabled: profileNotificationsEnabled,
      });
      setUser(updated);
      setProfileNotificationsEnabled(updated.in_app_notifications_enabled);
      setEditingProfile(false);
      setShowCountryCodeMenu(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not update profile.");
    } finally {
      setLoading(false);
    }
  }

  async function handleRefresh() {
    if (!token) return;
    await loadDashboard(token);
  }

  function resetTaskForm() {
    setTaskTitle("");
    setTaskEmoji("✨");
    setTaskNotes("");
    setTaskPriority("medium");
    setTaskScheduledDate("");
    setTaskScheduledTime("09:00");
    setShowTaskDatePicker(false);
    setShowTaskTimePicker(false);
  }

  async function handleCreateTask() {
    if (!token || !taskTitle.trim()) return;
    setLoading(true);
    setError("");
    try {
      await api.createGoal(token, {
        title: taskTitle.trim(),
        emoji: taskEmoji,
        notes: taskNotes.trim() || null,
        is_timed: Boolean(taskScheduledDate),
        scheduled_for: taskScheduledDate ? formatTaskScheduledForDate(taskScheduledDate, taskScheduledTime) : null,
        priority: taskPriority,
      });
      const createdTaskDate = taskScheduledDate;
      resetTaskForm();
      await loadDashboard(token);
      setShowDashboardAddTask(false);
      setShowDayAddTask(false);
      if (createdTaskDate) {
        setSelectedCalendarDate(getDatePickerValue(createdTaskDate));
        setCalendarMonth(getDatePickerValue(createdTaskDate));
        setTaskFilter("all");
      } else {
        setTaskFilter("all");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not create task.");
    } finally {
      setLoading(false);
    }
  }

  function fillTaskForm(goal: GoalOut) {
    setTaskTitle(goal.title);
    setTaskEmoji(getTaskEmoji(goal));
    setTaskNotes(goal.notes ?? "");
    setTaskPriority(goal.priority);
    setTaskScheduledDate(getTaskScheduledDate(goal));
    setTaskScheduledTime(getTaskScheduledTime(goal));
    setShowTaskDatePicker(false);
    setShowTaskTimePicker(false);
  }

  async function openGoal(goal: GoalOut, mode: "view" | "edit" = "view") {
    if (!token) return;
    setSelectedGoal(goal);
    setEditingGoal(mode === "edit");
    setShowReflectionForm(false);
    if (mode === "edit") fillTaskForm(goal);
    setLogsLoading(true);
    setError("");
    try {
      const logs = await api.goalLogsForGoal(token, goal.id);
      setGoalLogs(logs);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load journal entries.");
    } finally {
      setLogsLoading(false);
    }
  }

  async function handleAddReflection() {
    if (!token || !selectedGoal || !reflection.trim()) return;
    if (selectedGoal.completed) {
      setError("Completed tasks cannot receive new reflections.");
      return;
    }
    setLogsLoading(true);
    setError("");
    try {
      const log = await api.createGoalLog(token, selectedGoal.id, {
        completed: false,
        reflection: reflection.trim(),
        soulful,
        emotion_label: emotionLabel,
      });
      setGoalLogs((current) => [log, ...current]);
      setReflection("");
      setCompleted(true);
      setSoulful(true);
      setEmotionLabel(null);
      setShowReflectionForm(false);
      await loadDashboard(token);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save journal entry.");
    } finally {
      setLogsLoading(false);
    }
  }

  function closeGoal() {
    setSelectedGoal(null);
    setGoalLogs([]);
    setReflection("");
    setCompleted(true);
    setSoulful(true);
    setEmotionLabel(null);
    setEditingGoal(false);
    setShowReflectionForm(false);
    resetTaskForm();
    setError("");
  }

  function beginEditGoal() {
    if (!selectedGoal) return;
    setEditingGoal(true);
    setShowReflectionForm(false);
    fillTaskForm(selectedGoal);
  }

  async function handleSaveTaskEdit() {
    if (!token || !selectedGoal || !taskTitle.trim()) return;
    setLoading(true);
    setError("");
    try {
      const updated = await api.updateGoal(token, selectedGoal.id, {
        title: taskTitle.trim(),
        emoji: taskEmoji,
        notes: taskNotes.trim() || null,
        is_timed: Boolean(taskScheduledDate),
        scheduled_for: taskScheduledDate ? formatTaskScheduledForDate(taskScheduledDate, taskScheduledTime) : null,
        priority: taskPriority,
      });
      setSelectedGoal(updated);
      setEditingGoal(false);
      resetTaskForm();
      await loadDashboard(token);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not update task.");
    } finally {
      setLoading(false);
    }
  }

  async function handleDeleteTask() {
    if (!token || !selectedGoal) return;
    await handleDeleteGoal(selectedGoal);
  }

  async function handleSetTaskCompleted(nextCompleted: boolean) {
    if (!token || !selectedGoal || loading) return;
    setLoading(true);
    setError("");
    try {
      const updated = await api.updateGoal(token, selectedGoal.id, {
        title: selectedGoal.title,
        emoji: selectedGoal.emoji,
        notes: selectedGoal.notes,
        is_timed: selectedGoal.is_timed,
        scheduled_for: selectedGoal.scheduled_for,
        priority: selectedGoal.priority,
        completed: nextCompleted,
      });
      setSelectedGoal(updated);
      setShowReflectionForm(false);
      await loadDashboard(token);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not update task status.");
    } finally {
      setLoading(false);
    }
  }

  async function handleDeleteGoal(goal: GoalOut) {
    if (!token) return;
    setLoading(true);
    setError("");
    try {
      await api.deleteGoal(token, goal.id);
      if (selectedGoal?.id === goal.id) closeGoal();
      await loadDashboard(token);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not delete task.");
    } finally {
      setLoading(false);
    }
  }

  async function sendCoachMessage(message: string) {
    if (!token || !message.trim() || chatLoading) return;
    const userMessage = message.trim();
    const updatedHistory: ChatMessage[] = [...chatHistory, { role: "user", content: userMessage }];
    setChatHistory(updatedHistory);
    setChatInput("");
    setChatError("");
    setChatLoading(true);

    try {
      const response = await api.chat(token, userMessage, chatHistory, activeChatSessionId, activeChatGoalId);
      setActiveChatSessionId(response.session_id);
      setChatHistory([...updatedHistory, { role: "assistant", content: response.reply }]);
      await loadChatSessions(token);
    } catch (err) {
      setChatError(err instanceof Error ? err.message : "Could not reach the AI assistant.");
    } finally {
      setChatLoading(false);
    }
  }

  async function loadChatSessions(nextToken = token) {
    if (!nextToken) return;
    try {
      const sessions = await api.chatSessions(nextToken);
      setChatSessions(sessions);
    } catch (err) {
      setChatError(err instanceof Error ? err.message : "Could not load chat history.");
    }
  }

  async function openAssistant(goal?: GoalOut) {
    setShowAssistant(true);
    setShowNotifications(false);
    setChatError("");
    if (goal) {
      setActiveChatGoalId(goal.id);
      const existingSession = chatSessions.find((session) => session.goal_id === goal.id);
      if (existingSession) {
        await openChatSession(existingSession.id);
        return;
      }
      setActiveChatSessionId(null);
      setChatHistory([
        {
          role: "assistant",
          content: `I can help you think through "${goal.title}". What would you like to decide or reflect on?`,
        },
      ]);
    } else {
      setActiveChatGoalId(null);
    }
    await loadChatSessions();
  }

  async function openChatSession(sessionId: string) {
    if (!token) return;
    setChatLoading(true);
    setChatError("");
    try {
      const session = await api.chatSession(token, sessionId);
      setActiveChatSessionId(session.id);
      setActiveChatGoalId(session.goal_id);
      setChatHistory(session.messages.map((message) => ({ role: message.role, content: message.content })));
      setShowAssistant(true);
    } catch (err) {
      setChatError(err instanceof Error ? err.message : "Could not open chat.");
    } finally {
      setChatLoading(false);
    }
  }

  function startNewChat() {
    setActiveChatSessionId(null);
    setActiveChatGoalId(null);
    setChatHistory([]);
    setChatInput("");
    setChatError("");
  }

  function resetProfileForm() {
    if (!user) return;
    const parsedPhone = splitPhoneNumber(user.phone_number);
    setProfileName(user.name);
    setProfileCountryCode(parsedPhone.countryCode);
    setProfileLocalPhone(parsedPhone.localPhone);
    setProfileDob(user.date_of_birth ?? "");
    setProfileNotificationsEnabled(user.in_app_notifications_enabled);
    setShowDobPicker(false);
    setShowCountryCodeMenu(false);
  }

  async function handleCreateSupportTicket() {
    if (!token || !user || !supportSubject.trim() || supportMessage.trim().length < 10) return;
    setSupportSaving(true);
    setSupportStatus("");
    setSupportError("");
    try {
      await api.createSupportTicket(token, {
        name: user.name,
        email: user.email,
        subject: supportSubject.trim(),
        message: supportMessage.trim(),
        source: "mobile",
      });
      setSupportSubject("");
      setSupportMessage("");
      setSupportStatus("Thanks. Your support ticket has been received.");
    } catch (err) {
      setSupportError(err instanceof Error ? err.message : "Could not send your message.");
    } finally {
      setSupportSaving(false);
    }
  }

  function renderProfileSettings() {
    if (!user) return null;

    return (
      <View style={styles.card}>
        <View style={styles.sectionHeader}>
          <View>
            <Text style={styles.cardTitle}>Profile Settings</Text>
            <Text style={styles.mutedText}>Keep your mobile profile details current.</Text>
          </View>
          <Pressable
            style={styles.secondaryButtonCompact}
            onPress={() => {
              setEditingProfile((current) => !current);
              resetProfileForm();
            }}
          >
            <Text style={styles.secondaryButtonText}>{editingProfile ? "Cancel" : "Edit"}</Text>
          </Pressable>
        </View>

        {editingProfile ? (
          <View>
            <TextInput
              value={profileName}
              onChangeText={setProfileName}
              placeholder="Name"
              placeholderTextColor="#737373"
              style={styles.input}
            />
            <Text style={styles.fieldLabel}>Country code</Text>
            <View style={styles.dropdownWrap}>
              <Pressable
                style={styles.dropdownButton}
                onPress={() => setShowCountryCodeMenu((current) => !current)}
              >
                <View>
                  <Text style={styles.dropdownValue}>{profileCountryCode}</Text>
                  <Text style={styles.dropdownLabel}>{getCountryCodeOption(profileCountryCode).label}</Text>
                </View>
                <Text style={styles.dropdownChevron}>{showCountryCodeMenu ? "^" : "v"}</Text>
              </Pressable>
              {showCountryCodeMenu ? (
                <View style={styles.dropdownMenu}>
                  {COUNTRY_CODE_OPTIONS.map((item) => (
                    <Pressable
                      key={item.value}
                      style={[
                        styles.dropdownOption,
                        profileCountryCode === item.value && styles.dropdownOptionActive,
                      ]}
                      onPress={() => {
                        setProfileCountryCode(item.value);
                        setShowCountryCodeMenu(false);
                      }}
                    >
                      <Text
                        style={
                          profileCountryCode === item.value
                            ? styles.dropdownOptionTextActive
                            : styles.dropdownOptionText
                        }
                      >
                        {item.value}
                      </Text>
                      <Text
                        style={
                          profileCountryCode === item.value
                            ? styles.dropdownOptionLabelActive
                            : styles.dropdownOptionLabel
                        }
                      >
                        {item.label}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              ) : null}
            </View>
            <TextInput
              value={profileLocalPhone}
              onChangeText={(value) => setProfileLocalPhone(value.replace(/[^\d]/g, ""))}
              keyboardType="phone-pad"
              maxLength={15}
              placeholder="Local phone number"
              placeholderTextColor="#737373"
              style={styles.input}
            />
            <Text style={styles.fieldLabel}>Date of birth</Text>
            <View style={styles.dobRow}>
              <Pressable style={styles.dobSelector} onPress={() => setShowDobPicker((current) => !current)}>
                <Text style={profileDob ? styles.dobValue : styles.dobPlaceholder}>
                  {profileDob || "Select date"}
                </Text>
              </Pressable>
              {profileDob ? (
                <Pressable
                  style={styles.clearDobButton}
                  onPress={() => {
                    setProfileDob("");
                    setShowDobPicker(false);
                  }}
                >
                  <Text style={styles.secondaryButtonText}>Clear</Text>
                </Pressable>
              ) : null}
            </View>
            {showDobPicker ? (
              <View style={styles.datePickerBox}>
                <DateTimePicker
                  value={getDatePickerValue(profileDob)}
                  mode="date"
                  display={Platform.OS === "ios" ? "spinner" : "default"}
                  maximumDate={new Date()}
                  themeVariant="dark"
                  textColor="#ffffff"
                  onChange={(_, selectedDate) => {
                    if (Platform.OS !== "ios") setShowDobPicker(false);
                    if (selectedDate) setProfileDob(formatDateInput(selectedDate));
                  }}
                />
                {Platform.OS === "ios" ? (
                  <Pressable style={styles.secondaryButton} onPress={() => setShowDobPicker(false)}>
                    <Text style={styles.secondaryButtonText}>Done</Text>
                  </Pressable>
                ) : null}
              </View>
            ) : null}
            <Text style={styles.fieldLabel}>In-app notifications</Text>
            <View style={styles.choiceRow}>
              <Pressable
                style={[styles.choiceButton, profileNotificationsEnabled && styles.choiceButtonActive]}
                onPress={() => setProfileNotificationsEnabled(true)}
              >
                <Text style={profileNotificationsEnabled ? styles.choiceTextActive : styles.choiceText}>Yes</Text>
              </Pressable>
              <Pressable
                style={[styles.choiceButton, !profileNotificationsEnabled && styles.choiceButtonActive]}
                onPress={() => setProfileNotificationsEnabled(false)}
              >
                <Text style={!profileNotificationsEnabled ? styles.choiceTextActive : styles.choiceText}>No</Text>
              </Pressable>
            </View>
            <Pressable
              disabled={loading || !profileName.trim()}
              style={[styles.primaryButton, (loading || !profileName.trim()) && styles.disabledButton]}
              onPress={handleSaveProfile}
            >
              <Text style={styles.primaryButtonText}>{loading ? "Saving..." : "Save profile"}</Text>
            </Pressable>
          </View>
        ) : (
          <View style={styles.profileGrid}>
            <View style={styles.profileItem}>
              <Text style={styles.profileLabel}>Name</Text>
              <Text style={styles.profileValue}>{user.name}</Text>
            </View>
            <View style={styles.profileItem}>
              <Text style={styles.profileLabel}>Phone</Text>
              <Text style={styles.profileValue}>{formatPhoneDisplay(user.phone_number)}</Text>
            </View>
            <View style={styles.profileItem}>
              <Text style={styles.profileLabel}>Date of birth</Text>
              <Text style={styles.profileValue}>{formatDobDisplay(user.date_of_birth)}</Text>
            </View>
          </View>
        )}
      </View>
    );
  }

  function renderAppearanceSettings() {
    return (
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Appearance</Text>
        <Text style={styles.mutedText}>Choose the background theme for this device.</Text>
        <View style={styles.themeGrid}>
          {THEME_OPTIONS.map((option) => (
            <Pressable
              key={option.value}
              style={[styles.themeOption, themeValue === option.value && styles.themeOptionActive]}
              onPress={() => handleThemeChange(option.value)}
            >
              <View style={[styles.themeSwatch, { backgroundColor: option.swatch }]} />
              <Text style={themeValue === option.value ? styles.themeTextActive : styles.themeText}>
                {option.label}
              </Text>
            </Pressable>
          ))}
        </View>
      </View>
    );
  }

  function renderContactSettings() {
    return (
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Contact us</Text>
        <Text style={styles.mutedText}>Raise a support ticket for issues, feedback, or beta testing notes.</Text>
        <TextInput
          value={supportSubject}
          onChangeText={setSupportSubject}
          placeholder="Subject"
          placeholderTextColor="#737373"
          maxLength={180}
          style={styles.input}
        />
        <TextInput
          value={supportMessage}
          onChangeText={setSupportMessage}
          multiline
          placeholder="Share the issue, device, and what you expected to happen."
          placeholderTextColor="#737373"
          maxLength={4000}
          style={styles.textAreaSmall}
        />
        {supportError ? <Text style={styles.errorText}>{supportError}</Text> : null}
        {supportStatus ? <Text style={styles.successText}>{supportStatus}</Text> : null}
        <Pressable
          disabled={supportSaving || !supportSubject.trim() || supportMessage.trim().length < 10}
          style={[
            styles.primaryButton,
            (supportSaving || !supportSubject.trim() || supportMessage.trim().length < 10) &&
              styles.disabledButton,
          ]}
          onPress={handleCreateSupportTicket}
        >
          <Text style={styles.primaryButtonText}>{supportSaving ? "Sending..." : "Raise ticket"}</Text>
        </Pressable>
      </View>
    );
  }

  function renderAddTaskCard(title = "Add Action Item", subtitle = "Capture a task or moment you want to revisit.") {
    return (
      <View style={styles.addTaskPanel}>
        <Text style={styles.cardTitle}>{title}</Text>
        <Text style={styles.mutedText}>{subtitle}</Text>
        <TextInput
          value={taskTitle}
          onChangeText={setTaskTitle}
          placeholder="Task title"
          placeholderTextColor="#737373"
          style={styles.input}
        />
        <Text style={styles.fieldLabel}>Emoji</Text>
        <View style={styles.emojiPickerRow}>
          {TASK_EMOJI_OPTIONS.map((item) => (
            <Pressable
              key={item}
              style={[styles.taskEmojiButton, taskEmoji === item && styles.taskEmojiButtonActive]}
              onPress={() => setTaskEmoji(item)}
            >
              <Text style={styles.taskEmojiOption}>{item}</Text>
            </Pressable>
          ))}
        </View>
        <TextInput
          value={taskNotes}
          onChangeText={setTaskNotes}
          multiline
          placeholder="Specific notes"
          placeholderTextColor="#737373"
          style={styles.textAreaSmall}
        />
        <Text style={styles.fieldLabel}>Priority</Text>
        <View style={styles.choiceRow}>
          {PRIORITY_OPTIONS.map((item) => (
            <Pressable
              key={item.value}
              style={[styles.choiceButton, taskPriority === item.value && styles.choiceButtonActive]}
              onPress={() => setTaskPriority(item.value)}
            >
              <Text style={taskPriority === item.value ? styles.choiceTextActive : styles.choiceText}>
                {item.label}
              </Text>
            </Pressable>
          ))}
        </View>
        <Text style={styles.fieldLabel}>Calendar date</Text>
        <View style={styles.dobRow}>
          <Pressable
            style={styles.dobSelector}
            onPress={() => setShowTaskDatePicker((current) => !current)}
          >
            <Text style={taskScheduledDate ? styles.dobValue : styles.dobPlaceholder}>
              {taskScheduledDate || "Optional date"}
            </Text>
          </Pressable>
          {taskScheduledDate ? (
            <Pressable
                  style={styles.clearDobButton}
                  onPress={() => {
                    setTaskScheduledDate("");
                    setTaskScheduledTime("09:00");
                    setShowTaskDatePicker(false);
                    setShowTaskTimePicker(false);
                  }}
            >
              <Text style={styles.secondaryButtonText}>Clear</Text>
            </Pressable>
          ) : null}
        </View>
        {showTaskDatePicker ? (
          <View style={styles.datePickerBox}>
            <DateTimePicker
              value={getTaskDatePickerValue(taskScheduledDate)}
              mode="date"
              display={Platform.OS === "ios" ? "spinner" : "default"}
              themeVariant="dark"
              textColor="#ffffff"
              onChange={(_, selectedDate) => {
                if (Platform.OS !== "ios") setShowTaskDatePicker(false);
                if (selectedDate) setTaskScheduledDate(formatDateInput(selectedDate));
              }}
            />
            {Platform.OS === "ios" ? (
              <Pressable style={styles.secondaryButton} onPress={() => setShowTaskDatePicker(false)}>
                <Text style={styles.secondaryButtonText}>Done</Text>
              </Pressable>
            ) : null}
          </View>
        ) : null}
        {taskScheduledDate ? (
          <>
            <Text style={styles.fieldLabel}>Reminder time</Text>
            <View style={styles.dobRow}>
              <Pressable
                style={styles.dobSelector}
                onPress={() => setShowTaskTimePicker((current) => !current)}
              >
                <Text style={styles.dobValue}>{taskScheduledTime}</Text>
              </Pressable>
            </View>
            {showTaskTimePicker ? (
              <View style={styles.datePickerBox}>
                <DateTimePicker
                  value={getTimePickerValue(taskScheduledTime)}
                  mode="time"
                  display={Platform.OS === "ios" ? "spinner" : "default"}
                  themeVariant="dark"
                  textColor="#ffffff"
                  onChange={(_, selectedDate) => {
                    if (Platform.OS !== "ios") setShowTaskTimePicker(false);
                    if (selectedDate) setTaskScheduledTime(formatTimeInput(selectedDate));
                  }}
                />
                {Platform.OS === "ios" ? (
                  <Pressable style={styles.secondaryButton} onPress={() => setShowTaskTimePicker(false)}>
                    <Text style={styles.secondaryButtonText}>Done</Text>
                  </Pressable>
                ) : null}
              </View>
            ) : null}
          </>
        ) : null}
        {error ? <Text style={styles.errorText}>{error}</Text> : null}
        <Pressable
          disabled={loading || !taskTitle.trim()}
          style={[styles.primaryButton, (loading || !taskTitle.trim()) && styles.disabledButton]}
          onPress={handleCreateTask}
        >
          <Text style={styles.primaryButtonText}>{loading ? "Adding..." : "Add item"}</Text>
        </Pressable>
      </View>
    );
  }

  async function handleMarkAllNotificationsRead() {
    if (!token) return;
    try {
      await api.markAllNotificationsRead(token);
      setNotifications((current) =>
        current.map((notification) => ({
          ...notification,
          read_at: notification.read_at ?? new Date().toISOString(),
        })),
      );
      setUnreadNotifications(0);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not update notifications.");
    }
  }

  async function handleAcknowledgeNotification(notification: NotificationOut) {
    if (!token) return;
    try {
      const updated = await api.acknowledgeNotification(token, notification.id);
      setNotifications((current) =>
        current.map((item) => (item.id === updated.id ? updated : item)),
      );
      const summary = await api.notificationSummary(token);
      setUnreadNotifications(summary.unread_count);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not acknowledge notification.");
    }
  }

  function renderNotificationsPanel() {
    return (
      <Modal visible={showNotifications} transparent animationType="fade" onRequestClose={() => setShowNotifications(false)}>
        <View style={styles.modalOverlay}>
          <Pressable style={styles.modalBackdrop} onPress={() => setShowNotifications(false)} />
          <View style={styles.notificationModal}>
            <View style={styles.sectionHeader}>
              <View>
                <Text style={styles.cardTitle}>Notifications</Text>
                <Text style={styles.mutedText}>{unreadNotifications} unread updates.</Text>
              </View>
              <Pressable style={styles.secondaryButtonCompact} onPress={handleMarkAllNotificationsRead}>
                <Text style={styles.secondaryButtonText}>Read all</Text>
              </Pressable>
            </View>
            <ScrollView style={styles.notificationList} contentContainerStyle={styles.notificationListContent}>
              {notifications.length === 0 ? (
                <Text style={styles.emptyText}>No notifications yet.</Text>
              ) : (
                notifications.slice(0, 20).map((notification) => (
                  <View key={notification.id} style={styles.notificationItem}>
                    <View style={[styles.notificationDot, notification.read_at && styles.notificationDotRead]} />
                    <View style={styles.notificationTextGroup}>
                      <Text style={styles.notificationTitle}>{notification.title}</Text>
                      <Text style={styles.notificationBody}>{notification.body}</Text>
                      <Text style={styles.goalMeta}>{formatLogDate(notification.created_at)}</Text>
                      {notification.category === "reminder" && !notification.acknowledged_at ? (
                        <View style={styles.notificationActions}>
                          <Pressable
                            style={styles.notificationAckButton}
                            onPress={() => handleAcknowledgeNotification(notification)}
                          >
                            <Text style={styles.primaryButtonText}>Yes</Text>
                          </Pressable>
                          <Pressable
                            style={styles.notificationDismissButton}
                            onPress={() => handleAcknowledgeNotification(notification)}
                          >
                            <Text style={styles.secondaryButtonText}>No</Text>
                          </Pressable>
                        </View>
                      ) : null}
                    </View>
                  </View>
                ))
              )}
            </ScrollView>
            <Pressable style={styles.secondaryButton} onPress={() => setShowNotifications(false)}>
              <Text style={styles.secondaryButtonText}>Close</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    );
  }

  function renderGoalCard(goal: GoalOut) {
    const latestLog = latestLogByGoalId[goal.id];
    const taskStatus = getTaskStatus(goal);

    return (
      <View key={goal.id} style={styles.goalCard}>
        <View style={styles.goalHeader}>
          <View style={styles.goalTitleRow}>
            <Text style={styles.taskEmoji}>{getTaskEmoji(goal)}</Text>
            <Text style={styles.goalTitle}>{goal.title}</Text>
          </View>
          <View style={styles.goalBadgeRow}>
            <Text style={[styles.priorityPill, getPriorityBadgeStyle(goal.priority)]}>
              {getPriorityLabel(goal.priority)}
            </Text>
            <Text style={[styles.statusPill, taskStatus.style]}>{taskStatus.icon}</Text>
          </View>
        </View>
        {goal.notes ? <Text style={styles.goalNotes}>{goal.notes}</Text> : null}
        {latestLog ? (
          <View style={styles.latestLogBox}>
            <View style={styles.latestLogHeader}>
              <Text style={styles.latestLogLabel}>Latest reflection</Text>
              {latestLog.emotion_label ? (
                <Text style={styles.emotionPill}>
                  {getEmotionLabel(latestLog.emotion_label)}
                </Text>
              ) : null}
            </View>
            <Text style={styles.latestLogText} numberOfLines={2}>
              {latestLog.reflection}
            </Text>
          </View>
        ) : null}
        <View style={styles.goalFooter}>
          <Text style={styles.goalMeta}>{formatGoalDate(goal)}</Text>
          <View style={styles.taskCardActions}>
            {!goal.completed ? (
              <>
                <Pressable style={styles.iconActionButton} onPress={() => openAssistant(goal)}>
                  <Text style={styles.iconActionText}>🤖</Text>
                </Pressable>
                <Pressable style={styles.iconActionButton} onPress={() => openGoal(goal, "edit")}>
                  <Text style={styles.iconActionText}>✏️</Text>
                </Pressable>
              </>
            ) : null}
            <Pressable style={styles.iconDangerButton} disabled={loading} onPress={() => handleDeleteGoal(goal)}>
              <Text style={styles.iconActionText}>🗑️</Text>
            </Pressable>
            {!goal.completed ? (
              <Pressable style={styles.reflectButton} onPress={() => openGoal(goal)}>
                <Text style={styles.reflectButtonText}>Reflect</Text>
              </Pressable>
            ) : (
              <Pressable style={styles.reflectButton} onPress={() => openGoal(goal)}>
                <Text style={styles.reflectButtonText}>View</Text>
              </Pressable>
            )}
          </View>
        </View>
      </View>
    );
  }

  if (booting) {
    return (
      <AppShell theme={activeTheme}>
        <View style={styles.centered}>
          <ActivityIndicator color="#60a5fa" />
          <Text style={styles.mutedText}>Starting Stratosphere...</Text>
        </View>
      </AppShell>
    );
  }

  if (!token || !user) {
    return (
      <AppShell theme={activeTheme}>
        <ScreenScroll>
          <View style={styles.header}>
            <Text style={styles.eyebrow}>Phase 2</Text>
            <Text style={styles.title}>Stratosphere Mobile</Text>
            <Text style={styles.subtitle}>Sign in with your existing web account.</Text>
          </View>

          <View style={styles.card}>
            <View style={styles.connectionRow}>
              <Text style={styles.cardLabel}>Backend</Text>
              <Text style={backendOnline ? styles.onlineText : styles.offlineText}>
                {backendOnline ? "Online" : "Offline"}
              </Text>
            </View>
            <Text style={styles.url}>{API_BASE_URL}</Text>
            <Pressable style={styles.secondaryButton} onPress={checkBackend}>
              <Text style={styles.secondaryButtonText}>Check backend</Text>
            </Pressable>
          </View>

          <View style={styles.card}>
            <Text style={styles.cardTitle}>Login</Text>
            <TextInput
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="email-address"
              placeholder="Email"
              placeholderTextColor="#737373"
              style={styles.input}
            />
            <TextInput
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              placeholder="Password"
              placeholderTextColor="#737373"
              style={styles.input}
            />
            {error ? <Text style={styles.errorText}>{error}</Text> : null}
            <Pressable
              disabled={loading || !email.trim() || !password}
              style={[styles.primaryButton, (loading || !email.trim() || !password) && styles.disabledButton]}
              onPress={() => handleLogin()}
            >
              <Text style={styles.primaryButtonText}>{loading ? "Signing in..." : "Sign in"}</Text>
            </Pressable>
            <Text style={styles.helperText}>Create accounts on the web app for now.</Text>
          </View>
        </ScreenScroll>
      </AppShell>
    );
  }

  if (showAssistant) {
    return (
      <AppShell theme={activeTheme}>
        <ScreenScroll>
          <View style={styles.detailHeader}>
            <Pressable
              style={styles.backButton}
              onPress={() => {
                setShowAssistant(false);
                setChatError("");
                Keyboard.dismiss();
              }}
            >
              <Text style={styles.secondaryButtonText}>Back</Text>
            </Pressable>
            <Text style={styles.eyebrow}>Ollama Life Coach</Text>
            <Text style={styles.title}>AI Assistant</Text>
            <Text style={styles.subtitle}>Task-aware support from your FastAPI backend.</Text>
          </View>

          <View style={styles.card}>
            <View style={styles.sectionHeader}>
              <View>
                <Text style={styles.cardTitle}>Chat history</Text>
                <Text style={styles.mutedText}>Resume a previous conversation or start fresh.</Text>
              </View>
              <Pressable style={styles.secondaryButtonCompact} onPress={startNewChat}>
                <Text style={styles.secondaryButtonText}>New</Text>
              </Pressable>
            </View>
            {chatSessions.length === 0 ? (
              <Text style={styles.emptyText}>No saved chats yet.</Text>
            ) : (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chatSessionList}>
                {chatSessions.slice(0, 12).map((session) => (
                  <Pressable
                    key={session.id}
                    style={[
                      styles.chatSessionChip,
                      activeChatSessionId === session.id && styles.chatSessionChipActive,
                    ]}
                    onPress={() => openChatSession(session.id)}
                  >
                    <Text
                      style={
                        activeChatSessionId === session.id
                          ? styles.chatSessionChipTextActive
                          : styles.chatSessionChipText
                      }
                      numberOfLines={1}
                    >
                      {session.goal_id ? "🤖 " : ""}
                      {session.title}
                    </Text>
                  </Pressable>
                ))}
              </ScrollView>
            )}
          </View>

          <View style={styles.card}>
            <Text style={styles.cardTitle}>Chat</Text>
            <Text style={styles.mutedText}>
              The assistant can reference your current action items and recent reflections.
            </Text>

            <View style={styles.chatStarterGrid}>
              {COACH_STARTER_PROMPTS.map((prompt) => (
                <Pressable
                  key={prompt}
                  disabled={chatLoading}
                  style={styles.chatStarterButton}
                  onPress={() => sendCoachMessage(prompt)}
                >
                  <Text style={styles.chatStarterText}>{prompt}</Text>
                </Pressable>
              ))}
            </View>

            <View style={styles.chatMessages}>
              {chatHistory.length === 0 ? (
                <Text style={styles.emptyText}>Ask what to focus on, how to restart, or what your reflections show.</Text>
              ) : (
                chatHistory.map((message, index) => (
                  <View
                    key={`${message.role}-${index}`}
                    style={[
                      styles.chatBubble,
                      message.role === "user" ? styles.chatBubbleUser : styles.chatBubbleAssistant,
                    ]}
                  >
                    <Text
                      style={
                        message.role === "user" ? styles.chatBubbleTextUser : styles.chatBubbleTextAssistant
                      }
                    >
                      {message.content}
                    </Text>
                  </View>
                ))
              )}
              {chatLoading ? (
                <View style={[styles.chatBubble, styles.chatBubbleAssistant]}>
                  <Text style={styles.chatBubbleTextAssistant}>Thinking...</Text>
                </View>
              ) : null}
            </View>

            <TextInput
              value={chatInput}
              onChangeText={setChatInput}
              multiline
              placeholder="Ask about your tasks, blockers, or next step..."
              placeholderTextColor="#737373"
              style={styles.chatInput}
            />
            {chatError ? <Text style={styles.errorText}>{chatError}</Text> : null}
            <Pressable
              disabled={chatLoading || !chatInput.trim()}
              style={[styles.primaryButton, (chatLoading || !chatInput.trim()) && styles.disabledButton]}
              onPress={() => sendCoachMessage(chatInput)}
            >
              <Text style={styles.primaryButtonText}>{chatLoading ? "Sending..." : "Send"}</Text>
            </Pressable>
          </View>

          <View style={styles.card}>
            <View style={styles.sectionHeader}>
              <View>
                <Text style={styles.cardTitle}>Context sent</Text>
                <Text style={styles.mutedText}>FastAPI attaches this task data before calling Ollama.</Text>
              </View>
              <Text style={styles.goalMeta}>{goals.length} tasks</Text>
            </View>
            {goals.slice(0, 5).map((goal) => {
              const latestLog = latestLogByGoalId[goal.id];
              return (
                <View key={goal.id} style={styles.contextTaskItem}>
                  <Text style={styles.contextTaskTitle} numberOfLines={2}>
                    {getTaskEmoji(goal)} {goal.title}
                  </Text>
                  <Text style={styles.goalMeta}>
                    {goal.priority} priority · {formatGoalDate(goal)}
                  </Text>
	                  {latestLog ? (
	                    <Text style={styles.contextTaskReflection} numberOfLines={2}>
	                      {getEmotionLabel(latestLog.emotion_label) ?? "No emotion"} · {getLogMeaning(latestLog)} ·{" "}
	                      {latestLog.reflection}
	                    </Text>
                  ) : (
                    <Text style={styles.goalMeta}>No reflection yet.</Text>
                  )}
                </View>
              );
            })}
          </View>

          <View style={styles.card}>
            <Text style={styles.cardTitle}>Recent reflections</Text>
            {recentGoalLogs.length === 0 ? (
              <Text style={styles.emptyText}>No journal entries yet.</Text>
            ) : (
              recentGoalLogs.map((log) => {
                const goal = goalsById.get(log.goal_id);
                return (
                  <View key={log.id} style={styles.recentReflectionItem}>
                    <Text style={styles.contextTaskTitle} numberOfLines={1}>
                      {goal?.title ?? "Task removed"}
	                    </Text>
	                    <Text style={styles.goalMeta}>
	                      {getEmotionLabel(log.emotion_label) ?? "No emotion"} · {getLogMeaning(log)}
	                    </Text>
                  </View>
                );
              })
            )}
          </View>
        </ScreenScroll>
      </AppShell>
    );
  }

  if (showSettings) {
    return (
      <AppShell theme={activeTheme}>
        <ScreenScroll>
          <View style={styles.detailHeader}>
            <Pressable
              style={styles.backButton}
              onPress={() => {
                setShowSettings(false);
                setEditingProfile(false);
                resetProfileForm();
              }}
            >
              <Text style={styles.secondaryButtonText}>Back</Text>
            </Pressable>
            <Text style={styles.eyebrow}>Account</Text>
            <Text style={styles.title}>Settings</Text>
            <Text style={styles.subtitle}>{user.email}</Text>
          </View>
          {renderProfileSettings()}
          {renderAppearanceSettings()}
          {renderContactSettings()}
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Session</Text>
            <Text style={styles.mutedText}>Sign out from this mobile device.</Text>
            <Pressable style={styles.deleteButtonFull} onPress={handleSignOut}>
              <Text style={styles.deleteButtonText}>Sign out</Text>
            </Pressable>
          </View>
        </ScreenScroll>
      </AppShell>
    );
  }

  if (dayViewDate && !selectedGoal) {
    const dayKey = getDateKeyFromDate(dayViewDate);
    const dayGoals = goals.filter((goal) => getDateKey(getGoalDate(goal)) === dayKey);

    return (
      <AppShell theme={activeTheme}>
        <ScreenScroll>
          <View style={styles.detailHeader}>
            <Pressable style={styles.backButton} onPress={() => setDayViewDate(null)}>
              <Text style={styles.secondaryButtonText}>Back</Text>
            </Pressable>
            <Text style={styles.eyebrow}>Calendar day</Text>
            <Text style={styles.title}>{formatSelectedDateLabel(dayViewDate)}</Text>
            <View style={styles.detailMetaRow}>
              <Text style={styles.detailMetaText}>
                {dayGoals.length} {dayGoals.length === 1 ? "item" : "items"}
              </Text>
              <Text style={styles.detailMetaText}>{formatMonthLabel(dayViewDate)}</Text>
            </View>
          </View>

          <View style={styles.card}>
            <View style={styles.sectionHeader}>
              <View>
                <Text style={styles.cardTitle}>Action Items</Text>
                <Text style={styles.mutedText}>Edit, delete, or reflect on this day.</Text>
              </View>
              <Pressable
                style={styles.secondaryButtonCompact}
                onPress={() => {
                  setTaskScheduledDate(formatDateInput(dayViewDate));
                  setShowDayAddTask((current) => !current);
                }}
              >
                <Text style={styles.secondaryButtonText}>{showDayAddTask ? "Close" : "Add"}</Text>
              </Pressable>
            </View>

            {loading ? <ActivityIndicator color="#60a5fa" style={styles.inlineLoader} /> : null}
            {error ? <Text style={styles.errorText}>{error}</Text> : null}
            {dayGoals.length === 0 ? (
              <Text style={styles.emptyText}>No action items for this day.</Text>
            ) : (
              dayGoals.map((goal) => renderGoalCard(goal))
            )}
          </View>
          {showDayAddTask
            ? renderAddTaskCard("Add To This Day", "New tasks created here are scheduled for this calendar day.")
            : null}
        </ScreenScroll>
      </AppShell>
    );
  }

  if (selectedGoal) {
    const sortedLogs = [...goalLogs].sort(
      (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
    );
    const selectedTaskStatus = getTaskStatus(selectedGoal);

    return (
      <AppShell theme={activeTheme}>
        <ScreenScroll>
          <View style={styles.detailHeader}>
            <Pressable style={styles.backButton} onPress={closeGoal}>
              <Text style={styles.secondaryButtonText}>Back</Text>
            </Pressable>
            <Text style={styles.eyebrow}>Task journal</Text>
            <Text style={styles.title}>
              {getTaskEmoji(selectedGoal)} {selectedGoal.title}
            </Text>
            <View style={styles.detailMetaRow}>
              <Text style={[styles.priorityPill, getPriorityBadgeStyle(selectedGoal.priority)]}>
                {getPriorityLabel(selectedGoal.priority)}
              </Text>
              <Text style={[styles.statusPill, selectedTaskStatus.style]}>{selectedTaskStatus.icon}</Text>
              <Text style={styles.detailMetaText}>{formatGoalDate(selectedGoal)}</Text>
              <Text style={styles.detailMetaText}>
                {sortedLogs.length} {sortedLogs.length === 1 ? "entry" : "entries"}
              </Text>
            </View>
          </View>

          {selectedGoal.notes ? (
            <View style={styles.card}>
              <Text style={styles.cardLabel}>Task context</Text>
              <Text style={styles.goalNotes}>{selectedGoal.notes}</Text>
            </View>
          ) : null}

          {!selectedGoal.completed ? (
            <View style={styles.card}>
              <Text style={styles.cardTitle}>Task status</Text>
              <Text style={styles.mutedText}>Mark the task complete only when the task itself is finished.</Text>
              <View style={styles.choiceRow}>
                <Pressable
                  style={[styles.choiceButton, !selectedGoal.completed && styles.choiceButtonActive]}
                  onPress={() => handleSetTaskCompleted(false)}
                >
                  <Text style={!selectedGoal.completed ? styles.choiceTextActive : styles.choiceText}>○ Not done</Text>
                </Pressable>
                <Pressable
                  style={styles.choiceButton}
                  disabled={loading}
                  onPress={() => handleSetTaskCompleted(true)}
                >
                  <Text style={styles.choiceText}>✓ Done</Text>
                </Pressable>
              </View>
              {error ? <Text style={styles.errorText}>{error}</Text> : null}
            </View>
          ) : null}

          <View style={styles.journalActionBar}>
            {!selectedGoal.completed ? (
              <>
                <Pressable
                  style={[styles.journalEntryButton, showReflectionForm && styles.journalEntryButtonActive]}
                  onPress={() => {
                    setShowReflectionForm((current) => !current);
                    setEditingGoal(false);
                  }}
                >
                  <Text style={styles.journalEntryButtonText}>
                    {showReflectionForm ? "Close Journal Entry" : "Add Journal Entry"}
                  </Text>
                </Pressable>
                <Pressable
                  style={[styles.iconHeaderButton, editingGoal && styles.iconHeaderButtonActive]}
                  onPress={() => {
                    if (editingGoal) {
                      setEditingGoal(false);
                      resetTaskForm();
                    } else {
                      beginEditGoal();
                    }
                  }}
                >
                  <Text style={styles.iconActionText}>✏️</Text>
                </Pressable>
              </>
            ) : null}
            <Pressable style={styles.iconDangerButton} disabled={loading} onPress={handleDeleteTask}>
              <Text style={styles.iconActionText}>🗑️</Text>
            </Pressable>
          </View>

          {editingGoal && !selectedGoal.completed ? (
          <View style={styles.card}>
            <View style={styles.sectionHeader}>
              <View>
                <Text style={styles.cardTitle}>Edit task</Text>
                <Text style={styles.mutedText}>Update or remove this action item.</Text>
              </View>
            </View>

              <View>
                <TextInput
                  value={taskTitle}
                  onChangeText={setTaskTitle}
                  placeholder="Task title"
                  placeholderTextColor="#737373"
                  style={styles.input}
                />
                <Text style={styles.fieldLabel}>Emoji</Text>
                <View style={styles.emojiPickerRow}>
                  {TASK_EMOJI_OPTIONS.map((item) => (
                    <Pressable
                      key={item}
                      style={[styles.taskEmojiButton, taskEmoji === item && styles.taskEmojiButtonActive]}
                      onPress={() => setTaskEmoji(item)}
                    >
                      <Text style={styles.taskEmojiOption}>{item}</Text>
                    </Pressable>
                  ))}
                </View>
                <TextInput
                  value={taskNotes}
                  onChangeText={setTaskNotes}
                  multiline
                  placeholder="Specific notes"
                  placeholderTextColor="#737373"
                  style={styles.textAreaSmall}
                />
                <Text style={styles.fieldLabel}>Priority</Text>
                <View style={styles.choiceRow}>
                  {PRIORITY_OPTIONS.map((item) => (
                    <Pressable
                      key={item.value}
                      style={[styles.choiceButton, taskPriority === item.value && styles.choiceButtonActive]}
                      onPress={() => setTaskPriority(item.value)}
                    >
                      <Text style={taskPriority === item.value ? styles.choiceTextActive : styles.choiceText}>
                        {item.label}
                      </Text>
                    </Pressable>
                  ))}
                </View>
                <Text style={styles.fieldLabel}>Calendar date</Text>
                <View style={styles.dobRow}>
                  <Pressable
                    style={styles.dobSelector}
                    onPress={() => setShowTaskDatePicker((current) => !current)}
                  >
                    <Text style={taskScheduledDate ? styles.dobValue : styles.dobPlaceholder}>
                      {taskScheduledDate || "Optional date"}
                    </Text>
                  </Pressable>
                  {taskScheduledDate ? (
                    <Pressable
                      style={styles.clearDobButton}
                      onPress={() => {
                        setTaskScheduledDate("");
                        setTaskScheduledTime("09:00");
                        setShowTaskDatePicker(false);
                        setShowTaskTimePicker(false);
                      }}
                    >
                      <Text style={styles.secondaryButtonText}>Clear</Text>
                    </Pressable>
                  ) : null}
                </View>
                {showTaskDatePicker ? (
                  <View style={styles.datePickerBox}>
                    <DateTimePicker
                      value={getTaskDatePickerValue(taskScheduledDate)}
                      mode="date"
                      display={Platform.OS === "ios" ? "spinner" : "default"}
                      themeVariant="dark"
                      textColor="#ffffff"
                      onChange={(_, selectedDate) => {
                        if (Platform.OS !== "ios") setShowTaskDatePicker(false);
                        if (selectedDate) setTaskScheduledDate(formatDateInput(selectedDate));
                      }}
                    />
                    {Platform.OS === "ios" ? (
                      <Pressable style={styles.secondaryButton} onPress={() => setShowTaskDatePicker(false)}>
                        <Text style={styles.secondaryButtonText}>Done</Text>
                      </Pressable>
                    ) : null}
                  </View>
                ) : null}
                {taskScheduledDate ? (
                  <>
                    <Text style={styles.fieldLabel}>Reminder time</Text>
                    <View style={styles.dobRow}>
                      <Pressable
                        style={styles.dobSelector}
                        onPress={() => setShowTaskTimePicker((current) => !current)}
                      >
                        <Text style={styles.dobValue}>{taskScheduledTime}</Text>
                      </Pressable>
                    </View>
                    {showTaskTimePicker ? (
                      <View style={styles.datePickerBox}>
                        <DateTimePicker
                          value={getTimePickerValue(taskScheduledTime)}
                          mode="time"
                          display={Platform.OS === "ios" ? "spinner" : "default"}
                          themeVariant="dark"
                          textColor="#ffffff"
                          onChange={(_, selectedDate) => {
                            if (Platform.OS !== "ios") setShowTaskTimePicker(false);
                            if (selectedDate) setTaskScheduledTime(formatTimeInput(selectedDate));
                          }}
                        />
                        {Platform.OS === "ios" ? (
                          <Pressable style={styles.secondaryButton} onPress={() => setShowTaskTimePicker(false)}>
                            <Text style={styles.secondaryButtonText}>Done</Text>
                          </Pressable>
                        ) : null}
                      </View>
                    ) : null}
                  </>
                ) : null}
                <View style={styles.actionRow}>
                  <Pressable
                    style={styles.secondaryActionButton}
                    onPress={() => {
                      setEditingGoal(false);
                      resetTaskForm();
                    }}
                  >
                    <Text style={styles.secondaryButtonText}>Cancel</Text>
                  </Pressable>
                  <Pressable
                    disabled={loading || !taskTitle.trim()}
                    style={[styles.primaryActionButton, (loading || !taskTitle.trim()) && styles.disabledButton]}
                    onPress={handleSaveTaskEdit}
                  >
                    <Text style={styles.primaryButtonText}>{loading ? "Saving..." : "Save"}</Text>
                  </Pressable>
                </View>
              </View>
          </View>
          ) : null}

          {showReflectionForm && !selectedGoal.completed ? (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Add journal entry</Text>
            <TextInput
              value={reflection}
              onChangeText={setReflection}
              multiline
              placeholder="Add the latest detail, obstacle, decision, or reflection..."
              placeholderTextColor="#737373"
              style={styles.textArea}
            />
            <Text style={styles.fieldLabel}>How did this feel?</Text>
            <View style={styles.emotionGrid}>
              {EMOTION_OPTIONS.map((item) => (
                <Pressable
                  key={item.value}
                  style={[styles.emotionButton, emotionLabel === item.value && styles.emotionButtonActive]}
                  onPress={() =>
                    setEmotionLabel((current) => (current === item.value ? null : item.value))
                  }
                >
                  <Text
                    style={emotionLabel === item.value ? styles.emotionTextActive : styles.emotionText}
                  >
                    {item.label}
                  </Text>
                </Pressable>
              ))}
            </View>
            <Text style={styles.fieldLabel}>Does this still feel meaningful?</Text>
            <View style={styles.choiceRow}>
              {[
                { label: "Yes", value: true },
                { label: "Unsure", value: null },
                { label: "No", value: false },
              ].map((item) => (
                <Pressable
                  key={item.label}
                  style={[styles.choiceButton, soulful === item.value && styles.choiceButtonActive]}
                  onPress={() => setSoulful(item.value)}
                >
                  <Text style={soulful === item.value ? styles.choiceTextActive : styles.choiceText}>
                    {item.label}
                  </Text>
                </Pressable>
              ))}
            </View>
            {error ? <Text style={styles.errorText}>{error}</Text> : null}
            <Pressable
              disabled={logsLoading || !reflection.trim()}
              style={[styles.primaryButton, (logsLoading || !reflection.trim()) && styles.disabledButton]}
              onPress={handleAddReflection}
            >
              <Text style={styles.primaryButtonText}>
                {logsLoading ? "Saving..." : "Add entry"}
              </Text>
            </Pressable>
          </View>
          ) : null}

          <View style={styles.card}>
            <View style={styles.sectionHeader}>
              <View>
                <Text style={styles.cardTitle}>Journal timeline</Text>
                <Text style={styles.mutedText}>Latest entries first.</Text>
              </View>
              {logsLoading ? <ActivityIndicator color="#60a5fa" /> : null}
            </View>

            {sortedLogs.length === 0 ? (
              <Text style={styles.emptyText}>No journal entries yet.</Text>
            ) : (
              <View style={styles.timeline}>
                {sortedLogs.map((log) => (
                  <View key={log.id} style={styles.timelineItem}>
                    <View style={styles.timelineRail}>
                      <Text style={styles.timelineDot}>🔵</Text>
                      <View style={styles.timelineLine} />
                    </View>
                    <View style={styles.timelineCard}>
                      <View style={styles.timelineHeader}>
                        <Text style={styles.timelineBadge}>User log</Text>
                        <Text style={styles.goalMeta}>{formatLogDate(log.created_at)}</Text>
                      </View>
                      <View style={styles.logPillRow}>
                        <Text style={styles.logPill}>{getLogMeaning(log)}</Text>
                        {log.emotion_label ? (
                          <Text style={styles.emotionPill}>{getEmotionLabel(log.emotion_label)}</Text>
                        ) : null}
                      </View>
                      <Text style={styles.logText}>{log.reflection}</Text>
                    </View>
                  </View>
                ))}
              </View>
            )}
          </View>
        </ScreenScroll>
      </AppShell>
    );
  }

  return (
    <AppShell theme={activeTheme}>
      <ScreenScroll>
        <View style={styles.dashboardHeader}>
          <View style={styles.dashboardHeaderText}>
            <Text style={styles.eyebrow}>Today</Text>
            <Text style={styles.dashboardTitle} numberOfLines={2}>
              Hello, {user.name}
            </Text>
            <Text style={styles.dashboardSubtitle} numberOfLines={1}>
              {user.email}
            </Text>
          </View>
          <View style={styles.dashboardHeaderActions}>
            <Pressable
              style={styles.notificationButton}
              onPress={() => openAssistant()}
            >
              <Text style={styles.notificationButtonText}>🤖</Text>
            </Pressable>
            <Pressable
              style={styles.notificationButton}
              onPress={() => setShowNotifications((current) => !current)}
            >
              <Text style={styles.notificationButtonText}>🔔</Text>
              {unreadNotifications > 0 ? (
                <View style={styles.notificationBadge}>
                  <Text style={styles.notificationBadgeText}>{Math.min(unreadNotifications, 9)}</Text>
                </View>
              ) : null}
            </Pressable>
            <Pressable
              style={styles.avatarButton}
              onPress={() => {
                resetProfileForm();
                setShowSettings(true);
              }}
            >
              <Text style={styles.avatarText}>{user.name.trim().charAt(0).toUpperCase() || "U"}</Text>
            </Pressable>
          </View>
        </View>

        {renderNotificationsPanel()}

        <View style={styles.statsRow}>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>{todayGoals.length}</Text>
            <Text style={styles.statLabel}>Today</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>{goals.length}</Text>
            <Text style={styles.statLabel}>All tasks</Text>
          </View>
        </View>

        <View style={styles.card}>
          <View style={styles.calendarHeader}>
            <View>
              <Text style={styles.cardTitle}>Calendar</Text>
              <Text style={styles.mutedText}>Priority dots mark scheduled task dates.</Text>
            </View>
            <View style={styles.monthControls}>
              <Pressable
                style={styles.monthButton}
                onPress={() =>
                  setCalendarMonth((current) => new Date(current.getFullYear(), current.getMonth() - 1, 1))
                }
              >
                <Text style={styles.monthButtonText}>{"<"}</Text>
              </Pressable>
              <Pressable
                style={styles.monthButton}
                onPress={() =>
                  setCalendarMonth((current) => new Date(current.getFullYear(), current.getMonth() + 1, 1))
                }
              >
                <Text style={styles.monthButtonText}>{">"}</Text>
              </Pressable>
            </View>
          </View>

          <Text style={styles.monthTitle}>{formatMonthLabel(calendarMonth)}</Text>
          <View style={styles.weekdayRow}>
            {WEEKDAY_LABELS.map((label, index) => (
              <Text key={`${label}-${index}`} style={styles.weekdayText}>
                {label}
              </Text>
            ))}
          </View>
          <View style={styles.calendarGrid}>
            {calendarDays.map((day) => {
              const dayGoals = goalsByDateKey[day.dateKey] ?? [];
              const dayPriorities = PRIORITY_OPTIONS.map((item) => item.value).filter((priority) =>
                dayGoals.some((goal) => goal.priority === priority),
              );
              const isSelected = day.dateKey === selectedDateKey;
              const isToday = day.dateKey === getDateKey(null);

              return (
                <Pressable
                  key={day.dateKey}
                  style={[
                    styles.calendarDay,
                    !day.isCurrentMonth && styles.calendarDayMuted,
                    isToday && styles.calendarDayToday,
                    isSelected && styles.calendarDaySelected,
                  ]}
                  onPress={() => {
                    setSelectedCalendarDate(day.date);
                    setDayViewDate(day.date);
                  }}
                >
                  <Text
                    style={[
                      styles.calendarDayText,
                      !day.isCurrentMonth && styles.calendarDayTextMuted,
                      isSelected && styles.calendarDayTextSelected,
                    ]}
                  >
                    {day.date.getDate()}
                  </Text>
                  <View style={styles.priorityDotRow}>
                    {dayPriorities.slice(0, 3).map((priority) => (
                      <View
                        key={priority}
                        style={[styles.priorityDot, { backgroundColor: PRIORITY_DOT_COLORS[priority] }]}
                      />
                    ))}
                  </View>
                </Pressable>
              );
            })}
          </View>
          <View style={styles.priorityLegend}>
            {PRIORITY_OPTIONS.map((item) => (
              <View key={item.value} style={styles.legendItem}>
                <View style={[styles.priorityDot, { backgroundColor: PRIORITY_DOT_COLORS[item.value] }]} />
                <Text style={styles.legendText}>{item.label}</Text>
              </View>
            ))}
          </View>
        </View>

        <View style={styles.card}>
          <View style={styles.sectionHeader}>
            <View>
              <Text style={styles.cardTitle}>Progress</Text>
              <Text style={styles.mutedText}>Track completed tasks and reflection activity.</Text>
            </View>
          </View>
          <View style={styles.filterRow}>
            <Pressable
              style={[styles.filterButton, analyticsTab === "progress" && styles.filterButtonActive]}
              onPress={() => setAnalyticsTab("progress")}
            >
              <Text style={analyticsTab === "progress" ? styles.filterTextActive : styles.filterText}>
                Progress
              </Text>
            </Pressable>
            <Pressable
              style={[styles.filterButton, analyticsTab === "reflections" && styles.filterButtonActive]}
              onPress={() => setAnalyticsTab("reflections")}
            >
              <Text style={analyticsTab === "reflections" ? styles.filterTextActive : styles.filterText}>
                Reflections
              </Text>
            </Pressable>
          </View>

          {analyticsTab === "progress" ? (
            <View style={styles.barChart}>
              {[
                { label: "Completed", value: completedGoalCount, color: "#22c55e" },
                { label: "Open", value: openGoalCount, color: "#60a5fa" },
              ].map((item) => {
                const maxValue = Math.max(goals.length, 1);
                return (
                  <View key={item.label} style={styles.barRow}>
                    <Text style={styles.barLabel}>{item.label}</Text>
                    <View style={styles.barTrack}>
                      <View
                        style={[
                          styles.barFill,
                          { backgroundColor: item.color, width: `${Math.max((item.value / maxValue) * 100, 4)}%` },
                        ]}
                      />
                    </View>
                    <Text style={styles.barValue}>{item.value}</Text>
                  </View>
                );
              })}
            </View>
          ) : (
            <View style={styles.reflectionChart}>
              {reflectionChartData.map((item) => {
                const maxValue = Math.max(...reflectionChartData.map((day) => day.count), 1);
                return (
                  <View key={item.label} style={styles.reflectionBarItem}>
                    <View style={styles.reflectionBarTrack}>
                      <View
                        style={[
                          styles.reflectionBarFill,
                          { height: `${Math.max((item.count / maxValue) * 100, item.count ? 10 : 0)}%` },
                        ]}
                      />
                    </View>
                    <Text style={styles.reflectionBarValue}>{item.count}</Text>
                    <Text style={styles.reflectionBarLabel}>{item.label}</Text>
                  </View>
                );
              })}
            </View>
          )}
        </View>

        <View style={styles.card}>
          <View style={styles.sectionHeader}>
            <View>
              <Text style={styles.cardTitle}>
                {taskFilter === "today"
                  ? "Today's Action Items"
                  : taskFilter === "completed"
                    ? "Completed Items"
                    : "All Action Items"}
              </Text>
              <Text style={styles.mutedText}>Pulled from the FastAPI backend.</Text>
            </View>
            <View style={styles.headerActions}>
              <Pressable style={styles.iconHeaderButton} onPress={handleRefresh}>
                <Text style={styles.iconHeaderText}>↻</Text>
              </Pressable>
              <Pressable
                style={[styles.iconHeaderButton, showDashboardAddTask && styles.iconHeaderButtonActive]}
                onPress={() => setShowDashboardAddTask((current) => !current)}
              >
                <Text style={styles.iconHeaderText}>{showDashboardAddTask ? "×" : "+"}</Text>
              </Pressable>
            </View>
          </View>

          {showDashboardAddTask ? renderAddTaskCard() : null}

          <View style={styles.filterRow}>
            <Pressable
              style={[styles.filterButton, taskFilter === "today" && styles.filterButtonActive]}
              onPress={() => setTaskFilter("today")}
            >
              <Text style={taskFilter === "today" ? styles.filterTextActive : styles.filterText}>
                Today
              </Text>
            </Pressable>
            <Pressable
              style={[styles.filterButton, taskFilter === "all" && styles.filterButtonActive]}
              onPress={() => setTaskFilter("all")}
            >
              <Text style={taskFilter === "all" ? styles.filterTextActive : styles.filterText}>
                All ({goals.length})
              </Text>
            </Pressable>
            <Pressable
              style={[styles.filterButton, taskFilter === "completed" && styles.filterButtonActive]}
              onPress={() => setTaskFilter("completed")}
            >
              <Text style={taskFilter === "completed" ? styles.filterTextActive : styles.filterText}>
                Completed ({completedGoals.length})
              </Text>
            </Pressable>
          </View>

          {loading ? <ActivityIndicator color="#60a5fa" style={styles.inlineLoader} /> : null}
          {error ? <Text style={styles.errorText}>{error}</Text> : null}

          <ScrollView
            nestedScrollEnabled
            style={styles.actionListScroll}
            contentContainerStyle={styles.actionListContent}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator
          >
            {visibleGoals.length === 0 ? (
              <Text style={styles.emptyText}>
                {taskFilter === "today"
                  ? "No action items for today."
                  : taskFilter === "completed"
                    ? "No completed items yet."
                    : "No action items yet."}
              </Text>
            ) : (
              visibleGoals.map((goal) => renderGoalCard(goal))
            )}
          </ScrollView>
        </View>
      </ScreenScroll>
    </AppShell>
  );
}

function AppShell({ children, theme }: { children: React.ReactNode; theme: (typeof THEME_OPTIONS)[number] }) {
  const content = (
    <View style={[styles.backgroundOverlay, { backgroundColor: theme.overlay }]}>
      <SafeAreaView style={styles.screen}>
        <StatusBar style="light" />
        {children}
      </SafeAreaView>
    </View>
  );

  return (
    <SafeAreaProvider>
      {theme.image ? (
        <ImageBackground
          source={theme.image}
          style={styles.backgroundImage}
          imageStyle={[styles.backgroundImageAsset, { opacity: theme.imageOpacity }]}
        >
          {content}
        </ImageBackground>
      ) : (
        <View style={styles.backgroundImage}>{content}</View>
      )}
    </SafeAreaProvider>
  );
}

function ScreenScroll({ children }: { children: React.ReactNode }) {
  return (
    <KeyboardAvoidingView
      style={styles.keyboardAvoiding}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardDismissMode="interactive"
          keyboardShouldPersistTaps="handled"
        >
          {children}
        </ScrollView>
      </TouchableWithoutFeedback>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: "transparent",
  },
  backgroundImage: {
    flex: 1,
    backgroundColor: "#0a0a0a",
  },
  backgroundImageAsset: {
    opacity: 0.34,
  },
  backgroundOverlay: {
    flex: 1,
    backgroundColor: "rgba(10, 10, 10, 0.78)",
  },
  keyboardAvoiding: {
    flex: 1,
  },
  scrollContent: {
    gap: 18,
    padding: 24,
    paddingBottom: 40,
  },
  centered: {
    alignItems: "center",
    flex: 1,
    gap: 14,
    justifyContent: "center",
    padding: 24,
  },
  header: {
    marginBottom: 4,
  },
  dashboardHeader: {
    alignItems: "flex-start",
    flexDirection: "row",
    gap: 16,
    justifyContent: "space-between",
  },
  dashboardHeaderText: {
    flex: 1,
    minWidth: 0,
  },
  dashboardHeaderActions: {
    alignItems: "center",
    flexShrink: 0,
    flexDirection: "row",
    gap: 10,
  },
  detailHeader: {
    gap: 10,
  },
  detailMetaRow: {
    alignItems: "center",
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 4,
  },
  detailMetaText: {
    borderColor: "#2f2f2f",
    borderRadius: 7,
    borderWidth: 1,
    color: "#d4d4d4",
    fontSize: 12,
    fontWeight: "700",
    overflow: "hidden",
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  eyebrow: {
    color: "#60a5fa",
    fontSize: 13,
    fontWeight: "700",
    letterSpacing: 0,
    marginBottom: 8,
    textTransform: "uppercase",
  },
  title: {
    color: "#ffffff",
    fontSize: 32,
    fontWeight: "800",
    letterSpacing: 0,
  },
  dashboardTitle: {
    color: "#ffffff",
    flexShrink: 1,
    fontSize: 30,
    fontWeight: "800",
    letterSpacing: 0,
    lineHeight: 36,
  },
  subtitle: {
    color: "#a3a3a3",
    fontSize: 16,
    lineHeight: 24,
    marginTop: 10,
  },
  dashboardSubtitle: {
    color: "#a3a3a3",
    fontSize: 15,
    lineHeight: 22,
    marginTop: 8,
  },
  card: {
    backgroundColor: "#171717",
    borderColor: "#2f2f2f",
    borderRadius: 14,
    borderWidth: 1,
    padding: 18,
  },
  addTaskPanel: {
    backgroundColor: "#101010",
    borderColor: "#2f2f2f",
    borderRadius: 12,
    borderWidth: 1,
    marginTop: 12,
    padding: 14,
  },
  cardLabel: {
    color: "#d4d4d4",
    fontSize: 14,
    fontWeight: "700",
  },
  cardTitle: {
    color: "#ffffff",
    fontSize: 20,
    fontWeight: "800",
  },
  connectionRow: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
  },
  url: {
    color: "#737373",
    fontSize: 13,
    marginTop: 8,
  },
  onlineText: {
    color: "#10b981",
    fontSize: 13,
    fontWeight: "800",
  },
  offlineText: {
    color: "#ef4444",
    fontSize: 13,
    fontWeight: "800",
  },
  input: {
    backgroundColor: "#262626",
    borderColor: "#404040",
    borderRadius: 10,
    borderWidth: 1,
    color: "#ffffff",
    fontSize: 16,
    fontWeight: "600",
    marginTop: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  primaryButton: {
    alignItems: "center",
    backgroundColor: "#2563eb",
    borderRadius: 10,
    marginTop: 16,
    paddingVertical: 13,
  },
  primaryButtonText: {
    color: "#ffffff",
    fontSize: 15,
    fontWeight: "800",
  },
  secondaryButton: {
    alignItems: "center",
    borderColor: "#404040",
    borderRadius: 10,
    borderWidth: 1,
    marginTop: 16,
    paddingVertical: 11,
  },
  secondaryButtonCompact: {
    borderColor: "#404040",
    borderRadius: 9,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  secondaryButtonText: {
    color: "#d4d4d4",
    fontSize: 13,
    fontWeight: "800",
  },
  iconHeaderButton: {
    alignItems: "center",
    borderColor: "#404040",
    borderRadius: 9,
    borderWidth: 1,
    height: 36,
    justifyContent: "center",
    width: 36,
  },
  iconHeaderButtonActive: {
    backgroundColor: "#2563eb",
    borderColor: "#60a5fa",
  },
  iconHeaderText: {
    color: "#ffffff",
    fontSize: 20,
    fontWeight: "900",
    lineHeight: 22,
  },
  backButton: {
    alignSelf: "flex-start",
    borderColor: "#404040",
    borderRadius: 9,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  disabledButton: {
    opacity: 0.45,
  },
  signOutButton: {
    borderColor: "#404040",
    borderRadius: 10,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 9,
  },
  signOutText: {
    color: "#d4d4d4",
    fontSize: 13,
    fontWeight: "800",
  },
  avatarButton: {
    alignItems: "center",
    backgroundColor: "#2563eb",
    borderColor: "#60a5fa",
    borderRadius: 999,
    borderWidth: 1,
    height: 44,
    justifyContent: "center",
    width: 44,
  },
  avatarText: {
    color: "#ffffff",
    fontSize: 17,
    fontWeight: "900",
  },
  notificationButton: {
    alignItems: "center",
    borderColor: "#404040",
    borderRadius: 999,
    borderWidth: 1,
    height: 44,
    justifyContent: "center",
    position: "relative",
    width: 44,
  },
  notificationButtonText: {
    fontSize: 18,
    lineHeight: 22,
  },
  notificationBadge: {
    alignItems: "center",
    backgroundColor: "#ef4444",
    borderRadius: 999,
    height: 17,
    justifyContent: "center",
    position: "absolute",
    right: -3,
    top: -3,
    width: 17,
  },
  notificationBadgeText: {
    color: "#ffffff",
    fontSize: 10,
    fontWeight: "900",
  },
  modalOverlay: {
    flex: 1,
    justifyContent: "flex-end",
  },
  modalBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0, 0, 0, 0.68)",
  },
  notificationModal: {
    backgroundColor: "#171717",
    borderColor: "#2f2f2f",
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    borderWidth: 1,
    maxHeight: "78%",
    padding: 18,
  },
  notificationList: {
    maxHeight: 430,
  },
  notificationListContent: {
    paddingBottom: 6,
  },
  helperText: {
    color: "#737373",
    fontSize: 13,
    lineHeight: 19,
    marginTop: 12,
  },
  mutedText: {
    color: "#a3a3a3",
    fontSize: 14,
    lineHeight: 20,
  },
  errorText: {
    color: "#fca5a5",
    fontSize: 14,
    lineHeight: 20,
    marginTop: 12,
  },
  successText: {
    color: "#86efac",
    fontSize: 14,
    lineHeight: 20,
    marginTop: 12,
  },
  fieldLabel: {
    color: "#d4d4d4",
    fontSize: 14,
    fontWeight: "700",
    marginTop: 16,
  },
  choiceRow: {
    flexDirection: "row",
    gap: 8,
    marginTop: 14,
  },
  choiceButton: {
    alignItems: "center",
    borderColor: "#404040",
    borderRadius: 10,
    borderWidth: 1,
    flex: 1,
    paddingVertical: 11,
  },
  choiceButtonActive: {
    backgroundColor: "#2563eb",
    borderColor: "#60a5fa",
  },
  choiceText: {
    color: "#d4d4d4",
    fontSize: 13,
    fontWeight: "800",
  },
  choiceTextActive: {
    color: "#ffffff",
    fontSize: 13,
    fontWeight: "900",
  },
  textArea: {
    backgroundColor: "#262626",
    borderColor: "#404040",
    borderRadius: 10,
    borderWidth: 1,
    color: "#ffffff",
    fontSize: 15,
    fontWeight: "600",
    lineHeight: 21,
    marginTop: 14,
    minHeight: 130,
    paddingHorizontal: 14,
    paddingVertical: 12,
    textAlignVertical: "top",
  },
  textAreaSmall: {
    backgroundColor: "#262626",
    borderColor: "#404040",
    borderRadius: 10,
    borderWidth: 1,
    color: "#ffffff",
    fontSize: 15,
    fontWeight: "600",
    lineHeight: 21,
    marginTop: 14,
    minHeight: 92,
    paddingHorizontal: 14,
    paddingVertical: 12,
    textAlignVertical: "top",
  },
  chatStarterGrid: {
    gap: 8,
    marginTop: 14,
  },
  chatSessionList: {
    gap: 8,
    paddingRight: 4,
  },
  chatSessionChip: {
    borderColor: "#404040",
    borderRadius: 999,
    borderWidth: 1,
    maxWidth: 220,
    paddingHorizontal: 12,
    paddingVertical: 9,
  },
  chatSessionChipActive: {
    backgroundColor: "#2563eb",
    borderColor: "#60a5fa",
  },
  chatSessionChipText: {
    color: "#d4d4d4",
    fontSize: 13,
    fontWeight: "800",
  },
  chatSessionChipTextActive: {
    color: "#ffffff",
    fontSize: 13,
    fontWeight: "900",
  },
  chatStarterButton: {
    backgroundColor: "#0f0f0f",
    borderColor: "#2f2f2f",
    borderRadius: 10,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 11,
  },
  chatStarterText: {
    color: "#d4d4d4",
    fontSize: 13,
    fontWeight: "800",
    lineHeight: 18,
  },
  chatMessages: {
    gap: 10,
    marginTop: 16,
  },
  chatBubble: {
    borderRadius: 14,
    maxWidth: "92%",
    paddingHorizontal: 13,
    paddingVertical: 11,
  },
  chatBubbleUser: {
    alignSelf: "flex-end",
    backgroundColor: "#2563eb",
  },
  chatBubbleAssistant: {
    alignSelf: "flex-start",
    backgroundColor: "#262626",
    borderColor: "#404040",
    borderWidth: 1,
  },
  chatBubbleTextUser: {
    color: "#ffffff",
    fontSize: 14,
    fontWeight: "700",
    lineHeight: 20,
  },
  chatBubbleTextAssistant: {
    color: "#f5f5f5",
    fontSize: 14,
    lineHeight: 20,
  },
  chatInput: {
    backgroundColor: "#262626",
    borderColor: "#404040",
    borderRadius: 10,
    borderWidth: 1,
    color: "#ffffff",
    fontSize: 15,
    lineHeight: 21,
    marginTop: 16,
    minHeight: 84,
    paddingHorizontal: 14,
    paddingVertical: 12,
    textAlignVertical: "top",
  },
  actionRow: {
    flexDirection: "row",
    gap: 10,
    marginTop: 16,
  },
  journalActionBar: {
    alignSelf: "flex-start",
    alignItems: "center",
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  journalEntryButton: {
    alignItems: "center",
    borderColor: "#404040",
    borderRadius: 9,
    borderWidth: 1,
    minHeight: 36,
    justifyContent: "center",
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  journalEntryButtonActive: {
    backgroundColor: "#2563eb",
    borderColor: "#60a5fa",
  },
  journalEntryButtonText: {
    color: "#ffffff",
    fontSize: 13,
    fontWeight: "900",
  },
  emojiPickerRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 10,
  },
  taskEmojiButton: {
    alignItems: "center",
    backgroundColor: "#0f0f0f",
    borderColor: "#404040",
    borderRadius: 10,
    borderWidth: 1,
    height: 42,
    justifyContent: "center",
    width: 42,
  },
  taskEmojiButtonActive: {
    backgroundColor: "#075985",
    borderColor: "#38bdf8",
  },
  taskEmojiOption: {
    fontSize: 20,
    lineHeight: 24,
  },
  primaryActionButton: {
    alignItems: "center",
    backgroundColor: "#2563eb",
    borderRadius: 10,
    flex: 1,
    paddingVertical: 12,
  },
  secondaryActionButton: {
    alignItems: "center",
    borderColor: "#404040",
    borderRadius: 10,
    borderWidth: 1,
    flex: 1,
    paddingVertical: 12,
  },
  deleteButton: {
    alignItems: "center",
    borderColor: "#7f1d1d",
    borderRadius: 10,
    borderWidth: 1,
    flex: 1,
    paddingVertical: 12,
  },
  deleteButtonText: {
    color: "#fca5a5",
    fontSize: 13,
    fontWeight: "900",
  },
  deleteButtonFull: {
    alignItems: "center",
    borderColor: "#7f1d1d",
    borderRadius: 10,
    borderWidth: 1,
    marginTop: 16,
    paddingVertical: 12,
  },
  notificationItem: {
    alignItems: "flex-start",
    borderTopColor: "#2f2f2f",
    borderTopWidth: 1,
    flexDirection: "row",
    gap: 10,
    paddingVertical: 12,
  },
  notificationDot: {
    backgroundColor: "#60a5fa",
    borderRadius: 999,
    height: 9,
    marginTop: 5,
    width: 9,
  },
  notificationDotRead: {
    backgroundColor: "#404040",
  },
  notificationTextGroup: {
    flex: 1,
  },
  notificationTitle: {
    color: "#ffffff",
    fontSize: 14,
    fontWeight: "900",
  },
  notificationBody: {
    color: "#a3a3a3",
    fontSize: 13,
    lineHeight: 19,
    marginTop: 3,
  },
  notificationActions: {
    flexDirection: "row",
    gap: 8,
    marginTop: 10,
  },
  notificationAckButton: {
    alignItems: "center",
    backgroundColor: "#2563eb",
    borderRadius: 8,
    flex: 1,
    paddingVertical: 8,
  },
  notificationDismissButton: {
    alignItems: "center",
    borderColor: "#404040",
    borderRadius: 8,
    borderWidth: 1,
    flex: 1,
    paddingVertical: 8,
  },
  emotionGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 12,
  },
  emotionButton: {
    borderColor: "#404040",
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 11,
    paddingVertical: 8,
  },
  emotionButtonActive: {
    backgroundColor: "#075985",
    borderColor: "#38bdf8",
  },
  emotionText: {
    color: "#d4d4d4",
    fontSize: 12,
    fontWeight: "800",
  },
  emotionTextActive: {
    color: "#ffffff",
    fontSize: 12,
    fontWeight: "900",
  },
  statsRow: {
    flexDirection: "row",
    gap: 12,
  },
  statCard: {
    backgroundColor: "#171717",
    borderColor: "#2f2f2f",
    borderRadius: 14,
    borderWidth: 1,
    flex: 1,
    padding: 16,
  },
  statValue: {
    color: "#ffffff",
    fontSize: 30,
    fontWeight: "900",
  },
  statLabel: {
    color: "#a3a3a3",
    fontSize: 13,
    marginTop: 4,
  },
  calendarHeader: {
    alignItems: "flex-start",
    flexDirection: "row",
    gap: 12,
    justifyContent: "space-between",
  },
  monthControls: {
    flexDirection: "row",
    gap: 8,
  },
  monthButton: {
    alignItems: "center",
    borderColor: "#404040",
    borderRadius: 9,
    borderWidth: 1,
    height: 36,
    justifyContent: "center",
    width: 36,
  },
  monthButtonText: {
    color: "#d4d4d4",
    fontSize: 15,
    fontWeight: "900",
  },
  monthTitle: {
    color: "#ffffff",
    fontSize: 17,
    fontWeight: "900",
    marginTop: 16,
  },
  weekdayRow: {
    flexDirection: "row",
    marginTop: 14,
  },
  weekdayText: {
    color: "#737373",
    flex: 1,
    fontSize: 11,
    fontWeight: "900",
    textAlign: "center",
  },
  calendarGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    marginTop: 8,
  },
  calendarDay: {
    alignItems: "center",
    aspectRatio: 1,
    backgroundColor: "#0f0f0f",
    borderColor: "#262626",
    borderRadius: 8,
    borderWidth: 1,
    justifyContent: "center",
    padding: 4,
    marginBottom: 6,
    width: "14.285%",
  },
  calendarDayMuted: {
    opacity: 0.36,
  },
  calendarDayToday: {
    borderColor: "#38bdf8",
  },
  calendarDaySelected: {
    backgroundColor: "#2563eb",
    borderColor: "#60a5fa",
  },
  calendarDayText: {
    color: "#e5e5e5",
    fontSize: 12,
    fontWeight: "900",
  },
  calendarDayTextMuted: {
    color: "#737373",
  },
  calendarDayTextSelected: {
    color: "#ffffff",
  },
  priorityDotRow: {
    flexDirection: "row",
    gap: 3,
    height: 5,
    justifyContent: "center",
    marginTop: 5,
  },
  priorityDot: {
    borderRadius: 999,
    height: 5,
    width: 5,
  },
  priorityLegend: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
    marginTop: 14,
  },
  legendItem: {
    alignItems: "center",
    flexDirection: "row",
    gap: 6,
  },
  legendText: {
    color: "#a3a3a3",
    fontSize: 12,
    fontWeight: "700",
  },
  barChart: {
    gap: 14,
    marginTop: 14,
  },
  barRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: 10,
  },
  barLabel: {
    color: "#d4d4d4",
    fontSize: 13,
    fontWeight: "800",
    width: 82,
  },
  barTrack: {
    backgroundColor: "#262626",
    borderRadius: 999,
    flex: 1,
    height: 14,
    overflow: "hidden",
  },
  barFill: {
    borderRadius: 999,
    height: "100%",
  },
  barValue: {
    color: "#ffffff",
    fontSize: 13,
    fontWeight: "900",
    textAlign: "right",
    width: 26,
  },
  reflectionChart: {
    alignItems: "flex-end",
    flexDirection: "row",
    gap: 8,
    height: 150,
    marginTop: 16,
  },
  reflectionBarItem: {
    alignItems: "center",
    flex: 1,
    gap: 5,
  },
  reflectionBarTrack: {
    alignItems: "center",
    backgroundColor: "#262626",
    borderRadius: 999,
    height: 90,
    justifyContent: "flex-end",
    overflow: "hidden",
    width: "100%",
  },
  reflectionBarFill: {
    backgroundColor: "#38bdf8",
    borderRadius: 999,
    width: "100%",
  },
  reflectionBarValue: {
    color: "#ffffff",
    fontSize: 11,
    fontWeight: "900",
  },
  reflectionBarLabel: {
    color: "#737373",
    fontSize: 11,
    fontWeight: "800",
  },
  profileGrid: {
    gap: 12,
  },
  profileItem: {
    borderTopColor: "#2f2f2f",
    borderTopWidth: 1,
    paddingTop: 12,
  },
  profileLabel: {
    color: "#737373",
    fontSize: 12,
    fontWeight: "900",
    textTransform: "uppercase",
  },
  profileValue: {
    color: "#ffffff",
    fontSize: 15,
    fontWeight: "700",
    marginTop: 4,
  },
  dropdownWrap: {
    marginTop: 10,
  },
  dropdownButton: {
    alignItems: "center",
    backgroundColor: "#262626",
    borderColor: "#404040",
    borderRadius: 10,
    borderWidth: 1,
    flexDirection: "row",
    justifyContent: "space-between",
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  dropdownValue: {
    color: "#ffffff",
    fontSize: 16,
    fontWeight: "800",
  },
  dropdownLabel: {
    color: "#a3a3a3",
    fontSize: 12,
    fontWeight: "700",
    marginTop: 2,
  },
  dropdownChevron: {
    color: "#d4d4d4",
    fontSize: 20,
    fontWeight: "900",
  },
  dropdownMenu: {
    backgroundColor: "#0f0f0f",
    borderColor: "#2f2f2f",
    borderRadius: 10,
    borderWidth: 1,
    marginTop: 8,
    overflow: "hidden",
  },
  dropdownOption: {
    borderBottomColor: "#262626",
    borderBottomWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 11,
  },
  dropdownOptionActive: {
    backgroundColor: "#075985",
  },
  dropdownOptionText: {
    color: "#d4d4d4",
    fontSize: 14,
    fontWeight: "900",
  },
  dropdownOptionTextActive: {
    color: "#ffffff",
    fontSize: 14,
    fontWeight: "900",
  },
  dropdownOptionLabel: {
    color: "#737373",
    fontSize: 12,
    fontWeight: "700",
    marginTop: 2,
  },
  dropdownOptionLabelActive: {
    color: "#bae6fd",
    fontSize: 12,
    fontWeight: "800",
    marginTop: 2,
  },
  themeGrid: {
    flexDirection: "row",
    gap: 10,
    marginTop: 14,
  },
  themeOption: {
    alignItems: "center",
    borderColor: "#404040",
    borderRadius: 10,
    borderWidth: 1,
    flex: 1,
    gap: 8,
    paddingVertical: 12,
  },
  themeOptionActive: {
    backgroundColor: "#075985",
    borderColor: "#38bdf8",
  },
  themeSwatch: {
    borderColor: "#ffffff",
    borderRadius: 999,
    borderWidth: 1,
    height: 24,
    width: 24,
  },
  themeText: {
    color: "#d4d4d4",
    fontSize: 13,
    fontWeight: "800",
  },
  themeTextActive: {
    color: "#ffffff",
    fontSize: 13,
    fontWeight: "900",
  },
  dobRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: 10,
    marginTop: 10,
  },
  dobSelector: {
    backgroundColor: "#262626",
    borderColor: "#404040",
    borderRadius: 10,
    borderWidth: 1,
    flex: 1,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  dobValue: {
    color: "#ffffff",
    fontSize: 16,
    fontWeight: "700",
  },
  dobPlaceholder: {
    color: "#737373",
    fontSize: 16,
    fontWeight: "600",
  },
  clearDobButton: {
    borderColor: "#404040",
    borderRadius: 9,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 11,
  },
  datePickerBox: {
    backgroundColor: "#0f0f0f",
    borderColor: "#2f2f2f",
    borderRadius: 12,
    borderWidth: 1,
    marginTop: 12,
    overflow: "hidden",
    padding: 8,
  },
  sectionHeader: {
    alignItems: "flex-start",
    flexDirection: "row",
    gap: 12,
    justifyContent: "space-between",
    marginBottom: 16,
  },
  headerActions: {
    alignItems: "flex-end",
    flexDirection: "row",
    gap: 8,
  },
  inlineLoader: {
    marginVertical: 16,
  },
  filterRow: {
    backgroundColor: "#0f0f0f",
    borderColor: "#2f2f2f",
    borderRadius: 11,
    borderWidth: 1,
    flexDirection: "row",
    gap: 4,
    marginBottom: 8,
    padding: 4,
  },
  filterButton: {
    alignItems: "center",
    borderRadius: 8,
    flex: 1,
    paddingVertical: 9,
  },
  filterButtonActive: {
    backgroundColor: "#2563eb",
  },
  filterText: {
    color: "#a3a3a3",
    fontSize: 13,
    fontWeight: "800",
  },
  filterTextActive: {
    color: "#ffffff",
    fontSize: 13,
    fontWeight: "900",
  },
  emptyText: {
    color: "#737373",
    fontSize: 15,
    lineHeight: 22,
    paddingVertical: 14,
  },
  actionListScroll: {
    maxHeight: 430,
  },
  actionListContent: {
    paddingBottom: 4,
  },
  goalCard: {
    borderTopColor: "#2f2f2f",
    borderTopWidth: 1,
    paddingVertical: 15,
  },
  goalHeader: {
    alignItems: "flex-start",
    flexDirection: "row",
    gap: 10,
    justifyContent: "space-between",
  },
  goalTitleRow: {
    alignItems: "flex-start",
    flex: 1,
    flexDirection: "row",
    gap: 8,
  },
  taskEmoji: {
    fontSize: 18,
    lineHeight: 23,
  },
  goalTitle: {
    color: "#ffffff",
    flex: 1,
    fontSize: 17,
    fontWeight: "800",
    lineHeight: 23,
  },
  priorityPill: {
    borderRadius: 7,
    borderWidth: 1,
    fontSize: 12,
    fontWeight: "800",
    overflow: "hidden",
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  statusPill: {
    minWidth: 28,
    textAlign: "center",
    borderRadius: 7,
    borderWidth: 1,
    fontSize: 12,
    fontWeight: "900",
    overflow: "hidden",
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  goalBadgeRow: {
    alignItems: "center",
    flexDirection: "row",
    flexShrink: 0,
    gap: 6,
  },
  goalNotes: {
    color: "#a3a3a3",
    fontSize: 14,
    lineHeight: 20,
    marginTop: 8,
  },
  goalMeta: {
    color: "#737373",
    fontSize: 13,
  },
  contextTaskItem: {
    borderTopColor: "#2f2f2f",
    borderTopWidth: 1,
    gap: 6,
    paddingVertical: 12,
  },
  contextTaskTitle: {
    color: "#ffffff",
    fontSize: 14,
    fontWeight: "900",
    lineHeight: 20,
  },
  contextTaskReflection: {
    color: "#a3a3a3",
    fontSize: 13,
    lineHeight: 19,
  },
  recentReflectionItem: {
    borderLeftColor: "#60a5fa",
    borderLeftWidth: 2,
    gap: 4,
    marginTop: 12,
    paddingLeft: 10,
  },
  goalFooter: {
    alignItems: "center",
    flexDirection: "row",
    gap: 12,
    justifyContent: "space-between",
    marginTop: 12,
  },
  taskCardActions: {
    alignItems: "center",
    flexDirection: "row",
    flexWrap: "wrap",
    flexShrink: 0,
    gap: 8,
    justifyContent: "flex-end",
  },
  iconActionButton: {
    alignItems: "center",
    borderColor: "#404040",
    borderRadius: 8,
    borderWidth: 1,
    height: 34,
    justifyContent: "center",
    width: 34,
  },
  iconDangerButton: {
    alignItems: "center",
    borderColor: "#7f1d1d",
    borderRadius: 8,
    borderWidth: 1,
    height: 34,
    justifyContent: "center",
    width: 34,
  },
  iconActionText: {
    fontSize: 15,
    lineHeight: 18,
  },
  reflectButton: {
    backgroundColor: "#2563eb",
    borderRadius: 9,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  reflectButtonText: {
    color: "#ffffff",
    fontSize: 13,
    fontWeight: "900",
  },
  latestLogBox: {
    backgroundColor: "#0f0f0f",
    borderColor: "#2f2f2f",
    borderRadius: 10,
    borderWidth: 1,
    marginTop: 12,
    padding: 12,
  },
  latestLogHeader: {
    alignItems: "center",
    flexDirection: "row",
    gap: 8,
    justifyContent: "space-between",
    marginBottom: 6,
  },
  latestLogLabel: {
    color: "#737373",
    fontSize: 11,
    fontWeight: "900",
    textTransform: "uppercase",
  },
  latestLogText: {
    color: "#d4d4d4",
    fontSize: 13,
    lineHeight: 19,
  },
  timeline: {
    gap: 0,
  },
  timelineItem: {
    flexDirection: "row",
    gap: 12,
  },
  timelineRail: {
    alignItems: "center",
    width: 24,
  },
  timelineDot: {
    fontSize: 14,
    lineHeight: 22,
  },
  timelineLine: {
    backgroundColor: "#075985",
    flex: 1,
    minHeight: 18,
    width: 1,
  },
  timelineCard: {
    backgroundColor: "#0f0f0f",
    borderColor: "#2f2f2f",
    borderRadius: 12,
    borderWidth: 1,
    flex: 1,
    marginBottom: 14,
    padding: 14,
  },
  timelineHeader: {
    alignItems: "flex-start",
    flexDirection: "row",
    gap: 8,
    justifyContent: "space-between",
  },
  timelineBadge: {
    borderColor: "#0369a1",
    borderRadius: 7,
    borderWidth: 1,
    color: "#bae6fd",
    fontSize: 12,
    fontWeight: "900",
    overflow: "hidden",
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  logPillRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 10,
  },
  logPill: {
    borderColor: "#404040",
    borderRadius: 7,
    borderWidth: 1,
    color: "#d4d4d4",
    fontSize: 12,
    fontWeight: "700",
    overflow: "hidden",
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  emotionPill: {
    borderColor: "#38bdf8",
    borderRadius: 7,
    borderWidth: 1,
    color: "#bae6fd",
    fontSize: 12,
    fontWeight: "800",
    overflow: "hidden",
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  logText: {
    color: "#e5e5e5",
    fontSize: 15,
    lineHeight: 22,
    marginTop: 12,
  },
});
