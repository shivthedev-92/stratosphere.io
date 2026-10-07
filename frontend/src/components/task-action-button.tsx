import type { Icon as PhosphorIcon } from "@phosphor-icons/react";

const TASK_ACTION_TONES = {
  neutral: "border-line-strong text-fg-muted hover:border-fg-subtle hover:bg-raised hover:text-fg",
  accent: "border-accent/50 text-accent-soft hover:bg-accent/10",
  danger: "border-danger/30 text-fg-muted hover:border-danger hover:bg-danger-bg hover:text-danger",
};

/** A 44px icon button: big enough to tap, labelled for screen readers, titled for hover. */
export function TaskActionButton({
  icon: Icon,
  label,
  tone = "neutral",
  disabled,
  onClick,
}: {
  icon: PhosphorIcon;
  label: string;
  tone?: keyof typeof TASK_ACTION_TONES;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      title={label}
      className={`grid h-11 w-11 place-items-center rounded-control border transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${TASK_ACTION_TONES[tone]}`}
    >
      <Icon size={20} aria-hidden="true" />
    </button>
  );
}
