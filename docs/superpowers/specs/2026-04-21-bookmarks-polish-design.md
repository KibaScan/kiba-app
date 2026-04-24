# Bookmarks Polish — Design Spec

**Date:** 2026-04-21
**Status:** Design (pre-implementation)
**Milestone:** M9
**Prior art:** `docs/superpowers/specs/2026-04-17-bookmarks-and-expanded-history-design.md` (shipped as PR #13 / D-169)

---

## Context

D-169 shipped a working Bookmarks screen but on-device review surfaced two problems:

1. **Dynamic Island collision.** `BookmarksScreen`'s header renders at `y=0` because `HomeStack` has `headerShown: false` and the screen owns its own chrome without `useSafeAreaInsets` padding. On iPhone 14 Pro and later, the title bleeds into the Dynamic Island and the system status bar draws over it.
2. **"Soulless" visual.** A 20-row flat list of brand + name + score pill reads the same as a generic table. The list tells the user nothing about *what kind* of products they saved or where the good stuff is, and the header gives no pet identity.

This spec keeps the D-169 data model, cap, and entry points unchanged. It rewrites the presentation layer only: header safe-area fix, pet-anchored header, category grouping, row-level polish, and a safe-area-only port to `ScanHistoryScreen`.

## Non-goals

- Cross-pet bookmark sharing (still out of scope per D-169)
- Filter / sort controls on the screen
- Reordering within a section (score DESC is fixed)
- Supplements as a fourth bucket (deferred; user may add a toggle later)
- Any row-level "Supplemental" tag (the bucket header already carries that signal)
- Changes to `useBookmarkStore` or migration 040
- Scope changes to `bookmarkService` (a one-field data change — `product.category` added to the `fetchBookmarkCards` select — is required for grouping; see §4.1)

---

## 1. Header

### 1.1 Safe-area fix (non-negotiable)

`BookmarksScreen` gets `useSafeAreaInsets()`; the header container uses `paddingTop: insets.top + Spacing.sm`. Same `useSafeAreaInsets()` pattern already used by `PantryScreen.tsx:321` (which uses `insets.top` alone; we add `Spacing.sm` for a little extra breathing room above the title). This alone resolves the Dynamic Island collision.

### 1.2 Pet-anchored layout

Replace the current `"Bookmarks" / "Buster · 17/20"` header with:

```
┌───────────────────────────────────────────────────┐
│ insets.top + Spacing.sm                           │
│                                                   │
│ [photo 36]   Buster's Bookmarks      [17/20 saved]│
│                                                   │
│ ────────────── hairline divider ──────────────────│
└───────────────────────────────────────────────────┘
```

- **Pet photo:** 36×36 circular. Source: `activePet.photo_url` (already in store, no new fetch). Fallback: neutral `cardSurface` circle with the pet's first initial in `FontSizes.md`, `fontWeight: '700'`, `Colors.textPrimary` (matches existing PetHubScreen avatar fallback).
- **Title:** `"{petName}'s Bookmarks"`. Font: `FontSizes.xxl`, `fontWeight: '800'`, `Colors.textPrimary` (per `.agent/design.md` screen-title spec). `numberOfLines={2}` + `ellipsizeMode="tail"` — wraps to a second line before truncating for long names. (Post-QA revision from v1's single-line "Shortlist" — "Bookmarks" is both clearer and user-requested; a 2-line budget prevents mid-name cutoff on simulator defaults.)
- **Progress chip (right-aligned):** `"{n}/20 saved"` in a small pill — `chipSurface` background, `FontSizes.xs`, `fontWeight: '600'`, padding `4px 8px`, `borderRadius: 8`. When `n >= 19`, background shifts to `Colors.severityAmberTint` (pre-built 15% amber token) and text color shifts to `Colors.severityAmber` to hint the cap without alarming.

**No subtitle.** An earlier v1 of this spec had a `"Live scores"` caption below the title, intended to hint that the displayed scores reflect the current profile. Post-QA feedback showed that's not intuitive to a new user (they read "Live scores" as UI noise, not as meaningful state). Dropped — the score pills are self-evident.

**Layout:** the pet photo and title are a horizontal row; the progress chip right-aligns via `justifyContent: 'space-between'` on the row wrapper. With `numberOfLines={2}` the title may grow vertically — `alignItems: 'center'` keeps the photo and chip centered against the taller title.

**Copy compliance (D-095):** "Bookmarks" and "Saved" are neutral — no prescribe / treat / cure / prevent / diagnose.

**List bottom padding:** `SectionList`'s `contentContainerStyle` sets `paddingBottom: 88` so the bottom of the list clears the tab bar + floating scan button. Same fix ported to `ScanHistoryScreen`'s `FlatList`.

### 1.3 Empty-pet fallback

The existing `"Select a pet to see bookmarks"` empty state is unchanged when `activePet` is null. No safe-area work needed there because `View` already fills the screen and the copy is centered.

---

## 2. Section grouping

### 2.1 Bucket derivation (pure)

New file `src/utils/bookmarkGrouping.ts`:

```ts
export type BookmarkSectionKey = 'daily_food' | 'toppers_mixers' | 'treats';

export type BookmarkSection = {
  key: BookmarkSectionKey;
  label: string;      // "Daily Food" | "Toppers & Mixers" | "Treats"
  dotColor: string;   // hex from Colors
  data: BookmarkCardData[];
};

export function groupBookmarksByCategory(
  cards: BookmarkCardData[],
): BookmarkSection[];
```

Rules:

| Bucket | Predicate |
|---|---|
| Daily Food | `product.category === 'daily_food' && !product.is_supplemental` |
| Toppers & Mixers | `product.category === 'daily_food' && product.is_supplemental === true` |
| Treats | `product.category === 'treat'` |

Empty buckets are filtered out before return — no empty section header renders.

### 2.2 Sort within a section (3 tiers)

Inside each bucket, order top → bottom:

1. **Recalled** (`product.is_recalled === true`) — pinned. Within tier, stable by `bookmark.created_at` DESC.
2. **Scored** (`final_score != null && !is_vet_diet && !is_variety_pack`) — `final_score` DESC. Ties broken by `bookmark.created_at` DESC.
3. **Bypass / unscored** (vet diet, variety pack, or no cached score) — `bookmark.created_at` DESC.

This matches D-158's "pushed to top of list regardless of other sorting" for recalled products while preserving the user's implicit "highest score first" expectation for normal bookmarks.

### 2.3 Section header

```
[icon]  Daily Food · 9
```

- Category icon: 24×24, `resizeMode: 'contain'`, pulled from `CATEGORY_ICONS_FILLED` (filled variant — static section headers, not an active/inactive toggle). `marginRight` handled by the parent row's `gap: Spacing.xs`. (Post-QA revision from v1's 8px colored dot — the full icon carries category identity more legibly than a plain dot.) Key-name note: `CATEGORY_ICONS_FILLED` uses `treat` (singular), while the section key is `treats` (plural); SECTION_META maps inline.
  - Daily Food → `CATEGORY_ICONS_FILLED.daily_food`
  - Toppers & Mixers → `CATEGORY_ICONS_FILLED.toppers_mixers`
  - Treats → `CATEGORY_ICONS_FILLED.treat`
- Label + count inline: `"{label} · {count}"`. Font: `FontSizes.xs`, `fontWeight: '600'`, `letterSpacing: 0.5`, `textTransform: 'uppercase'`, `Colors.textSecondary`.
- Padding: `paddingTop: Spacing.md`, `paddingBottom: 6`, `paddingHorizontal: Spacing.lg`. Typography (UPPERCASE + `fontWeight: '600'` + `letterSpacing: 0.5`) matches the Section Label spec in `.agent/design.md`; the specific padding values follow full-screen list conventions in the app.
- `stickySectionHeadersEnabled={false}` on the `SectionList` — headers scroll with content (matte aesthetic, no floating bar).

---

## 3. Row anatomy

### 3.1 Base row (unchanged from D-169 except for additions below)

- 40×40 thumbnail, 8px radius, `cardSurface` placeholder with `cube-outline` fallback.
- Brand `FontSizes.xs`, `Colors.textSecondary`.
- Name `FontSizes.md`, `fontWeight: '500'`, `Colors.textPrimary`, 2 lines max.
- Score pill right-aligned: tinted background at `{scoreColor}1A`, text at `{scoreColor}`, `FontSizes.sm`, `fontWeight: '700'`.
- Wrapped in `SwipeableRow` with `onDelete` + `deleteConfirmMessage` — unchanged from D-169.

### 3.2 Hairline divider between rows

Each row gets `borderBottomWidth: StyleSheet.hairlineWidth`, `borderBottomColor: Colors.hairlineBorder`. The **last row of each section** drops the divider — implemented by checking `index === section.data.length - 1` in `renderItem` and conditionally omitting the border style. `ItemSeparatorComponent` is not used because the separator must live inside the `SwipeableRow` to avoid the swipe gesture revealing a loose divider line.

### 3.3 Vet-diet inline tag

When `product.is_vet_diet === true`, render a small chip next to the brand text:

```
NULO  [ Vet diet ]
Challenger Puppy & Adult…
```

Chip style: `chipSurface` background, `borderRadius: 4`, padding `2px 6px`, `FontSizes.xs`, `fontWeight: '600'`, `Colors.textSecondary`. Gap `Spacing.xs` from brand text.

**`is_supplemental` is NOT tagged inline** — the Toppers & Mixers section header already communicates the state. A row-level tag would be redundant inside that section and would be wrong anywhere else (the flag should never fire outside the Toppers bucket).

### 3.4 Recalled treatment (D-158-compliant)

Recalled rows differ from scored rows:

- **Pill slot** shows a red `Recalled` chip in place of the score pill. Style: `severityRed` at low opacity (`1A` suffix) background, `Colors.severityRed` text, same footprint as the score pill so layout doesn't shift. No `0%` — D-158 explicitly forbids that (DECISIONS.md:2488: "Showing a score (even 0) implies the product is being evaluated on merit.").
- **Left border** — existing `rowRecalled` style stays: `borderLeftWidth: 3`, `borderLeftColor: Colors.severityRed`, `paddingLeft: Spacing.lg - 3`.
- **Tap** routes to `RecallDetail` (unchanged from D-169).
- **Pinned** to top of its natural section per §2.2.

### 3.5 Bypass / unscored treatment

Vet diet, variety pack, or cache-miss rows show `—` in a `chipSurface` chip (same footprint as the pill) with `Colors.textTertiary` text. The JIT `batchScoreHybrid` fire-and-forget in `fetchBookmarkCards` continues to hydrate the cache on next render.

### 3.6 Accessibility (D-168 compliance)

Each row's outer `TouchableOpacity` carries:

- Scored row: `accessibilityLabel={\`${final_score}% match for ${petName}, ${brand} ${name}\`}`
- Recalled row: `accessibilityLabel={\`${brand} ${name}, recalled\`}`
- Bypass / unscored: `accessibilityLabel={\`${brand} ${name}\`}` (plus `, vet diet` / `, variety pack` suffix when applicable)

Per the session-58 code-review finding, the child `Recalled` chip / `—` chip / score pill do NOT need their own labels — the row wrapper subsumes them.

---

## 4. Data flow

### 4.1 Service + type tweak (required for grouping)

`BookmarkCardData.product` currently omits `category`. Two small additions:

1. Add `category: 'daily_food' | 'treat'` to the `BookmarkCardData.product` interface in `src/types/bookmark.ts`.
2. Add `category` to the PostgREST select in `fetchBookmarkCards` (`src/services/bookmarkService.ts:127-129`).

No behavioral change — `category` is already a NOT NULL column on `products` and was simply not being selected. No migration, no new schema.

`useBookmarkStore.ts` is untouched.

### 4.2 Screen-level section derivation

The screen computes sections in-component:

```ts
const sections = useMemo(
  () => groupBookmarksByCategory(cards),
  [cards],
);
```

`FlatList` becomes `SectionList`. `renderSectionHeader` renders the §2.3 header, `renderItem` renders the §3 row.

---

## 5. ScanHistoryScreen (sibling)

### 5.1 Port the header safe-area fix

Same Dynamic Island collision exists. Apply `useSafeAreaInsets()` → `paddingTop: insets.top + Spacing.sm` to the screen's header container. No other changes.

### 5.2 Do NOT port grouping

Scan history is temporal (chronological). Grouping by category would hide the "I scanned this yesterday" signal that is the screen's purpose. The pet-anchored header and progress chip are Bookmarks-specific and do not port.

Result: `ScanHistoryScreen` keeps its current `"Recent Scans" / "Buster · N recent"` header and flat list, gaining only the safe-area inset.

---

## 6. Testing

### 6.1 Unit — `__tests__/utils/bookmarkGrouping.test.ts` (new)

- `category × is_supplemental` matrix routes to correct bucket (4 cases)
- Recalled products pin to top of their natural section
- Scored products order by `final_score` DESC within a tier
- Bypass / unscored products sink to bottom; recalled does NOT sink (it pins)
- Ties broken by `bookmark.created_at` DESC
- Empty buckets are filtered out of the returned array
- Stable with empty input (`[] → []`)

### 6.2 Render — `__tests__/screens/BookmarksScreen.test.tsx` (new)

Uses `@testing-library/react-native` (already installed). Covers:

- All three buckets populated → three section headers render with correct dots, labels, counts
- One bucket empty → its header is absent
- Recalled row: `Recalled` chip visible, red left-border applied, positioned above siblings in its section
- Vet diet row: `Vet diet` inline chip next to brand
- D-168 `accessibilityLabel` on every row matches the §3.6 pattern
- Near-cap header (count = 19) renders the amber progress chip

### 6.3 Regression

Existing `__tests__/stores/useBookmarkStore.test.ts` (session 58 cross-pet race tests) is unchanged. No scoring engine tests touched.

---

## 7. Files touched

| File | Type | Notes |
|---|---|---|
| `src/screens/BookmarksScreen.tsx` | Major edit | Header + SectionList + row tag |
| `src/screens/ScanHistoryScreen.tsx` | Minor edit | Safe-area inset only |
| `src/utils/bookmarkGrouping.ts` | New | Pure helpers |
| `__tests__/utils/bookmarkGrouping.test.ts` | New | Helper unit tests |
| `__tests__/screens/BookmarksScreen.test.tsx` | New | Render tests |

No migration, no service, no store, no decision log entry (D-169 already scopes bookmarks).

---

## 8. Risks and open items

- **Section dot colors on device** — `severityGreen` / `accent` / `severityAmber` from existing tokens. Amber for Treats could read as a warning; on-device QA will confirm. If it does, alternatives: `Colors.textTertiary` (no-color neutral) or a new `Colors.chipAmberMuted` token.
- **Pet photo fallback** — `activePet.photo_url` is already in `useActivePetStore`. No new Supabase storage fetch. Fallback initial must handle emoji / non-latin first characters gracefully (use `String.fromCodePoint(str.codePointAt(0)).toLocaleUpperCase()`, not `.charAt(0).toUpperCase()`).
- **Long pet names** — `numberOfLines={1}` + `ellipsizeMode="tail"` on the title. Tested copy: "Buster" (6), "Oliver Twist" (12), "Sir Barkington III" (19) — last one truncates; acceptable.
- **No active bookmarks in any bucket** — with zero cards, the existing empty state renders (no section list, no near-cap chip). Unchanged.

---

## 9. Out of scope (explicitly)

- Row-level form labels ("Dry" / "Wet" / "Freeze-dried") — proposed as P3 during brainstorming, rejected as clutter
- Reordering across sections (e.g., treats-first) — user-sort is out of M9 scope
- Supplements bucket — deferred per user direction ("in the future we can have an option to switch to supplements")
- Haptic feedback on delete confirmation — existing `SwipeableRow` behavior is unchanged
- `mailto:` Report issue flow — D-169 MVP remains
