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
  return res.json() as Promise<T>;
}

export type UserOut = {
  id: string;
  email: string;
  name: string;
  created_at: string;
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
};

export type Priority = "low" | "medium" | "high";

export type GoalOut = {
  id: string;
  title: string;
  notes: string | null;
  is_timed: boolean;
  scheduled_for: string | null;
  priority: Priority;
  created_at: string;
};

export type GoalCreate = {
  title: string;
  notes?: string | null;
  is_timed: boolean;
  scheduled_for?: string | null;
  priority: Priority;
};

export type GoalUpdate = GoalCreate;

export type GoalLogCreate = {
  completed: boolean;
  reflection: string;
  soulful?: boolean | null;
};

export type GoalLogOut = {
  id: string;
  goal_id: string;
  completed: boolean;
  reflection: string;
  soulful: boolean | null;
  created_at: string;
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

  chat: (message: string, history: ChatMessage[]) =>
    request<ChatOut>("/chat", {
      method: "POST",
      body: JSON.stringify({ message, history }),
    }),
};
