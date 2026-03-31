# Kiba — Decision Log

> Single source of truth for every product, technical, and strategic decision.
> Updated: March 26, 2026 (128 decisions, D-001 through D-166, non-sequential. D-052 revised for M3. D-013 superseded by D-137. D-113 superseded by D-136. D-061 superseded by D-160. D-141 section headers superseded by D-143. D-065 partially superseded by D-152. D-152 recommendation behavior partially superseded by D-165. D-150: life stage mismatch moved to Layer 3. D-151: under-4-weeks nursing advisory. D-152–D-158: M5 Pantry + Recall Siren decisions. D-159: low-score feeding context line. D-160–D-165: M5 Phase 2. D-166: weight unit auto-conversion + cups conversion.)

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
**Status:** SUPERSEDED by D-137
**Date:** Feb 19, 2026
**Superseded:** Mar 14, 2026 — DCM trigger logic replaced by D-137 positional pulse load framework. Grain-free gate removed, potatoes exonerated, 3-rule OR replaces simple count threshold. Penalty magnitude unchanged (−8% / +3% mitigation).
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
5. "Personalizing for [Pet Name]..."
6. "Calculating [weight formula] weighted score..."
**Purpose:** Tells user engine is doing real work across all three scoring layers. Builds confidence.

### D-038: AAFCO Nutrition Panel
**Status:** LOCKED
**Date:** Feb 19, 2026
**Decision:** Expandable section (labeled "[Pet Name]'s Nutritional Fit" per D-094; "Macro Profile" for supplementals per D-147) with colored progress bars for Protein, Fat, Fiber, Moisture vs AAFCO minimum thresholds. Bonus nutrient grid for DHA, Omega-3, Taurine, L-Carnitine, Zinc, Probiotics where present. Life stage matching (AAFCO All Life Stages vs Adult Maintenance vs Growth).

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

### D-052: Paywall Trigger Moments
**Status:** LOCKED (updated M3 Session 5 — D-125 removed recall, added compare)
**Date:** Feb 19, 2026 (revised March 5, 2026)

**5 active triggers:**

| Trigger | Copy |
|---------|------|
| 6th scan in rolling 7-day window | "You've used your 5 free scans this week. Go unlimited for $24.99/year." |
| Second pet profile | "Multi-pet households need Premium. Add all your pets!" |
| First safe swap tap | "Find healthier alternatives for your pet." |
| Search by name | "Search any product without scanning. Find scores for products you're considering online." |
| Compare (side-by-side) | "Compare products side-by-side to find the best match for [Pet Name]." |

**2 pre-wired (hidden until feature ships):**
- Vet report generation (M6)
- Elimination diet trial start (M16+)

**Removed:** Recall alert signup — moved to free tier per D-125.

**Note:** Search by product name (text lookup, not barcode) is a premium feature. Free users must scan barcodes. This gates a power-user behavior that signals high intent — these users convert well. Scan limit uses rolling 7-day window based on DB timestamps (not calendar week reset).

### D-053: Affiliate Architecture — Amazon Compliance
**Status:** LOCKED (revised March 31, 2026 — FTC disclosure moved to About page)
**Date:** Feb 19, 2026
**Decision:**
- Chewy: Show estimated price with label "View on Chewy (Est. ~$45.99)" — labeled as estimate, compliant
- Amazon: "Check Current Price on Amazon" — intentionally hides price per Amazon Associates TOS
- FTC disclosure in About/Legal section (not inline on every screen — screen bloat)
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
**Status:** SUPERSEDED by D-160
**Superseded:** D-160 replaces raw goal weight input with weight goal level slider (-3 to +3).
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
**Status:** LOCKED (Partially superseded by D-152 — depletion model updated to user-set serving amounts. DER is now a recommendation, not the computation source. Mixed-feeding proportion slider rejected by D-152 in favor of user-entered per-food amounts.)
**Date:** Feb 19, 2026 (Updated Feb 25, 2026 — shared pantry support. Superseded March 19, 2026 by D-152.)
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

~~**Mixed-feeding proportion (added Feb 27, 2026):**~~
~~Superseded by D-152. The proportion slider was rejected in favor of user-entered per-food serving amounts. See D-152 for the current depletion model.~~

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

### Pure Balance Wild & Free Salmon & Pea (Dog Food)
**Score:** 62/100 — "Low match · Pulse Load, Unnamed Sources"
**Note:** Updated March 19, 2026 — rescored after D-137 DCM Pulse Framework replaced grain-free gate with positional pulse load detection. Previous Section 11 score was 65 (pre-D-137). DCM advisory now fires: 3 pulse rules triggered (pulse protein isolate in top 5, pulse load ≥3 in top 10, pulse-to-animal-protein ratio). Taurine + L-Carnitine mitigation applies (+3%). Net DCM impact: −5%.

| Layer | Raw | Weight | Contribution |
|-------|-----|--------|-------------|
| Ingredient Quality (incl. −4 unnamed) | 58 | ×0.55 | 31.9 |
| Nutritional Profile | 79 | ×0.30 | 23.7 |
| Formulation Completeness | 63 | ×0.15 | 9.5 |
| **Base** | | | **65** |
| DCM Advisory (D-137) | | | −8 |
| Taurine + L-Carnitine Mitigation | | | +3 |
| Breed Modifier (Buster) | | | +2 |
| **FINAL** | | | **62** |

### Temptations Classic Tuna (Cat Treat)
**Score:** 9/100 — "Poor match for Luna"
**Note:** Updated March 19, 2026 — rescored after D-142 artificial colorant severity escalation (caution → danger). Three colorants (Red 40, Yellow 5, Blue 2) at 15 pts each = 45 pts penalty. Presence-based (no position reduction). Previous Section 11 score was 44 (pre-D-142).
IQ raw = 19 (base 52, minus 45 colorant penalties, plus other adjustments). Taurine missing penalty: −10. Scoring mode: 100% IQ (treat). Final = 9.

---

### D-094: Score Framing — Suitability Match Language
**Status:** LOCKED — Non-negotiable
**Date:** Feb 24, 2026

All scores display as "[X]% match for [Pet Name]" — never "This product scores [X]." The score is a pet-specific suitability match, not a universal product quality rating.

**Required language:**
- Always: "[X]% match for [Pet Name]" / "compatibility deduction" / "suitability estimate" / "adjustment"
- Never: "This product scores [X]" / "quality rating" / "product grade" / "penalty" (user-facing)
- Waterfall labels (5 rows, top to bottom):
  1. "Ingredient Concerns" (Layer 1 ingredient quality deductions)
  2. "[Pet Name]'s Nutritional Fit" (Layer 1 nutritional profile bucket)
  3. "Formulation Quality" (Layer 1 formulation completeness bucket)
  4. "[Species] Safety Checks" — e.g. "Canine Safety Checks" / "Feline Safety Checks" (Layer 2 species rules)
  5. "[Pet Name]'s Breed & Age Adjustments" (Layer 3 personalization)
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

### D-099: Vet Report — Pet Dietary Profile (M6)
**Status:** LOCKED
**Date:** Feb 25, 2026
**Depends on:** D-097 (conditions/allergens), D-098 (cross-reactivity), D-094/D-095 (copy rules)
**Milestone:** M6 (moved from M4 based on soft launch feedback)

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

**Vet report upgrade (Type B: Trial Completion):** D-099 infrastructure gains trial-specific sections: outcome summary stat callouts, executive summary (templated prose, NOT AI per D-034), symptom timeline chart + weekly scoring table, contamination event log, pattern detection insights, reintroduction log. All base report sections carry forward. Trial report is superset.

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

**Future:** Appointment history feeds into vet report (D-099) as a "Recent Vet Visits" section. Not at M5 launch — add when data accumulates.

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
| Danger | 🔴 Severe | Red |

*(Note: Internal enum remains `danger`; UI displays "Severe" per D-143.)*

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
### D-106: Weight Management — Advisories, Not Score Modifiers
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
| Heart Risk | 🫘 | 6 | Peas, Lentils, Chickpeas, Fava Beans, Pea Protein, Pea Starch (D-137: pulses only, potatoes removed) |

**Heart Risk tag — conditional rendering (updated Mar 19, 2026 per D-137):**
The Heart Risk tag does NOT render on simple ingredient presence. It is conditionally bound to the D-137 DCM Pulse Framework: the tag only renders when any D-137 rule fires (heavyweight: pulse in top 3, density: 2+ pulses in top 10, or substitution: pulse protein isolate in top 10). Without this gating, a 95/100 meat-first kibble containing trace "Pea Fiber" at position #15 would display a cardiac warning badge while receiving no score penalty — an instant credibility-destroying contradiction.

**Note:** Potatoes, sweet potatoes, and potato starch were originally included per the FDA CVM investigation but were **removed by D-137**, which narrowed DCM scope to pulses only based on amino acid depletion mechanism evidence. See D-137 for rationale.

**Explicitly rejected tags:**
- ❌ **Filler** — Cannot be applied defensibly to all proposed members. Tapioca starch and powdered cellulose are genuinely nutritionally empty (citations available), but corn and wheat are peer-reviewed nutrient contributors (Tufts Petfoodology, Peixoto et al. 2021, Walker et al. 1994). No umbrella term fits the group: "Low-Starch Carb" fails because cellulose is zero-starch; "Carb" fails because cellulose is zero-carb. Severity ratings + ingredient detail modals handle these individually.
- ❌ **Allergen Risk** — After moving Natural Flavor to Unnamed Source, only soy remained. Group too small for dedicated tag. Soy allergy handled by Layer 3 personalization (D-097).

**Display rules:**
- Tags render only when at least one member ingredient is present in the product — **except** Heart Risk, which requires D-137 conditions (any of: pulse in top 3, 2+ pulses in top 10, or pulse protein isolate in top 10)
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
6. **Score breakdown waterfall** — Five rows as tappable bars showing point deductions with expand/collapse (D-094 layer names). Rows: Ingredient Concerns → [Pet Name]'s Nutritional Fit → Formulation Quality → [Species] Safety Checks → [Pet Name]'s Breed & Age Adjustments.
7. **Full ingredient list** — ALL ingredients sorted worst→best, color-coded by severity, each tappable into D-105 detail modal. This is competitive advantage — Pawdi/Doggo Eats lack ingredient-level depth. Visible on scroll (not hidden behind a toggle) so users discover depth naturally.
8. **"Track this food" CTA** — Adds product to pet's pantry (M5). Connects to symptom tracking from Me tab without cluttering scan screen.

**Explicitly NOT on scan result screen:**
- ❌ Poop Check / Symptom Tracker — These are about the pet over time, not about this product. Lives in Me tab / pet profile.
- ❌ Community discussion / reviews — M8+ scope

**Rationale:** 95% of scans are "should I buy this?" decisions made in under 10 seconds in a store aisle. 5% are at-home deep dives. The layout nails the 10-second answer above the fold while making depth available on scroll for curious users. Two separate views would create a navigation decision where there shouldn't be one. Progressive disclosure means scan → answer → scroll deeper if curious — no mode switching, no tabs, no cognitive load.

**M1 implementation note:** M1 builds the full scroll structure but Safe Swap (M6) and Kiba Index (M8) sections are not rendered until their milestones. The M1 skeleton is: score gauge + verdict → concern tags → severity badges → waterfall (5 rows, expand/collapse) → nutritional profile (GA table with AAFCO markers) → ingredient splitting chip (conditional) → full ingredient list.

### D-109: Breed Modifier Data Storage → Static JSON
**Status:** LOCKED
**Date:** Feb 27, 2026
**Depends on:** BREED_MODIFIERS_DOGS.md, BREED_MODIFIERS_CATS.md, NUTRITIONAL_PROFILE_BUCKET_SPEC.md §6

**Decision:** Breed modifier data ships as static typed JSON in `src/content/breedModifiers/`, following the same pattern as `src/content/explainers/`. NOT stored in Supabase. NOT fetched at runtime.

**Structure:**
```
src/content/breedModifiers/
  index.ts          ← exports + lookup function
  dogs.ts           ← 23 breed entries, typed per BreedModifier interface
  cats.ts           ← 21 breed entries, typed per BreedModifier interface
```

**Rationale:** 44 total breed entries (~15-20KB). Data changes only after vet audit cycles (weeks). App releases are hours. Supabase round-trip adds network dependency on the scoring critical path for data that changes maybe once a quarter. Static JSON means: no async fetch, no cache invalidation, no offline-sync edge cases, deterministic scoring, directly importable by the scoring engine.

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

### D-112: Breed Contraindications — Hard Warnings, Not Score Modifiers
**Status:** LOCKED
**Date:** Feb 27, 2026
**Depends on:** D-094 (Suitability Framing), D-095 (UPVM Compliance), D-097 (Allergen Profile), D-109 (Breed Modifier Storage)

**Decision:** Certain breed-specific metabolic incompatibilities are **binary medical risks** that cannot be adequately expressed through sub-score deductions. These are handled as `breed_contraindication` entries — visually identical to D-097 allergen warning cards — rather than nutritional bucket modifiers.

**Problem:** A −5 penalty to `protein_sub` for a Dalmatian eating high-purine food produces a final composite impact of ~0.5 points (after sub-weight × bucket weight). Kiba would display "94% match" for a food that causes urate urinary blockage requiring emergency surgery. Sub-score deductions cannot express "this food will hospitalize your dog."

**Mechanism:** Breed contraindications sit in Layer 3 (Personalization), alongside allergen warnings. They produce:
- **Zero score impact** (adjustment: 0)
- **Red warning card above the fold** — same visual treatment as `severity: 'direct_match'` allergen warnings
- **Contraindication label** following D-094 framing and D-095 clinical copy rules
- **type: 'breed_contraindication'** in PersonalizationDetail

**Breeds with contraindications (dogs):**

