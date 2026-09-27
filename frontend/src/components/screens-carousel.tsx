"use client";

import { useRef, type ReactNode } from "react";
import {
  ArrowLeft,
  ArrowRight,
  BatteryFull,
  CalendarBlank,
  CaretLeft,
  CaretRight,
  ChartBar,
  ChatCircle,
  Check,
  CheckCircle,
  CircleDashed,
  CellSignalFull,
  House,
  PaperPlaneRight,
  WifiHigh,
} from "@phosphor-icons/react";
import { AsterAvatar } from "@/components/aster";
import { StrataSymbol } from "@/components/brand-mark";
import { PriorityIcon } from "@/components/icons";
import type { Priority } from "@/lib/api";

/**
 * "Inside the app" carousel (design/handoff-landing §2). The six screens are
 * drawn mock-ups in the design system's colours; swap them for real App
 * Store screenshots once the redesigned mobile app exists, keeping the frame.
 * Native scroll-snap does the swiping; the arrows just scroll by one slide.
 */
const SLIDE_STEP = 336; // 300px phone + 36px gap

const PRIORITY_TEXT: Record<Priority, string> = { low: "text-low", medium: "text-med", high: "text-high" };
const PRIORITY_LABEL: Record<Priority, string> = { low: "Low", medium: "Medium", high: "High" };

function Phone({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <div
      className="box-border h-[624px] w-[300px] rounded-[50px] bg-[#0E0D16] p-2.5"
      style={{ boxShadow: "var(--phone-shadow), 0 0 0 1px #2A2840" }}
    >
      <div className={`relative flex h-full flex-col overflow-hidden rounded-[40px] ${className}`}>
        <div className="absolute left-1/2 top-[11px] z-10 h-[27px] w-[92px] -translate-x-1/2 rounded-[20px] bg-black" />
        {children}
      </div>
    </div>
  );
}

function StatusBar({ className = "" }: { className?: string }) {
  return (
    <div className={`flex h-12 flex-none items-center justify-between px-7 text-sm font-semibold ${className}`}>
      <span>9:41</span>
      <span className="flex gap-1.5">
        <CellSignalFull size={14} weight="fill" />
        <WifiHigh size={14} weight="fill" />
        <BatteryFull size={14} weight="fill" />
      </span>
    </div>
  );
}

function TabBar({ active }: { active: "home" | "calendar" | "chat" | "chart" }) {
  const tabs = [
    { key: "home", Icon: House },
    { key: "calendar", Icon: CalendarBlank },
    { key: "chat", Icon: ChatCircle },
    { key: "chart", Icon: ChartBar },
  ] as const;
  return (
    <div className="absolute inset-x-0 bottom-0 flex h-[72px] justify-around border-t border-line bg-[var(--app-bg)] pt-3 text-fg-subtle">
      {tabs.map(({ key, Icon }) => (
        <Icon key={key} size={23} weight={key === active ? "fill" : "regular"} className={key === active ? "text-accent-soft" : ""} />
      ))}
    </div>
  );
}

function Slide({ id, caption, children }: { id?: string; caption: string; children: ReactNode }) {
  return (
    <figure id={id} className="m-0 flex flex-none snap-start scroll-mt-24 flex-col items-center gap-5">
      {children}
      <figcaption className="text-base font-semibold">{caption}</figcaption>
    </figure>
  );
}

function BrandLaunch() {
  return (
    <Phone className="items-center justify-center gap-[18px] bg-[linear-gradient(180deg,#15123A_0%,#0B0A14_70%)] text-[#F3F2F8]">
      <StatusBar className="absolute inset-x-0 top-0" />
      <div
        className="absolute bottom-[-420px] left-[-40%] right-[-40%] h-[560px] rounded-[50%] bg-[#0B0A14]"
        style={{ boxShadow: "0 -20px 80px -10px #6B5CFF, inset 0 1px 0 rgba(167,155,255,.5)" }}
      />
      <StrataSymbol size={84} className="relative text-[#A79BFF]" />
      <div className="relative flex flex-col items-center gap-1.5">
        <div className="text-[26px] font-semibold tracking-[-0.03em]">Stratosphere</div>
        <div className="font-serif text-[17px] italic text-[#A6A3B8]">your habits in your control</div>
      </div>
    </Phone>
  );
}

const TODAY_ITEMS: { title: string; priority: Priority; done: boolean }[] = [
  { title: "Review action items", priority: "low", done: true },
  { title: "Book flight to San Francisco", priority: "high", done: true },
  { title: "30 min walk", priority: "low", done: true },
  { title: "Draft Q4 plan", priority: "medium", done: false },
  { title: "Call Amma", priority: "low", done: false },
];

