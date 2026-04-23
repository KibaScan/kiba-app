# Community Screen Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the launch-blocking Community tab — XP engine, Kiba Kitchen with auto-validators, Vendor Directory, Toxic Database, Blog, Safety Flags, Recall Live Feed.

**Architecture:** Server-side XP via Postgres triggers (un-spoofable, RLS-aware via `SECURITY DEFINER`). UGC moderation via auto-validators in an Edge Function with Studio approval. Reference data bundled client-side for offline-safe surfaces. CMS = Supabase Studio.

**Tech Stack:** Expo SDK 55, RN 0.83, TypeScript 5.9 strict, Supabase (Postgres + Auth + Storage + RLS + pg_cron + Edge Functions), Zustand, `react-native-markdown-display`, `expo-crypto`.

**Spec:** `docs/superpowers/specs/2026-04-23-community-screen-design.md` — read first.

**Branch:** `m9-community` (already cut off `m5-complete`).

**Conventions used throughout:**
- TDD: failing test → implementation → green test → commit. Tests-first, no exceptions.
- All migrations end with a manual smoke step (apply locally + verify in Studio).
- All new RN screens follow Matte Premium design (`.agent/design.md`): `cardSurface`, `hairlineBorder`, `Spacing.md` padding, `borderRadius: 16`. Read existing `PantryScreen` / `BookmarksScreen` for the canonical patterns.
- Pantry-pattern offline: writes throw a custom `*OfflineError`, reads return `[]` gracefully. See `src/services/pantryService.ts` for the canonical example.
- D-084: zero emoji. SF Symbols (via `react-native-sfsymbols` or equivalent) for all iconography.
- Commit per task. Use Conventional Commits (`M9: community — <task>`). Co-author tag per repo convention.

---

## Phase 1 — Schema Foundation (W1 D1)

### Task 1: Migrations 041–045 (5 tables + RLS)

**Files:**
- Create: `supabase/migrations/041_community_recipes.sql`
- Create: `supabase/migrations/042_user_xp.sql`
- Create: `supabase/migrations/043_blog_posts.sql`
- Create: `supabase/migrations/044_vendors.sql`
- Create: `supabase/migrations/045_score_flags.sql`

**Per-migration content:** copy SQL from spec §4.1 verbatim. Each table gets its own file. Each migration ends with `ALTER TABLE <name> ENABLE ROW LEVEL SECURITY;` and the RLS policies described in spec §4.1.

- [ ] **Step 1: Write `041_community_recipes.sql`**

```sql
CREATE TABLE community_recipes (
  id UUID PRIMARY KEY,  -- NO DEFAULT — client supplies (see spec §6.1)
  user_id UUID NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  title TEXT NOT NULL,
  subtitle TEXT,
  species TEXT NOT NULL CHECK (species IN ('dog','cat','both')),
  life_stage TEXT NOT NULL CHECK (life_stage IN ('puppy','adult','senior','all')),
  ingredients JSONB NOT NULL,
  prep_steps JSONB NOT NULL,
  cover_image_url TEXT,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','auto_rejected','pending_review','approved','rejected')),
  rejection_reason TEXT,
  is_killed BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  reviewed_at TIMESTAMPTZ
);

CREATE INDEX community_recipes_status_idx ON community_recipes (status, reviewed_at DESC);
CREATE INDEX community_recipes_user_idx ON community_recipes (user_id, created_at DESC);

ALTER TABLE community_recipes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users insert own recipes" ON community_recipes
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users read own + approved recipes" ON community_recipes
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR (status = 'approved' AND is_killed = false));

CREATE POLICY "Public read approved recipes" ON community_recipes
  FOR SELECT TO anon
  USING (status = 'approved' AND is_killed = false);
-- UPDATE: service role only (Studio moderation). No policy = denied.
```

- [ ] **Step 2: Write `042_user_xp.sql`**

```sql
CREATE TABLE user_xp_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  event_type TEXT NOT NULL
    CHECK (event_type IN ('scan','discovery','vote_verified','missing_product_approved','recipe_approved')),
  xp_delta INT NOT NULL,
  product_id UUID NULL REFERENCES products ON DELETE SET NULL,
  recipe_id UUID NULL REFERENCES community_recipes ON DELETE SET NULL,
  vote_id UUID NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX user_xp_events_user_time_idx ON user_xp_events (user_id, created_at DESC);
CREATE INDEX user_xp_events_recipe_idx ON user_xp_events (recipe_id) WHERE recipe_id IS NOT NULL;
CREATE INDEX user_xp_events_product_idx ON user_xp_events (product_id) WHERE product_id IS NOT NULL;

ALTER TABLE user_xp_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users read own xp events" ON user_xp_events
  FOR SELECT TO authenticated USING (user_id = auth.uid());
-- INSERT: triggers only (no client write). No policy = denied.

CREATE TABLE user_xp_totals (
  user_id UUID PRIMARY KEY REFERENCES auth.users ON DELETE CASCADE,
  total_xp INT NOT NULL DEFAULT 0,
  scans_count INT NOT NULL DEFAULT 0,
  discoveries_count INT NOT NULL DEFAULT 0,
  contributions_count INT NOT NULL DEFAULT 0,
  streak_current_days INT NOT NULL DEFAULT 0,
  streak_longest_days INT NOT NULL DEFAULT 0,
  streak_last_scan_date DATE,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE user_xp_totals ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users read own xp totals" ON user_xp_totals
  FOR SELECT TO authenticated USING (user_id = auth.uid());
-- INSERT/UPDATE: triggers only.
```

- [ ] **Step 3: Write `043_blog_posts.sql`**

```sql
CREATE TABLE blog_posts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  subtitle TEXT,
  cover_image_url TEXT,
  body_markdown TEXT NOT NULL,
  published_at TIMESTAMPTZ,
  is_published BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX blog_posts_published_idx ON blog_posts (published_at DESC) WHERE is_published = true;

ALTER TABLE blog_posts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read published blog posts" ON blog_posts
  FOR SELECT TO anon, authenticated USING (is_published = true);
-- Writes: service role only.
```

- [ ] **Step 4: Write `044_vendors.sql`**

```sql
CREATE TABLE vendors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_slug TEXT UNIQUE NOT NULL,
  brand_name TEXT NOT NULL,
  contact_email TEXT,
  website_url TEXT,
  parent_company TEXT,
  headquarters_country TEXT,
  is_published BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX vendors_published_idx ON vendors (brand_slug) WHERE is_published = true;

ALTER TABLE vendors ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read published vendors" ON vendors
  FOR SELECT TO anon, authenticated USING (is_published = true);
-- Writes: service role only.
```

- [ ] **Step 5: Write `045_score_flags.sql`**

```sql
CREATE TABLE score_flags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  pet_id UUID NOT NULL REFERENCES pets ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES products ON DELETE CASCADE,
  scan_id UUID NULL,
  reason TEXT NOT NULL
    CHECK (reason IN ('score_wrong','ingredient_missing','recalled','data_outdated','recipe_concern','other')),
  detail TEXT,
  status TEXT NOT NULL DEFAULT 'open'
    CHECK (status IN ('open','reviewed','resolved','rejected')),
  admin_note TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  reviewed_at TIMESTAMPTZ
);
CREATE INDEX score_flags_open_idx ON score_flags (status, created_at DESC) WHERE status = 'open';
CREATE INDEX score_flags_user_idx ON score_flags (user_id, created_at DESC);

ALTER TABLE score_flags ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users insert own flags" ON score_flags
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "Users read own flags" ON score_flags
  FOR SELECT TO authenticated USING (user_id = auth.uid());
-- UPDATE: service role only.
```

- [ ] **Step 6: Apply migrations to local Supabase + verify in Studio**

Run: `supabase db reset` (assumes local Supabase is running)
Expected: all 5 tables created, no errors, RLS enabled (Studio → Table Editor → each table → RLS toggle ON).

- [ ] **Step 7: Commit**

```bash
git add supabase/migrations/041_community_recipes.sql supabase/migrations/042_user_xp.sql \
  supabase/migrations/043_blog_posts.sql supabase/migrations/044_vendors.sql \
  supabase/migrations/045_score_flags.sql
git commit -m "M9 community: migrations 041-045 (recipes, xp, blog, vendors, flags) + RLS"
```

---

### Task 2: Migration 047 — storage buckets + RLS

**Files:**
- Create: `supabase/migrations/047_storage_buckets.sql`

(046 reserved for XP triggers — Task 8.)

- [ ] **Step 1: Write the migration**

```sql
-- 047_storage_buckets.sql

INSERT INTO storage.buckets (id, name, public)
VALUES ('recipe-images', 'recipe-images', true)
ON CONFLICT (id) DO NOTHING;

INSERT INTO storage.buckets (id, name, public)
VALUES ('blog-images', 'blog-images', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Users upload to own recipe folder" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'recipe-images'
    AND (auth.uid())::text = (string_to_array(name, '/'))[1]
  );

CREATE POLICY "Users delete own recipe images" ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'recipe-images'
    AND (auth.uid())::text = (string_to_array(name, '/'))[1]
  );

CREATE POLICY "Public read recipe images" ON storage.objects
  FOR SELECT TO anon, authenticated
  USING (bucket_id = 'recipe-images');

CREATE POLICY "Public read blog images" ON storage.objects
  FOR SELECT TO anon, authenticated
  USING (bucket_id = 'blog-images');
-- blog-images writes: service role only (no policy).
```

- [ ] **Step 2: Apply + smoke test**

Run: `supabase db reset` (or `supabase migration up` if 041-045 already applied).

