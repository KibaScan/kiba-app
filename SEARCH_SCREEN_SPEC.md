# SEARCH_SCREEN_SPEC.md — Kiba Search Redesign

**Status:** Spec ready for implementation
**Scope:** Replaces existing `SearchScreen.tsx` (premium-gated text search → full filtered product discovery)
**Dependencies:** Existing `products` table, `pet_product_scores` cache, `permissions.ts`

---

## 1. Purpose

The current Search screen is a basic text search gated behind premium. It has no filtering, no category navigation, and no way to browse products by type. Users can't discover products without already knowing what they're looking for.

The redesign turns Search into a structured product discovery tool: filtered browsing by category, form, and brand — with text search layered on top. Results are always sorted by personalized score for the active pet.

---

## 2. Screen Architecture

**File:** `src/screens/SearchScreen.tsx` (full rewrite)

**Navigation:** Bottom tab bar position unchanged (between Scan and Pantry, or wherever current nav places it).

**Layout (top to bottom):**

```
┌──────────────────────────────┐
│ Header: "Search" + Pet Picker│
├──────────────────────────────┤
│ Search Bar (text input)      │
├──────────────────────────────┤
│ Top-Level Toggle             │
│ [ Daily Food ] [ Treats ]    │
├──────────────────────────────┤
│ Sub-Filter Chips (scrollable)│
│ Dry · Wet · Freeze-Dried ·  │
│ Supplemental  | Brand ▼     │
├──────────────────────────────┤
│ Results Header               │
│ "X results for [Pet Name]"   │
├──────────────────────────────┤
│ Product List (virtualized)   │
│ ┌──────────────────────────┐ │
│ │ 1  [img] Brand           │ │
│ │         Product Name  72 │ │
│ ├──────────────────────────┤ │
│ │ 2  [img] Brand           │ │
│ │         Product Name  68 │ │
│ └──────────────────────────┘ │
└──────────────────────────────┘
```

---

## 3. Data Model

### 3.1 Source Tables

Products come from the `products` table. Scores come from `pet_product_scores` (cached personalized scores per pet).

**Required columns from `products`:**
- `id`, `brand`, `name`
- `category` — `'daily_food'` | `'treat'` | `'supplement'`
- `product_form` — `'dry'` | `'wet'` | `'freeze_dried'` | `'topper'` | `'raw'` | `'dehydrated'` | NULL
- `target_species` — `'dog'` | `'cat'` | `'all'`
- `is_supplemental` — boolean (toppers/mixers scored 65/35/0)
- `is_vet_diet` — boolean
- `needs_review` — boolean (exclude if true)
- `image_url` — nullable, product thumbnail

**Required from `pet_product_scores`:**
- `pet_id`, `product_id`, `total_score`

### 3.2 Exclusions

These products NEVER appear in search results:
- `category = 'supplement'` — unscored per D-096, 4,046 products
- `needs_review = true` — unverified community submissions
- `is_vet_diet = true` — not scored per D-135 (defer vet diet browsing to Top Picks, future scope)
- Recalled products — no score per D-158

### 3.3 Product Counts (as of current DB)

| | Dog | Cat |
|---|---|---|
| Daily Food | 4,832 | 4,178 |
| Treats | 4,468 | 1,534 |
| **Scoreable total** | **~9,300** | **~5,712** |

| Form (all categories) | Dog | Cat |
|---|---|---|
| Dry | 8,874 | 2,722 |
| Wet | 2,211 | 3,299 |
| Freeze-Dried | 1,212 | 469 |
| Topper | 125 | 72 |

| Flag | Dog | Cat |
|---|---|---|
| Supplemental (`is_supplemental`) | 696 | 1,020 |

---

## 4. Filter Logic

### 4.1 Pet Selector

- Dropdown in header showing active pet name + avatar
- Changing pet: resets all filters, re-queries with new pet's species + scores
- Species derived from active pet: `pets.species` → filters `products.target_species` (include `'all'` products for both species)
- Default: whatever pet is currently active in the app (from Zustand global state)

### 4.2 Top-Level Toggle: Daily Food vs Treats

**Mutually exclusive.** Tapping one deselects the other.

