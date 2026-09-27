"use client";

import { useState, FormEvent } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { AUTH_INPUT, AUTH_PRIMARY_BUTTON, AuthShell, OrDivider } from "@/components/auth-shell";
import { OAuthButtons, useAuthConfig } from "@/components/oauth-buttons";
import { api } from "@/lib/api";

export default function SignupPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const { config, failed } = useAuthConfig();

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
    <AuthShell
      title="Start your calmer day."
      subtitle="Create your account with Google or Microsoft. It takes a few seconds."
    >
      {config && config.providers.length > 0 ? <OAuthButtons providers={config.providers} /> : null}
      {config && config.providers.length === 0 && !config.password_signup ? (
        <p className="text-center text-sm text-fg-muted">Sign-up is closed right now. Please check back soon.</p>
      ) : null}
      {failed ? (
        <p role="alert" className="text-center text-sm text-danger">
          We couldn&apos;t load the sign-up options. Refresh the page to try again.
        </p>
      ) : null}

      {/* Password sign-up is off in production: new accounts use Google or Microsoft. */}
      {config?.password_signup ? (
        <>
          <OrDivider label="or sign up with email" />
          <form onSubmit={handleSubmit} className="flex flex-col gap-3">
            <label className="flex flex-col gap-1.5 text-sm font-medium text-fg">
              What should we call you?
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                autoComplete="name"
                placeholder="Your name"
                className={AUTH_INPUT}
              />
            </label>
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
              Password
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={8}
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
              {loading ? "Creating account…" : "Create account"}
            </button>
          </form>
        </>
      ) : null}

      <p className="pt-1 text-center text-xs leading-5 text-fg-subtle">
        By continuing, you acknowledge the{" "}
        <Link href="/privacy" className="text-accent-soft hover:underline">
          privacy notice
        </Link>
        .
      </p>
      <p className="text-center text-sm text-fg-muted">
        Already have an account?{" "}
        <Link href="/login" className="font-semibold text-accent-soft hover:underline">
          Sign in
        </Link>
      </p>
    </AuthShell>
  );
}
