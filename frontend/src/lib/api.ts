const BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000";

export type ProgressDailyOut = {
  timezone: string;
  start: string;
  end: string;
  days: { date: string; done: number; not_done: number; meaningful: number }[];
};

export type OAuthProvider = "google" | "microsoft";

export type AuthConfigOut = {
  providers: OAuthProvider[];
  password_signup: boolean;
};

/** Full-page navigation target that starts Google / Microsoft sign-in. */
export function oauthStartUrl(provider: OAuthProvider): string {
  return `${BASE_URL}/auth/oauth/${provider}/start`;
}

export function clearToken(): void {
  // Remove tokens created by older versions. Current web auth uses an HttpOnly cookie.
  localStorage.removeItem("token");
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(init.headers as Record<string, string>),
  };
  const res = await fetch(`${BASE_URL}${path}`, { ...init, headers, credentials: "include" });
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
  avatar_id: string | null;
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

export type CrisisResourceOut = {
  name: string;
  numbers: string[];
  hours: string;
  note: string;
};

/** Present only when the message tripped crisis detection on the server.
 *  When set, `reply` is fixed human-authored copy and the AI coach was
 *  never called. Render it distinctly - never as a normal chat bubble. */
export type SafetyNoticeOut = {
  kind: "crisis";
  emergency_number: string;
  resources: CrisisResourceOut[];
};

export type ChatOut = {
  reply: string;
  session_id: string;
  safety?: SafetyNoticeOut | null;
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

export type TelegramStatusOut = {
  available: boolean;
  linked: boolean;
  linked_at: string | null;
};

export type TelegramLinkOut = {
  url: string;
  expires_at: string;
};

export type GoalLogOut = {
  id: string;
  goal_id: string;
  completed: boolean;
  reflection: string;
  soulful: boolean | null;
  emotion_label: EmotionLabel | null;
  created_at: string;
  /** Additive only - the reflection is always saved regardless. */
  safety?: SafetyNoticeOut | null;
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

export type SupportTicketCreate = {
  name?: string | null;
  email?: string | null;
  subject: string;
  message: string;
  source: "web" | "mobile" | "marketing";
};

export type SupportTicketOut = SupportTicketCreate & {
  id: string;
  status: string;
  created_at: string;
};


/**
 * Streams a coach reply over Server-Sent Events.
 *
 * Falls back to nothing clever: the caller gets `onToken` for each chunk,
 * `onSafety` if the crisis gate fired (in which case no model ran), and
 * `onError` for a server-sent error frame. Resolves with the session id.
 */
export async function chatStream(
  message: string,
  opts: {
    sessionId?: string | null;
    goalId?: string | null;
    /** Sent as a fallback; the server prefers the stored session history. */
    history?: ChatMessage[];
    onToken: (text: string) => void;
    onSafety?: (notice: SafetyNoticeOut) => void;
    onError?: (detail: string) => void;
    signal?: AbortSignal;
  },
): Promise<string | null> {
  const res = await fetch(`${BASE_URL}/chat/stream`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    signal: opts.signal,
    body: JSON.stringify({
      message,
      session_id: opts.sessionId ?? null,
      goal_id: opts.goalId ?? null,
      history: (opts.history ?? []).slice(-20),
    }),
  });
  if (!res.ok || !res.body) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body?.detail ?? `HTTP ${res.status}`);
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let sessionId: string | null = null;

  const handleFrame = (frame: string) => {
    let event = "message";
    const dataLines: string[] = [];
    for (const line of frame.split("\n")) {
      if (line.startsWith("event: ")) event = line.slice(7).trim();
      else if (line.startsWith("data: ")) dataLines.push(line.slice(6));
    }
    if (!dataLines.length) return;
    let payload: Record<string, unknown>;
    try {
      payload = JSON.parse(dataLines.join("\n"));
    } catch {
      return;
    }
    if (event === "token") opts.onToken(String(payload.text ?? ""));
    else if (event === "safety") opts.onSafety?.(payload as unknown as SafetyNoticeOut);
    else if (event === "error") opts.onError?.(String(payload.detail ?? "Something went wrong"));
    else if (event === "done") sessionId = (payload.session_id as string) ?? null;
  };

  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    // SSE frames are separated by a blank line.
    let split: number;
    while ((split = buffer.indexOf("\n\n")) !== -1) {
      handleFrame(buffer.slice(0, split));
      buffer = buffer.slice(split + 2);
    }
  }
  if (buffer.trim()) handleFrame(buffer);
  return sessionId;
}

export const api = {
  authConfig: () => request<AuthConfigOut>("/auth/config"),

  progressDaily: (timeZone: string) =>
    request<ProgressDailyOut>(`/progress/daily?tz=${encodeURIComponent(timeZone)}&days=371`),

  telegramStatus: () => request<TelegramStatusOut>("/me/telegram"),
  telegramLink: () => request<TelegramLinkOut>("/me/telegram/link", { method: "POST" }),
  telegramUnlink: () => request<void>("/me/telegram", { method: "DELETE" }),
  telegramTest: () => request<void>("/me/telegram/test", { method: "POST" }),
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

  logout: () => request<void>("/auth/logout", { method: "POST" }),

  requestPasswordReset: (email: string) =>
    request<MessageOut>("/auth/password-reset/request", {
      method: "POST",
      body: JSON.stringify({ email }),
    }),

  confirmPasswordReset: (token: string, password: string) =>
    request<MessageOut>("/auth/password-reset/confirm", {
      method: "POST",
      body: JSON.stringify({ token, password }),
    }),

  me: () => request<UserOut>("/me"),

  updateMe: (data: UserUpdate) =>
    request<UserOut>("/me", {
      method: "PATCH",
      body: JSON.stringify(data),
    }),

  updateAvatar: (avatarId: string | null) =>
    request<UserOut>("/me/avatar", {
      method: "PUT",
      body: JSON.stringify({ avatar_id: avatarId }),
    }),

  deleteMe: () => request<void>("/me", { method: "DELETE" }),

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

  createSupportTicket: (ticket: SupportTicketCreate) =>
    request<SupportTicketOut>("/support/tickets", {
      method: "POST",
      body: JSON.stringify(ticket),
    }),
};
