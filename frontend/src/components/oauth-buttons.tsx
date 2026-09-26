"use client";

import { useEffect, useState } from "react";
import { api, oauthStartUrl, type AuthConfigOut, type OAuthProvider } from "@/lib/api";

/** Messages for the ?error= codes the API sends back to /login. */
const OAUTH_ERRORS: Record<string, string> = {
  oauth_cancelled: "Sign-in was cancelled.",
  oauth_expired: "That sign-in took too long. Please try again.",
  oauth_failed: "We couldn't complete sign-in. Please try again.",
  email_unverified: "Your Google account's email address isn't verified yet.",
  work_account:
    "Work or school Microsoft accounts aren't supported. Use a personal Microsoft account (Outlook, Hotmail, Live) or Google.",
  no_email: "Your account didn't share an email address, so we couldn't sign you in.",
  email_domain: "Sign-in isn't available for that email address.",
};

export function oauthErrorMessage(code: string | null): string {
  if (!code) return "";
  return OAUTH_ERRORS[code] ?? OAUTH_ERRORS.oauth_failed;
}

/** Loads /auth/config: which providers are on and whether password sign-up is open. */
export function useAuthConfig() {
  const [config, setConfig] = useState<AuthConfigOut | null>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    let cancelled = false;
    api
      .authConfig()
      .then((data) => {
        if (!cancelled) setConfig(data);
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);
  return { config, failed };
}

function GoogleLogo() {
  return (
    <svg viewBox="0 0 48 48" width="18" height="18" aria-hidden="true" focusable="false">
      <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
      <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
      <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
      <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
    </svg>
  );
}

function MicrosoftLogo() {
  return (
    <svg viewBox="0 0 21 21" width="18" height="18" aria-hidden="true" focusable="false">
      <rect x="1" y="1" width="9" height="9" fill="#F25022" />
      <rect x="11" y="1" width="9" height="9" fill="#7FBA00" />
      <rect x="1" y="11" width="9" height="9" fill="#00A4EF" />
      <rect x="11" y="11" width="9" height="9" fill="#FFB900" />
    </svg>
  );
}

const PROVIDERS: Record<OAuthProvider, { label: string; logo: () => React.ReactElement; className: string }> = {
  google: { label: "Continue with Google", logo: GoogleLogo, className: "oauth-google" },
  microsoft: { label: "Continue with Microsoft", logo: MicrosoftLogo, className: "oauth-microsoft" },
};

/**
 * Brand-styled sign-in buttons (light and dark variants follow Google's and
 * Microsoft's button guidelines; colours live in globals.css). They are plain
 * links: sign-in is a full-page redirect to the provider and back.
 */
export function OAuthButtons({ providers }: { providers: OAuthProvider[] }) {
  return (
    <div className="grid gap-3">
      {providers.map((provider) => {
        const { label, logo: Logo, className } = PROVIDERS[provider];
        return (
          <a
            key={provider}
            href={oauthStartUrl(provider)}
            className={`${className} flex h-11 items-center justify-center gap-3 rounded-control border px-4 text-sm font-semibold transition-colors`}
          >
            <Logo />
            <span>{label}</span>
          </a>
        );
      })}
    </div>
  );
}
