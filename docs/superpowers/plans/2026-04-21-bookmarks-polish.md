# Bookmarks Polish Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix the Dynamic Island collision on `BookmarksScreen` and replace the flat row list with a pet-anchored header + category-grouped SectionList with hairline dividers, per `docs/superpowers/specs/2026-04-21-bookmarks-polish-design.md`.

**Architecture:** Pure helper `groupBookmarksByCategory` does bucket derivation + sort; screen swaps `FlatList` for `SectionList` and owns header + row rendering. Zero changes to `useBookmarkStore`, `bookmarkService` behavior (one-field data tweak only), or migration 040. `ScanHistoryScreen` gets the safe-area port only.

**Tech Stack:** React Native 0.83, TypeScript 5.9 (strict), Expo SDK 55, `react-native-safe-area-context` (already installed), `@testing-library/react-native` (already installed). No new dependencies.

---

## File Structure

| File | Action | Responsibility |
|---|---|---|
| `src/types/bookmark.ts` | Modify | Add `category: 'daily_food' \| 'treat'` to `BookmarkCardData.product` |
| `src/services/bookmarkService.ts` | Modify (line 127-129) | Add `category` to PostgREST select |
| `src/utils/bookmarkGrouping.ts` | Create | Pure: `BookmarkSection`, `BookmarkSectionKey`, `groupBookmarksByCategory`, section-meta lookup |
| `src/screens/BookmarksScreen.tsx` | Major rewrite | Safe-area header, pet-anchored layout, `SectionList`, row polish (divider, tags, recalled chip) |
| `src/screens/ScanHistoryScreen.tsx` | Minor edit | Safe-area header padding only — no other changes |
| `__tests__/utils/bookmarkGrouping.test.ts` | Create | Helper unit tests (bucket matrix, sort tiers, section meta) |
| `__tests__/screens/BookmarksScreen.test.tsx` | Create | Render: section headers, recalled chip + pin, vet-diet tag, a11y labels, near-cap amber |

**Ordering rationale:** Pure helpers first (TDD, commit per concern) → service/type tweak → screen safe-area (tiny visual-only commits) → screen rewrite (header → SectionList wiring → row polish) → render tests → regression. Sibling `ScanHistoryScreen` safe-area port is isolated and commits on its own.

---

## Task 1: `bookmarkGrouping.ts` — types + empty case

**Files:**
- Create: `src/utils/bookmarkGrouping.ts`
- Test: `__tests__/utils/bookmarkGrouping.test.ts`

- [ ] **Step 1: Write the failing test**

Create `__tests__/utils/bookmarkGrouping.test.ts`:

```ts
import { groupBookmarksByCategory } from '../../src/utils/bookmarkGrouping';

describe('groupBookmarksByCategory', () => {
  it('returns empty array for empty input', () => {
    expect(groupBookmarksByCategory([])).toEqual([]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest __tests__/utils/bookmarkGrouping.test.ts --no-coverage`

Expected: FAIL with `Cannot find module '../../src/utils/bookmarkGrouping'`.

- [ ] **Step 3: Write minimal implementation**

Create `src/utils/bookmarkGrouping.ts`:

```ts
// Pure helpers — group bookmark cards by product category with tiered sort.
// See docs/superpowers/specs/2026-04-21-bookmarks-polish-design.md §2.

import { Colors } from './constants';
import type { BookmarkCardData } from '../types/bookmark';

export type BookmarkSectionKey = 'daily_food' | 'toppers_mixers' | 'treats';

export interface BookmarkSection {
  key: BookmarkSectionKey;
  label: string;
  dotColor: string;
  data: BookmarkCardData[];
}

export function groupBookmarksByCategory(
  cards: BookmarkCardData[],
): BookmarkSection[] {
  if (cards.length === 0) return [];
  return [];
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest __tests__/utils/bookmarkGrouping.test.ts --no-coverage`

Expected: PASS (1 test).

- [ ] **Step 5: Commit**

```bash
git add src/utils/bookmarkGrouping.ts __tests__/utils/bookmarkGrouping.test.ts
git commit -m "M9: bookmarkGrouping — types + empty case"
```

---

## Task 2: `bookmarkGrouping.ts` — bucket derivation matrix

**Files:**
- Modify: `src/utils/bookmarkGrouping.ts`
- Test: `__tests__/utils/bookmarkGrouping.test.ts`

- [ ] **Step 1: Write the failing tests**

Append to `__tests__/utils/bookmarkGrouping.test.ts`:

