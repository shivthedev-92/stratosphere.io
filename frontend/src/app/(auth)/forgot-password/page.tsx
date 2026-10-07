"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { AUTH_INPUT, AUTH_PRIMARY_BUTTON, AuthShell } from "@/components/auth-shell";
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
    <AuthShell
      title="Reset your password."
      subtitle="Enter the email you signed up with and we'll send you a reset link."
    >
      {message ? (
        <p role="status" className="rounded-control border border-low/30 bg-low-bg p-4 text-sm text-low">
          {message}
        </p>
      ) : (
        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          <label className="flex flex-col gap-1.5 text-sm font-medium text-fg">
            Email
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
              placeholder="you@example.com"
              className={AUTH_INPUT}
            />
          </label>
          {error && (
            <p role="alert" className="text-sm text-danger">
              {error}
            </p>
          )}
          <button type="submit" disabled={loading} className={`mt-1 ${AUTH_PRIMARY_BUTTON}`}>
            {loading ? "Preparing…" : "Continue"}
          </button>
        </form>
      )}
      <p className="text-center text-xs text-fg-subtle">
        Signed up with Google or Microsoft? There&apos;s no password to reset; we&apos;ll email you
        a reminder of how you sign in.
      </p>
      <p className="pt-1 text-center text-sm text-fg-muted">
        Remembered it?{" "}
        <Link href="/login" className="font-semibold text-accent-soft hover:underline">
          Sign in
        </Link>
      </p>
    </AuthShell>
  );
}
