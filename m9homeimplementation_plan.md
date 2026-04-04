# HomeScreen Premium Overhaul — 8-Point UX Fix

Based on the expert teardown, this plan transforms the HomeScreen from "database query tool" to "personalized concierge engine." All changes are within M9 scope (UI Polish & Search).

## Design Mocks

````carousel
![Default HomeScreen — Top Picks carousel, carded Pantry, filled category cards, sub-filters below grid](/Users/stevendiaz/.gemini/antigravity/brain/c1e85f8d-4d14-4efa-9162-43029aef9657/homescreen_default_mock_1775265747590.png)
<!-- slide -->
![Search State — Score pills on results, 2-line product names, filled inactive cards, no chevrons](/Users/stevendiaz/.gemini/antigravity/brain/c1e85f8d-4d14-4efa-9162-43029aef9657/homescreen_search_mock_1775265758145.png)
````

---

## Proposed Changes

### Fix 1 — Move Sub-Filters Below Category Grid

**Problem:** Sub-filter chips render *above* the 2x2 category grid, breaking visual hierarchy (child spawns above parent, shoving grid down).

**Fix:** In `HomeScreen.tsx`, move the `<SubFilterChipRow>` block from its current position (between search bar and category grid) to *after* the `<View style={styles.categoryGrid}>` block.

#### [MODIFY] [HomeScreen.tsx](file:///Users/stevendiaz/kiba-antigravity/src/screens/HomeScreen.tsx)
- Lines 424-431: Move the `activeCategory && <SubFilterChipRow>` block
- New position: after line 452 (after `categoryGrid` closing `</View>`)
- Flow becomes: Search → Grid → Sub-filters → Results

---

### Fix 2 — Score Pills in Search Results

**Problem:** Live search results show blind chevrons — the user can't comparison-shop without tapping into each product.

**Fix:** Look up cached scores from `pet_product_scores` for each search result and render score pills instead of chevrons.

#### [MODIFY] [topMatches.ts](file:///Users/stevendiaz/kiba-antigravity/src/services/topMatches.ts)
- Extend `searchProducts()` to accept optional `petId` parameter
- When `petId` is provided, join against `pet_product_scores` to fetch `final_score` and `is_supplemental`
- Add `final_score: number | null` and `is_supplemental: boolean` to `ProductSearchResult` type

#### [MODIFY] [HomeScreen.tsx](file:///Users/stevendiaz/kiba-antigravity/src/screens/HomeScreen.tsx)
- Pass `activePetId` to `searchProducts()` call
- In the search result renderer, replace the `<Ionicons chevron-forward>` with a score pill (matching the existing `scorePill` style from recent scans)
- If `final_score` is null (uncached product), fall back to chevron

---

### Fix 3 — Sanitize Brand Pipe Delimiters

**Problem:** Raw `||` delimiters leak into brand text (e.g., "Milk-Bone||Purina Beneful").

**Fix:** Add a `sanitizeBrand()` utility that splits on `||` and joins with ` · ` (interpunct divider) or takes the first brand.

#### [MODIFY] [formatters.ts](file:///Users/stevendiaz/kiba-antigravity/src/utils/formatters.ts)
- Add `sanitizeBrand(brand: string): string` — `brand.split('||').map(b => b.trim()).join(' · ')`
- Interpunct join preserves data integrity — if a user searches "Beneful", the result must show Beneful in the brand text

#### [MODIFY] [HomeScreen.tsx](file:///Users/stevendiaz/kiba-antigravity/src/screens/HomeScreen.tsx)
- Import `sanitizeBrand` and apply to:
  - `scan.product.brand` in recent scans (line 628)
  - `item.brand` in search results (line 474)

> [!NOTE]
> The `||` pattern comes from bundle/variety products in the dataset. Using `split('||')[0]` shows the primary brand. This is a display-only fix — no data mutation.

---

### Fix 4 — Fix Score Pill Contrast

**Problem:** Low scores (red pills) use dark red background + dark red text → muddy, fails accessibility.

**Fix:** Use soft tinted backgrounds (15% opacity) with *bold, bright* text color. This is already partially correct for high scores but fails for reds.

