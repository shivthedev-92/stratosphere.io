"use client";

import { useEffect, useState, FormEvent } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { AUTH_INPUT, AUTH_PRIMARY_BUTTON, AuthShell, OrDivider } from "@/components/auth-shell";
import { OAuthButtons, oauthErrorMessage, useAuthConfig } from "@/components/oauth-buttons";
import { api } from "@/lib/api";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const { config } = useAuthConfig();
  const [providerError, setProviderError] = useState("");

  // A failed Google/Microsoft sign-in comes back as /login?error=<code>.
  useEffect(() => {
    const code = new URLSearchParams(window.location.search).get("error");
    if (code) setProviderError(oauthErrorMessage(code));
  }, []);

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
    <AuthShell
      title="A calmer way to finish your day."
      subtitle="Sign in to plan today's action items and pick up where you left off."
    >
      {providerError ? (
        <p role="alert" className="rounded-control border border-danger/30 bg-danger-bg px-3 py-2 text-sm text-danger">
          {providerError}
        </p>
      ) : null}

      {/* TODO(sign-in-with-apple): the handoff shows "Continue with Apple". It needs the paid Apple
          Developer Program and a backend provider; Google and Microsoft are the live options today. */}
      {config && config.providers.length > 0 ? (
        <>
          <OAuthButtons providers={config.providers} />
          <OrDivider label="or sign in with your password" />
        </>
      ) : null}

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
        <label className="flex flex-col gap-1.5 text-sm font-medium text-fg">
          <span className="flex items-center justify-between gap-3">
            Password
            <Link href="/forgot-password" className="text-xs font-semibold text-accent-soft hover:underline">
              Forgot password?
            </Link>
          </span>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            autoComplete="current-password"
            className={AUTH_INPUT}
          />
        </label>

        {error && (
          <p role="alert" className="text-sm text-danger">
            {error}
          </p>
        )}

        <button type="submit" disabled={loading} className={`mt-1 ${AUTH_PRIMARY_BUTTON}`}>
          {loading ? "Signing in…" : "Sign in"}
        </button>
      </form>

      <p className="pt-1 text-center text-sm text-fg-muted">
        New to Stratosphere?{" "}
        <Link href="/signup" className="font-semibold text-accent-soft hover:underline">
          Create an account
        </Link>
      </p>
    </AuthShell>
  );
}
