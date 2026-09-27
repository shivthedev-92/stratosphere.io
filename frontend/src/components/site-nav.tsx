"use client";

import Link from "next/link";
import { Moon, Sun } from "@phosphor-icons/react";
import { StrataSymbol } from "@/components/brand-mark";
import { useTheme } from "@/components/theme";

// "For teams" from the handoff is left out until that page exists.
const LINKS = [
  { href: "/#screens", label: "Screens" },
  { href: "/#aster", label: "Aster, your coach" },
  { href: "/#contact", label: "Contact" },
];

/** Top bar of the landing and sign-in pages (design/handoff-landing §1). */
export function SiteNav() {
  const [, setTheme] = useTheme();

  function toggleTheme() {
    // Flip whatever is showing now; the choice is saved like the Settings one.
    setTheme(document.documentElement.dataset.theme === "dawn" ? "night" : "dawn");
  }

  return (
    <nav className="absolute inset-x-0 top-0 z-[5]">
      <div className="mx-auto flex h-[76px] max-w-[1240px] items-center justify-between gap-6 px-4 sm:px-8">
        <Link href="/" className="flex items-center gap-2.5 rounded-chip text-fg" aria-label="Stratosphere home">
          <StrataSymbol size={30} className="text-accent-soft" />
          <span className="text-[19px] font-semibold tracking-[-0.02em]">Stratosphere</span>
        </Link>

        <div className="hidden items-center gap-8 md:flex">
          {LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="text-[15px] font-medium text-fg-muted transition-colors duration-200 hover:text-fg"
            >
              {link.label}
            </Link>
          ))}
        </div>

        <div className="flex items-center gap-2 sm:gap-4">
          <button
            type="button"
            onClick={toggleTheme}
            aria-label="Switch between Night and Dawn"
            className="grid h-10 w-10 place-items-center rounded-control border border-line bg-[var(--btn2)] text-fg transition-colors duration-200 hover:border-fg-subtle"
          >
            <Sun size={18} aria-hidden="true" className="only-night" />
            <Moon size={18} aria-hidden="true" className="only-dawn" />
          </button>
          <Link href="/login" className="hidden text-[15px] font-medium text-fg hover:text-fg-muted sm:inline">
            Sign in
          </Link>
          <Link
            href="/signup"
            className="inline-flex h-10 items-center rounded-control bg-accent px-4 text-[15px] font-semibold text-white transition-colors duration-200 hover:bg-accent-hover"
          >
            Get started
          </Link>
        </div>
      </div>
    </nav>
  );
}
