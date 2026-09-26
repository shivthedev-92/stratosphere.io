import { FormEvent, useEffect, useState } from "react";
import type { GoalOut, Priority } from "@/lib/api";
import { PriorityIcon } from "@/components/icons";

const priorities: Array<{ value: Priority; label: string }> = [
  { value: "low", label: "Low" },
  { value: "medium", label: "Medium" },
  { value: "high", label: "High" },
];

function toDatetimeLocal(value: string | null) {
  if (!value) return "";
  const date = new Date(value);
  const offset = date.getTimezoneOffset() * 60000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
}

type TaskDetailModalProps = {
  goal: GoalOut;
  saving: boolean;
  onClose: () => void;
  onSave: (goal: {
    title: string;
    notes: string | null;
    is_timed: boolean;
    scheduled_for: string | null;
    priority: Priority;
  }) => void;
  onDelete: () => void;
};

export function TaskDetailModal({
  goal,
  saving,
  onClose,
  onSave,
  onDelete,
}: TaskDetailModalProps) {
  const [title, setTitle] = useState(goal.title);
  const [notes, setNotes] = useState(goal.notes ?? "");
  const [isTimed, setIsTimed] = useState(goal.is_timed);
  const [scheduledFor, setScheduledFor] = useState(toDatetimeLocal(goal.scheduled_for));
  const [priority, setPriority] = useState<Priority>(goal.priority);

  useEffect(() => {
    setTitle(goal.title);
    setNotes(goal.notes ?? "");
    setIsTimed(goal.is_timed);
    setScheduledFor(toDatetimeLocal(goal.scheduled_for));
    setPriority(goal.priority);
  }, [goal]);

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;
    onSave({
      title: title.trim(),
      notes: notes.trim() || null,
      is_timed: isTimed,
      scheduled_for: isTimed && scheduledFor ? new Date(scheduledFor).toISOString() : null,
      priority,
    });
  }

  return (
    <div className="fixed inset-0 z-30 flex items-end bg-scrim p-4 sm:items-center sm:justify-center">
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-lg rounded-card border border-line bg-surface p-5 shadow-2xl"
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold text-fg">Task details</h2>
            <p className="mt-1 text-sm text-fg-subtle">View, edit, or remove this action item.</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-control border border-line-strong px-3 py-1.5 text-sm font-semibold text-fg-muted"
          >
            Close
          </button>
        </div>

        <div className="mt-5 space-y-4">
          <label className="block">
            <span className="mb-1 block text-sm text-fg-muted">Title</span>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
              maxLength={200}
              className="w-full rounded-control border border-line-strong bg-field px-3 py-2 text-sm text-fg outline-none focus:border-accent"
            />
          </label>

          <label className="block">
            <span className="mb-1 block text-sm text-fg-muted">Specific notes</span>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={4}
              maxLength={2000}
              className="w-full resize-none rounded-control border border-line-strong bg-field px-3 py-2 text-sm text-fg outline-none focus:border-accent"
            />
          </label>

          <div>
            <span className="mb-2 block text-sm text-fg-muted">Priority</span>
            <div className="grid grid-cols-3 gap-2">
              {priorities.map((item) => (
                <button
                  key={item.value}
                  type="button"
                  onClick={() => setPriority(item.value)}
                  className={`rounded-control border px-3 py-2 text-sm ${
                    priority === item.value
                      ? "border-accent bg-accent text-white"
                      : "border-line-strong bg-raised text-fg-muted"
                  }`}
                >
                  <span className="inline-flex items-center gap-1.5">
                    <PriorityIcon priority={item.value} selected={priority === item.value} />
                    {item.label}
                  </span>
                </button>
              ))}
            </div>
          </div>

          <label className="flex items-center gap-3 text-sm text-fg-muted">
            <input
              type="checkbox"
              checked={isTimed}
              onChange={(e) => setIsTimed(e.target.checked)}
              className="h-4 w-4 accent-indigo-600"
            />
            This has a specific time
          </label>

          {isTimed && (
            <input
              type="datetime-local"
              value={scheduledFor}
              onChange={(e) => setScheduledFor(e.target.value)}
              className="w-full rounded-control border border-line-strong bg-field px-3 py-2 text-sm text-fg outline-none focus:border-accent"
            />
          )}
        </div>

        <div className="mt-5 flex flex-col-reverse gap-3 sm:flex-row sm:justify-between">
          <button
            type="button"
            onClick={onDelete}
            disabled={saving}
            className="rounded-control border border-danger/30 px-4 py-2 text-sm font-semibold text-danger transition-colors hover:border-danger hover:text-danger disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Delete task
          </button>
          <button
            type="submit"
            disabled={saving || !title.trim()}
            className="rounded-control bg-accent px-4 py-2 text-sm font-semibold text-white hover:bg-accent-hover disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {saving ? "Saving..." : "Save changes"}
          </button>
        </div>
      </form>
    </div>
  );
}
