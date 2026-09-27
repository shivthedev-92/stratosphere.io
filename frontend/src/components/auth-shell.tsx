import type { ReactNode } from "react";
import { EarthLimb, HeroSky } from "@/components/hero-sky";
import { SiteNav } from "@/components/site-nav";

/**
 * Sign-in card layout (design/handoff-landing §1b), shared by login, signup,
 * forgot-password and reset-password: the landing sky, a short headline, and
 * a glass card holding the page's form.
 */
export function AuthShell({
  title,
  subtitle,
  children,
  below,
}: {
  title: string;
  subtitle: ReactNode;
  children: ReactNode;
  below?: ReactNode;
}) {
  return (
    <div className="min-h-screen bg-canvas text-fg">
      <section className="hero-sky relative min-h-[max(100vh,900px)] overflow-hidden pb-56">
        <HeroSky />
        <EarthLimb />
        <SiteNav />
        {/* The handoff's 560px column excludes its padding; ours includes it. */}
        <main className="relative z-[3] mx-auto flex max-w-[608px] flex-col items-center gap-6 px-6 pt-28 text-center sm:pt-32">
          <h1 className="m-0 text-[38px] font-semibold leading-[1.05] tracking-[-0.04em] [text-wrap:balance] sm:text-[52px]">
            {title}
          </h1>
          <p className="m-0 max-w-[520px] text-[17px] leading-[1.55] text-fg-muted [text-wrap:balance]">{subtitle}</p>
          <div
            className="flex w-full max-w-[420px] flex-col gap-3 rounded-panel border border-line bg-surface p-6 text-left backdrop-blur-xl sm:p-7"
            style={{ boxShadow: "var(--card-shadow)" }}
          >
            {children}
          </div>
          {below}
        </main>
      </section>
    </div>
  );
}

/** "or" rule between the provider buttons and the password form. */
export function OrDivider({ label = "or" }: { label?: string }) {
  return (
    <div className="flex items-center gap-3 py-1 text-[13px] text-fg-subtle">
      <span className="h-px flex-1 bg-line" />
      {label}
      <span className="h-px flex-1 bg-line" />
    </div>
  );
}

/** Shared field styling: 50px, radius 14, accent focus ring. */
export const AUTH_INPUT =
  "h-[50px] w-full rounded-[14px] border border-line bg-field px-4 text-base text-fg outline-none transition-shadow duration-200 placeholder:text-fg-subtle focus:border-accent focus:shadow-[0_0_0_3px_color-mix(in_srgb,var(--color-accent)_20%,transparent)]";

export const AUTH_PRIMARY_BUTTON =
  "h-[50px] w-full rounded-[14px] bg-accent text-base font-semibold text-white transition-colors duration-200 hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-40";