| Selection | Query filter | Sub-filters shown |
|---|---|---|
| Daily Food | `category = 'daily_food'` | Dry, Wet, Freeze-Dried, Supplemental + Brand |
| Treats | `category = 'treat'` | Brand only |

**Behavior:**
- Switching top-level resets sub-filter and brand filter
- Each option shows a count badge (e.g., "Daily Food 4.8k")
- Count = total products matching category + species (not filtered by form/brand)

### 4.3 Sub-Filters (Daily Food only)

Horizontal scrollable chip row. Each chip is a **toggle** (tap to activate, tap again to deactivate).

| Chip | Filter logic |
|---|---|
| Dry | `product_form = 'dry' AND is_supplemental = false` |
| Wet | `product_form = 'wet' AND is_supplemental = false` |
| Freeze-Dried | `product_form = 'freeze_dried' AND is_supplemental = false` |
| Supplemental | `is_supplemental = true` (any form) |

**Rules:**
- Only ONE sub-filter active at a time (tap a new one deselects the old)
- When no sub-filter is active, show ALL daily food products
- Each chip shows count badge for the species (e.g., "Dry 8.9k" for dogs)
- Supplemental chip filters by `is_supplemental = true` regardless of `product_form`
- Sub-filter chips are NOT shown when Treats is selected

### 4.4 Brand Filter

- Appears as the last chip in the sub-filter row (after the `|` divider)
- Tapping opens a dropdown/bottom sheet with brand list
- Brand list is **contextual**: only shows brands that have products matching the current top-level + sub-filter + species
- "All Brands" option at the top to clear
- Active brand filter shows the brand name on the chip instead of "Brand"
- Brand list should show product count per brand
- Sorted alphabetically

### 4.5 Text Search

- Full-width search bar below header
- Searches `products.name` and `products.brand` (case-insensitive)
- Works IN COMBINATION with all active filters (additive)
- Debounced: 300ms after last keystroke before querying
- Clear button (X) appears when text is present
- Placeholder: "Search pet food products..."
- Minimum 2 characters before triggering search

### 4.6 Filter Combination

All filters are AND-combined:

```
WHERE target_species IN (pet.species, 'all')
  AND category = [top_level_selection]
  AND needs_review = false
  AND is_vet_diet = false
  AND category != 'supplement'
  [AND product_form = X]           -- if sub-filter active
  [AND is_supplemental = true]     -- if supplemental chip active
  [AND brand = X]                  -- if brand filter active
  [AND (name ILIKE '%q%' OR brand ILIKE '%q%')]  -- if text search
ORDER BY total_score DESC
```

---

## 5. Results Display

### 5.1 Product Row

Each result row shows:

```
[Rank]  [Thumbnail]  Brand            [ScoreRing]
                     Product Name
```

- **Rank:** Position number (1-indexed). Top 3 get accent color (cyan).
- **Thumbnail:** Product image from `image_url`. Fallback: gray placeholder with category icon.
- **Brand:** Muted text above product name. If `is_supplemental = true`, show a small "TOPPER" badge next to brand (teal background, per D-136 color system).
- **Product Name:** Primary text. Truncate with ellipsis if too long. Brand name should NOT appear in product name if already shown above — strip it if the name starts with brand.
- **Score Ring:** Small ring (40px) with score number inside. Color from `getScoreColor()`. Score is the personalized score for the active pet, NOT the base score.

### 5.2 Score Source

Scores come from `pet_product_scores` cache table. If a product doesn't have a cached score for the active pet, it should NOT appear in results (this means the batch-score Edge Function needs to have run for the pet).

**Edge case:** If `pet_product_scores` is empty for a pet (new pet, never scored), show a loading/empty state: "Calculating scores for [Pet Name]... This may take a moment." Trigger the batch-score function.

### 5.3 Sorting

Always sorted by `total_score DESC` (highest match first). No user-configurable sort order in v1.

### 5.4 Pagination

With up to ~9,300 results per species, we need pagination:

- **Strategy:** Cursor-based pagination using `(total_score, product_id)` as cursor
- **Page size:** 20 products per page
- **Trigger:** Load more when user scrolls within 3 items of the bottom (infinite scroll)
- **Use `FlashList`** (not FlatList) for virtualized rendering at this scale

### 5.5 Empty States

