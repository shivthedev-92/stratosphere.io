"use client";

import { FormEvent, Suspense, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { BackgroundShell } from "@/components/background-shell";
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
    <div className="relative z-10 w-full max-w-md space-y-6 rounded-lg border border-white/10 bg-neutral-900/85 p-6 shadow-2xl shadow-black/30 backdrop-blur">
      <div className="text-center">
        <h1 className="text-2xl font-bold text-white">Choose a new password</h1>
        <p className="mt-1 text-sm text-neutral-400">Use at least eight characters.</p>
      </div>

      {!token ? (
        <p className="rounded-lg border border-red-800 bg-red-950/50 p-4 text-sm text-red-100">
          This reset link is missing its token. Request a new link.
        </p>
      ) : message ? (
        <div className="space-y-4">
          <p className="rounded-lg border border-emerald-800 bg-emerald-950/50 p-4 text-sm text-emerald-100">
            {message}
          </p>
          <Link href="/login" className="block text-center font-semibold text-indigo-300 hover:text-indigo-200">
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
            className="w-full rounded-lg border border-neutral-700 bg-neutral-800 px-4 py-2 text-white outline-none focus:border-indigo-500"
          />
          {error && <p className="text-sm text-red-400">{error}</p>}
          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-lg bg-indigo-600 py-3 font-semibold text-white hover:bg-indigo-500 disabled:opacity-50"
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
    <BackgroundShell className="flex min-h-screen items-center justify-center px-4 text-white" showSwitcher>
      <Suspense fallback={<p className="text-neutral-300">Loading...</p>}>
        <ResetPasswordForm />
      </Suspense>
    </BackgroundShell>
  );
}
