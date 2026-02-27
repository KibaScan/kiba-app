# Kiba — Decision Log

> Single source of truth for every product, technical, and strategic decision.
> Updated: February 27, 2026 (evening — QA review applied: D-033, D-065, D-090, D-093, D-097, D-098, D-100, D-104, D-107)

---

## How to Read This Document

Each decision has a status:

- **LOCKED** — Decided. Do not revisit unless user testing proves it wrong.
- **ACTIVE** — Decided and currently being implemented.
- **DEFERRED** — Decided to postpone. Includes the trigger condition for revisiting.
- **REJECTED** — Considered and explicitly killed. Includes rationale so it doesn't resurface.
- **OPEN** — Needs a decision before the relevant milestone.

---

## 1. Brand & Identity

### D-001: App Name → Kiba
**Status:** LOCKED
**Date:** Feb 19, 2026
**Decision:** Rename from Clearbowl to Kiba.
**Rationale:** "Kiba" means "fang" in Japanese. Punchy two-syllable name with hard consonants. Passes the word-of-mouth test cleanly (spell it after hearing it once). Works across pet food, treats, supplements, and future grooming/cosmetics expansion — unlike "Clearbowl" which only maps to food.
**Rejected alternatives:**
- Fura — too similar to Yuka phonetically, reads as derivative
- Vura — sounds pharmaceutical, no memorability hook
- Zoko — playful but undercuts credibility for a health tool

### D-002: Domain → kibascan.com
**Status:** LOCKED
**Date:** Feb 19, 2026
**Decision:** Register kibascan.com as primary domain.
**Rationale:** "scan" suffix communicates core function, strong SEO for "pet food scanner" queries, avoids double-extension confusion of alternatives like kiba.us.com.
**Registrar:** Porkbun ($11.08/yr .com, flat renewal pricing, no upsells).
**Future:** Acquire kiba.com if product succeeds. kiba.app is viable alternative (~$15-17/yr) but may already be registered (Kiba Inu crypto token, defunct Kiba finance app).

### D-003: Trademark Filing
**Status:** OPEN — Must file before public launch
**Decision:** File "Kiba" or "KibaScan" via USPTO, ~$250-350 single class.
**Risk:** Existing Kiba Inu crypto token. Monitor trademark class overlap.

---

## 2. Scoring Engine

### D-010: Category-Adaptive Weighting
**Status:** LOCKED
**Date:** Feb 19, 2026
**Decision:** Different product categories get different scoring formulas.

| Category | Weights | Rationale |
|----------|---------|-----------|
| Daily Food (kibble, wet, raw) | 55% Ingredient Quality / 30% Nutritional Profile / 15% Formulation Completeness | Ingredients anchor prevents Purina Loophole. GA data often missing, capping reliability at 30%. |
| Treats | 100% Ingredient Quality | Treats aren't nutritionally complete by design. Caloric density handled by Treat Battery separately. |

**Why NOT 50/35/15:** If Guaranteed Analysis weighted >30%, cheap manufacturers gaming macros with corn gluten meal + unnamed animal fat could mathematically overpower ingredient red flags and score 85/100. 55% keeps ingredient quality as the undeniable anchor.
**Why NOT 85/15 for treats:** 15% based on kcal density creates "double jeopardy" — a 50-kcal dental chew isn't inherently worse than a 2-kcal training treat. Treat Battery already handles caloric limits mathematically via RER. Keep scoring engine pure.

### D-011: Three-Layer Scoring Architecture
**Status:** LOCKED
**Date:** Feb 19, 2026
**Decision:**
- **Layer 1 — Base Score:** Position-weighted ingredient scoring + GA vs AAFCO + formulation quality, with category-adaptive weights
- **Layer 2 — Species Rules:** Dog-specific (DCM advisory, taurine mitigation) and cat-specific (carb penalty, UGT1A6 enzyme, mandatory taurine) modifiers
- **Layer 3 — Personalization:** Pet-specific adjustments (weight, breed, age, allergies, activity level). Neutral if no conflicts.

All three layers must be independently testable. Species rules never share between dogs and cats.

### D-012: Unnamed Species Penalty
**Status:** LOCKED
**Date:** Feb 19, 2026
**Decision:** −2 points per unnamed fat or protein source in Ingredient Quality score.
**Triggers:** Generic AAFCO terms like "Poultry Fat", "Animal Fat", "Fish Meal", "Meat Meal", "Meat By-Products" — any fat or protein without species identification.
**Rationale:** Unnamed sourcing signals variable supply chains (cheapest available that week). Critical for allergy management — dogs with chicken allergies can't determine if "Poultry Fat" is safe. Also a transparency/quality signal.
**Source:** AAFCO Definitions 9.3 (Poultry Fat), 9.14 (Fish Meal), 2023 ed.

### D-013: DCM Advisory (Dogs Only)
**Status:** LOCKED
**Date:** Feb 19, 2026
**Decision:** −8% penalty for grain-free formulas with 3+ legume/potato sources in top 7 ingredients. +3% mitigation if both Taurine AND L-Carnitine are supplemented.
**Net effect:** −5% when both conditions met, −8% when no mitigation.
**Source:** FDA Center for Veterinary Medicine — DCM Investigation (2019, updated 2024).

### D-014: Feline Carb Overload Penalty
**Status:** LOCKED
**Date:** Feb 19, 2026
**Decision:** −15% for 3+ high-glycemic carbs in top 5 positions for cat products.
**Rationale:** Cats lack hepatic glucokinase enzyme, making them obligate carnivores with poor carbohydrate metabolism.
**Source:** Journal of Animal Physiology (2012).

### D-015: Ingredient Splitting Detection
**Status:** LOCKED
**Date:** Feb 19, 2026
**Decision:** UI flag (no direct score penalty) when 2+ derivatives of the same source ingredient are detected.
**Implementation:** `cluster_id` field in Supabase `ingredients_dict` table. Both "Dried Peas" and "Pea Starch" get `cluster_id = 'legume_pea'`. Detection via `GROUP BY cluster_id HAVING count >= 2`. No string-matching at runtime — prevents false positives ("Peach" flagged for "Pea").
**Origin:** Gemini feedback — this was its one genuinely useful contribution. The `cluster_id` approach is correct.

### D-016: Dry Matter Basis Conversion
**Status:** LOCKED
**Date:** Feb 19, 2026
**Decision:** Scoring engine MUST convert wet food macros to DMB before calculating the 30% nutritional bucket.
**Formula:** `Dry Matter % = (Guaranteed % / (100 - Moisture %)) × 100`
**Example:** Wet food showing "9% Crude Protein" with 78% moisture → DMB protein = 40.9% (well above AAFCO 18% minimum). Without conversion, every wet food scores catastrophically wrong.
**UI:** Conditionally render "Adjusted for Dry Matter Basis" disclaimer on wet food results. Kibble (≤10% moisture) shown as-fed with note "no DMB conversion needed."

### D-017: Missing GA Fallback
**Status:** LOCKED
**Date:** Feb 19, 2026
**Decision:** When GA panel unavailable, reweight to ~78% Ingredient Quality / 22% Formulation Completeness. Show "Partial — nutritional data unavailable" badge. Prompt user to photograph GA panel (contribution prompt, not error state).

### D-018: Position-Weighted Scoring — Proportion vs Presence
**Status:** LOCKED
**Date:** Feb 19, 2026
**Decision:** Two classes of ingredient concerns with different position behavior:
- **Proportion-based** (fillers, unnamed fats, low-quality meals): Position 1-5 = full penalty, 6-10 = 30% reduction, 11+ = 60% reduction. May drop one severity tier.
- **Presence-based** (artificial colorants, BHA/BHT/ethoxyquin, allergens): Full penalty regardless of position. Being there at all is the concern.
- `position_reduction_eligible` flag set manually in ingredient database. Vet auditor must sign off.

### D-019: Brand-Blind Scoring
**Status:** LOCKED — Non-negotiable
**Decision:** Scoring engine has zero awareness of brand names. No brand-specific modifiers. No brand-specific bonuses or penalties. Score is determined entirely by ingredients, GA, formulation, and species rules. This is both the ethical choice and the legal protection.

### D-020: Affiliate Isolation from Scoring
**Status:** LOCKED — Non-negotiable
**Decision:** `affiliate_links` JSONB column on products table is completely invisible to the scoring engine. Hard architectural separation, not policy. Scoring functions never import, query, or reference affiliate data. Buy buttons hidden entirely for products scoring below 50 — replaced with Safe Swap CTAs.

---

## 3. User Interface

### D-030: Singleton Modal Pattern
**Status:** LOCKED
**Date:** Feb 19, 2026
**Decision:** One modal DOM element per screen, data dictionary injected via JavaScript on tap. Scales to 500+ ingredients with zero DOM bloat.
**Action required:** Refactor cat V3.1 from 12+ separate modal elements to singleton pattern (already done in dog V3).

### D-031: Ingredient Sort Order → Worst to Best
**Status:** LOCKED
**Date:** Feb 19, 2026
**Decision:** Full ingredient list sorted by severity (⚠ Flagged → ⚡ Caution → ○ Neutral → ✓ Good), NOT by label position. Label position numbers preserved as metadata on each row so users can cross-reference the physical package.

### D-032: Kiba Index (Community Feedback)
**Status:** LOCKED
**Date:** Feb 19, 2026
**Decision:** Side-by-side cards replacing traditional star ratings:
- **Taste Test** (orange): "Did your dog like this food?" → Loved it / Picky / Refused
- **Tummy Check** (blue): "How was digestion?" → Perfect / Soft stool / Upset
**Rationale:** Behavioral feedback ("my dog refused this") is more actionable than 1-5 stars. Tummy Check validates scoring engine concerns (e.g., high soft-stool % on grain-free legume-heavy formulas) without us editorializing.

### D-033: Symptom Detective
**Status:** LOCKED
**Date:** Feb 19, 2026
**Decision:** 5-icon daily logger using SF Symbols (Itchy, Vomit, Loose, Low-E, Great!). Pattern detection algorithm flags ingredient-allergy correlations after 2-4 weeks of data. More relevant for daily food (eaten every day) than treats.
**Updated Feb 27, 2026:** Changed "5-emoji" to "5-icon (SF Symbols)" for D-084 compliance. Zero emoji policy applies to all UI elements including symptom logging.

### D-034: Ask AI Button → Removed
**Status:** REJECTED — Permanently removed
**Date:** Feb 19, 2026
**Decision:** AI-generated pet health advice creates legal exposure regardless of disclaimers. A disclaimer on every response creates friction AND still carries liability. Replaced with Compare button (side-by-side product comparison). Zero legal risk, high utility, drives more scans (engagement loop).

### D-035: Compare Button
**Status:** LOCKED
**Date:** Feb 19, 2026
**Decision:** Replaced Ask AI. Side-by-side comparison with another scanned product. Drives engagement loop (more scans = more data = better recommendations).

### D-036: Recall Check Badge
**Status:** LOCKED
**Date:** Feb 19, 2026
**Decision:** "✓ No Recalls Found" green chip in stat row. Boolean from FDA recall API. Zero engineering cost, massive trust signal. Premium upsell hook: "Get instant Recall Siren alerts."