| Condition | Message |
|---|---|
| Free user (not premium) | Upsell screen: "Find the best food for [Pet Name]" + blurred preview + CTA |
| No results for filters | "No products match your filters" + "Try adjusting your search or filters" |
| No cached scores for pet | "Calculating scores for [Pet Name]..." + spinner |
| Network error | "Couldn't load products. Check your connection and try again." + retry button |

### 5.6 Results Count Header

Between filters and product list:
- Left: "[X] results for [Pet Name]" (D-094 framing)
- Right: "Clear filters" link (only visible when any sub-filter or brand filter is active)

---

## 6. Query Architecture

### 6.1 Supabase Query Pattern

```typescript
const { data, error } = await supabase
  .from('pet_product_scores')
  .select(`
    total_score,
    product:products!inner (
      id, brand, name, category, product_form,
      target_species, is_supplemental, is_vet_diet,
      needs_review, image_url
    )
  `)
  .eq('pet_id', activePet.id)
  .in('product.target_species', [activePet.species, 'all'])
  .eq('product.category', topLevel)
  .eq('product.needs_review', false)
  .eq('product.is_vet_diet', false)
  .order('total_score', { ascending: false })
  .range(offset, offset + PAGE_SIZE - 1);
```

Apply additional `.eq()` filters for form, brand, supplemental as needed.

**Note:** Test whether Supabase handles `!inner` join filters efficiently at 19k products. If performance is poor (>500ms), consider creating a Postgres view or RPC function.

### 6.2 Count Queries

Filter chips show count badges. These should be fetched ONCE when the pet changes (or screen loads), not on every filter change:

```typescript
// Fetch all counts for active pet's species in one RPC call
const { data: counts } = await supabase.rpc('get_search_counts', {
  p_species: activePet.species
});
```

**Create RPC function `get_search_counts`:**

```sql
CREATE OR REPLACE FUNCTION get_search_counts(p_species TEXT)
RETURNS JSON AS $$
SELECT json_build_object(
  'daily_food', COUNT(*) FILTER (WHERE category = 'daily_food'),
  'treat', COUNT(*) FILTER (WHERE category = 'treat'),
  'dry', COUNT(*) FILTER (WHERE product_form = 'dry' AND category = 'daily_food' AND NOT is_supplemental),
  'wet', COUNT(*) FILTER (WHERE product_form = 'wet' AND category = 'daily_food' AND NOT is_supplemental),
  'freeze_dried', COUNT(*) FILTER (WHERE product_form = 'freeze_dried' AND category = 'daily_food' AND NOT is_supplemental),
  'supplemental', COUNT(*) FILTER (WHERE is_supplemental = true AND category = 'daily_food')
)
FROM products
WHERE target_species IN (p_species, 'all')
  AND needs_review = false
  AND is_vet_diet = false
  AND category != 'supplement';
$$ LANGUAGE sql STABLE;
```

### 6.3 Brand List Query

Fetched when brand picker opens (or cached per top-level + species combo):

```typescript
const { data: brands } = await supabase
  .from('products')
  .select('brand')
  .in('target_species', [activePet.species, 'all'])
  .eq('category', topLevel)
  .eq('needs_review', false)
  .eq('is_vet_diet', false)
  .not('brand', 'is', null)
  // apply sub-filter if active
  .order('brand');
// Deduplicate and count client-side, or use a distinct RPC
```

---

## 7. Paywall Considerations

### 7.1 Paywall: Entire Screen is Premium

**Decision:** The Search screen is fully gated behind premium subscription. No partial access, no sample categories, no free text search.

**Free user experience:**
- Tapping the Search tab shows a full-screen upsell/paywall screen
- The upsell screen should communicate the value: "Find the best food for [Pet Name]"
- Show a blurred/dimmed preview of the search UI behind the paywall CTA to create desire
- Single CTA button → subscription flow (via RevenueCat, per existing paywall pattern)
- No rate limiting needed — the gate is binary (premium or not)

**Implementation:**
```typescript
// In SearchScreen.tsx — top of component
const { canAccessSearch } = usePermissions(); // add to permissions.ts

if (!canAccessSearch) {
  return <SearchUpsellScreen />;
}

// ... rest of search UI
```

**In `permissions.ts`:**
```typescript
export function canAccessSearch(): boolean {
  return isPremium();
}
```

