export interface StreakState {
  days: number;
  lastDate: string; // YYYY-MM-DD (UTC)
}

function dayDiff(later: string, earlier: string): number {
  const a = Date.UTC(
    Number(later.slice(0, 4)),
    Number(later.slice(5, 7)) - 1,
    Number(later.slice(8, 10)),
  );
  const b = Date.UTC(
    Number(earlier.slice(0, 4)),
    Number(earlier.slice(5, 7)) - 1,
    Number(earlier.slice(8, 10)),
  );
  return Math.round((a - b) / 86_400_000);
}

export function computeNextStreak(prev: StreakState | null, todayUTC: string): number {
  if (!prev) return 1;
  const gap = dayDiff(todayUTC, prev.lastDate);
  if (gap < 0) return 1; // clock-skew defensive
  if (gap === 0) return prev.days;
  if (gap <= 2) return prev.days + 1;
  return 1;
}