### D-037: Loading Terminal Messages
**Status:** LOCKED
**Date:** Feb 19, 2026
**Decision:** 6-step sequence masking 1.5s perceived latency:
1. "Parsing [N] ingredients..."
2. "Evaluating GA panel ([protein]% protein, [fat]% fat)..."
3. "Checking FDA recall database..."
4. "Applying [Species] Species Rules..."
5. "Calculating [weight formula] weighted score..."
**Purpose:** Tells user engine is doing real work across all three scoring layers. Builds confidence.

### D-038: AAFCO Nutrition Panel
**Status:** LOCKED
**Date:** Feb 19, 2026
**Decision:** Expandable section (labeled "30% of score") with colored progress bars for Protein, Fat, Fiber, Moisture vs AAFCO minimum thresholds. Bonus nutrient grid for DHA, Omega-3, Taurine, L-Carnitine, Zinc, Probiotics where present. Life stage matching (AAFCO All Life Stages vs Adult Maintenance vs Growth).

### D-039: Ingredient Splitting Detection Card
**Status:** LOCKED
**Date:** Feb 19, 2026
**Decision:** Dark navy card (same editorial weight as Flavor Deception card) with visual pill equation showing split ingredients and their combined likely position. Designed for shareability — this is the "aha moment" that drives TikTok virality.

---

## 4. Data & Infrastructure

### D-040: UPC Schema → Junction Table
**Status:** LOCKED
**Date:** Feb 19, 2026
**Decision:** `product_upcs` table with UPC as PRIMARY KEY referencing product_id. NOT TEXT[] array on products table. btree index, O(log n) lookup.
**Rationale:** TEXT[] with GIN indexing is slower and more complex. Junction table is easier to extend and normalize. Each UPC variant (5lb bag, 30lb bag) gets its own row pointing to the same product_id.

### D-041: Product Images → Named by product_id
**Status:** LOCKED
**Date:** Feb 19, 2026
**Decision:** Store images as `{product_id}.webp` in Supabase storage, NOT by UPC string. All UPC variants for the same product resolve to one image file — no 404s.

### D-042: Data Source Field
**Status:** LOCKED
**Date:** Feb 19, 2026
**Decision:** Product source field uses `'scraped' | 'community' | 'curated'` — NOT 'opff' or 'apify'. Source-agnostic in case scraping tool changes.

### D-043: LLM Nutritional Refinery Pipeline
**Status:** LOCKED
**Date:** Feb 19, 2026
**Decision:** Lightweight LLM step (Claude Haiku / GPT-4o-mini) converts raw scraped GA text blocks into structured JSON. Run once at data ingestion, store output, never re-run per user scan.
**Cost:** ~$0.125 for 5,000 products. Effectively free.
**Validation:** Python validates schema compliance and range plausibility before DB insertion. Out-of-range values flagged for manual review, not rejected.
**UI disclaimer:** "Nutritional data extracted from label — verify with manufacturer for precision use" when `nutritional_data_source = 'llm_extracted'`.

### D-044: Formula Change Detection
**Status:** LOCKED
**Date:** Feb 19, 2026
**Decision:** Store `ingredients_hash` (hash of raw ingredients string) on products table. Monthly re-scrape diffs against stored hash. Mismatch triggers: score marked "under review", stale badge shown, automatic re-score, push notification to pantry users if score change >15 points.
**Schema additions:** `ingredients_hash TEXT`, `last_verified_at TIMESTAMPTZ`, `formula_change_log JSONB`.

### D-045: Ingredient Dictionary — cluster_id
**Status:** LOCKED
**Date:** Feb 19, 2026
**Decision:** `cluster_id` field on `ingredients_dict` table for splitting detection. Example: "Dried Peas" and "Pea Starch" both get `cluster_id = 'legume_pea'`. Detection via `GROUP BY cluster_id HAVING count >= 2`.
**Origin:** Gemini feedback (one of the only genuinely useful contributions).

### D-046: Ingredient Description — Species-Agnostic Base
**Status:** LOCKED
**Date:** Feb 19, 2026
**Decision:** `base_description` field is species-agnostic. Species context appended at render time from separate `cat_context` and `dog_context` fields. Never bake species references into the base description.

---

## 5. Monetization & Business

### D-050: Pricing Structure
**Status:** LOCKED
**Date:** Feb 19, 2026

| Tier | Price | Notes |
|------|-------|-------|
| Free | 5 scans/week (rolling) | Core scan loop — hooks users before any wall |
| Annual | $24.99/year (~$2.08/mo) | Primary conversion target. Low friction, anti-churn anchor |
| Monthly | $5.99/month | For users unwilling to commit upfront |

**Rationale:** Yuka charges $10/year at 80M users — that math doesn't work at launch scale. Kiba's stronger feature set (recall alerts, Treat Battery, species intelligence) justifies higher pricing. Annual subscribers churn at 3-5× lower rates than monthly.

### D-051: Paywall UX Rules
**Status:** LOCKED — Non-negotiable
**Date:** Feb 19, 2026
**Rules:**
1. Lead with annual in all paywall UI — show monthly as the "pay more" option
2. Frame around pet's lifespan: "About $2/month to protect Buster for a full year"
3. 5 value-triggered paywall moments ONLY — no generic onboarding paywall
4. Never show a paywall before the user has experienced a score result
5. Paywall logic lives ONLY in `src/utils/permissions.ts` — never scattered

### D-052: Five Paywall Trigger Moments
**Status:** LOCKED
**Date:** Feb 19, 2026

| Trigger | Copy |
|---------|------|
| 6th scan in a week | "You've used your 5 free scans this week. Go unlimited for $24.99/year." |
| Second pet profile | "Multi-pet households need Premium. Add all your pets!" |
| First safe swap tap | "Find healthier alternatives for your pet." |
| Recall alert signup | "Get instant alerts if any product you've scanned is recalled." |
| Search by name | "Search any product without scanning. Find scores for products you're considering online." |

**Note:** Search by product name (text lookup, not barcode) is a premium feature. Free users must scan barcodes. This gates a power-user behavior that signals high intent — these users convert well. Compare feature (side-by-side) is also premium but triggered organically from results, not a standalone paywall moment.

### D-053: Affiliate Architecture — Amazon Compliance
**Status:** LOCKED
**Date:** Feb 19, 2026
**Decision:**
- Chewy: Show estimated price with label "View on Chewy (Est. ~$45.99)" — labeled as estimate, compliant
- Amazon: "Check Current Price on Amazon" — intentionally hides price per Amazon Associates TOS
- FTC disclosure auto-renders below both buttons
- Buy buttons hidden entirely for products scoring <50 — replaced with Safe Swap CTAs
- Register iOS and Android app URLs in Amazon Associates dashboard

### D-054: RevenueCat SDK → Not at M0
**Status:** LOCKED
**Date:** Feb 19, 2026
**Decision:** Do NOT install `react-native-purchases` at M0. Paywall boundary not yet defined. Install at M3-M4 when premium features are being built. Prevents refactoring.

### D-055: Search by Product Name → Premium Feature
**Status:** LOCKED
**Date:** Feb 17, 2026
**Decision:** Text-based product search (find scores without scanning a barcode) is a premium-gated feature. Free users must scan barcodes physically.
**Rationale:** This was a contested decision. Search by name is a power-user behavior — users researching products online before buying, comparing options they don't have in hand. These users have high purchase intent and convert well to premium. Gating it creates a natural paywall moment: user taps the search bar → "Search any product without scanning. Upgrade to find scores for products you're considering online." Also creates a clean free/premium boundary: free = scan what's in front of you, premium = search anything in the database.
**Origin:** Competitor analysis (Pawdi has search; Pet Food Wizard is web-search-only). Discussed during roadmap vs competitor comparison session.

---

## 6. Treat Battery

### D-060: RER Base Formula
**Status:** LOCKED
**Decision:** `RER = 70 × (body weight in kg) ^ 0.75`. Both dogs and cats. Treat budget = 10% of DER (veterinary standard).
**Source:** Merck Veterinary Manual / AAHA Nutritional Assessment Guidelines.

### D-061: Goal Weight Logic
**Status:** LOCKED
**Decision:** For weight loss, RER calculated using goal weight — not current weight. This creates the caloric deficit. Goal weight field activates automatically when `goal_weight < current_weight`. Premium-gated feature.

### D-062: Cat Weight Loss — Hepatic Lipidosis Guard
**Status:** LOCKED — Critical safety
**Decision:** App calculates implied weekly loss rate from current to goal weight. If >1% body weight/week, warn before saving goal. One-time advisory whenever weight loss goal is set for a cat: "Rapid weight loss in cats can cause serious liver complications..." This is a liability shield. Must be reviewed by vet auditor before shipping.

### D-063: Geriatric Cat Calorie Inflection
**Status:** LOCKED
**Decision:** Cats 12+ years need MORE calories (1.4-1.6× RER), not fewer, due to sarcopenia. Do not linearly reduce calories with age for cats. This is counterintuitive and must be handled correctly.

### D-064: life_stage Derivation
**Status:** LOCKED
**Decision:** Derived automatically from age + species + breed size. Stored explicitly on pet profile. Never ask users to select manually. Recalculated on birthday or weight update.

### D-065: Pantry Feeding Calculations & Bag/Pack Countdown
**Status:** LOCKED
**Date:** Feb 19, 2026 (Updated Feb 25, 2026 — shared pantry support)
**Decision:** Pantry items display daily feeding amount and countdown to empty. Calculation adapts to three serving formats:

**Format 1 — Bulk (kibble, bulk treats):**
- User inputs bag size at add-to-pantry
- Cups/day = DER ÷ kcal_per_cup (from product GA)
- Days remaining = (bag_weight → total_cups) ÷ cups_per_day
- Display: "Feed: 2.3 cups/day · 22 lb bag · ~21 days remaining"
- Requires: kcal_per_cup in product data. If missing, show kcal/day only.

**Format 2 — Unit count (wet pouches, single-serve sticks, supplement chews):**
- User inputs pack/case quantity at add-to-pantry
- Units/day = DER ÷ kcal_per_unit (or vet-recommended dosage for supplements)
- Units remaining = pack_count − (units/day × days_since_added)
- Display: "1 pouch/day · 11 of 24 pouches remaining"

**Format 3 — Cans (wet food bought individually or in cases):**
- User inputs quantity purchased
- Cans/day calculated from DER ÷ kcal_per_can
- Display: "2 cans/day · 8 cans remaining"

**Shared pantry — multi-pet consumption:**
A single pantry item (one physical bag/case) can be assigned to multiple pets. When shared, the countdown sums all assigned pets' daily consumption rates.

- Data model: many-to-many between `pantry_items` and `pets` (not one-to-one)
- At add-to-pantry: multi-select of active pets with checkmarks. Defaults to active pet.
- Combined rate: sum of each pet's cups/day (or units/day)
- Display: "Shared by Buster & Milo · 3.7 cups/day combined · ~13 days remaining"
- If a pet is removed from the household or unassigned from the item, depletion rate recalculates automatically

**Edge cases:**
- Same brand, different formulas (puppy vs adult): separate pantry items — same brand ≠ same bag
- Shared treats: each pet's allocation derived from their individual Treat Battery budget (D-060). Combined consumption = sum of per-pet treat counts.
- One pet on a diet (goal weight active, D-061): that pet's consumption uses goal weight DER, not current weight DER

**Auto-detection:** Product category (dry/wet/treat/supplement) determines default serving_format. User can override.