**Upsell screen file:** `src/components/search/SearchUpsellScreen.tsx`

This follows the Yuka model — search/discovery is a premium feature that drives conversions. Free users still get value from scanning individual products.

---

## 8. UI Specifications

### 8.1 Component Hierarchy

```
SearchScreen
├── [if !premium] SearchUpsellScreen (full-screen paywall)
├── [if premium] Header (title + PetPickerDropdown)
├── SearchBar (text input with debounce)
├── TopLevelToggle (Daily Food / Treats)
├── SubFilterRow (scrollable chips + brand chip + divider)
│   ├── FormChip × N
│   ├── Divider
│   └── BrandChip → BrandPickerSheet
├── ResultsHeader (count + clear link)
└── ProductList (FlashList, virtualized)
    └── ProductRow × N
        ├── RankNumber
        ├── ProductThumbnail
        ├── ProductInfo (brand + name + topper badge)
        └── ScoreRing
```

### 8.2 Styling Rules

- All colors from `constants.ts` — no hardcoded hex
- Score ring color from `getScoreColor()` (existing function)
- Supplemental/topper badge uses D-136 teal color system
- Severity badge NOT shown in search results (only on ResultScreen)
- Font: system font (DM Sans loaded via expo-font, already in project)
- No emojis in production UI (D-084) — use Lucide or custom SVG icons for category chips
- Dark theme consistent with existing screens

### 8.3 Interaction States

- **Filter chip active:** Cyan border + translucent cyan background
- **Filter chip inactive:** Muted border, secondary text
- **Brand chip active:** Yellow/gold border + translucent gold background (different accent from form chips to visually separate)
- **Product row press:** Navigate to ResultScreen for that product
- **Search bar focused:** Cyan border glow
- **Loading:** Skeleton rows (3-4 placeholder rows with shimmer)
- **Pull-to-refresh:** Refresh scores + product list

### 8.4 Animations

Keep it minimal — performance matters with 19k products:
- Filter chip toggle: subtle scale + opacity (100ms)
- Brand picker: slide-up bottom sheet (or expand-in-place dropdown)
- Product list: no entry animations (FlashList handles recycling)

---

## 9. Edge Cases

| Case | Handling |
|---|---|
| Pet has no cached scores | Show loading state, trigger batch-score, poll for completion |
| Product has no `image_url` | Gray placeholder with form icon (kibble bag, can, etc.) |
| Brand is NULL on product | Show "Unknown Brand" in muted text |
| `product_form` is NULL | Product still appears in unfiltered view, excluded from form-specific filters |
| User switches pet mid-scroll | Reset scroll position, clear filters, re-query |
| 0 results for a filter combo | Empty state with suggestion to adjust filters |
| Text search returns 0 but filters would have results | Show "No results for '[query]'" with suggestion to clear search text |
| Network offline | Show cached results if available, otherwise offline error state |
| `target_species = 'all'` products | Include in results for both dog and cat pets |

---

## 10. Performance Targets

| Metric | Target |
|---|---|
| Initial load (cached scores exist) | < 800ms to first visible results |
| Filter change | < 400ms to updated results |
| Text search (debounced) | < 500ms after debounce |
| Scroll performance | 60fps (FlashList required) |
| Count badge load | < 300ms (single RPC call) |
| Memory | < 50MB for full product list in memory |

### 10.1 Optimization Notes

- **FlashList over FlatList** — mandatory at 9k+ items
- **Debounce text search** — 300ms to avoid hammering Supabase
- **Cache count badges** — fetch once per pet change, store in Zustand
- **Cache brand list** — fetch once per (species, category) pair
- **Don't re-fetch on sub-filter change** — if possible, fetch all daily food products for the pet and filter client-side. With ~5k products per species-category, this may be feasible in memory. Profile and decide.
- **Index check:** Ensure `products` has composite index on `(target_species, category, needs_review, is_vet_diet)` and `pet_product_scores` has index on `(pet_id, total_score DESC)`

---

## 11. Migration / RPC Required

### 11.1 New RPC Function

