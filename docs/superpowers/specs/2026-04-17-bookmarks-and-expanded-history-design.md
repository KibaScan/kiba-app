# Bookmarks & Expanded History — Design Spec

**Date:** 2026-04-17
**Status:** Design (pre-implementation)
**Milestone:** M9
**Prior art:** no existing favorites/saves in repo (greenfield)

---

## Context

Kiba today captures every scan into `scan_history` and renders the latest 5 (deduped by product) on HomeScreen. There is no way for a user to intentionally mark a product as "save for later" — the implicit scan log is the only record. Two friction points fall out of that:

1. **Intent is lost.** A user who scans 20 products in a session cannot distinguish the three they liked from the 17 they were just checking. They must re-scan or rely on memory.
2. **Recent Scans feels shallow.** Five rows with no overflow. Users can't browse older history without re-scanning, and there's no entry point to a fuller archive.

This spec adds **Bookmarks** (per-pet, hard cap 20) and expands **scan history access** (up to 20 on a dedicated screen) without enlarging HomeScreen's footprint materially. Bookmarks are scoped per-pet because every other list in the app (Pantry, Top Picks, Scans) is per-pet, and displaying a user-scoped save without a pet context would require awkward score-display decisions — the match score is the whole point.

## Non-goals

- Cross-pet sharing (`"Save for [other pet]"` long-press) — revisit if requested
- Filter/sort/search on dedicated screens — simple reverse-chronological lists
- Scan deletion from history — scans are immutable
- Premium gate — 20 is a hard cap, not a paywall
- Full "Report issue" pipeline — MVP uses `mailto:` with pre-filled context

---

## 1. Data model

**New migration: `supabase/migrations/040_bookmarks.sql`**

```sql
CREATE TABLE bookmarks (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  pet_id     UUID NOT NULL REFERENCES pets(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(pet_id, product_id)
);

CREATE INDEX idx_bookmarks_pet_created ON bookmarks (pet_id, created_at DESC);

ALTER TABLE bookmarks ENABLE ROW LEVEL SECURITY;

CREATE POLICY bookmarks_owner ON bookmarks
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());
```

- **Cap enforcement:** client-side `COUNT` check before insert; toast on overflow. No trigger (unnecessary — rate-limited by client UI).
- **Score source:** live read from `pet_product_scores` cache (same source Top Matches uses via `src/services/topMatches.ts`). Cache miss → fall back to `batchScoreOnDevice.ts`. No new scoring logic.

## 2. HomeScreen changes

**File:** `src/screens/HomeScreen.tsx`

Insert new Bookmarks section **between the Pantry nav row (line 591–617) and Recent Scans (line 620–707)**:

- Header row: `Bookmarks` (left, same H2 style as `Recent Scans`) + `See all ›` on the right in `Colors.primary` (cyan)
- Body: up to **3 inline rows** in the same style as existing Recent Scans inline rows (image 40×40, brand, name truncated, score badge right)
- **Hidden entirely when `bookmarks.length === 0`** — section does not render, no zero-state noise

Recent Scans section update: the existing `"N this week"` counter moves to a second line under the `Recent Scans` title, and `See all ›` (cyan) takes the right-side slot. Rationale: stacking avoids a crowded "`5 this week · See all ›`" compound label while preserving both signals. Confirm visually with the user during implementation; if stacking feels heavy, collapse to just `See all ›` and move the weekly count into `ScanHistoryScreen`'s header only.

HomeScreen fetch count for Recent Scans stays at 5. Dedicated screens hold up to 20 each.

## 3. ResultScreen changes

**File:** `src/screens/ResultScreen.tsx`

Replace the single share icon in the header (top-right) with an **overflow menu affordance**: `Ionicons name="ellipsis-horizontal-circle"` in `Colors.primary` (cyan). Same tap target size as the current share button.

Tapping opens an action sheet with three items:

1. **Bookmark** / **Unbookmark** — toggle state; label updates live based on `isBookmarked` from `useBookmarkStore`
2. **Share** — existing share behavior, unchanged
3. **Report issue** — `Linking.openURL('mailto:support@kibascan.com?subject=Report%20issue%20%E2%80%94%20<brand>%20<name>&body=Product%3A%20<id>%0APet%3A%20<petId>%0A%0A')` with URL-encoded product + pet context pre-filled

