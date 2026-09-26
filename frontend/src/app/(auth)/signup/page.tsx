"use client";

import { useState, FormEvent } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { BackgroundShell } from "@/components/background-shell";
import { api } from "@/lib/api";

export default function SignupPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await api.signup(email, password, name);
      router.push("/dashboard");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Signup failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <BackgroundShell className="flex min-h-screen items-center justify-center px-4 text-fg" showSwitcher>
      <div className="relative z-10 w-full max-w-md space-y-6 rounded-card border border-line bg-surface p-6 shadow-2xl shadow-tint backdrop-blur">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-fg">Create your account</h1>
          <p className="text-fg-muted text-sm mt-1">Start your journey — guilt-free.</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm text-fg-muted mb-1">What should we call you?</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              placeholder="Your name"
              className="w-full px-4 py-2 rounded-control bg-field text-fg border border-line-strong focus:outline-none focus:border-accent"
            />
          </div>
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
            <label className="block text-sm text-fg-muted mb-1">Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={8}
              placeholder="At least 8 characters"
              className="w-full px-4 py-2 rounded-control bg-field text-fg border border-line-strong focus:outline-none focus:border-accent"
            />
          </div>

          {error && <p className="text-danger text-sm">{error}</p>}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 rounded-control bg-accent hover:bg-accent-hover disabled:opacity-40 disabled:cursor-not-allowed font-semibold text-white transition-colors"
          >
            {loading ? "Creating account…" : "Create account"}
          </button>
        </form>

        <p className="text-center text-xs leading-5 text-fg-subtle">
          By creating an account, you acknowledge the{" "}
          <Link href="/privacy" className="text-accent-soft hover:underline">privacy notice</Link>.
        </p>

        <p className="text-center text-sm text-fg-subtle">
          Already have an account?{" "}
          <Link href="/login" className="text-accent-soft hover:underline">
            Sign in
          </Link>
        </p>
      </div>
    </BackgroundShell>
  );
}
