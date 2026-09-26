"use client";

import { FormEvent, Suspense, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { BackgroundShell } from "@/components/background-shell";
import { BrandMark } from "@/components/brand-mark";
import { api } from "@/lib/api";

function ResetPasswordForm() {
  const searchParams = useSearchParams();
  const token = searchParams.get("token") ?? "";
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError("");
    setLoading(true);
    try {
      const response = await api.confirmPasswordReset(token, password);
      setMessage(response.message);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Could not reset password");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="relative z-10 w-full max-w-md space-y-6 rounded-card border border-line bg-surface p-6 shadow-2xl shadow-tint backdrop-blur">
      <div className="text-center">
        <Link href="/" className="mb-5 inline-flex rounded-chip" aria-label="Stratosphere home">
          <BrandMark compact size="md" />
        </Link>
        <h1 className="text-2xl font-bold text-fg">Choose a new password</h1>
        <p className="mt-1 text-sm text-fg-muted">Use at least eight characters.</p>
      </div>

      {!token ? (
        <p className="rounded-control border border-danger/30 bg-danger-bg p-4 text-sm text-danger">
          This reset link is missing its token. Request a new link.
        </p>
      ) : message ? (
        <div className="space-y-4">
          <p className="rounded-control border border-low/30 bg-low-bg p-4 text-sm text-low">
            {message}
          </p>
          <Link href="/login" className="block text-center font-semibold text-accent-soft hover:text-accent-soft">
            Sign in
          </Link>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4">
          <input
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            required
            minLength={8}
            maxLength={72}
            autoComplete="new-password"
            placeholder="New password"
            className="w-full rounded-control border border-line-strong bg-field px-4 py-2 text-fg outline-none focus:border-accent"
          />
          {error && <p className="text-sm text-danger">{error}</p>}
          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-control bg-accent py-3 font-semibold text-white hover:bg-accent-hover disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {loading ? "Updating..." : "Update password"}
          </button>
        </form>
      )}
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <BackgroundShell className="flex min-h-screen items-center justify-center px-4 text-fg" showSwitcher>
      <Suspense fallback={<p className="text-fg-muted">Loading...</p>}>
        <ResetPasswordForm />
      </Suspense>
    </BackgroundShell>
  );
}
