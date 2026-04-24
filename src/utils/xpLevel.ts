// src/utils/xpLevel.ts
const HARD_LEVELS: number[] = [0, 100, 250, 500, 1000];
const MULTIPLIER = 1.8;
const MAX_LEVEL = 50;

function buildThresholds(): number[] {
  const result = [...HARD_LEVELS];
  for (let i = HARD_LEVELS.length; i < MAX_LEVEL; i++) {
    result.push(Math.round(result[i - 1] * MULTIPLIER));
  }
  return result;
}

export const LEVEL_THRESHOLDS: ReadonlyArray<number> = buildThresholds();

export interface LevelInfo {
  level: number;
  progress: number;       // 0.0–1.0 toward next level
  nextThreshold: number;  // XP needed to reach next level
}

export function levelForXP(totalXP: number): LevelInfo {
  const xp = Math.max(0, Math.floor(totalXP));
  let level = 1;
  for (let i = 1; i < LEVEL_THRESHOLDS.length; i++) {
    if (xp >= LEVEL_THRESHOLDS[i]) level = i + 1;
    else break;
  }
  const currentThreshold = LEVEL_THRESHOLDS[level - 1] ?? 0;
  const nextThreshold =
    LEVEL_THRESHOLDS[level] ?? LEVEL_THRESHOLDS[LEVEL_THRESHOLDS.length - 1];
  const span = Math.max(1, nextThreshold - currentThreshold);
  const progress = Math.min(1, Math.max(0, (xp - currentThreshold) / span));
  return { level, progress, nextThreshold };
}
