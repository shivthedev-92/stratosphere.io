"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { BackgroundShell } from "@/components/background-shell";
import { api } from "@/lib/api";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    setMessage("");
    setLoading(true);
    try {
      const response = await api.requestPasswordReset(email);
      setMessage(response.message);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Could not start password reset");
    } finally {
      setLoading(false);
    }
  }

  return (
    <BackgroundShell className="flex min-h-screen items-center justify-center px-4 text-white" showSwitcher>
      <div className="relative z-10 w-full max-w-md space-y-6 rounded-lg border border-white/10 bg-neutral-900/85 p-6 shadow-2xl shadow-black/30 backdrop-blur">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-white">Reset password</h1>
          <p className="mt-1 text-sm text-neutral-400">
            Enter your email and we will prepare a reset flow for your account.
          </p>
        </div>

        {message ? (
          <div className="rounded-lg border border-emerald-800/70 bg-emerald-950/50 p-4 text-sm text-emerald-100">
            {message}
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="mb-1 block text-sm text-neutral-300">Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                placeholder="you@example.com"
                className="w-full rounded-lg border border-neutral-700 bg-neutral-800 px-4 py-2 text-white outline-none focus:border-indigo-500"
              />
            </div>

            {error && <p className="text-sm text-red-400">{error}</p>}

            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-lg bg-indigo-600 py-3 font-semibold text-white transition-colors hover:bg-indigo-500 disabled:opacity-50"
            >
              {loading ? "Preparing..." : "Continue"}
            </button>
          </form>
        )}

        <p className="text-center text-sm text-neutral-500">
          Remembered it?{" "}
          <Link href="/login" className="text-indigo-400 hover:underline">
            Sign in
          </Link>
        </p>
      </div>
    </BackgroundShell>
  );
}
