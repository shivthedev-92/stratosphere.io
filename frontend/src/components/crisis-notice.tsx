"use client";

import type { SafetyNoticeOut } from "@/lib/api";

/**
 * Rendered when the server's safety gate fires. The copy and the phone
 * numbers come from the server as fixed data - the AI coach is never
 * involved in producing them. Styled deliberately unlike a chat bubble so
 * it does not read as the coach "saying" something.
 */
/** Copy for the reflection path. Unlike chat, the user did not ask us a
 *  question - they wrote something down and we saved it. The wording says
 *  so plainly rather than responding as if spoken to. */
/** Used only if the connection drops after the helplines arrived but before
 *  the server's own message did; the resources must still be shown. */
export const CRISIS_FALLBACK_MESSAGE =
  "It sounds like you may be going through something serious. Please talk to " +
  "someone trained for this conversation. These lines are free and confidential.";

export const REFLECTION_CRISIS_MESSAGE =
  "Your reflection has been saved.\n\n" +
  "What you wrote sounds serious, and I want to be straight with you: Stratosphere " +
  "is a planning tool, not a counsellor. If you are going through something hard, " +
  "please talk to someone trained for it. These lines are free and confidential.";

export function CrisisNotice({ notice, message }: { notice: SafetyNoticeOut; message: string }) {
  return (
    <div
      role="alert"
      className="rounded-2xl border border-amber-500/40 bg-amber-500/5 px-5 py-4 text-sm leading-relaxed"
    >
      <p className="whitespace-pre-wrap text-neutral-100">{message}</p>

      <ul className="mt-4 space-y-3">
        {notice.resources.map((resource) => (
          <li key={resource.name} className="rounded-lg bg-neutral-900/60 px-4 py-3">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <span className="font-semibold text-white">{resource.name}</span>
              <span className="text-xs text-neutral-400">{resource.hours}</span>
            </div>
            <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1">
              {resource.numbers.map((number) => (
                <a
                  key={number}
                  href={`tel:${number.replace(/[^\d+]/g, "")}`}
                  className="text-base font-semibold text-amber-300 hover:text-amber-200"
                >
                  {number}
                </a>
              ))}
            </div>
            {resource.note && <p className="mt-1 text-xs text-neutral-400">{resource.note}</p>}
          </li>
        ))}
      </ul>

      <p className="mt-4 text-xs text-neutral-400">
        In an emergency, call{" "}
        <a
          href={`tel:${notice.emergency_number}`}
          className="font-semibold text-amber-300 hover:text-amber-200"
        >
          {notice.emergency_number}
        </a>
        .
      </p>
    </div>
  );
}

/**
 * Persistent, always-visible scope statement. This is deliberately not a
 * one-time dismissible modal: the point is that it is on screen at the
 * moment someone is deciding what to type.
 */
export function CoachDisclaimer() {
  return (
    <p className="px-4 pb-3 text-center text-xs leading-relaxed text-neutral-500">
      Stratosphere helps you plan and reflect on your own goals. It is not therapy,
      counselling, or medical advice, and it is not a crisis service. If you are
      struggling with your mental health, please talk to a qualified professional.
    </p>
  );
}


/**
 * Modal wrapper used by both reflection entry points (the dashboard modal
 * and the task detail page). Dismissible - the user has already saved their
 * entry and is not trapped here.
 */
export function CrisisOverlay({
  notice,
  onClose,
}: {
  notice: SafetyNoticeOut;
  onClose: () => void;
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4 py-8"
      onClick={onClose}
    >
      <div
        className="max-h-full w-full max-w-lg overflow-y-auto"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="rounded-2xl bg-neutral-950 shadow-2xl">
          <CrisisNotice notice={notice} message={REFLECTION_CRISIS_MESSAGE} />
        </div>
        <button
          type="button"
          onClick={onClose}
          className="mt-3 w-full rounded-lg border border-neutral-700 bg-neutral-950 py-2 text-sm text-neutral-300 hover:bg-neutral-800"
        >
          Close
        </button>
      </div>
    </div>
  );
}