Verify in Studio → Storage: both buckets listed, marked public. Upload a test image as authenticated user to `{your-uid}/test.jpg` in `recipe-images` — should succeed. Try uploading to `{other-uid}/test.jpg` — should fail with RLS error.

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/047_storage_buckets.sql
git commit -m "M9 community: migration 047 storage buckets (recipe-images, blog-images) + RLS"
```

---

## Phase 2 — Pure Helpers (W1 D2 morning)

All helpers are pure functions tested via Jest `.test.ts`. Render-test-free.

### Task 3: `xpLevel.ts` — level curve

**Files:**
- Create: `src/utils/xpLevel.ts`
- Test: `__tests__/utils/xpLevel.test.ts`

- [ ] **Step 1: Write failing test**

```ts
// __tests__/utils/xpLevel.test.ts
import { levelForXP, LEVEL_THRESHOLDS } from '@/utils/xpLevel';

describe('levelForXP', () => {
  it('returns level 1 for 0 XP', () => {
    expect(levelForXP(0)).toEqual({ level: 1, progress: 0, nextThreshold: 100 });
  });
  it('returns level 2 at exactly 100 XP', () => {
    expect(levelForXP(100)).toEqual({ level: 2, progress: 0, nextThreshold: 250 });
  });
  it('returns 50% progress mid-level', () => {
    const result = levelForXP(175); // L2 = 100, L3 = 250, halfway = 175
    expect(result.level).toBe(2);
    expect(result.progress).toBeCloseTo(0.5, 2);
  });
  it('returns level 5 at 1000 XP', () => {
    expect(levelForXP(1000).level).toBe(5);
  });
  it('handles very large XP without overflow', () => {
    const result = levelForXP(1_000_000);
    expect(result.level).toBeGreaterThan(20);
    expect(Number.isFinite(result.nextThreshold)).toBe(true);
  });
  it('exposes LEVEL_THRESHOLDS as deterministic array', () => {
    expect(LEVEL_THRESHOLDS[0]).toBe(0);
    expect(LEVEL_THRESHOLDS[1]).toBe(100);
    expect(LEVEL_THRESHOLDS[4]).toBe(1000);
  });
});
```

- [ ] **Step 2: Run test, verify failure**

Run: `npm test -- __tests__/utils/xpLevel.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

```ts
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
```

- [ ] **Step 4: Run test, verify pass**

Run: `npm test -- __tests__/utils/xpLevel.test.ts`
Expected: PASS, all 6 tests green.

- [ ] **Step 5: Commit**

```bash
git add src/utils/xpLevel.ts __tests__/utils/xpLevel.test.ts
git commit -m "M9 community: xpLevel pure helper + tests"
```

---

### Task 4: `streakGap.ts` — calendar-day grace logic

**Files:**
- Create: `src/utils/streakGap.ts`
- Test: `__tests__/utils/streakGap.test.ts`

- [ ] **Step 1: Failing test (covers the day-boundary edge from spec §5.3)**

```ts
// __tests__/utils/streakGap.test.ts
import { computeNextStreak } from '@/utils/streakGap';

describe('computeNextStreak', () => {
  it('initializes streak to 1 when no prior scan', () => {
    expect(computeNextStreak(null, '2026-04-23')).toBe(1);
  });
  it('no-ops on same-day scan (returns same streak)', () => {
    expect(computeNextStreak({ days: 5, lastDate: '2026-04-23' }, '2026-04-23')).toBe(5);
  });
  it('increments on consecutive day', () => {
    expect(computeNextStreak({ days: 5, lastDate: '2026-04-22' }, '2026-04-23')).toBe(6);
  });
  it('preserves streak across 1 missed day (gap_days = 2)', () => {
    expect(computeNextStreak({ days: 5, lastDate: '2026-04-21' }, '2026-04-23')).toBe(6);
  });
  it('resets when 2+ days are missed (gap_days = 3)', () => {
    expect(computeNextStreak({ days: 5, lastDate: '2026-04-20' }, '2026-04-23')).toBe(1);
  });
  it('preserves across day boundary (23:59 → 00:01 next day = gap_days 1)', () => {
    // both dates already normalized to YYYY-MM-DD by caller
    expect(computeNextStreak({ days: 1, lastDate: '2026-04-22' }, '2026-04-23')).toBe(2);
  });
  it('treats lastDate in the future as a reset to 1 (clock skew defensive)', () => {
    expect(computeNextStreak({ days: 9, lastDate: '2026-04-25' }, '2026-04-23')).toBe(1);
  });
});
```

- [ ] **Step 2: Run, expect fail**

Run: `npm test -- __tests__/utils/streakGap.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

```ts
// src/utils/streakGap.ts
export interface StreakState {
  days: number;
  lastDate: string;  // YYYY-MM-DD (UTC)
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
  if (gap < 0) return 1;       // clock-skew defensive
  if (gap === 0) return prev.days;
  if (gap <= 2) return prev.days + 1;
  return 1;
}
```

- [ ] **Step 4: Run, expect pass**

Run: `npm test -- __tests__/utils/streakGap.test.ts`
Expected: PASS, all 7 tests green.

- [ ] **Step 5: Commit**

```bash
git add src/utils/streakGap.ts __tests__/utils/streakGap.test.ts
git commit -m "M9 community: streakGap helper (calendar-day, 1-day grace) + tests"
```

---

### Task 5: `weeklyXPWindow.ts` — Monday-00:00 UTC boundary helper

**Files:**
- Create: `src/utils/weeklyXPWindow.ts`
- Test: `__tests__/utils/weeklyXPWindow.test.ts`

- [ ] **Step 1: Failing test**

```ts
// __tests__/utils/weeklyXPWindow.test.ts
import { startOfISOWeekUTC } from '@/utils/weeklyXPWindow';

describe('startOfISOWeekUTC', () => {
  it('returns Monday 00:00 UTC for a Tuesday afternoon', () => {
    expect(startOfISOWeekUTC(new Date('2026-04-21T14:30:00Z'))).toBe('2026-04-20T00:00:00.000Z');
  });
  it('returns the same Monday when called on Monday 00:00', () => {
    expect(startOfISOWeekUTC(new Date('2026-04-20T00:00:00Z'))).toBe('2026-04-20T00:00:00.000Z');
  });
  it('rolls back to previous Monday when called on Sunday', () => {
    expect(startOfISOWeekUTC(new Date('2026-04-26T23:59:00Z'))).toBe('2026-04-20T00:00:00.000Z');
  });
});
```

- [ ] **Step 2: Run, expect fail**

Run: `npm test -- __tests__/utils/weeklyXPWindow.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implement**

```ts
// src/utils/weeklyXPWindow.ts
export function startOfISOWeekUTC(now: Date = new Date()): string {
  const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  // getUTCDay: Sun=0, Mon=1, ..., Sat=6 → ISO offset Monday=0
  const isoDow = (d.getUTCDay() + 6) % 7;
  d.setUTCDate(d.getUTCDate() - isoDow);
  return d.toISOString();
}
```

- [ ] **Step 4: Run, expect pass**

Run: `npm test -- __tests__/utils/weeklyXPWindow.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/utils/weeklyXPWindow.ts __tests__/utils/weeklyXPWindow.test.ts
git commit -m "M9 community: weeklyXPWindow helper (ISO-week Monday 00:00 UTC) + tests"
```

---

### Task 6: `brandSlugify.ts`

**Files:**
- Create: `src/utils/brandSlugify.ts`
- Test: `__tests__/utils/brandSlugify.test.ts`

- [ ] **Step 1: Failing test**

```ts
// __tests__/utils/brandSlugify.test.ts
import { brandSlugify } from '@/utils/brandSlugify';

describe('brandSlugify', () => {
  it('lowercases and hyphenates spaces', () => {
    expect(brandSlugify('Pure Balance')).toBe('pure-balance');
  });
  it('strips punctuation', () => {
    expect(brandSlugify("Hill's Science Diet")).toBe('hills-science-diet');
  });
  it('collapses repeated separators', () => {
    expect(brandSlugify('Wellness   CORE  &  More')).toBe('wellness-core-more');
  });
  it('trims leading/trailing whitespace', () => {
    expect(brandSlugify('  Purina Pro Plan  ')).toBe('purina-pro-plan');
  });
  it('handles unicode by stripping non-ASCII alphanum', () => {
    expect(brandSlugify('Café Naturé')).toBe('caf-natur');
  });
  it('returns empty string for empty input', () => {
    expect(brandSlugify('')).toBe('');
    expect(brandSlugify('   ')).toBe('');
  });
});
```

- [ ] **Step 2: Run, expect fail.**

Run: `npm test -- __tests__/utils/brandSlugify.test.ts`

- [ ] **Step 3: Implement**

```ts
// src/utils/brandSlugify.ts
export function brandSlugify(brand: string): string {
  // Strip "elision" punctuation (apostrophes, periods in initials) FIRST so
  // they collapse cleanly. Then convert remaining non-alphanum to hyphens.
  // Test case: "Hill's Science Diet" → "hills-science-diet" (NOT "hill-s-...").
  return brand
    .toLowerCase()
    .replace(/['.]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}
```

- [ ] **Step 4: Run, expect pass.**

- [ ] **Step 5: Commit**

```bash
git add src/utils/brandSlugify.ts __tests__/utils/brandSlugify.test.ts
git commit -m "M9 community: brandSlugify helper + tests"
```

---

### Task 7: `validateRecipeSubmission.ts` (client-side mirror)

This is the client-side mirror of the Edge Function's auto-validators (spec §6.2). Used to give the user immediate feedback before submitting. Edge Function remains source of truth.

**Files:**
- Create: `src/utils/validateRecipeSubmission.ts`
- Test: `__tests__/utils/validateRecipeSubmission.test.ts`
- Depends on: `src/data/toxic_foods.json` (created in Task 10 — for now create a stub `{ "toxics": [] }` placeholder so this task can ship; Task 10 will populate)

- [ ] **Step 1: Stub the JSON if it doesn't exist yet**

```bash
mkdir -p src/data
[ -f src/data/toxic_foods.json ] || echo '{"toxics":[]}' > src/data/toxic_foods.json
```

- [ ] **Step 2: Failing test**