| Breed | Trigger | Card Text |
|---|---|---|
| Dalmatian | High-purine protein sources in ingredient list (organ meats, sardines, anchovies, mackerel, brewer's yeast) | "Contains high-purine protein sources. Dalmatians have a genetic uric acid metabolism defect (SLC2A9) that causes urate stone formation when fed high-purine proteins. Egg and dairy-based proteins are low-purine alternatives." |
| Irish Setter | Any gluten grain present (wheat, barley, rye, oats + derivatives) | "Contains gluten-containing grains. Irish Setters have documented gluten-sensitive enteropathy with partial villous atrophy. Clinical resolution occurs on gluten-free diets." |
| Border Terrier | Any gluten grain present (wheat, barley, rye — NOT oats) | "Contains gluten-containing grains. Border Terriers have documented paroxysmal gluten-sensitive dyskinesia (PGSD). Clinical resolution occurs on gluten-free diets." |

**Relationship to score modifiers:** Breeds with contraindications may ALSO have nutritional bucket modifiers (e.g., Dalmatian retains its GA-based protein_dmb modifier for cumulative purine load from non-contraindicated sources). The contraindication card and the bucket modifier are independent systems.

**Why not just set the score to 0?** A suitability score reflects overall nutritional fit. A food could be nutritionally excellent in every other dimension but contain one contraindicated ingredient. The warning card communicates the binary risk; the score communicates everything else. This parallels how allergen warnings work — a peanut-allergic person's meal isn't "0% nutritious," it just contains something dangerous for them specifically.

**Rationale:** Binary metabolic incompatibilities (100% genetic penetrance enzyme defects, documented enteropathy with villous atrophy) are categorically different from "this breed does slightly better with less fat." The scoring engine's continuous 0-100 scale cannot express binary risk. Allergen-style warning cards can.

**Rejected:**
- ❌ Larger score penalties (−20, −30) — still produces misleading composite scores; a −30 on a 95 base = "65% match" which implies "mediocre" not "dangerous"
- ❌ Score floor/cap for contraindicated products — conflates nutritional quality with medical compatibility
- ❌ Blocking the scan entirely — user needs to see the product's nutritional profile even if contraindicated

---

### D-113: Score Ring Color Breakpoints + Verdict Tiers
**Status:** SUPERSEDED by D-136
**Date:** Feb 28, 2026
**Depends on:** D-094 (Suitability Framing), D-086 (Color Scheme)
**Superseded:** D-136 replaced the 4-tier scheme below with a 5-tier dual color system. See D-136 for the current color breakpoints. The original 4-tier table is preserved for historical context only.

~~**Decision:** Four-tier color + verdict system for the score ring.~~

| Score Range | Ring Color | Hex | Verdict Text | Status |
|-------------|-----------|-----|-------------|--------|
| 80–100 | Green | #34C759 | "Great match" | Replaced by 85–100 Dark Green / 70–84 Light Green |
| 70–79 | Cyan | #00B4D8 | "Good match" | Replaced — cyan reserved for supplementals only (D-136) |
| 50–69 | Amber | #FF9500 | "Fair match" | Split into 65–69 Yellow / 51–64 Amber (D-136) |
| 0–49 | Red | #FF3B30 | "Poor match" | Unchanged (now 0–50) |

**Implementation (current — per D-136):**
- `getScoreColor(score, productType)` — takes product type to select daily food (green family) vs supplemental (teal/cyan family) color scale
- Ring color and verdict text always share the same tier
- Verdict text renders BELOW the ring, 16pt semibold, color-matched
- **Hard rule:** Green NEVER on supplementals. Teal/cyan NEVER on daily food/treats.

**Rationale (preserved):** Pure Balance at 65% renders as yellow "Fair match" — correct for a grain-free food with legume concerns and ingredient splitting. The 65–69 yellow band (added in D-136) provides a "fair, not bad" signal that the old amber-only range (50–69) didn't convey.

---

## 12. M2 Profile Design

### D-116: Approximate Age Mode for Rescue Pets
**Status:** LOCKED
**Date:** March 1, 2026
**Depends on:** D-064 (life_stage derivation)

**Decision:** Birthday field offers a toggle: `[Exact Date] | [Approximate Age]`. Approximate mode takes Years (0-30) + Months (0-11) inputs. Backend synthesizes a DOB: `today - (years×12 + months) months`, pinned to 1st of month. `pets.dob_is_approximate BOOLEAN DEFAULT false` tracks provenance.

**Rationale:** ~25-30% of pet owners have rescue animals with unknown exact birthdays. Forcing an exact date causes friction (users guess inaccurately) or abandonment (users skip the field entirely). Either outcome degrades life stage derivation quality. The synthesized DOB feeds into D-064 identically — the life stage engine doesn't need to know whether the date is exact or approximate.

**Schema:** `ALTER TABLE pets ADD COLUMN dob_is_approximate BOOLEAN DEFAULT false;`

**UI:** Default to Exact Date. Approximate mode uses two compact stepper inputs side by side. Toggle fires haptics.chipToggle() (D-121).

---

### D-117: Stale Weight Indicator
**Status:** LOCKED
**Date:** March 1, 2026
**Depends on:** D-060 (RER), D-062 (hepatic lipidosis guard)

**Decision:** Track `pets.weight_updated_at TIMESTAMPTZ`. If weight is >6 months old, show persistent amber prompt on Pet Hub: "Weight last updated [N] months ago — still accurate?" Tappable → Edit Profile weight field.

**Rationale:** Stale weight data corrupts DER calculations (D-060), goal weight math (D-061), and the cat hepatic lipidosis guard (D-062). A 15lb cat that actually weighs 12lb now gets a 25% wrong calorie target. The amber prompt is non-blocking (doesn't prevent scanning or scoring) but persistent — it won't disappear until the user updates weight or dismisses it.

**Schema:** `ALTER TABLE pets ADD COLUMN weight_updated_at TIMESTAMPTZ;`
**Trigger:** Set `weight_updated_at = NOW()` on any write to `weight_current_lbs`.

---

### D-118: Sex Field on Pet Profile
**Status:** LOCKED
**Date:** March 1, 2026
**Depends on:** D-094 (suitability framing), D-099 (vet report)

**Decision:** Add `pets.sex TEXT CHECK (sex IN ('male', 'female'))`. Optional field — null is valid. UI: segmented control `[ Male ] [ Female ]`, neither selected by default.

**Uses:**
1. **Vet report credibility (D-099):** Sex is standard on veterinary intake forms. Missing it undermines the clinical credibility of the PDF output.
2. **Pronoun personalization:** "his score" / "her score" vs "their score" in D-094 suitability copy. Falls back to "their" when sex is null.
3. **Future-proofing:** Spay/neuter timing recommendations, sex-linked condition prevalence.

**Zero scoring impact.** Sex does not modify any scoring layer. This is a display and reporting field only.

**Schema:** `ALTER TABLE pets ADD COLUMN sex TEXT CHECK (sex IN ('male', 'female'));`

---

### D-119: "Perfectly Healthy" Condition Chip
**Status:** LOCKED
**Date:** March 1, 2026
**Depends on:** D-097 (health conditions)

**Decision:** Add a special green chip (#34C759) with checkmark icon (SF Symbol `checkmark.shield`) to the top of the conditions grid. Label: "Perfectly Healthy."

**Behavior:**
- Tapping "Perfectly Healthy" deselects ALL condition chips.
- Tapping any condition chip deselects "Perfectly Healthy."
- Mutual exclusion: "Perfectly Healthy" OR condition chips, never both.
- Stores zero rows in `pet_conditions` — functionally identical to skipping the section.

**Rationale:** "None" or "Skip" feels like neglect. "Perfectly Healthy" reframes the same action as a positive declaration. Emotional upgrade at zero engineering cost. The green color (#34C759) and checkmark icon create a moment of pride for owners of healthy pets.

**No schema change.** Zero `pet_conditions` rows === "Perfectly Healthy" state.

---

### D-120: Multi-Pet Switching — Hub Carousel
**Status:** LOCKED
**Date:** March 1, 2026
**Depends on:** D-052 (paywall triggers), D-094 (suitability framing)

**Decision:** Horizontal row of pet avatars at the top of Pet Hub (Instagram Stories-style).

**Visual spec:**
- Active pet: full opacity, teal border (#00B4D8, 2px), 48px diameter
- Inactive pets: 50% opacity, no border, 36px diameter
- Rightmost position: "+ Add Pet" circle with plus icon
- Tap inactive → setActivePet(), all Hub cards update
- Smooth crossfade animation (no complex transitions)

**State:** `useActivePetStore` Zustand store holds `activePetId`, consumed globally by ScanScreen, ResultScreen, HomeScreen, and all pet-aware components.

**Free tier:** Single avatar, no carousel (1 pet max per D-052 trigger #2). Premium: carousel appears when 2+ pets exist. "+ Add Pet" on free tier triggers paywall via permissions.ts.

**M2 scope:** Carousel UI + store wiring only. Multi-pet pantry and multi-pet history are M5.

---

### D-121: Haptic Feedback Map
**Status:** LOCKED
**Date:** March 1, 2026

**Decision:** Standardize `expo-haptics` usage across the app via a wrapper utility: `src/utils/haptics.ts`.

| Interaction | Haptic Type | Function Name |
|---|---|---|
| Chip toggle (conditions, allergens, activity) | Light impact | `chipToggle()` |
| Species toggle / Scan button press | Medium impact | `speciesToggle()` / `scanButton()` |
| Save success / 100% profile / Barcode recognized | Success notification | `saveSuccess()` / `profileComplete()` / `barcodeRecognized()` |
| Hepatic lipidosis warning displayed | Error notification | `hepaticWarning()` |
| Delete confirmation tap | Heavy impact | `deleteConfirm()` |

**Implementation:** Named functions wrapping expo-haptics calls. Platform-check for Android compatibility (no-op on unsupported platforms). Single import pattern: `import { saveSuccess, chipToggle } from '@/utils/haptics'`.

**Rationale:** Haptics add tactile feedback that makes mobile interactions feel responsive and intentional. The mapped intensities match the emotional weight of each action — light for routine toggles, heavy for destructive actions, error notification for safety warnings.

---

### D-122: Species Selection Screen (Pre-Create)
**Date:** 2026-03-01
**Status:** Locked
**Context:** Species as an in-form segmented control felt wrong — it's the most fundamental choice and shouldn't sit alongside name and breed. Sex (D-118) was buried in Card 3 despite being a natural identity field.
**Decision:**
- Species captured on dedicated `SpeciesSelectScreen` before the create form — two large tappable cards: Dog / Cat
- Species passed as route param to `CreatePetScreen`, not a form field
- Sex (D-118) promoted from Card 3 → Card 1 (Identity), replacing species slot
- Card layout: Card 1 = Photo/Name/Sex, Card 2 = Breed/DOB/Weight, Card 3 = Activity/Neutered
- Edit screen: species not shown — immutable, delete + recreate as escape hatch (unchanged)
- No backend impact — `createPet()` receives species from route param instead of form state
**Depends on:** D-118, D-084, D-121

---

### D-123: Species-Specific Activity Labels
**Date:** 2026-03-01
**Status:** Locked
**Context:** "Low / Moderate / High / Working" means nothing to cat owners. Cat owners think in terms of indoor vs outdoor. Cats also have no "Working" DER multiplier in PORTION_CALCULATOR_SPEC.
**Decision:**
- Dogs: `[ Low ] [ Moderate ] [ High ] [ Working ]` — default: Moderate
- Cats: `[ Indoor ] [ Indoor/Outdoor ] [ Outdoor ]` — default: Indoor
- UI labels map to same DB enum: Indoor='low', Indoor/Outdoor='moderate', Outdoor='high'
- "Working" hidden for cats (no cat DER multiplier defined)
- DB column unchanged — `activity_level TEXT CHECK (IN ('low','moderate','high','working'))`
- No scoring/DER engine changes — mapping is purely UI-side
**Depends on:** PORTION_CALCULATOR_SPEC §3
```

And here's the **prompt to fix the existing CreatePetScreen** (since it was already built with the old labels):
```
Fix activity level in CreatePetScreen.tsx and EditPetScreen.tsx per D-123:

- Dogs: segmented control [ Low ] [ Moderate ] [ High ] [ Working ], default: Moderate
- Cats: segmented control [ Indoor ] [ Indoor/Outdoor ] [ Outdoor ], default: Indoor
- Species comes from route param (create) or pet data (edit) — use it to pick which labels to show
- UI label → DB value mapping: Indoor='low', Indoor/Outdoor='moderate', Outdoor='high'
- "Working" only shown for dogs
- DB values unchanged — this is purely a label change

@PET_PROFILE_SPEC.md §11 for the spec. Run full test suite after.

---
### D-124 (Revised): Treat Logging — Quick Picker Default, Scanner Fallback
**Status:** LOCKED
**Date:** 2026-03-21
**Supersedes:** D-124 original (scanner-first treat logging)
**Depends on:** D-163 (health records pattern), Treat Battery (Phase 2)
**Milestone:** M5 polish
**Decision:** "Log a Treat" on PetHubScreen opens a **quick picker sheet** listing the pet's existing pantry treats. One tap to log. Scanner is a fallback at the bottom.
**Quick picker flow:**
1. User taps "Log a Treat" on PetHubScreen (below TreatBatteryGauge)
2. Bottom sheet slides up: "Log a Treat for [Pet Name]"
3. List of active pantry treats for this pet — tap → immediately calls `logTreat(pantryItemId)`: deducts 1 from `quantity_remaining`, deducts `kcal_per_unit` from Treat Battery daily budget, toast, sheet closes. One tap, no confirmation.
4. At bottom: "Scan a new treat" link → ScanScreen with `{ treatMode: true }`
5. Empty state: "No treats in [Pet Name]'s pantry yet." + "Scan a Treat" button
**ScanScreen treat mode:** After scan, if treat → AddToPantrySheet with treat defaults → return to PetHubScreen. If not treat → normal ResultScreen flow.
**PantryCard "Gave a treat" button:** Unchanged — same `logTreat()`, alternate entry from pantry screen.
**Multi-pet:** Quick picker shows treats for **active pet** only.
**Component:** `src/components/treats/TreatQuickPickerSheet.tsx`
**Rationale:** 90% of treat logs are for products already in pantry. Camera is friction for repeat actions. Scanner stays available as fallback for new treats.
---

### D-125: Recall Siren → Free Tier
**Status:** LOCKED
**Date:** 2026-03-03
**Decision:** Recall Siren (recall alerts, FDA monitoring notifications) moves from premium
to basic/free tier.
**Rationale:** Greater user safety reach, community trust signal, freemium engagement driver.
Removes "Recall alert signup" from D-052 paywall triggers.

---
### D-126: Paywall Screen Psychology Patterns
**Status:** LOCKED
**Date:** 2026-03-03
**Decision:** Paywall screen implements four behavioral patterns:
1. Curiosity Gap: Safe Swap alternatives shown as blurred images behind paywall, not padlocked.
2. Identity Framing: "About $2/month to protect [Pet Name] for a full year" — subscription
   framed as pet care, not software purchase.
3. Endowment Effect: 2nd pet profile trigger leverages invested time in first profile.
4. Decoy Pricing: Annual card shows "$24.99/year (Just $2.08/mo)" with anchoring line.
**Rationale:** Behavioral psychology maximizes $24.99/yr conversion without dark patterns.

---
### D-127: API Keys Server-Side Only
**Status:** LOCKED
**Date:** 2026-03-03
**Decision:** No external API keys (Anthropic, etc.) in the React Native app
binary. All external API calls route through Supabase Edge Functions. For keyed APIs
(Anthropic), Edge Functions hold the secret server-side. For keyless APIs (UPCitemdb
free tier), Edge Functions still serve as an abstraction layer — swap to a paid UPC
API later without pushing an app update.
**Rationale:** App binaries can be reverse-engineered. Exposed keys = drained budgets.
Supabase Edge Functions provide secure key storage with row-level access control.

---
### D-128: Haiku Product Classification on Database Miss
**Status:** LOCKED
**Date:** 2026-03-04
**Decision:** When the parse-ingredients Edge Function processes OCR text from a database
miss (D-091), Haiku also classifies the product's category (daily_food, treat, supplement,
grooming) and target species (dog, cat, all). The Edge Function returns suggested values
with a confidence score. ProductConfirmScreen shows Haiku's suggestions as pre-selected
chips — user can tap to correct. Corrected values are stored alongside suggestions for
accuracy tracking.
**Rationale:** Users scanning an unknown product often don't know the scoring category.
Getting it wrong produces misleading scores (treat scored as daily food gets hammered by
missing-GA fallback). Haiku has strong signal from product name + ingredient text to
classify correctly. User confirmation preserves human oversight. Storing both suggested
and corrected values enables classification accuracy auditing.
**Category handling:**
- daily_food → score with D-017 partial fallback (78/22 if no GA)
- treat → score with 100/0/0 ingredient-only weighting
- supplement → store only, do NOT score (D-096), show "Supplement scoring coming soon"
- grooming → store only, do NOT score (D-083), show "Grooming scoring coming soon"

---
### D-129: Allergen Severity Override in Layer 3
**Status:** LOCKED
**Date:** 2026-03-07
**Milestone:** M4
**Decision:** When a pet has a declared allergen, all ingredients matching that allergen (via allergen_group or allergen_group_possible) have their effective severity overridden to 'caution' for that pet's score calculation. This feeds into the existing position-weighted Layer 1a scoring — no flat penalty needed.

**Mechanism:**
- Direct match (allergen_group = pet's allergen): severity → 'danger', ingredient list shows red with "[Pet Name] has a [allergen] sensitivity"
- Possible match (allergen_group_possible contains pet's allergen): severity → 'caution', ingredient list shows orange with "May contain [allergen] — unnamed source"

**Amendment (2026-03-08):** Direct matches escalated from 'caution' (8pts) to 'danger' (15pts). Rationale: a confirmed allergen for a specific pet is not "questionable" — it will cause an adverse reaction. 'danger' per ingredient, position-weighted, correctly pushes allergen-heavy products into amber/red territory. Possible matches remain 'caution' (uncertain).
- Base severity in ingredients_dict is unchanged — override is per-pet, per-score only
- Position weighting still applies: allergen at position 1 hurts more than position 15
- Stacks with existing Layer 3 allergen warnings (which become redundant once this ships — the warnings will reflect actual score impact instead of being informational-only)

**Why not a flat penalty:**
A flat -15 on a 95-score product still shows green/excellent. The severity override lets the existing position-weighted math scale the penalty naturally — a chicken-first food drops much harder than a food with chicken broth at position 12.

**UI:** Direct-match ingredients render in danger color (red); possible-match in caution color (orange), both with a personalized note explaining why. Score waterfall shows the deduction under "[Pet Name]'s Allergen Sensitivity" row.

**Depends on:** D-097 (allergen picker), D-098 (cross-reactivity), allergen_group mappings complete in ingredients_dict
---
### D-130: Weekly Digest Push Notification
**Status:** LOCKED
**Date:** 2026-03-07
**Milestone:** M5
**Decision:** Weekly push notification summarizing the user's scan activity, pantry state, and recall alerts. Solves the Day 2 / Day 7 retention gap between first scan and Pantry engagement.
**Content:** "This week: [X] scans, avg score [Y]. Your highest match was [product] at [Z]%. [N] recalls issued in your region." Adapts based on activity — if no scans, nudge: "Haven't scanned this week — check what's in your pantry."
**Implementation:** Supabase scheduled function (pg_cron or Edge Function on timer). Queries scans, pantry_items, and recall status per user. Sends via Expo push notifications.
**Frequency:** Weekly (configurable to daily in settings, default weekly).
**Free tier:** Yes — digest is free for all users. Encourages re-engagement that drives scan limit hits (conversion funnel).

---
### D-131: Widget + Watch App Platform Expansion
**Status:** LOCKED
**Date:** 2026-03-07
**Milestone:** Widget = M13+ (post-launch). Watch = M16+.
**Decision:** Two companion platform expansions:

**iOS Home Screen Widget (M13+):**
- Small widget: Next feeding time + pet photo
- Medium widget: Pantry low-stock alerts + next feeding + treat battery remaining
- Large widget: Weekly scan summary + feeding schedule + recall alert badge
- Implementation: expo-widgets or native Swift WidgetKit bridge
- Retention play: home screen presence keeps Kiba top-of-mind between shopping trips

**Apple Watch App (M16+):**
- Complications: Trial day count (elimination diet), next feeding time, quick symptom log button
- Symptom logging: 2-tap logging from Watch face — "How's [Pet Name] today?" → severity picker
- Elimination diet: Daily check-in reminder, contamination alert display
- Critical for: Symptom Detective (M9) daily logging compliance, Elimination Diet (M16+) adherence
- Implementation: WatchOS companion app via Expo or native SwiftUI bridge

**Why separate milestones:** Widget is simpler (read-only data display) and higher retention ROI. Watch requires bidirectional data sync and is only valuable once Symptom Detective and Elimination Diet exist. Ship widget first.

**Rationale:** Daily logging features (symptoms, feeding, elimination diet) have dramatically higher compliance when accessible from Watch/Widget vs requiring full app open. The 2-tap Watch logging path vs 6-tap phone path is the difference between 80% and 30% daily adherence.

---
### D-132: Benchmark Bar Granularity
**Status:** LOCKED
**Date:** 2026-03-07
**Milestone:** M4
**Decision:** Benchmark bar uses 8 category segments: (daily_food|treat) × (dog|cat) ×
(grain_free|not_grain_free). Pre-computed via batch scoring script, stored in
category_averages table. Updated monthly after formula change detection runs.
Partial-score products (score_confidence = 'partial') excluded from averages.
**Rationale:** 4 segments too coarse — "grain-free salmon dog food" and "chicken kibble"
have very different score distributions. Brand-tier grouping deferred to M6+ (requires
more sophisticated taxonomy).

---
### D-133: Flavor Deception Detection Logic
**Status:** LOCKED
**Date:** 2026-03-07
**Milestone:** M4
**Decision:** Three-layer flavor deception treatment fires when: (1) product name contains
a protein keyword, (2) that protein is at position 5+ in the ingredient list OR absent
entirely, AND (3) a different protein is at position 1-2. Triggers below-fold
"Label Mismatch" explanation card and ingredient list annotation.
All copy is D-095 compliant — no "misleading," "deceptive," or "dishonest" language.
AAFCO naming rule cited for context.
**Canonical test case:** Temptations Classic Tuna — chicken at position 1, tuna buried deep.

---
### D-134: Ingredient Content Generation via Haiku
**Status:** LOCKED
**Date:** 2026-03-07
**Milestone:** M4
**Decision:** Top 200 ingredients by frequency (counted via product_ingredients junction) get consumer-facing content
(tldr, detail_body, citations) generated by Claude Haiku batch. All generated content
tagged with review_status = 'llm_generated'. Danger/caution-severity ingredients require
manual review before display. Neutral/good severity ingredients display immediately
with "AI-generated content" subtle indicator. Estimated cost: ~$0.50.

---
### D-135: Prescription/Therapeutic Diet Bypass
**Status:** LOCKED
**Date:** Mar 8, 2026
**Depends on:** D-094 (Suitability Framing), D-095 (UPVM Compliance), NUTRITIONAL_PROFILE_BUCKET_SPEC.md §11 Q5

**Decision:** Products flagged `is_vet_diet = true` are NOT scored. No composite score, no color zone, no benchmark comparison. The ingredient waterfall renders normally (severity dots, position, educational detail cards) so users can see what's in the product, but the scoring engine does not run.

**Rationale:** Veterinary diets (renal, hepatic, hydrolyzed protein, GI, urinary, etc.) intentionally deviate from standard AAFCO nutritional baselines to manage disease. Scoring them through the normal engine would penalize the very nutritional profile a veterinarian prescribed — producing a low score that implicitly tells the user "your vet is wrong." That crosses the UPVM line (D-095) by positioning Kiba as a second opinion on veterinary medical decisions.

**UI treatment:** Instead of a score ring, display a vet diet badge with copy:
> "This is a veterinary diet formulated for specific health needs. Ingredient details are shown below — discuss suitability with your veterinarian."

Ingredient waterfall, educational cards, and ingredient content (tldr, detail_body) still render. Kiba Index (Taste Test + Tummy Check) still collects data if available. No Safe Swap recommendations for vet diets.

**Detection — Two-tier confidence system (scraper-side):**

| Tier | Confidence | Trigger | Behavior |
|------|-----------|---------|----------|
| `veterinary` | High | Product name matches: "Royal Canin Veterinary Diet", "Hill's Prescription Diet", "Purina Pro Plan Veterinary", "Hydrolyzed Protein", "Hepatic", "Renal...Diet" | Sets `is_vet_diet = true` automatically |
| `veterinary-mention` | Low | "veterinary" appears anywhere in page text but no high-confidence pattern matched | Flagged for human review, NOT auto-bypassed |

**Schema:** `is_vet_diet BOOLEAN DEFAULT FALSE` on products table. High-confidence matches set TRUE at import. Low-confidence matches set FALSE with `needs_review = true` for review queue.

**What is suppressed:**
- Composite score (all three buckets)
- Color zone assignment (green/amber/red)
- BenchmarkBar comparison
- Safe Swap recommendations
- Category average inclusion (vet diets excluded from category_averages calculations)

**What still renders:**
- Ingredient waterfall with severity dots
- Educational detail cards (splitting, allergen flags, etc.)
- Ingredient content (tldr, detail_body)
- Kiba Index (Taste Test + Tummy Check)
- Formula change detection
- Allergen warnings (critical safety — always shown)

**Tracking:** `_ing_strategy` field on every record tracks which extraction strategy found its ingredients, for QA auditing independent of vet diet status.

---

### D-136: Supplemental Product Classification, Score Color System & Pantry Diet Completeness

**Status:** LOCKED
**Date:** 2026-03-13
**Milestone:** Classification gate + color system + ring + badge = M4 Session 6. Pantry diet completeness = M5.
**Supersedes:** D-113 (Score Ring Breakpoints). D-113's four-tier system (80+/70-79/50-69/<50) is replaced by D-136's five-tier system with new thresholds (85/70/65/51) and dual color scales.

---

## Problem Statement

Products labeled "intended for intermittent or supplemental feeding" (AAFCO-mandated language) are currently routed through the daily food scoring pipeline (55/30/15). This is structurally unfair — the 15% formulation completeness bucket penalizes supplemental products for not including vitamin/mineral premixes they never claimed to provide. A single-ingredient product like Against the Grain Nothing Else! Duck (ingredient list: "Duck.") would score in the 40s despite having a flawless ingredient profile.

Worse: platforms like Chewy list supplemental products under "Wet Food > Adult" alongside complete meals. The feeding statement is buried. Owners feeding supplemental foods as sole diets risk serious health consequences — pancreatis from high-fat single-protein supplementals, immune deficiency in kittens from nutritionally incomplete diets, mineral deficiencies over time. Kiba must communicate this visually and immediately, without relying on the owner reading fine print.

---

## Part 1: Supplemental Classification Gate

### Decision

Add a third category to D-010's category-adaptive weighting:

| Category | Ingredient Quality | Nutritional Profile | Formulation | Trigger |
|----------|-------------------|--------------------:|------------:|---------|
| Daily Food (kibble, wet, raw) | 55% | 30% | 15% | AAFCO "complete and balanced" or no feeding statement |
| Treats | 100% | 0% | 0% | Product categorized as treat |
| **Supplemental / Intermittent** | **65%** | **35%** | **0%** | AAFCO "intermittent or supplemental feeding" detected |

### Classification Logic

**At import time** (scraper pipeline), scan the scraped feeding guide text for AAFCO supplemental indicators:

- "intermittent"
- "supplemental feeding"
- "not intended as a sole diet"
- "for supplemental feeding only"
- "intended for intermittent or supplemental feeding"
- "mix with [brand] dry" / "serve alongside" (manufacturer variants)

Simple keyword match is sufficient — AAFCO language is standardized and manufacturers must include it for legal compliance.

**Schema change:** Add `is_supplemental BOOLEAN DEFAULT FALSE` to `products` table. Set at import, not at scoring time.

**Default behavior:** If no feeding statement is detected, product defaults to daily food classification. This is conservative — it's better to over-evaluate than under-evaluate.

### Weighting Rationale

**Why 65/35/0 and not 100/0/0 (treat weighting):**
Owners feed supplementals as meals — they care about macros, protein-to-fat ratio, and nutritional balance. A duck-only product at 21% fat DMB is relevant information for a pancreatitis-prone dog. Dropping nutritional profile entirely would hide that signal. The 65/35 split preserves ingredient quality as dominant (Kiba's moat) while keeping the nutritional bucket active for macro evaluation.

**Why 0% formulation:**
Supplemental products are not designed to provide complete nutrition. Penalizing for missing calcium, phosphorus, vitamin premixes, or mineral supplementation misrepresents the product's purpose. The formulation bucket is structurally inapplicable.

**Proportional redistribution:** Original daily food ratio of IQ:NP is 55:30 ≈ 1.83:1. New supplemental ratio of 65:35 ≈ 1.86:1 — nearly identical proportion, just without the formulation slice.

### Nutritional Profile Bucket Behavior for Supplementals

The 35% nutritional bucket for supplementals runs the **same scoring function** as daily food — AAFCO threshold checks, trapezoidal curves, DMB conversion — but with an important caveat: the NUTRITIONAL_PROFILE_BUCKET_SPEC.md penalty curves are calibrated for complete-and-balanced foods. A single-ingredient duck product will miss most AAFCO micronutrient ranges (calcium, phosphorus, etc.) not because it's low quality, but because it's not designed to hit them.

**Decision:** The NP bucket for supplementals evaluates **macro profile only** — protein, fat, fiber, and moisture against AAFCO ranges. Micronutrient AAFCO compliance checks (calcium, phosphorus, Ca:P ratio, omega ratios, etc.) are **skipped** for supplemental products, matching the same logic as dropping the formulation bucket: don't penalize for what the product doesn't claim to provide.

**What this means in practice:**
- Protein DMB vs AAFCO min/max → **evaluated** (an owner feeding this as a meal needs to know the protein level)
- Fat DMB vs AAFCO min/max → **evaluated** (high-fat supplementals are a real pancreatitis concern)
- Fiber DMB vs AAFCO max → **evaluated**
- Moisture → **evaluated** (for DMB conversion accuracy)
- Calcium, Phosphorus, Ca:P ratio → **skipped** for supplementals
- Omega-3/6 ratio, DHA, EPA → **skipped** for supplementals (these appear in BonusNutrientGrid as present/absent indicators, not as score penalties)
- Life stage AAFCO matching → **skipped** for supplementals (they don't carry life stage claims)

**Why not skip NP entirely (like treats)?** Because macros are the one nutritional dimension supplemental owners genuinely care about and that can cause real harm if wrong. A 21% fat DMB product fed daily to a pancreatitis-prone dog is information worth surfacing in the score. Micronutrients are not — they're the formulation bucket's concern, and we already dropped that.

**Implementation note:** This requires a `skipMicronutrients: boolean` flag passed to the nutritional profile scoring function, set to `true` when `is_supplemental = true`. The function already evaluates macros and micros in separate sub-sections per NUTRITIONAL_PROFILE_BUCKET_SPEC.md, so the separation is clean.

### Classification vs Category — Important Distinction

`is_supplemental` (D-136) is a **boolean modifier** on the products table, NOT a new value in the category enum. It is orthogonal to `haiku_suggested_category` from M3 (D-128):

- `haiku_suggested_category = 'supplement'` → vitamin/mineral supplement product (D-096, deferred M16+). Separate scoring model entirely.
- `is_supplemental = true` → daily food or wet food product with AAFCO intermittent/supplemental feeding statement. Scored via 65/35/0.

A fish oil capsule is a `'supplement'` (category). Against the Grain Nothing Else Duck is `category = 'daily_food'` with `is_supplemental = true`. These are completely different classification axes and must never be confused in implementation.

---

## Part 2: Score Color System

### Decision

Formalize score-to-color mapping for the first time. Two parallel color scales — daily food uses the green family, supplemental uses the teal/cyan family. Both converge at yellow/amber/red for lower scores.

**Daily Food color scale:**

| Range | Color | Hex | Meaning |
|-------|-------|-----|---------|
| 85–100 | Dark Green | #22C55E | Excellent match |
| 70–84 | Light Green | #86EFAC | Good match |
| 65–69 | Yellow | #FACC15 | Fair match |
| 51–64 | Amber | #F59E0B | Low match |
| 0–50 | Red | #EF4444 | Poor match |

**Supplemental color scale:**

| Range | Color | Hex | Meaning |
|-------|-------|-----|---------|
| 85–100 | Teal | #14B8A6 | Excellent match |
| 70–84 | Cyan | #22D3EE | Good match |
| 65–69 | Yellow | #FACC15 | Fair match |
| 51–64 | Amber | #F59E0B | Low match |
| 0–50 | Red | #EF4444 | Poor match |

### Rationale

**Green vs Teal/Cyan family separation:** A user should never confuse a supplemental product's score with a complete meal's score. Teal/cyan signals "this is a different kind of product" at a glance — no reading required. Teal (#14B8A6) at the top tier aligns directly with Kiba's brand palette, so supplemental products feel native rather than warned. Cyan (#22D3EE) at 70–84 steps cooler while staying vibrant and positive.

**Yellow band at 65–69:** Previously collapsed into amber (51–69). A 67 and a 53 tell very different stories — splitting the band gives users a "fair, not bad" signal that amber doesn't provide.

**Convergence at yellow and below:** Once a product drops below 65, the daily-vs-supplemental distinction matters less than the match quality. Shared colors from yellow downward mean communication is identical regardless of product type.

**All labels use D-094 suitability framing.** Excellent / Good / Fair / Low / Poor — everything stays in the "match" spectrum. No clinical vocabulary ("concerns," "issues," "risks"), no implied diagnosis.

**Daily food: green never appears on supplementals.** Supplemental: teal/cyan never appears on daily food. This is the hard rule — color families don't cross.

---

## Part 3: Score Ring Treatment

### Decision

**Daily food:** Full 360° solid ring (existing behavior).

**Supplemental:** Open arc ring — 270° arc with a visible gap. Visual metaphor: "this product is not complete on its own."

Optional: small "+" icon below or inside the ring reinforcing the "add to something" concept.

### Rationale

The open ring is intuitive after a single exposure. Full circle = complete meal. Broken circle = supplement/mixer. No copy needed to convey this. Combined with the cyan/blue color family, the visual language is redundant (each signal works independently) without being noisy.

This is also a differentiator — no competitor does this.

---

## Part 4: Supplemental Badge & Contextual Line

### Decision

**Badge:** Display "Supplemental" badge on product detail screen (same component pattern as "Partial" badge for missing GA).

**Contextual line below score:** "Best paired with a complete meal" — single line, D-095 compliant (purely factual, restating what the manufacturer declared on the label).

**D-095 Compliance Check**

- "Best paired with a complete meal" — ✅ No prescriptive language. No "should," "must," "we recommend." Objective restatement of the product's AAFCO-declared feeding purpose.
- Prohibited terms check: no prescribe, treat, cure, prevent, diagnose.

---

## Part 5: Pantry Diet Completeness Warnings (M5)

### Decision

The pantry (M5) introduces **diet-level completeness checking** — evaluating the combination of products assigned to a pet, not modifying individual product scores.

**Warning tiers based on pantry composition:**

| Pantry State | UI Treatment |
|-------------|-------------|
| Supplemental product(s) alongside ≥1 complete food | No warning. Optional small "Topper" tag on the supplemental's pantry card. |
| 2+ supplemental feeds, no complete food in pantry | Persistent amber warning banner: "⚠️ [Pet Name]'s diet may be missing essential nutrients. [Product] is designed as a supplement, not a complete meal. Consider adding a complete food." |
| ONLY supplemental products in pantry, zero complete food | Red diet health card at top of pantry: "🔴 No complete meals found in [Pet Name]'s diet. Supplemental foods don't provide all required vitamins and minerals on their own." |

### What This Is NOT

- **NOT a score modifier.** Product scores are never changed based on feeding frequency or pantry composition. Duck is still duck — its quality doesn't degrade because the owner feeds it more often. Modifying scores based on user behavior would violate the deterministic scoring principle and blend behavioral data into the citation-backed quality signal. Same boundary that keeps Kiba Index separate from scoring.
- **NOT arbitrary penalties.** There are no "−25% for 2 feeds" or "−40% for 3+ feeds" penalties. There is no citation source for those numbers, and every penalty must be citation-backed.
- **This IS a diet-level assessment** — the pantry layer evaluates the total diet, not individual product quality. This is the correct architectural layer for this concern.

### Rationale

The real-world harm is documented:
- High-fat single-protein supplementals fed as sole diets → pancreatitis risk
- Nutritionally incomplete supplementals fed long-term to kittens → immune deficiency, developmental gaps
- Mineral/vitamin deficiency accumulation over weeks/months when no complete food is present

Platforms like Chewy do not differentiate supplemental from complete meals in their navigation. Owners have no visual signal. Kiba's pantry becomes the safety net that catches this gap — telling the owner "your pet's overall diet has a problem" rather than "this product is bad."

### Future: Diet-Level Scoring (M6+)

This opens the door for cross-product nutritional analysis: "Does [Pet Name]'s total intake from all pantry products cover AAFCO minimums?" Not in scope for M5, but the `is_supplemental` flag and pantry assignment infrastructure make it possible.

---

## Implementation Scope

| Component | Milestone | Effort |
|-----------|-----------|--------|
| `is_supplemental` column + migration | M4 Session 6 | Small — single column, default false |
| Feeding guide text parser (import-time classification) | M4 Session 6 | Small — keyword match on existing scraped data |
| Backfill: scan existing 8,869 products' feeding guides | M4 Session 6 | Script — one-time batch |
| Scoring engine: 65/35/0 weight selection based on `is_supplemental` | M4 Session 6 | Small — conditional in engine.ts orchestrator |
| Score color system (both scales) in constants.ts | M4 Session 6 | Small — color map + helper function |
| Open arc ring variant for ScoreRing component | M4 Session 6 | Medium — SVG arc math |
| "Supplemental" badge + contextual line | M4 Session 6 | Small — existing badge pattern |
| Pantry diet completeness warnings | M5 | Medium — requires pantry assignment infrastructure |
| Regression tests for supplemental scoring path | M4 Session 6 | Medium — new test suite for 65/35/0 path |

---

## Regression Impact

- **Pure Balance (daily food):** Unaffected — `is_supplemental = false`, routes through existing 55/30/15 path.
- **Existing treats:** Unaffected — treat classification is separate from supplemental.
- **New regression target needed:** Against the Grain Nothing Else! Duck (or similar single-ingredient supplemental) — establish expected score under 65/35/0 weighting once engine change lands.

---

## Rejected Alternatives

| Alternative | Why Rejected |
|------------|-------------|
| Score supplementals as treats (100/0/0) | Owners feed these as meals — they need nutritional profile data. Dropping NP hides relevant fat/protein signals. |
| Penalize score based on feeding frequency in pantry | Violates deterministic scoring. No citation source for arbitrary % penalties. Blends user behavior into quality signal — same boundary violation as mixing Kiba Index into scores. |
| Yellow in supplemental color scale for top tier | Overlaps with amber zone in daily food scale. Teal/cyan family provides clean separation while tying to Kiba brand. |
| Single color scale for all product types | A supplemental scoring 90 in dark green is misleading — implies "complete meal, great quality" when it's "great ingredients, not a complete meal." |
| Clinical label language ("concerns present," "significant concerns") | Violates D-094 suitability framing. "Concerns" is diagnostic-adjacent. All labels must stay in the "match" spectrum. |
| Show supplemental warning as a dismissible tooltip | Too easy to miss. Color + ring shape + badge + contextual line = redundant communication. Owner catches it from any single signal. |

---

*This decision establishes the architectural foundation for supplemental product handling across classification, scoring, display, and pantry safety. The scoring engine remains deterministic, brand-blind, and citation-backed. Diet-level assessment lives in the pantry layer, not the product scoring layer.*
---

### D-137: DCM Pulse Framework — Positional Pulse Load Detection

**Status:** LOCKED
**Date:** 2026-03-14
**Milestone:** M4.5 (post-M4 patch — schema + engine change, regression update)
**Supersedes:** D-013 DCM trigger logic (grain-free + 3+ legumes in top 7). D-013's Heart Risk concern tag membership list also updated.

---

### Problem Statement

The original DCM rule (D-013) had three scientific weaknesses:

1. **Grain-free gate was a marketing proxy, not a biochemical signal.** The rule required `is_grain_free = true` before evaluating legume density. Companies have started adding token grains to heavily pulse-based formulas specifically to shed the "grain-free" label. The mechanism (methionine/cysteine depletion → impaired taurine synthesis → cardiac muscle dysfunction) doesn't care whether the bag says "grain-free."

2. **Simple count threshold missed positional risk.** "3+ legumes in top 7" treated a pea at position 1 the same as a pea at position 7. A dried legume at position 2–3 behind a wet meat is almost certainly the heaviest ingredient in the cooked product — fresh meat is ~70% water that evaporates during kibble extrusion.

3. **Potatoes were included without sufficient evidence.** The FDA investigation found potatoes in 42% of DCM cases vs peas/lentils in 93%. Subsequent research has isolated pulses as the relevant ingredient class via the amino acid depletion mechanism.

### Decision

Replace D-013 DCM trigger with a three-part positional pulse load framework. Penalty fires if **ANY** of the following conditions are met in the **top 10 ingredients:**

**Rule 1 — Heavyweight (Positional Dominance):** 1 or more pulse ingredients in positions 1–3.

**Rule 2 — Density / Splitting (Aggregate Pulse Load):** 2 or more pulse-based ingredients anywhere in positions 1–10.

**Rule 3 — Protein Substitution (Biochemical Red Flag):** 1 or more pulse protein isolate/concentrate in positions 1–10.

### Penalty

- **DCM fires:** −8% (multiply composite by 0.92) — unchanged from D-013
- **Mitigation:** +3% (multiply by 1.03) when BOTH taurine AND L-carnitine are supplemented — unchanged from D-013
- **Net with mitigation:** approximately −5%

### What Changed from D-013

| Aspect | Old (D-013) | New (D-137) |
|--------|------------|-------------|
| Gate | `is_grain_free = true` required | No gate — fires on any diet |
| Trigger | 3+ `is_legume` in top 7 | 3-part OR: heavyweight / density / substitution in top 10 |
| Ingredient scope | All `is_legume = true` (included potatoes, soy) | Pulses only: peas, lentils, chickpeas, fava/dry beans. Excludes potatoes, sweet potatoes, soy, tapioca |
| Position awareness | None (count only) | Position 1–3 weighted differently from 4–10 |
| Protein isolate detection | None | Dedicated Rule 3 for pulse protein isolates |
| Penalty magnitude | −8% / +3% mitigation | −8% / +3% mitigation (unchanged) |
| Concern tag scope | Included potatoes + sweet potatoes | Pulses only (potatoes removed) |

### Schema Changes

New flags on `ingredients_dict`:

```sql
ALTER TABLE ingredients_dict ADD COLUMN is_pulse BOOLEAN DEFAULT FALSE;
ALTER TABLE ingredients_dict ADD COLUMN is_pulse_protein BOOLEAN DEFAULT FALSE;
```

**`is_pulse = true`:** whole peas, dried peas, green peas, yellow peas, pea flour, pea starch, pea fiber, pea hull fiber, split peas, lentils, red lentils, green lentils, lentil flour, lentil fiber, chickpeas, garbanzo beans, chickpea flour, fava beans, dried beans, navy beans, black beans, white beans.

**`is_pulse_protein = true`:** pea protein, pea protein isolate, pea protein concentrate, lentil protein, chickpea protein. (Subset of `is_pulse`.)

**`is_pulse = false` (explicit exclusions):** potatoes, sweet potatoes, soy, tapioca, yam, taro.

**`is_legume` disposition:** Unchanged — remains for SplittingDetectionCard and general ingredient classification. DCM trigger uses ONLY `is_pulse` and `is_pulse_protein`.

### DCM Trigger Logic (Layer 2 — speciesRules.ts)

```typescript
function evaluateDcmRisk(ingredients: ProductIngredient[]): {
  fires: boolean;
  triggeredRules: ('heavyweight' | 'density' | 'substitution')[];
  hasMitigation: boolean;
} {
  const top10 = ingredients.filter(i => i.position <= 10);
  const top3 = ingredients.filter(i => i.position <= 3);

  const pulsesInTop3 = top3.filter(i => i.is_pulse).length;
  const pulsesInTop10 = top10.filter(i => i.is_pulse).length;
  const pulseProteinsInTop10 = top10.filter(i => i.is_pulse_protein).length;

  const triggeredRules: ('heavyweight' | 'density' | 'substitution')[] = [];

  if (pulsesInTop3 >= 1) triggeredRules.push('heavyweight');
  if (pulsesInTop10 >= 2) triggeredRules.push('density');
  if (pulseProteinsInTop10 >= 1) triggeredRules.push('substitution');

  const fires = triggeredRules.length > 0;

  const hasTaurine = ingredients.some(i => i.canonical_name === 'taurine');
  const hasLCarnitine = ingredients.some(i =>
    i.canonical_name === 'l_carnitine' || i.canonical_name === 'l-carnitine'
  );
  const hasMitigation = hasTaurine && hasLCarnitine;

  return { fires, triggeredRules, hasMitigation };
}
```

### DcmAdvisoryCard Copy Updates

**Rule 1 fires:** "This diet contains [ingredient] as a primary ingredient (position [N]). Dried pulses at the top of the ingredient list often outweigh meat in the final cooked product."

**Rule 2 fires:** "This diet contains [N] pulse-based ingredients in the top 10: [list]. Combined, pulses may represent a larger portion of this diet than individual positions suggest."

**Rule 3 fires:** "This diet contains [ingredient], a pulse protein isolate. Plant protein isolates are used to increase the protein percentage on the label but are deficient in the amino acids (methionine, cysteine) that dogs use to synthesize taurine."

All copy D-095 compliant.

### Heart Risk Concern Tag Update (D-107)

**New membership:** All `is_pulse = true` ingredients. Potatoes, sweet potatoes, potato starch removed. Tag fires when any D-137 rule fires (not on mere presence of a single pulse).

### Impact on Pure Balance Wild & Free Salmon & Pea (Dog)

- Dried Peas at position 3 → Rule 1 (Heavyweight) **FIRES**
- Dried Peas (#3) + Pea Starch (#7) = 2 pulses in top 10 → Rule 2 (Density) **FIRES**
- No pulse protein isolate → Rule 3 does not fire
- Taurine + L-Carnitine both supplemented → Mitigation **FIRES**
- Score: Base 65 × 0.92 = 59.8 × 1.03 = 61.6 → **62** (was 65)

### Citations

| Source | Key Finding |
|--------|------------|
| FDA CVM, Investigation into Potential Link between Certain Diets and Canine DCM, Feb 2019 | 91% grain-free, 93% contained peas/lentils, 42% contained potatoes |
| FDA CVM, Dec 2022 | Ended routine updates. 1,382 total reports (2014–2022). |
| Kaplan JL et al., *PLOS ONE*, 2018;13(12) | Taurine deficiency and DCM in golden retrievers fed grain-free/legume-rich diets |
| PMC Review, "Role of Diet as a Predisposing Factor for DCM in Dogs," 2025 | Dogs showed larger LV diameters and reduced systolic function on non-traditional diets |
| AKC Canine Health Foundation, Apr 2024 | "Peas are the most-implicated pulse... potatoes and sweet potatoes may be involved, but they were in fewer of the grain-free diets evaluated." |

### Rejected Alternatives

| Alternative | Why Rejected |
|------------|-------------|
| Keep grain-free gate | Companies adding token grains to pulse-heavy formulas bypass the gate |
| Keep potatoes in trigger | 42% vs 93% presence. Amino acid depletion mechanism doesn't apply to tubers |
| Three stacking penalties | Overpenalizes. Three rules are OR gates for same underlying risk |
| Include soy in pulse definition | Different amino acid profile, decades of safe use, not implicated in DCM |

---

## 25. Presentation-Layer Polish (Sessions A–C)

### D-138: Score Waterfall Redesign (presentation-layer) — LOCKED

**Date:** 2026-03-15
**Status:** LOCKED
**Scope:** `ScoreWaterfall.tsx` — UI only, zero scoring math changes

- Category headers: removed "(after position weighting)", added ⓘ tooltip per category, full-width name rendering (no truncation)
- Row 1 renamed from "Ingredient Concerns" to "Ingredients"
- Ingredient grouping: one row per ingredient with nested sub-reasons (left-border nesting), post-weighted values displayed using largest remainder method for exact reconciliation with header total
- Severity progress bars: 3px with dark track (`rgba(255,255,255,0.06)`), proportional fill (`|pts|/50`), color = `SEVERITY_COLORS.danger` (≥10) or `.caution` (<10)
- Final score row: uses `getScoreColor(score, productType)` per D-136 (no more hardcoded cyan)
- Collapsed categories: one-line summary of top concern or status
- 0-deduction categories: green checkmark + contextual "No issues found" text in `SEVERITY_COLORS.good`
- Citations: demoted from bright cyan links to muted ⓘ icon (10px, 18% opacity) with joined citation text
- Chevron icon retained for expand/collapse affordance

---

### D-139: Global Severity Color Constants — LOCKED

**Date:** 2026-03-15
**Status:** LOCKED
**Scope:** `constants.ts` + all components referencing severity colors

- Danger: `#EF4444`, Caution: `#F59E0B`, Good: `#4ADE80`, Neutral: `#6B7280`
- All components reference `SEVERITY_COLORS` from `constants.ts` — no hardcoded hex values for severity
- Waterfall deduction text now matches ingredient severity (amber for caution, red for danger)
- Score colors unchanged — `getScoreColor()` still implements D-136's 5-tier dual system (green family for daily food, teal/cyan family for supplemental)
- `#4ADE80` (green-400) for inline severity indicators vs `#22C55E` (green-500) for score ring — distinct purposes

---

### D-140: AAFCO Statement Copy Standardization — LOCKED

**Date:** 2026-03-15
**Status:** LOCKED
**Scope:** `constants.ts` (`AAFCO_STATEMENT_STATUS`), `ResultScreen.tsx`, `ScoreWaterfall.tsx`

- Missing (null/empty field): label = "No AAFCO statement on label", collapsed = "No AAFCO statement found on label"
- Unrecognized (present but unparseable): label = "AAFCO statement not recognized", collapsed = "AAFCO statement present but format not recognized"
- Constants defined in `constants.ts` as `AAFCO_STATEMENT_STATUS`, used in waterfall collapsed summary + result screen display
- Scoring engine (`formulationScore.ts`) unchanged — produces machine-readable flag keys, not display strings

---

### D-141: Supporting Screen Polish — PARTIALLY SUPERSEDED by D-143

**Date:** 2026-03-15
**Status:** PARTIALLY SUPERSEDED by D-143
**Superseded:** D-143 changed "Danger" display label to "Severe". Internal enum and all other D-141 scope unchanged.
**Scope:** `IngredientList.tsx`, `IngredientDetailModal.tsx`, `AafcoProgressBars.tsx`, `BonusNutrientGrid.tsx`, `PositionMap.tsx`, `ResultScreen.tsx`

- **Ingredient list:** grouped by severity tier with "DANGER · {count}" headers (11px uppercase), position order preserved within tiers. Two-line rows: primary name (14px semibold) + parenthetical (12px `#9CA3AF`). Position numbers demoted to 11px `#737373` on far left. Severity icons removed from rows (section headers establish context).
- **Nutritional Fit:** removed duplicate "Nutritional Profile" section (`GATable` no longer rendered). Added expandable raw GA view ("View guaranteed analysis ▾") with `LayoutAnimation` smooth expand/collapse. AAFCO threshold markers improved: 2px × 16px, `rgba(255,255,255,0.7)`, with positioned "min"/"max" label (9px `#9CA3AF`).
- **Carb estimate:** moved from `GATable` to `AafcoProgressBars`. "Est. {value}%" replaces "~{value}%". InfoTooltip shows full nitrogen-free extract formula with actual product values and ash estimation note.
- **Bonus Nutrients:** present-first layout replaces 2-column grid. Present items as compact rows (green dot + name + value). Absent items as single comma-separated line ("{names} not listed."). All absent: "No bonus nutrients listed".
- **Composition bar:** tap-to-identify interaction — tapped segment highlights (others dim to 0.4), floating label shows display name + position number. Label clamped to bar edges (4px margin).
- **Modal citations:** "Sources" header 11px uppercase `#737373`. Citation text 12px italic `#737373`. "Read more" toggle changed from cyan to `Colors.textSecondary`. Zero `Colors.accent` in modal.

---

### D-142: Artificial Colorant Severity Escalation — LOCKED

**Date:** 2026-03-16
**Status:** LOCKED
**Scope:** `ingredients_dict` (DB), test fixtures

- All FD&C artificial colorants escalated from `caution` to `danger` severity for both `dog_base_severity` and `cat_base_severity`
- Affected: Red 40, Yellow 5, Yellow 6, Blue 1, Blue 2, Red 3, Titanium Dioxide
- All colorants confirmed `position_reduction_eligible = FALSE` (presence-based — full penalty regardless of position)
- Rationale: zero nutritional benefit for the animal, purely cosmetic additives marketed to humans, cumulative synthetic dye exposure flagged by EFSA and FDA
- Score impact: single-dye product drops ~92→~85, double-dye ~84→~70, triple-dye ~76 "Good"→~55 "Low"
- Pure Balance regression unaffected (62 — no colorants)
- Test fixtures updated in `engine.test.ts`, `ingredientQuality.test.ts`, `realProductScoring.test.ts`
- DB migration: `UPDATE ingredients_dict SET dog_base_severity = 'danger', cat_base_severity = 'danger' WHERE canonical_name IN ('red_40', 'yellow_5', 'yellow_6', 'blue_1', 'blue_2', 'red_3', 'titanium_dioxide');`

---

### D-143: "Danger" → "Severe" Display Label — LOCKED

**Date:** 2026-03-16
**Status:** LOCKED
**Scope:** `constants.ts` (`SEVERITY_DISPLAY_LABELS`), `IngredientList.tsx`, `IngredientDetailModal.tsx`

- UI displays "Severe" for `danger`-level ingredients; "Caution" / "Good" / "Neutral" unchanged
- Database enum unchanged — `danger` remains the internal value everywhere (scoring engine, types, DB)
- `SEVERITY_DISPLAY_LABELS` added to `constants.ts` as single source of truth for UI-facing severity text
- Local `SEVERITY_LABELS` maps removed from `IngredientList.tsx` and `IngredientDetailModal.tsx` — both now import from constants
- Section headers render as "SEVERE · 4" (was "DANGER · 4"), severity badge text as "Severe" (was "Danger")
- Rationale: "Danger" implies acute toxicity/immediate physical harm; "Severe" accurately describes chronic quality concerns per D-095 Clinical Copy Rule
- Supersedes D-141 section header label ("DANGER · {count}" → "SEVERE · {count}")

### D-144: Species Mismatch Bypass — LOCKED

**Date:** 2026-03-16
**Status:** LOCKED
**Scope:** `pipeline.ts`, `scoring.ts` (`BypassReason` type), `ResultScreen.tsx`

- Products where `product.target_species !== pet.species` skip scoring entirely — engine never runs
- Pipeline returns `bypass: 'species_mismatch'` with hydrated ingredients (still viewable)
- ResultScreen renders species mismatch view: red badge ("For cats/dogs only"), warning message, ingredient list
- Copy: "[Product Name] is formulated for [species]. It is not recommended for [Pet Name]." (D-095 compliant — factual restatement of manufacturer's declared target species, no prescriptive language)
- Same architectural pattern as D-135 vet diet bypass: early exit in pipeline, dedicated ResultScreen branch
- `BypassReason` type union added to `scoring.ts` — shared by vet diet, species mismatch, and variety pack bypasses
- Triggered by: Greenies Feline scanned for dog, Fancy Feast scanned for dog, any cross-species scan

---

### D-145: Variety Pack Detection + Bypass — LOCKED

**Date:** 2026-03-16
**Status:** LOCKED
**Scope:** `varietyPackDetector.ts` (new), `pipeline.ts`, `scoring.ts`, `ResultScreen.tsx`

- Variety packs have concatenated multi-recipe ingredient lists producing unreliable scores, false flavor deception flags, and absurd position numbers
- Detection fires if ANY of: (1) product name contains "variety", "multi-pack", "assorted", "sampler" (case-insensitive), (2) ingredient count exceeds 80, (3) duplicate canonical ingredient names at different positions
- Pipeline returns `bypass: 'variety_pack'` — scoring engine never runs
- ResultScreen renders variety pack view: amber badge ("Variety Pack"), message "This product contains multiple recipes. For accurate scoring, scan individual items from the pack."
- Suppresses: ScoreRing, Waterfall, BenchmarkBar, PortionCard, ingredient list, FlavorDeceptionCard, SplittingDetectionCard (all produce misleading output on concatenated lists)
- Shows: product image, recall banner (safety-critical, always shown)
- Triggered by: Hartz Delectables 12ct, Fancy Feast Variety Pack, any multi-recipe product

---

### D-146: Expanded Supplemental Classifier — LOCKED

**Date:** 2026-03-16
**Status:** LOCKED
**Scope:** `supplementalClassifier.ts`, `pipeline.ts`, `BenchmarkBar.tsx`, `PortionCard.tsx`, `ResultScreen.tsx`

- Product name now scanned for topper/mixer/enhancer keywords: "topper", "meal topper", "food topper", "mixer", "meal mixer", "meal enhancer", "meal booster", "sprinkle", "dinner dust"
- `isSupplementalByName()` exported alongside existing `isSupplementalProduct()` (feeding guide AAFCO check)
- Pipeline applies runtime override: if DB `is_supplemental` is false but name matches, creates product copy with `is_supplemental: true` before passing to scoring engine (65/35/0 weights, macro-only NP)
- ResultScreen derives unified `isSupplemental` from DB flag OR name detection — used for ScoreRing (270° arc, teal/cyan), BenchmarkBar, PortionCard, and all supplemental UI elements
- PortionCard: when `isSupplemental=true`, shows "This product is a meal topper. Refer to package feeding guidelines for serving size." instead of calculated daily portion (prevents nonsensical "~1876g/day" for toppers)
- BenchmarkBar: supplementals skip fetch entirely and return null — no supplemental benchmark segment exists with ≥30 products, and comparing toppers against daily food averages is meaningless
- BenchmarkBar: added MIN_BENCHMARK_PEERS threshold (30) — treats with <30 peers also hide instead of showing statistically unreliable comparisons
- NOT a bypass — supplemental products are fully scored with D-136 weights. This expands classification, not pipeline control flow
- Triggered by: Stella & Chewy's Magical Dinner Dust, Charlee Bear Necessities Dog Food Topper

### D-147: Presentation Layer Polish (Priority 3) — LOCKED

**Date:** 2026-03-16
**Status:** LOCKED
**Scope:** `AafcoProgressBars.tsx`, `BenchmarkBar.tsx`, `PortionCard.tsx`, `PositionMap.tsx`, `ResultScreen.tsx`

Eight display bug fixes — no scoring engine changes, all presentation-layer:

1. **AafcoProgressBars supplemental header:** Supplementals show "Macro Profile" / "As listed on label" instead of "[Pet Name]'s Nutritional Fit" / "vs. AAFCO standards". Threshold markers (min/max) hidden — AAFCO doesn't apply to supplementals. DMB toggle and carb estimate preserved.
2. **AafcoProgressBars treat handling:** Treats hide GA progress bars entirely (NP bucket is 0% — showing bars implies scoring relevance). Carb estimate still renders standalone when GA data exists.
3. **Ultra-high-moisture DMB note:** Products with moisture >80% show contextual note when DMB toggled on: "This product is {X}% water. DMB values appear high because the dry portion is very concentrated. This is normal for broths and lickable treats."
4. **BenchmarkBar delta label:** Changed from bare "+14" / "−37" to "+14 above avg match" (green) / "−37 below avg match" (red) / "At category average" (gray). Number colored via SEVERITY_COLORS, suffix in muted gray.
5. **AAFCO statement chip consistency:** "AAFCO statement not recognized" changed from `flagChipGeneric` (card background, looks tappable) to `flagChipMuted` (plain text, matches "No AAFCO statement on label" treatment).
6. **Product name 2-line wrap:** All ResultScreen header product name fields changed from `numberOfLines={1}` to `numberOfLines={2}`. Brand stays single line.
7. **PortionCard name truncation:** Added `shortenProductName()` helper — strips package size info after first comma, truncates to 40 chars. Prevents "~1915g/day of Fancy Feast Gravy Lovers... 3-oz, case of 30".
8. **Floating "likely" text:** AAFCO statement rendering now requires `trim().length > 20` — suppresses orphan fragments from bad DB data.
9. **PositionMap ordinal fix:** Floating label changed from `sorted[idx].position` (raw DB value, sometimes non-ordinal) to `selectedIdx + 1` (1-based index in sorted array). Fixes "Mixed Tocopherols #921" → "#28".

### D-148: Composition Bar Swipeable Scrub Interaction — LOCKED

**Date:** 2026-03-16
**Status:** LOCKED
**Scope:** `PositionMap.tsx`

- Replaced tap-per-segment (`Pressable`) with PanResponder-based scrub + tap interaction
- Drag/scrub: `onPanResponderMove` calculates segment under finger from cumulative weight widths, updates floating label on every move event
- Tap preserved as fallback: `onPanResponderRelease` toggles selection if movement < 5px dead zone
- `segmentIndexFromX()` converts pixel X → segment index via linear scan over proportional weights
- Segments changed from `Pressable` to `View` — all touch handling via single PanResponder on barWrapper
- `barWidthRef` (ref) for gesture callbacks avoids stale closures; `barWidth` (state) for render positioning
- No new dependencies — uses `PanResponder` from react-native core

---

### D-149: Atwater Caloric Estimation Fallback — LOCKED

**Date:** 2026-03-16
**Status:** LOCKED
**Scope:** `calorieEstimation.ts` (new), `ResultScreen.tsx`, `TreatBatteryGauge.tsx`

- Many treats and supplementals missing both `kcal_per_cup` and `kcal_per_kg`, making treat battery display useless
- `resolveCalories(product)` implements a three-priority fallback chain:
  1. `kcal_per_kg` from label (scraped — most accurate)
  2. `kcal_per_cup` from label (partial data)
  3. Modified Atwater ME estimate from GA data (NRC, 2006): protein×3.5 + fat×8.5 + carb×3.5 kcal/g
  4. `null` — no calorie data available
- `CalorieSource` type: `'label' | 'estimated' | null` — tracks provenance
- Carb% for Atwater uses same NFE method as engine.ts `estimateCarbDisplay()` with matching ash defaults (treat 5%, dry 7%, wet 2%)
- `kcalPerUnit` derived from `kcalPerKg × unit_weight_g / 1000` when both available
- ResultScreen uses `resolveCalories()` instead of raw `product.kcal_per_unit` for treat battery
- TreatBatteryGauge shows "Calories estimated from nutritional profile" note with InfoTooltip when `calorieSource === 'estimated'`
- Products with label calorie data completely unaffected — label values always take priority
- Display-only: Atwater estimate does NOT enter scoring engine

---

### D-150: Life Stage Mismatch — Layer 3 Restructure — LOCKED

**Date:** 2026-03-17
**Status:** LOCKED
**Scope:** `personalization.ts`, `nutritionalProfile.ts`, `engine.ts`, `scoring-rules.md`

**Problem:** The life stage mismatch penalty (−15 for puppy/kitten eating adult food) lived in the NP bucket (§5a). Because treats weight NP at 0% and supplementals at 35%, the penalty had no effect on treats and minimal effect on supplementals. A 1-month-old kitten scanning adult treats saw no penalty.

**Decision:** Move life stage mismatch from NP bucket to Layer 3 personalization as a category-scaled modifier on the final composite score:

| Scenario | Daily Food | Supplemental | Treat |
|----------|-----------|-------------|-------|
| Puppy/kitten eating "Adult"/"Maintenance" | −15 | −10 | −5 |
| Adult+ eating "Growth"/"Puppy"/"Kitten" | −5 | −5 | −5 |
| "All Life Stages" or null claim | 0 | 0 | 0 |

**Trigger conditions:**
- Puppy/kitten + explicit "Adult"/"Maintenance" claim (case-insensitive)
- Adult/junior/mature/senior/geriatric + explicit "Growth"/"Puppy"/"Kitten" claim
- "All Life Stages" or null/empty claim → no penalty

**Reverse case rationale:** Growth formulas have excess calcium/phosphorus for adult animals, especially risky for large breed adults. −5 is appropriate as a mild warning — growth food isn't dangerous for adults the way adult food is for growing animals.

**Citations:** AAFCO Official Publication, Nutritional Adequacy — Growth & Reproduction vs Adult Maintenance profiles.

**Regression:** Pure Balance = 62 (unaffected — adult pet, no life_stage_claim).

---

### D-151: Under-4-Weeks Nursing Advisory — LOCKED

**Date:** 2026-03-17
**Status:** LOCKED
**Scope:** `personalization.ts`, `engine.ts`, `lifeStage.ts`, `NursingAdvisoryCard.tsx`, `ResultScreen.tsx`

**Problem:** Pets under 4 weeks old should be primarily nursing. The D-150 life stage mismatch penalty is inappropriate for these very young animals — the issue isn't food quality, it's age-appropriateness.

**Decision:**
- If pet's DOB indicates under 4 weeks old, suppress D-150 life stage mismatch penalty entirely
- Add `'nursing_advisory'` flag to scored result
- Render `NursingAdvisoryCard` on ResultScreen (amber/caution style, below verdict, above concern tags)
- Card copy: "Pets under 4 weeks old should be primarily nursing. Consult your veterinarian before introducing solid food."
- D-095 compliant: factual language, vet consult recommendation, not prescriptive
- Species-agnostic — same message for puppies and kittens
- Food still scored normally — the advisory is informational, not a bypass
- `isUnder4Weeks()` utility in `lifeStage.ts` calculates weeks from DOB string

**No score impact.** The user might be scanning to compare foods for when their pet IS ready for solids.

---

### D-152: Pantry Depletion Model — System-Recommended, User-Adjustable
**Status:** LOCKED
**Partially superseded:** D-165 revises recommendation logic and serving input UX. Depletion model defined here is unchanged.
**Date:** March 19, 2026
**Depends on:** D-065 (Bag Countdown), D-101 (Feeding Schedule), D-149 (Atwater Estimation)
**Milestone:** M5 (Pantry)

**Decision:** Pantry depletion runs on user-set serving amounts, not raw caloric calculation. The system recommends a serving size at add-to-pantry time based on the pet's DER and the product's calorie data, but the user can adjust to any amount. Depletion countdown tracks whatever the user actually set.

**System recommendation source:**
- Free users: current weight DER via `calculateDER(pet)`
- Premium users with goal weight: goal weight DER via `calculateDER(pet, goalWeight)`
- No calorie data (after D-149 Atwater attempt): no recommendation shown — user enters amounts manually

**Two serving formats:**
- **Weight-based** (dry food, freeze-dried, dehydrated, raw): user enters bag size (lbs/oz/kg/g), cups per feeding, feedings per day. Days remaining computed via calorie-derived conversion when data exists (`total_cups = bag_weight_kg × kcal_per_kg / kcal_per_cup`), omitted when calorie data missing.
- **Unit-based** (wet food cans/pouches, treats): user enters total count, fractional amount per feeding (¼, ⅓, ½, ⅔, ¾, 1, 1½, 2, or custom), feedings per day. Days remaining always computable (units in, units out). Unit label is dynamic — "cans" or "pouches" based on user selection, never hardcoded.

**Depletion math breakdown line:** Displayed on add-to-pantry sheet, updates live as user adjusts inputs:
- Unit mode: "½ can × 2 feedings = 1 can/day · ~24 days of food"
- Weight mode with calorie data: "1.5 cups × 2 feedings = 3 cups/day · ~42 days of food"
- Weight mode without calorie data: "1.5 cups × 2 feedings = 3 cups/day" (no days estimate)
- Treats: not shown (Treat Battery owns treat budgeting — Phase 2, Session 10)

**Rationale:** Pet owners know their routine better than a formula. DER is an estimate; serving amounts are ground truth. The recommendation pre-fills as a helpful starting point, but the user's actual feeding behavior drives the countdown. This eliminates the mixed-feeding caloric doubling bug where two daily foods each compute 100% of DER.

**Rejected:**
- ❌ Pure DER-computed depletion — ignores real-world feeding behavior, produces misleading countdowns when owners feed more or less than calculated
- ❌ No system recommendation — cold-starting with blank serving fields creates friction and removes the "smart" feel
- ❌ Caloric proportion slider (D-065 mixed feeding) — redundant when user enters actual amounts per food

### D-153: Pantry Paywall Scope — Goal Weight DER Only
**Status:** LOCKED
**Date:** March 19, 2026
**Depends on:** D-052 (Multi-Pet Premium Gate), D-125 (Recalls Free)
**Milestone:** M5 (Pantry)

**Decision:** The **only** premium gate in the entire pantry feature is goal weight DER. Everything else is free.

| Feature | Free | Premium |
|---|---|---|
| Add to pantry | ✅ | ✅ |
| View pantry | ✅ | ✅ |
| Bag/pack countdown | ✅ | ✅ |
| Feeding schedule + notifications | ✅ | ✅ |
| Diet completeness warnings | ✅ | ✅ |
| Recall alerts in pantry | ✅ (D-125) | ✅ |
| System recommendation (current weight DER) | ✅ | ✅ |
| System recommendation (goal weight DER) | ❌ | ✅ |
| Share pantry item across pets | N/A (1 pet) | ✅ |

Multi-pet sharing is technically premium because free users can only have 1 pet (D-052). It's not a separate pantry gate — it falls out of the existing pet limit.

**Implementation:** `canUseGoalWeight()` in `permissions.ts`. No other `if (isPremium)` checks in pantry code.

**Rationale:** Pantry is the #1 retention feature. Gatekeeping basic pantry functionality would destroy the retention loop that drives premium conversion. Let users build the habit of tracking food, then upsell goal weight management for pets with obesity/underweight conditions.

### D-154: Pantry Sharing Rules — Active Pet Default, Same-Species, Premium
**Status:** LOCKED
**Date:** March 19, 2026
**Depends on:** D-052 (Multi-Pet Premium Gate), D-144 (Species Mismatch Bypass)
**Milestone:** M5 (Pantry)

**Decision:** Pantry items default to the **active pet** when added. Multi-pet sharing is an optional premium action with same-species enforcement.

**Rules:**
1. Add-to-pantry defaults to active pet — follows the "match for [Pet Name]" mental model
2. "Share" action on pantry card opens picker showing only **same-species pets** owned by the user
3. Cross-species sharing blocked — dog food cannot be shared with a cat (species mismatch D-144). A chicken-allergic senior dog and a puppy sharing the same kibble entry would produce contradictory dietary signals.
4. Each assigned pet gets their own `pantry_pet_assignments` row with independent serving size, feedings per day, and schedule
5. Depletion sums all assigned pets' consumption rates from `quantity_remaining`
6. Sharing gated by `canSharePantryItem()` in `permissions.ts` (premium check)
7. Free users with 1 pet have no sharing option (no other pets to share with)

**Display:** "Shared by Buster & Milo · ~13 days remaining"

**Rationale:** The core principle is "what is the match for THIS pet." Defaulting to all pets would break that mental model and create confusion when pets have different dietary needs. Sharing is an intentional second step for households where multiple pets genuinely eat from the same bag.

### D-155: Empty Item Behavior — Gray Out, Sink, Restock/Remove Actions
**Status:** LOCKED
**Date:** March 19, 2026
**Depends on:** D-065 (Bag Countdown), D-101 (Auto-Depletion)
**Milestone:** M5 (Pantry)

**Decision:** When a pantry item's `quantity_remaining` hits 0:

1. **Visual:** Card renders at 40% opacity, "Empty" label replaces the remaining count
2. **Sort:** Sinks to bottom of pantry list (below active, low stock)
3. **Notification:** Push notification sent: "[Pet Name]'s [Product Name] is empty"
4. **Actions surface on the card:**
   - **Restock** — resets `quantity_remaining` to `quantity_original`, reactivates the item
   - **Edit** — allows manual quantity adjustment (maybe user has a partial bag left)
   - **Remove** — soft-deletes the pantry item. For shared items: "Remove for all pets" or "Remove for [Pet Name] only"
5. **Data:** `is_active` stays `true` until explicitly removed. Empty items are visible so users can restock.
6. **Auto-depletion stops** — no further deductions once quantity hits 0. `quantity_remaining` floors at 0 (never goes negative).

**Rationale:** Empty ≠ removed. Most users restock the same food. Making restock a single tap from the empty state reduces friction. Graying out + sinking ensures empty items don't crowd active items but remain accessible.

### D-156: Pantry Score Source — Live Read, Not Snapshot
**Status:** LOCKED
**Date:** March 19, 2026
**Depends on:** D-129 (Allergen Override)
**Milestone:** M5 (Pantry)

**Decision:** Pantry reads the latest available score on every render. No score snapshot stored on the pantry item itself.

**Score resolution order:**
1. `pet_product_scores` cache (from Top Matches batch scoring) — preferred, per-pet score including allergen overrides
2. `scans.final_score` from most recent scan of this product for this pet — fallback
3. `products.base_score` — last resort, not personalized
4. No score available — show bypass badge or "Score unavailable"

**Why no snapshot:** Product scores can change when the scoring engine updates (`scoring_version` bump), when ingredient data is corrected, or when pet profile changes (new allergen → D-129 override changes the score). A snapshot would show stale data. Reading live ensures the pantry always reflects current state.

**Per-pet scoring in shared items:** If a product is shared between an allergic pet and a non-allergic pet, each pet sees their own score (from their own `pet_product_scores` row or scan). The pantry view switches when the active pet switches.

### D-157: Mixed Feeding Removal — No Auto-Rebalance, Contextual Nudge
**Status:** LOCKED
**Date:** March 19, 2026
**Depends on:** D-152 (Pantry Depletion Model)
**Milestone:** M5 (Pantry)

**Decision:** When a daily food is removed from a pet's pantry and at least one other daily food remains, the remaining food's serving amounts are **not automatically adjusted**. Instead, show a contextual nudge.

**Behavior:**
1. User removes Food B from pet's pantry
2. Food A's serving amount stays exactly as the user set it (e.g., 1.5 cups × 2 feedings)
3. If ≥1 other daily food remains → show a one-time banner/toast: "[Pet Name]'s daily intake from pantry items has changed"
4. The calorie context line on remaining cards shows "~X kcal/day of [Pet Name]'s Y kcal target" — the gap is self-evident
5. If the **last** daily food is removed entirely → diet completeness red warning fires (already handled by D-136 Part 5)

**Rationale:** Users enter real-world serving amounts (D-152). Auto-increasing Food A from 1.5 cups to 2.5 cups means the app is telling the user to change how much they physically scoop — without being asked. That's a feeding directive, borderline D-095 territory. The user set the amounts; the user adjusts the amounts. The calorie context line gives them the information to act without the system overriding their choices.

**Rejected:**
- ❌ Auto-rebalance to fill caloric gap — overrides user-set amounts, feels like a feeding directive
- ❌ Proportion slider that auto-adjusts — redundant when user enters actual amounts (D-152)
- ❌ No indication at all — user might not notice the caloric impact of removing a food

### D-158: Recalled Product Bypass — No Score, Warning + Ingredients
**Status:** LOCKED
**Date:** March 19, 2026
**Depends on:** D-135 (Vet Diet Bypass), D-144 (Species Mismatch Bypass), D-125 (Recalls Free)
**Milestone:** M5 (Recall Siren)

**Decision:** Recalled products are a pipeline bypass — same pattern as vet diets (D-135) and species mismatches (D-144). No score is computed. The scoring engine never runs for recalled products.

**Bypass chain order (updated):**
```
vet diet (D-135) → species mismatch (D-144) → recalled (D-158) → variety pack (D-145) → supplemental (D-146, scored) → normal scoring
```

**Implementation:**
- `'recalled'` added to `BypassReason` type union
- In `pipeline.ts`: `if (product.is_recalled) return makeBypassResult('recalled')`
- Check placed after species mismatch, before variety pack
- Batch-score Edge Function: `WHERE is_recalled = false` (excluded from Top Matches)

**ResultScreen recalled bypass view:**
- Red recall badge (more prominent than vet diet's medkit)
- "This product has been recalled by the FDA"
- "Tap for recall details" → RecallDetailScreen
- NO score ring, NO waterfall, NO benchmark bar
- Ingredient list with severity dots (same as vet diet view)
- Allergen warnings still shown (safety-critical)
- "Remove from Pantry" action if product is in active pantry

**Pantry card for recalled items:**
- Red badge, no score number
- Pushed to top of list regardless of other sorting
- Tap → RecallDetailScreen (not EditPantryItemScreen)

**Why bypass instead of score → 0:** A recalled product's ingredient quality is irrelevant — the product shouldn't be fed regardless of how good the ingredients are. Showing a score (even 0) implies the product is being evaluated on merit. The bypass communicates: "this product is outside the scoring framework entirely." Same logic as vet diets — we don't score them because scoring would be misleading, not because they're bad.

**Why bypass instead of banner over scored result:** A score ring showing "82% match" with a recall banner creates cognitive dissonance. The user sees a good score and a danger warning simultaneously. The bypass eliminates this — there's no score to conflict with the safety signal.

**Overrides ROADMAP:** The ROADMAP (M5 section) says "Product score → 0 with recall banner on scan result." D-158 replaces this with the bypass pattern. The bypass is architecturally cleaner (follows D-135/D-144 precedent) and avoids the score=0 confusion (a 0 looks like terrible ingredients, not "recalled by the FDA").

**Compliance:** D-125 — recall features are never paywalled. D-084 — no emoji in recall UI. D-095 — factual tone: "has been recalled by the FDA" not "DANGER: recalled product."

### D-159: Low-Score Feeding Context Line
**Status:** LOCKED
**Date:** March 19, 2026
**Depends on:** D-094 (Suitability Framing), D-095 (UPVM Compliance)
**Milestone:** M5+

**Decision:** Products scoring below a threshold display a contextual feeding guidance line on ResultScreen, below the verdict label. Not a score modifier — display copy only.

| Score | Line |
|---|---|
| 65+ | *(none)* |
| 51–64 | "Consider for occasional use — explore higher-scoring options for [Pet Name]" |
| ≤50 | "Explore higher-scoring alternatives for [Pet Name]" |

**Implementation:**
- Single conditional text block on ResultScreen, below verdict, above MetadataBadgeStrip
- Triggered by `finalScore`, not by product category or type
- Applies to all scored products (daily food, treats, supplemental)
- No new component needed — inline `<Text>` with `Colors.textSecondary` styling
- Threshold may be tuned post-launch based on real score distribution data

**What this is NOT:**
- NOT a score modifier — the number doesn't change
- NOT a frequency advisory (D-009) — those are ingredient-specific (mercury, vitamin A)
- NOT brand-aware — triggered purely by score
- NOT a bypass — product is still fully scored with waterfall and breakdown

**Rationale:** A score of 48 without context requires the user to interpret what that means. The line does the interpretive work: "this isn't daily food quality." It drives users toward the Top Matches / Safe Swaps premium features without being pushy. D-095 compliant: factual guidance, no prohibited clinical terms. Extremely high ROI — one conditional line, zero engine changes, natural premium conversion bridge.

**Threshold note:** The 51/65 split is preliminary. If real-world score distribution shows 80% of products land between 55-75, the thresholds may shift. Will monitor post-launch and adjust via a D-159 revision if needed.

---
### D-160: Weight Goal Slider — Replaces Raw Goal Weight (D-061)

Status: LOCKED
Date: March 20, 2026
Supersedes: D-061 (raw goal weight input)
Depends on: D-062 (feline hepatic lipidosis guard), D-095 (UPVM compliance), D-153 (goal weight is premium-only)
Milestone: M5 polish or M6
Problem: D-061 lets users type any goal weight. A 90 lb dog could be targeted to 50 lbs — the app computes a starvation-level DER without guardrails. The hepatic lipidosis guard (D-062) catches the worst cat cases after the fact, but the fundamental design is wrong: unbounded user input for a clinically sensitive calculation.
Decision: Replace the raw weight_goal_lbs field with a bounded weight goal level slider. Seven positions representing percentage adjustments to maintenance DER:
LevelLabelDER AdjustmentDogsCats-3Aggressive loss-20% (× 0.80)AllowedBlocked-2Moderate loss-10% (× 0.90)AllowedMax allowed-1Conservative loss-5% (× 0.95)AllowedAllowed0MaintenanceStandard DER (× 1.00)DefaultDefault+1Conservative gain+5% (× 1.05)AllowedAllowed+2Moderate gain+10% (× 1.10)AllowedAllowed+3Aggressive gain+20% (× 1.20)AllowedAllowed
Cat cap at -2 (D-062 replacement): Cats cannot select -3. The feline liver is uniquely susceptible to hepatic lipidosis during rapid caloric restriction — a 20% deficit risks overwhelming hepatic lipid transport [AAHA 2021 Nutrition & Weight Management Guidelines; Small Animal Clinical Nutrition 5th Ed., Hand et al., Ch. 27 — Hepatic Lipidosis]. By making -3 structurally unavailable for cats, D-062's safety guard becomes architectural rather than a runtime check. The UI simply doesn't render the -3 option for cat profiles.
DER math: adjustedDER = baseDER × multiplier where multiplier is looked up from the level. baseDER uses calculateDER(pet) with current weight (free) or current weight at the adjusted level (premium). No change to the allometric RER formula (70 × kg^0.75) [AAHA 2021; WSAVA Global Nutrition Committee — Nutritional Assessment Guidelines].
Schema change:

Remove: pets.weight_goal_lbs (deprecated)
Add: pets.weight_goal_level SMALLINT DEFAULT 0 CHECK (weight_goal_level BETWEEN -3 AND 3)
Migration: any existing weight_goal_lbs rows → map to nearest level based on the implied deficit percentage, then drop column. If mapping is ambiguous, default to 0.

UI — PortionCard:

Slider with 7 detents, labeled at each position
Cat profiles: -3 detent not rendered, slider range is -2 to +3
Below slider: "Moderate weight loss: ~[X] kcal/day ([Y]% below maintenance)"
D-095 compliant: "estimated daily intake" not "prescribed diet." Volume reduction of maintenance food without reformulation risks clinical malnutrition [Small Animal Clinical Nutrition 5th Ed., Ch. 27 — purpose-formulated therapeutic diets required for significant restriction].
Calorie context updates live as slider moves

Pantry integration:

getSystemRecommendation() uses adjusted DER based on weight_goal_level
Pantry depletion countdown reflects adjusted intake
Calorie context line on pantry cards: "~X kcal/day of [Pet Name]'s Y kcal target (moderate loss)"

Paywall: Premium only (D-153 unchanged). Free users see the slider locked at 0 with a "Premium" badge. Tapping any non-zero position triggers paywall.
Clinical backing:

Weight loss protocol DER: dogs = 1.0 × RER at ideal BW, cats = 0.8 × RER at ideal BW [AAHA 2021 Nutrition & Weight Management Guidelines, Table 3 — MER Multipliers]
Empirical DER range during weight loss: dogs 0.73–1.47 × RER, cats 0.67–1.55 × RER [JAVMA peer-reviewed trials, cited in AAHA 2021]
Safe weight loss rates: dogs 1–2% BW/week, cats 0.5–1% BW/week; exceeding 2%/week risks sarcopenia (dogs) or hepatic lipidosis (cats) [AAHA 2021; WSAVA Global Nutrition Committee]
The -20% cap for dogs stays within the 1.0 × RER floor for typical neutered adults (MER 1.4–1.6 × RER → 20% reduction ≈ 1.12–1.28 × RER, well above minimum) [AAHA 2021, Table 3]
The -10% cat cap stays above the 0.8 × RER floor for typical neutered adult cats (MER 1.2–1.4 × RER → 10% reduction ≈ 1.08–1.26 × RER) [AAHA 2021, Table 3]
Flat kcal deficits are lethal for small animals — a 10 lb cat's entire daily requirement may be ~200 kcal; a 500 kcal/day cut exceeds total intake [Small Animal Clinical Nutrition 5th Ed., Hand et al., Ch. 5 — Energy]

Rejected:

❌ Raw goal weight input (D-061) — unbounded, dangerous, requires after-the-fact guards
❌ Flat kcal deficit (e.g., -500 kcal/day) — lethal for small animals. A 10 lb cat's entire daily requirement might be 200 kcal [Small Animal Clinical Nutrition 5th Ed., Hand et al., Ch. 5 — Energy]
❌ Continuous percentage slider (0–30%) — too much precision implies clinical accuracy we can't deliver. Seven fixed levels are honest about the granularity.
❌ BCS-derived goal weight as primary input — requires clinical assessment skills most owners don't have. Owners consistently underestimate BCS by 1–2 points [AAHA 2021, §4 — Client Communication Challenges]. BCS is a reference tool (D-162), not the input mechanism.

---
### D-161: Estimated Weight Tracking — Caloric Accumulator
Status: LOCKED
Date: March 20, 2026
Depends on: D-160 (weight goal slider), D-101 (auto-depletion cron), D-117 (stale weight guard)
Milestone: M5 polish or M6
Problem: Pet weight goes stale. D-117 nags users after 6 months, but the app has feeding data flowing through the auto-depletion cron — it knows what the pet is eating every day. That data can estimate weight drift, replacing the nag with an intelligent prompt.
Decision: Track cumulative caloric delta between actual daily intake and maintenance DER. When the accumulator crosses a species-specific threshold (≈1 lb of mixed-tissue weight change), notify the user with an estimated weight update.
Species-specific thresholds (from clinical mixed-tissue data):
SpeciesPure AdiposeMixed-Tissue RangeKiba ThresholdCitationDog~3,500 kcal/lb2,900 – 3,400 kcal/lb3,150 kcal/lbSmall Animal Clinical Nutrition 5th Ed., Hand et al., Ch. 27; JVIM German et al. 2011Cat~3,500 kcal/lb2,800 – 3,300 kcal/lb3,000 kcal/lbSmall Animal Clinical Nutrition 5th Ed., Hand et al., Ch. 27; ACVN clinical reference
Kiba thresholds are the midpoints of the mixed-tissue ranges. These are estimates — real weight change involves adaptive thermogenesis [JVIM, German et al. 2011 — canine REE drops 10–20% below predicted values during caloric restriction], variable lean/fat ratios [Small Animal Clinical Nutrition 5th Ed., Ch. 27 — one pound lean muscle = 600–800 kcal vs one pound adipose = ~3,500 kcal], water retention, and unmeasured food sources (treats, table scraps). The threshold is a reasonable heuristic, not a clinical measurement.
Why mixed-tissue, not pure adipose: Weight lost during caloric restriction is heterogeneous — a mix of fat and lean body mass. Cats trend lower because their obligate carnivore metabolism has a fixed, high rate of hepatic gluconeogenesis — they cannot down-regulate protein catabolism during restriction [Small Animal Clinical Nutrition 5th Ed., Ch. 20 — Feline Protein Requirements]. Without heavily fortified protein intake, cats aggressively catabolize skeletal muscle, dropping the energy density of weight lost toward the bottom of the range [ACVN; JAVMA peer-reviewed trials]. Using 3,500 (pure fat) would systematically underestimate weight change in both species.
Accumulator logic (runs inside auto-deplete cron):
daily_intake_kcal = SUM(serving_size × feedings_per_day × kcal_per_serving)
                    across all active daily pantry assignments for this pet
maintenance_kcal  = calculateDER(pet) at weight_goal_level = 0
daily_delta       = daily_intake_kcal - maintenance_kcal
accumulator      += daily_delta

IF accumulator >= +threshold (species-specific):
  estimated_weight = current_weight + 1 lb
  send notification, reset accumulator

IF accumulator <= -threshold (species-specific):
  estimated_weight = current_weight - 1 lb
  send notification, reset accumulator
Schema:

Add to pets table: caloric_accumulator DECIMAL(10,2) DEFAULT 0
Add to pets table: accumulator_last_reset_at TIMESTAMPTZ

Notification (user confirms, never auto-updates):
"Based on [Pet Name]'s feeding data, estimated weight is now ~[X] lbs (was [Y] lbs). Update?"
Three actions:

"Looks right" → updates weight_current_lbs, resets accumulator, refreshes weight_updated_at, clears D-117 stale warning. DER recalculates, pantry cascades.
"I weighed them" → opens weight input field. User enters actual weight. Resets accumulator. More accurate than estimate.
"Dismiss" → accumulator continues running. Notification won't re-fire until the next threshold crossing (+1 more lb). Prevents nagging.

Why notify-and-confirm, never auto-update:

Treat calories may not be fully tracked (Treat Battery integration is Phase 2). Average owners provide up to 20% of daily calories through unmeasured treats [AAHA 2021; ACVN — 10% treat guideline, empirical data showing 2× overshoot].
Pets may not finish meals — auto-depletion assumes they did
Table scraps, dental chews, stolen food exist outside the system
Adaptive thermogenesis means static deficit models drift — canine REE drops 10–20% below mathematically predicted values during prolonged caloric restriction [JVIM, German et al. 2011]. An animal rarely loses a full pound of fat for every 3,500 kcal withheld over a prolonged period [Small Animal Clinical Nutrition 5th Ed., Ch. 27].
Framing as "estimated" with user confirmation is D-095 compliant. Auto-updating would be a health claim.

Edge cases:

No pantry items → accumulator stays at 0 (no feeding data to track)
Only treats in pantry → skip (treat calories alone don't represent total intake)
Missing calorie data on products → skip those products in the sum, note inaccuracy
Pet deleted → accumulator deleted (CASCADE)
Weight manually updated by user → reset accumulator to 0
Goal level changed → no accumulator reset (the delta math uses maintenance DER regardless of goal level)

D-095 compliance: "Estimated weight" not "actual weight." "Based on feeding data" not "clinically measured." Always offer the "I weighed them" option to ground-truth.
Clinical backing:

Mixed-tissue caloric equivalents: dogs 2,900–3,400 kcal/lb, cats 2,800–3,300 kcal/lb [Small Animal Clinical Nutrition 5th Ed., Hand et al., Ch. 27; JVIM German et al. 2011]
Pure adipose = ~3,500 kcal/lb, pure lean muscle = 600–800 kcal/lb (dogs), 450–600 kcal/lb (cats) [Small Animal Clinical Nutrition 5th Ed., Ch. 27]
Cats cannot down-regulate protein catabolism during restriction (obligate carnivore hepatic gluconeogenesis) — explains lower mixed-tissue threshold [Small Animal Clinical Nutrition 5th Ed., Ch. 20; ACVN clinical reference]
Adaptive thermogenesis: canine REE drops 10–20% below predicted during restriction, causing weight-loss plateaus [JVIM, German et al. 2011]
Neutering reduces feline resting metabolic rate by 20–25% — accumulator must use correct DER multiplier for intact vs neutered [AAHA 2021, Table 3; JAVMA peer-reviewed trials on gonadectomy metabolic impact]
----
### D-162: BCS Reference Tool — Educational, Not Diagnostic
Status: LOCKED
Date: March 20, 2026
Depends on: D-095 (UPVM compliance), D-160 (weight goal slider)
Milestone: M6+
Problem: Pet owners don't know if their pet is overweight. Vets use the 9-point Body Condition Score (BCS) validated by DEXA scan correlation. Kiba can surface this as a reference tool to help owners understand body condition — but must not cross into diagnostic territory.
Decision: Add a BCS reference panel accessible from the weight management section of pet profiles. Educational only — Kiba does not assess, diagnose, or score body condition.
Content (species-specific, separate panels for dogs and cats):
BCS ScoreCategoryDescriptionEstimated Excess WeightCitation1–3UnderweightRibs, vertebrae, pelvic bones easily visible. Severe abdominal tuck, muscle wasting.N/A (deficit)WSAVA BCS Chart; AAHA 20214–5IdealRibs palpable with slight fat covering. Visible waist from above. Clear abdominal tuck. ~15–20% body fat.0%WSAVA BCS Chart; validated against DEXA [Laflamme 1997, JAVMA]6OverweightRibs palpable with slight excess fat. Waist barely visible.~10–15%AAHA 2021 — each point above 5 ≈ 10–15% excess BW7ObeseRibs difficult to feel. No visible waist. Abdomen rounded.~20–30%AAHA 20218–9Severely obeseRibs buried under heavy fat. Back broadened. Abdomen distended.~30–45%+AAHA 2021
Ideal weight formula (displayed as reference, user does not input BCS):
Ideal Weight = Current Weight ÷ (1 + excess fraction)
Example shown: "A 40 lb dog at BCS 7 is ~20% over ideal → 40 ÷ 1.20 = ~33 lbs"
[AAHA Weight Management Guidelines — ideal weight derivation from BCS]
Cat-specific note: Primordial pouch (hanging belly skin flap) is normal feline anatomy and should not be confused with obesity. Include visual callout. [WSAVA Global Nutrition Committee — feline BCS assessment notes]
What this is:

A reference chart with illustrations per BCS score
An educational tool that helps owners understand body condition categories
A link to the goal slider (D-160): "If your pet's body condition suggests they need to lose or gain weight, use the weight goal slider to adjust their feeding plan."

What this is NOT:

NOT an assessment — Kiba does not ask "what's your pet's BCS?" and derive a recommendation
NOT diagnostic — no "your pet is obese" language
NOT an input to scoring or DER calculation — BCS is informational only
NOT a substitute for veterinary evaluation — panel includes: "Body condition is best assessed by your veterinarian during a physical exam."

D-095 compliance: No prohibited terms. No "diagnose," "prescribe," "treat." Factual descriptions of what each score looks like. Citations to AAHA/WSAVA. User makes their own assessment — Kiba provides the framework.
Visual assets needed: Illustrations or silhouettes for each BCS category (dog and cat separately). Either commissioned illustrations or WSAVA's published BCS chart images (check licensing — WSAVA publishes these freely for educational use).
Clinical backing:

BCS 9-point scale validated against DEXA scans for both dogs and cats [Laflamme 1997, JAVMA — original validation study; WSAVA Global Nutrition Committee — adopted as global standard]
10–15% excess body weight per BCS point above ideal [AAHA 2021 Weight Management Guidelines, §2 — Body Condition Assessment]
Optimal BCS 4–5 corresponds to ~15–20% body fat [WSAVA Global Nutrition Committee — Nutritional Assessment Guidelines]
Primordial pouch is normal feline anatomy, frequently mistaken for obesity by owners [WSAVA feline BCS assessment notes; Small Animal Clinical Nutrition 5th Ed., Ch. 5]
Owner BCS accuracy: owners consistently underestimate their pet's BCS by 1–2 points [AAHA 2021, §4 — Client Communication Challenges; multiple JAVMA survey studies]

Rejected:

❌ Interactive BCS questionnaire ("Can you feel your pet's ribs?") — crosses into assessment/diagnostic territory. D-095 risk.
❌ BCS as input to DER calculation — would require clinical validation of owner-reported BCS accuracy, which doesn't exist. Owners consistently underestimate their pet's BCS by 1–2 points [AAHA 2021, §4 — Client Communication Challenges].
❌ Photo-based BCS estimation via AI — liability nightmare. Computer vision for body condition scoring is active research, not production-ready.



Citation Key
Short ReferenceFull SourceAAHA 2021American Animal Hospital Association — 2021 Nutrition and Weight Management Guidelines for Dogs and CatsWSAVAWorld Small Animal Veterinary Association — Global Nutrition Committee, Nutritional Assessment GuidelinesACVNAmerican College of Veterinary Nutrition — clinical reference standardsHand et al.Small Animal Clinical Nutrition, 5th Edition (Hand, Thatcher, Remillard, Roudebush, Novotny)German et al. 2011German AJ et al. — "Quality of life is reduced in obese dogs but improves after successful weight management." JVIM, 2011. (Also: German AJ — "The growing problem of obesity in dogs and cats." J Nutr, 2006.)Laflamme 1997Laflamme DP — "Development and validation of a body condition score system for dogs/cats." Canine Practice / JAVMA, 1997.JAVMAJournal of the American Veterinary Medical Association — peer-reviewed trials on gonadectomy, obesity, weight management
Three decisions drafted. D-160 supersedes D-061. D-161 is new (caloric accumulator). D-162 is new (BCS reference). All clinical claims cite primary veterinary sources above.
---

### D-163: Pet Health Records via Appointment Completion
**Status:** LOCKED
**Date:** March 20, 2026
**Depends on:** D-103 (Pet Appointments), D-095 (UPVM compliance), D-052 (multi-pet premium gate)
**Milestone:** M5 (Session 9 — bundled with appointments)

**Problem:** Vaccination and deworming history are core pet health records that owners lose track of. Standalone logging is friction — users won't navigate to a separate screen to enter data after a vet visit. But they *will* tap "Complete" on an appointment they already scheduled.

**Decision:** When a user completes a `vaccination` or `deworming` appointment, present a health record logging sheet before finalizing. One tap to log, one tap to skip. If logged, auto-create a follow-up appointment based on the user's selected interval.

**Why one table, not two:** Vaccinations and dewormings are structurally identical — name, date administered, next due date, vet, notes. A `record_type` column distinguishes them cleanly. This also extends naturally to future record types (flea treatments, heartworm, dental cleanings) without new tables or migrations.

**Completion flow (vaccination and deworming appointments only):**

1. User taps "Mark Complete" on a vaccination or deworming appointment
2. Bottom sheet slides up with type-adaptive copy:
   - Vaccination: "Log this vaccine?"
   - Deworming: "Log this deworming?"
3. Pre-populated fields:
   - **Treatment name** — text input, pre-filled from appointment `notes` if available
   - **Date administered** — date picker, default today
   - **Next due** — optional picker with type-specific defaults:

     | Type | Options | Default |
     |---|---|---|
     | Vaccination | 1 year / 3 years / Custom / No follow-up needed | 1 year |
     | Deworming | 3 months / 6 months / 1 year / Custom / No follow-up needed | 3 months |

   - **Vet / clinic** — text input, pre-filled from appointment `location`
   - **Pet(s)** — read-only, from appointment `pet_ids`
4. Two actions:
   - **"Log [Vaccine/Deworming]"** → creates `pet_health_records` row(s) (one per pet in `pet_ids`) + if follow-up selected, auto-creates a new appointment at the due date
   - **"Skip"** → appointment completes normally, no record created
5. Appointment marked complete regardless of choice

**Non-qualifying appointments:** `vet_visit`, `grooming`, `medication`, `other` — no health record sheet. `completeAppointment()` behaves exactly as before.

**Schema (included in migration 017 alongside pet_appointments):**

```sql
CREATE TABLE pet_health_records (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  pet_id            UUID NOT NULL REFERENCES pets(id) ON DELETE CASCADE,
  user_id           UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  appointment_id    UUID REFERENCES pet_appointments(id) ON DELETE SET NULL,
  record_type       TEXT NOT NULL CHECK (record_type IN ('vaccination', 'deworming')),
  treatment_name    TEXT NOT NULL,
  administered_at   DATE NOT NULL,
  next_due_at       DATE,
  vet_name          TEXT,
  notes             TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- RLS: user_id = auth.uid()
-- Index: idx_health_records_pet ON (pet_id)
-- Index: idx_health_records_user_type ON (user_id, record_type)
```

**Appointment type CHECK update:** Add `'deworming'` to `pet_appointments.type` CHECK constraint. Full list becomes: `'vet_visit'`, `'grooming'`, `'medication'`, `'vaccination'`, `'deworming'`, `'other'`.

**`appointment_id` is nullable:** Users may log records manually (past vaccines from a previous vet, deworming history) without an associated appointment. The completion flow is the primary capture point, but a standalone "Add Record" action on the pet profile covers historical data entry.

**Follow-up auto-scheduling:**
- Inherits from original appointment: `type`, `pet_ids`, `location`, `reminder = '1_week'`
- `notes` = treatment name (for pre-population on next completion)
- `recurring = 'none'` — follow-up is a one-shot, not recurring. The chain is self-perpetuating through completion (complete → create next → complete → create next) without accumulating orphaned future appointments.

**Multi-pet:** If the original appointment has 3 pets, creates 3 `pet_health_records` rows (one per pet) + 1 follow-up appointment with all 3 `pet_ids`.

**Pet profile display:** Health records visible on PetHubScreen under two sections:

- **"Vaccines"** — filtered by `record_type = 'vaccination'`. Each row: vaccine name, date, next booster due (if set), vet name.
- **"Dewormings"** — filtered by `record_type = 'deworming'`. Each row: treatment name, date, next due (if set), vet name.
- Both sorted by `administered_at` DESC
- Empty state per section: "No [vaccines/dewormings] logged yet."
- "Add Record" button for manual entry (same fields, `appointment_id = null`, no pre-population)
- Disclaimer: "Health records are for your reference. Consult your veterinarian for your pet's care schedule."

**Vet Report integration (M6):** Vet Report PDF includes latest records from both types — most recent vaccination date + name, most recent deworming date + name. Query: `SELECT * FROM pet_health_records WHERE pet_id = $1 ORDER BY administered_at DESC LIMIT 1` per `record_type`.

**Paywall:** Same as appointments (D-103) — free users get 2 active appointments. Health records themselves are not paywalled. The gate is on creating appointments, not on the records they produce.

**D-095 compliance:**
- "Log this vaccine?" / "Log this deworming?" — not "Record immunization" or "Log antiparasitic treatment"
- Never use "immunize," "protect against," "prevent," "prescribe," or "treat" in UI copy
- Follow-up intervals are user-selected, not app-prescribed
- Disclaimer on health record lists

**Future `record_type` expansion (not M5):**
- `'flea_treatment'` — same shape, default interval 1 month or 3 months
- `'heartworm'` — same shape, default interval 1 month or 6 months
- `'dental_cleaning'` — same shape, default interval 1 year
- Each new type: add to CHECK constraint, add to appointment type CHECK, add default intervals, add pet profile section. No schema migration needed beyond the CHECK update.

**Rejected:**
- Separate tables per record type (`pet_vaccinations`, `pet_dewormings`) — identical schemas, unnecessary table proliferation. One table with `record_type` is cleaner and extensible.
- Standalone health record logging screen — too much friction. The completion flow captures data at the natural moment.
- Recurring appointments for follow-ups — creates infinite chain. Completion-triggered one-shots are self-perpetuating without orphans.
- Pre-populated vaccine/deworming database — adds complexity. Free text covers the need. Searchable dropdown can be added later if usage data justifies it.
- Health records paywalled — punishing users for completing appointments feels hostile. Gate is on appointment creation.
---

### D-164: Unit Label Simplification — "Servings" Replaces Cans/Pouches/Units
**Status:** LOCKED
**Date:** March 20, 2026
**Depends on:** D-152 (pantry depletion model)
**Milestone:** M5 bugfix

**Problem:** The add-to-pantry sheet asks users to choose between "cans" and "pouches" for unit-mode items. This picker adds friction without adding value — the depletion math counts units in and units out regardless of container type. Users don't care whether the system calls it a "can" or a "pouch." They care how many are left.

**Decision:** Replace all unit labels with a single universal term: "servings."

**Schema change:**
```sql
-- Migration 019: update CHECK constraint + backfill
ALTER TABLE pantry_items DROP CONSTRAINT pantry_items_unit_label_check;
ALTER TABLE pantry_items ADD CONSTRAINT pantry_items_unit_label_check
  CHECK (unit_label IN ('servings'));
UPDATE pantry_items SET unit_label = 'servings'
  WHERE unit_label IN ('cans', 'pouches', 'units');
ALTER TABLE pantry_items ALTER COLUMN unit_label SET DEFAULT 'servings';
```

**UI changes:**
- Remove unit picker (cans/pouches toggle) from AddToPantrySheet — no longer needed
- Unit-mode label is always "servings" everywhere:
  - Add sheet: "Total servings" input
  - Depletion breakdown: "1/2 serving x 2 feedings = 1 serving/day . ~24 days"
  - Pantry card: "18 servings left"
  - Notifications: "Running low — 3 servings of [Product] remaining"
  - Empty notification: "[Pet Name]'s [Product] is empty"

**Code changes:**
- `pantry_items.unit_label` always set to `'servings'` on insert — hardcode, no user selection
- Collapse `UnitLabel` type union to single value `'servings'`
- `calculateDepletionBreakdown()`: replace dynamic unitLabel parameter with static `'serving'`/`'servings'` (singular/plural based on count)
- Notification copy: pluralization only — "1 serving" vs "3 servings"

**What this does NOT change:**
- `quantity_unit` (lbs/oz/kg/g/units) — unchanged, this is for bag/pack weight
- `serving_size_unit` (cups/scoops/units) — unchanged, this is for per-feeding measurement
- Depletion math — unchanged, still counts units in and units out
- Weight-mode items — unaffected, they use cups/lbs

**Rejected:**
- Keep cans/pouches picker — added friction, zero value. Users never referenced container type in the app after setting it.
- Auto-detect container type from product data — unreliable, and the distinction doesn't matter for depletion math.
- Free-text unit label — introduces display inconsistency and pluralization nightmares.

---

### D-165: Calorie-Budget-Aware Serving Recommendations
**Status:** LOCKED
**Date:** March 20, 2026
**Supersedes:** D-152 system recommendation behavior (D-152 depletion model unchanged — this revises only the recommendation logic and serving input UX)
**Depends on:** D-152 (depletion model), D-153 (goal weight DER premium gate), D-160 (weight goal slider, when implemented), D-149 (Atwater calorie estimation)
**Milestone:** M5 bugfix

**Problem:** The current `getSystemRecommendation()` computes a serving size from the pet's full DER, ignoring what's already in the pantry. A pet eating 500 kcal/day from Food A gets a recommendation for Food B that also covers the full 1000 kcal DER — doubling the pet's intake. Additionally, changing feedings per day multiplies the serving instead of dividing the budget, and the cup input doesn't accept decimals.

**Three problems, one system:**
1. Recommendation ignores pantry — suggests full DER regardless of existing foods
2. Feedings multiply instead of divide — 2 feedings x 4.3 cups = 8.6 cups instead of 4.3 / 2 = 2.15 cups per feeding
3. No decimal input — can't enter 2.15 cups

**Decision:**

**1. Budget-Aware Recommendation (Auto mode — default)**

The system recommendation works backwards from the remaining calorie budget, not the full DER.

```
total_der = calculateDER(pet)
pantry_kcal = SUM(serving_size x feedings_per_day x kcal_per_serving)
             across all ACTIVE daily pantry items for this pet
remaining_budget = MAX(0, total_der - pantry_kcal)
recommended_per_feeding = remaining_budget / feedings_per_day / kcal_per_serving_unit
```

When feedings change in Auto mode, per-feeding amount recalculates from the same remaining budget. Changing from 1 to 2 feedings halves the per-feeding amount.

When pantry is empty (first food): `remaining_budget = total_der`. Recommends full DER worth of this food.

**2. Auto/Manual Toggle**

- Auto (default): Feedings per day stepper is the only user input. Serving size is calculated read-only.
- Manual: Serving size input appears (decimal-pad keyboard). Auto-calculated value shown as reference.

**3. Calorie Budget Warnings (manual mode)**

Warning ceiling anchored to maintenance DER (slider level 0), not adjusted DER.

- `>120% maintenance` — amber banner: exceeds safe limits
- `>100% maintenance` — inline amber text: above maintenance target
- `<80% adjusted` — muted info: covers ~X% of calorie needs
- Not blocking. D-095 compliant — informational, not prescriptive.
- No warnings for treats.

**4. Smart Default Feedings Per Day**

Check if active pet has any active daily food in pantry: if yes, default 1 feeding (second food scenario). If no, default 2 feedings. Per-pet check, not household-level. Treats always 1.

**5. Decimal Input Fix**

All serving/quantity TextInput keyboardType changed from `'numeric'` to `'decimal-pad'`.

**6. Product Size Pre-fill**

Regex extraction from product name: "15 lb" -> pre-fill 15 lbs, "24 Pack" -> pre-fill 24 units. Best-effort, user can override.

**Implementation:** `computePetDer()`, `computeExistingPantryKcal()`, `computeAutoServingSize()`, `computeBudgetWarning()`, `getSmartDefaultFeedingsPerDay()`, `parseProductSize()` in `pantryHelpers.ts`. AddToPantrySheet reads pantry store for existing items.

**What this does NOT change:** D-152 depletion model, scoring, Treat Battery, diet completeness.

**Rejected:**
- Hard-block over-budget entries — some pets legitimately need more. D-095 non-compliant.
- Auto-rebalance existing items — overrides user-set amounts (D-157).
- Per-product unit labels (cans/pouches) — already simplified by D-164.

### D-166: AddToPantrySheet — Weight Unit Auto-Conversion + Cups/Servings Context
**Status:** LOCKED
**Date:** March 21, 2026
**Milestone:** M5 (polish)
**Depends on:** D-152 (depletion model), D-164 (servings label), D-165 (budget-aware recommendations)

**Problem:** The add-to-pantry sheet's bag size input was unintuitive:
1. Switching between lbs/oz/kg/g did not convert the number — user had to re-type.
2. No way to understand bag size in cups or servings, even though feedings are measured in cups.
3. The depletion estimate was confusing because the weight-to-cups conversion via calorie density was invisible.

**Decision — 3 changes to AddToPantrySheet:**

**1. Auto-convert weight units on tap**

Tapping a weight unit chip (lbs/oz/kg/g) converts the current value in the input box. Example: 15 lbs → tap "oz" → 240 oz → tap "kg" → 6.8 kg → tap "g" → 6804 g.

Rounding rules: grams round to whole numbers, kg to 2 decimals, lbs and oz to 1 decimal. Conversions go through kg as the intermediate unit.

**2. Cups + servings helper text (NOT a chip)**

Below the bag size input, muted helper text shows the cup equivalent and DER-aware total servings:
`≈ 61 cups · ~42 servings at 1.46 cups each`

Only visible when the product has both `ga_kcal_per_kg` and `ga_kcal_per_cup` data. Servings count visible when serving size is known (auto or manual mode). The serving size in auto mode comes from `computeAutoServingSize()` which is DER-based — so servings count updates dynamically when feedings_per_day changes or DER changes.

Formula: `cups = (weightKg × kcalPerKg) / kcalPerCup`, `servings = cups / cupsPerFeeding`.

**3. "Enter as servings instead" action link**

Below the helper text, a small accent-colored tappable link. On tap:
- Switches to Unit serving mode
- Sets `quantity_original` = calculated total servings (rounded)
- Sets `quantity_unit` = 'units', `unit_label` = 'servings'
- Depletion math now uses servings in / servings out — simpler mental model

This is optional — user can stay in weight mode if they prefer.

**Rejected:**
- Cups as inline chip next to lbs/oz/kg/g — cups is a derived value, not a unit of bag measurement. Looked like a unit selector, not a conversion action.
- Auto-switch to servings mode — too aggressive. User entered weight because that's on the bag label.

**Implementation:** `convertToKg()` (exported), `convertFromKg()`, `convertWeightToCups()`, `convertWeightToServings()` in `pantryHelpers.ts`. AddToPantrySheet uses these for auto-convert, helper text, and servings link.

**What this does NOT change:** Serving mode toggle behavior, auto/manual calculation, D-165 budget logic, D-164 unit labels, depletion math, database schema.

### D-167: Allergen Score Cap — Hard Ceiling at 50
**Status:** LOCKED
**Date:** March 28, 2026
**Milestone:** M6
**Depends on:** D-129 (allergen override), D-097 (allergen cross-reference), D-098 (cross-reactivity)

**Problem:** The D-129 allergen override applies per-ingredient IQ penalties when a product contains a pet's declared allergens, but high-quality products can still score 65+ ("Fair match" or above). ResultScreen only shows "Explore higher-scoring alternatives" at score <= 50 — anything above 50 shows "Consider for occasional use." A food containing a known allergen should never be framed as acceptable.

**Decision:** When a product contains any ingredient matching a pet's declared allergens (direct match via `allergen_group` OR possible match via `allergen_group_possible`), the personalized score is hard-capped at 50. This guarantees the "Explore alternatives" UI prompt and places the product in the amber/red zone.

**Mechanism:**
- Applied in `applyPersonalization()` after all Layer 3 adjustments (life stage, conditions), before final clamp
- Fires when `personalizations.some(p => p.type === 'allergen')` — only when the product actually contains allergen-matching ingredients, not just because the pet has allergens defined
- Cap entry added to personalizations array with the adjustment delta for waterfall transparency
- Follows the cardiac/DCM zero-out pattern (hard override in Layer 3)
- If other adjustments already pushed score below 50, the cap is a no-op

**Applies to:** All product categories (daily food, supplemental, treats). An allergen in a treat is still an allergen.

**Does NOT replace D-129:** The IQ override continues to apply position-weighted severity deductions. The cap is a ceiling on top — they're complementary.

**Regression impact:** Pure Balance (62) and Temptations (9) are scored without pet allergens — cap code path never entered. Zero regression risk.

---
*This document is append-only. Decisions are never silently edited — they are superseded by new decisions with explicit rationale.*
