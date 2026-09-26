"use client";

import { useState, FormEvent } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { BackgroundShell } from "@/components/background-shell";
import { api } from "@/lib/api";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await api.login(email, password);
      router.push("/dashboard");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Login failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <BackgroundShell className="flex min-h-screen items-center justify-center px-4 text-fg" showSwitcher>
      <div className="relative z-10 w-full max-w-md space-y-6 rounded-card border border-line bg-surface p-6 shadow-2xl shadow-black/30 backdrop-blur">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-fg">Welcome back</h1>
          <p className="text-fg-muted text-sm mt-1">Pick up right where you left off.</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm text-fg-muted mb-1">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              placeholder="you@example.com"
              className="w-full px-4 py-2 rounded-control bg-field text-fg border border-line-strong focus:outline-none focus:border-accent"
            />
          </div>
          <div>
            <div className="mb-1 flex items-center justify-between gap-3">
              <label className="block text-sm text-fg-muted">Password</label>
              <Link href="/forgot-password" className="text-xs font-semibold text-accent-soft hover:text-accent-soft">
                Forgot password?
              </Link>
            </div>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="w-full px-4 py-2 rounded-control bg-field text-fg border border-line-strong focus:outline-none focus:border-accent"
            />
          </div>

          {error && <p className="text-danger text-sm">{error}</p>}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 rounded-control bg-accent hover:bg-accent-hover disabled:opacity-40 disabled:cursor-not-allowed font-semibold text-white transition-colors"
          >
            {loading ? "Signing in…" : "Sign in"}
          </button>
        </form>

        <p className="text-center text-sm text-fg-subtle">
          No account yet?{" "}
          <Link href="/signup" className="text-accent-soft hover:underline">
            Create one
          </Link>
        </p>
      </div>
    </BackgroundShell>
  );
}