```ts
// __tests__/utils/validateRecipeSubmission.test.ts
import { validateRecipe } from '@/utils/validateRecipeSubmission';

const baseRecipe = {
  title: 'Peanut Butter Dog Treat',
  subtitle: undefined,
  species: 'dog' as const,
  prep_steps: ['Mix peanut butter and oats.', 'Bake at 350F.'],
  ingredients: [{ name: 'peanut butter', quantity: 1, unit: 'cup' }],
};

describe('validateRecipe', () => {
  it('passes a clean dog treat recipe', () => {
    expect(validateRecipe(baseRecipe)).toEqual({ valid: true });
  });
  it('rejects a recipe with chocolate (toxic to dog)', () => {
    const result = validateRecipe({
      ...baseRecipe,
      ingredients: [{ name: 'milk chocolate chips', quantity: 0.5, unit: 'cup' }],
    });
    expect(result.valid).toBe(false);
    expect(result.reason).toMatch(/chocolate.*toxic to dog/i);
  });
  it('rejects when title contains "treats arthritis"', () => {
    const result = validateRecipe({
      ...baseRecipe,
      title: 'Wonder Stew that treats arthritis',
    });
    expect(result.valid).toBe(false);
    expect(result.reason).toMatch(/medical claims/i);
  });
  it('does NOT reject the word "treat" alone (noun usage)', () => {
    expect(validateRecipe({ ...baseRecipe, title: 'Crunchy Beef Treat' }).valid).toBe(true);
  });
  it('rejects "helps with kidney disease"', () => {
    const result = validateRecipe({
      ...baseRecipe,
      subtitle: 'helps with kidney disease',
    });
    expect(result.valid).toBe(false);
    expect(result.reason).toMatch(/medical claims/i);
  });
  it('rejects when ingredients array is empty', () => {
    const result = validateRecipe({ ...baseRecipe, ingredients: [] });
    expect(result.valid).toBe(false);
    expect(result.reason).toMatch(/at least one ingredient/i);
  });
});
```

- [ ] **Step 3: Run, expect fail.**

- [ ] **Step 4: Implement**

```ts
// src/utils/validateRecipeSubmission.ts
import toxicFoods from '@/data/toxic_foods.json';

export interface RecipeSubmission {
  title: string;
  subtitle?: string;
  species: 'dog' | 'cat' | 'both';
  prep_steps: string[];
  ingredients: { name: string; quantity: number; unit: string }[];
}

export type ValidationResult = { valid: true } | { valid: false; reason: string };

const UPVM_REGEX =
  /\b(cure|prevent|diagnose|((helps with|good for|treats) .+ (disease|condition|allergy|arthritis|kidney|liver|cancer|diabetes|seizure)))\b/i;

interface ToxicEntry {
  id: string;
  name: string;
  alt_names: string[];
  species_severity: { dog: 'toxic' | 'caution' | 'safe'; cat: 'toxic' | 'caution' | 'safe' };
}

function findToxicMatch(
  ingredientName: string,
  species: 'dog' | 'cat' | 'both',
): ToxicEntry | null {
  const normalized = ingredientName.toLowerCase().trim();
  const checkSpecies: ('dog' | 'cat')[] = species === 'both' ? ['dog', 'cat'] : [species];
  const entries = (toxicFoods as { toxics: ToxicEntry[] }).toxics ?? [];
  for (const entry of entries) {
    const candidates = [entry.name.toLowerCase(), ...entry.alt_names.map((n) => n.toLowerCase())];
    if (!candidates.some((c) => normalized.includes(c))) continue;
    if (checkSpecies.some((s) => entry.species_severity[s] === 'toxic')) return entry;
  }
  return null;
}

export function validateRecipe(r: RecipeSubmission): ValidationResult {
  if (!r.title || r.title.trim().length < 4) {
    return { valid: false, reason: 'Title must be at least 4 characters.' };
  }
  if (r.ingredients.length === 0) {
    return { valid: false, reason: 'Recipe must include at least one ingredient.' };
  }
  if (r.prep_steps.length === 0) {
    return { valid: false, reason: 'Recipe must include at least one preparation step.' };
  }
  for (const ing of r.ingredients) {
    const match = findToxicMatch(ing.name, r.species);
    if (match) {
      const lethalSpecies =
        r.species === 'both'
          ? match.species_severity.dog === 'toxic'
            ? 'dog'
            : 'cat'
          : r.species;
      return {
        valid: false,
        reason: `This recipe contains ${match.name}, which is toxic to ${lethalSpecies}. Please remove it and resubmit.`,
      };
    }
  }
  const haystack = [r.title, r.subtitle ?? '', ...r.prep_steps].join(' \n ');
  if (UPVM_REGEX.test(haystack)) {
    return {
      valid: false,
      reason:
        'Community recipes can\'t include health or medical claims. Remove language about treating, curing, or preventing conditions and resubmit.',
    };
  }
  return { valid: true };
}
```

Note: tests will fail until Task 10 populates `toxic_foods.json` with chocolate. For now, add a temporary fixture seed in the test file via `jest.mock`:

```ts
jest.mock('@/data/toxic_foods.json', () => ({
  toxics: [
    {
      id: 'chocolate',
      name: 'chocolate',
      alt_names: ['cocoa', 'cacao'],
      species_severity: { dog: 'toxic', cat: 'toxic' },
    },
  ],
}), { virtual: true });
```

Add the `jest.mock` block at the top of `validateRecipeSubmission.test.ts` (before imports).

- [ ] **Step 5: Run, expect pass.**

Run: `npm test -- __tests__/utils/validateRecipeSubmission.test.ts`

- [ ] **Step 6: Commit**

```bash
git add src/utils/validateRecipeSubmission.ts __tests__/utils/validateRecipeSubmission.test.ts src/data/toxic_foods.json
git commit -m "M9 community: validateRecipe pure helper (toxic + UPVM checks) + tests"
```

---

## Phase 3 — XP Engine Server-Side (W1 D2 afternoon)

### Task 8: Migration 046 — XP triggers (`SECURITY DEFINER`, idempotent)

**Files:**
- Create: `supabase/migrations/046_xp_triggers.sql`
- Create: `supabase/tests/xp_triggers.sql` (SQL fixture-style test, runnable via `supabase test db`)

**Critical:** all 4 trigger functions MUST be `SECURITY DEFINER` and owned by `postgres`. Approval triggers MUST be idempotent.

- [ ] **Step 1: Write the migration**

```sql
-- 046_xp_triggers.sql

-- ============== Helper: update totals ==============
CREATE OR REPLACE FUNCTION upsert_user_xp_totals(
  p_user_id UUID,
  p_xp_delta INT,
  p_event_type TEXT
) RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  INSERT INTO user_xp_totals (user_id, total_xp, scans_count, discoveries_count, contributions_count, updated_at)
  VALUES (
    p_user_id, p_xp_delta,
    CASE WHEN p_event_type = 'scan' THEN 1 ELSE 0 END,
    CASE WHEN p_event_type = 'discovery' THEN 1 ELSE 0 END,
    CASE WHEN p_event_type IN ('vote_verified','missing_product_approved','recipe_approved') THEN 1 ELSE 0 END,
    NOW()
  )
  ON CONFLICT (user_id) DO UPDATE SET
    total_xp = user_xp_totals.total_xp + EXCLUDED.total_xp,
    scans_count = user_xp_totals.scans_count + EXCLUDED.scans_count,
    discoveries_count = user_xp_totals.discoveries_count + EXCLUDED.discoveries_count,
    contributions_count = user_xp_totals.contributions_count + EXCLUDED.contributions_count,
    updated_at = NOW();
END;
$$;

-- ============== Trigger: scan + streak + discovery ==============
CREATE OR REPLACE FUNCTION process_scan_xp() RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_today DATE := (NOW() AT TIME ZONE 'UTC')::DATE;
  v_existing user_xp_totals%ROWTYPE;
  v_gap_days INT;
  v_is_discovery BOOLEAN;
BEGIN
  -- Award scan XP
  INSERT INTO user_xp_events (user_id, event_type, xp_delta, product_id)
  VALUES (NEW.user_id, 'scan', 10, NEW.product_id);
  PERFORM upsert_user_xp_totals(NEW.user_id, 10, 'scan');

  -- Discovery bonus
  v_is_discovery := NOT EXISTS (
    SELECT 1 FROM scans WHERE product_id = NEW.product_id AND id <> NEW.id
  );
  IF v_is_discovery THEN
    INSERT INTO user_xp_events (user_id, event_type, xp_delta, product_id)
    VALUES (NEW.user_id, 'discovery', 50, NEW.product_id);
    PERFORM upsert_user_xp_totals(NEW.user_id, 50, 'discovery');
  END IF;

  -- Streak (calendar-day math, 1-day grace = up to gap_days 2)
  SELECT * INTO v_existing FROM user_xp_totals WHERE user_id = NEW.user_id;
  IF v_existing.streak_last_scan_date IS NULL THEN
    UPDATE user_xp_totals SET
      streak_current_days = 1,
      streak_longest_days = GREATEST(streak_longest_days, 1),
      streak_last_scan_date = v_today
    WHERE user_id = NEW.user_id;
  ELSE
    v_gap_days := v_today - v_existing.streak_last_scan_date;
    IF v_gap_days < 0 THEN
      UPDATE user_xp_totals SET
        streak_current_days = 1,
        streak_last_scan_date = v_today
      WHERE user_id = NEW.user_id;
    ELSIF v_gap_days = 0 THEN
      -- same-day, no-op
      NULL;
    ELSIF v_gap_days <= 2 THEN
      UPDATE user_xp_totals SET
        streak_current_days = streak_current_days + 1,
        streak_longest_days = GREATEST(streak_longest_days, streak_current_days + 1),
        streak_last_scan_date = v_today
      WHERE user_id = NEW.user_id;
    ELSE
      UPDATE user_xp_totals SET
        streak_current_days = 1,
        streak_last_scan_date = v_today
      WHERE user_id = NEW.user_id;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER scans_award_xp
  AFTER INSERT ON scans
  FOR EACH ROW EXECUTE FUNCTION process_scan_xp();

-- ============== Trigger: kiba_index_votes (scan-verified only) ==============
CREATE OR REPLACE FUNCTION process_vote_xp() RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM scans
    WHERE user_id = NEW.user_id AND product_id = NEW.product_id
  ) THEN
    INSERT INTO user_xp_events (user_id, event_type, xp_delta, product_id, vote_id)
    VALUES (NEW.user_id, 'vote_verified', 15, NEW.product_id, NEW.id);
    PERFORM upsert_user_xp_totals(NEW.user_id, 15, 'vote_verified');
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER kiba_index_votes_award_xp
  AFTER INSERT ON kiba_index_votes
  FOR EACH ROW EXECUTE FUNCTION process_vote_xp();

-- ============== Trigger: recipe approval (idempotent) ==============
CREATE OR REPLACE FUNCTION process_recipe_approval_xp() RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NEW.status = 'approved' AND OLD.status IS DISTINCT FROM 'approved' THEN
    IF NOT EXISTS (
      SELECT 1 FROM user_xp_events
      WHERE recipe_id = NEW.id AND event_type = 'recipe_approved'
    ) THEN
      INSERT INTO user_xp_events (user_id, event_type, xp_delta, recipe_id)
      VALUES (NEW.user_id, 'recipe_approved', 100, NEW.id);
      PERFORM upsert_user_xp_totals(NEW.user_id, 100, 'recipe_approved');
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER community_recipes_award_approval_xp
  AFTER UPDATE OF status ON community_recipes
  FOR EACH ROW EXECUTE FUNCTION process_recipe_approval_xp();

-- ============== Trigger: missing-product approval (idempotent) ==============
CREATE OR REPLACE FUNCTION process_missing_product_approval_xp() RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_contributor UUID;
BEGIN
  IF NEW.needs_review = false AND OLD.needs_review = true AND NEW.contributed_by IS NOT NULL THEN
    v_contributor := NEW.contributed_by;
    IF NOT EXISTS (
      SELECT 1 FROM user_xp_events
      WHERE product_id = NEW.id AND event_type = 'missing_product_approved'
    ) THEN
      INSERT INTO user_xp_events (user_id, event_type, xp_delta, product_id)
      VALUES (v_contributor, 'missing_product_approved', 100, NEW.id);
      PERFORM upsert_user_xp_totals(v_contributor, 100, 'missing_product_approved');
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER products_award_missing_approval_xp
  AFTER UPDATE OF needs_review ON products
  FOR EACH ROW EXECUTE FUNCTION process_missing_product_approval_xp();

-- ============== Ownership: ensure SECURITY DEFINER bypasses RLS ==============
ALTER FUNCTION upsert_user_xp_totals(UUID, INT, TEXT) OWNER TO postgres;
ALTER FUNCTION process_scan_xp() OWNER TO postgres;
ALTER FUNCTION process_vote_xp() OWNER TO postgres;
ALTER FUNCTION process_recipe_approval_xp() OWNER TO postgres;
ALTER FUNCTION process_missing_product_approval_xp() OWNER TO postgres;
```

