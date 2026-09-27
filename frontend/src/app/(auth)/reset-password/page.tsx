"use client";

import { FormEvent, Suspense, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { AUTH_INPUT, AUTH_PRIMARY_BUTTON, AuthShell } from "@/components/auth-shell";
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

  if (!token) {
    return (
      <p className="rounded-control border border-danger/30 bg-danger-bg p-4 text-sm text-danger">
        This reset link is missing its token. Request a new link.
      </p>
    );
  }
  if (message) {
    return (
      <div className="flex flex-col gap-3">
        <p role="status" className="rounded-control border border-low/30 bg-low-bg p-4 text-sm text-low">
          {message}
        </p>
        <Link href="/login" className="text-center font-semibold text-accent-soft hover:underline">
          Sign in
        </Link>
      </div>
    );
  }
  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3">
      <label className="flex flex-col gap-1.5 text-sm font-medium text-fg">
        New password
        <input
          type="password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          required
          minLength={8}
          maxLength={72}
          autoComplete="new-password"
          placeholder="At least 8 characters"
          className={AUTH_INPUT}
        />
      </label>
      {error && (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      )}
      <button type="submit" disabled={loading} className={`mt-1 ${AUTH_PRIMARY_BUTTON}`}>
        {loading ? "Updating…" : "Update password"}
      </button>
    </form>
  );
}

export default function ResetPasswordPage() {
  return (
    <AuthShell title="Choose a new password." subtitle="Use at least eight characters.">
      <Suspense fallback={<p className="text-sm text-fg-muted">Loading…</p>}>
        <ResetPasswordForm />
      </Suspense>
    </AuthShell>
  );
}