Use the existing action-sheet pattern in the repo (`ActionSheetIOS` if already in use; otherwise the same bottom-sheet pattern used elsewhere — verify during implementation).

## 4. Entry points

All paths converge on one toggle in `useBookmarkStore`:

- **ResultScreen ellipsis menu** → `Bookmark` / `Unbookmark` action sheet item
- **Long-press on a Recent Scan row** (HomeScreen + new `ScanHistoryScreen`) → context action sheet with `Bookmark` / `Unbookmark`

Long-press uses RN `Pressable`'s `onLongPress`. Haptic feedback via `expo-haptics` on trigger (matching D-121 haptic map if it already covers long-press; otherwise `ImpactFeedbackStyle.Medium`).

## 5. Dedicated screens

### `BookmarksScreen` — `src/screens/BookmarksScreen.tsx`

- Header: `Bookmarks` + active pet name + count (e.g., `Buster · 3/20`)
- `FlatList` of up to 20 rows, newest first, same inline row style as Home
- **Swipe-left-to-delete** via existing `SwipeableRow` (`src/components/ui/SwipeableRow.tsx`) with confirmation modal (match the pattern used on health records / medications)
- Pull-to-refresh re-queries and re-scores against the active pet
- Empty state: cube icon + `"No bookmarks yet"` + helper copy pointing at the ellipsis menu and long-press entry points

### `ScanHistoryScreen` — `src/screens/ScanHistoryScreen.tsx`

- Header: `Recent Scans` + active pet name + `N this week` counter
- `FlatList` of up to 20 rows (reuse `getRecentScans(petId, 20)` from `src/services/scanHistoryService.ts` — already dedupes by product_id)
- **No delete** — scans are immutable historical record
- Long-press row → context menu → `Bookmark` / `Unbookmark`
- Pull-to-refresh

Both screens registered in `HomeStackParamList` (check `src/types/navigation.ts`). Routes: `Bookmarks`, `ScanHistory`. `See all ›` links navigate to them with no params (they read the global active pet).

## 6. Behavior details

- **Pet switch:** `useBookmarkStore` subscribes to `useActivePetStore` (or component `useEffect` on `activePetId`). Switch pets → Home Bookmarks section re-queries; hides if empty for new pet. Same for dedicated screen.
- **Recalled products:** reuse `PantryCard`'s red left-border + `Recalled` badge treatment. Tap routes to `RecallDetailScreen`, same as Pantry does today.
- **Score type:** live match score for active pet. No snapshot at save time.
- **Bookmark preserved across scans:** a bookmark persists even if the user never re-scans; re-rendering the row refreshes the score.
- **Bypass products** (vet diet, species mismatch, variety pack): bookmarkable — show the bypass badge in place of the score (same visual rules as `PantryCard`).

## 7. Accessibility

Every score element on bookmark and scan rows exposes the full D-168 phrase:

```tsx
accessibilityLabel={`${score}% match for ${petName}`}
```

Long-press context menu and ellipsis action sheet follow iOS native patterns (screen reader announces menu items automatically). SwipeableRow delete confirmation retains existing a11y hooks.

## 8. Score framing (D-168 compliance)

All new score-bearing rows follow the **in-app, moderate-space** tier: `{score}% match` visible text. Dedicated screens' headers use plain pet name (no score framing needed). No `PetShareCard`-style outbound share is introduced here. Full phrase still reaches assistive tech via `accessibilityLabel`.

## Files

### New
- `supabase/migrations/040_bookmarks.sql`
- `src/types/bookmark.ts`
- `src/services/bookmarkService.ts`
- `src/stores/useBookmarkStore.ts`
- `src/screens/BookmarksScreen.tsx`
- `src/screens/ScanHistoryScreen.tsx`
- `src/components/result/ResultHeaderMenu.tsx` — extracted component hosting the overflow menu and its three items; keeps `ResultScreen.tsx` from growing further
- `__tests__/services/bookmarkService.test.ts`
- `__tests__/stores/useBookmarkStore.test.ts`

### Modified
- `src/screens/HomeScreen.tsx` — new Bookmarks section between lines 591 and 620; `See all ›` link added to Recent Scans header (line ~620 header row)
- `src/screens/ResultScreen.tsx` — replace share button in header with overflow menu; wire menu items
- `src/types/navigation.ts` (or equivalent) — add `Bookmarks` and `ScanHistory` routes to `HomeStackParamList`
- `DECISIONS.md` — add **D-169: Bookmarks Feature**
- `ROADMAP.md` — add completed item to M9 on ship
- `docs/status/CURRENT.md` — update numbers (tests, decisions 130 → 131) on ship
- `CLAUDE.md` — Schema Traps: note `bookmarks` table (per-pet, UNIQUE(pet_id, product_id), 20 cap client-side)