- [ ] **Step 2: Apply + smoke test**

Run: `supabase migration up` (or `supabase db reset`).
Verify: trigger exists in `pg_trigger` for all 4 source tables. Test manually in Studio SQL editor:

```sql
-- Insert a fake scan as a user (replace UID), check user_xp_totals updates.
INSERT INTO scans (user_id, pet_id, product_id, final_score, scanned_at)
VALUES ('YOUR_TEST_UID', 'YOUR_PET_UID', 'A_PRODUCT_UID', 50, NOW());
SELECT * FROM user_xp_totals WHERE user_id = 'YOUR_TEST_UID';
-- Expect: total_xp = 10 (or 60 if new UPC), scans_count = 1, streak = 1
```

- [ ] **Step 3: Add SQL test scaffold**

Create `supabase/tests/xp_triggers.sql` with at minimum these test cases:
1. First scan = +10 XP, streak = 1.
2. Same-day second scan = +10 XP, streak still 1.
3. Next-day scan = +10 XP, streak = 2.
4. Gap of 3 days = streak resets to 1.
5. First scan of a UPC = discovery bonus (+50). Second user's scan of same UPC = no bonus.
6. Vote without prior scan = +0 XP.
7. Vote after scan = +15 XP.
8. Recipe approve: first flip = +100. Re-approve = no change.
9. Product needs_review false→true→false = +100 only once.

Use `BEGIN; ROLLBACK;` blocks for isolation. Pattern from existing `supabase/tests/` if present; otherwise use vanilla `assert` in a DO block.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/046_xp_triggers.sql supabase/tests/xp_triggers.sql
git commit -m "M9 community: migration 046 XP triggers (SECURITY DEFINER, idempotent) + SQL tests"
```

---

### Task 9: `get_user_xp_summary()` RPC

**Files:**
- Modify: `supabase/migrations/046_xp_triggers.sql` — append at end
- (Or: create `supabase/migrations/048_xp_summary_rpc.sql` if 046 is already applied to a remote; per repo convention, single migration per cohesive concern is fine — appending here is OK if tip is local-only.)

For safety, use a new migration file:
- Create: `supabase/migrations/048_xp_summary_rpc.sql`

- [ ] **Step 1: Write the RPC**

```sql
-- 048_xp_summary_rpc.sql
CREATE OR REPLACE FUNCTION get_user_xp_summary()
RETURNS TABLE (
  total_xp INT,
  scans_count INT,
  discoveries_count INT,
  contributions_count INT,
  streak_current_days INT,
  streak_longest_days INT,
  weekly_xp INT
)
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_user UUID := auth.uid();
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'auth required';
  END IF;
  RETURN QUERY
  SELECT
    COALESCE(t.total_xp, 0),
    COALESCE(t.scans_count, 0),
    COALESCE(t.discoveries_count, 0),
    COALESCE(t.contributions_count, 0),
    COALESCE(t.streak_current_days, 0),
    COALESCE(t.streak_longest_days, 0),
    COALESCE((
      SELECT SUM(xp_delta)::INT FROM user_xp_events
      WHERE user_id = v_user
        AND created_at >= (date_trunc('week', NOW() AT TIME ZONE 'UTC') AT TIME ZONE 'UTC')
    ), 0)
  FROM (SELECT NULL::INT) AS dummy
  LEFT JOIN user_xp_totals t ON t.user_id = v_user;
END;
$$;

ALTER FUNCTION get_user_xp_summary() OWNER TO postgres;
GRANT EXECUTE ON FUNCTION get_user_xp_summary() TO authenticated;
```

- [ ] **Step 2: Apply + smoke**

```bash
supabase migration up
```

In Studio SQL editor as your test user (impersonate via Studio "Set role"):
```sql
SELECT * FROM get_user_xp_summary();
-- Expect: 7 columns, zeros if no XP yet, populated if Task 8 smoke happened.
```

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/048_xp_summary_rpc.sql
git commit -m "M9 community: get_user_xp_summary RPC"
```

---

## Phase 4 — Edge Function + Data Seeds (W1 D3)

### Task 10: `toxic_foods.json` curated seed + `syncToxicFoods.ts`

**Files:**
- Modify: `src/data/toxic_foods.json` (replace stub from Task 7 with real seed)
- Create: `scripts/syncToxicFoods.ts`
- Create: `supabase/functions/validate-recipe/toxic_foods.json` (build artifact — git-ignored OR committed; commit it for reproducibility)

**Curation source:** ASPCA Animal Poison Control Center toxin list + AVMA + Pet Poison Helpline. Aim for ≥30 entries spanning food / plant / medication / household categories. Examples:

- **Food:** chocolate, xylitol, grapes/raisins, onions, garlic, macadamia nuts, alcohol, caffeine, raw bread dough, raw eggs (cat-only), raw fish (cat-only — thiaminase), avocado, cherry pits.
- **Plant:** lily (cat — kidney failure), tulip, sago palm, oleander.
- **Medication:** ibuprofen, acetaminophen (cat fatal), pseudoephedrine.
- **Household:** antifreeze, rodenticide, bleach, certain essential oils (tea tree, eucalyptus — cat).

- [ ] **Step 1: Populate `src/data/toxic_foods.json`**

```json
{
  "toxics": [
    {
      "id": "chocolate",
      "name": "Chocolate",
      "alt_names": ["cocoa", "cacao", "milk chocolate", "dark chocolate", "baker's chocolate"],
      "category": "food",
      "species_severity": { "dog": "toxic", "cat": "toxic" },
      "symptoms": ["vomiting", "diarrhea", "tremors", "rapid heart rate", "seizures"],
      "safe_threshold_note": null,
      "references": [
        { "label": "ASPCA Animal Poison Control", "url": "https://www.aspca.org/pet-care/animal-poison-control/dogs-plants" }
      ]
    }
    // ... 29+ more entries
  ]
}
```

(Full curated list out of plan scope — engineer compiles from cited sources, peer-reviewed before commit. Treat curation as part of this task.)

- [ ] **Step 2: Write `scripts/syncToxicFoods.ts`**

```ts
// scripts/syncToxicFoods.ts
import { copyFileSync, existsSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

const SRC = resolve(__dirname, '..', 'src', 'data', 'toxic_foods.json');
const DEST = resolve(
  __dirname,
  '..',
  'supabase',
  'functions',
  'validate-recipe',
  'toxic_foods.json',
);

if (!existsSync(SRC)) {
  console.error(`Source not found: ${SRC}`);
  process.exit(1);
}
mkdirSync(dirname(DEST), { recursive: true });
copyFileSync(SRC, DEST);
console.log(`Synced ${SRC} → ${DEST}`);
```

