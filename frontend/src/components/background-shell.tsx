"use client";

import type { ReactNode } from "react";
import { useState } from "react";
import { List } from "@phosphor-icons/react";
import { ThemeSwitcher } from "@/components/theme";

type BackgroundShellProps = {
  children: ReactNode;
  className: string;
  showSwitcher?: boolean;
};

/**
 * Page wrapper with the theme's scene background (Night sky or Dawn sunrise,
 * see .signature-bg in globals.css). The optional menu switches the theme.
 */
export function BackgroundShell({ children, className, showSwitcher = false }: BackgroundShellProps) {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <main className={`signature-bg ${className}`}>
      {showSwitcher && (
        <div className="absolute right-4 top-4 z-20">
          <button
            type="button"
            onClick={() => setMenuOpen((current) => !current)}
            aria-expanded={menuOpen}
            aria-label="Open appearance menu"
            className="grid h-10 w-10 place-items-center rounded-control border border-line bg-surface text-fg shadow-lg shadow-tint backdrop-blur transition hover:border-fg-subtle"
          >
            <List size={20} aria-hidden="true" />
          </button>
          {menuOpen && (
            <div className="absolute right-0 mt-2 w-72 rounded-card border border-line bg-surface-solid p-4 shadow-2xl shadow-tint">
              <p className="text-sm font-semibold text-fg">Appearance</p>
              <p className="mb-3 mt-1 text-xs text-fg-subtle">Night sky or dawn. System follows your device.</p>
              <ThemeSwitcher />
            </div>
          )}
        </div>
      )}
      {children}
    </main>
  );
}
