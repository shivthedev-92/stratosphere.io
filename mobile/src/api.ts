import { API_BASE_URL } from "./config";

export type TokenOut = {
  access_token: string;
  token_type: string;
};

export type UserOut = {
  id: string;
  email: string;
  name: string;
  created_at: string;
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

async function request<T>(path: string, token?: string, init: RequestInit = {}): Promise<T> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(init.headers as Record<string, string> | undefined),
  };

  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    headers,
  });

  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(body?.detail ?? `HTTP ${response.status}`);
  }

  return response.json() as Promise<T>;
}

export const api = {
  health: () => request<{ ok: boolean }>("/health"),

  login: (email: string, password: string) =>
    request<TokenOut>("/auth/login", undefined, {
      method: "POST",
      body: JSON.stringify({ email, password }),
    }),

  me: (token: string) => request<UserOut>("/me", token),

  goals: (token: string) => request<GoalOut[]>("/goals", token),

  goalLogsForGoal: (token: string, goalId: string) =>
    request<GoalLogOut[]>(`/goals/${goalId}/logs`, token),

  createGoalLog: (token: string, goalId: string, log: GoalLogCreate) =>
    request<GoalLogOut>(`/goals/${goalId}/logs`, token, {
      method: "POST",
      body: JSON.stringify(log),
    }),
};