**Mixed-feeding proportion (added Feb 27, 2026):**
When adding a daily food to the pantry, a `diet_proportion` slider (10% to 100%, default 100%) allows the user to indicate what share of the pet's daily calories this item provides. Math becomes: `Cups/day = (DER × diet_proportion) ÷ kcal_per_cup`. This prevents a caloric doubling bug where a pet assigned two daily foods (e.g., kibble + wet) would display 100% DER portions for each, totaling 200% of actual caloric need. Over 40% of pet owners feed mixed diets.

**Low stock nudge:** When countdown hits ≤5 days or ≤5 units, show subtle "Running low" indicator. If affiliate link exists for this product, buy button appears at this moment (not before).
**Milestone:** M5 (Pantry)
**Dependencies:** Pet profile DER calculation (M2), product kcal data (M3 scraping), Treat Battery (M2) for treat-specific daily budgets

---

## 7. Community & Social

### D-070: XP Engine
**Status:** DEFERRED — Build during M8-M10 community phase
**Decision:** In-app points for scanning, contributing, maintaining streaks, getting contributions approved. 2-3 weeks engineering. Cosmetic rewards (profile borders, badges) positioned as thank-you to contributors, not primary hook. Preserves clinical positioning.

### D-071: Subreddit
**Status:** LOCKED
**Decision:** r/kibascan (updated from r/clearbowl). Button opens in browser. Zero engineering cost. Ship on day one.

### D-072: Community Safety Flags
**Status:** DEFERRED — Build during community phase
**Decision:** Users flag suspect scores → queues a review. Builds trust in data quality.

---

## 8. Launch & Growth

### D-080: Platform Priority → iOS First
**Status:** LOCKED
**Decision:** iOS first, Android 4-6 weeks later. iOS converts to premium at 2-3× Android rate.

### D-081: App Store Category
**Status:** LOCKED
**Decision:** Primary: Health & Fitness (higher premium conversion, MAHA/clean eating adjacent). Secondary: Food & Drink (catches crossover from human food scanner users).

### D-082: Recall Event PR Playbook
**Status:** LOCKED
**Decision:** Pre-written response timeline (0-2hr confirm + push alerts, 2-4hr Reddit posts, 4-8hr press outreach, 24hr TikTok, 48hr App Store update). Pure informational tone — never promotional. The credibility of being first to alert users with zero promotional language is worth more than any ad spend.

### D-083: Cosmetics/Grooming → Post-Launch
**Status:** DEFERRED — Phase 2 (M16+)
**Trigger:** After pet food scoring engine is stable, community is active, and revenue is flowing.
**Note:** This was a key reason for the Clearbowl → Kiba rebrand. "Kiba" scales beyond food. "Clearbowl" does not.