function Today() {
  return (
    <Phone className="bg-[var(--app-bg)] text-fg">
      <StatusBar />
      <div className="flex flex-col gap-3.5 px-[18px] pt-2.5">
        <div className="flex items-start justify-between gap-2.5">
          <div className="flex min-w-0 flex-col gap-0.5">
            <span className="text-[11px] font-semibold uppercase tracking-[0.06em] text-fg-subtle">Sunday, 27 Sep</span>
            <span className="whitespace-nowrap text-xl font-semibold tracking-[-0.02em]">Hello, Alex</span>
          </div>
          <AsterAvatar size={36} />
        </div>
        <div className="flex flex-col gap-2.5 rounded-2xl bg-raised p-3.5">
          <div className="flex justify-between text-[13px]">
            <span className="font-semibold">3 of 5 done</span>
            <span className="text-fg-muted">Keep going</span>
          </div>
          <div className="h-1.5 rounded-full bg-accent/20">
            <div className="h-full w-3/5 rounded-full bg-accent" />
          </div>
        </div>
        <div className="text-[15px] font-semibold">Today&apos;s Action Items</div>
        <div className="flex flex-col gap-2">
          {TODAY_ITEMS.map((item) => (
            <div key={item.title} className="flex items-center gap-2.5 rounded-[14px] bg-raised px-3 py-[11px]">
              {item.done ? (
                <CheckCircle size={22} weight="fill" className="flex-none text-accent-soft" />
              ) : (
                <CircleDashed size={22} className="flex-none text-notdone" />
              )}
              <span className={`flex-1 text-[13px] font-medium ${item.done ? "text-fg-subtle line-through" : ""}`}>
                {item.title}
              </span>
              <span className={`inline-flex items-center gap-1 text-[11px] font-semibold ${PRIORITY_TEXT[item.priority]}`}>
                <PriorityIcon priority={item.priority} size={12} />
                {PRIORITY_LABEL[item.priority]}
              </span>
            </div>
          ))}
        </div>
      </div>
      <TabBar active="home" />
    </Phone>
  );
}

const DOTS: Record<number, Priority[]> = {
  1: ["medium"], 2: ["low", "medium", "high"], 4: ["low"], 5: ["high"], 7: ["medium", "low"], 8: ["high"],
  11: ["low", "medium"], 12: ["medium"], 13: ["high"], 15: ["low", "medium"], 19: ["high"], 21: ["low"],
  26: ["medium"], 28: ["high"],
};
const DOT_BG: Record<Priority, string> = { low: "bg-low", medium: "bg-med", high: "bg-high" };

function CalendarScreen() {
  // May 2026 starts on a Friday: 26-30 April lead in, then 1-31 May, then June.
  const days: { n: number; muted: boolean }[] = [];
  for (let n = 26; n <= 30; n += 1) days.push({ n, muted: true });
  for (let n = 1; n <= 31; n += 1) days.push({ n, muted: false });
  for (let n = 1; days.length < 42; n += 1) days.push({ n, muted: true });
  return (
    <Phone className="bg-[var(--app-bg)] text-fg">
      <StatusBar />
      <div className="flex flex-col gap-3.5 px-[18px] pt-2.5">
        <div className="flex items-center justify-between">
          <span className="text-[23px] font-semibold tracking-[-0.02em]">May 2026</span>
          <span className="flex gap-1.5">
            {[CaretLeft, CaretRight].map((Icon, i) => (
              <span key={i} className="grid h-[30px] w-[30px] place-items-center rounded-[10px] bg-raised">
                <Icon size={14} />
              </span>
            ))}
          </span>
        </div>
        <div className="grid grid-cols-7 gap-y-1 rounded-2xl bg-raised px-2 py-3 text-center">
          {["S", "M", "T", "W", "T", "F", "S"].map((d, i) => (
            <span key={i} className="pb-1 text-[10px] font-semibold text-fg-subtle">
              {d}
            </span>
          ))}
          {days.map((day, i) => {
            const selected = !day.muted && day.n === 12;
            return (
              <div key={i} className="flex h-[34px] flex-col items-center justify-center gap-0.5">
                <span
                  className={`grid h-6 w-6 place-items-center rounded-lg text-xs ${
                    selected ? "bg-accent font-semibold text-white" : day.muted ? "font-medium text-fg-subtle opacity-45" : "font-medium"
                  }`}
                >
                  {day.n}
                </span>
                <span className="flex h-1 gap-0.5">
                  {(day.muted ? [] : DOTS[day.n] ?? []).map((p, j) => (
                    <span key={j} className={`h-1 w-1 rounded-full ${DOT_BG[p]}`} />
                  ))}
                </span>
              </div>
            );
          })}
        </div>
        <div className="flex flex-col gap-2">
          <span className="text-[13px] font-semibold text-fg-muted">Tuesday, 12 May</span>
          <div className="flex items-center gap-2.5 rounded-[14px] bg-raised px-3 py-[11px]">
            <span className="h-7 w-1 rounded bg-med" />
            <span className="flex flex-1 flex-col">
              <span className="text-[13px] font-medium">Draft Q4 plan</span>
              <span className="text-[11px] text-fg-subtle">10:00 · Medium</span>
            </span>
          </div>
        </div>
      </div>
      <TabBar active="calendar" />
    </Phone>
  );
}

