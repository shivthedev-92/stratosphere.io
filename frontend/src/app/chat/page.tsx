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

import { useState, useRef, useEffect, FormEvent, useMemo } from "react";
import { CrisisNotice, CoachDisclaimer } from "@/components/crisis-notice";
import { chatStream } from "@/lib/api";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { BackgroundShell } from "@/components/background-shell";
import { api, type ChatMessage, type GoalLogOut, type GoalOut,
  type SafetyNoticeOut,
} from "@/lib/api";
import { CoachIllustration } from "@/components/illustrations";

const starterPrompts = [
  "Help me choose what to focus on next from my tasks.",
  "What pattern do you see in my recent reflections?",
  "Help me make today's action items feel lighter.",
];

function getGoalDate(goal: GoalOut) {
  return goal.scheduled_for ?? goal.created_at;
}

function formatTaskDate(value: string | null) {
  if (!value) return "Unscheduled";
  return new Intl.DateTimeFormat("en", {
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
}

function getLatestLogsByGoal(logs: GoalLogOut[]) {
  return logs.reduce<Record<string, GoalLogOut>>((acc, log) => {
    const current = acc[log.goal_id];
    if (!current || new Date(log.created_at).getTime() > new Date(current.created_at).getTime()) {
      acc[log.goal_id] = log;
    }
    return acc;
  }, {});
}

export default function ChatPage() {
  const router = useRouter();
  const [history, setHistory] = useState<ChatMessage[]>([]);
  // Safety notices keyed by their index in `history`, so the card renders
  // in place of the assistant bubble at that position.
  const [safetyByIndex, setSafetyByIndex] = useState<Record<number, SafetyNoticeOut>>({});
  // Text of the in-flight reply, rendered live before it lands in `history`.
  const [streaming, setStreaming] = useState("");
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [contextLoading, setContextLoading] = useState(true);
  const [error, setError] = useState("");
  const [goals, setGoals] = useState<GoalOut[]>([]);
  const [logs, setLogs] = useState<GoalLogOut[]>([]);
  const bottomRef = useRef<HTMLDivElement>(null);

  const latestLogsByGoal = useMemo(() => getLatestLogsByGoal(logs), [logs]);
  const focusGoals = useMemo(() => {
    return [...goals]
      .sort((a, b) => new Date(getGoalDate(b)).getTime() - new Date(getGoalDate(a)).getTime())
      .slice(0, 6);
  }, [goals]);
  const recentLogs = useMemo(() => {
    return [...logs]
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
      .slice(0, 5);
  }, [logs]);
  const goalsById = useMemo(() => new Map(goals.map((goal) => [goal.id, goal])), [goals]);

  useEffect(() => {
    // `streaming` is a dep so the view follows tokens as they arrive.
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [history, streaming]);

  useEffect(() => {
    async function loadContext() {
      try {
        const [goalData, logData] = await Promise.all([api.goals(), api.goalLogs()]);
        setGoals(goalData);
        setLogs(logData);
      } catch (err: unknown) {
        if (err instanceof Error && err.message.includes("401")) {
          router.push("/login");
          return;
        }
        setError(err instanceof Error ? err.message : "Could not load task context");
      } finally {
        setContextLoading(false);
      }
    }

    loadContext();
  }, [router]);

  async function sendMessage(message: string) {
    if (!message.trim() || loading) return;
    const userMessage = message.trim();
    setInput("");
    setError("");

    const updatedHistory: ChatMessage[] = [...history, { role: "user", content: userMessage }];
    setHistory(updatedHistory);
    setLoading(true);

    const assistantIndex = updatedHistory.length;
    let accumulated = "";
    let notice: SafetyNoticeOut | null = null;
    let streamError = "";

    try {
      setStreaming("");
      await chatStream(userMessage, {
        onToken: (text) => {
          accumulated += text;
          setStreaming(accumulated);
        },
        onSafety: (received) => {
          notice = received;
        },
        onError: (detail) => {
          streamError = detail;
        },
      });

      setStreaming("");
      if (accumulated) {
        setHistory([...updatedHistory, { role: "assistant", content: accumulated }]);
        if (notice) {
          setSafetyByIndex((prev) => ({ ...prev, [assistantIndex]: notice as SafetyNoticeOut }));
        }
      }
      if (streamError) setError(streamError);
    } catch (err: unknown) {
      setStreaming("");
      if (err instanceof Error && err.message.includes("401")) {
        router.push("/login");
        return;
      }
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  async function handleSend(e: FormEvent) {
    e.preventDefault();
    await sendMessage(input);
  }

  return (
    <BackgroundShell className="flex min-h-screen flex-col text-white" showSwitcher>
      <header className="flex items-center justify-between border-b border-neutral-800 px-6 py-4">
        <div>
          <p className="text-xs font-semibold uppercase text-indigo-300">Ollama life coach</p>
          <h1 className="text-lg font-semibold">AI Assistant</h1>
        </div>
        <Link href="/dashboard" className="text-sm text-neutral-400 hover:text-white transition-colors">
          ← Dashboard
        </Link>
      </header>

      <main className="mx-auto grid min-h-0 w-full max-w-6xl flex-1 grid-cols-1 gap-4 px-4 py-5 lg:grid-cols-[minmax(0,1fr)_340px]">
        <section className="flex min-h-[70vh] flex-col overflow-hidden rounded-2xl border border-neutral-800 bg-black/35">
          <div className="border-b border-neutral-800 px-5 py-4">
            <h2 className="text-base font-semibold">Task-aware chat</h2>
            <p className="mt-1 text-sm text-neutral-500">
              The coach can reference your current action items and recent journal entries.
            </p>
          </div>

          <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-4 py-6">
            {history.length === 0 && (
              <div className="mx-auto mt-4 flex max-w-lg flex-col items-center text-center">
                <CoachIllustration className="mb-5 h-40 w-full" />
                <h3 className="text-sm font-semibold text-neutral-200">Start with what is real today</h3>
                <p className="mt-2 text-sm text-neutral-500">
                  Ask about your tasks, your reflections, or what would make the next step easier.
                </p>
                <div className="mt-5 flex w-full flex-col gap-2">
                  {starterPrompts.map((prompt) => (
                    <button
                      key={prompt}
                      type="button"
                      onClick={() => sendMessage(prompt)}
                      className="rounded-xl border border-neutral-800 bg-neutral-950/80 px-4 py-3 text-left text-sm text-neutral-300 transition-colors hover:border-indigo-500 hover:text-white disabled:opacity-40"
                      disabled={loading}
                    >
                      {prompt}
                    </button>
                  ))}
                </div>
              </div>
            )}
            {history.map((msg, i) => {
              const notice = safetyByIndex[i];
              if (notice) {
                return (
                  <div key={i} className="flex justify-start">
                    <div className="max-w-[95%]">
                      <CrisisNotice notice={notice} message={msg.content} />
                    </div>
                  </div>
                );
              }
              return (
                <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                  <div
                    className={`max-w-[85%] whitespace-pre-wrap rounded-2xl px-4 py-3 text-sm leading-relaxed ${
                      msg.role === "user" ? "bg-indigo-600 text-white" : "bg-neutral-900 text-neutral-100"
                    }`}
                  >
                    {msg.content}
                  </div>
                </div>
              );
            })}
            {streaming && (
              <div className="flex justify-start">
                <div className="max-w-[85%] whitespace-pre-wrap rounded-2xl bg-neutral-900 px-4 py-3 text-sm leading-relaxed text-neutral-100">
                  {streaming}
                  <span className="ml-0.5 inline-block h-4 w-1.5 translate-y-0.5 animate-pulse bg-neutral-400" />
                </div>
              </div>
            )}
            {loading && !streaming && (
              <div className="flex justify-start">
                <div className="rounded-2xl bg-neutral-900 px-4 py-3 text-sm text-neutral-400 animate-pulse">
                  Thinking…
                </div>
              </div>
            )}
            {error && <p className="text-center text-sm text-red-400">{error}</p>}
            <div ref={bottomRef} />
          </div>

          <div className="border-t border-neutral-800 pt-3">
            <CoachDisclaimer />
          </div>

          <form onSubmit={handleSend} className="flex gap-3 px-4 pb-4">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask about today, blockers, or what to do next..."
              className="min-w-0 flex-1 rounded-xl border border-neutral-700 bg-neutral-900 px-4 py-3 text-sm text-white focus:border-indigo-500 focus:outline-none"
            />
            <button
              type="submit"
              disabled={loading || !input.trim()}
              className="rounded-xl bg-indigo-600 px-5 py-3 text-sm font-semibold text-white transition-colors hover:bg-indigo-500 disabled:opacity-40"
            >
              Send
            </button>
          </form>
        </section>

        <aside className="flex min-h-0 flex-col gap-4">
          <section className="rounded-2xl border border-neutral-800 bg-black/35 p-4">
            <div className="mb-4 flex items-start justify-between gap-3">
              <div>
                <h2 className="text-sm font-semibold text-white">Task context</h2>
                <p className="mt-1 text-xs text-neutral-500">Sent privately with each coach request.</p>
              </div>
              <span className="rounded-full border border-neutral-800 px-2 py-1 text-xs text-neutral-400">
                {goals.length} tasks
              </span>
            </div>

            <div className="max-h-[360px] space-y-3 overflow-y-auto pr-1">
              {contextLoading ? (
                <p className="text-sm text-neutral-500">Loading task context…</p>
              ) : focusGoals.length === 0 ? (
                <p className="text-sm text-neutral-500">No tasks found yet.</p>
              ) : (
                focusGoals.map((goal) => {
                  const latestLog = latestLogsByGoal[goal.id];
                  return (
                    <div key={goal.id} className="rounded-xl border border-neutral-800 bg-neutral-950/75 p-3">
                      <div className="flex items-start justify-between gap-3">
                        <p className="min-w-0 text-sm font-semibold text-neutral-100">
                          {goal.emoji ? `${goal.emoji} ` : ""}
                          {goal.title}
                        </p>
                        <span className="shrink-0 rounded-full border border-neutral-700 px-2 py-0.5 text-xs capitalize text-neutral-400">
                          {goal.priority}
                        </span>
                      </div>
                      <p className="mt-2 text-xs text-neutral-500">{formatTaskDate(goal.scheduled_for)}</p>
                      {latestLog ? (
                        <p className="mt-2 line-clamp-2 text-xs leading-relaxed text-neutral-400">
                          {latestLog.completed ? "Done" : "Open"} · {latestLog.emotion_label ?? "No emotion"} ·{" "}
                          {latestLog.reflection}
                        </p>
                      ) : (
                        <p className="mt-2 text-xs text-neutral-600">No reflection yet.</p>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </section>

          <section className="rounded-2xl border border-neutral-800 bg-black/35 p-4">
            <h2 className="text-sm font-semibold text-white">Recent reflections</h2>
            <div className="mt-4 space-y-3">
              {recentLogs.length === 0 ? (
                <p className="text-sm text-neutral-500">No journal entries yet.</p>
              ) : (
                recentLogs.map((log) => {
                  const goal = goalsById.get(log.goal_id);
                  return (
                    <div key={log.id} className="border-l border-indigo-500/60 pl-3">
                      <p className="text-xs font-semibold text-neutral-300">{goal?.title ?? "Task removed"}</p>
                      <p className="mt-1 text-xs text-neutral-500">
                        {log.completed ? "Completed" : "Not completed"} · {log.emotion_label ?? "No emotion"}
                      </p>
                    </div>
                  );
                })
              )}
            </div>
          </section>
        </aside>
      </main>
    </BackgroundShell>
  );
}
