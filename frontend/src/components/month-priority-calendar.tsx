import type { GoalOut, Priority } from "@/lib/api";

const priorityStyles: Record<Priority, string> = {
  low: "bg-low",
  medium: "bg-med",
  high: "bg-high",
};

const priorityOrder: Priority[] = ["low", "medium", "high"];

function getGoalDate(goal: GoalOut) {
  return new Date(goal.scheduled_for ?? goal.created_at);
}

function getDateKey(date: Date) {
  return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
}

function getDayPriorities(priorities: Priority[]) {
  const unique = new Set(priorities);
  return priorityOrder.filter((priority) => unique.has(priority));
}

export function MonthPriorityCalendar({
  goals,
  selectedDateKey,
  onDateSelect,
}: {
  goals: GoalOut[];
  selectedDateKey?: string | null;
  onDateSelect?: (dateKey: string) => void;
}) {
  const today = new Date();
  const year = today.getFullYear();
  const month = today.getMonth();
  const firstDay = new Date(year, month, 1);
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const leadingBlankDays = firstDay.getDay();
  const monthLabel = today.toLocaleDateString(undefined, {
    month: "long",
    year: "numeric",
  });
  const goalsByDate = goals.reduce<Record<string, Priority[]>>((acc, goal) => {
    const date = getGoalDate(goal);
    if (date.getFullYear() !== year || date.getMonth() !== month) return acc;
    const key = getDateKey(date);
    acc[key] = [...(acc[key] ?? []), goal.priority];
    return acc;
  }, {});
  const calendarCells = [
    ...Array.from({ length: leadingBlankDays }, (_, index) => ({ day: null, key: `blank-${index}` })),
    ...Array.from({ length: daysInMonth }, (_, index) => ({
      day: index + 1,
      key: `day-${index + 1}`,
    })),
  ];

  return (
    <div className="mt-6 rounded-card border border-line bg-surface p-4">
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-sm font-semibold text-fg">{monthLabel}</h3>
        <div className="flex items-center gap-2 text-[11px] text-fg-subtle">
          <span className="h-2 w-2 rounded-full bg-low" />
          <span>Low</span>
          <span className="h-2 w-2 rounded-full bg-med" />
          <span>Med</span>
          <span className="h-2 w-2 rounded-full bg-high" />
          <span>High</span>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-7 gap-1 text-center text-[11px] text-fg-subtle">
        {["S", "M", "T", "W", "T", "F", "S"].map((day, index) => (
          <span key={`${day}-${index}`}>{day}</span>
        ))}
      </div>

      <div className="mt-2 grid grid-cols-7 gap-1">
        {calendarCells.map((cell) => {
          if (cell.day === null) {
            return <div key={cell.key} className="aspect-square" />;
          }

          const date = new Date(year, month, cell.day);
          const dayPriorities = getDayPriorities(goalsByDate[getDateKey(date)] ?? []);
          const isToday = date.toDateString() === today.toDateString();

          return (
            <button
              key={cell.key}
              type="button"
              onClick={() => onDateSelect?.(getDateKey(date))}
              className={`relative grid aspect-square place-items-center rounded-md border text-xs ${
                selectedDateKey === getDateKey(date)
                  ? "border-accent bg-accent/20 text-fg"
                  : isToday
                  ? "border-accent text-fg"
                  : "border-line text-fg-muted"
              }`}
            >
              {cell.day}
              {dayPriorities.length > 0 && (
                <span className="absolute bottom-1 flex max-w-[80%] items-center justify-center gap-0.5">
                  {dayPriorities.map((priority) => (
                    <span
                      key={priority}
                      className={`h-1.5 w-1.5 rounded-full ${priorityStyles[priority]}`}
                    />
                  ))}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
