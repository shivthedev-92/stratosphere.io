"use client";

import type { ReactNode } from "react";

/** Aster, the astronaut coach (design/handoff §05). */
export type AsterMood = "happy" | "thinking" | "celebrating";

export function AsterAvatar({ mood = "happy", size = 34 }: { mood?: AsterMood; size?: number }) {
  return (
    // Decorative: the "Aster" label next to it carries the meaning.
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={`/aster/aster-${mood}.svg`}
      alt=""
      width={size}
      height={size}
      className="shrink-0 rounded-full"
      style={{ width: size, height: size }}
    />
  );
}

/** Coach message: avatar aligned to the bubble's bottom, "Aster" label on top. */
export function CoachBubble({ children, mood = "happy" }: { children: ReactNode; mood?: AsterMood }) {
  return (
    <div className="flex items-end justify-start gap-2">
      <AsterAvatar mood={mood} />
      <div className="max-w-[85%] rounded-[18px_18px_18px_6px] border border-line bg-raised px-4 py-3 text-sm leading-relaxed text-fg">
        <p className="mb-1 text-xs font-semibold text-accent-soft">Aster</p>
        <div className="whitespace-pre-wrap">{children}</div>
      </div>
    </div>
  );
}

/** Three-dot typing indicator shown while Aster is thinking. */
export function TypingDots() {
  return (
    <span className="inline-flex items-center gap-1 py-1" role="status" aria-label="Aster is thinking">
      {[0, 150, 300].map((delay) => (
        <span
          key={delay}
          className="typing-dot h-2 w-2 rounded-full bg-fg-subtle"
          style={{ animationDelay: `${delay}ms` }}
        />
      ))}
    </span>
  );
}
