const BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000";

function getToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("token");
}

export function saveToken(token: string): void {
  localStorage.setItem("token", token);
}

export function clearToken(): void {
  localStorage.removeItem("token");
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const token = getToken();
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(init.headers as Record<string, string>),
  };
  if (token) headers["Authorization"] = `Bearer ${token}`;

  const res = await fetch(`${BASE_URL}${path}`, { ...init, headers });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body?.detail ?? `HTTP ${res.status}`);
  }
  if (res.status === 204) {
    return undefined as T;
  }
  const text = await res.text();
  return (text ? JSON.parse(text) : undefined) as T;
}

export type UserOut = {
  id: string;
  email: string;
  name: string;
  phone_number: string | null;
  date_of_birth: string | null;
  in_app_notifications_enabled: boolean;
  created_at: string;
};

export type UserUpdate = {
  name: string;
  phone_number?: string | null;
  date_of_birth?: string | null;
  in_app_notifications_enabled: boolean;
};

export type TokenOut = {
  access_token: string;
  token_type: string;
};

export type MessageOut = {
  message: string;
};

export type ChatMessage = {
  role: "user" | "assistant";
  content: string;
};

export type ChatOut = {
  reply: string;
  session_id: string;
};

export type ChatSessionOut = {
  id: string;
  title: string;
  goal_id: string | null;
  created_at: string;
  updated_at: string;
};

export type ChatMessageOut = ChatMessage & {
  id: string;
  created_at: string;
};

export type ChatSessionDetailOut = ChatSessionOut & {
  messages: ChatMessageOut[];
};

export type Priority = "low" | "medium" | "high";
export type EmotionLabel =
  | "happy"
  | "sad"
  | "excited"
  | "calm"
  | "anxious"
  | "overwhelmed"
  | "hopeful"
  | "tired"
  | "unable_to_describe"
  | "other";

export type GoalOut = {
  id: string;
  title: string;
  emoji: string | null;
  notes: string | null;
  is_timed: boolean;
  scheduled_for: string | null;
  priority: Priority;
  completed: boolean;
  completed_at: string | null;
  created_at: string;
};

export type GoalCreate = {
  title: string;
  emoji?: string | null;
  notes?: string | null;
  is_timed: boolean;
  scheduled_for?: string | null;
  priority: Priority;
};

export type GoalUpdate = GoalCreate & {
  completed?: boolean | null;
};

export type GoalLogCreate = {
  completed: boolean;
  reflection: string;
  soulful?: boolean | null;
  emotion_label?: EmotionLabel | null;
};

export type GoalLogOut = {
  id: string;
  goal_id: string;
  completed: boolean;
  reflection: string;
  soulful: boolean | null;
  emotion_label: EmotionLabel | null;
  created_at: string;
};

export type NotificationOut = {
  id: string;
  title: string;
  body: string;
  category: string;
  due_at: string | null;
  acknowledged_at: string | null;
  read_at: string | null;
  created_at: string;
};

export type NotificationSummaryOut = {
  unread_count: number;
};

export const api = {
  signup: (email: string, password: string, name: string) =>
    request<TokenOut>("/auth/signup", {
      method: "POST",
      body: JSON.stringify({ email, password, name }),
    }),

  login: (email: string, password: string) =>
    request<TokenOut>("/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    }),

  requestPasswordReset: (email: string) =>
    request<MessageOut>("/auth/password-reset/request", {
      method: "POST",
      body: JSON.stringify({ email }),
    }),

  me: () => request<UserOut>("/me"),

  updateMe: (data: UserUpdate) =>
    request<UserOut>("/me", {
      method: "PATCH",
      body: JSON.stringify(data),
    }),

  notifications: () => request<NotificationOut[]>("/notifications"),

  dueNotifications: () => request<NotificationOut[]>("/notifications/due"),

  notificationSummary: () => request<NotificationSummaryOut>("/notifications/summary"),

  markNotificationRead: (notificationId: string) =>
    request<NotificationOut>(`/notifications/${notificationId}/read`, {
      method: "PATCH",
    }),

  acknowledgeNotification: (notificationId: string) =>
    request<NotificationOut>(`/notifications/${notificationId}/acknowledge`, {
      method: "PATCH",
    }),

  markAllNotificationsRead: () =>
    request<NotificationSummaryOut>("/notifications/read-all", {
      method: "PATCH",
    }),

  goals: () => request<GoalOut[]>("/goals"),

  goal: (goalId: string) => request<GoalOut>(`/goals/${goalId}`),

  goalLogs: () => request<GoalLogOut[]>("/goals/logs"),

  goalLogsForGoal: (goalId: string) => request<GoalLogOut[]>(`/goals/${goalId}/logs`),

  createGoal: (goal: GoalCreate) =>
    request<GoalOut>("/goals", {
      method: "POST",
      body: JSON.stringify(goal),
    }),

  updateGoal: (goalId: string, goal: GoalUpdate) =>
    request<GoalOut>(`/goals/${goalId}`, {
      method: "PATCH",
      body: JSON.stringify(goal),
    }),

  deleteGoal: (goalId: string) =>
    request<void>(`/goals/${goalId}`, {
      method: "DELETE",
    }),

  createGoalLog: (goalId: string, log: GoalLogCreate) =>
    request<GoalLogOut>(`/goals/${goalId}/logs`, {
      method: "POST",
      body: JSON.stringify(log),
    }),

  chatSessions: () => request<ChatSessionOut[]>("/chat/sessions"),

  chatSession: (sessionId: string) => request<ChatSessionDetailOut>(`/chat/sessions/${sessionId}`),

  createChatSession: (data: { title?: string | null; goal_id?: string | null }) =>
    request<ChatSessionOut>("/chat/sessions", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  chat: (message: string, history: ChatMessage[], sessionId?: string | null, goalId?: string | null) =>
    request<ChatOut>("/chat", {
      method: "POST",
      body: JSON.stringify({ message, history, session_id: sessionId ?? null, goal_id: goalId ?? null }),
    }),
};
