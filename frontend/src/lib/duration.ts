/** Time between two instants, compact: "40m", "3h 5m", "2d 4h". At least 1m. */
export function formatDuration(start: string, end: string) {
  const diffMs = Math.max(0, new Date(end).getTime() - new Date(start).getTime());
  const totalMinutes = Math.max(1, Math.round(diffMs / 60000));
  const days = Math.floor(totalMinutes / 1440);
  const hours = Math.floor((totalMinutes % 1440) / 60);
  const minutes = totalMinutes % 60;

  if (days > 0) return `${days}d ${hours}h`;
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
}
