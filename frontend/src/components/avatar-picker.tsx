"use client";

import { Check } from "@phosphor-icons/react";
import { useRef } from "react";

type Avatar = { id: string; name: string };

/** Profile avatars (design/handoff §06). IDs must match backend app/avatars.py. */
const AVATAR_GROUPS: { label: string; avatars: Avatar[] }[] = [
  {
    label: "Crew",
    avatars: [
      { id: "crew-indigo", name: "Indigo helmet" },
      { id: "crew-teal", name: "Teal helmet" },
      { id: "crew-sky", name: "Sky helmet" },
      { id: "crew-amber", name: "Amber helmet" },
      { id: "crew-rose", name: "Rose helmet" },
      { id: "crew-midnight", name: "Midnight helmet" },
    ],
  },
  {
    label: "Sky",
    avatars: [
      { id: "sky-ringed-planet", name: "Ringed planet" },
      { id: "sky-crescent", name: "Crescent moon" },
      { id: "sky-dawn", name: "Dawn horizon" },
      { id: "sky-comet", name: "Comet" },
      { id: "sky-binary", name: "Binary stars" },
      { id: "sky-earthrise", name: "Earthrise" },
    ],
  },
];

const ALL_AVATARS: Avatar[] = AVATAR_GROUPS.flatMap((group) => group.avatars);
const AVATAR_IDS = new Set<string>(ALL_AVATARS.map((avatar) => avatar.id));

function getInitials(name: string) {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
}

/** The user's chosen avatar, or their initials when they haven't picked one. */
export function UserAvatar({
  avatarId,
  name,
  size = 56,
}: {
  avatarId: string | null | undefined;
  name: string;
  size?: number;
}) {
  if (avatarId && AVATAR_IDS.has(avatarId)) {
    return (
      // Decorative: the surrounding control names what it does.
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={`/avatars/${avatarId}.svg`}
        alt=""
        width={size}
        height={size}
        className="block rounded-full"
        style={{ width: size, height: size }}
      />
    );
  }
  return (
    <span
      className="grid place-items-center rounded-control border border-line-strong bg-surface text-base font-bold text-fg"
      style={{ width: size, height: size }}
    >
      {getInitials(name) || "U"}
    </span>
  );
}

/** Radio group of the 12 avatars, grouped Crew / Sky. Arrow keys move and select. */
export function AvatarPicker({
  value,
  onChange,
}: {
  value: string | null;
  onChange: (avatarId: string) => void;
}) {
  const buttons = useRef<Record<string, HTMLButtonElement | null>>({});
  // Roving tabindex: the selected avatar (or the first) is the one tab stop.
  const tabStop = value && AVATAR_IDS.has(value) ? value : ALL_AVATARS[0].id;

  function handleKeyDown(event: React.KeyboardEvent, index: number) {
    const step = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[event.key];
    if (!step) return;
    event.preventDefault();
    const next = ALL_AVATARS[(index + step + ALL_AVATARS.length) % ALL_AVATARS.length];
    buttons.current[next.id]?.focus();
    onChange(next.id);
  }

  return (
    <div role="radiogroup" aria-label="Profile avatar" className="@container grid gap-5">
      {AVATAR_GROUPS.map((group) => (
        <div key={group.label}>
          <p className="text-xs font-bold uppercase tracking-wide text-fg-subtle">{group.label}</p>
          {/* Six per group: 3 columns, or one row of 6 when there is room, so no avatar sits alone. */}
          <div className="mt-3 grid grid-cols-3 gap-5 @lg:grid-cols-6">
            {group.avatars.map((avatar) => {
              const index = ALL_AVATARS.findIndex((item) => item.id === avatar.id);
              const selected = value === avatar.id;
              return (
                <button
                  key={avatar.id}
                  ref={(node) => {
                    buttons.current[avatar.id] = node;
                  }}
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  aria-label={avatar.name}
                  title={avatar.name}
                  tabIndex={avatar.id === tabStop ? 0 : -1}
                  onClick={() => onChange(avatar.id)}
                  onKeyDown={(event) => handleKeyDown(event, index)}
                  className="group relative mx-auto h-[76px] w-[76px] rounded-full transition-transform duration-200 ease-calm hover:scale-105 motion-reduce:transition-none motion-reduce:hover:scale-100"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={`/avatars/${avatar.id}.svg`}
                    alt=""
                    width={76}
                    height={76}
                    className={`h-full w-full rounded-full ${
                      selected ? "outline outline-2 outline-offset-[3px] outline-focus" : ""
                    }`}
                  />
                  {selected ? (
                    <span className="absolute -right-1 -top-1 grid h-[22px] w-[22px] place-items-center rounded-full bg-accent text-white">
                      <Check size={13} weight="bold" aria-hidden />
                    </span>
                  ) : null}
                </button>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
