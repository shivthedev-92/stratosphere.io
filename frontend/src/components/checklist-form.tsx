import { Plus, X } from "@phosphor-icons/react";
import { FormEvent, KeyboardEvent, useRef, useState } from "react";
import type { ChecklistCreate } from "@/lib/api";

type ChecklistFormProps = {
  saving: boolean;
  onSubmit: (checklist: ChecklistCreate) => Promise<boolean>;
};

const INPUT =
  "w-full rounded-control border border-line-strong bg-field px-3 py-2 text-sm outline-none focus:border-accent";

/** Enter adds the next row; Backspace on an empty row removes it. */
export function ChecklistForm({ saving, onSubmit }: ChecklistFormProps) {
  const [title, setTitle] = useState("");
  const [items, setItems] = useState<string[]>([""]);
  const rowRefs = useRef<(HTMLInputElement | null)[]>([]);
  const filled = items.filter((item) => item.trim());

  function focusRow(index: number) {
    // After React renders the new row.
    requestAnimationFrame(() => rowRefs.current[index]?.focus());
  }

  function updateItem(index: number, value: string) {
    setItems((current) => current.map((item, i) => (i === index ? value : item)));
  }

  function insertRowAfter(index: number) {
    setItems((current) => [...current.slice(0, index + 1), "", ...current.slice(index + 1)]);
    focusRow(index + 1);
  }

  function removeRow(index: number) {
    setItems((current) => (current.length === 1 ? [""] : current.filter((_, i) => i !== index)));
    focusRow(Math.max(0, index - 1));
  }

  function handleItemKeyDown(e: KeyboardEvent<HTMLInputElement>, index: number) {
    if (e.key === "Enter") {
      e.preventDefault();
      if (items[index].trim()) insertRowAfter(index);
    } else if (e.key === "Backspace" && !items[index] && items.length > 1) {
      e.preventDefault();
      removeRow(index);
    }
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!filled.length) return;
    const saved = await onSubmit({ title: title.trim() || null, items: filled });
    if (saved) {
      setTitle("");
      setItems([""]);
    }
  }

  return (
    <form onSubmit={handleSubmit}>
      <label className="mt-5 block text-sm text-fg-muted" htmlFor="checklist-title">
        Title <span className="text-fg-subtle">(optional)</span>
      </label>
      <input
        id="checklist-title"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        maxLength={200}
        placeholder="Prep for meditation"
        className={`mt-2 ${INPUT}`}
      />

      <fieldset className="mt-4">
        <legend className="mb-2 text-sm text-fg-muted">Items</legend>
        <ol className="space-y-2">
          {items.map((item, index) => (
            <li key={index} className="flex items-center gap-2">
              <span aria-hidden="true" className="w-5 shrink-0 text-right text-xs tabular-nums text-fg-subtle">
                {index + 1}.
              </span>
              <input
                ref={(el) => {
                  rowRefs.current[index] = el;
                }}
                value={item}
                onChange={(e) => updateItem(index, e.target.value)}
                onKeyDown={(e) => handleItemKeyDown(e, index)}
                maxLength={500}
                aria-label={`Item ${index + 1}`}
                placeholder={index === 0 ? "Find an isolated space" : "Next item"}
                className={INPUT}
              />
              {items.length > 1 && (
                <button
                  type="button"
                  onClick={() => removeRow(index)}
                  aria-label={`Remove item ${index + 1}`}
                  title="Remove item"
                  className="grid h-9 w-9 shrink-0 place-items-center rounded-control text-fg-subtle transition-colors hover:bg-raised hover:text-fg"
                >
                  <X size={16} aria-hidden="true" />
                </button>
              )}
            </li>
          ))}
        </ol>
        <button
          type="button"
          onClick={() => insertRowAfter(items.length - 1)}
          className="mt-2 inline-flex items-center gap-1.5 rounded-control px-2 py-1.5 text-sm font-semibold text-accent-soft transition-colors hover:bg-accent/10"
        >
          <Plus size={16} aria-hidden="true" />
          Add item
        </button>
        <p className="mt-1 text-xs text-fg-subtle">Press Enter for the next item.</p>
      </fieldset>

      <button
        type="submit"
        disabled={saving || !filled.length}
        className="mt-5 w-full rounded-control bg-accent px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-40"
      >
        {saving ? "Saving..." : filled.length > 1 ? `Add checklist (${filled.length} items)` : "Add checklist"}
      </button>
    </form>
  );
}
