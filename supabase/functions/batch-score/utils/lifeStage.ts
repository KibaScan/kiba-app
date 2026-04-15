// Life Stage Utilities — Scoring-only subset for Edge Function.
// Full implementation lives in src/utils/lifeStage.ts.

export function isUnder4Weeks(dateOfBirth: string | null): boolean {
  if (!dateOfBirth) return false;
  const parts = dateOfBirth.split('-').map(Number);
  const dob = new Date(parts[0], parts[1] - 1, parts[2]);
  const now = new Date();
  const diffMs = now.getTime() - dob.getTime();
  const diffWeeks = diffMs / (1000 * 60 * 60 * 24 * 7);
  return diffWeeks >= 0 && diffWeeks < 4;
}