```sql
-- get_search_counts: returns filter badge counts for a species
CREATE OR REPLACE FUNCTION get_search_counts(p_species TEXT)
RETURNS JSON AS $$
  SELECT json_build_object(
    'daily_food', COUNT(*) FILTER (WHERE category = 'daily_food'),
    'treat', COUNT(*) FILTER (WHERE category = 'treat'),
    'dry', COUNT(*) FILTER (WHERE product_form = 'dry' AND category = 'daily_food' AND NOT COALESCE(is_supplemental, false)),
    'wet', COUNT(*) FILTER (WHERE product_form = 'wet' AND category = 'daily_food' AND NOT COALESCE(is_supplemental, false)),
    'freeze_dried', COUNT(*) FILTER (WHERE product_form = 'freeze_dried' AND category = 'daily_food' AND NOT COALESCE(is_supplemental, false)),
    'supplemental', COUNT(*) FILTER (WHERE COALESCE(is_supplemental, false) = true AND category = 'daily_food')
  )
  FROM products
  WHERE target_species IN (p_species, 'all')
    AND needs_review = false
    AND COALESCE(is_vet_diet, false) = false
    AND category != 'supplement';
$$ LANGUAGE sql STABLE;
```

### 11.2 Indexes (verify exist, add if missing)

```sql
-- Product filtering
CREATE INDEX IF NOT EXISTS idx_products_search
ON products (target_species, category, needs_review, is_vet_diet);

-- Score lookups
CREATE INDEX IF NOT EXISTS idx_pet_product_scores_search
ON pet_product_scores (pet_id, total_score DESC);

-- Text search (if ILIKE is too slow)
CREATE INDEX IF NOT EXISTS idx_products_name_trgm
ON products USING gin (name gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_products_brand_trgm
ON products USING gin (brand gin_trgm_ops);
```

Note: Trigram indexes require `CREATE EXTENSION IF NOT EXISTS pg_trgm;` — check if already enabled.

---

## 12. Files to Create/Modify

| File | Action | Description |
|---|---|---|
| `src/screens/SearchScreen.tsx` | **Rewrite** | Full screen replacement, paywall gate at top |
| `src/components/search/SearchUpsellScreen.tsx` | **Create** | Premium upsell screen for free users |
| `src/components/search/TopLevelToggle.tsx` | **Create** | Daily Food / Treats toggle |
| `src/components/search/FilterChipRow.tsx` | **Create** | Scrollable form + brand chips |
| `src/components/search/BrandPicker.tsx` | **Create** | Bottom sheet or dropdown for brand selection |
| `src/components/search/ProductRow.tsx` | **Create** | Single product result row with score ring |
| `src/components/search/SearchEmptyState.tsx` | **Create** | Empty/loading/error states |
| `src/components/PetPickerDropdown.tsx` | **Create** | Reusable pet selector (will also be used by Top Picks) |
| `src/services/searchService.ts` | **Create** | Supabase queries, count fetching, brand list |
| `src/stores/searchStore.ts` | **Create** | Zustand store for search state (filters, results, counts) |
| `supabase/migrations/022_search_rpc.sql` | **Create** | `get_search_counts` RPC + indexes |
| `src/utils/permissions.ts` | **Modify** | Add `canAccessSearch()` — returns `isPremium()` |

---

## 13. Testing Requirements

| Test | What to verify |
|---|---|
| Paywall gate | Free user sees upsell screen, premium user sees search UI |
| Filter exclusivity | Tapping Treats deselects Daily Food and clears sub-filters |
| Sub-filter toggle | Tapping active chip deselects it (returns to "all") |
| Species filtering | Dog pet only sees dog + all products, never cat-only |
| Supplement exclusion | `category = 'supplement'` products never appear |
| Vet diet exclusion | `is_vet_diet = true` products never appear |
| Score personalization | Same product shows different scores for different pets |
| Brand context | Brand picker only shows brands with products matching current filters |
| Count accuracy | Badge counts match actual query result counts |
| Text + filter combo | Text search respects active filters (AND, not OR) |
| Empty state | Shows when filters produce 0 results |
| Pet switch | Resets filters, updates counts, re-queries |
| Pagination | Loads more products on scroll, maintains sort order |

---

## 14. Open Questions for Steven

1. **Product row tap:** Navigate to full ResultScreen, or show a preview sheet?
2. **Search tab icon:** Keep magnifying glass, or change to something else now that it's a discovery tool?
3. **Tab label:** Keep "Search" or rename to "Discover" / "Browse"?
