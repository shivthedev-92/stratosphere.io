"use client";

import { Desktop, Moon, SunHorizon, type Icon } from "@phosphor-icons/react";
import { useCallback, useEffect, useState } from "react";
import { THEME_STORAGE_KEY } from "@/lib/theme-script";

/** "system" follows the device; "night" and "dawn" are explicit overrides. */
export type ThemeChoice = "system" | "night" | "dawn";

function resolve(choice: ThemeChoice): "night" | "dawn" {
  if (choice !== "system") return choice;
  return window.matchMedia("(prefers-color-scheme: light)").matches ? "dawn" : "night";
}

function readChoice(): ThemeChoice {
  try {
    const saved = window.localStorage.getItem(THEME_STORAGE_KEY);
    if (saved === "night" || saved === "dawn" || saved === "system") return saved;
  } catch {
    // storage blocked (private mode etc.): fall back to the device setting
  }
  return "system";
}

export function useTheme(): [ThemeChoice, (choice: ThemeChoice) => void] {
  const [choice, setChoice] = useState<ThemeChoice>("system");

  // Keep the switcher's selection in sync. Applying the theme itself (device
  // changes, other tabs) is done by THEME_INIT_SCRIPT on every page.
  useEffect(() => {
    setChoice(readChoice());
    const onStorage = (event: StorageEvent) => {
      if (event.key === THEME_STORAGE_KEY || event.key === null) setChoice(readChoice());
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  const update = useCallback((next: ThemeChoice) => {
    setChoice(next);
    try {
      window.localStorage.setItem(THEME_STORAGE_KEY, next);
    } catch {
      // not persisted, but still applied for this visit
    }
    document.documentElement.dataset.theme = resolve(next);
  }, []);

  return [choice, update];
}

const OPTIONS: Array<{ value: ThemeChoice; label: string; icon: Icon }> = [
  { value: "system", label: "System", icon: Desktop },
  { value: "night", label: "Night", icon: Moon },
  { value: "dawn", label: "Dawn", icon: SunHorizon },
];

/** Segmented control: System / Night / Dawn. */
export function ThemeSwitcher({ className = "" }: { className?: string }) {
  const [choice, setChoice] = useTheme();
  return (
    <div
      role="radiogroup"
      aria-label="Theme"
      className={`grid grid-cols-3 gap-1 rounded-control border border-line bg-field p-1 ${className}`}
    >
      {OPTIONS.map(({ value, label, icon: OptionIcon }) => {
        const selected = choice === value;
        return (
          <button
            key={value}
            type="button"
            role="radio"
            aria-checked={selected}
            onClick={() => setChoice(value)}
            className={`inline-flex h-9 items-center justify-center gap-1.5 rounded-[9px] px-3 text-sm font-semibold transition-colors ${
              selected ? "bg-accent text-white" : "text-fg-muted hover:text-fg"
            }`}
          >
            <OptionIcon size={16} weight={selected ? "fill" : "regular"} aria-hidden="true" />
            {label}
          </button>
        );
      })}
    </div>
  );
}
