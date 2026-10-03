import * as SecureStore from "expo-secure-store";
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import {
  api,
  type ChatMessage,
  type ChatSessionOut,
  type EmotionLabel,
  type GoalCreate,
  type GoalLogOut,
  type GoalOut,
  type NotificationOut,
  type UserOut,
  type UserUpdate,
} from "../api";

const TOKEN_KEY = "stratosphere_access_token";

export type ReflectionInput = {
  reflection: string;
  soulful: boolean | null;
  emotionLabel: EmotionLabel | null;
  completeTask: boolean;
};

function errorMessage(err: unknown, fallback: string) {
  return err instanceof Error ? err.message : fallback;
}

function useAppStateValue() {
  const [booting, setBooting] = useState(true);
  const [token, setToken] = useState<string | null>(null);
  const [user, setUser] = useState<UserOut | null>(null);
  const [goals, setGoals] = useState<GoalOut[]>([]);
  const [allGoalLogs, setAllGoalLogs] = useState<GoalLogOut[]>([]);
  const [notifications, setNotifications] = useState<NotificationOut[]>([]);
  const [unreadNotifications, setUnreadNotifications] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [backendOnline, setBackendOnline] = useState<boolean | null>(null);
  const [chatHistory, setChatHistory] = useState<ChatMessage[]>([]);
  const [chatLoading, setChatLoading] = useState(false);
  const [chatError, setChatError] = useState("");
  const [chatSessions, setChatSessions] = useState<ChatSessionOut[]>([]);
  const [activeChatSessionId, setActiveChatSessionId] = useState<string | null>(null);
  const [activeChatGoalId, setActiveChatGoalId] = useState<string | null>(null);

  function clearSession() {
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
  }

  async function loadDashboard(nextToken: string) {
    setLoading(true);
    setError("");
    try {
      const [userData, goalData, logData, notificationData, notificationSummary, dueNotificationData, chatSessionData] =
        await Promise.all([
          api.me(nextToken),
          api.goals(nextToken),
          api.goalLogs(nextToken),
          api.notifications(nextToken),
          api.notificationSummary(nextToken),
          api.dueNotifications(nextToken),
          api.chatSessions(nextToken),
        ]);
      setUser(userData);
      setGoals(goalData);
      setAllGoalLogs(logData);
      setNotifications([
        ...dueNotificationData,
        ...notificationData.filter((item) => !dueNotificationData.some((due) => due.id === item.id)),
      ]);
      setUnreadNotifications(Math.max(notificationSummary.unread_count, dueNotificationData.length));
      setChatSessions(chatSessionData);
      setToken(nextToken);
      await SecureStore.setItemAsync(TOKEN_KEY, nextToken);
    } catch (err) {
      await SecureStore.deleteItemAsync(TOKEN_KEY);
      clearSession();
      setError(errorMessage(err, "Could not load dashboard."));
    } finally {
      setLoading(false);
    }
  }

  const checkBackend = useCallback(async () => {
    try {
      const response = await api.health();
      setBackendOnline(response.ok);
    } catch {
      setBackendOnline(false);
    }
  }, []);

  useEffect(() => {
    async function restoreSession() {
      if (__DEV__) await checkBackend();
      const savedToken = await SecureStore.getItemAsync(TOKEN_KEY);
      if (savedToken) await loadDashboard(savedToken);
      setBooting(false);
    }
    restoreSession();
  }, []);

  async function login(email: string, password: string) {
    if (!email.trim() || !password) return;
    setLoading(true);
    setError("");
    try {
      const auth = await api.login(email.trim(), password);
      await loadDashboard(auth.access_token);
    } catch (err) {
      setError(errorMessage(err, "Could not sign in."));
    } finally {
      setLoading(false);
    }
  }

  async function signOut() {
    await SecureStore.deleteItemAsync(TOKEN_KEY);
    clearSession();
    setError("");
  }

  async function refresh() {
    if (token) await loadDashboard(token);
  }

  async function saveProfile(update: UserUpdate) {
    if (!token) return false;
    setLoading(true);
    setError("");
    try {
      setUser(await api.updateMe(token, update));
      return true;
    } catch (err) {
      setError(errorMessage(err, "Could not update profile."));
      return false;
    } finally {
      setLoading(false);
    }
  }

  async function updateAvatar(avatarId: string | null) {
    if (!token) return;
    setError("");
    try {
      setUser(await api.updateAvatar(token, avatarId));
    } catch (err) {
      setError(errorMessage(err, "Could not update avatar."));
    }
  }

  async function createGoal(data: GoalCreate) {
    if (!token) return null;
    setLoading(true);
    setError("");
    try {
      const created = await api.createGoal(token, data);
      await loadDashboard(token);
      return created;
    } catch (err) {
      setError(errorMessage(err, "Could not create task."));
      return null;
    } finally {
      setLoading(false);
    }
  }

  async function updateGoal(goal: GoalOut, data: GoalCreate) {
    if (!token) return null;
    setLoading(true);
    setError("");
    try {
      const updated = await api.updateGoal(token, goal.id, data);
      await loadDashboard(token);
      return updated;
    } catch (err) {
      setError(errorMessage(err, "Could not update task."));
      return null;
    } finally {
      setLoading(false);
    }
  }

  async function setGoalCompleted(goal: GoalOut, completed: boolean) {
    if (!token || loading) return;
    setLoading(true);
    setError("");
    try {
      await api.updateGoal(token, goal.id, {
        title: goal.title,
        emoji: goal.emoji,
        notes: goal.notes,
        is_timed: goal.is_timed,
        scheduled_for: goal.scheduled_for,
        priority: goal.priority,
        completed,
      });
      await loadDashboard(token);
    } catch (err) {
      setError(errorMessage(err, "Could not update task status."));
    } finally {
      setLoading(false);
    }
  }

  async function deleteGoal(goal: GoalOut) {
    if (!token) return false;
    setLoading(true);
    setError("");
    try {
      await api.deleteGoal(token, goal.id);
      await loadDashboard(token);
      return true;
    } catch (err) {
      setError(errorMessage(err, "Could not delete task."));
      return false;
    } finally {
      setLoading(false);
    }
  }

  async function loadGoalLogs(goalId: string) {
    if (!token) return [];
    try {
      return await api.goalLogsForGoal(token, goalId);
    } catch (err) {
      setError(errorMessage(err, "Could not load journal entries."));
      return [];
    }
  }

  async function addReflection(goal: GoalOut, input: ReflectionInput) {
    if (!token || !input.reflection.trim()) return null;
    if (goal.completed) {
      setError("Completed tasks cannot receive new reflections.");
      return null;
    }
    setLoading(true);
    setError("");
    try {
      const log = await api.createGoalLog(token, goal.id, {
        completed: input.completeTask,
        reflection: input.reflection.trim(),
        soulful: input.soulful,
        emotion_label: input.emotionLabel,
      });
      if (input.completeTask) {
        await api.updateGoal(token, goal.id, {
          title: goal.title,
          emoji: goal.emoji,
          notes: goal.notes,
          is_timed: goal.is_timed,
          scheduled_for: goal.scheduled_for,
          priority: goal.priority,
          completed: true,
        });
      }
      await loadDashboard(token);
      return log;
    } catch (err) {
      setError(errorMessage(err, "Could not save journal entry."));
      return null;
    } finally {
      setLoading(false);
    }
  }

  async function markAllNotificationsRead() {
    if (!token) return;
    try {
      await api.markAllNotificationsRead(token);
      const now = new Date().toISOString();
      setNotifications((current) => current.map((item) => ({ ...item, read_at: item.read_at ?? now })));
      setUnreadNotifications(0);
    } catch (err) {
      setError(errorMessage(err, "Could not update notifications."));
    }
  }

  async function acknowledgeNotification(notification: NotificationOut) {
    if (!token) return;
    try {
      const updated = await api.acknowledgeNotification(token, notification.id);
      setNotifications((current) => current.map((item) => (item.id === updated.id ? updated : item)));
      const summary = await api.notificationSummary(token);
      setUnreadNotifications(summary.unread_count);
    } catch (err) {
      setError(errorMessage(err, "Could not acknowledge notification."));
    }
  }

  async function loadChatSessions(nextToken = token) {
    if (!nextToken) return;
    try {
      setChatSessions(await api.chatSessions(nextToken));
    } catch (err) {
      setChatError(errorMessage(err, "Could not load chat history."));
    }
  }

  async function sendCoachMessage(message: string) {
    if (!token || !message.trim() || chatLoading) return;
    const userMessage = message.trim();
    const updatedHistory: ChatMessage[] = [...chatHistory, { role: "user", content: userMessage }];
    setChatHistory(updatedHistory);
    setChatError("");
    setChatLoading(true);
    try {
      const response = await api.chat(token, userMessage, chatHistory, activeChatSessionId, activeChatGoalId);
      setActiveChatSessionId(response.session_id);
      setChatHistory([...updatedHistory, { role: "assistant", content: response.reply }]);
      await loadChatSessions(token);
    } catch (err) {
      setChatError(errorMessage(err, "Could not reach the AI assistant."));
    } finally {
      setChatLoading(false);
    }
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
    } catch (err) {
      setChatError(errorMessage(err, "Could not open chat."));
    } finally {
      setChatLoading(false);
    }
  }

  /** Prepares the Aster tab; the caller navigates to it. */
  async function openAssistant(goal?: GoalOut) {
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
    }
    await loadChatSessions();
  }

  function startNewChat() {
    setActiveChatSessionId(null);
    setActiveChatGoalId(null);
    setChatHistory([]);
    setChatError("");
  }

  async function createSupportTicket(subject: string, message: string) {
    if (!token || !user) return;
    await api.createSupportTicket(token, {
      name: user.name,
      email: user.email,
      subject: subject.trim(),
      message: message.trim(),
      source: "mobile",
    });
  }

  const latestLogByGoalId = useMemo(() => {
    return allGoalLogs.reduce<Record<string, GoalLogOut>>((latest, log) => {
      const current = latest[log.goal_id];
      if (!current || new Date(log.created_at).getTime() > new Date(current.created_at).getTime()) {
        latest[log.goal_id] = log;
      }
      return latest;
    }, {});
  }, [allGoalLogs]);

  return {
    booting,
    token,
    user,
    goals,
    allGoalLogs,
    latestLogByGoalId,
    notifications,
    unreadNotifications,
    loading,
    error,
    setError,
    backendOnline,
    checkBackend,
    login,
    signOut,
    refresh,
    saveProfile,
    updateAvatar,
    createGoal,
    updateGoal,
    setGoalCompleted,
    deleteGoal,
    loadGoalLogs,
    addReflection,
    markAllNotificationsRead,
    acknowledgeNotification,
    chatHistory,
    chatLoading,
    chatError,
    chatSessions,
    activeChatSessionId,
    activeChatGoalId,
    sendCoachMessage,
    openChatSession,
    openAssistant,
    startNewChat,
    loadChatSessions,
    createSupportTicket,
  };
}

export type AppState = ReturnType<typeof useAppStateValue>;

const AppStateContext = createContext<AppState | null>(null);

export function AppStateProvider({ children }: { children: ReactNode }) {
  const value = useAppStateValue();
  return <AppStateContext.Provider value={value}>{children}</AppStateContext.Provider>;
}

export function useAppState() {
  const value = useContext(AppStateContext);
  if (!value) throw new Error("useAppState must be used inside AppStateProvider");
  return value;
}
