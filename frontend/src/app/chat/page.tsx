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

import { useState, useRef, useEffect, FormEvent } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { api, type ChatMessage } from "@/lib/api";
import { CoachIllustration } from "@/components/illustrations";

export default function ChatPage() {
  const router = useRouter();
  const [history, setHistory] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [history]);

  async function handleSend(e: FormEvent) {
    e.preventDefault();
    if (!input.trim() || loading) return;
    const userMessage = input.trim();
    setInput("");
    setError("");

    const updatedHistory: ChatMessage[] = [...history, { role: "user", content: userMessage }];
    setHistory(updatedHistory);
    setLoading(true);

    try {
      const { reply } = await api.chat(userMessage, history);
      setHistory([...updatedHistory, { role: "assistant", content: reply }]);
    } catch (err: unknown) {
      if (err instanceof Error && err.message.includes("401")) {
        router.push("/login");
        return;
      }
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="flex flex-col min-h-screen bg-neutral-950 text-white">
      {/* Header */}
      <header className="flex items-center justify-between px-6 py-4 border-b border-neutral-800">
        <h1 className="font-semibold">AI Life Coach</h1>
        <Link href="/dashboard" className="text-sm text-neutral-400 hover:text-white transition-colors">
          ← Dashboard
        </Link>
      </header>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-6 space-y-4 max-w-2xl mx-auto w-full">
        {history.length === 0 && (
          <div className="mx-auto mt-10 flex max-w-sm flex-col items-center text-center">
            <CoachIllustration className="mb-5 h-40 w-full" />
            <h2 className="text-sm font-semibold text-neutral-200">Start with what is real today</h2>
            <p className="mt-2 text-sm text-neutral-500">
              Ask anything about your habits, goals, or day. No judgment here.
            </p>
          </div>
        )}
        {history.map((msg, i) => (
          <div
            key={i}
            className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
          >
            <div
              className={`max-w-[80%] rounded-2xl px-4 py-3 text-sm leading-relaxed ${
                msg.role === "user"
                  ? "bg-indigo-600 text-white"
                  : "bg-neutral-800 text-neutral-100"
              }`}
            >
              {msg.content}
            </div>
          </div>
        ))}
        {loading && (
          <div className="flex justify-start">
            <div className="bg-neutral-800 rounded-2xl px-4 py-3 text-sm text-neutral-400 animate-pulse">
              Thinking…
            </div>
          </div>
        )}
        {error && <p className="text-red-400 text-sm text-center">{error}</p>}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <form
        onSubmit={handleSend}
        className="border-t border-neutral-800 px-4 py-4 flex gap-3 max-w-2xl mx-auto w-full"
      >
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="What's on your mind?"
          className="flex-1 px-4 py-2 rounded-lg bg-neutral-800 text-white border border-neutral-700 focus:outline-none focus:border-indigo-500 text-sm"
        />
        <button
          type="submit"
          disabled={loading || !input.trim()}
          className="px-5 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 font-semibold text-sm transition-colors"
        >
          Send
        </button>
      </form>
    </main>
  );
}
