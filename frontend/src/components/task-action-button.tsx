import type { Icon as PhosphorIcon } from "@phosphor-icons/react";

const TASK_ACTION_TONES = {
  neutral: "border-line-strong text-fg-muted hover:border-fg-subtle hover:bg-raised hover:text-fg",
  accent: "border-accent/50 text-accent-soft hover:bg-accent/10",
  danger: "border-danger/30 text-fg-muted hover:border-danger hover:bg-danger-bg hover:text-danger",
};

/**
 * A 44px icon button. `label` names the action and its task for screen
 * readers; `tooltip` is the short hover text, kept different so the two are
 * not announced twice.
 */
export function TaskActionButton({
  icon: Icon,
  label,
  tooltip,
  tone = "neutral",
  disabled,
  onClick,
}: {
  icon: PhosphorIcon;
  label: string;
  tooltip: string;
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
      title={tooltip}
      className={`grid h-11 w-11 place-items-center rounded-control border transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${TASK_ACTION_TONES[tone]}`}
    >
      <Icon size={20} aria-hidden="true" />
    </button>
  );
}