function Reflect() {
  return (
    <Phone className="bg-[var(--app-bg)] text-fg">
      <StatusBar />
      <div className="flex flex-col gap-4 px-[18px] pt-2.5">
        <div className="flex items-center gap-2 text-[13px] text-fg-muted">
          <CaretLeft size={16} />
          Reflection
        </div>
        <div className="flex flex-col gap-1.5">
          <span className="text-[11px] font-semibold uppercase tracking-[0.06em] text-fg-subtle">Task context</span>
          <span className="text-xl font-semibold leading-tight tracking-[-0.02em]">Book flight to San Francisco</span>
        </div>
        <div className="flex flex-col gap-2.5">
          <span className="text-sm font-medium">How did it go?</span>
          <div className="grid grid-cols-3 gap-1.5">
            <span className="flex h-10 items-center justify-center gap-1 rounded-control bg-low text-[13px] font-semibold text-[var(--app-bg)]">
              <Check size={14} weight="bold" />
              Done
            </span>
            {["Unsure", "Not done"].map((label) => (
              <span key={label} className="flex h-10 items-center justify-center rounded-control border border-line text-[13px] font-medium text-fg-muted">
                {label}
              </span>
            ))}
          </div>
        </div>
        <div className="flex flex-col gap-2.5">
          <span className="text-sm font-medium">Specific notes</span>
          <div className="min-h-[150px] rounded-[14px] bg-raised p-3.5 font-serif text-[17px] italic leading-snug">
            Booked the tickets before lunch. Felt lighter once it was off my list.
          </div>
        </div>
        <div className="flex h-12 items-center justify-center rounded-[14px] bg-accent text-[15px] font-semibold text-white">
          Save reflection
        </div>
      </div>
    </Phone>
  );
}

function AsterChat() {
  const bubbles: { from: "aster" | "me"; text: string }[] = [
    { from: "aster", text: "You finished 3 of 5 today. Which one felt heaviest?" },
    { from: "me", text: "The flight booking, honestly. I kept putting it off." },
    { from: "aster", text: "That's common with high-priority items. Tomorrow, try the hardest one first while your energy is high." },
    { from: "me", text: "Okay, I'll try that." },
  ];
  return (
    <Phone className="bg-[var(--app-bg)] text-fg">
      <StatusBar />
      <div className="flex items-center gap-2.5 border-b border-line px-[18px] pb-3 pt-2">
        <AsterAvatar size={36} />
        <span className="flex flex-col">
          <span className="text-[15px] font-semibold">Aster</span>
          <span className="text-[11px] text-fg-subtle">Your life coach</span>
        </span>
      </div>
      <div className="flex flex-col gap-2.5 px-3.5 py-4 text-[13px] leading-[1.45]">
        {bubbles.map((bubble, i) => (
          <div
            key={i}
            className={`max-w-[82%] px-3 py-2.5 ${
              bubble.from === "aster"
                ? "self-start rounded-[16px_16px_16px_4px] bg-raised"
                : "self-end rounded-[16px_16px_4px_16px] bg-accent text-white"
            }`}
          >
            {bubble.text}
          </div>
        ))}
      </div>
      <div className="absolute inset-x-3 bottom-[26px] flex h-11 items-center justify-between rounded-[22px] border border-line bg-raised pl-4 pr-1.5 text-[13px] text-fg-subtle">
        Ask Aster anything…
        <span className="grid h-8 w-8 place-items-center rounded-full bg-accent text-white">
          <PaperPlaneRight size={15} weight="fill" />
        </span>
      </div>
    </Phone>
  );
}

const WEEK: [string, number][] = [["M", 60], ["T", 85], ["W", 40], ["T", 100], ["F", 70], ["S", 30], ["S", 55]];

