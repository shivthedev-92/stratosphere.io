import { CheckCircle, ListChecks, PencilSimple, Plus, Trash } from "@phosphor-icons/react";
import { FormEvent, KeyboardEvent, useRef, useState } from "react";
import { api, type ChecklistItemOut, type ChecklistOut } from "@/lib/api";
import { formatDuration } from "@/lib/duration";

type ChecklistCardProps = {
  checklist: ChecklistOut;
  taskCompleted: boolean;
  /** Updater form, so overlapping saves each apply to the latest list. */
  onChange: (update: (checklist: ChecklistOut) => ChecklistOut) => void;
  onDelete: () => void;
  onCompleteTask: () => void;
  onError: (message: string) => void;
};

function formatDoneAt(value: string) {
  return new Date(value).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function formatCreatedAt(value: string) {
  return new Date(value).toLocaleString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

const ICON_BUTTON =
  "grid h-9 w-9 shrink-0 place-items-center rounded-control text-fg-subtle transition-colors hover:bg-raised hover:text-fg disabled:opacity-40";

export function ChecklistCard({
  checklist,
  taskCompleted,
  onChange,
  onDelete,
  onCompleteTask,
  onError,
}: ChecklistCardProps) {
  const [busy, setBusy] = useState(false);
  // Reads like a journal entry until the pencil opens the editor.
  const [editing, setEditing] = useState(false);
  const [newItem, setNewItem] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editText, setEditText] = useState("");
  // Escape closes the editor; the blur that follows must not save.
  const cancelEdit = useRef(false);

  const items = checklist.items;
  const doneCount = items.filter((item) => item.completed_at).length;
  const allDone = items.length > 0 && doneCount === items.length;

  async function run(action: () => Promise<void>, failure: string) {
    setBusy(true);
    try {
      await action();
    } catch (err: unknown) {
      onError(err instanceof Error ? err.message : failure);
    } finally {
      setBusy(false);
    }
  }

  function replaceItem(updated: ChecklistItemOut) {
    onChange((current) => ({
      ...current,
      items: current.items.map((item) => (item.id === updated.id ? updated : item)),
    }));
  }

  // Ticks show at once; the server's time replaces the provisional one,
  // and a failed save puts the item back as it was.
  async function toggle(item: ChecklistItemOut) {
    const completed = !item.completed_at;
    replaceItem({ ...item, completed_at: completed ? new Date().toISOString() : null });
    try {
      replaceItem(await api.updateChecklistItem(item.id, { completed }));
    } catch (err: unknown) {
      replaceItem(item);
      onError(err instanceof Error ? err.message : "Could not update item");
    }
  }

  function saveEdit(item: ChecklistItemOut) {
    if (cancelEdit.current) {
      cancelEdit.current = false;
      return;
    }
    const text = editText.trim();
    if (!text || text === item.text) {
      setEditingId(null);
      return;
    }
    return run(async () => {
      replaceItem(await api.updateChecklistItem(item.id, { text }));
      setEditingId(null);
    }, "Could not rename item");
  }

  function handleEditKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") {
      e.preventDefault();
      e.currentTarget.blur(); // onBlur saves, so Enter and click-away share one path
    } else if (e.key === "Escape") {
      cancelEdit.current = true;
      setEditingId(null);
    }
  }

  function removeItem(item: ChecklistItemOut) {
    return run(async () => {
      await api.deleteChecklistItem(item.id);
      onChange((current) => ({ ...current, items: current.items.filter((i) => i.id !== item.id) }));
    }, "Could not delete item");
  }

  function addItem(e: FormEvent) {
    e.preventDefault();
    const text = newItem.trim();
    if (!text) return;
    return run(async () => {
      const item = await api.addChecklistItem(checklist.id, text);
      onChange((current) => ({ ...current, items: [...current.items, item] }));
      setNewItem("");
    }, "Could not add item");
  }

  function removeChecklist() {
    if (!window.confirm("Delete this checklist and all its items?")) return;
    return run(async () => {
      await api.deleteChecklist(checklist.id);
      onDelete();
    }, "Could not delete checklist");
  }

  const label = checklist.title ?? "Checklist";

  function doneLine(item: ChecklistItemOut) {
    if (!item.completed_at) return null;
    return (
      <p className="mt-0.5 text-xs text-fg-subtle">
        Done {formatDoneAt(item.completed_at)} ·{" "}
        <span className="whitespace-nowrap">took {formatDuration(item.created_at, item.completed_at)}</span>
      </p>
    );
  }

  return (
    <article className="rounded-card border border-line bg-surface p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <span className="inline-flex items-center gap-1 rounded-chip border border-line bg-raised px-2 py-0.5 text-xs font-semibold text-accent-soft">
            <ListChecks size={14} aria-hidden="true" />
            Checklist
          </span>
          {checklist.title && <h3 className="break-words text-sm font-semibold text-fg">{checklist.title}</h3>}
          <span className="text-xs tabular-nums text-fg-subtle">
            {doneCount} of {items.length} done
          </span>
        </div>
        <div className="flex items-center gap-1">
          <time className="text-xs text-fg-subtle" dateTime={checklist.created_at}>
            {formatCreatedAt(checklist.created_at)}
          </time>
          {!editing && (
            <button
              type="button"
              onClick={() => setEditing(true)}
              aria-label={`Edit ${label}`}
              title="Edit checklist"
              className={ICON_BUTTON}
            >
              <PencilSimple size={16} aria-hidden="true" />
            </button>
          )}
        </div>
      </div>

      <div
        role="progressbar"
        aria-label={`${label} progress`}
        aria-valuemin={0}
        aria-valuemax={items.length}
        aria-valuenow={doneCount}
        className="mt-3 h-1 overflow-hidden rounded-full bg-raised"
      >
        <div
          className="h-full rounded-full bg-low transition-[width]"
          style={{ width: `${items.length ? (doneCount / items.length) * 100 : 0}%` }}
        />
      </div>

      {editing ? (
        <>
          <ul className="mt-3 space-y-1">
            {items.map((item) => {
              const done = !!item.completed_at;
              const renaming = editingId === item.id;
              return (
                <li key={item.id} className="flex items-start gap-2 rounded-control px-1 py-1 hover:bg-raised/50">
                  <input
                    type="checkbox"
                    checked={done}
                    onChange={() => toggle(item)}
                    aria-label={item.text}
                    className="mt-1 h-5 w-5 shrink-0 cursor-pointer accent-[var(--color-low)]"
                  />
                  <div className="min-w-0 flex-1">
                    {renaming ? (
                      <input
                        autoFocus
                        value={editText}
                        onChange={(e) => setEditText(e.target.value)}
                        onKeyDown={handleEditKeyDown}
                        onBlur={() => saveEdit(item)}
                        maxLength={500}
                        aria-label={`Rename ${item.text}`}
                        className="w-full rounded-control border border-line-strong bg-field px-2 py-1 text-sm outline-none focus:border-accent"
                      />
                    ) : (
                      <p className={`break-words text-sm ${done ? "text-fg-subtle line-through" : "text-fg"}`}>
                        {item.text}
                      </p>
                    )}
                    {doneLine(item)}
                  </div>
                  {!renaming && (
                    <button
                      type="button"
                      onClick={() => {
                        cancelEdit.current = false;
                        setEditingId(item.id);
                        setEditText(item.text);
                      }}
                      disabled={busy}
                      aria-label={`Rename ${item.text}`}
                      title="Rename item"
                      className={ICON_BUTTON}
                    >
                      <PencilSimple size={16} aria-hidden="true" />
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => removeItem(item)}
                    disabled={busy}
                    aria-label={`Delete ${item.text}`}
                    title="Delete item"
                    className={`${ICON_BUTTON} hover:text-danger`}
                  >
                    <Trash size={16} aria-hidden="true" />
                  </button>
                </li>
              );
            })}
          </ul>

          <form onSubmit={addItem} className="mt-2 flex items-center gap-2 pl-1">
            <Plus size={16} aria-hidden="true" className="shrink-0 text-fg-subtle" />
            <input
              value={newItem}
              onChange={(e) => setNewItem(e.target.value)}
              maxLength={500}
              aria-label={`Add an item to ${label}`}
              placeholder="Add an item"
              className="w-full rounded-control border border-transparent bg-transparent px-2 py-1.5 text-sm outline-none placeholder:text-fg-subtle hover:border-line focus:border-accent focus:bg-field"
            />
          </form>

          <div className="mt-3 flex items-center justify-between gap-2 border-t border-line pt-3">
            <button
              type="button"
              onClick={removeChecklist}
              disabled={busy}
              className="inline-flex items-center gap-1.5 rounded-control px-2 py-1.5 text-sm font-semibold text-fg-muted transition-colors hover:bg-danger-bg hover:text-danger disabled:opacity-40"
            >
              <Trash size={16} aria-hidden="true" />
              Delete checklist
            </button>
            <button
              type="button"
              onClick={() => {
                setEditing(false);
                setEditingId(null);
              }}
              className="rounded-control bg-accent px-4 py-1.5 text-sm font-semibold text-white transition-colors hover:bg-accent-hover"
            >
              Done
            </button>
          </div>
        </>
      ) : items.length === 0 ? (
        <p className="mt-3 font-serif text-[15px] italic text-fg-subtle">No items yet.</p>
      ) : (
        // Journal view: reads like a reflection, but items can still be ticked.
        <ul className="mt-3 space-y-2">
          {items.map((item) => {
            const done = !!item.completed_at;
            return (
              <li key={item.id}>
                <label className="flex cursor-pointer items-start gap-3 rounded-control py-0.5">
                  <input
                    type="checkbox"
                    checked={done}
                    onChange={() => toggle(item)}
                    className="mt-[5px] h-4 w-4 shrink-0 cursor-pointer accent-[var(--color-low)]"
                  />
                  <span className="min-w-0 flex-1">
                    <span
                      className={`block break-words font-serif text-[15px] italic leading-6 ${
                        done ? "text-fg-subtle line-through decoration-fg-subtle/70" : "text-fg"
                      }`}
                    >
                      {item.text}
                    </span>
                    {doneLine(item)}
                  </span>
                </label>
              </li>
            );
          })}
        </ul>
      )}

      {allDone && !taskCompleted && (
        <div className="mt-3 flex flex-col gap-2 rounded-control border border-low/30 bg-low-bg px-3 py-2 sm:flex-row sm:items-center sm:justify-between">
          <p className="inline-flex items-center gap-1.5 text-sm font-semibold text-low">
            <CheckCircle size={16} weight="fill" aria-hidden="true" />
            All items done. Mark this task complete?
          </p>
          <button
            type="button"
            onClick={onCompleteTask}
            className="rounded-control border border-low/50 px-3 py-1.5 text-sm font-semibold text-low transition-colors hover:bg-low/10"
          >
            Mark complete
          </button>
        </div>
      )}
    </article>
  );
}
