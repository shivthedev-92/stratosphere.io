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
    <BackgroundShell className="flex min-h-screen items-center justify-center px-4 text-fg" showSwitcher>
      <div className="relative z-10 w-full max-w-md space-y-6 rounded-card border border-line bg-surface p-6 shadow-2xl shadow-tint backdrop-blur">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-fg">Reset password</h1>
          <p className="mt-1 text-sm text-fg-muted">
            Enter your email and we will prepare a reset flow for your account.
          </p>
        </div>

        {message ? (
          <div className="rounded-control border border-low/30 bg-low-bg p-4 text-sm text-low">
            {message}
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="mb-1 block text-sm text-fg-muted">Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                placeholder="you@example.com"
                className="w-full rounded-control border border-line-strong bg-field px-4 py-2 text-fg outline-none focus:border-accent"
              />
            </div>

            {error && <p className="text-sm text-danger">{error}</p>}

            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-control bg-accent py-3 font-semibold text-white transition-colors hover:bg-accent-hover disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {loading ? "Preparing..." : "Continue"}
            </button>
          </form>
        )}

        <p className="text-center text-sm text-fg-subtle">
          Remembered it?{" "}
          <Link href="/login" className="text-accent-soft hover:underline">
            Sign in
          </Link>
        </p>
      </div>
    </BackgroundShell>
  );
}