```ts
function makeCard(overrides: {
  id?: string;
  category: 'daily_food' | 'treat';
  is_supplemental?: boolean;
  is_recalled?: boolean;
  is_vet_diet?: boolean;
  is_variety_pack?: boolean;
  final_score?: number | null;
  created_at?: string;
}): BookmarkCardData {
  const id = overrides.id ?? 'bm-' + Math.random().toString(36).slice(2, 8);
  return {
    bookmark: {
      id,
      user_id: 'u1',
      pet_id: 'p1',
      product_id: 'prod-' + id,
      created_at: overrides.created_at ?? '2026-04-21T00:00:00Z',
    },
    product: {
      id: 'prod-' + id,
      brand: 'Brand',
      name: 'Product',
      image_url: null,
      is_recalled: overrides.is_recalled ?? false,
      is_vet_diet: overrides.is_vet_diet ?? false,
      is_variety_pack: overrides.is_variety_pack ?? false,
      is_supplemental: overrides.is_supplemental ?? false,
      target_species: 'dog',
      category: overrides.category,
    },
    final_score: overrides.final_score ?? 80,
  };
}

describe('groupBookmarksByCategory — bucket derivation', () => {
  it('daily_food + !is_supplemental → Daily Food bucket', () => {
    const cards = [makeCard({ category: 'daily_food', is_supplemental: false })];
    const sections = groupBookmarksByCategory(cards);
    expect(sections).toHaveLength(1);
    expect(sections[0].key).toBe('daily_food');
    expect(sections[0].data).toHaveLength(1);
  });

  it('daily_food + is_supplemental → Toppers & Mixers bucket', () => {
    const cards = [makeCard({ category: 'daily_food', is_supplemental: true })];
    const sections = groupBookmarksByCategory(cards);
    expect(sections).toHaveLength(1);
    expect(sections[0].key).toBe('toppers_mixers');
  });

  it('treat → Treats bucket (is_supplemental ignored)', () => {
    const cards = [makeCard({ category: 'treat', is_supplemental: false })];
    const sections = groupBookmarksByCategory(cards);
    expect(sections).toHaveLength(1);
    expect(sections[0].key).toBe('treats');
  });

  it('treat + is_supplemental (edge case) → Treats bucket', () => {
    const cards = [makeCard({ category: 'treat', is_supplemental: true })];
    const sections = groupBookmarksByCategory(cards);
    expect(sections).toHaveLength(1);
    expect(sections[0].key).toBe('treats');
  });

  it('multiple cards in mixed buckets → all 3 sections returned in order', () => {
    const cards = [
      makeCard({ id: 'a', category: 'daily_food' }),
      makeCard({ id: 'b', category: 'daily_food', is_supplemental: true }),
      makeCard({ id: 'c', category: 'treat' }),
    ];
    const sections = groupBookmarksByCategory(cards);
    expect(sections.map((s) => s.key)).toEqual(['daily_food', 'toppers_mixers', 'treats']);
  });
});
```

Also update the top import:

```ts
import { groupBookmarksByCategory } from '../../src/utils/bookmarkGrouping';
import type { BookmarkCardData } from '../../src/types/bookmark';
```

Note: `makeCard` uses `overrides.category` — this requires `BookmarkCardData.product.category` to exist. Task 8 adds it to the type. For Tasks 2-7, we'll temporarily widen the makeCard's return to `any` or `as BookmarkCardData` to let tests compile. **Use `as unknown as BookmarkCardData`** to bypass the missing-field error until Task 8 ships.

Replace the final `return` of `makeCard`:

```ts
  return {
    bookmark: { ... },
    product: { ..., category: overrides.category },
    final_score: overrides.final_score ?? 80,
  } as unknown as BookmarkCardData;
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx jest __tests__/utils/bookmarkGrouping.test.ts --no-coverage`

Expected: 5 new tests FAIL (no bucket logic yet).

- [ ] **Step 3: Write minimal implementation**

Replace `groupBookmarksByCategory` body in `src/utils/bookmarkGrouping.ts`:

```ts
const SECTION_ORDER: BookmarkSectionKey[] = ['daily_food', 'toppers_mixers', 'treats'];

const SECTION_META: Record<BookmarkSectionKey, { label: string; dotColor: string }> = {
  daily_food: { label: 'Daily Food', dotColor: Colors.severityGreen },
  toppers_mixers: { label: 'Toppers & Mixers', dotColor: Colors.accent },
  treats: { label: 'Treats', dotColor: Colors.severityAmber },
};

function bucketOf(card: BookmarkCardData): BookmarkSectionKey {
  if (card.product.category === 'treat') return 'treats';
  if (card.product.is_supplemental) return 'toppers_mixers';
  return 'daily_food';
}

export function groupBookmarksByCategory(
  cards: BookmarkCardData[],
): BookmarkSection[] {
  if (cards.length === 0) return [];

  const buckets: Record<BookmarkSectionKey, BookmarkCardData[]> = {
    daily_food: [],
    toppers_mixers: [],
    treats: [],
  };

  for (const card of cards) {
    buckets[bucketOf(card)].push(card);
  }

  return SECTION_ORDER
    .filter((key) => buckets[key].length > 0)
    .map((key) => ({
      key,
      label: SECTION_META[key].label,
      dotColor: SECTION_META[key].dotColor,
      data: buckets[key],
    }));
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx jest __tests__/utils/bookmarkGrouping.test.ts --no-coverage`

Expected: all 6 tests PASS (1 from Task 1 + 5 new).

- [ ] **Step 5: Commit**

```bash
git add src/utils/bookmarkGrouping.ts __tests__/utils/bookmarkGrouping.test.ts
git commit -m "M9: bookmarkGrouping — bucket derivation matrix"
```

---

## Task 3: `bookmarkGrouping.ts` — empty-bucket filter

**Files:**
- Test: `__tests__/utils/bookmarkGrouping.test.ts`

Note: Task 2's implementation already filters empty buckets. This task adds an explicit regression test so future refactors don't drop it.

- [ ] **Step 1: Write the failing test** (regression; may already pass)

Append to `__tests__/utils/bookmarkGrouping.test.ts`:

```ts
describe('groupBookmarksByCategory — empty bucket filter', () => {
  it('omits sections with zero cards', () => {
    const cards = [makeCard({ category: 'treat' })];
    const sections = groupBookmarksByCategory(cards);
    expect(sections).toHaveLength(1);
    expect(sections[0].key).toBe('treats');
  });

  it('returns only populated buckets when 2 of 3 have cards', () => {
    const cards = [
      makeCard({ id: 'a', category: 'daily_food' }),
      makeCard({ id: 'b', category: 'treat' }),
    ];
    const sections = groupBookmarksByCategory(cards);
    expect(sections.map((s) => s.key)).toEqual(['daily_food', 'treats']);
  });
});
```

- [ ] **Step 2: Run tests to verify state**

Run: `npx jest __tests__/utils/bookmarkGrouping.test.ts --no-coverage`