#### [MODIFY] [HomeScreen.tsx](file:///Users/stevendiaz/kiba-antigravity/src/screens/HomeScreen.tsx)
- Score pills already use `{backgroundColor: \`${scoreColor}33\`}` (20% opacity) — change to `15` (≈9% hex opacity) for softer background
- Text color remains `scoreColor` but ensure `fontWeight: '700'` and the color is the bright variant (not dimmed)
- For scores displaying `0%`, use `#FF453A` (Apple's dark mode red) instead of the computed score color

> [!IMPORTANT]
> The existing `getScoreColor()` returns bright colors (#EF4444 for poor). The issue is `33` hex opacity on the background is too strong, making it muddy. Dropping to `1A` (~10%) or `15` (~8%) creates the premium "soft tint + bold text" effect.

---

### Fix 5 — Solid Fills for Category Cards & Chips

**Problem:** Category cards and sub-filter chips use hollow borders on dark backgrounds → looks like developer wireframes.

**Fix:** Two-state design:

| State | Background | Border |
|-------|-----------|--------|
| **Inactive** | `#1C1C1E` (solid fill) | `borderWidth: 2`, `borderColor: 'transparent'` |
| **Active** | `rgba(0,180,216,0.15)` (15% category tint) | `borderWidth: 2`, `borderColor: cat.tint` |

> [!WARNING]
> **Jitter prevention:** Both states MUST have `borderWidth: 2`. Toggling between `0` and `2` shifts the box model by 4px, causing the entire grid to jump. Use `borderColor: 'transparent'` on inactive to keep dimensions identical.

#### [MODIFY] [HomeScreen.tsx](file:///Users/stevendiaz/kiba-antigravity/src/screens/HomeScreen.tsx)
- `categoryCard` base style: set `borderWidth: 2`, `borderColor: 'transparent'`, change `backgroundColor` to `#1C1C1E`
- Active state: add `backgroundColor: \`${cat.tint}26\`` (15% alpha) + `borderColor: cat.tint` (borderWidth stays 2, no dimension shift)

#### [MODIFY] [SubFilterChipRow.tsx](file:///Users/stevendiaz/kiba-antigravity/src/components/browse/SubFilterChipRow.tsx)
- `chipInactive`: remove `borderWidth: 1` and `borderColor`, use solid `backgroundColor: '#1C1C1E'`
- `chipActive`: keep `Colors.accent` background (already solid)
- `filterIcon`: remove `borderWidth: 1` and `borderColor`, use solid `backgroundColor: '#1C1C1E'`

---

### Fix 6 — Wrap Pantry Row in a Card Container

**Problem:** Appointment gets a beautiful card container; Pantry row is naked text floating in the void.

**Fix:** Wrap the pantry row in the same card anatomy as the appointment row.

#### [MODIFY] [HomeScreen.tsx](file:///Users/stevendiaz/kiba-antigravity/src/screens/HomeScreen.tsx)
- `pantryRow` style: add `backgroundColor: Colors.cardSurface`, `borderRadius: 16`, `padding: Spacing.md`, `borderWidth: 1`, `borderColor: Colors.hairlineBorder`
- Migrate `appointmentRow` to use `Colors.cardSurface` instead of legacy `Colors.card` and `Colors.hairlineBorder` instead of `Colors.cardBorder`
- Both cards now follow the same Matte Premium card anatomy

---

### Fix 7 — Expand Product Names to 2 Lines

**Problem:** Product names truncated to 1 line, cutting off essential flavor/formula info.

**Fix:** Allow product title to wrap to 2 lines in all product list rows.

#### [MODIFY] [HomeScreen.tsx](file:///Users/stevendiaz/kiba-antigravity/src/screens/HomeScreen.tsx)
- Recent scan rows: change `numberOfLines={1}` to `numberOfLines={2}` on `scanRowName` (line 630)
- Search result rows: change `numberOfLines={1}` to `numberOfLines={2}` on `searchResultName` (line 477)

---

### Fix 8 — Build Top Picks Horizontal Carousel

**Problem:** No curated product recommendation section on the home screen default state.

**Fix:** Add a "Top Picks for [Pet Name]" horizontal scrolling carousel between the category grid + sub-filters and the appointment/pantry cards.

#### [NEW] [TopPicksCarousel.tsx](file:///Users/stevendiaz/kiba-antigravity/src/components/browse/TopPicksCarousel.tsx)
- New component: horizontal `FlatList` with `showsHorizontalScrollIndicator={false}`
- Card design: `width: 160`, product image (80×80), brand (gray, sanitized), product name (2 lines, white), score pill at bottom
- Card surface: standard `Colors.cardSurface` with `borderRadius: 12`
- Width 160 on ~390px screen = 2 full cards + 20% peek of 3rd card — this "peek" subconsciously signals swipeability
- Shows up to 10 items from `fetchCategoryTopPicks(petId, activeCategory ?? 'daily_food', activeSubFilter, species, 10)`
- Defaults to Daily Food top picks if no category is selected
- Shows section header: "Top Picks for [Pet Name]" with "See All ›" link
- "See All" navigates to `CategoryBrowseScreen` for full list
- Renders only when not in search mode
- **Zero-state (empty cache):** Renders a full-width CTA card instead of the carousel:
  - Title: "Unlock [Pet Name]'s Top Picks"
  - Subtitle: "Scan their current food to initialize the algorithm."
  - CTA: Large cyan `[ Scan a Product ]` button → navigates to Scan tab
  - This turns empty cache into the most powerful onboarding hook

#### [MODIFY] [HomeScreen.tsx](file:///Users/stevendiaz/kiba-antigravity/src/screens/HomeScreen.tsx)
- Import and render `<TopPicksCarousel>` in the non-search content section
- Position: after sub-filter chips (Fix 1 moved them below grid), before appointment card
- Pass `petId`, `activePet`, `activeCategory`, `activeSubFilter`, `species`
- Carousel re-fetches when category/sub-filter changes (via `useEffect`)

#### [MODIFY] [categoryBrowseService.ts](file:///Users/stevendiaz/kiba-antigravity/src/services/categoryBrowseService.ts)
- `fetchCategoryTopPicks()` already exists as a stub — no service changes needed

---

## Legacy Token Migration (bundled)

While modifying `HomeScreen.tsx`, also fix these legacy tokens:

| Location | Legacy | Replace With |
|----------|--------|-------------|
| `searchBar` (line 751) | `Colors.card` | `Colors.cardSurface` |
| `searchBar` (line 758) | `Colors.cardBorder` | `Colors.hairlineBorder` |
| `appointmentRow` (line 844) | `Colors.card` | `Colors.cardSurface` |
| `appointmentRow` (line 848) | `Colors.cardBorder` | `Colors.hairlineBorder` |
| `searchResultImagePlaceholder` (line 812) | `Colors.card` | `Colors.cardSurface` |
| `scanRowImagePlaceholder` (line 947) | `Colors.card` | `Colors.cardSurface` |

---

## Resolved Questions

- **Top Picks empty state:** Option A (weaponized). Full-width CTA card: "Unlock [Pet]'s Top Picks" + "Scan a Product" button. Never show generic unscored lists — that dilutes the personalized algorithm value prop.
- **Brand sanitization:** Interpunct join (`' · '`). First-brand-only would break search trust — user searches "Beneful" and sees a card saying only "Milk-Bone".
- **Grid jitter:** Both active/inactive states use `borderWidth: 2` — inactive with `borderColor: 'transparent'` to prevent 4px box model shift.

---

## Verification Plan

### Automated Tests
- Run `npm test` to verify no regressions (1,320 tests across 61 suites)
- Verify `sanitizeBrand` utility with unit test: `'Milk-Bone||Purina Beneful'` → `'Milk-Bone'`

### Manual Verification (iOS Simulator)
- **Default state:** Verify sub-filters render below grid, Top Picks carousel scrolls horizontally, Pantry has card container
- **Active search:** Verify score pills appear on results (replacing chevrons), 2-line product names visible, no `||` in brand text
- **Category toggle:** Verify solid fills (no wireframe borders), active state has subtle tinted background
- **Score contrast:** Verify low-score red pills are readable (white or bright text on soft tint)
- **Empty states:** Verify Top Picks carousel handles empty cache gracefully
