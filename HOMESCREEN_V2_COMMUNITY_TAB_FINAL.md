# HomeScreen v2 + Community Tab — Final Spec

## Decisions (Confirmed)
- D-055: Search remains premium-only (now on HomeScreen)
- Category browse: also premium-gated
- Tab name: "Community" (aligns with ROADMAP M8–M10)
- Appointments: kept on HomeScreen

---

## Part 1: HomeScreen v2

### Layout (top to bottom)

**1. Header** — "Kiba" left + "Scanning for [Pet Name]" badge right. No changes.

**2. Recall Alert (conditional)** — Only renders when active pet has recalled pantry items. Red left-border, `warning-outline` icon. Tappable → Pantry tab. Highest priority card, always first.

**3. Search Bar**
- Full-width: magnifying glass icon + "Search pet food products..."
- Premium-gated (D-055): free users tap → paywall `{ trigger: 'search' }`
- Premium users: keyboard opens, live search via the `.ilike()` direct query (already built by Claude Code)
- Results render inline below search bar, replacing category/scan content while active
- Clearing search restores normal Home layout

**4. Browse Categories**
- Horizontal scroll of tappable category cards
- Cards: "Daily Food" (`nutrition-outline`, cyan), "Treats" (`fish-outline`, amber), "Supplements" (`medical-outline`, green)
- Premium-gated: free users tap → paywall `{ trigger: 'search' }` (same gate as search — this IS search by category)
- Premium users: tap → filtered product list screen or inline results filtered by category
- Style: solid fill cards (`Colors.card`), rounded corners, icon above label, ~120px wide

**5. Appointment Row** — Keep existing. "[Pet Name]'s vet visit" + date + chevron. Already implemented.

**6. Scan Counter + Recent Scans**

Section header: "Recent Scans" left, scan counter right.

**Free users — scan counter:**
- Display: "X/5 this week" pill badge
- Colors: green (3-5 remaining), amber (1-2 remaining), red (0 remaining)
- Tappable info tooltip: "Scans refresh on a rolling 7-day window. Your next scan unlocks [relative time]."
- Tooltip calculates from the oldest scan timestamp in the rolling window

**Premium users:**
- Counter hidden. Just muted "[N] this week" subtitle (current behavior).

**Scan history rows (max 5):**
- Same as current: product image (40×40), brand, name, score pill
- Tappable → ResultScreen
- Empty state: muted camera icon + "Scan your first product" (compact, not a giant card)

**7. Pantry Link (minimal)**
- Single compact row: pet avatar (24px) + "[Pet Name]'s Pantry" + "X foods · Y treats" + chevron
- Tappable → Pantry tab
- Empty: "[Pet Name]'s Pantry · Start tracking" + chevron
- Not a card — a slim navigation row. Pantry tab is the real pantry.

### Removed from Home
- ❌ "Scan a product" CTA button (raised scan button is right there)
- ❌ Large pantry card with thumbnails (replaced by slim link)
- ❌ Standalone "0 Scans this week" card (absorbed into section header)

---

## Part 2: Community Tab (replaces Search tab)

### Tab Bar
```
[ Home ]  [ Community ]  ( SCAN )  [ Pantry ]  [ Me ]
   ⌂       people-outline  raised     ◫         ○
```

Icon: `people-outline`. Label: "Community".

### CommunityScreen — Near-Term (ship now as placeholder)

**Header:** "Community"

**Section 1: Kiba Kitchen (D-167)**
- Card with `restaurant-outline` icon + "Kiba Kitchen"
- Teaser state (no published recipes yet): "Homemade pet food recipes, scored by our engine. Coming soon."
- Optional: "Submit a recipe" link → future submission form or waitlist
- When recipes exist (M8+): horizontal scroll of recipe cards with photo, title, score badge, supplemental indicator

**Section 2: Blog / Articles**
- Card with `newspaper-outline` icon + "Pet Health & Nutrition"
- Teaser state: "Expert articles on pet food, health, and nutrition. Coming soon."
- When posts exist: vertical list of post cards (thumbnail, title, excerpt, read time)