## Reused utilities (do not re-invent)

- `SwipeableRow` — `src/components/ui/SwipeableRow.tsx`
- `getRecentScans(petId, limit)` — `src/services/scanHistoryService.ts` (call with `limit=20` on `ScanHistoryScreen`)
- `pet_product_scores` cache pattern — `src/services/topMatches.ts` (`checkCacheFreshness`, `fetchTopMatches`)
- `batchScoreOnDevice` fallback — `src/utils/batchScoreOnDevice.ts`
- `useActivePetStore` — `src/stores/useActivePetStore.ts`
- `PantryCard` recalled treatment — red left border + `Recalled` badge
- Matte Premium tokens — `Colors.cardSurface`, `Colors.hairlineBorder`, `Colors.primary`, `Spacing.md`, `Spacing.lg` (`src/utils/constants.ts`)
- Ionicons `ellipsis-horizontal-circle`
- `Linking.openURL` for `mailto:`
- `expo-haptics` for long-press feedback

## Verification

**Unit tests (Jest):**

- `bookmarkService`: add / remove / toggle / getForPet; 20-cap enforcement (21st save throws `BookmarksFullError`); offline guard (mirrors `PantryOfflineError` pattern)
- `useBookmarkStore`: optimistic update on toggle, rollback on error, pet-switch refetch
- Empty state: HomeScreen render with 0 bookmarks → section not rendered

**Manual E2E (on device):**

1. Scan product → ellipsis menu → Bookmark → Home shows new row in Bookmarks section
2. Save 20 distinct products → try to save 21st → toast: `"Bookmarks full. Remove one to save another."`
3. Long-press a Recent Scan row → context menu → Bookmark → verify row appears in Bookmarks
4. Swipe-left on a bookmark row in `BookmarksScreen` → confirm → row removed
5. Switch active pet → Bookmarks section re-renders for new pet (empty if the new pet has no bookmarks → section hidden)
6. Bookmark a recalled product → verify red border + `Recalled` badge; tap → `RecallDetailScreen`
7. Bookmark a vet diet product → verify bypass badge (no score ring)
8. Ellipsis menu → Share → existing share sheet opens unchanged
9. Ellipsis menu → Report issue → Mail opens with `support@kibascan.com`, subject includes brand+name, body includes product_id + pet_id
10. Tap `See all ›` on Bookmarks → `BookmarksScreen` with up to 20 rows
11. Tap `See all ›` on Recent Scans → `ScanHistoryScreen` with up to 20 rows, no delete affordance
12. Pull-to-refresh on `BookmarksScreen` → scores refresh against active pet
13. VoiceOver: focus each score element → announces `"X% match for <petName>"`

**Regression anchors (must still pass):**
- Pure Balance (dog) = 61
- Temptations (cat treat) = 0
- Jest suite passes at 71 suites, tests +N for new suites

## Decisions to record (at implementation)

- **D-169: Bookmarks — Per-Pet Watchlist.** Status: LOCKED. Scope: per-pet, hard cap 20, no premium gate, live score display (no snapshot), immutable scans, mailto-based Report issue stub. Supersedes: none. Rationale: matches Kiba's per-pet mental model; score context is preserved; cap prevents list decay without introducing a paywall.

## Gotchas

- **RN `accessibilityLabel` flattening** (D-168 lesson): on pressable rows, put the label on the OUTER pressable, not on inner Text. Apply to long-press `Pressable` too.
- **Pet switch must refetch.** `useBookmarkStore` subscribes to `useActivePetStore.activePetId`. Without the subscription, stale bookmarks render for 1 frame on switch.
- **20-cap is per-pet, not per-user.** A 2-pet household can hold up to 40 bookmarks total.
- **`Linking.openURL('mailto:')` silently fails if no Mail client configured.** Use `Linking.canOpenURL` before calling; fall back to toast `"No email client available"` on rejection.
- **Ellipsis menu state:** `isBookmarked` must refresh when menu opens (not cached at ResultScreen mount) — read from store at menu-open time.
