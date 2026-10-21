/** Google Tasks dates are calendar days, not instants. Never convert them through UTC. */
export function taskDay(value: string | null | undefined): string {
  const day = value?.slice(0, 10) ?? "";
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) return "";
  const date = new Date(`${day}T12:00:00`);
  return Number.isFinite(date.getTime()) && localDay(date) === day ? day : "";
}

export function localDay(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

export function taskDayLabel(day: string, now = new Date()): string {
  if (!day) return "No date";
  const today = localDay(now);
  const next = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
  const previous = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);
  const prefix =
    day === today
      ? "Today"
      : day === localDay(next)
        ? "Tomorrow"
        : day === localDay(previous)
          ? "Yesterday"
          : "";
  const label = new Date(`${day}T12:00:00`).toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  });
  return prefix ? `${prefix} · ${label}` : label;
}

export function groupTasksByDay<T extends { dueDate: string | null; completed: boolean }>(
  tasks: T[],
) {
  const groups = new Map<string, T[]>();
  for (const task of tasks) {
    const day = taskDay(task.dueDate);
    const group = groups.get(day) ?? [];
    group.push(task);
    groups.set(day, group);
  }
  return [...groups]
    .sort(([a], [b]) => (a || "9999-99-99").localeCompare(b || "9999-99-99"))
    .map(([day, items]) => ({
      day,
      tasks: [...items].sort((a, b) => Number(a.completed) - Number(b.completed)),
    }));
}
