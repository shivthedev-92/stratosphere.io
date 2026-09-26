"use client";

import type { CSSProperties, ReactNode } from "react";
import { useEffect, useState } from "react";
import { List } from "@phosphor-icons/react";
import { BACKGROUND_OPTIONS } from "@/components/background-options";

const STORAGE_KEY = "stratosphere-background";

type BackgroundShellProps = {
  children: ReactNode;
  className: string;
  showSwitcher?: boolean;
};

export function BackgroundShell({
  children,
  className,
  showSwitcher = false,
}: BackgroundShellProps) {
  const [selectedId, setSelectedId] = useState(BACKGROUND_OPTIONS[0].id);
  const [menuOpen, setMenuOpen] = useState(false);
  const selected = BACKGROUND_OPTIONS.find((option) => option.id === selectedId) ?? BACKGROUND_OPTIONS[0];
  const style = {
    "--signature-image": selected.image ? `url(${selected.image})` : "linear-gradient(transparent, transparent)",
  } as CSSProperties;

  useEffect(() => {
    const saved = window.localStorage.getItem(STORAGE_KEY);
    if (saved && BACKGROUND_OPTIONS.some((option) => option.id === saved)) {
      setSelectedId(saved);
    }
  }, []);

  function selectBackground(id: string) {
    setSelectedId(id);
    window.localStorage.setItem(STORAGE_KEY, id);
    setMenuOpen(false);
  }

  return (
    <main className={`signature-bg ${className}`} style={style}>
      {showSwitcher && (
        <div className="absolute right-4 top-4 z-20">
          <button
            type="button"
            onClick={() => setMenuOpen((current) => !current)}
            aria-expanded={menuOpen}
            aria-label="Open appearance menu"
            className="grid h-10 w-10 place-items-center rounded-lg border border-white/10 bg-neutral-950/65 text-lg font-semibold text-white shadow-lg shadow-black/20 backdrop-blur transition hover:border-white/30"
          >
            <List size={20} aria-hidden="true" />
          </button>

          {menuOpen && (
            <div className="absolute right-0 mt-2 w-64 rounded-lg border border-white/10 bg-neutral-950/85 p-3 shadow-2xl shadow-black/35 backdrop-blur">
              <div className="mb-3">
                <p className="text-sm font-semibold text-white">Appearance</p>
                <p className="mt-1 text-xs text-neutral-400">Choose a calm background.</p>
              </div>

              <div className="grid gap-2">
                {BACKGROUND_OPTIONS.map((option) => (
                  <button
                    key={option.id}
                    type="button"
                    onClick={() => selectBackground(option.id)}
                    className={`flex items-center gap-3 rounded-lg border p-2 text-left transition ${
                      selectedId === option.id
                        ? "border-white/50 bg-white/10 text-white"
                        : "border-white/10 bg-neutral-900/70 text-neutral-300 hover:border-white/25"
                    }`}
                  >
                    <span
                      aria-hidden="true"
                      className="grid h-10 w-14 shrink-0 place-items-center overflow-hidden rounded-md bg-neutral-900 text-xs font-semibold"
                    >
                      {option.image ? (
                        <span
                          className="block h-full w-full bg-cover bg-center"
                          style={{ backgroundImage: `url(${option.image})` }}
                        />
                      ) : (
                        "S"
                      )}
                    </span>
                    <span>
                      <span className="block text-sm font-semibold">{option.label}</span>
                      <span className="block text-xs text-neutral-500">
                        {option.image ? "Image background" : "Default texture"}
                      </span>
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
      {children}
    </main>
  );
}