Expected: PASS (Task 2's impl already handles this, but we now have explicit coverage).

- [ ] **Step 3: Commit**

```bash
git add __tests__/utils/bookmarkGrouping.test.ts
git commit -m "M9: bookmarkGrouping — empty-bucket regression tests"
```

---

## Task 4: `bookmarkGrouping.ts` — sort: scored DESC + created_at tie-break

**Files:**
- Modify: `src/utils/bookmarkGrouping.ts`
- Test: `__tests__/utils/bookmarkGrouping.test.ts`

- [ ] **Step 1: Write the failing tests**

Append to `__tests__/utils/bookmarkGrouping.test.ts`:

```ts
describe('groupBookmarksByCategory — sort scored DESC', () => {
  it('orders scored cards in a bucket by final_score DESC', () => {
    const cards = [
      makeCard({ id: 'a', category: 'daily_food', final_score: 70 }),
      makeCard({ id: 'b', category: 'daily_food', final_score: 90 }),
      makeCard({ id: 'c', category: 'daily_food', final_score: 80 }),
    ];
    const sections = groupBookmarksByCategory(cards);
    expect(sections[0].data.map((c) => c.final_score)).toEqual([90, 80, 70]);
  });

  it('breaks ties by bookmark.created_at DESC', () => {
    const cards = [
      makeCard({ id: 'old', category: 'daily_food', final_score: 85, created_at: '2026-04-01T00:00:00Z' }),
      makeCard({ id: 'new', category: 'daily_food', final_score: 85, created_at: '2026-04-21T00:00:00Z' }),
    ];
    const sections = groupBookmarksByCategory(cards);
    expect(sections[0].data.map((c) => c.bookmark.id)).toEqual(['new', 'old']);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx jest __tests__/utils/bookmarkGrouping.test.ts --no-coverage`

Expected: 2 new tests FAIL — current impl preserves insertion order.

- [ ] **Step 3: Update implementation**

Add this helper above `groupBookmarksByCategory` in `src/utils/bookmarkGrouping.ts`:

```ts
function createdAtDesc(a: BookmarkCardData, b: BookmarkCardData): number {
  return b.bookmark.created_at.localeCompare(a.bookmark.created_at);
}

function sortWithinSection(cards: BookmarkCardData[]): BookmarkCardData[] {
  // Scored tier only for now — recalled + bypass tiers land in Tasks 5 and 6.
  const scored = cards.filter((c) => c.final_score != null);
  const unscored = cards.filter((c) => c.final_score == null);

  scored.sort((a, b) => {
    const scoreDiff = (b.final_score ?? 0) - (a.final_score ?? 0);
    if (scoreDiff !== 0) return scoreDiff;
    return createdAtDesc(a, b);
  });
  unscored.sort(createdAtDesc);

  return [...scored, ...unscored];
}
```

Then modify `groupBookmarksByCategory` to call it when mapping sections:

```ts
  return SECTION_ORDER
    .filter((key) => buckets[key].length > 0)
    .map((key) => ({
      key,
      label: SECTION_META[key].label,
      dotColor: SECTION_META[key].dotColor,
      data: sortWithinSection(buckets[key]),
    }));
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx jest __tests__/utils/bookmarkGrouping.test.ts --no-coverage`

Expected: all tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/utils/bookmarkGrouping.ts __tests__/utils/bookmarkGrouping.test.ts
git commit -m "M9: bookmarkGrouping — sort scored DESC with created_at tie-break"
```

---

## Task 5: `bookmarkGrouping.ts` — sort: recalled pinned to top

**Files:**
- Modify: `src/utils/bookmarkGrouping.ts`
- Test: `__tests__/utils/bookmarkGrouping.test.ts`

- [ ] **Step 1: Write the failing tests**

Append to `__tests__/utils/bookmarkGrouping.test.ts`:

```ts
describe('groupBookmarksByCategory — recalled pinned', () => {
  it('pins a recalled card above a higher-scored scored card in the same bucket', () => {
    const cards = [
      makeCard({ id: 'top-scored', category: 'daily_food', final_score: 99, is_recalled: false }),
      makeCard({ id: 'recalled', category: 'daily_food', final_score: null, is_recalled: true }),
    ];
    const sections = groupBookmarksByCategory(cards);
    expect(sections[0].data.map((c) => c.bookmark.id)).toEqual(['recalled', 'top-scored']);
  });

  it('orders multiple recalled cards by created_at DESC within the pinned tier', () => {
    const cards = [
      makeCard({ id: 'old-recall', category: 'treat', is_recalled: true, created_at: '2026-04-01T00:00:00Z' }),
      makeCard({ id: 'new-recall', category: 'treat', is_recalled: true, created_at: '2026-04-21T00:00:00Z' }),
      makeCard({ id: 'scored', category: 'treat', final_score: 80 }),
    ];
    const sections = groupBookmarksByCategory(cards);
    expect(sections[0].data.map((c) => c.bookmark.id)).toEqual([
      'new-recall',
      'old-recall',
      'scored',
    ]);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx jest __tests__/utils/bookmarkGrouping.test.ts --no-coverage`

Expected: 2 new tests FAIL — recalled currently lands in the unscored tier (bottom).

- [ ] **Step 3: Update `sortWithinSection`**

Replace `sortWithinSection` in `src/utils/bookmarkGrouping.ts` with:

```ts
function sortWithinSection(cards: BookmarkCardData[]): BookmarkCardData[] {
  const recalled = cards.filter((c) => c.product.is_recalled);
  const scored = cards.filter(
    (c) => !c.product.is_recalled && c.final_score != null,
  );
  const unscored = cards.filter(
    (c) => !c.product.is_recalled && c.final_score == null,
  );

  recalled.sort(createdAtDesc);
  scored.sort((a, b) => {
    const scoreDiff = (b.final_score ?? 0) - (a.final_score ?? 0);
    if (scoreDiff !== 0) return scoreDiff;
    return createdAtDesc(a, b);
  });
  unscored.sort(createdAtDesc);

  return [...recalled, ...scored, ...unscored];
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx jest __tests__/utils/bookmarkGrouping.test.ts --no-coverage`

Expected: all tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/utils/bookmarkGrouping.ts __tests__/utils/bookmarkGrouping.test.ts
git commit -m "M9: bookmarkGrouping — pin recalled to top of section"
```

---

## Task 6: `bookmarkGrouping.ts` — sort: bypass/unscored to bottom

**Files:**
- Test: `__tests__/utils/bookmarkGrouping.test.ts`

Note: Task 5's implementation already routes vet-diet / variety-pack / cache-miss to the `unscored` tier (because `final_score` will be `null` for them in `fetchBookmarkCards`). This task adds explicit regression tests for each bypass variant.

- [ ] **Step 1: Write the failing tests**

Append to `__tests__/utils/bookmarkGrouping.test.ts`:

```ts
describe('groupBookmarksByCategory — bypass/unscored tier', () => {
  it('sinks vet_diet below scored in same bucket', () => {
    const cards = [
      makeCard({ id: 'vet', category: 'daily_food', is_vet_diet: true, final_score: null }),
      makeCard({ id: 'scored', category: 'daily_food', final_score: 70 }),
    ];
    const sections = groupBookmarksByCategory(cards);
    expect(sections[0].data.map((c) => c.bookmark.id)).toEqual(['scored', 'vet']);
  });

  it('sinks variety_pack below scored in same bucket', () => {
    const cards = [
      makeCard({ id: 'vp', category: 'daily_food', is_variety_pack: true, final_score: null }),
      makeCard({ id: 'scored', category: 'daily_food', final_score: 65 }),
    ];
    const sections = groupBookmarksByCategory(cards);
    expect(sections[0].data.map((c) => c.bookmark.id)).toEqual(['scored', 'vp']);
  });

  it('sinks cache-miss (null score, no bypass flag) below scored', () => {
    const cards = [
      makeCard({ id: 'miss', category: 'daily_food', final_score: null }),
      makeCard({ id: 'scored', category: 'daily_food', final_score: 60 }),
    ];
    const sections = groupBookmarksByCategory(cards);
    expect(sections[0].data.map((c) => c.bookmark.id)).toEqual(['scored', 'miss']);
  });

  it('orders multiple unscored cards by created_at DESC', () => {
    const cards = [
      makeCard({ id: 'a', category: 'daily_food', final_score: null, created_at: '2026-04-01T00:00:00Z' }),
      makeCard({ id: 'b', category: 'daily_food', final_score: null, created_at: '2026-04-21T00:00:00Z' }),
    ];
    const sections = groupBookmarksByCategory(cards);
    expect(sections[0].data.map((c) => c.bookmark.id)).toEqual(['b', 'a']);
  });
});
```

- [ ] **Step 2: Run tests to verify they pass**

Run: `npx jest __tests__/utils/bookmarkGrouping.test.ts --no-coverage`

Expected: all tests PASS (Task 5's impl handles these paths).

- [ ] **Step 3: Commit**

```bash
git add __tests__/utils/bookmarkGrouping.test.ts
git commit -m "M9: bookmarkGrouping — regression tests for bypass/unscored tier"
```

---

## Task 7: `bookmarkGrouping.ts` — section meta (labels + dot colors)

**Files:**
- Test: `__tests__/utils/bookmarkGrouping.test.ts`

Note: section meta is already populated by `SECTION_META` in Task 2. This task pins the exact label + color contract.

- [ ] **Step 1: Write the failing tests**

Append to `__tests__/utils/bookmarkGrouping.test.ts`:

```ts
import { Colors } from '../../src/utils/constants';

describe('groupBookmarksByCategory — section meta', () => {
  it('daily_food section has label "Daily Food" and green dot', () => {
    const sections = groupBookmarksByCategory([makeCard({ category: 'daily_food' })]);
    expect(sections[0].label).toBe('Daily Food');
    expect(sections[0].dotColor).toBe(Colors.severityGreen);
  });

  it('toppers_mixers section has label "Toppers & Mixers" and teal (accent) dot', () => {
    const sections = groupBookmarksByCategory([
      makeCard({ category: 'daily_food', is_supplemental: true }),
    ]);
    expect(sections[0].label).toBe('Toppers & Mixers');
    expect(sections[0].dotColor).toBe(Colors.accent);
  });

  it('treats section has label "Treats" and amber dot', () => {
    const sections = groupBookmarksByCategory([makeCard({ category: 'treat' })]);
    expect(sections[0].label).toBe('Treats');
    expect(sections[0].dotColor).toBe(Colors.severityAmber);
  });
});
```

- [ ] **Step 2: Run tests to verify they pass**

Run: `npx jest __tests__/utils/bookmarkGrouping.test.ts --no-coverage`

Expected: all tests PASS.

- [ ] **Step 3: Commit**

```bash
git add __tests__/utils/bookmarkGrouping.test.ts
git commit -m "M9: bookmarkGrouping — section meta contract tests"
```

---

## Task 8: `BookmarkCardData` + `fetchBookmarkCards` — add `category`

**Files:**
- Modify: `src/types/bookmark.ts` (line 18-28)
- Modify: `src/services/bookmarkService.ts` (line 127-129)

- [ ] **Step 1: Add `category` to the type**

In `src/types/bookmark.ts`, replace the `product` interface:

```ts
  product: {
    id: string;
    brand: string;
    name: string;
    category: 'daily_food' | 'treat';
    image_url: string | null;
    is_recalled: boolean;
    is_vet_diet: boolean;
    is_variety_pack: boolean;
    is_supplemental: boolean;
    target_species: 'dog' | 'cat';
  };
```

- [ ] **Step 2: Add `category` to the PostgREST select**

In `src/services/bookmarkService.ts`, replace lines 127-129:

```ts
      .select(
        '*, product:products(id, brand, name, category, image_url, is_recalled, is_vet_diet, is_variety_pack, is_supplemental, target_species)',
      )
```

- [ ] **Step 3: Remove the `as unknown as` cast in tests**

In `__tests__/utils/bookmarkGrouping.test.ts`, replace the `makeCard` `return` block to remove the cast (types now line up):

```ts
  return {
    bookmark: { id, user_id: 'u1', pet_id: 'p1', product_id: 'prod-' + id, created_at: overrides.created_at ?? '2026-04-21T00:00:00Z' },
    product: {
      id: 'prod-' + id,
      brand: 'Brand',
      name: 'Product',
      category: overrides.category,
      image_url: null,
      is_recalled: overrides.is_recalled ?? false,
      is_vet_diet: overrides.is_vet_diet ?? false,
      is_variety_pack: overrides.is_variety_pack ?? false,
      is_supplemental: overrides.is_supplemental ?? false,
      target_species: 'dog',
    },
    final_score: overrides.final_score ?? 80,
  };
```

- [ ] **Step 4: Type-check + run full test suite**

Run: `npx tsc --noEmit`

Expected: PASS (no type errors).

Run: `npx jest --no-coverage`

Expected: all tests PASS (1627+ with the new grouping tests).

- [ ] **Step 5: Commit**

```bash
git add src/types/bookmark.ts src/services/bookmarkService.ts __tests__/utils/bookmarkGrouping.test.ts
git commit -m "M9: bookmarks — add product.category to type + service select"
```

---

## Task 9: `ScanHistoryScreen` — safe-area header port

**Files:**
- Modify: `src/screens/ScanHistoryScreen.tsx`

- [ ] **Step 1: Add safe-area inset to the header**

At the top of `src/screens/ScanHistoryScreen.tsx`, add the import:

```ts
import { useSafeAreaInsets } from 'react-native-safe-area-context';
```

Inside the `ScanHistoryScreen` function body (right after `const activePet = ...`), add:

```ts
  const insets = useSafeAreaInsets();
```

Replace the `<View style={styles.header}>` opening tag with:

```tsx
      <View style={[styles.header, { paddingTop: insets.top + Spacing.sm }]}>
```

- [ ] **Step 2: Verify it compiles**

Run: `npx tsc --noEmit`

Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add src/screens/ScanHistoryScreen.tsx
git commit -m "M9: ScanHistoryScreen — safe-area header padding (Dynamic Island fix)"
```

---

## Task 10: `BookmarksScreen` — safe-area + pet-anchored header

**Files:**
- Modify: `src/screens/BookmarksScreen.tsx`

- [ ] **Step 1: Add imports**

At the top of `src/screens/BookmarksScreen.tsx`, add:

```ts
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { FontSizes } from '../utils/constants';
```

(`FontSizes` is not yet imported from `constants`; it's a named export alongside `Colors` and `Spacing`.)

- [ ] **Step 2: Use safe-area inset + compute pet initial**

Inside the `BookmarksScreen` function body, after `const activePet = ...`, add:

```ts
  const insets = useSafeAreaInsets();
  const petInitial = activePet
    ? String.fromCodePoint(activePet.name.codePointAt(0) ?? 0x2022).toLocaleUpperCase()
    : '?';
```

(`0x2022` = bullet "•" fallback for an empty-name edge case.)

- [ ] **Step 3: Replace the header JSX**

Replace the existing `<View style={styles.header}>...</View>` block with:

```tsx
      <View style={[styles.header, { paddingTop: insets.top + Spacing.sm }]}>
        <View style={styles.headerRow}>
          {activePet.photo_url ? (
            <Image source={{ uri: activePet.photo_url }} style={styles.petPhoto} />
          ) : (
            <View style={styles.petPhotoFallback}>
              <Text style={styles.petPhotoInitial}>{petInitial}</Text>
            </View>
          )}
          <Text style={styles.title} numberOfLines={1} ellipsizeMode="tail">
            {activePet.name}'s Shortlist
          </Text>
          <View style={styles.spacer} />
          <View style={[styles.progressChip, cards.length >= 19 && styles.progressChipAmber]}>
            <Text style={[styles.progressChipText, cards.length >= 19 && styles.progressChipTextAmber]}>
              {cards.length}/{MAX_BOOKMARKS_PER_PET} saved
            </Text>
          </View>
        </View>
        <Text style={styles.subtitle}>Live scores</Text>
      </View>
```

- [ ] **Step 4: Replace the header styles + add new ones**

In the `StyleSheet.create` block, replace the existing `header`, `title`, `subtitle` entries and add the new ones:

```ts
  header: {
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.hairlineBorder,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
  },
  petPhoto: {
    width: 36,
    height: 36,
    borderRadius: 18,
  },
  petPhotoFallback: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Colors.cardSurface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  petPhotoInitial: {
    color: Colors.textPrimary,
    fontSize: FontSizes.md,
    fontWeight: '700',
  },
  title: {
    color: Colors.textPrimary,
    fontSize: FontSizes.xxl,
    fontWeight: '800',
    flexShrink: 1,
  },
  spacer: { flex: 1 },
  subtitle: {
    color: Colors.textSecondary,
    fontSize: FontSizes.sm,
    marginTop: 2,
    paddingLeft: 36 + Spacing.md,
  },
  progressChip: {
    backgroundColor: Colors.chipSurface,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 4,
    borderRadius: 8,
  },
  progressChipAmber: {
    backgroundColor: Colors.severityAmberTint,
  },
  progressChipText: {
    color: Colors.textSecondary,
    fontSize: FontSizes.xs,
    fontWeight: '600',
  },
  progressChipTextAmber: {
    color: Colors.severityAmber,
  },
```

- [ ] **Step 5: Verify it compiles**

Run: `npx tsc --noEmit`

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/screens/BookmarksScreen.tsx
git commit -m "M9: BookmarksScreen — pet-anchored header + safe-area (Dynamic Island fix)"
```

---

## Task 11: `BookmarksScreen` — `FlatList` → `SectionList` wiring

**Files:**
- Modify: `src/screens/BookmarksScreen.tsx`

- [ ] **Step 1: Swap imports**

In `src/screens/BookmarksScreen.tsx`, replace `FlatList` in the `react-native` import line with `SectionList`:

```ts
import {
  View,
  Text,
  SectionList,
  RefreshControl,
  StyleSheet,
  Image,
  TouchableOpacity,
  Alert,
} from 'react-native';
```

Also add the grouping helper import:

```ts
import { groupBookmarksByCategory, type BookmarkSection } from '../utils/bookmarkGrouping';
```

And bring `useMemo` into the existing React import:

```ts
import React, { useEffect, useMemo, useState, useCallback } from 'react';
```

- [ ] **Step 2: Derive sections via useMemo**

Inside the component body, after the existing `refresh` callback, add:

```ts
  const sections = useMemo<BookmarkSection[]>(
    () => groupBookmarksByCategory(cards),
    [cards],
  );
```

- [ ] **Step 3: Replace the FlatList with SectionList**

Replace the entire `<FlatList ... />` JSX block (currently `cards.length === 0 ? empty : FlatList`) with:

```tsx
      {cards.length === 0 ? (
        <View style={styles.empty}>
          <Ionicons
            name="bookmark-outline"
            size={48}
            color={Colors.textTertiary}
            style={{ marginBottom: Spacing.md }}
          />
          <Text style={styles.emptyTitle}>No bookmarks yet</Text>
          <Text style={styles.emptySubtitle}>
            Tap the menu on any product page, or long-press a recent scan.
          </Text>
          <TouchableOpacity
            style={styles.ctaButton}
            onPress={() => navigation.navigate('Scan')}
            accessibilityRole="button"
            accessibilityLabel="Scan a product"
          >
            <Ionicons name="barcode-outline" size={18} color={Colors.textPrimary} />
            <Text style={styles.ctaLabel}>Scan a product</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <SectionList
          sections={sections}
          keyExtractor={(item) => item.bookmark.id}
          stickySectionHeadersEnabled={false}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={Colors.accent} />
          }
          renderSectionHeader={({ section }) => (
            <View style={styles.sectionHeader}>
              <View style={[styles.sectionDot, { backgroundColor: section.dotColor }]} />
              <Text style={styles.sectionLabel}>
                {section.label} · {section.data.length}
              </Text>
            </View>
          )}
          renderItem={({ item, index, section }) => (
            <SwipeableRow
              onDelete={() => handleDelete(item.product.id)}
              deleteConfirmMessage={`Remove ${item.product.brand} ${item.product.name} from bookmarks?`}
              deleteLabel="Remove"
            >
              <BookmarkRow
                card={item}
                petName={activePet.name}
                petId={activePetId!}
                navigation={navigation}
                isLastInSection={index === section.data.length - 1}
              />
            </SwipeableRow>
          )}
        />
      )}
```

- [ ] **Step 4: Add section-header styles**

Append to `StyleSheet.create`:

```ts
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    paddingTop: Spacing.md,
    paddingBottom: 6,
    paddingHorizontal: Spacing.lg,
  },
  sectionDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  sectionLabel: {
    color: Colors.textSecondary,
    fontSize: FontSizes.xs,
    fontWeight: '600',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
```

- [ ] **Step 5: Update `BookmarkRow` signature**

Change the `BookmarkRow` function signature to accept `isLastInSection`:

```ts
function BookmarkRow({
  card,
  petName,
  petId,
  navigation,
  isLastInSection,
}: {
  card: BookmarkCardData;
  petName: string;
  petId: string;
  navigation: Nav;
  isLastInSection: boolean;
}) {
```

(Divider rendering is handled in Task 12 — for now, accept the prop but don't use it so the signatures line up.)

- [ ] **Step 6: Verify it compiles and the existing test suite still passes**

Run: `npx tsc --noEmit`
Run: `npx jest --no-coverage`

Expected: all PASS.

- [ ] **Step 7: Commit**

```bash
git add src/screens/BookmarksScreen.tsx
git commit -m "M9: BookmarksScreen — SectionList + grouped sections by category"
```

---

## Task 12: `BookmarksScreen` — row polish (divider, vet-diet tag, recalled chip, bypass dash)

**Files:**
- Modify: `src/screens/BookmarksScreen.tsx`

- [ ] **Step 1: Rewrite the `BookmarkRow` render**

Replace the entire `BookmarkRow` function body with:

```tsx
function BookmarkRow({
  card,
  petName,
  petId,
  navigation,
  isLastInSection,
}: {
  card: BookmarkCardData;
  petName: string;
  petId: string;
  navigation: Nav;
  isLastInSection: boolean;
}) {
  const isRecalled = card.product.is_recalled;
  const isBypass =
    !isRecalled &&
    (card.product.is_vet_diet || card.product.is_variety_pack || card.final_score == null);
  const scoreColor =
    !isRecalled && !isBypass && card.final_score != null
      ? getScoreColor(card.final_score, card.product.is_supplemental)
      : null;

  const a11yLabel = isRecalled
    ? `${card.product.brand} ${card.product.name}, recalled`
    : card.final_score != null
    ? `${card.final_score}% match for ${petName}, ${card.product.brand} ${card.product.name}`
    : `${card.product.brand} ${card.product.name}${card.product.is_vet_diet ? ', vet diet' : ''}${card.product.is_variety_pack ? ', variety pack' : ''}`;

  return (
    <TouchableOpacity
      style={[
        styles.row,
        isRecalled && styles.rowRecalled,
        !isLastInSection && styles.rowDivider,
      ]}
      onPress={() => {
        if (isRecalled) {
          navigation.navigate('RecallDetail', { productId: card.product.id });
        } else {
          navigation.navigate('Result', { productId: card.product.id, petId });
        }
      }}
      activeOpacity={0.7}
      accessibilityLabel={a11yLabel}
    >
      {card.product.image_url ? (
        <Image source={{ uri: card.product.image_url }} style={styles.image} />
      ) : (
        <View style={styles.imagePlaceholder}>
          <Ionicons name="cube-outline" size={18} color={Colors.textTertiary} />
        </View>
      )}
      <View style={styles.info}>
        <View style={styles.brandRow}>
          <Text style={styles.brand} numberOfLines={1}>
            {sanitizeBrand(card.product.brand)}
          </Text>
          {card.product.is_vet_diet && (
            <View style={styles.vetDietChip}>
              <Text style={styles.vetDietChipText}>Vet diet</Text>
            </View>
          )}
        </View>
        <Text style={styles.name} numberOfLines={2}>
          {stripBrandFromName(card.product.brand, card.product.name)}
        </Text>
      </View>
      {isRecalled ? (
        <View style={styles.recalledChip}>
          <Text style={styles.recalledChipText}>Recalled</Text>
        </View>
      ) : scoreColor ? (
        <View style={[styles.pill, { backgroundColor: `${scoreColor}1A` }]}>
          <Text style={[styles.pillText, { color: scoreColor }]}>{card.final_score}%</Text>
        </View>
      ) : (
        <View style={styles.bypassChip}>
          <Text style={styles.bypassChipText}>—</Text>
        </View>
      )}
    </TouchableOpacity>
  );
}
```

- [ ] **Step 2: Add the new styles**

Append to `StyleSheet.create` in `src/screens/BookmarksScreen.tsx`:

```ts
  rowDivider: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.hairlineBorder,
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    marginBottom: 2,
  },
  vetDietChip: {
    backgroundColor: Colors.chipSurface,
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  vetDietChipText: {
    color: Colors.textSecondary,
    fontSize: FontSizes.xs,
    fontWeight: '600',
  },
  recalledChip: {
    backgroundColor: `${Colors.severityRed}1A`,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  recalledChipText: {
    color: Colors.severityRed,
    fontSize: FontSizes.sm,
    fontWeight: '700',
  },
  bypassChip: {
    backgroundColor: Colors.chipSurface,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
  },
  bypassChipText: {
    color: Colors.textTertiary,
    fontSize: FontSizes.sm,
    fontWeight: '700',
  },
```

Also remove the old `brand`'s `marginBottom: 2` (now handled by `brandRow`). The existing `brand` style becomes:

```ts
  brand: { color: Colors.textSecondary, fontSize: FontSizes.xs },
```

- [ ] **Step 3: Verify it compiles**

Run: `npx tsc --noEmit`

Expected: PASS.

- [ ] **Step 4: Run full test suite**

Run: `npx jest --no-coverage`

Expected: all PASS.

- [ ] **Step 5: Commit**

```bash
git add src/screens/BookmarksScreen.tsx
git commit -m "M9: BookmarksScreen — row polish (divider, vet-diet tag, recalled chip)"
```

---

## Task 13: `BookmarksScreen` — render tests

**Files:**
- Create: `__tests__/screens/BookmarksScreen.test.tsx`

- [ ] **Step 1: Scaffold the render test file**

Create `__tests__/screens/BookmarksScreen.test.tsx`:

```tsx
import React from 'react';
import { render } from '@testing-library/react-native';
import { NavigationContainer } from '@react-navigation/native';
import BookmarksScreen from '../../src/screens/BookmarksScreen';
import { useActivePetStore } from '../../src/stores/useActivePetStore';
import { useBookmarkStore } from '../../src/stores/useBookmarkStore';
import * as bookmarkService from '../../src/services/bookmarkService';
import type { BookmarkCardData } from '../../src/types/bookmark';

jest.mock('../../src/services/bookmarkService');
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 59, right: 0, bottom: 34, left: 0 }),
}));

const mockedService = bookmarkService as jest.Mocked<typeof bookmarkService>;

function mockCard(overrides: Partial<BookmarkCardData['product']> & {
  id?: string;
  final_score?: number | null;
  created_at?: string;
}): BookmarkCardData {
  const id = overrides.id ?? 'bm-' + Math.random().toString(36).slice(2, 8);
  return {
    bookmark: {
      id,
      user_id: 'u1',
      pet_id: 'pet-1',
      product_id: 'prod-' + id,
      created_at: overrides.created_at ?? '2026-04-21T00:00:00Z',
    },
    product: {
      id: 'prod-' + id,
      brand: 'Brand',
      name: 'Product Name',
      category: 'daily_food',
      image_url: null,
      is_recalled: false,
      is_vet_diet: false,
      is_variety_pack: false,
      is_supplemental: false,
      target_species: 'dog',
      ...overrides,
    },
    final_score: overrides.final_score ?? 80,
  };
}

function renderWithPet(cards: BookmarkCardData[]) {
  useActivePetStore.setState({
    activePetId: 'pet-1',
    pets: [
      {
        id: 'pet-1',
        user_id: 'u1',
        name: 'Buster',
        species: 'dog',
        photo_url: null,
        date_of_birth: '2020-01-01',
        weight_current_lbs: 50,
        is_neutered: true,
        life_stage: 'adult',
        weight_unit: 'lbs',
        weight_goal_level: 0,
        activity_level: 'moderate',
        bcs_score: null,
        bcs_assessed_at: null,
        health_conditions: [],
        allergens: [],
        created_at: '2024-01-01T00:00:00Z',
        health_reviewed_at: null,
        caloric_accumulator: 0,
        accumulator_last_reset_at: null,
        accumulator_notification_sent: false,
      } as any,
    ],
  });
  useBookmarkStore.setState({
    bookmarks: cards.map((c) => ({
      id: c.bookmark.id,
      user_id: c.bookmark.user_id,
      pet_id: c.bookmark.pet_id,
      product_id: c.product.id,
      created_at: c.bookmark.created_at,
    })),
    currentPetId: 'pet-1',
  });
  mockedService.fetchBookmarkCards.mockResolvedValue(cards);

  return render(
    <NavigationContainer>
      <BookmarksScreen />
    </NavigationContainer>,
  );
}

describe('BookmarksScreen', () => {
  afterEach(() => jest.clearAllMocks());

  it('renders three section headers when all buckets are populated', async () => {
    const cards = [
      mockCard({ id: 'a', category: 'daily_food' }),
      mockCard({ id: 'b', category: 'daily_food', is_supplemental: true }),
      mockCard({ id: 'c', category: 'treat' }),
    ];
    const { findByText } = renderWithPet(cards);
    expect(await findByText(/Daily Food · 1/i)).toBeTruthy();
    expect(await findByText(/Toppers & Mixers · 1/i)).toBeTruthy();
    expect(await findByText(/Treats · 1/i)).toBeTruthy();
  });

  it('omits a section header when its bucket is empty', async () => {
    const cards = [mockCard({ category: 'treat' })];
    const { findByText, queryByText } = renderWithPet(cards);
    expect(await findByText(/Treats · 1/i)).toBeTruthy();
    expect(queryByText(/Daily Food/)).toBeNull();
    expect(queryByText(/Toppers & Mixers/)).toBeNull();
  });

  it('renders a Recalled chip and pins the recalled row above higher-scored siblings', async () => {
    const cards = [
      mockCard({ id: 'top', category: 'daily_food', final_score: 99, name: 'Top Scored' }),
      mockCard({ id: 'rec', category: 'daily_food', is_recalled: true, final_score: null, name: 'Recalled One' }),
    ];
    const { findByText, getAllByLabelText } = renderWithPet(cards);
    expect(await findByText('Recalled')).toBeTruthy();

    const labels = getAllByLabelText(/Recalled One|99% match for Buster/);
    // Recalled row's accessibilityLabel should appear before the top-scored row's label in render order.
    expect(labels[0].props.accessibilityLabel).toMatch(/recalled$/i);
  });

  it('renders the Vet diet chip next to brand on vet-diet rows', async () => {
    const cards = [mockCard({ category: 'daily_food', is_vet_diet: true, final_score: null })];
    const { findByText } = renderWithPet(cards);
    expect(await findByText('Vet diet')).toBeTruthy();
  });

  it('uses the D-168 accessibilityLabel pattern on scored rows', async () => {
    const cards = [mockCard({ id: 'x', category: 'daily_food', final_score: 84, brand: 'Nulo', name: 'Challenger' })];
    const { findByLabelText } = renderWithPet(cards);
    expect(await findByLabelText(/84% match for Buster, Nulo Challenger/)).toBeTruthy();
  });

  it('renders the amber progress chip when count >= 19', async () => {
    const cards = Array.from({ length: 19 }, (_, i) =>
      mockCard({ id: 'n' + i, category: 'daily_food', final_score: 80 }),
    );
    const { findByText } = renderWithPet(cards);
    expect(await findByText(/19\/20 saved/)).toBeTruthy();
  });
});
```

Notes:
- The mock for `react-native-safe-area-context` avoids needing a `SafeAreaProvider` wrapper.
- The pet fixture uses `as any` to skip the full `Pet` type — this is a test-only concession; keep the cast local.
- `sanitizeBrand` / `stripBrandFromName` run in production so the test copy reflects their output ("Nulo Challenger" not "NULO - Challenger Puppy & Adult…"). Adjust the regex in the D-168 label test if your sanitizer changes the output.

- [ ] **Step 2: Run the new render tests**

Run: `npx jest __tests__/screens/BookmarksScreen.test.tsx --no-coverage`

Expected: all 6 tests PASS.

- [ ] **Step 3: Run the full suite to catch regressions**

Run: `npx jest --no-coverage`

Expected: all tests PASS. Test count should be **1627 + 17 new from Tasks 1–7 grouping + 6 new from this task ≈ 1650**.

- [ ] **Step 4: Commit**

```bash
git add __tests__/screens/BookmarksScreen.test.tsx
git commit -m "M9: BookmarksScreen — render tests (sections, recalled pin, vet-diet, a11y, near-cap)"
```

---

## Task 14: Regression anchors + final verification

**Files:** none modified.

- [ ] **Step 1: Confirm scoring regression anchors are intact**

Run: `npx jest regressionAnchors --no-coverage`

Expected: PASS. Pure Balance (Dog) = 61, Temptations (Cat Treat) = 0.

- [ ] **Step 2: Type-check the whole repo**

Run: `npx tsc --noEmit`

Expected: PASS (no type errors).

- [ ] **Step 3: Run the full test suite one more time**

Run: `npx jest --no-coverage`

Expected: all tests PASS. Green count is the checkpoint.

- [ ] **Step 4: Update `docs/status/CURRENT.md` test count**

Find the `Numbers` section and update `Tests:` to the new green count. No commit on its own; bundle with the next handoff commit.

---

## Done criteria

- Spec §1–§5 all implemented and covered by at least one test or visual verification
- All `npx jest` tests pass (new test count ≈ 1650)
- `npx tsc --noEmit` is clean
- Scoring regression anchors (Pure Balance = 61, Temptations = 0) still pass
- `BookmarksScreen` and `ScanHistoryScreen` headers no longer collide with the Dynamic Island on iPhone 14 Pro+
- On-device visual QA (manual, not in plan): three section dots render in correct colors, vet-diet chip and recalled chip look right, near-cap amber triggers at 19/20, pet photo + initial fallback both render cleanly, hairline dividers visible between rows inside each section
