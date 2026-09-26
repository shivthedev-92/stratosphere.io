import { CheckCircle, CircleDashed } from "@phosphor-icons/react";
import { FormEvent } from "react";
import type { GoalOut } from "@/lib/api";

type ReflectGoalModalProps = {
  goal: GoalOut;
  completed: boolean;
  reflection: string;
  soulful: boolean | null;
  saving: boolean;
  onCompletedChange: (value: boolean) => void;
  onReflectionChange: (value: string) => void;
  onSoulfulChange: (value: boolean | null) => void;
  onCancel: () => void;
  onSubmit: (e: FormEvent) => void;
};

export function ReflectGoalModal({
  goal,
  completed,
  reflection,
  soulful,
  saving,
  onCompletedChange,
  onReflectionChange,
  onSoulfulChange,
  onCancel,
  onSubmit,
}: ReflectGoalModalProps) {
  return (
    <div className="fixed inset-0 z-30 flex items-end bg-black/70 p-4 sm:items-center sm:justify-center">
      <form
        onSubmit={onSubmit}
        className="w-full max-w-lg rounded-lg border border-white/10 bg-neutral-900 p-5 shadow-2xl"
      >
        <h2 className="text-lg font-semibold">{goal.title}</h2>
        <p className="mt-1 text-sm text-neutral-500">
          What went well, what got in the way, and does this still feel meaningful?
        </p>

        <div className="mt-5 grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => onCompletedChange(true)}
            className={`rounded-lg border px-3 py-2 text-sm ${
              completed
                ? "border-emerald-500 bg-emerald-700 text-white"
                : "border-neutral-700 bg-neutral-800 text-neutral-300"
            }`}
          >
            <span className="inline-flex items-center justify-center gap-1.5">
              <CheckCircle size={18} weight={completed ? "fill" : "regular"} aria-hidden="true" />
              Done
            </span>
          </button>
          <button
            type="button"
            onClick={() => onCompletedChange(false)}
            className={`rounded-lg border px-3 py-2 text-sm ${
              !completed
                ? "border-amber-500 bg-amber-700 text-white"
                : "border-neutral-700 bg-neutral-800 text-neutral-300"
            }`}
          >
            <span className="inline-flex items-center justify-center gap-1.5">
              <CircleDashed size={18} aria-hidden="true" />
              Not done
            </span>
          </button>
        </div>

        <textarea
          value={reflection}
          onChange={(e) => onReflectionChange(e.target.value)}
          rows={5}
          required
          maxLength={2000}
          className="mt-4 w-full resize-none rounded-lg border border-neutral-700 bg-neutral-800 px-3 py-2 text-sm outline-none focus:border-indigo-500"
          placeholder="Write a short reflection..."
        />

        <div className="mt-4">
          <span className="mb-2 block text-sm text-neutral-300">
            Does this goal still feel meaningful?
          </span>
          <div className="grid grid-cols-3 gap-2">
            {[
              { label: "Yes", value: true },
              { label: "Unsure", value: null },
              { label: "No", value: false },
            ].map((item) => (
              <button
                key={item.label}
                type="button"
                onClick={() => onSoulfulChange(item.value)}
                className={`rounded-lg border px-3 py-2 text-sm ${
                  soulful === item.value
                    ? "border-indigo-500 bg-indigo-600 text-white"
                    : "border-neutral-700 bg-neutral-800 text-neutral-300"
                }`}
              >
                {item.label}
              </button>
            ))}
          </div>
        </div>

        <div className="mt-5 flex justify-end gap-3">
          <button
            type="button"
            onClick={onCancel}
            className="rounded-lg border border-neutral-700 px-4 py-2 text-sm font-semibold"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={saving || !reflection.trim()}
            className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold hover:bg-indigo-500 disabled:opacity-50"
          >
            {saving ? "Saving..." : "Save reflection"}
          </button>
        </div>
      </form>
    </div>
  );
}