**Section 3: Kiba Index Preview (M8 — Taste Test + Tummy Check)**
- Card with `thumbs-up-outline` icon + "Kiba Index"
- Teaser: "Rate your pet's food — Taste Test and Tummy Check ratings from real pet owners. Coming soon."
- When live (M8): shows trending products by community rating, link to vote on products you've scanned

**Section 4: Symptom Detective Preview (M9)**
- Card with `pulse-outline` icon + "Symptom Detective"
- Teaser: "Track daily symptoms and detect ingredient sensitivities over time. Coming soon."
- When live (M9): entry point to daily logging, calendar view link

**Section 5: Community Contributions (M10)**
- Card with `people-outline` icon + "Help Grow Kiba"
- Teaser: "Scanned a product we don't have? Your contributions help every pet owner."
- When live (M10): contribution stats, XP balance, leaderboard link, submit product CTA
- The M3 database miss flow (D-091) already captures contributions — this surfaces them as a community feature

### CommunityScreen — Long-Term Vision (M8–M10+)

As features ship, the teasers become real:
- **M8:** Kiba Index live (vote on scanned products, see aggregate ratings on ResultScreen)
- **M9:** Symptom Detective live (daily logger, calendar heatmap, pattern alerts)
- **M10:** XP engine, leaderboard, moderation queue, contributor badges
- **D-167:** Kiba Kitchen with scored recipes, portion guidance, vet disclaimer
- **Blog:** Editorial content for SEO + retention
- **Future:** Pet videos with uploader credit (lowest priority)

---

## Implementation Split (3 Prompts)

### Prompt 1: HomeScreen v2 — Search + Categories + Scan Counter
**Scope:** Modify `src/screens/HomeScreen.tsx`
- Add search bar with premium gate (reuse search logic from SearchScreen — the `.ilike()` query, debounce, result rendering)
- Add browse category cards (horizontal scroll, premium-gated)
- Replace scan counter with "X/5 remaining" for free users (color-coded pill + info tooltip with rolling window refresh time)
- Hide counter for premium users, show muted "[N] this week"
- Slim down pantry card to a single compact nav row
- Remove "Scan a product" CTA button
- Keep appointment row and recall alert
- Read `src/utils/permissions.ts` for `canSearch()` and scan limit logic
- Read `src/stores/useScanStore.ts` for weeklyCount and scan timestamps

### Prompt 2: Community Tab — Tab Rename + Placeholder Screen
**Scope:** New file + navigation config
- Create `src/screens/CommunityScreen.tsx` with placeholder sections (Kiba Kitchen, Blog, Kiba Index, Symptom Detective, Contributions — all teasers with "Coming soon")
- Rename Search tab to Community in tab navigator config (`src/navigation/` — find the tab navigator)
- Change tab icon from `search-outline` to `people-outline`
- Change tab label from "Search" to "Community"
- Style CommunityScreen: dark background, ScrollView, section cards with icons and teaser text
- Each section card should have a distinct accent color matching its future identity (restaurant=warm, blog=neutral, index=orange/blue per D-032, symptoms=pulse-red, contributions=accent)

### Prompt 3: Search Migration Cleanup
**Scope:** Wire search from Home, clean up old SearchScreen
- Move search store logic (searchResults, searchLoading, executeSearch) to be callable from HomeScreen
- Ensure the search bar on Home uses the same service/store as the old SearchScreen
- Either delete `SearchScreen.tsx` or keep it as a dead file (can clean up later)
- Verify navigation: tapping a search result on Home navigates correctly to ResultScreen in the Scan stack
- Verify category card taps work (filtered product list or paywall)
- Test: free user taps search → paywall. Premium user searches "Pedigree" → results. Tap result → ResultScreen scores it.

---

## Files Modified
- `src/screens/HomeScreen.tsx` — major rewrite (Prompt 1)
- `src/screens/CommunityScreen.tsx` — new file (Prompt 2)
- Tab navigator config — rename tab + swap screen (Prompt 2)
- `src/types/navigation.ts` — update tab param list (Prompt 2)
- `src/screens/SearchScreen.tsx` — deprecated or deleted (Prompt 3)

## Files NOT Modified
- Scoring engine — zero changes
- `src/utils/permissions.ts` — already has canSearch(), scan limit logic
- `src/screens/ResultScreen.tsx` — navigation target, no changes
- `src/services/topMatches.ts` — search service already built, just called from new location
