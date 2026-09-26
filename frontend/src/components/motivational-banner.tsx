"use client";

import { useEffect, useState } from "react";
import { Sparkle } from "@phosphor-icons/react";
import { motivationalMessages } from "@/lib/motivational-messages";

const ROTATION_INTERVAL_MS = 12_000;
const FADE_DURATION_MS = 300;

export function MotivationalBanner() {
  const [messageIndex, setMessageIndex] = useState(0);
  const [isVisible, setIsVisible] = useState(true);

  useEffect(() => {
    let fadeTimer: number | undefined;

    const rotationTimer = window.setInterval(() => {
      setIsVisible(false);
      fadeTimer = window.setTimeout(() => {
        setMessageIndex((current) => (current + 1) % motivationalMessages.length);
        setIsVisible(true);
      }, FADE_DURATION_MS);
    }, ROTATION_INTERVAL_MS);

    return () => {
      window.clearInterval(rotationTimer);
      if (fadeTimer !== undefined) window.clearTimeout(fadeTimer);
    };
  }, []);

  return (
    <section
      aria-label="Motivation"
      className="rounded-card border border-line bg-surface p-5 shadow-lg shadow-black/15 backdrop-blur"
    >
      <p
        className={`text-center font-serif text-[21px] italic leading-[1.35] text-fg transition-opacity duration-300 motion-reduce:transition-none ${
          isVisible ? "opacity-100" : "opacity-0"
        }`}
      >
        <Sparkle size={18} weight="fill" className="mr-2 inline-block align-[-2px] text-accent-soft" aria-hidden="true" />
        &ldquo;{motivationalMessages[messageIndex]}&rdquo;
      </p>
    </section>
  );
}