Add to `package.json` scripts:
```json
"scripts": {
  "sync:toxics": "ts-node scripts/syncToxicFoods.ts"
}
```

- [ ] **Step 3: Run sync, verify destination**

```bash
npm run sync:toxics
ls -la supabase/functions/validate-recipe/toxic_foods.json
```

- [ ] **Step 4: Commit**

```bash
git add src/data/toxic_foods.json scripts/syncToxicFoods.ts \
  supabase/functions/validate-recipe/toxic_foods.json package.json
git commit -m "M9 community: curated toxic_foods.json + syncToxicFoods script"
```

---

### Task 11: `validate-recipe` Edge Function + fixture tests

**Files:**
- Create: `supabase/functions/validate-recipe/index.ts`
- Create: `supabase/functions/validate-recipe/deno.json`
- Create: `supabase/functions/validate-recipe/_test.ts`

- [ ] **Step 1: Write the Edge Function**

`Deno.serve` is a native global in current Supabase Edge Runtime — no `std/http/server.ts` import needed.

```ts
// supabase/functions/validate-recipe/index.ts
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';
import toxicFoods from './toxic_foods.json' with { type: 'json' };

interface RecipePayload {
  recipe_id: string;
}

interface ToxicEntry {
  id: string;
  name: string;
  alt_names: string[];
  species_severity: { dog: 'toxic' | 'caution' | 'safe'; cat: 'toxic' | 'caution' | 'safe' };
}

const UPVM_REGEX =
  /\b(cure|prevent|diagnose|((helps with|good for|treats) .+ (disease|condition|allergy|arthritis|kidney|liver|cancer|diabetes|seizure)))\b/i;

function findToxicMatch(name: string, species: 'dog' | 'cat' | 'both'): ToxicEntry | null {
  const normalized = name.toLowerCase().trim();
  const checkSpecies: ('dog' | 'cat')[] = species === 'both' ? ['dog', 'cat'] : [species];
  for (const entry of (toxicFoods as { toxics: ToxicEntry[] }).toxics) {
    const candidates = [entry.name.toLowerCase(), ...entry.alt_names.map((n) => n.toLowerCase())];
    if (!candidates.some((c) => normalized.includes(c))) continue;
    if (checkSpecies.some((s) => entry.species_severity[s] === 'toxic')) return entry;
  }
  return null;
}

Deno.serve(async (req) => {
  const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
  const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const admin = createClient(SUPABASE_URL, SERVICE_KEY);

  const body = (await req.json()) as RecipePayload;
  if (!body?.recipe_id) {
    return new Response(JSON.stringify({ error: 'recipe_id required' }), { status: 400 });
  }

  const { data: recipe, error: fetchError } = await admin
    .from('community_recipes')
    .select('*')
    .eq('id', body.recipe_id)
    .single();
  if (fetchError || !recipe) {
    return new Response(JSON.stringify({ error: 'recipe not found' }), { status: 404 });
  }

  // Toxic-ingredient scan
  for (const ing of recipe.ingredients as { name: string }[]) {
    const match = findToxicMatch(ing.name, recipe.species);
    if (match) {
      const lethalSpecies =
        recipe.species === 'both'
          ? match.species_severity.dog === 'toxic'
            ? 'dog'
            : 'cat'
          : recipe.species;
      const reason = `This recipe contains ${match.name}, which is toxic to ${lethalSpecies}. Please remove it and resubmit.`;
      await admin
        .from('community_recipes')
        .update({ status: 'auto_rejected', rejection_reason: reason, reviewed_at: new Date().toISOString() })
        .eq('id', recipe.id);
      return new Response(JSON.stringify({ status: 'auto_rejected', reason }));
    }
  }

  // UPVM regex
  const haystack = [recipe.title, recipe.subtitle ?? '', ...(recipe.prep_steps as string[])].join(
    ' \n ',
  );
  if (UPVM_REGEX.test(haystack)) {
    const reason =
      'Community recipes can\'t include health or medical claims. Remove language about treating, curing, or preventing conditions and resubmit.';
    await admin
      .from('community_recipes')
      .update({ status: 'auto_rejected', rejection_reason: reason, reviewed_at: new Date().toISOString() })
      .eq('id', recipe.id);
    return new Response(JSON.stringify({ status: 'auto_rejected', reason }));
  }

  await admin
    .from('community_recipes')
    .update({ status: 'pending_review' })
    .eq('id', recipe.id);
  return new Response(JSON.stringify({ status: 'pending_review' }));
});
```

- [ ] **Step 2: Write `deno.json`**

```json
{
  "imports": {}
}
```

- [ ] **Step 3: Write Deno test file**

```ts
// supabase/functions/validate-recipe/_test.ts
import { assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts';
import toxicFoods from './toxic_foods.json' with { type: 'json' };

const UPVM_REGEX =
  /\b(cure|prevent|diagnose|((helps with|good for|treats) .+ (disease|condition|allergy|arthritis|kidney|liver|cancer|diabetes|seizure)))\b/i;

Deno.test('UPVM allows "Peanut Butter Dog Treat"', () => {
  assertEquals(UPVM_REGEX.test('Peanut Butter Dog Treat'), false);
});
Deno.test('UPVM blocks "treats arthritis"', () => {
  assertEquals(UPVM_REGEX.test('Wonder mix that treats arthritis pain'), true);
});
Deno.test('UPVM blocks "helps with kidney disease"', () => {
  assertEquals(UPVM_REGEX.test('helps with kidney disease'), true);
});
Deno.test('UPVM allows "good for shedding" (out of scope, defer to human review)', () => {
  assertEquals(UPVM_REGEX.test('good for shedding'), false);
});
Deno.test('toxic_foods.json has chocolate entry', () => {
  const entries = (toxicFoods as { toxics: { name: string }[] }).toxics;
  const chocolate = entries.find((e) => e.name.toLowerCase().includes('chocolate'));
  assertEquals(!!chocolate, true);
});
```

