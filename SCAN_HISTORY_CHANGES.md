# Scan History — Implementation Summary

**Date:** March 24, 2026
**Branch:** m5-complete
**Tests:** 925 passing / 45 suites (was 906 / 43)

---

## Purpose

Wire up the existing `scan_history` table (already populated by ResultScreen after scoring) to display recent scans on HomeScreen and PetHubScreen. Previously the data was written but never read for display.

---

## Files Created

### `src/types/scanHistory.ts`
**Purpose:** TypeScript interface for scan history items with joined product data.
- `ScanHistoryItem` — mirrors the PostgREST join shape: scan fields + nested `product` object (name, brand, image_url, category, is_supplemental, is_recalled, is_vet_diet).

### `src/services/scanHistoryService.ts`
**Purpose:** Query service for recent scans per pet.
- `getRecentScans(petId, limit)` — queries `scan_history` joined with `products` via FK, ordered by `scanned_at DESC`, fetches 20 rows, deduplicates client-side by `product_id` (keeps most recent), returns first `limit` results. Returns `[]` on error or empty petId (graceful read pattern). Filters out rows where the joined product is null (deleted product guard).

### `src/components/ScanHistoryCard.tsx`
**Purpose:** Compact card component (~64px) for displaying a single scan history entry.
- Horizontal layout: product image (44x44) | brand + name | score badge + relative time.
- Score badge has 4 states matching PantryCard's pattern: recalled (red), vet diet (indigo), no score (gray), normal score (colored via `getScoreColor`).
- Uses `stripBrandFromName()` for cleaner product names and `formatRelativeTime()` for timestamps.
- Tap triggers `onPress(productId)` for navigation.

### `__tests__/services/scanHistoryService.test.ts`
**Purpose:** 6 tests for the scan history service.
- Empty petId returns [], correct field mapping, deduplication by product_id, limit parameter respected, error returns [], null product rows filtered out.
- Uses `mockChain` pattern matching existing service tests.

---

## Files Modified

### `src/utils/formatters.ts`
**What changed:** Added `formatRelativeTime(isoDate)` function.
**Purpose:** Past-focused relative time formatter for scan timestamps.
- Uses calendar-day comparison first (so "yesterday at 11pm" shows "Yesterday", not "1h ago").
- Output: "Just now" (<1 min) | "Xm ago" | "Xh ago" | "Yesterday" | "Xd ago" (2-6 days) | "Mar 15" (7+ days).

### `__tests__/utils/formatters.test.ts`
**What changed:** Added 7 tests for `formatRelativeTime`.
- Covers: just now, minutes ago, hours ago, yesterday (calendar day), days ago, older dates. Uses `jest.useFakeTimers()` with fixed system time.

### `src/types/navigation.ts`
**What changed:** Added `Result` and `RecallDetail` routes to `MeStackParamList`.
**Purpose:** Enables navigation from PetHubScreen (Me tab) to ResultScreen and RecallDetailScreen when tapping scan history cards. Same route signatures as HomeStack/SearchStack/PantryStack.

### `src/navigation/index.tsx`
**What changed:** Registered `ResultScreen` and `RecallDetailScreen` in the MeStack navigator (after line 109).
**Purpose:** Completes the navigation plumbing so the new routes in MeStackParamList resolve to actual screens. Both screen components were already imported.

### `src/screens/PetHubScreen.tsx`
**What changed:**
- Added imports for `getRecentScans`, `ScanHistoryCard`, `ScanHistoryItem`.
- Added `recentScans` state.
- Extended `useFocusEffect` Promise.all to include `getRecentScans(activePet.id, 5)`.
- Replaced the placeholder (lines 670-680, "No scans yet" with scan icon) with a full section: "Recent Scans" header + "See All" link (if >3 results) + up to 3 ScanHistoryCards + empty state fallback.
- Tap handler routes to `RecallDetail` for recalled products, `Result` for all others.
- Updated styles: removed `alignItems: 'center'` from `scansCard`, added `scansSectionHeader`, `scansEmptyState`, `seeAllText`.

### `src/screens/HomeScreen.tsx`
**What changed:**
- Added imports for `getRecentScans`, `ScanHistoryCard`, `ScanHistoryItem`.
- Added `recentScans` state.
- Refactored `useFocusEffect` to use `Promise.allSettled` for parallel appointment + scan fetches.
- Added "Recent Scans" section between the scan counter and empty state CTA, rendering up to 3 cards. Only visible when scans exist.
- Wrapped empty state CTA ("Scan your first product") in a conditional — hidden when recent scans are present.
- Tap handler routes to `RecallDetail` for recalled products, `Result` for all others.
- Added styles: `recentScansSection`, `recentScansTitle`.

### `__tests__/utils/pantryHelpers.test.ts`
**What changed:** Added `jest.mock('@react-native-async-storage/async-storage')`.
**Purpose:** Fix pre-existing test suite crash. The working-tree version of `pantryHelpers.ts` imports AsyncStorage (for weight unit preferences), but the test file had no mock for it. This recovered 74 tests that were silently not running.

### `__tests__/services/pantryService.test.ts`
**What changed:** Added `jest.mock('@react-native-async-storage/async-storage')`.
**Purpose:** Same fix — `pantryService.ts` imports `pantryHelpers.ts` which imports AsyncStorage. Recovered 7 tests.

### `CLAUDE.md`
**What changed:** Updated last-updated date, test counts (904→925, 43→45 suites), added scan history service/component/type to key code paths, added `scan_history` table to Schema Traps section.

---

## Architecture Notes

- **Table:** `scan_history` (NOT `scans`). Created in migration `001_initial_schema.sql:231`. RLS on `user_id`.
- **Write path:** ResultScreen inserts on scoring completion, fire-and-forget, only for non-bypass results (`!result.bypass`). Unchanged by this work.
- **Read path (new):** `scanHistoryService.getRecentScans()` → PostgREST join with `products` table → client-side dedup → ScanHistoryCard display.
- **Dedup strategy:** PostgREST lacks `DISTINCT ON`. Fetch 20 rows ordered by recency, deduplicate in JS by `product_id` (first occurrence = most recent), take first N.
- **Recalled products:** Products recalled after scanning will show the red "Recalled" badge via the live `products.is_recalled` join. Products that were already recalled at scan time are not in `scan_history` (bypass skips insert).
- **"See All" link:** Renders on PetHubScreen when >3 scans exist. Currently a placeholder — full scan history list screen is a follow-up.