function Rhythm() {
  return (
    <Phone className="bg-[var(--app-bg)] text-fg">
      <StatusBar />
      <div className="flex flex-col gap-3.5 px-[18px] pt-2.5">
        <span className="text-[23px] font-semibold tracking-[-0.02em]">Progress</span>
        <div className="grid grid-cols-2 rounded-control bg-raised p-[3px] text-center text-xs font-semibold">
          <span className="rounded-[9px] bg-[var(--app-bg)] p-[7px]">Progress</span>
          <span className="p-[7px] text-fg-muted">Reflections</span>
        </div>
        <div className="grid grid-cols-2 gap-2">
          {[["15", "Completed"], ["5", "Open"]].map(([value, label]) => (
            <div key={label} className="flex flex-col gap-0.5 rounded-[14px] bg-raised p-3">
              <span className="text-2xl font-semibold">{value}</span>
              <span className="text-[11px] text-fg-muted">{label}</span>
            </div>
          ))}
        </div>
        <div className="flex flex-col gap-3 rounded-2xl bg-raised p-3.5">
          <span className="text-[13px] font-semibold">This week</span>
          <div className="flex h-[110px] items-end gap-2.5">
            {WEEK.map(([day, value], i) => (
              <div key={i} className="flex h-full flex-1 flex-col items-center justify-end gap-1.5">
                <span className={`w-full rounded-md ${i === 3 ? "bg-accent" : "bg-accent/20"}`} style={{ height: value * 0.8 }} />
                <span className="text-[10px] text-fg-subtle">{day}</span>
              </div>
            ))}
          </div>
        </div>
        <div className="flex flex-col gap-1.5 rounded-2xl bg-raised p-3.5">
          <span className="text-[11px] font-semibold uppercase tracking-[0.06em] text-fg-subtle">Latest reflection</span>
          <span className="font-serif text-[15px] italic leading-snug">
            Walked before checking email. Clearer head for the first meeting.
          </span>
        </div>
      </div>
      <TabBar active="chart" />
    </Phone>
  );
}

export function ScreensCarousel() {
  const track = useRef<HTMLDivElement>(null);
  const scroll = (direction: 1 | -1) => track.current?.scrollBy({ left: direction * SLIDE_STEP, behavior: "smooth" });

  return (
    <section id="screens" className="relative scroll-mt-8 bg-canvas pb-[120px] pt-10">
      <div className="mx-auto flex max-w-[1240px] flex-wrap items-end justify-between gap-8 px-4 sm:px-8">
        <div className="flex max-w-[680px] flex-col gap-4">
          <div className="text-[13px] font-semibold uppercase tracking-[0.08em] text-accent-soft">Inside the app</div>
          <h2 className="m-0 text-[34px] font-semibold leading-[1.08] tracking-[-0.035em] [text-wrap:balance] sm:text-[46px]">
            Your day, reflections, and progress in one app.
          </h2>
          <p className="m-0 text-lg leading-[1.55] text-fg-muted">
            Open with a calm brand experience, review scheduled priorities on the calendar, and track completed work
            alongside the reflections that shaped it.
          </p>
        </div>
        <div className="flex gap-2.5">
          {([[-1, "Previous screen", ArrowLeft], [1, "Next screen", ArrowRight]] as const).map(([dir, label, Icon]) => (
            <button
              key={label}
              type="button"
              aria-label={label}
              onClick={() => scroll(dir)}
              className="grid h-12 w-12 place-items-center rounded-full border border-line bg-[var(--btn2)] text-fg transition-colors duration-200 hover:border-fg-subtle"
            >
              <Icon size={20} aria-hidden="true" />
            </button>
          ))}
        </div>
      </div>
      <div
        ref={track}
        className="screens-track mt-12 flex snap-x snap-mandatory gap-9 overflow-x-auto pb-6 pt-3"
        style={{
          paddingInline: "max(32px, calc((100vw - 1176px) / 2))",
          scrollPaddingInline: "max(32px, calc((100vw - 1176px) / 2))",
        }}
      >
        <Slide caption="Brand launch"><BrandLaunch /></Slide>
        <Slide caption="Today"><Today /></Slide>
        <Slide caption="Calendar"><CalendarScreen /></Slide>
        <Slide caption="Reflect without pressure"><Reflect /></Slide>
        <Slide id="aster" caption="Ask the life coach"><AsterChat /></Slide>
        <Slide caption="Review your rhythm"><Rhythm /></Slide>
      </div>
    </section>
  );
}