- [ ] **Step 4: Run tests** (uses Supabase CLI's bundled Deno; bare `deno` is unlikely to be on PATH in this Expo repo)

```bash
npx supabase functions test validate-recipe
```

If `supabase functions test` is unavailable in your CLI version, fall back to `npx supabase functions serve --no-verify-jwt validate-recipe` and run tests against the local function endpoint via `curl` or a Jest integration test. Don't install Deno globally just for this.

Expected: PASS, 5 tests.

- [ ] **Step 5: Deploy + integration smoke**

```bash
supabase functions deploy validate-recipe
```

In Studio SQL editor: insert a test community_recipes row with an offending ingredient, then call the function via HTTP from the Studio's function tester or `curl`. Verify status flips to `auto_rejected`.

- [ ] **Step 6: Commit**

```bash
git add supabase/functions/validate-recipe/
git commit -m "M9 community: validate-recipe Edge Function (toxic + UPVM auto-validators) + tests"
```

---

### Task 12: `seedVendors.ts` (DB upsert + bundled-slugs artifact)

**Files:**
- Create: `scripts/seedVendors.ts`
- Create: `docs/data/vendors.json` (placeholder — Steven fills in parallel)
- Create: `src/data/published_vendor_slugs.json` (build artifact, regenerated by script)

- [ ] **Step 1: Write placeholder `docs/data/vendors.json`**

```json
{ "vendors": [] }
```

- [ ] **Step 2: Write `scripts/seedVendors.ts`**

```ts
// scripts/seedVendors.ts
import { createClient } from '@supabase/supabase-js';
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const VENDORS_JSON = resolve(__dirname, '..', 'docs', 'data', 'vendors.json');
const SLUGS_OUT = resolve(__dirname, '..', 'src', 'data', 'published_vendor_slugs.json');

interface VendorInput {
  brand_name: string;
  contact_email?: string;
  website_url?: string;
  parent_company?: string;
  headquarters_country?: string;
  is_published?: boolean;
}

function brandSlugify(brand: string): string {
  return brand
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

async function main() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    console.error('Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY env vars.');
    process.exit(1);
  }
  const sb = createClient(url, key);

  const file = JSON.parse(readFileSync(VENDORS_JSON, 'utf-8')) as { vendors: VendorInput[] };
  const rows = file.vendors.map((v) => ({
    brand_slug: brandSlugify(v.brand_name),
    brand_name: v.brand_name,
    contact_email: v.contact_email ?? null,
    website_url: v.website_url ?? null,
    parent_company: v.parent_company ?? null,
    headquarters_country: v.headquarters_country ?? null,
    is_published: v.is_published ?? false,
    updated_at: new Date().toISOString(),
  }));

  const { error } = await sb.from('vendors').upsert(rows, { onConflict: 'brand_slug' });
  if (error) {
    console.error('Upsert failed:', error);
    process.exit(1);
  }
  console.log(`Upserted ${rows.length} vendors.`);

  // Regenerate published_vendor_slugs.json
  const publishedSlugs = rows.filter((r) => r.is_published).map((r) => r.brand_slug);
  writeFileSync(SLUGS_OUT, JSON.stringify(publishedSlugs, null, 2));
  console.log(`Wrote ${publishedSlugs.length} published slugs to ${SLUGS_OUT}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
```

Add to `package.json`:
```json
"scripts": {
  "seed:vendors": "ts-node scripts/seedVendors.ts"
}
```

Initial bundled slugs:
```bash
echo "[]" > src/data/published_vendor_slugs.json
```

- [ ] **Step 3: Smoke run** (only after Steven supplies real `docs/data/vendors.json`)

```bash
SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... npm run seed:vendors
```

For now, run with the empty placeholder — should succeed with 0 vendors.

- [ ] **Step 4: Commit**

```bash
git add scripts/seedVendors.ts docs/data/vendors.json src/data/published_vendor_slugs.json package.json
git commit -m "M9 community: seedVendors script + published_vendor_slugs artifact"
```

---

## Phase 5 — Services Layer (W1 D4 morning)

Each service is a thin wrapper over `supabase` with offline guards. Pattern: `src/services/pantryService.ts` is the canonical example.

### Task 13: Types + `xpService.ts`

**Files:**
- Create: `src/types/xp.ts`
- Create: `src/services/xpService.ts`
- Test: `__tests__/services/xpService.test.ts`

- [ ] **Step 1: Write types**

```ts
// src/types/xp.ts
export interface XPSummary {
  total_xp: number;
  level: number;
  progress_pct: number;
  next_threshold: number;
  weekly_xp: number;
  streak_current_days: number;
  streak_longest_days: number;
  scans_count: number;
  discoveries_count: number;
  contributions_count: number;
}
```

- [ ] **Step 2: Failing test**

```ts
// __tests__/services/xpService.test.ts
import { fetchXPSummary } from '@/services/xpService';

jest.mock('@/services/supabase', () => ({
  supabase: {
    rpc: jest.fn().mockResolvedValue({
      data: [{
        total_xp: 250, scans_count: 10, discoveries_count: 1, contributions_count: 2,
        streak_current_days: 5, streak_longest_days: 12, weekly_xp: 75,
      }],
      error: null,
    }),
  },
}));

describe('fetchXPSummary', () => {
  it('returns enriched summary with derived level + progress', async () => {
    const summary = await fetchXPSummary();
    expect(summary.total_xp).toBe(250);
    expect(summary.level).toBe(3);   // L3 starts at 250
    expect(summary.progress_pct).toBeCloseTo(0, 2);
    expect(summary.weekly_xp).toBe(75);
  });
});
```

- [ ] **Step 3: Run, expect fail.**

- [ ] **Step 4: Implement**

```ts
// src/services/xpService.ts
import { supabase } from '@/services/supabase';
import { levelForXP } from '@/utils/xpLevel';
import type { XPSummary } from '@/types/xp';

export async function fetchXPSummary(): Promise<XPSummary> {
  const { data, error } = await supabase.rpc('get_user_xp_summary');
  if (error) throw error;
  const row = (data as Array<{
    total_xp: number;
    scans_count: number;
    discoveries_count: number;
    contributions_count: number;
    streak_current_days: number;
    streak_longest_days: number;
    weekly_xp: number;
  }>)[0] ?? {
    total_xp: 0, scans_count: 0, discoveries_count: 0, contributions_count: 0,
    streak_current_days: 0, streak_longest_days: 0, weekly_xp: 0,
  };
  const lvl = levelForXP(row.total_xp);
  return {
    total_xp: row.total_xp,
    level: lvl.level,
    progress_pct: lvl.progress,
    next_threshold: lvl.nextThreshold,
    weekly_xp: row.weekly_xp,
    streak_current_days: row.streak_current_days,
    streak_longest_days: row.streak_longest_days,
    scans_count: row.scans_count,
    discoveries_count: row.discoveries_count,
    contributions_count: row.contributions_count,
  };
}
```

- [ ] **Step 5: Run, expect pass.**

- [ ] **Step 6: Commit**

```bash
git add src/types/xp.ts src/services/xpService.ts __tests__/services/xpService.test.ts
git commit -m "M9 community: xpService + types + tests"
```

---

### Task 14: `communityService.ts` (recall feed + Kiba Index highlights)

**Files:**
- Create: `src/services/communityService.ts`
- Test: `__tests__/services/communityService.test.ts`

Functions:
- `fetchRecentRecalls(): Promise<Array<{ brand: string; name: string; product_id: string }>>` — `products WHERE is_recalled=true AND updated_at >= NOW() - INTERVAL '30 days' ORDER BY updated_at DESC LIMIT 5`. Returns `[]` on offline.
- `fetchKibaIndexHighlights(species: 'dog' | 'cat'): Promise<Array<{ product_id: string; brand: string; name: string; metric: 'picky_eaters' | 'sensitive_tummies'; score: number }>>` — uses existing `get_kiba_index_stats` RPC; returns top 3 per metric.

- [ ] **Step 1: Write tests** (mock supabase + RPC; assert shape)
- [ ] **Step 2: Implement**
- [ ] **Step 3: Pass tests**
- [ ] **Step 4: Commit** — `M9 community: communityService (recalls + Kiba Index highlights) + tests`

(Mirror `src/services/topMatches.ts` for shape.)

---

### Task 15: `recipeService.ts` + types

**Files:**
- Create: `src/types/recipe.ts`
- Create: `src/services/recipeService.ts`
- Test: `__tests__/services/recipeService.test.ts`

Functions:
- `submitRecipe(input)` — generates UUID via `expo-crypto`, uploads cover image to `recipe-images/{uid}/{recipeId}.jpg`, INSERTs row, calls `validate-recipe` Edge Function, returns final status.
- `fetchApprovedRecipes(limit = 20)` — `community_recipes WHERE status='approved' AND is_killed=false ORDER BY reviewed_at DESC LIMIT $1`.
- `fetchRecipeById(id)` — single row by ID.
- `fetchMyRecipes()` — own user's submissions, all statuses.

Throws `RecipeOfflineError` for writes when offline. Reads return `[]`.

- [ ] **Step 1-4:** Tests, implement, pass, commit.

Commit message: `M9 community: recipeService (submit/fetch + offline guard) + tests`

---

### Task 16: `vendorService.ts`

**Files:**
- Create: `src/services/vendorService.ts`
- Test: `__tests__/services/vendorService.test.ts`

Functions:
- `fetchPublishedVendors()` — `vendors WHERE is_published=true ORDER BY brand_name`.
- `fetchVendorBySlug(slug)` — single row.
- `isPublishedSlug(slug)` — synchronous check against bundled `published_vendor_slugs.json` (used by ResultScreen).

Tests cover the bundled-list sync check (no network) and online fetch (mocked).

- [ ] **Steps 1-4:** Tests, implement, pass, commit. Message: `M9 community: vendorService + bundled slug check + tests`

---

### Task 17: `blogService.ts`

**Files:**
- Create: `src/services/blogService.ts`
- Test: `__tests__/services/blogService.test.ts`

Functions:
- `fetchPublishedPosts(limit = 20)` — `blog_posts WHERE is_published=true ORDER BY published_at DESC LIMIT $1`.
- `fetchPostById(id)` — single row.

Reads return `[]` / `null` offline.

- [ ] **Steps 1-4:** Same TDD shape. Commit: `M9 community: blogService + tests`

---

### Task 18: `scoreFlagService.ts`

**Files:**
- Create: `src/services/scoreFlagService.ts`
- Test: `__tests__/services/scoreFlagService.test.ts`

Functions:
- `submitFlag(input)` — INSERT row in `score_flags`. Throws `ScoreFlagOfflineError` offline.
- `fetchMyFlags()` — own user's flags ordered by `created_at DESC`.
- `fetchCommunityActivityCounts()` — aggregate via RPC OR view (`SELECT reason, COUNT(*) FROM score_flags WHERE created_at >= NOW() - INTERVAL '7 days' GROUP BY reason`). For MVP, do a SECURITY DEFINER RPC to avoid exposing raw rows.

You'll need a small migration `049_score_flag_aggregate_rpc.sql`:

```sql
CREATE OR REPLACE FUNCTION get_score_flag_activity_counts()
RETURNS TABLE (reason TEXT, count INT)
LANGUAGE sql SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT reason, COUNT(*)::INT FROM score_flags
  WHERE created_at >= NOW() - INTERVAL '7 days'
  GROUP BY reason;
$$;
ALTER FUNCTION get_score_flag_activity_counts() OWNER TO postgres;
GRANT EXECUTE ON FUNCTION get_score_flag_activity_counts() TO authenticated;
```

- [ ] **Steps 1-5:** Tests, implement, migration apply, pass, commit. Message: `M9 community: scoreFlagService + aggregate RPC + tests`

---

## Phase 6 — Navigation & Core Screen (W1 D4 afternoon)

### Task 19: Expand `CommunityStackParamList` + register routes

**Files:**
- Modify: `src/types/navigation.ts` — add the 7 new routes.
- Modify: `App.tsx` (or wherever `CommunityStack.Navigator` is defined; grep `CommunityStack` to locate).

- [ ] **Step 1: Update types**

```ts
// add to CommunityStackParamList
KibaKitchenFeed: undefined;
KibaKitchenSubmit: undefined;
KibaKitchenRecipeDetail: { recipeId: string };
ToxicDatabase: undefined;
VendorDirectory: { initialBrand?: string } | undefined;
BlogList: undefined;
BlogDetail: { postId: string };
SafetyFlags: undefined;
```

- [ ] **Step 2: Register screens** (each as a `<Stack.Screen name="..." component={...}>` once each screen file exists — initially you can stub with placeholder components that render `<Text>TBD</Text>` to satisfy the navigator).
- [ ] **Step 3: Run TS check**

```bash
npx tsc --noEmit
```
Expected: no new errors related to navigation types.

- [ ] **Step 4: Commit**

```bash
git add src/types/navigation.ts App.tsx src/screens/  # placeholder screens if added
git commit -m "M9 community: expand CommunityStackParamList + register 7 new routes"
```

---

### Task 20: Rebuild `CommunityScreen` shell

Replace the existing placeholder card grid with the real layout per spec §3. This task ships the **shell only** — XP ribbon, recall banner placeholder, Discovery Grid wrapper (tiles wired in Task 30), Blog carousel placeholder, subreddit footer.

**Files:**
- Modify: `src/screens/CommunityScreen.tsx`
- Create: `src/components/community/XPRibbon.tsx`
- Create: `src/components/community/RecallBanner.tsx`
- Create: `src/components/community/SubredditFooter.tsx`
- Test: `__tests__/screens/CommunityScreen.test.tsx`

- [ ] **Step 1: Write `XPRibbon.tsx`**

Per spec §3 + §15.2. Layout: top row "Lv. 7 · 2,340 XP · 🔥 12-day streak" (flame = SF Symbol `flame.fill`), bottom row "+450 XP this week". Empty state: "Scan your first product to start earning XP."

Fetch via `fetchXPSummary()` on mount; AsyncStorage cache fallback for offline. Use existing `cardSurface` token + `Spacing.md` padding.

- [ ] **Step 2: Write `RecallBanner.tsx`**

Per spec §11. Renders nothing if `fetchRecentRecalls()` returns `[]`. Otherwise: compact pressable banner showing count + most-recent brand. Tap → navigate to `RecallDetail` for most-recent product.

- [ ] **Step 3: Write `SubredditFooter.tsx`**

Pressable text row at bottom of CommunityScreen. Tap → `Linking.openURL('https://reddit.com/r/kibascan')`.

- [ ] **Step 4: Rewrite `CommunityScreen.tsx`** to compose:

```
<ScrollView>
  <XPRibbon />
  <FeaturedRecipeHero />        // placeholder for Task 25
  <RecallBanner />
  <DiscoveryGrid />             // placeholder for Task 30
  <BlogCarousel />              // placeholder for Task 26
  <SubredditFooter />
</ScrollView>
```

Empty placeholders are simple `<View />` for now — populated in later tasks.

- [ ] **Step 5: Render tests**

```ts
// __tests__/screens/CommunityScreen.test.tsx
import { render, screen } from '@testing-library/react-native';
// mock fetchXPSummary, fetchRecentRecalls
// assert: XP ribbon visible; recall banner hidden when 0 recalls; subreddit footer present
```

- [ ] **Step 6: Run, pass, commit**

```bash
git add src/screens/CommunityScreen.tsx src/components/community/ \
  __tests__/screens/CommunityScreen.test.tsx
git commit -m "M9 community: CommunityScreen shell (XP ribbon, recall banner, subreddit footer)"
```

---

## Phase 7 — Reference Content Screens (W1 D5)

### Task 21: `ToxicDatabaseScreen` + tests

**Files:**
- Create: `src/screens/ToxicDatabaseScreen.tsx`
- Create: `src/components/community/ToxicEntryRow.tsx`
- Create: `src/components/community/ToxicEntrySheet.tsx`
- Test: `__tests__/screens/ToxicDatabaseScreen.test.tsx`

Per spec §8. Header: species toggle (Dog/Cat default Dog), search bar, category filter chips. Body: sectioned list grouped by severity color via `SEVERITY_COLORS`.

- [ ] **Step 1: Render test (failing)** — assert species toggle filters list; search filters by `name` and `alt_names`; tap entry opens sheet with symptoms.
- [ ] **Step 2: Implement screen + sub-components.** Reads `src/data/toxic_foods.json` directly (no service needed — bundled data).
- [ ] **Step 3: Pass tests, commit.**
  Message: `M9 community: ToxicDatabaseScreen (species toggle + search + sheet) + tests`

---

### Task 22: `VendorDirectoryScreen` + tests

**Files:**
- Create: `src/screens/VendorDirectoryScreen.tsx`
- Create: `src/components/community/VendorRow.tsx`
- Test: `__tests__/screens/VendorDirectoryScreen.test.tsx`

Per spec §7.2. Search bar (accepts `route.params.initialBrand` as initial query), A-Z `SectionList` of vendors. Each row: brand name + email/website action buttons. Tap row → expand inline (toggle a `selectedId` state).

- [ ] **Step 1: Render test (failing).**
- [ ] **Step 2: Implement.**
- [ ] **Step 3: Pass + commit.** Message: `M9 community: VendorDirectoryScreen (search + A-Z + actions) + tests`

---

### Task 23: ResultScreen overflow — "Contact brand" deep-link

**Files:**
- Modify: `src/screens/ResultScreen.tsx` (locate the existing overflow menu — currently has Share + Report issue per session-60 work)
- Test: `__tests__/screens/ResultScreen.test.tsx` (extend existing)

- [ ] **Step 1: Failing test** — assert "Contact {brand}" menu item is visible when `brandSlugify(product.brand)` is in the bundled slug list, hidden otherwise.

```ts
jest.mock('@/data/published_vendor_slugs.json', () => ['pure-balance']);
// render ResultScreen with product.brand = 'Pure Balance' → assert "Contact Pure Balance" visible
// re-render with product.brand = 'Generic Co' → assert hidden
```

- [ ] **Step 2: Implement** — synchronous check via bundled JSON (no network). Tap → `navigation.navigate('VendorDirectory', { initialBrand: product.brand })`.
- [ ] **Step 3: Pass + commit.** Message: `M9 community: ResultScreen overflow "Contact brand" deep-link (offline-safe)`

---

## Phase 8 — Kiba Kitchen (W2 D1–D2)

### Task 24: `KibaKitchenSubmitScreen` (client-UUID upload flow)

**Files:**
- Create: `src/screens/KibaKitchenSubmitScreen.tsx`
- Create: `src/components/community/RecipeIngredientRow.tsx`
- Create: `src/components/community/RecipePrepStepRow.tsx`
- Test: `__tests__/screens/KibaKitchenSubmitScreen.test.tsx`

Per spec §6.1. Form fields: title, subtitle, species toggle, life stage toggle, dynamic ingredients, prep steps, cover photo upload, AAFCO checkbox. Submit button disabled until valid + checkbox checked.

**Critical sequencing (spec §6.1):**
1. `import * as Crypto from 'expo-crypto'; const recipeId = Crypto.randomUUID();`
2. Upload image to Storage at `${userId}/${recipeId}.jpg`.
3. INSERT row in `community_recipes` with explicit `id = recipeId`.
4. POST to `/functions/v1/validate-recipe` with `{ recipe_id: recipeId }`.
5. Show resulting status to user (auto_rejected with reason, or pending_review with success message).

- [ ] **Step 1: Render test** — assert form validation; submit disabled without checkbox; submit calls `recipeService.submitRecipe`; auto_rejected path shows reason inline.
- [ ] **Step 2: Implement** — heavy use of `recipeService.submitRecipe` from Task 15.
- [ ] **Step 3: Pass + commit.** Message: `M9 community: KibaKitchenSubmitScreen (client-UUID upload + validators)`

---

### Task 25: `KibaKitchenFeedScreen` + `KibaKitchenRecipeDetailScreen` + featured-recipe hero

**Files:**
- Create: `src/screens/KibaKitchenFeedScreen.tsx`
- Create: `src/screens/KibaKitchenRecipeDetailScreen.tsx`
- Create: `src/components/community/RecipeFeedCard.tsx`
- Create: `src/components/community/RecipeDisclaimerBanner.tsx`
- Create: `src/components/community/FeaturedRecipeHero.tsx` (used inside CommunityScreen)
- Test: `__tests__/screens/KibaKitchenFeedScreen.test.tsx`
- Test: `__tests__/screens/KibaKitchenRecipeDetailScreen.test.tsx`

Per spec §6.4.

- `FeaturedRecipeHero`: most-recent approved recipe; tap → `KibaKitchenFeed`. Empty state: "Submit the first recipe" CTA → `KibaKitchenSubmit`.
- `KibaKitchenFeedScreen`: `FlatList` of `RecipeFeedCard`. Top: persistent `RecipeDisclaimerBanner`.
- `KibaKitchenRecipeDetailScreen`: cover image, title, badges, ingredients table, prep steps, **disclaimer top + bottom**, "Report issue" → opens `SafetyFlagSheet` with `reason='recipe_concern'` (Task 27 builds the sheet).

- [ ] **Step 1: Render tests.**
- [ ] **Step 2: Implement.**
- [ ] **Step 3: Pass + commit.** Message: `M9 community: Kiba Kitchen feed + detail + featured hero + disclaimer banners`

---

## Phase 9 — Blog (W2 D3)

### Task 26: BlogCarousel + BlogList + BlogDetail + markdown

**Files:**
- Create: `src/components/community/BlogCarousel.tsx`
- Create: `src/screens/BlogListScreen.tsx`
- Create: `src/screens/BlogDetailScreen.tsx`
- Test: `__tests__/components/BlogCarousel.test.tsx`
- Test: `__tests__/screens/BlogDetailScreen.test.tsx`
- Modify: `package.json` — add `react-native-markdown-display`.

- [ ] **Step 1: Install dep**

```bash
npm install react-native-marked
```

**DO NOT use `react-native-markdown-display`** — it relies on `ViewPropTypes`, which React Native removed from core in 0.71. On Expo SDK 55 / RN 0.83 the build hard-crashes on launch.

`react-native-marked` is actively maintained and uses native components for rendering. If its API surface is insufficient (e.g., custom image lazy-loading), wrap `marked` directly and render with native RN components. Document any deviation in the commit message.

- [ ] **Step 2: BlogCarousel** — horizontal `FlatList`, 3 most-recent posts. Hidden when `fetchPublishedPosts()` returns `[]`. "See all →" link → `BlogList`.
- [ ] **Step 3: BlogListScreen** — vertical `FlatList`, all published posts.
- [ ] **Step 4: BlogDetailScreen** — cover image (full-width), title, subtitle, body via markdown renderer. Header share button (`Share.share({ url: 'kibascan.com/blog/...' })` — placeholder URL is fine; web preview is stretch).
- [ ] **Step 5: Render tests.**
- [ ] **Step 6: Pass + commit.** Message: `M9 community: blog carousel + list + detail + markdown rendering`

---

## Phase 10 — Safety Flags (W2 D4)

### Task 27: `SafetyFlagSheet` (shared bottom sheet)

**Files:**
- Create: `src/components/community/SafetyFlagSheet.tsx`
- Test: `__tests__/components/SafetyFlagSheet.test.tsx`

Per spec §10.1. Bottom sheet with 5-option reason picker (radio list), optional detail TextInput (≤500 chars), Submit button (disabled without reason). Calls `scoreFlagService.submitFlag` on submit. Reusable from ResultScreen and KibaKitchenRecipeDetail.

Props: `visible`, `onClose`, `petId`, `productId`, `scanId`, `defaultReason?: 'recipe_concern' | undefined`.

- [ ] **Step 1: Render test** — submit disabled without reason; submit calls service with correct payload; offline state shows banner.
- [ ] **Step 2: Implement.**
- [ ] **Step 3: Pass + commit.** Message: `M9 community: SafetyFlagSheet shared bottom sheet + tests`

---

### Task 28: `SafetyFlagsScreen` (My Flags + Community Activity tabs)

**Files:**
- Create: `src/screens/SafetyFlagsScreen.tsx`
- Create: `src/components/community/SafetyFlagRow.tsx`
- Create: `src/components/community/CommunityActivitySummary.tsx`
- Test: `__tests__/screens/SafetyFlagsScreen.test.tsx`

Per spec §10.2. Segmented control: My Flags / Community Activity. My Flags = list of `fetchMyFlags()` results with status chips. Community Activity = bar chart from `fetchCommunityActivityCounts()`.

- [ ] **Step 1-3:** Tests, implement, commit. Message: `M9 community: SafetyFlagsScreen (tabs + activity summary) + tests`

---

### Task 29: ResultScreen overflow — "Flag this score"

**Files:**
- Modify: `src/screens/ResultScreen.tsx`
- Test: `__tests__/screens/ResultScreen.test.tsx` (extend)

Add menu item "Flag this score" → opens `SafetyFlagSheet` with `productId`, `petId`, `scanId` from current scan context.

- [ ] **Steps 1-3:** Failing test, implement, pass + commit. Message: `M9 community: ResultScreen overflow "Flag this score" entry`

---

## Phase 11 — Final Assembly (W2 D5)

### Task 30: `DiscoveryGrid` + `KibaIndexHighlights` tile

**Files:**
- Create: `src/components/community/DiscoveryGrid.tsx`
- Create: `src/components/community/tiles/ToxicDatabaseTile.tsx`
- Create: `src/components/community/tiles/VendorDirectoryTile.tsx`
- Create: `src/components/community/tiles/KibaIndexHighlightsTile.tsx`
- Create: `src/components/community/tiles/SafetyFlagsTile.tsx`
- Test: `__tests__/components/DiscoveryGrid.test.tsx`

Per spec §3 layout. 2x2 grid of pressable tiles, each navigating to its respective screen. KibaIndexHighlightsTile is a special tile that renders a mini preview ("Top for picky eaters: {brand}") via `fetchKibaIndexHighlights('dog')` (active pet's species — read from `useActivePetStore`).

- [ ] **Steps 1-3:** Render tests (each tile present + navigates correctly), implement, commit. Message: `M9 community: DiscoveryGrid + 4 tiles (toxic, vendors, kiba index, safety flags)`

---

### Task 31: Wire CommunityScreen final assembly

**Files:**
- Modify: `src/screens/CommunityScreen.tsx` — replace placeholders with `FeaturedRecipeHero`, `DiscoveryGrid`, `BlogCarousel`.
- Test: `__tests__/screens/CommunityScreen.test.tsx` (extend)

- [ ] **Steps 1-3:** Update render tests to assert all sections present in populated state, hidden elements hidden in empty state, empty-Blog hides carousel cleanly. Implement, commit. Message: `M9 community: CommunityScreen final assembly + populated/empty render tests`

---

### Task 32: QA pass + pre-flight

**Files:**
- Modify: `docs/status/CURRENT.md` — session handoff entry.
- Modify: `CLAUDE.md` — add new schema traps for `community_recipes`, `user_xp_*`, `score_flags`, `vendors`, `blog_posts`. Add to Spec Files table.
- Modify: `DECISIONS.md` — log any new decisions taken during implementation (none expected; all decisions in spec).

**Pre-flight checklist:**

- [ ] **Step 1: Run full test suite**

```bash
npm test
```

Expected: previous total + ~25–30 new tests, 0 failures, snapshot diffs reviewed.

- [ ] **Step 2: TypeScript clean**

```bash
npx tsc --noEmit
```

Expected: no new errors in `src/**` or `__tests__/**` (pre-existing `supabase/functions/batch-score/` Deno noise OK).

- [ ] **Step 3: Madge — no circular imports**

```bash
npx madge --circular src/
```

Expected: zero cycles.

- [ ] **Step 4: Manual on-device QA**

Run the app on a device and walk:
1. Community tab — XP ribbon shows for new user (empty state). Scan one product, return to Community — XP ribbon updates to "Lv. 1 · 10 XP · 1-day streak".
2. Tap Toxic Database — search for "chocolate", verify entry appears, tap → sheet opens with symptoms.
3. Tap Vendor Directory — empty until `vendors.json` is populated; once seeded, A-Z list renders.
4. Tap Kiba Kitchen featured hero (or empty CTA) → tap "Submit a recipe", fill form, attach image. Submit. Verify auto-validator response (try a chocolate recipe → expect rejection).
5. Tap a recipe → detail. Verify disclaimer top + bottom. Test "Report issue" → SafetyFlagSheet opens.
6. ResultScreen overflow on a Pure Balance (or seeded brand): "Contact Pure Balance" appears. Tap → VendorDirectory.
7. ResultScreen overflow "Flag this score" → SafetyFlagSheet opens, submit a flag, verify it appears in `SafetyFlags` → My Flags.
8. Blog carousel — populate one post via Studio, verify it appears, tap → detail with markdown rendered.
9. Subreddit footer link → opens browser to r/kibascan.

- [ ] **Step 5: Update CURRENT.md** with session entry covering all tasks done, numbers (test count, decision count, migration count = 49 now).

- [ ] **Step 6: Commit**

```bash
git add docs/status/CURRENT.md CLAUDE.md DECISIONS.md
git commit -m "M9 community: handoff + CLAUDE.md schema traps + numbers update"
```

- [ ] **Step 7: Open PR**

```bash
git push -u origin m9-community
gh pr create --title "M9: Community screen — XP, Kitchen, Vendors, Toxics, Blog, Flags" \
  --body "$(cat <<'EOF'
## Summary
- Last big pre-launch scope: full Community tab rebuild
- Server-side XP engine (camera-scan-gated, anti-abuse, idempotent approvals)
- Kiba Kitchen with auto-validators (toxic ingredients + UPVM regex)
- Vendor Directory with offline-safe deep-link from ResultScreen
- Toxic Database (bundled JSON, single source of truth shared with validators)
- Blog via Supabase Studio CMS
- D-072 Community Safety Flags
- Recall Live Feed banner

Spec: `docs/superpowers/specs/2026-04-23-community-screen-design.md`
Plan: `docs/superpowers/plans/2026-04-23-community-screen.md`

## Test plan
- [ ] Full test suite green (`npm test`)
- [ ] Type check clean (`npx tsc --noEmit`)
- [ ] Zero circular imports (`npx madge --circular src/`)
- [ ] On-device walk: XP ribbon updates after scan; Toxic DB search; Vendor deep-link; Recipe submit + auto-validator; Recipe disclaimer top+bottom; Safety Flag submit + appears in My Flags; Blog detail markdown renders.

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

---

## Self-Review

Spec coverage check (against `docs/superpowers/specs/2026-04-23-community-screen-design.md`):

- §2 Architecture & Navigation → Task 19 ✓
- §3 Layout → Task 20 (shell) + Task 31 (final assembly) ✓
- §4 Data Model → Tasks 1, 2 (tables + buckets) + Task 8 (triggers) + Task 9 (RPC) + Task 18 (extra aggregate RPC) ✓
- §5 XP Engine → Tasks 3, 4, 5 (helpers) + Task 8 (triggers) + Task 9 (summary RPC) + Task 13 (service) ✓
- §6 Kiba Kitchen → Task 7 (client validator) + Task 11 (Edge Function) + Task 15 (service) + Tasks 24, 25 (screens) ✓
- §7 Vendor Directory → Task 12 (seeder) + Task 16 (service) + Task 22 (screen) + Task 23 (deep-link) ✓
- §8 Toxic Database → Task 10 (data) + Task 21 (screen) ✓
- §9 Blog → Task 17 (service) + Task 26 (screens) ✓
- §10 Safety Flags → Task 18 (service) + Tasks 27, 28, 29 ✓
- §11 Recall Live Feed → Task 14 (service) + Task 20 (RecallBanner component) ✓
- §12 Error/Empty/Loading/Offline → covered per-screen in Tasks 20–29 ✓
- §13 Testing Strategy → every task has TDD steps ✓
- §14 Constraints & Rules → enforced inline (D-070 subtle ribbon in Task 20; D-084 SF Symbols throughout; D-095 in Tasks 7+11) ✓
- §15 Copy → embedded in Task 20 (XP), Task 25 (recipe disclaimer), Task 11 (auto-reject reasons) ✓
- §17 Open Questions → no implementation impact (documented risks); orphan-image cleanup explicitly deferred ✓
- §18 Files Touched → covered cumulatively across all tasks ✓

**Type consistency check:** `XPSummary`, `RecipeSubmission`, `ValidationResult`, `LevelInfo`, `StreakState` defined once in their respective modules; reused consistently.

**Placeholder scan:** found one earlier ("TBD" in Task 19 placeholder screens) — that's expected scaffolding, not a plan placeholder. No "implement later", no "fill in details", no "similar to Task N without showing code".

**Total tasks:** 32, covering ~10 working days at 1-2 tasks/day with two days of buffer.

---

## Execution Handoff

Plan complete and saved to `docs/superpowers/plans/2026-04-23-community-screen.md`. Two execution options:

**1. Subagent-Driven (recommended)** — I dispatch a fresh subagent per task, review between tasks, fast iteration. Best for a 32-task plan because each subagent gets a clean context window.

**2. Inline Execution** — Execute tasks in this session using executing-plans, batch with checkpoints for review.

Which approach?
