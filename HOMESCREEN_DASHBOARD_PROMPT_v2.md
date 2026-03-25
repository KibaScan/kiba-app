# HomeScreen Dashboard — Build Prompt

## Context

HomeScreen.tsx currently has: Kiba header + "Scanning for [Pet Name]" badge, a settings gear icon, a "[Pet Name]'s Pantry" link card (navigates to Pantry tab), a big "0 Scans this week" count card, and a "Scan your first product" empty state. The screen is mostly dead space. We're turning it into a real dashboard.

This is M5 Polish scope. Read these files before starting:
- `src/screens/HomeScreen.tsx` (current implementation — you're rewriting this)
- `src/stores/useScanStore.ts` (has `recentScans: ScanRecord[]`, `weeklyCount`, `scanCache`)
- `src/types/index.ts` or `src/types/scan.ts` (find the `ScanRecord` interface — you need to know what fields it carries)
- `src/utils/constants.ts` (Colors, FontSizes, Spacing, SEVERITY_COLORS, getScoreColor)
- `src/types/navigation.ts` (for correct nav nesting)
- Check if a pantry store exists (`usePantryStore` or similar) — read it if it does
- Check if there's a scan service file (`src/services/scanService.ts` or similar)

## What You're Building

A ScrollView dashboard with this card stack, top to bottom:

### Keep Existing
- Header: "Kiba" left + "Scanning for [Pet Name]" badge right + settings gear — **don't touch this**

### Card 1: Recall Alert (conditional)
- **Only renders** when the active pet has pantry items where `product.is_recalled === true`
- Style: red left-border (3px), light red tint background (`${SEVERITY_COLORS.danger}15`), `warning-outline` icon
- Copy: "[N] recalled product(s) in [Pet Name]'s pantry"
- Tappable → navigate to Pantry tab
- If no pantry store exists, or no recalled products, or no pantry items at all → don't render. Don't crash.

### Card 2: Pantry Summary (replaces the current "[Pet Name]'s Pantry" link card)
- Upgrade the existing pantry card from a dumb nav link to a richer summary
- If pantry has items: show "[N] foods · [M] treats" count line, plus a row of small product image thumbnails (max 4, 32×32 rounded, with `+N` overflow badge if more than 4)
- If pantry is empty: keep the current behavior — "[Pet Name]'s Pantry" with "Start tracking [Pet Name]'s food and treats." subtitle and chevron
- Always tappable → navigate to Pantry tab

### Card 3: Recent Scans Section (replaces the big "0 Scans this week" card)
- **Data source:** `useScanStore((s) => s.recentScans)` — already sorted most-recent-first, max 50
- Section header row: "Recent Scans" title left + muted "[N] this week" subtitle right (using `weeklyCount`)
- Show last 5 scans as tappable rows

**Each scan row:**
- Left: product image thumbnail (40×40 rounded-8) — use `image_url` if available, else `cube-outline` icon in a gray circle
- Middle: brand (12px muted secondary) on top, product name (14px primary, 1 line truncated) below
- Right: score badge — "[X]%" text inside a small rounded pill, background color from `getScoreColor(score, false)`. If ScanRecord doesn't carry a score, show a `chevron-forward` instead.
- On press → navigate to Result screen with `productId` and `petId: activePetId`

**IMPORTANT — check the ScanRecord type first.** If it only carries IDs (product_id, pet_id) without display fields (product name, brand, score, image_url), you need to do one of these:
- **Option A (preferred):** Create a `getRecentScansWithProducts(petId: string, limit: number)` function in the scan service that queries Supabase: `scans` table joined to `products` on `product_id`, filtered by `pet_id`, ordered by `scanned_at DESC`, limited to 5. Return the joined data. Call this in a `useFocusEffect` on HomeScreen.
- **Option B:** If ScanRecord already has everything → just read from the store directly, no query needed.

If `recentScans` is empty, don't render this section at all.

### Card 4: Scan CTA (replaces the big empty state)
- Compact accent-colored button: `scan-outline` icon + "Scan a product"
- Navigates to Scan tab
- Only show when there IS other content above (scans exist or pantry has items)

### Empty State (fallback)
- Only show when recentScans is empty AND pantry is empty
- Keep the current look: camera-outline icon + "Scan your first product" + subtitle
- This is the zero-data state for brand new users

## Styling Rules

- Dark theme: `Colors.background`, `Colors.card`, `Colors.cardBorder` — use constants, never hardcode hex
- Cards: `backgroundColor: Colors.card`, `borderRadius: 16`, `borderWidth: 1`, `borderColor: Colors.cardBorder`, `padding: Spacing.md`
- Score colors: `getScoreColor(score, isSupplemental)` — import from ScoreRing or constants
- Severity colors: `SEVERITY_COLORS` from constants
- Zero emoji (D-084) — Ionicons only
- All font sizes from `FontSizes`, all spacing from `Spacing`
- Score framing: if you show a score, it should be just the number + "%" on the pill badge. The "[X]% match for [Pet Name]" full framing is for ResultScreen, not compact list items (pet context is already established by the header).

## Navigation

Check `src/types/navigation.ts` for the correct nesting. The tab navigator likely wraps stack navigators. Common patterns:
- Pantry tab: `navigation.navigate('PantryTab')` or similar
- Result screen: needs to navigate into the Scan stack → Result. Check how ScanScreen navigates to Result and mirror that pattern.
- Settings: check what the gear icon currently does and preserve it

## Error Handling

- No active pet → show "Add your pet" prompt, navigate to SpeciesSelect
- `recentScans` empty + pantry empty → empty state
- Network failure on scan query → fall back to store data, no crash
- Pantry store doesn't exist → show empty pantry card (the nav link version), don't crash
- Product with no `image_url` → gray circle with `cube-outline` icon fallback

## Don't Do These Things

- Don't touch the scoring engine
- Don't add paywall checks anywhere (those live ONLY in `src/utils/permissions.ts`)
- Don't use emoji (D-084)
- Don't add an appointment widget (deferred — medium confidence item)
- Don't import from files that don't exist — inspect the project tree first
- Don't make the empty state the dominant element when there IS data to show

## After Implementation

Run `npx jest --passWithNoTests` to verify nothing breaks. If you want, add a basic smoke test for HomeScreen rendering with empty state and with mock scan data — but working screen first, tests second.