### D-084: Zero Emoji Policy
**Status:** LOCKED
**Date:** Feb 19, 2026
**Decision:** No emoji characters (Unicode emoji) anywhere in the app interface. All visual communication uses:
- **SF Symbols** (Apple's native icon set) for functional iconography — e.g., thin-line heart for DCM cardiac advisory, shield for safety warnings, magnifying glass for search, flame for calorie data
- **Color coding** (red/amber/green severity system) instead of emoji indicators
- **Typography weight and size** for emphasis instead of decorative characters
- **Pet name personalization** for warmth instead of cartoon energy

**What this means in practice:**
- ✓ Clean line-art heart icon next to "Canine DCM Advisory (−8%)" — functional, communicates cardiac context
- ✓ Minimal shield icon on recall warnings — communicates safety
- ✓ Red dot or colored bar for severity — communicates urgency
- ✗ ❤️ 🐾 🐶 ⚠️ 😱 ✅ 🔍 anywhere in the UI
- ✗ Cartoon mascots, illustrated characters, brand animals
- ✗ Emoji in push notifications, onboarding, or marketing copy within the app

**Rationale:** Clinical aesthetic = trust signal. Pawdi uses emoji as filler because it lacks content density. Kiba has three scoring layers, ingredient breakdowns, DCM advisories, species modifiers, and GA panels — screen real estate is too valuable for decoration. Yuka's zero-emoji interface has 73M users. The medical-dashboard feel IS the premium positioning.
**Applies to:** All screens, modals, push notifications, onboarding, in-app copy. App Store screenshots may use minimal marketing iconography at Steven's discretion.

### D-085: Tab Bar Structure — 4 Tabs + Raised Scan Button
**Status:** LOCKED
**Date:** Feb 21, 2026
**Decision:** Navigation uses 4 tabs plus a raised center scan button:

```
[ Home ]  [ Search ]  ( SCAN )  [ Pantry ]  [ Me ]
   ⌂         ⌕        raised       ◫         ○
```

**Home:** Dashboard — recent scans, weekly scan counter ("3 of 5 remaining"), pantry summary card, recall alerts, formula change notifications. Not just history — the screen that makes Kiba feel alive between shopping trips. Scan history is a scrollable section within Home.
**Search:** Premium paywall trigger. Always visible, always tappable. Free users see search bar → type → paywall: "Search is a premium feature." Non-aggressive — looks like a feature, not an ad. Premium users get full text search across all products.
**SCAN (center, raised):** Accent-colored, floats above tab bar. Opens camera immediately. This IS the app — visually dominant.
**Pantry:** Active pet's current foods with feeding calculations, bag countdown, treat battery. Multi-pet switching for premium.
**Me:** Pet profile(s), settings, subscription status, app info.

**Rationale:** Raised center button is the established pattern for scanner apps (Yuka, barcode scanners, camera apps). Search as visible-but-gated tab is a smarter paywall than Pawdi's dedicated "Premium" tab — it's a permanent temptation, not a permanent advertisement. No dedicated Premium tab. The paywall appears contextually at trigger moments (D-052), never as a navigation destination.

### D-086: Background Color — Soft Dark (#1A1A1A)
**Status:** LOCKED
**Date:** Feb 21, 2026
**Decision:** Primary background color is #1A1A1A (soft dark), not pure black (#000000).
- Card surfaces: #242424 (subtle elevation)
- Primary text: #FFFFFF
- Secondary text: #A0A0A0
- Tertiary/muted text: #666666
- Severity colors: functional (red #FF3B30, amber #FF9500, green #34C759 — Apple system colors)
- Accent color: TBD (score ring, CTAs, scan button — to be determined during build, NOT Pawdi's green)

**Light mode:** Planned post-launch. Ship dark-only initially.
**Rationale:** Pure black (#000000) creates harsh contrast with white product images (visible in Pawdi screenshots). Apple's own dark mode apps use #1A1A1A or #1C1C1E. Soft dark is more forgiving, feels premium, and reduces the "sticker on black paper" effect when displaying product photos.

---

## 9. Open Decisions

### D-091: Database Miss Handling → Level 4 Hybrid
**Status:** LOCKED
**Date:** Feb 19, 2026
**Decision:** When a scanned UPC is not found in Kiba's database, use a two-step fallback:
1. **External UPC lookup** (UPCitemdb or similar) → retrieve product name, brand, category
2. **Confirmation step** → "Is this [Brand Product Name]?" → user confirms
3. **OCR prompt** → "Photograph the ingredient list and we'll score it now"
4. **Instant partial score** → Layer 1 ingredient quality only, reweighted per D-017 (78/22 missing-GA fallback), "Partial" badge displayed
5. **Auto-contribution** → parsed product saved to Kiba DB with `source = 'community'` and `needs_review = true` for all future users

**Milestone:** M3 (data pipeline phase)
**Rationale:** Every database miss is either a lost user or a new database entry. The external lookup provides a psychological bridge — the user sees their product recognized even before photographing the label. "We know what this is, we just need the ingredients" feels fundamentally different from "Product not found."
**Cost:** External UPC API ~$10-50/mo (UPCitemdb free tier: 100 lookups/day, sufficient for early growth)
**Dependencies:** OCR pipeline, Claude Haiku ingredient parsing, missing-GA fallback scoring (D-017)
**Risk:** External API returns wrong product match. Confirmation step mitigates this — user verifies before proceeding.

### D-090: Human Food Safety Scan
**Status:** REJECTED — Permanently killed
**Date:** Feb 27, 2026 (originally OPEN Feb 19, 2026)
**Decision:** Option B locked. Kiba does NOT scan or evaluate human food products. Hard scope boundary: Kiba is calibrated strictly for AAFCO-regulated pet foods. Human food labeling (FDA/USDA) operates under fundamentally different disclosure rules that make safety analysis unreliable.
**Rationale:** Human food labels legally permit lethal-to-pets ingredients to be cloaked under umbrella terms. Xylitol (lethal to dogs in minuscule doses) can be labeled as "birch sugar," "wood sugar extract," or grouped under "sugar alcohols." Onion and garlic powder (hemolytic anemia in pets) are legally hidden under "Spices" or "Natural Flavors." If Kiba OCRs a human peanut butter jar, misses cloaked xylitol due to regulatory opacity, and issues a safe result — and a dog dies — D-094 suitability disclaimers will not protect against gross negligence liability.
**If scanned UPC resolves to a human food product:** Display: "This appears to be a human food product. Kiba analyzes AAFCO-regulated pet foods only. For human food pet safety questions, consult your veterinarian."
**Rejected alternative:**
- ❌ Option A (Safety Scan mode) — toxicity-only check against species database. Rejected because FDA ingredient disclosure is too opaque to guarantee complete ingredient parsing. A single missed false negative on a lethal toxicant is an existential event.

### D-092: Onboarding Flow — Scan First, Light Profile, Progressive Personalization
**Status:** LOCKED
**Date:** Feb 27, 2026

**Decision:** Scan-first onboarding with light profile capture before score display. Users can always bypass scanning and complete their full profile first.

**Default path (scan-first):**
1. Open app → brief intro (1-2 screens: what Kiba does)
2. Camera opens — user scans a product
3. **Light profile capture** (before score displays — satisfies D-094 "no naked scores"):
   - One screen: pet name (text) + species (dog/cat toggle)
   - Two fields, minimal friction, ≤10 seconds
4. Score displays with Layer 1 + Layer 2 (species rules active)
5. **Personalization prompt:** "Complete [Pet Name]'s profile — add breed, age, and health info for a more tailored score"
6. User taps through to full profile or dismisses — either way, they already have a score

**Alternative path (profile-first):**
- User can skip scanning entirely and navigate to Me tab to set up their full profile at any time
- Full profile includes breed, weight, birth date, activity level, conditions (D-097), allergens
- After completing full profile, subsequent scans include Layer 3 personalization

**Why scan-first wins:** Every extra screen before first scan loses ~20% of users. Scan-first demonstrates value before asking for commitment. The light profile (name + species) is the minimum needed to satisfy D-094 and activate Layer 2 species rules — everything else is progressive.

**D-094 compliance:** No score displays without at least pet name + species. The light profile capture happens after scan but before score render. Score always shows "[X]% match for [Pet Name]."

**Rationale:** The user sees a real score within 30 seconds of opening the app. The personalization prompt after score display creates the hook — "your score could change if you add breed info" drives profile completion without gating the core experience.

### D-093: Product Image Display → Gradient Edge Fade
**Status:** LOCKED
**Date:** Feb 27, 2026 (originally OPEN)
**Decision:** Product images displayed on scan result screen using a gradient edge fade to blend white product backgrounds into the #1A1A1A dark UI. Image is prominently visible — not hidden or shrunk.
**Rationale:** The instant visual confirmation that the app recognized the exact product the user is holding is the core "magic moment" that builds trust in the database match. Without it, the user has no visual proof the barcode resolved correctly. Hiding or shrinking the image loses this trust signal.
**Implementation:** CSS/RN gradient overlay from transparent (center) to #1A1A1A (edges) on the product image container. Handles the white-background problem visible in Pawdi screenshots without requiring image processing or background removal.
**Rejected alternatives:**
- ❌ Small thumbnail left-aligned — undercuts the trust moment
- ❌ No product image on scan result — user can't confirm correct product match
**Constraint acknowledged:** Scraped product images almost always have white/light backgrounds. The gradient solves this at the rendering layer without requiring image processing infrastructure.

---

## 10. Gemini Feedback Triage

### What We Took
- **D-045: cluster_id for ingredient splitting** — genuinely useful backend mechanism we hadn't defined. Adopted.

### What We Rejected
- **55/30/15 validation** — restated our own decision back to us as its own analysis
- **Treat 100/0 validation** — same, already decided
- **DMB crash fix** — same, already designed
- **M0 code dump** — premature and partially wrong:
  - `expo-barcode-scanner` is deprecated (replaced by `expo-camera` built-in scanning in SDK 51+)
  - `react-native-purchases` at M0 is wrong — paywall comes M3-M4
  - Supabase schema missing GA columns (protein, fat, fiber, kcal) needed for 30% nutritional layer
  - Missing `aafco_statement`, `life_stage`, `preservative_type` for 15% formulation layer

---

## 11. Reference Scores

### Pure Balance Grain-Free Salmon & Pea (Dog Food)
**Score:** 66/100 — "Decent · Strong Nutrition, Heavy Legumes"

| Layer | Raw | Weight | Contribution |
|-------|-----|--------|-------------|
| Ingredient Quality (incl. −4 unnamed) | 60 | ×0.55 | 33.0 |
| Nutritional Profile | 82 | ×0.30 | 24.6 |
| Formulation Completeness | 78 | ×0.15 | 11.7 |
| **Base** | | | **69.3** |
| DCM Advisory | | | −8% |
| Taurine + L-Carnitine Mitigation | | | +3% |
| Personalization (Buster) | | | Neutral |
| **FINAL** | | | **66** |

### Temptations Classic Tuna (Cat Treat)
**Score:** 44/100 — "Occasional treat only · not for daily use"
Base ingredient quality: 52. Cat carb penalty: −8. Personalization (Luna): neutral. Scoring mode: 100% ingredient quality (treat).

---

### D-094: Score Framing — Suitability Match Language
**Status:** LOCKED — Non-negotiable
**Date:** Feb 24, 2026

All scores display as "[X]% match for [Pet Name]" — never "This product scores [X]." The score is a pet-specific suitability match, not a universal product quality rating.

**Required language:**
- Always: "[X]% match for [Pet Name]" / "compatibility deduction" / "suitability estimate" / "adjustment"
- Never: "This product scores [X]" / "quality rating" / "product grade" / "penalty" (user-facing)
- Waterfall labels: "Ingredient Concerns" / "[Pet Name]'s Nutritional Fit" / "[Pet Name]'s Breed & Age Adjustments"
- No "naked" scores — pet name and photo must always be visible on scan result screen

**Legal defensibility layers:**
1. TOS clickwrap (Tier 1): Active checkbox blocking app usage until accepted
2. Persistent disclaimer tooltip (Tier 2): ⓘ icon next to every score
3. Suitability framing (Tier 3): All copy uses match language, never quality ratings

**Rationale:** Attorney review identified product disparagement risk if scores are framed as universal quality ratings. Suitability framing positions Kiba as a personalized compatibility tool, making truth an absolute defense. Supersedes all prior score display copy in mockups and handoff docs.

### D-095: UPVM Compliance — Prohibited Language
**Status:** LOCKED — Non-negotiable
**Date:** Feb 24, 2026

**Never use in any user-facing context:**
- "prescribe," "treat," "cure," "prevent," "diagnose"
- "this food will help with [condition]"
- "feed this instead"
- Editorial: "cheap," "filler," "terrible," "toxic nightmare," "avoid at all costs"

**Required pattern:** Map label data → published literature → compatibility deduction. Kiba is a data-mapping tool, not a digital veterinarian.

**Copy architecture (ingredient modals):**
1. **TL;DR** (bold, plain language): Warm, conversational — states the fact + one "so what"
2. **Clinical body** (D-095 strict): Objective, citation-backed, no prohibited terms
3. **Citations**: Real sources with links

**The line:** Describing what something IS = fine. Telling someone what to DO about it = UPVM risk.

**Rationale:** State veterinary practice acts (UPVM model) prohibit unlicensed entities from diagnosing, treating, or prescribing for animals. All Kiba copy must describe ingredient characteristics and published research findings, never give feeding directives or health outcome promises.

### D-096: Supplement Scoring Architecture
**Status:** DEFERRED to M16+ (post-launch)
**Date:** Feb 24, 2026
**Trigger:** Food scoring stable, community features live, supplement products populating organically

**Three-layer architecture:**
- Layer 1 — Ingredient Safety (M16 launch): Evaluates inactive ingredients like treat model. 0-100 score.
- Layer 2 — Dose Validation (M16+, vet-audited): mg/kg against therapeutic curves. Sub-therapeutic → penalty. Toxic threshold → score 0 + red warning.
- Layer 3 — Suitability Match (M16+): Multiplier on dose score based on pet profile relevance. **Multiplier capped at 1.0** — no bonus for sicker pets.

**Launch weighting (M16):** 50/50 (Ingredient Safety / Dose×Suitability). NASC certification folds into ingredient safety as formulation signal.

**Proprietary blend handling:** If dose data hidden, Dose Validation scores 20/100 with UI flag: "This product does not disclose individual active ingredient amounts."

**Compliance carryover:** D-094 suitability language, D-095 UPVM compliance, D-019 brand-blind, D-020 affiliate-isolated, Scoring Rules #14 (citation required) and #15 (clinical copy rule).

**Rejected:**
- ❌ Relevance multiplier >1.0 (creates perverse incentive — sickest pets see highest scores, UPVM risk)
- ❌ "Therapeutic match" / "targeted therapy" language (D-095 violation)
- ❌ Building supplement infrastructure before M16

### D-097: Pet Health Conditions & Food Allergen Profile
**Status:** LOCKED
**Date:** Feb 25, 2026

**Purpose:** Pet profiles include known health conditions and food allergens. These feed Layer 3 (personalization) scoring and contextual UI advisories. Conditions are only collected when diet actually affects scoring output — no decorative health data.

**Health conditions (both species unless noted):**

| UI Label | Internal Tag | Dogs | Cats | Scoring Impact |
|----------|-------------|------|------|----------------|
| Joint issues | `joint` | ✅ | ✅ | Glucosamine, chondroitin, omega-3 relevance flagging |
| Food allergies | `allergy` | ✅ | ✅ | Triggers allergen sub-picker (see below) |
| Sensitive stomach | `gi_sensitive` | ✅ | ✅ | Limited ingredient preference, novel protein flagging |
| Overweight | `obesity` | ✅ | ✅ | Caloric density flagging, carb awareness |
| Diabetes | `diabetes` | ✅ | ✅ | Low-glycemic carb scoring priority |
| Kidney disease | `ckd` | ✅ | ✅ | Phosphorus restriction flagging, protein moderation |
| Urinary issues | `urinary` | ✅ | ✅ | Mineral balance (Ca, P, Mg), moisture flagging |
| Heart disease | `cardiac` | ✅ | ✅ | Sodium flagging, taurine/L-carnitine relevance |
| Pancreatitis | `pancreatitis` | ✅ | ✅ | Low-fat scoring priority |
| Skin & coat issues | `skin` | ✅ | ✅ | Omega-3/6 ratio, novel protein relevance |
| Liver disease | `liver` | ✅ | ✅ | Copper sensitivity (breed-specific in dogs, e.g. Bedlington Terrier); L-Carnitine relevance, macronutrient modulation (cats — hepatic lipidosis, cholangiohepatitis, triaditis) |
| Hyperthyroidism | `hyperthyroid` | ❌ | ✅ | Iodine-controlled diet flagging, senior cat flag |
| Seizures / Epilepsy | `seizures` | ✅ | ❌ | MCT oil relevance flagging |

Species-filtered: Dogs see 12 options, cats see 12. Multi-select allowed.

**Food allergen sub-picker (triggered when `allergy` selected):**

Ranked by peer-reviewed prevalence data (Mueller et al., 2016, BMC Vet Res, n=297 dogs / n=78 cats; Merck Vet Manual 2025; dvm360 Dec 2025):

| Allergen | Dogs | Cats | Prevalence Source |
|----------|------|------|-------------------|
| Beef | ✅ (34%) | ✅ (#1-2) | Mueller 2016 — most reported in both species |
| Chicken | ✅ (15%) | ✅ (#1-2) | Mueller 2016; dvm360 2025 — #1 per DACVD survey |
| Dairy | ✅ (17%) | ✅ | Mueller 2016 — #2 in dogs |
| Wheat | ✅ (13%) | ❌ (rare) | Mueller 2016 — #4 in dogs |
| Fish | ✅ (2%) | ✅ (#2-3) | Mueller 2016 — top 3 in cats |
| Lamb | ✅ (5%) | ✅ | Mueller 2016; Merck 2025 |
| Soy | ✅ (6%) | ❌ (rare) | Mueller 2016 |
| Egg | ✅ (4%) | ❌ (rare) | Mueller 2016; VCA |
| Corn | ✅ (4%) | ❌ (rare) | Mueller 2016 |
| Pork | ✅ (2%) | ❌ (rare) | Mueller 2016 |
| Turkey | ✅ | ✅ | Not in major studies — included as common protein; sometimes cross-reactive with chicken |
| Rice | ✅ (2%) | ❌ (rare) | Mueller 2016 — uncommon but documented |
| Other | ✅ | ✅ | Searchable dropdown of all protein sources in `ingredients_dict` (rabbit, venison, duck, bison, quail, kangaroo, etc.) — NOT free text |

Species-filtered: Dogs see all 13 options, cats see 7 + Other. Multi-select.

**Important — No free-text allergens (updated Feb 27, 2026):** The "Other" option was originally free text. This created a critical safety gap: D-098's cross-reactivity engine relies on `allergen_group` mappings in `ingredients_dict` to catch derivative ingredients. A free-text string like "Venison" has no relational mapping, so scanning a product with "Venison Meal" would silently bypass cross-reactivity detection — a false negative on an allergen. The "Other" option is now a searchable, hardcoded dropdown populated from every distinct protein source `allergen_group` in `ingredients_dict`. This guarantees every user-selected allergen has a working cross-reactivity mapping.

**Note on Turkey:** Turkey is absent from the major allergen prevalence studies (Mueller 2016, Merck 2025) because it's commonly used as a novel protein in elimination diets, meaning most dogs/cats haven't been exposed enough to develop sensitivity. However, it's a common pet food protein, cross-reactivity with chicken is documented, and users will expect to see it. Included with no prevalence % displayed.

**UI flow:**
1. Pet profile → "Known health conditions?" → multi-select chips
2. If `allergy` selected → "Known food allergens?" → multi-select chips + "Other" searchable dropdown (populated from `ingredients_dict` protein sources)
3. Both screens skippable ("None" / "Not sure")

**Database schema:**

```sql
-- Pet conditions (many-to-many)
CREATE TABLE pet_conditions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pet_id UUID REFERENCES pets(id) ON DELETE CASCADE,
  condition_tag TEXT NOT NULL, -- e.g. 'joint', 'ckd', 'allergy'
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(pet_id, condition_tag)
);

-- Pet food allergens (many-to-many, only populated when allergy condition exists)
CREATE TABLE pet_allergens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pet_id UUID REFERENCES pets(id) ON DELETE CASCADE,
  allergen TEXT NOT NULL, -- e.g. 'beef', 'chicken', 'dairy', or extended protein from searchable dropdown
  is_custom BOOLEAN DEFAULT false, -- true for "Other" dropdown entries (not in top-12 standard list)
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(pet_id, allergen)
);

-- RLS: both tables filtered by user_id through pets table join
ALTER TABLE pet_conditions ENABLE ROW LEVEL SECURITY;
ALTER TABLE pet_allergens ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own pet conditions"
  ON pet_conditions FOR ALL
  USING (pet_id IN (SELECT id FROM pets WHERE user_id = auth.uid()));

CREATE POLICY "Users can manage their own pet allergens"
  ON pet_allergens FOR ALL
  USING (pet_id IN (SELECT id FROM pets WHERE user_id = auth.uid()));
```

**Scoring integration:**
- Allergens: If pet has `allergy` + specific allergens, any product containing that protein source gets a prominent UI warning card (not a score penalty — the ingredient's own rating handles that). This is a **hard flag**, not a score modifier, because allergen severity is binary and individual.
- Conditions: Feed into Layer 3 personalization multipliers. E.g., `ckd` increases the weight of phosphorus levels in nutritional scoring; `pancreatitis` increases fat penalty sensitivity.

**Compliance:**
- D-094: Condition-based adjustments display as "[Pet Name]'s Breed & Age Adjustments" in waterfall
- D-095: No "this food will make your condition worse" — only "Adjusted for [condition]: [factual mechanism]"
- All condition/allergen data isolated by RLS through pets table

### D-098: Cross-Reactivity Allergen Expansion
**Status:** LOCKED
**Date:** Feb 25, 2026
**Depends on:** D-097 (Pet Health Conditions & Food Allergen Profile)

**Problem:** D-097 captures allergen selections (e.g., "Chicken") but does not specify how the scan engine expands that selection to cover derivative ingredients. Without expansion, a user who marks "Chicken" as an allergen could scan a product containing "Chicken Fat" at position #14 and receive no warning. This is the most common failure mode in pet food allergen management — the prototype MasterSpec (Feb 2026) identified it as the #1 reason elimination trials get contaminated.

**Decision:** When a pet has a known allergen, the scan engine automatically flags ALL derivative forms of that protein source. A new `allergen_group` field on the `ingredients_dict` table maps every ingredient to its source protein family. At scan time, the engine queries `WHERE allergen_group IN (pet's known allergens)` and flags any matches.

**Allergen expansion map:**

| User Selects | `allergen_group` | Derivative Forms Flagged (examples, not exhaustive) |
|---|---|---|
| Chicken | `chicken` | chicken, chicken meal, chicken liver, chicken by-product meal, chicken broth, chicken cartilage, chicken digest, dehydrated chicken, chicken heart, chicken gizzards |
| Beef | `beef` | beef, beef meal, beef liver, beef by-products, beef broth, beef heart, beef lung |
| Dairy | `dairy` | milk, dried milk, whey, dried whey, casein, cheese, lactose, cream, butter, lactalbumin, milk protein |
| Wheat | `wheat` | wheat, wheat flour, wheat gluten, wheat middlings, wheat bran, wheat germ, enriched flour |
| Fish | `fish` | salmon, salmon meal, tuna, whitefish, whitefish meal, fish meal, menhaden fish meal, herring, herring meal, anchovy, sardine, pollock, cod, ocean fish meal |
| Lamb | `lamb` | lamb, lamb meal, lamb liver |
| Soy | `soy` | soy, soybean meal, soy flour, soy protein, soy protein isolate, soy lecithin |
| Egg | `egg` | egg, egg product, dried egg, dried egg product, egg whites, egg yolk |
| Corn | `corn` | corn, corn meal, corn gluten, corn gluten meal, corn starch, corn syrup, ground corn |
| Pork | `pork` | pork, pork meal, pork liver, pork by-products, pork plasma, pork gelatin |
| Turkey | `turkey` | turkey, turkey meal, turkey by-products, turkey liver, turkey heart |
| Rice | `rice` | rice, brown rice, white rice, rice bran, rice flour, brewers rice, rice protein |

**Rendered fats and purified oils — Possible Match only (updated Feb 27, 2026):**

True dietary food allergies in dogs and cats are IgE-mediated immune responses to intact proteins (glycoproteins), not lipids. Commercially rendered animal fats and purified marine oils contain virtually zero protein. Board-certified veterinary dermatologists routinely prescribe diets containing chicken fat to chicken-allergic dogs (e.g., Purina Pro Plan HA, Royal Canin HP).

The following are classified as **Possible Match (Amber)**, NOT Direct Match (Red):
- `chicken_fat`, `beef_tallow`, `beef_fat`, `pork_fat`, `turkey_fat`, `lamb_fat` → Amber
- `salmon_oil`, `fish_oil`, `soybean_oil` → Amber

Amber UI copy: "Contains [Animal] Fat. Food allergies are triggered by proteins, not fats. While trace cross-contamination during manufacturing is possible, pure rendered fats are generally considered safe for allergic pets. Consult your vet."

These ingredients are tagged with `allergen_group_possible` (not `allergen_group`) to ensure they trigger Amber warnings, not Red.

**Generic/unnamed ingredient handling (two tiers):**

| Match Type | Example | UI Treatment |
|---|---|---|
| **Direct match** — ingredient's `allergen_group` matches pet's allergen | Product contains "chicken meal," pet allergic to chicken | Red warning card: "Contains chicken meal — chicken is listed as a known allergen for [Pet Name]" |
| **Possible match** — unnamed sourcing term that COULD contain the allergen | Product contains "poultry fat" or "animal digest," pet allergic to chicken | Amber warning card: "Contains poultry fat — unnamed sourcing term may include chicken. Verify with manufacturer." |

Possible-match ingredients tagged with `allergen_group_possible` (array field) listing which allergen groups they could plausibly contain. Examples: "poultry fat" → `{'chicken', 'turkey'}`; "animal digest" → `{'chicken', 'beef', 'pork', 'lamb', 'turkey', 'fish'}`; "natural flavors" → `{'chicken', 'beef', 'pork', 'lamb', 'turkey', 'fish', 'dairy'}`.

**Database schema addition:**

```sql
ALTER TABLE ingredients_dict
  ADD COLUMN allergen_group TEXT,
  ADD COLUMN allergen_group_possible TEXT[];

CREATE INDEX idx_ingredients_allergen_group ON ingredients_dict(allergen_group);
```

**Why `allergen_group` is separate from `cluster_id` (D-045):** `cluster_id` detects ingredient splitting within a single product (manufacturer behavior). `allergen_group` maps ingredients to protein source families for allergen safety (user health concern). Different purpose, different field.

**Scoring integration:** Allergen matches are UI warning cards, not score penalties. The ingredient's own quality rating handles scoring. The allergen flag is a binary safety alert layered on top — the point is avoidance, not gradation.

**Compliance:** D-094 framing ("chicken is listed as a known allergen for Mochi"), D-095 (no prescriptive language — "Contains [ingredient]" not "Avoid this product"), D-019 (brand-blind).

### D-099: Vet Report — Pet Dietary Profile (M4)
**Status:** LOCKED
**Date:** Feb 25, 2026
**Depends on:** D-097 (conditions/allergens), D-098 (cross-reactivity), D-094/D-095 (copy rules)
**Milestone:** M4 (Product Detail + Education)

**Purpose:** A shareable PDF giving a veterinarian a structured overview of what the pet is eating, what Kiba flagged, and what conditions/allergens are on file. Replaces the unreliable verbal summary pet owners give at vet visits. No competitor offers this.

**What the M4 report IS:** A pet dietary profile — feeding history, ingredient exposure, nutritional data, and flagged concerns. A data document the vet files, references, and acts on.

**What the M4 report is NOT:** A clinical trial report, a diagnosis, a dietary prescription, or a recommendation engine. Kiba presents data. The vet interprets.

**Format:** PDF. Light background (clinical/print standard — NOT the dark app UI). Clean typography. Professional enough for a vet to file.

**Section 1 — Pet Profile:** Name, species (with Latin name), breed, age, weight (lbs + kg), life stage, known conditions, known food allergens, profile completeness note. All from pet profile and D-097 tables.

**Section 2 — Report Summary (stat callouts):** Four horizontal stat boxes adapted from prototype PDF format: Products scanned (count in period) | Daily foods in rotation (category count) | Suitability range ("52%–84% match for Mochi") | Allergen exposures detected (D-098 match count, or "No known allergens on file").

**Section 3 — Current Diet (product table):** Scanned products in timeframe, sorted most recent first. Columns: Product Name | Category (Daily Food / Treat / Supplement) | Last Scanned | Match % (D-094 format) | Key Flags (top 3 severe ingredients; known allergens bolded with ⚠). Products containing known allergens get light red row background. Max 25 products. Category summary line below table.

**Section 4 — Nutritional Overview (conditional):** Only rendered if GA data exists for ≥1 primary food. Shows Protein/Fat/Fiber/Moisture ranges across primary foods, DMB-adjusted for wet food, AAFCO life stage reference values. Per-condition nutritional flags — factual only: "Average fat across primary foods: 18% DMB. Pet profile includes pancreatitis." Never: "a low-fat diet is indicated." Partial Data badge if GA missing for some products. If zero GA data: section replaced with explanatory note.

**Section 5 — Ingredient Exposure Analysis:** The M4 killer section. (5a) Top 10 protein sources with product count. (5b) Known allergen exposure with cross-reactivity detail from D-098 — "Chicken or chicken-derived ingredients detected in 8 of 18 products. Derivatives: chicken meal (5), chicken fat (3), chicken liver (1). Additionally, 2 products contain unnamed ingredients that may include chicken." (5c) Unnamed protein/fat source count. (5d) Top 5 most frequent controversial ingredients across all products.

**Section 6 — Flagged Concerns:** Aggregated across all products. DCM advisory (which products, why, FDA CVM citation), ingredient splitting detections, breed-specific adjustments with citations, condition-relevant flags (factual), recall status. Each entry includes citation source.

**Section 7 — Disclaimer & Footer:** "This report was generated by the Kiba Pet Food Safety App based on product data scanned by the pet owner... does not constitute veterinary medical advice, dietary recommendations, or clinical diagnosis... All dietary decisions should be made in consultation with a licensed veterinarian." Report ID (KBA-YYYY-XXXXX), timestamp, app version, ingredient DB version, report period.

**Generation flow:** Tap "Vet Report" → select timeframe (30/90/180 days or all time, default 90) → preview screen with data counts → "Generate PDF" → loading (2-5 sec target) → native share sheet (email, Files, print, AirDrop). Cached locally 7 days.

**Premium gating:** Free tier sees preview with data counts but cannot generate/share. Premium: unlimited. Not one of D-052's 5 trigger moments — gates naturally from the feature.

**Explicitly excluded:** ❌ Feeding recommendations, ❌ "Switch to this product" suggestions, ❌ Score interpretation, ❌ Internal scoring weights, ❌ Confidence scores, ❌ Affiliate links, ❌ Symptom data (no source until M9), ❌ Trial data (no tracker until D-100), ❌ AI-generated prose (D-034).

**Copy rules:** D-094 scores in PDF. D-095 zero prescriptive language. Clinical Copy Rule #15 throughout. Condition observations state data + condition on file, never connect them with a recommendation. "Average fat: 18% DMB. Pet profile includes pancreatitis." Full stop. Vet connects the dots.

**Future upgrade:** D-100 (Elimination Diet Trial Tracker) adds trial sections to this same PDF infrastructure. M4 report = "Type A: Dietary Profile." Trial report = "Type B: Trial Completion Report." Same generation pipeline, superset of content.

### D-100: Elimination Diet Trial Tracker — Architecture Preview
**Status:** PLANNED — Not locked. Architecture preview for future milestone. Detailed spec at implementation time.
**Date:** Feb 25, 2026
**Target milestone:** M16+ (sequenced first, before Cosmetics and Supplement Scoring)
**Depends on:** M9 (Symptom Detective), D-097 (conditions/allergens), D-098 (cross-reactivity), D-099 (vet report PDF)
**Source:** Kiba prototype MasterSpec v1.0 (Feb 2026) — adapted for current architecture with D-094/D-095 compliance

**Why this matters:** Elimination diet trials (8-12 weeks on novel protein to identify food allergens) are the gold standard for allergy diagnosis. No dedicated mobile tool exists. Active trials create daily app opens for 8-12 consecutive weeks — exceptional engagement. Mid-trial churn minimized by emotional investment in the pet's outcome.

**Trial state machine:** SETUP → ACTIVE ↔ PAUSED → COMPLETE → REINTRODUCTION → CLOSED. Pause is recommended on contamination, NOT forced. User can override — forced pause on false positive destroys trust in a multi-week protocol.

**Trial setup (4 steps):** Select pet → enter novel protein(s) + approved carbs → vet info (optional, populates report header) → trial settings (8 or 12 weeks, check-in notification time, sensitivity level).

**Active trial scanning:** Every scan evaluated against trial whitelist (approved list from setup) AND trial blocked list. **Critical protocol correction (Feb 27, 2026):** The blocked list is NOT simply inverted from D-097 known allergens. An elimination diet is a diagnostic tool used *before* the owner knows what the pet is allergic to. The strict medical protocol requires blocking **every protein the pet has ever eaten in its lifetime** (chicken, beef, lamb, etc.), regardless of whether an allergy is confirmed. The D-100 setup wizard must ask the user to input "Previously Fed Proteins" (multi-select from `ingredients_dict` protein sources, same dropdown pattern as D-097 allergen picker) and add all of those to the blocked list alongside any D-097 known allergens. Cross-reactivity expansion (D-098) applied to both lists. Verdicts: SAFE (green), AMBIGUOUS (amber — umbrella terms), CONTAMINATION (red — blocked ingredient detected). Contamination events auto-logged with timestamp, product, ingredient(s), for pattern correlation.

**Symptom logging upgrade:** M9 Symptom Detective (D-033) ships with 5-button simple logging. Trial tracker upgrades to 6-dimension 0-4 scale: Itching, GI Symptoms, Ear Issues, Paw Licking, Coat Quality, Energy Level. Daily push notification. Overall score: sum of 6 dimensions, max 24. 30-second completion target. When no trial active, simpler M9 version remains available. Both use same `symptom_logs` table, different schema completeness.

**Pattern detection (rule-based v1.0):** Nightly background job. Lag Correlation: symptom increase ≥2 within 3 days of contamination → HIGH signal. Baseline Drift: 7-day rolling average increase ≥1.5 → MEDIUM. Improvement Signal: 14-day rolling average decrease ≥2 with zero contamination → POSITIVE. Stale Trial: no scan for 48+ hours → re-engagement push. All insights labeled "possible correlation," never "confirmed."

**Reintroduction phase (optional, post-trial):** One protein at a time, 14-day observation each. User records outcome: REACTION / TOLERATED / INCONCLUSIVE. Self-serve with prominent disclaimer: "Reintroduction testing should be guided by your veterinarian."

**Vet report upgrade (Type B: Trial Completion):** D-099 infrastructure gains trial-specific sections: outcome summary stat callouts, executive summary (templated prose, NOT AI per D-034), symptom timeline chart + weekly scoring table, contamination event log, pattern detection insights, reintroduction log. All M4 sections carry forward. Trial report is superset.

**D-095 compliance — prototype copy revisions:**

| Prototype (rejected) | Kiba (D-095 compliant) |
|---|---|
| "FOOD ALLERGY CONFIRMED" | "STRONG DIETARY SENSITIVITY SIGNAL — Discuss findings with your veterinarian" |
| "A permanent chicken-free diet is indicated" | "Trial data identified a reaction to chicken during reintroduction. Discuss dietary adjustments with your veterinarian." |
| "Greenies must be avoided permanently" | "Greenies flagged CONTAMINATION (chicken liver). Symptom increase of +2 observed within 3 days." |
| "A duck-based dental chew should be sourced" | Omitted. Kiba presents data, vet recommends products. |
| "Food allergy strongly supported" | "Trial data is consistent with a dietary sensitivity to chicken." |
| Confidence scores (0.00-1.00) in ingredient analysis | Removed. Show verdict and evaluation layer only. |

**Prototype design elements preserved:** Header/footer format, stat callout boxes, weekly symptom scoring table with color coding (Green ≤1 / Amber 2 / Red ≥3), contamination event callout boxes, Report ID format, disclaimer quality, general visual hierarchy (summary → timeline → detail → insights → disclaimer).

**Premium gating:** Trial tracker = hard paywall on first trial start. Vet report Type B = premium only. Pattern detection insights = premium only. Daily 6-dimension logging = premium during active trial (M9 simple logging stays free).

**Explicitly rejected from prototype:** ❌ Claude API for executive summary (D-034), ❌ Other species (dogs/cats only), ❌ SQLite offline-first (Supabase stack), ❌ Open Food Facts as data source (D-042), ❌ Fuzzy matching for TOXIC verdicts (exact match only), ❌ User-editable safe list in v1, ❌ Confidence scores in vet report.

**Open questions (resolve at implementation):** (1) Trial pause: auto or recommended? Default: recommended with override. (2) Report storage TTL: 30 days with re-download. (3) Reintroduction: vet-gated or self-serve? Default: self-serve + disclaimer. (4) PDF generation: client-side or server-side? Depends on Expo chart rendering maturity. (5) 6-dimension scale: replace M9 entirely or coexist? Default: coexist. (6) HIPAA/PIPEDA review for vet info + health data before Canadian launch? Legal review required. (7) Vet Partnership Tier ($49-99/mo per clinic)? Evaluate post-launch.

### D-101: Feeding Schedule Notifications & Auto-Depletion
**Status:** LOCKED
**Date:** Feb 25, 2026
**Extends:** D-065 (Pantry Feeding Calculations & Bag/Pack Countdown)
**Milestone:** M5 (Pantry)

**Purpose:** Push notifications on the user's feeding schedule keep Kiba present in daily routine — the app becomes the pet's mealtime companion, not something opened only when buying new food. Also eliminates manual consumption logging by tying depletion countdown directly to the feeding schedule.

**Per-pantry-item settings:**

| Field | Options | Default |
|---|---|---|
| Feeding frequency | Daily / As needed / Not set | Daily for food, As needed for treats & supplements |
| Times per day | 1 / 2 / 3 / Custom | 2 for daily food (morning + evening), 1 for supplements |
| Scheduled times | User sets clock times | 7:00 AM + 6:00 PM (sensible defaults, user-adjustable) |
| Notifications | On / Off | On for daily items, Off for "As needed" |

**Auto-depletion:** When feeding frequency is set, the depletion countdown (D-065) runs automatically — no manual logging required. The app assumes the pet ate on schedule unless the user indicates otherwise. This is the key insight: most pet owners feed on a consistent routine. Asking them to log every meal is input fatigue that kills retention.

- Daily food: countdown ticks automatically based on cups/day or units/day × scheduled feeds
- Treats: "As needed" by default — no automatic depletion, user taps "gave a treat" when they want to (optional). Depletion only auto-ticks if user explicitly sets a daily treat schedule.
- Supplements: same as treats — "As needed" default, auto-depletion only if user sets a daily schedule

**Notification content (examples):**
- Morning: "Time for Buster's breakfast — Purina Pro Plan Salmon (2.3 cups)" 
- Evening: "Buster's dinner time — Purina Pro Plan Salmon (2.3 cups)"
- Supplement: "Mochi's daily probiotic — Fortiflora (1 packet)"
- Low stock (from D-065): "Running low — ~3 days of Purina Pro Plan Salmon remaining"

**Multi-pet households:** Notifications group by time slot. If Buster and Milo both eat at 7 AM, one notification: "Morning feeding — Buster (2.3 cups Pro Plan) + Milo (1.4 cups Pro Plan)." Not two separate notifications.

**Skipped meal handling:** Optional. If user taps "Skip" or doesn't dismiss notification, the depletion countdown still ticks (conservative — assume food was given). User can manually adjust remaining quantity at any time. Not worth building complex "did you actually feed?" confirmation flows.

**Why this matters for retention:** Two feeding notifications per day = 730 touchpoints per year where the user sees "Kiba" on their lock screen. No ad spend required. The app becomes associated with caring for their pet, not just scanning food.

**Compliance:** D-084 (zero emoji in notifications). D-095 (no health claims in notification copy — "Time for breakfast" not "Feed this to prevent allergies").

### D-102: Breed Selector — Alphabetical with Mixed/Other Last
**Status:** LOCKED
**Date:** Feb 25, 2026

**Rule:** Breed list sorted alphabetically (A→Z), with "Mixed Breed" and "Other" pinned to the bottom of the list, in that order. Applies to both dog and cat breed selectors. Searchable — user can type to filter.

### D-103: Pet Appointment Scheduler
**Status:** LOCKED
**Date:** Feb 25, 2026
**Milestone:** M5 (Pantry — bundled as pet management features)

**Purpose:** Users can schedule vet visits, grooming appointments, and other pet-related dates with optional reminders. Deepens the app's role as a pet care hub — every reminder notification is another Kiba touchpoint. Combined with feeding notifications (D-101), the app becomes indispensable infrastructure rather than a scanner opened occasionally.

**Appointment types:**
- Vet visit
- Grooming
- Medication / Flea & tick
- Vaccination
- Other (free text label)

**Per-appointment fields:**
| Field | Required | Notes |
|---|---|---|
| Type | Yes | Select from list above |
| Date & time | Yes | Date picker |
| Pet(s) | Yes | Multi-select — can assign to multiple pets (e.g., both dogs going to vet) |
| Location / clinic | No | Free text |
| Notes | No | Free text |
| Reminder | No | Off / 1 hour before / 1 day before / 3 days before / 1 week before. Default: 1 day before. |
| Recurring | No | None / Monthly / Every 3 months / Every 6 months / Yearly. Useful for flea meds, annual checkups. |

**Display:** Upcoming appointments shown on pet profile screen and optionally on home/dashboard. Past appointments archived (not deleted) — useful vet visit history for the vet report (D-099) in future.

**Premium gating:** Free tier gets 2 active appointments. Premium: unlimited. Soft gate — natural upsell for multi-pet households managing multiple vet schedules.

**Compliance:** D-084 (zero emoji in notifications). Notification copy is factual: "Mochi's vet visit tomorrow at 2:00 PM — Paws & Claws Animal Hospital."

**Future:** Appointment history feeds into vet report (D-099) as a "Recent Vet Visits" section. Not at M4 launch — add when data accumulates.

---

### D-104: Carbohydrate Estimation Display & Explainer System
**Status:** LOCKED
**Date:** Feb 26, 2026
**Milestone:** M0 (types + component pattern), M1 (scan result screen implementation)

**Context:** AAFCO does not require carbohydrate disclosure on pet food labels. Most pet owners have never seen the carb content of their pet's food. This is one of Kiba's highest-value differentiators — especially for cat owners, where carb content directly impacts diabetes and obesity risk.

**Calculation (already defined in NUTRITIONAL_PROFILE_BUCKET_SPEC.md §2c):**
```
carbs = Math.max(0, 100 - protein - fat - fiber - moisture - ash)
```
Ash defaults: dry food (≤12% moisture) = 7.0%, wet food (>12% moisture) = 2.0%, treats = 5.0%.
If calcium AND phosphorus both available, tighten estimate: `ash ≈ (calcium% + phosphorus%) × 2.5`.

**Floor note (added Feb 27, 2026):** The `Math.max(0)` floor is required because GA legally uses *minimums* for protein and fat, and *maximums* for fiber and moisture. Actual protein and fat in the bag are almost always higher than the legal minimum, meaning this formula calculates the maximum possible carbohydrates. In ultra-high-protein wet foods, the formula can produce negative values without the floor.

**Display format — scan result screen:**
Carbs shown as a calculated row appended to the GA table, with a qualitative label and confidence badge:
```
Carbohydrate (est.)    ~31%  ■ High
```

**Confidence badges:**
| Badge | Condition |
|---|---|
| Exact | Ash listed on label — precise calculation |
| Estimated | Ash assumed from category defaults |
| Unknown | Too many missing GA values to calculate |

**Qualitative thresholds (species-specific):**

Cat:
| Label | Range | Color |
|---|---|---|
| Low | ≤15% DMB | Green |
| Moderate | 16–25% DMB | Yellow |
| High | >25% DMB | Orange |

Dog:
| Label | Range | Color |
|---|---|---|
| Low | ≤25% DMB | Green |
| Moderate | 26–40% DMB | Yellow |
| High | >40% DMB | Orange |

**Tap-to-expand explainer:** Tapping the carb row opens an expandable breakdown showing:
1. The subtraction formula with actual values filled in
2. One-sentence explanation of what ash is
3. Why carbs matter for this species
4. Citation sources (AAFCO OP §4; NRC 2006 Ch. 3)

**Explainer content pattern (reusable):** All educational modals in Kiba follow the same typed structure:
```typescript
interface Explainer {
  id: string;
  title: string;
  tldr: string;              // one-line summary
  body: string;              // full explanation (plain text, not markdown)
  citations: Citation[];
  applies_to: Species[];     // which species this is relevant to
}
```
Explainers are static content shipped with the app in `src/content/explainers/`. NOT stored in Supabase — no network dependency for educational content. Initial set: carb estimation, DMB conversion, ingredient splitting, what is ash, what is by-product meal.

**Scoring integration:** The qualitative labels (Low/Moderate/High) are display-only. They do NOT feed back into the scoring engine. The 30% nutritional bucket uses the continuous carb curves already defined in NUTRITIONAL_PROFILE_BUCKET_SPEC.md §4b. No double-counting.

**Compliance:** D-095 (Clinical Copy Rule) — explainer text is objective and factual, never editorial. D-019 (brand-blind) — no brand references in explainers.

---

### D-105: Ingredient Detail Modal — Consumer-Facing Content Layer
**Status:** LOCKED
**Date:** Feb 26, 2026
**Milestone:** M1 (schema columns at M0, content population M1–M3)

**Context:** The `ingredients_dict` table contains scoring data (severity, position_reduction_eligible, cluster_id) but no consumer-facing content. When a user taps an ingredient on the scan result screen, they need an accessible, engaging explanation — not raw database fields. This decision defines the content structure, tone, and display rules for ingredient detail modals.

**New columns on `ingredients_dict` (display-only — scoring engine NEVER reads these):**

| Column | Type | Purpose |
|---|---|---|
| `display_name` | text | Full name with chemical name in parens, e.g. "BHA (Butylated Hydroxyanisole)" |
| `definition` | text | One sentence — what this ingredient physically is |
| `tldr` | text | 2–3 sentences, engaging summary a pet owner would actually read |
| `detail_body` | text | Full explanation, 1–2 paragraphs, factual and accessible |
| `citations_display` | jsonb | Array of source strings for the UI footer |
| `position_context` | text | One sentence explaining whether concern is amount-based or presence-based |

**Position reduction — consumer-facing explanation:**

The `position_reduction_eligible` boolean drives scoring math. But users need to understand *why* some ingredients are flagged regardless of position and others depend on how much is in the food. The `position_context` field provides this in plain language:

- **position_reduction_eligible = true** → `"This ingredient's impact depends on how much is used. Listed lower on the label = less concern."`
- **position_reduction_eligible = false** → `"This ingredient is flagged regardless of amount. Even small quantities raise the same concern."`

The modal displays this as a contextual line below the TL;DR, with an info icon that expands to explain ingredient list ordering: "Pet food labels list ingredients by weight before processing. The first ingredient makes up the largest portion of the recipe."

**Severity badge display:**

| Severity | Badge | Color |
|---|---|---|
| Beneficial | ✅ Beneficial | Green |
| Neutral | ● Neutral | Gray |
| Caution | ⚠️ Caution | Amber |
| Danger | 🔴 Danger | Red |

Badge is species-specific — if the user's pet is a cat, show cat severity. If dog, show dog severity. If no pet profile, show both: "⚠️ Caution for dogs · 🔴 Danger for cats"

**Modal layout (top to bottom):**
1. `display_name` + species-specific severity badge
2. `tldr` (the hook — always visible, never collapsed)
3. `position_context` line with info icon
4. `detail_body` (collapsed by default, "Read more" to expand)
5. `citations_display` (small text footer, always visible)

**Tone rules (enforced by D-095 Clinical Copy Rule):**
- Factual, never editorial. "Classified as Group 2B (possibly carcinogenic)" not "this scary chemical"
- Explain the mechanism, not just the verdict. Users should understand *why*
- Acknowledge nuance. "Rodent studies showed X, but dogs/cats lack the forestomach where tumors occurred"
- Name safer alternatives when they exist. "Most premium foods use mixed tocopherols instead"
- Never mention brands. Say "some formulations" not "Brand X uses this"

**Content population timeline:**
- Phase 1 (M1): 30 Tier 1 ingredients — written manually, highest user encounter rate
- Phase 2 (M2–M3): 90 Tier 1.5 + Tier 2 — AI-drafted from existing research, human-reviewed
- Phase 3 (M4+): 85 Tier 3–4 vitamins/minerals/processing aids — lower priority, briefer entries

**Storage:** Supabase `ingredients_dict` table. Content served via standard query — no separate API. Cached locally after first fetch for offline access.

**Compliance:** D-095 (Clinical Copy Rule), D-019 (brand-blind), D-020 (affiliate-isolated — no product recommendations in ingredient modals).

---
D-106: Weight Management — Advisories, Not Score Modifiers
Status: LOCKED
Date: Feb 26, 2026
Depends on: D-097 (Pet Health Conditions), D-060–D-063 (DER Multipliers), D-094 (Suitability Framing), D-095 (UPVM Compliance)
Milestone: M2 (Portion Calculator + Pet Profiles)
Context: The scoring engine evaluates food quality and species/breed suitability. A pet's weight status (obese, overweight, underweight) does not change the quality of a food — it changes how much of that food should be fed. Penalizing caloric density in the suitability score would create perverse outcomes: genuinely excellent high-protein foods would score lower for obese pets while lower-quality, low-calorie kibble filled with corn and unnamed meals would score higher. The portion calculator (RER × DER at goal weight) is the correct intervention for weight management, not score modifiers.
Decision: Weight status is handled through portion-level advisories and one targeted false-positive suppression. No caloric density penalties. No score modifiers for weight.
1. Add underweight condition to D-097:
UI LabelInternal TagDogsCatsPurposeUnderweightunderweight✅✅Enables goal-weight-up mode in portion calculator and weight-specific UI advisories
Mutual exclusion: obesity and underweight cannot both be selected for the same pet. UI enforces this — selecting one deselects the other.
2. Portion calculator handles weight direction:
ConditionPortion Calculator Behaviorobesity + goal_weight setRER at goal weight (lower). Cups/day decreases. Already specified in M2.underweight + goal_weight setRER at goal weight (higher). Cups/day increases. Same formula, opposite direction.Neither conditionRER at current weight. Standard behavior.
3. UI advisory on scan result screen (not a score modifier):
When obesity or underweight is set AND goal_weight is set AND the scanned product has kcal data:

Portion context card (displayed below the score, above ingredient list):

Obesity: "At [Pet Name]'s goal weight portions: [X] cups/day ([Y] kcal/day)"
Underweight: "At [Pet Name]'s goal weight portions: [X] cups/day ([Y] kcal/day)"


If calculated portions are impractically small (< 1/4 cup per meal for cats, < 1/3 cup per meal for dogs), add a note: "Portions are very small at this caloric density — a lower-calorie food may be easier to manage." This is an observation about practicality, not a score modifier or feeding directive.
If kcal data is unavailable, the card is not rendered. No guessing.
4. Fiber penalty suppression for obese pets:
The existing fiber scoring curve (NUTRITIONAL_PROFILE_BUCKET_SPEC.md §4b) penalizes fiber >5% DMB as a potential filler signal. But higher fiber is clinically beneficial for obese pets — it increases satiety and slows gastric emptying.
Current behavior: fiber penalty reduced by 50% only when the product AAFCO statement includes "weight management" or "light."
Extended behavior: Also reduce fiber penalty by 50% when the pet has the obesity condition, regardless of product labeling. This prevents false positives where an obese cat's owner scans a higher-fiber food that's actually appropriate for their pet's situation.
Implementation: In the fiber scoring function, check pet.conditions.includes('obesity') in addition to the existing AAFCO label check. Same 50% reduction, same math. One additional condition in the if clause.
5. Cat hepatic lipidosis guard (already specified — reaffirmed here):
If pet is a cat with obesity condition and goal_weight set, and the implied weight loss rate exceeds 1% body weight per week, display a red warning: "Projected weight loss rate exceeds safe limits for cats. Rapid weight loss in cats can cause hepatic lipidosis (fatty liver disease). Consult your veterinarian before starting a weight loss plan."
This guard already exists in the spec. Reaffirmed here because weight management is the primary context where it fires.
6. Geriatric cat calorie protection (already specified — reaffirmed here):
Cats aged 12+ often need MORE calories, not fewer. If a geriatric cat has obesity condition, the portion calculator still uses goal weight, but the DER multiplier uses the geriatric range (1.1-1.6× RER per NRC 2006). The system does not allow geriatric cats to be portioned below the geriatric floor. This prevents well-meaning owners from starving elderly cats.
What this decision explicitly rejects:

❌ Caloric density as a score modifier (kcal/cup or kcal/kg affecting suitability %)
❌ Fat content penalties specific to obese pets (fat is already scored in the nutritional bucket — adding an obesity multiplier would double-count it)
❌ Carb content penalties specific to obese pets (same double-counting concern; cat carb penalty in Layer 2 already handles species-level carb sensitivity)
❌ "Weight management food recommended" advisory (UPVM violation — D-095 prohibits feeding directives)
❌ Any score modifier that would make a lower-quality food score higher than a higher-quality food purely due to caloric density

Rationale: The scoring engine answers "how suitable is this food's composition for your pet's species, breed, and age?" Weight management answers "how much of this food should your pet eat?" These are separate questions with separate tools. Conflating them produces misleading scores. The portion calculator, goal weight mode, fiber suppression, and UI advisories handle weight without distorting food quality assessment.
Compliance: D-094 (advisory card uses pet name), D-095 (no feeding directives — "portions are very small" is an observation, "feed a lower-calorie food" would be a directive and is NOT used), D-019 (brand-blind — no product recommendations in advisory).
Sources:

German AJ. The growing problem of obesity in dogs and cats. Journal of Nutrition 136(7):1940S-1946S, 2006
Laflamme DP. Nutrition for aging cats and dogs and the importance of body condition. JAVMA 226(3):332-339, 2005
NRC (2006), Ch. 15 — Feeding of Normal Dogs and Cats (geriatric calorie requirements)
Center SA. Feline hepatic lipidosis. Veterinary Clinics of North America: Small Animal Practice 35(1):225-269, 2005

### D-107: Concern Tags — Consumer-Facing Category Badges
**Status:** LOCKED
**Date:** Feb 26, 2026
**Depends on:** D-105 (Ingredient Detail Modal), D-095 (UPVM Compliance), D-094 (Suitability Framing)

**Decision:** Five concern tags displayed above the fold on the scan result screen. Tags fire when a product contains one or more ingredients in the tagged group. They answer "what KIND of problem does this food have?" — not which specific ingredients are concerning (that's the severity badge strip's job).

**The five tags:**

| Tag | Emoji | Member count | Example members |
|-----|-------|-------------|-----------------|
| Artificial Color | 🎨 | 7 | Red 40, Yellow 5, Yellow 6, Blue 2, Titanium Dioxide |
| Added Sugar | 🍬 | 2 | Sugar, Cane Molasses |
| Unnamed Source | ❓ | 7 | Meat Meal, Animal Fat, Animal Digest, Poultry By-Product Meal, Meat By-Products, Poultry Fat, Natural Flavor |
| Synthetic Additive | 🧪 | 9 | BHA, BHT, TBHQ, Propylene Glycol, Ethoxyquin, Sodium Nitrite, Potassium Sorbate, Calcium Propionate, Phosphoric Acid |
| Heart Risk | 🫘 | 8 | Peas, Lentils, Chickpeas, Pea Protein, Pea Starch, Potatoes, Sweet Potatoes, Potato Starch |

**Heart Risk tag — conditional rendering (updated Feb 27, 2026):**
The Heart Risk tag does NOT render on simple ingredient presence. It is conditionally bound to the D-013 DCM rule: the tag only renders when `cluster_count >= 3` legume/potato sources appear in the top 7 ingredients (the same threshold that triggers the score penalty). Without this gating, a 95/100 meat-first kibble containing trace "Pea Fiber" at position #15 would display a cardiac warning badge while receiving no score penalty — an instant credibility-destroying contradiction.

Additionally, potatoes, sweet potatoes, and potato starch were added to the Heart Risk member list per the FDA CVM investigation, which explicitly includes potatoes alongside legumes in the DCM-associated dietary pattern.

**Explicitly rejected tags:**
- ❌ **Filler** — Cannot be applied defensibly to all proposed members. Tapioca starch and powdered cellulose are genuinely nutritionally empty (citations available), but corn and wheat are peer-reviewed nutrient contributors (Tufts Petfoodology, Peixoto et al. 2021, Walker et al. 1994). No umbrella term fits the group: "Low-Starch Carb" fails because cellulose is zero-starch; "Carb" fails because cellulose is zero-carb. Severity ratings + ingredient detail modals handle these individually.
- ❌ **Allergen Risk** — After moving Natural Flavor to Unnamed Source, only soy remained. Group too small for dedicated tag. Soy allergy handled by Layer 3 personalization (D-097).

**Display rules:**
- Tags render only when at least one member ingredient is present in the product — **except** Heart Risk, which requires D-013 conditions (3+ legume/potato in top 7)
- Maximum display: 3 tags above the fold (most severe first). If 4+ fire, "+N more" chip expands on tap.
- Heart Risk tag renders for dogs only (DCM advisory is dog-specific per Layer 2 species rules)
- Tags are informational badges — they do NOT modify scores. Score impact comes from the individual ingredient severity ratings already in Layer 1.
- Tag tap → brief explainer tooltip (1-2 sentences, clinical copy per D-095). Not a full modal.

**Implementation:** Tags are derived at render time from the product's ingredient list cross-referenced against a static tag membership map. No new database columns needed — the tag map lives in app code as a constant.

**Rationale:** Severity badges tell you WHICH ingredients are concerning but not WHY. Two orange dots — one for Yellow 5, one for Meat Meal — look identical but represent completely different concerns (artificial colorant vs traceability). Tags provide instant categorical context that helps the user understand the nature of the concern without reading ingredient details.

### D-108: Scan Result Screen — Single Screen Progressive Disclosure
**Status:** LOCKED
**Date:** Feb 26, 2026
**Depends on:** D-094 (Suitability Framing), D-107 (Concern Tags), D-105 (Ingredient Detail Modal), D-085 (Tab Structure)

**Decision:** Scan result is a single scrollable screen with progressive disclosure. No separate "simple" vs "detailed" views. No tabs or toggles.

**Above the fold (visible without scrolling — optimized for 10-second store aisle decision):**
1. **Score gauge** — "[X]% match for [Pet Name]" with pet photo, animated ring (D-094)
2. **Concern tags** — Up to 3 tags from D-107 if any fire. Tappable for tooltip.
3. **Severity badge strip** — 4-5 worst-scoring ingredients as color-coded chips (red/orange), sorted worst-first, tappable into D-105 ingredient detail modal. Only score-movers shown, not every ingredient.
4. **Safe Swap CTA** — One better alternative, tappable. (Placeholder until M6 Alternatives Engine — renders only when data available)

**Below the fold (scroll to explore — for at-home deep dives):**
5. **Kiba Index** — Taste Test + Tummy Check community ratings. (Placeholder until M8 — hidden until data available)
6. **Score breakdown waterfall** — Three layers as tappable bars showing point deductions (D-094 layer names)
7. **Full ingredient list** — ALL ingredients sorted worst→best, color-coded by severity, each tappable into D-105 detail modal. This is competitive advantage — Pawdi/Doggo Eats lack ingredient-level depth. Visible on scroll (not hidden behind a toggle) so users discover depth naturally.
8. **"Track this food" CTA** — Adds product to pet's pantry (M5). Connects to symptom tracking from Me tab without cluttering scan screen.

**Explicitly NOT on scan result screen:**
- ❌ Poop Check / Symptom Tracker — These are about the pet over time, not about this product. Lives in Me tab / pet profile.
- ❌ Community discussion / reviews — M8+ scope

**Rationale:** 95% of scans are "should I buy this?" decisions made in under 10 seconds in a store aisle. 5% are at-home deep dives. The layout nails the 10-second answer above the fold while making depth available on scroll for curious users. Two separate views would create a navigation decision where there shouldn't be one. Progressive disclosure means scan → answer → scroll deeper if curious — no mode switching, no tabs, no cognitive load.

**M1 implementation note:** M1 builds the full scroll structure but Safe Swap (M6) and Kiba Index (M8) sections are not rendered until their milestones. The skeleton is: score gauge → concern tags → severity badges → waterfall → full ingredient list.

### D-109: Breed Modifier Data Storage → Static JSON
**Status:** LOCKED
**Date:** Feb 27, 2026
**Depends on:** BREED_MODIFIERS_DOGS.md, BREED_MODIFIERS_CATS.md, NUTRITIONAL_PROFILE_BUCKET_SPEC.md §6

**Decision:** Breed modifier data ships as static typed JSON in `src/content/breedModifiers/`, following the same pattern as `src/content/explainers/`. NOT stored in Supabase. NOT fetched at runtime.

**Structure:**
```
src/content/breedModifiers/
  index.ts          ← exports + lookup function
  dogs.ts           ← 20 breed entries, typed per BreedModifier interface
  cats.ts           ← 18 breed entries, typed per BreedModifier interface
```

**Rationale:** 38 total breed entries (~15-20KB). Data changes only after vet audit cycles (weeks). App releases are hours. Supabase round-trip adds network dependency on the scoring critical path for data that changes maybe once a quarter. Static JSON means: no async fetch, no cache invalidation, no offline-sync edge cases, deterministic scoring, directly importable by the scoring engine.

**Update path:** When breed data changes (new vet audit clears a modifier), update the static files and ship an app update. This is the same path explainer content follows.

**Rejected:**
- ❌ Supabase `breed_modifiers` table — network dependency for 38 rows of rarely-changing data, no benefit over static
- ❌ Seed Supabase + cache locally (hybrid) — solves a problem we don't have, adds cache invalidation complexity

### D-110: Canonical Table Name → `pets`
**Status:** LOCKED
**Date:** Feb 27, 2026

**Decision:** The pet data table is named `pets`, not `pet_profiles`. All foreign keys reference `pets(id)`. All documentation, migrations, and code use `pets` as the canonical name.

**Rationale:** Shorter, cleaner FK reads (`pet_id → pets.id` vs `pet_id → pet_profiles.id`). CLAUDE.md and DECISIONS.md already used `pets`. ROADMAP.md was the only outlier using `pet_profiles`.

### D-111: Concern Tag Visual Identifiers — SF Symbols, Not Emoji (D-084 Compliance)
**Status:** LOCKED
**Date:** Feb 27, 2026
**Depends on:** D-084 (Zero Emoji Policy), D-107 (Concern Tags)

**Decision:** The emoji characters in D-107's tag table (🎨🍬❓🧪🫘) are internal identifiers used in documentation and the static tag map constant ONLY. The actual app UI renders **SF Symbols** per D-084. No Unicode emoji characters appear in the rendered interface.

**SF Symbol mapping:**
| Tag | Doc Identifier | SF Symbol (iOS) |
|-----|---------------|-----------------|
| Artificial Color | 🎨 | `paintpalette` or `eyedropper.halffull` |
| Added Sugar | 🍬 | `cube` or custom sugar icon |
| Unnamed Source | ❓ | `questionmark.circle` |
| Synthetic Additive | 🧪 | `flask` or `atom` |
| Heart Risk | 🫘 | `heart.text.square` or `leaf` |

**Final SF Symbol selections** will be locked during M1 build when visual design is finalized. The mapping above is directional — the constraint is D-084 compliance, not specific icon choices.

---
*This document is append-only. Decisions are never silently edited — they are superseded by new decisions with explicit rationale.*
