# Kiba — Product Roadmap

> Master timeline from foundation to scale.
> Updated: March 15, 2026
> Reference: DECISIONS.md for rationale behind each item.

---

## Current Status: M4 Product Detail + Education Complete (M0 + M1 + M2 + M3 + M4 Done)

**Completed:**
- Brand finalized (Kiba / kibascan.com)
- Scoring architecture validated (55/30/15 daily food, 65/35/0 supplemental, 100% treats)
- 2 interactive HTML prototypes (Cat Treat V3.1, Dog Food V3)
- Decision log established (136 decisions, D-001 through D-136)
- 5 toxicity databases compiled (380+ items across dog/cat)
- Competitive analysis (Pawdi teardown complete)
- Pricing model locked ($24.99/yr annual, $5.99/mo monthly, 5 free scans/week)
- App Store strategy drafted (ASO, screenshot sequencing, description copy)
- Recall Event PR playbook written
- LLM Nutritional Refinery pipeline designed
- Nutritional Profile Bucket spec complete (`NUTRITIONAL_PROFILE_BUCKET_SPEC.md`) — AAFCO thresholds, DMB conversion, trapezoidal scoring curves, life stage modifiers, sub-nutrient weights
- Dog breed modifier research complete (`BREED_MODIFIERS_DOGS.md`) — 23 breeds, 3 tiers, clinically researched (pending formal vet audit M2)
- Cat breed modifier research complete (`BREED_MODIFIERS_CATS.md`) — 21 breeds, 3 tiers, clinically researched (pending formal vet audit M2)
- Suitability score reframing strategy complete (D-094) — attorney-approved legal strategy
- UPVM compliance rules locked (D-095) — prohibited terms list for all UI copy
- M0 foundation complete: Expo + TypeScript project, Supabase schema with RLS, Zustand stores, navigation shell, onboarding flow (D-092)
- M1 scan → score pipeline complete: camera + barcode, 3-layer scoring engine (126 tests across 7 suites), result screen with progressive disclosure, score ring with D-136 dual color system (supersedes D-113), concern tags, waterfall breakdown, full ingredient list
- M2 UI design concept reviewed, 9 new decisions locked (D-116 through D-124): approximate age mode, stale weight guard, sex field, "Perfectly Healthy" chip, multi-pet carousel, haptic feedback map, species selection pre-screen, species-specific activity labels, treat logging entry points
- Pet Profile Spec complete (`PET_PROFILE_SPEC.md`) — profile fields, conditions, allergens, breed modifiers, editing UI
- Portion Calculator Spec complete (`PORTION_CALCULATOR_SPEC.md`) — RER/DER math, goal weight, cat safety guards
- M2 pet profile CRUD functional: create/edit/delete via petService + Supabase, anonymous auth, photo upload to Storage, species selection pre-screen (D-122), species-specific activity labels (D-123), health conditions + allergen picker, "Perfectly Healthy" chip (D-119), approximate age mode (D-116), stale weight indicator (D-117), multi-pet carousel (D-120), score accuracy bar, DER/treat battery display
- M3 data pipeline + paywall complete: Apify import pipeline (1,589 products), GA refinery (Haiku extraction + validator), formula detection (ingredients_hash), database miss flow (D-091 external UPC + D-128 Haiku classification), parse-ingredients Edge Function, RevenueCat paywall (D-126 psychology patterns), rolling 7-day scan window, legal clickwrap TOS, scan experience polish (haptic/animation/sound). 447 tests passing.
- M4 Session 6: D-136 supplemental classification complete — SVG score ring (270° open arc), 65/35/0 scoring weights, micronutrient modifier suppression, dual 5-tier color system, supplemental badge + contextual line, AafcoProgressBars macro-only mode, backfill script, 24 new tests. 497 tests passing.
- M4 Session 6 (final): E2E verification, ResultScreen component reorder, ScoreWaterfall supplemental weights fix, SCORING_WEIGHTS extracted to constants.ts (single source of truth), compliance audit (20/20 PASS), documentation updates. 501 tests passing.

---

## M0: Foundation (Weeks 1–3)

> Goal: Bootable app skeleton with type-safe data models, database schema, and navigation shell.

### Infrastructure
- [x] Register kibascan.com via Porkbun
- [x] Initialize Expo + TypeScript project (strict mode, no `any` types)
- [x] Set up Supabase project (see schema below)
- [x] Configure Zustand global store (active pet, modal state, scan cache)
- [x] Scaffold folder structure: `src/{components,screens,stores,types,utils,services,assets}`
- [x] Set up EAS Build for iOS development builds

### Supabase Schema (Complete)
The schema below corrects Gemini's incomplete version — includes all columns needed for the three scoring layers.

```
products
├── id UUID PK
├── brand TEXT NOT NULL
├── name TEXT NOT NULL
├── category TEXT NOT NULL ('daily_food' | 'treat')
├── target_species TEXT NOT NULL ('dog' | 'cat')
├── source TEXT NOT NULL ('scraped' | 'community' | 'curated')
├── aafco_statement TEXT (e.g. 'All Life Stages', 'Adult Maintenance')
├── life_stage_claim TEXT
├── preservative_type TEXT ('natural' | 'synthetic' | 'mixed' | 'unknown')
├── ga_protein_pct DECIMAL(5,2)
├── ga_fat_pct DECIMAL(5,2)
├── ga_fiber_pct DECIMAL(5,2)
├── ga_moisture_pct DECIMAL(5,2)    ← CRITICAL for DMB conversion
├── ga_kcal_per_cup INT
├── ga_kcal_per_kg INT
├── kcal_per_unit INT                ← for single-serve items (pouches, sticks, chews)
├── unit_weight_g DECIMAL            ← weight per single unit (e.g., 85g pouch, 14g treat stick)
├── default_serving_format TEXT       ← 'bulk' | 'unit_count' | 'cans' (auto-set from product_type)
├── ga_taurine_pct DECIMAL(5,3)
├── ga_l_carnitine_mg DECIMAL(8,2)
├── ga_dha_pct DECIMAL(5,3)
├── ga_omega3_pct DECIMAL(5,3)
├── ga_omega6_pct DECIMAL(5,3)
├── ga_zinc_mg_kg DECIMAL(8,2)
├── ga_probiotics_cfu TEXT
├── nutritional_data_source TEXT ('manual' | 'llm_extracted')
├── ingredients_raw TEXT             ← original scraped text
├── ingredients_hash TEXT            ← for formula change detection
├── is_recalled BOOLEAN DEFAULT false
├── is_grain_free BOOLEAN DEFAULT false
├── is_supplemental BOOLEAN DEFAULT false  ← D-136: AAFCO intermittent/supplemental feeding. Routes to 65/35/0 scoring.
├── score_confidence TEXT DEFAULT 'high'
├── last_verified_at TIMESTAMPTZ
├── formula_change_log JSONB
├── needs_review BOOLEAN DEFAULT false   ← community contributions pending moderation
├── affiliate_links JSONB            ← INVISIBLE to scoring engine
├── created_at TIMESTAMPTZ DEFAULT NOW()
├── updated_at TIMESTAMPTZ DEFAULT NOW()

product_upcs
├── upc TEXT PK
├── product_id UUID FK → products(id) ON DELETE CASCADE
└── INDEX btree(upc)

ingredients_dict
├── id UUID PK
├── canonical_name TEXT UNIQUE NOT NULL
├── cluster_id TEXT                  ← for splitting detection (e.g. 'legume_pea')
├── allergen_group TEXT              ← D-098: maps to protein family (e.g. 'chicken', 'beef')
├── allergen_group_possible TEXT[]   ← D-098: unnamed terms that COULD contain allergens
├── dog_base_severity ENUM ('danger' | 'caution' | 'neutral' | 'good')
├── cat_base_severity ENUM ('danger' | 'caution' | 'neutral' | 'good')
├── is_unnamed_species BOOLEAN DEFAULT false
├── is_legume BOOLEAN DEFAULT false
├── position_reduction_eligible BOOLEAN DEFAULT false
├── cat_carb_flag BOOLEAN DEFAULT false
├── base_description TEXT            ← species-agnostic
├── dog_context TEXT                 ← appended at render time
├── cat_context TEXT                 ← appended at render time
├── citation_sources TEXT[]
├── display_name TEXT                ← D-105: full name with chemical name, e.g. "BHA (Butylated Hydroxyanisole)"
├── definition TEXT                  ← D-105: one sentence — what this ingredient physically is
├── tldr TEXT                        ← D-105: 2-3 sentences, engaging summary
├── detail_body TEXT                 ← D-105: full explanation, 1-2 paragraphs
├── citations_display JSONB          ← D-105: array of source strings for UI footer
├── position_context TEXT            ← D-105: explains whether concern is amount-based or presence-based
├── created_at TIMESTAMPTZ DEFAULT NOW()

product_ingredients (junction — links products to ingredients with position)
├── id UUID PK
├── product_id UUID FK → products(id)
├── ingredient_id UUID FK → ingredients_dict(id)
├── position INT NOT NULL            ← label order (1 = first listed)
├── UNIQUE(product_id, position)

pets
├── id UUID PK
├── user_id UUID FK → auth.users(id) ON DELETE CASCADE
├── name TEXT NOT NULL
├── species TEXT NOT NULL ('dog' | 'cat')
├── breed TEXT DEFAULT 'mixed'
├── weight_current_lbs DECIMAL(5,1)      ← renamed from weight_lbs per PET_PROFILE_SPEC
├── weight_goal_lbs DECIMAL(5,1)         ← null = no weight management mode
├── weight_updated_at TIMESTAMPTZ        ← D-117: stale weight guard (amber prompt >6 months)
├── date_of_birth DATE                   ← renamed from birth_date per PET_PROFILE_SPEC
├── dob_is_approximate BOOLEAN DEFAULT false  ← D-116: rescue pet approximate age mode
├── life_stage TEXT                       ← derived, never user-entered (D-064)
├── breed_size TEXT                       ← derived from breed lookup ('small'|'medium'|'large'|'giant')
├── activity_level TEXT DEFAULT 'moderate' ('low' | 'moderate' | 'high' | 'working')
├── is_neutered BOOLEAN                  ← renamed from is_spayed_neutered per PET_PROFILE_SPEC
├── sex TEXT CHECK ('male' | 'female')   ← D-118: optional, null valid. For vet report + pronouns.
├── photo_url TEXT                        ← Supabase storage path
├── created_at TIMESTAMPTZ DEFAULT NOW()
├── updated_at TIMESTAMPTZ DEFAULT NOW()
├── RLS: auth.uid() = user_id

scans                                   ← canonical name per CLAUDE.md (was scan_history)
├── id UUID PK
├── user_id UUID FK → auth.users(id)
├── pet_id UUID FK → pets(id)
├── product_id UUID FK → products(id)
├── final_score INT
├── score_breakdown JSONB            ← full Layer 1/2/3 snapshot
├── scanned_at TIMESTAMPTZ DEFAULT NOW()

pantry_items
├── id UUID PK
├── user_id UUID FK → auth.users(id)
├── pet_id UUID FK → pets(id)
├── product_id UUID FK → products(id)
├── role TEXT ('daily_food' | 'treat' | 'supplement' | 'topper')
├── serving_format TEXT ('bulk' | 'unit_count' | 'cans')  ← auto-detected from product category
├── pack_size_value DECIMAL          ← bag weight in lbs (bulk) OR unit count (pouches/sticks/cans)
├── pack_size_unit TEXT ('lb' | 'oz' | 'kg' | 'units')
├── added_at TIMESTAMPTZ DEFAULT NOW()
├── is_active BOOLEAN DEFAULT true   ← false = removed from pantry but kept in history
├── RLS: auth.uid() = user_id

symptom_logs
├── id UUID PK
├── user_id UUID FK → auth.users(id)
├── pet_id UUID FK → pets(id)
├── product_id UUID FK → products(id)  ← what they were eating
├── symptom TEXT ('itchy' | 'vomit' | 'loose' | 'low_energy' | 'great')
├── logged_at TIMESTAMPTZ DEFAULT NOW()

kiba_index_votes
├── id UUID PK
├── user_id UUID FK → auth.users(id)
├── pet_id UUID FK → pets(id)
├── product_id UUID FK → products(id)
├── taste_vote TEXT ('loved' | 'picky' | 'refused')
├── tummy_vote TEXT ('perfect' | 'soft_stool' | 'upset')
├── voted_at TIMESTAMPTZ DEFAULT NOW()
├── UNIQUE(user_id, pet_id, product_id)  ← one vote per pet per product

pet_conditions (D-097 — many-to-many)
├── id UUID PK
├── pet_id UUID FK → pets(id) ON DELETE CASCADE
├── condition_tag TEXT NOT NULL       ← e.g. 'joint', 'ckd', 'allergy', 'obesity', 'underweight'
├── created_at TIMESTAMPTZ DEFAULT now()
├── UNIQUE(pet_id, condition_tag)
├── RLS: pet_id IN (SELECT id FROM pets WHERE user_id = auth.uid())

pet_allergens (D-097 — many-to-many, only populated when allergy condition exists)
├── id UUID PK
├── pet_id UUID FK → pets(id) ON DELETE CASCADE
├── allergen TEXT NOT NULL            ← e.g. 'beef', 'chicken', 'dairy', or extended protein from searchable dropdown
├── is_custom BOOLEAN DEFAULT false   ← true for "Other" dropdown entries (not in top-12 standard list)
├── created_at TIMESTAMPTZ DEFAULT now()
├── UNIQUE(pet_id, allergen)
├── RLS: pet_id IN (SELECT id FROM pets WHERE user_id = auth.uid())
```

### Navigation Shell
- [x] Bottom tab navigator per D-085: Home | Search | (SCAN raised) | Pantry | Me
- [x] Stack navigators nested per tab
- [x] Placeholder screens for each tab
- [x] Search tab visible but gated (premium paywall on interaction)

### Onboarding Flow (D-092 — Locked: Scan-First)
- [x] Brief intro (1-2 screens: what Kiba does)
- [x] Camera opens immediately after intro — scan first
- [x] After first scan, light profile capture before score displays (D-094 compliance):
  - One screen: pet name (text) + species (dog/cat toggle) — two fields, ≤10 seconds
- [x] Score displays with Layer 1 + Layer 2 active
- [x] Post-score personalization prompt: "Complete [Pet Name]'s profile — add breed, age, and health info for a more tailored score"
- [x] Alternative path: user can skip scanning and navigate to Me tab to set up full profile at any time
- [x] Score updates live when additional profile fields are added (Layer 3 activates)

### NOT at M0 (explicitly deferred)
- ❌ RevenueCat / paywall SDK (→ M3)
- ❌ Barcode scanning logic (→ M1)
- ❌ Scoring engine (→ M1)
- ❌ Community features (→ M8)

---

## M1: Scan → Score Pipeline (Weeks 4–7)

> Goal: User scans a barcode and sees a score result within 2 seconds (perceived).

### Camera & Barcode
- [x] Implement `expo-camera` barcode scanning (NOT deprecated `expo-barcode-scanner`)
- [x] UPC lookup: scanned UPC → `product_upcs` → `product_id` → full product record
- [x] "Product not found" flow → community contribution prompt
- [x] Haptic feedback on successful scan (`expo-haptics`)

### Scoring Engine (Core)
- [x] Layer 1: Position-weighted ingredient scoring
  - [x] Load product ingredients with positions from `product_ingredients`
  - [x] Look up each ingredient in `ingredients_dict` for severity + flags
  - [x] Apply position reduction (proportion-based only, `position_reduction_eligible = true`)
  - [x] Calculate Ingredient Quality sub-score (0-100)
  - [x] Unnamed species penalty: −2 per unnamed fat/protein
- [x] Layer 1: Nutritional Profile (daily food only, 0 for treats)
  - [x] **Implement per `NUTRITIONAL_PROFILE_BUCKET_SPEC.md`** — this is the authoritative reference
  - [x] DMB conversion when `ga_moisture_pct > 12%`
  - [x] 4 sub-nutrients with species-specific weights (Dog: 35/25/15/25, Cat: 45/20/10/25)
  - [x] Trapezoidal scoring curves per sub-nutrient (not binary pass/fail)
  - [x] Compare GA values to AAFCO thresholds by life stage
  - [x] Life stage modifiers (puppy/kitten, senior, large breed puppy)
  - [x] Bonus nutrient scoring (DHA, Omega-3, taurine, L-carnitine, zinc, probiotics)
- [x] Layer 1: Formulation Completeness (daily food only, 0 for treats)
  - [x] AAFCO statement compliance
  - [x] Preservative quality assessment
  - [x] Protein naming specificity
- [x] Category-adaptive weighting: 55/30/15 for daily food, 65/35/0 for supplemental (D-136), 100/0/0 for treats
- [x] Layer 2: Species rules
  - [x] Dog: DCM advisory (−8% for grain-free + 3+ legumes in top 7)
  - [x] Dog: DCM mitigation (+3% for taurine + L-carnitine supplementation)
  - [x] Cat: Carb overload (−15% for 3+ high-glycemic carbs in top 5)
  - [x] Cat: Mandatory taurine check
  - [x] Cat: UGT1A6 enzyme warnings for specific compounds
- [x] Layer 3: Personalization
  - [x] Allergy cross-reference
  - [x] Life stage matching
  - [x] Breed-specific modifiers per `BREED_MODIFIERS_DOGS.md` and `BREED_MODIFIERS_CATS.md`
  - [x] Breed modifier cap: ±10 within nutritional bucket
  - [x] Register `no_modifier` breeds to prevent false penalties
- [x] Ingredient splitting detection: `GROUP BY cluster_id HAVING count >= 2`
- [x] FDA recall check: boolean lookup against recall database
- [x] Score engine must be deterministic and independently testable per layer

### Result Screen — Progressive Disclosure (D-108)

**Above the fold (no scrolling — 10-second store aisle answer):**
- [x] Score gauge (animated SVG ring) — displays "[X]% match for [Pet Name]" (D-094)
- [x] Pet name and photo always visible on result screen (legal requirement)
- [x] Concern tags: render up to 3 from D-107 tag map (Artificial Color, Added Sugar, Unnamed Source, Synthetic Additive, Heart Risk). Tap → tooltip explainer. Heart Risk → dogs only.
- [x] Severity badge strip: 4-5 worst-scoring ingredients as color-coded chips (red/orange), sorted worst-first, tappable → D-105 ingredient detail modal
- [x] Safe Swap CTA: placeholder slot, hidden until M6 Alternatives Engine provides data

**Below the fold (scroll to explore):**
- [x] Kiba Index: placeholder slot, hidden until M8 community data available
- [x] Tappable waterfall breakdown showing score math (D-094):
  - "Ingredient Concerns: −[X] pts" with citation links
  - "[Pet Name]'s Nutritional Fit: ±[X] pts"
  - "[Pet Name]'s Breed & Age Adjustments: ±[X] pts"
- [x] Full ingredient list: ALL ingredients sorted worst→best, color-coded by severity, each tappable → D-105 detail modal. Competitive differentiator — do not hide behind a toggle.
- [x] "Track this food" CTA: adds to pantry (placeholder until M5)
- [x] ⓘ tooltip: "Suitability is an algorithmic estimate for [Pet Name]'s specific profile based on published research. It is not a universal product rating or a substitute for veterinary medical advice."

**NOT on scan result screen:** Poop Check, Symptom Tracker → Me tab (pet-over-time, not product-specific)

### Loading Experience
- [x] 6-step terminal message sequence (see D-037)
- [x] Minimum 1.2s display time even if data returns faster (perceived thoroughness)

---

## M2: Pet Profiles + Vet Audit (Weeks 8–11)

> Goal: Personalized scanning for multi-pet households. Veterinary validation of critical data.

### Pet Profiles
- [x] Create/edit/delete pet profiles
- [x] Species, breed, weight, birth date, activity level, neutered, sex (D-118)
- [x] Breed selector: alphabetical A→Z, searchable, "Mixed Breed" and "Other" pinned last (D-102)
- [x] Pet photo from device gallery (Expo ImagePicker → square crop → local storage + Supabase Storage sync). Default **species silhouette** (generic dog/cat outline) if skipped. Renders on profile, scan result header (D-094), pet switcher (D-120), and vet report PDF header (D-099).
- [x] Health conditions multi-select (D-097) — species-filtered list
- [x] "Perfectly Healthy" chip (D-119) — green, mutual exclusion with all condition chips
- [x] Food allergen sub-picker when allergy condition selected (D-097) — with cross-reactivity expansion (D-098)
- [x] Approximate age mode for rescue pets (D-116) — `[Exact Date] | [Approximate Age]` toggle, synthesized DOB
- [x] life_stage auto-derivation from age + species + breed size (D-064)
- [x] Multi-pet switching carousel on Pet Hub (D-120) — `useActivePetStore` Zustand, teal border active, dimmed inactive
- [x] Active pet selector persists across sessions
- [ ] Goal weight field (premium-gated, only editable when obesity/underweight condition set)
- [x] Stale weight indicator (D-117) — amber prompt on Hub if weight >6 months old
- [x] Sex field (D-118) — segmented control `[Male] [Female]`, optional, for vet report + pronouns
- [x] Pet deletion: type name to confirm + 30-day soft-delete grace period
- [ ] Haptic feedback (D-121) — `utils/haptics.ts` utility with named functions, wired to all interactive elements (code exists, untested on iOS)

### Portion Calculator
- [x] RER calculation: `70 × (kg)^0.75`
- [x] DER multiplier tables (species-specific, see D-060 through D-063)
- [x] Daily portion display (cups/day or grams/day based on kcal/cup)
- [ ] Goal weight mode: RER at goal weight, not current weight (premium)

### Treat Battery
- [x] 10% of DER = daily treat budget in kcal
- [x] Per-treat calculation: budget ÷ kcal_per_treat = safe count
- [x] Visual battery gauge (% of daily budget consumed)
- [ ] Cat hepatic lipidosis guard: warn if implied weekly loss >1% body weight

### Veterinary Audit (CRITICAL — Moved to M2)
- [ ] Scope: danger-rated ingredients, species-specific physiological claims, scoring methodology
- [ ] Review `BREED_MODIFIERS_DOGS.md` — 23 breed entries, all modifiers pending vet clearance
- [ ] Review `BREED_MODIFIERS_CATS.md` — 21 breed entries, all modifiers pending vet clearance
- [ ] Review `NUTRITIONAL_PROFILE_BUCKET_SPEC.md` — trapezoidal curves, AAFCO thresholds
- [ ] Validate position_reduction_eligible flags
- [ ] Review cat hepatic lipidosis warning copy
- [ ] Review geriatric cat calorie inflection logic
- [ ] Review DCM advisory thresholds and mitigation logic
- [ ] Sign off on clinical copy in ingredient modals
- [ ] UPVM compliance check: all ui_callout text passes D-095 prohibited terms list
- [ ] Deliverable: signed audit letter for legal defensibility

---

## M3: Data Pipeline + Paywall (Weeks 12–15)

> Goal: Populated product database. Premium tier functional.

### Data Import Pipeline (Apify)
- [x] Apify scraping: Chewy product data (1,589 products imported)
- [x] Capture: product name, UPC/GTIN, ingredients text, GA text, brand, category, images
- [x] Handle missing GTINs: insert as name-only with `manual_review` flag
- [x] Store raw scraped data, process through pipeline scripts

### LLM Nutritional Refinery
- [x] Batch processor: identify rows where `ingredients_raw` populated but GA columns null
- [x] Claude Haiku extraction with strict JSON schema prompt
- [x] Python validation: range plausibility checks before DB insertion (D-043)
- [x] Flag out-of-range values for manual review (never silently corrupt)
- [x] Set `nutritional_data_source = 'llm_extracted'` on processed records
- [x] UI disclaimer for LLM-extracted data

### Formula Change Detection
- [x] Hash ingredients on ingestion → `ingredients_hash`
- [ ] Monthly re-scrape: diff new hash against stored hash (deferred — needs automation infrastructure)
- [ ] Mismatch → score marked "under review" → auto re-score → pantry notification if Δ >15 points
- [x] `last_verified_at` timestamp updated on each successful verification

### Database Miss Handling (Level 4 Hybrid)
- [x] Integrate external UPC API (UPCitemdb free tier: 100 lookups/day) via Edge Function (D-127)
- [x] UPC miss → external lookup → return product name + brand + category
- [x] User confirmation step: "Is this [Product Name]?" (ProductConfirmScreen)
- [x] Haiku product classification (D-128): Edge Function returns suggested category (daily_food/treat/supplement/grooming) + species (dog/cat/all) alongside parsed ingredients. User confirms via tappable chips on IngredientCaptureScreen.
- [x] Supplement/grooming exit paths: store product but do NOT score (D-096, D-083). Show "coming soon" message, return to ScanScreen.
- [x] OCR prompt: photograph ingredient list (IngredientCaptureScreen)
- [x] On-device text extraction + Claude Haiku ingredient parsing (parse-ingredients Edge Function)
- [x] Layer 1 instant partial score with 78/22 missing-GA reweight (daily_food) or 100/0/0 (treat)
- [x] "Partial — nutritional data unavailable" badge on result
- [x] Auto-save parsed product to Kiba DB (`source = 'community'`, `needs_review = true`, `contributed_by = auth.uid()`)
- [x] Store Haiku classification suggestions + user corrections for accuracy auditing
- [x] If external UPC also misses → skip confirmation, go straight to OCR prompt
- [x] Add `needs_review BOOLEAN DEFAULT false` to products table

### Scan Experience Polish (Session 6)
- [x] Haptic feedback on barcode detection (`expo-haptics` Success type, Warning for miss)
- [x] Scanner frame: corner brackets + animated green scan line + "locked on" snap animation (ScannerOverlay component)
- [x] Confirmation tone: bundled short chime via `expo-av`, with mute toggle (persisted in AsyncStorage)
- [x] Mute toggle icon on ScanScreen (Ionicon speaker, D-084 compliant)

### Paywall Implementation
- [x] Install RevenueCat SDK
- [x] Configure annual ($24.99/yr) and monthly ($5.99/mo) products in App Store Connect
- [x] Build paywall screen: lead with annual, monthly as "pay more" option (D-126 psychology)
- [x] Personalized copy: "About $2/month to protect [pet name] for a full year"
- [x] Implement 5 active trigger moments (D-052, updated by D-125):
  1. 6th scan in a week (rolling 7-day window, NOT calendar week)
  2. Second pet profile
  3. First safe swap tap
  4. Search by product name (text lookup without barcode)
  5. Compare (side-by-side product comparison)
  + 2 pre-wired (hidden until feature ships): vet report, elimination diet
- [x] `src/utils/permissions.ts` — centralized paywall boundary (ONLY location for paywall checks)
- [x] Free tier: 5 scans/week (rolling), 1 pet profile, barcode scan only, basic score, recall alerts
- [x] Premium: unlimited scans, multi-pet, search by name, goal weight, treat battery, compare, safe swaps

### Legal — Onboarding Clickwrap (D-094)
- [x] TOS checkbox during account creation / first use (Tier 1 disclaimer) — TermsScreen
- [x] Draft: "Kiba provides algorithmically generated suitability estimates based on public veterinary research and your pet's specific profile. Kiba scores do not constitute absolute product quality or safety ratings, nor are they an assessment of regulatory compliance."
- [x] Must be active checkbox, not passive scroll-through
- [x] Blocks app usage until accepted (3-way navigation gate: TOS → Onboarding → Main)

---

## M4: Product Detail + Education (Weeks 16–19)

> Goal: Full result screen with all UI components from mockups.

### Score Context
- [ ] Benchmark bar — gradient track with product pin + category average marker (requires M3 product database for category averages). Answers "Is 66% normal for grain-free salmon?" Especially important in the 50-69% amber zone where "Fair match" needs relative context.

### Nutrition Panel
- [ ] AAFCO progress bars with threshold markers
- [ ] DMB conversion display for wet food
- [ ] Bonus nutrient grid
- [ ] "[Pet Name]'s Nutritional Fit" label (D-094 — internal weight not exposed to users)

### Ingredient Experience
- [ ] Worst-to-best sorted list with section dividers
- [ ] Position map (colored bar strip)
- [ ] Ingredient splitting detection card
- [ ] Flavor deception card (when applicable)
- [ ] DCM advisory card with mitigation callout
- [ ] Singleton modal with TL;DR, clinical copy, citations

### Education
- [ ] "What Good Looks Like" reference card
- [ ] Score waterfall breakdown — tappable, shows full Layer 1/2/3 math with pet name context (D-094)
- [ ] Loading terminal with step-by-step messages

### Actions
- [ ] Pantry button (add to user's pantry)
- ~~Compare button~~ → moved to M6
- ~~Vet Report~~ → moved to M5-M6 (based on soft launch feedback)

### Supplemental Product Classification (D-136)
- [x] `is_supplemental` column on products table (migration 007)
- [x] Feeding guide keyword parser (`supplementalClassifier.ts`) — detects AAFCO intermittent/supplemental language at import time
- [x] Backfill script (`scripts/data/backfill_supplemental.ts`) — classify existing products via aafco_statement keyword match
- [x] Scoring engine: 65/35/0 weight routing for supplemental products. NP bucket evaluates macros only (skip micronutrient AAFCO checks)
- [x] Five-tier dual color system (D-136 supersedes D-113): green family for daily food, teal/cyan family for supplementals, shared yellow/amber/red below 65
- [x] Open arc ring (270°) for supplemental products — SVG-based via react-native-svg, proper fill remapping
- [x] "Supplemental" badge + "Best paired with a complete meal" contextual line
- [x] AafcoProgressBars: macro bars only for supplemental products (hide micronutrient bars)

---

## M5: Pantry + Recall Siren (Weeks 20–23)

> Goal: The killer retention feature. "Smoke alarm for recalled pet food."

### Pantry
- [ ] Add scanned products to pantry
- [ ] Me tab "Log a Treat" scan button under Treat Battery — auto-deducts kcal (D-124)
- [ ] Per-pet pantry assignment with multi-pet sharing (many-to-many — one bag assigned to multiple pets)
- [ ] Pantry dashboard showing all products with scores
- [ ] Bag/pack countdown with days remaining (D-065) — 3 serving formats: bulk (cups/day from DER ÷ kcal_per_cup), unit count (pouches/cans), treats (units from Treat Battery budget)
- [ ] Shared pantry depletion: sum consumption rates across all assigned pets. Display: "Shared by Buster & Milo · 3.7 cups/day combined · ~13 days remaining"
- [ ] User inputs bag size or pack quantity at add-to-pantry
- [ ] Low stock nudge at ≤5 days or ≤5 units — affiliate buy button surfaces here (D-065)
- [ ] Staleness badge for products unverified >90 days
- [ ] Feeding schedule per pantry item: daily (1-3x/day with clock times) or as-needed (D-101)
- [ ] Push notifications on feeding schedule — grouped for multi-pet households
- [ ] Auto-depletion tied to feeding schedule — no manual logging for daily items (D-101)

### Pantry Diet Completeness (D-136 Part 5)
- [ ] Diet-level completeness check per pet when pantry composition changes (add/remove product, change assignment)
- [ ] Supplemental product(s) alongside ≥1 complete food → no warning, optional "Topper" tag on pantry card
- [ ] 2+ supplemental feeds with no complete food in pantry → persistent amber warning banner: "⚠️ [Pet Name]'s diet may be missing essential nutrients. [Product] is designed as a supplement, not a complete meal. Consider adding a complete food."
- [ ] Only supplemental products in pantry, zero complete food → red diet health card: "🔴 No complete meals found in [Pet Name]'s diet. Supplemental foods don't provide all required vitamins and minerals on their own."
- [ ] Warnings are per-pet (each pet's pantry evaluated independently)
- [ ] All warning copy D-095 compliant — factual, no clinical language
- [ ] This is a diet-level assessment, NOT a score modifier — product scores never change based on pantry composition

### Pet Appointments (D-103)
- [ ] Schedule vet, grooming, medication, vaccination, and custom appointments
- [ ] Per-pet or multi-pet assignment
- [ ] Optional reminders (1hr / 1 day / 3 days / 1 week before)
- [ ] Recurring appointments (monthly, quarterly, 6-month, yearly) for flea meds, checkups
- [ ] Upcoming appointments visible on pet profile and home screen
- [ ] Past appointments archived for future vet report integration

### Recall Siren (Free Tier — D-125)
- [ ] FDA recall RSS feed monitoring (automated, not manual checking)
- [ ] Cross-reference recalled products against user pantry
- [ ] Push notification to affected users — NOT premium-gated
- [ ] Product score → 0 with recall banner on scan result
- [ ] Recall detail screen with FDA link and recommended actions
- [ ] Historical recall log per product

### Weekly Digest Push Notification (D-130)
- [ ] Supabase scheduled function: weekly scan summary + pantry state + recall alerts
- [ ] Expo push notification integration
- [ ] Adaptive content: activity summary if active, re-engagement nudge if inactive
- [ ] User preference: weekly (default) or daily frequency
- [ ] Free for all users (retention → conversion funnel)

---

## M6: Alternatives Engine (Weeks 24–27)

> Goal: "This scored 44. Here are three options scoring 80+."

### Compare & Vet Report (moved from M4)
- [ ] Compare button (side-by-side product comparison) — paywall gate already wired
- [ ] Vet Report (shareable PDF summary for vet visits)

### Safe Swap Recommendations
- [ ] Query products in same category + species with score >threshold
- [ ] Filter by user's pet allergies
- [ ] Rank by score, then by price (if affiliate data available)
- [ ] "See Higher-Scoring Alternatives" CTA on all results

### Affiliate Integration
- [ ] Chewy affiliate program application (target: ~500+ active users)
- [ ] Affiliate link storage in `affiliate_links` JSONB (scoring engine blind to this)
- [ ] Amazon Associates setup with registered app URLs
- [ ] FTC disclosure auto-rendered below buy buttons
- [ ] Buy buttons hidden for products scoring <50
- [ ] Chewy: show estimated price. Amazon: "Check Current Price" (TOS compliant)

---

## M7: 7-Day Safe Switch Guide (Weeks 28–30)

> Goal: Guided food transition to reduce digestive upset.

- [ ] Day-by-day transition plan (old food % → new food %)
- [ ] Tummy Check prompts during transition
- [ ] Completion celebration + review prompt
- [ ] Species-specific transition speeds (cats need slower transitions)

---

## M8–M10: Community Features (Weeks 31–40)

> Goal: User-generated data flywheel.

### Kiba Index (M8)
- [ ] Taste Test voting (Loved it / Picky / Refused)
- [ ] Tummy Check voting (Perfect / Soft stool / Upset)
- [ ] Aggregate display on product results
- [ ] One vote per pet per product enforcement

### Symptom Detective (M9)
- [ ] Daily symptom logging (5 categories)
- [ ] Pattern detection algorithm (flag correlations after 2-4 weeks)
- [ ] "Possible sensitivity to [ingredient]" advisory when pattern detected
- [ ] Data visualization (calendar heatmap of symptoms)

### Community Contributions (M10)
- [ ] Submit missing products (photo → OCR → review) — **M3 foundation already built:** D-091 miss flow, parse-ingredients Edge Function, community save with `contributed_by = auth.uid()`
- [ ] Moderation queue UI for submitted products (M3 stores with `needs_review = true`, M10 adds admin/review interface)
- [ ] XP engine: points for scanning, contributing, correcting classifications (D-128 `user_corrected_*` fields), streaks
- [ ] Cosmetic rewards (profile borders, badges) — positioned as contributor thank-you, not primary hook
- [ ] Top contributor leaderboard (query `contributed_by` from M3 community products)
- [ ] Community safety flags (users flag suspect scores → review queue)

---

## M11: Launch Prep (Weeks 41–44)

> Goal: App Store ready.

### App Store Optimization
- [ ] Screenshot sequencing (5 screens — see strategy doc section 6b)
- [ ] App Store description (opening 3 lines — see strategy doc section 6c)
- [ ] Primary category: Health & Fitness. Secondary: Food & Drink
- [ ] Keyword optimization: "pet food scanner", "dog food checker", "cat food ingredients", "pet food recall alert"
- [ ] App icon (translucent bowl + green checkmark + scanner line — already designed)

### Pre-Launch
- [ ] r/kibascan subreddit created and seeded with content
- [ ] Journalist contact list built (NYT, WaPo, The Dodo, BuzzFeed Animals, People Pets)
- [ ] Press outreach template drafted (fill-in-the-blank for recall events)
- [ ] Social copy variants pre-written (TikTok hook, X thread, Reddit post)
- [ ] FDA recall RSS monitoring active
- [ ] Trademark filed ("Kiba" or "KibaScan", USPTO single class)

### Quality
- [ ] Scoring engine test suite: deterministic outputs for reference products
- [ ] Pure Balance Grain-Free Salmon → 69/100 (regression test — may change at M3 with full ingredient data)
- [ ] Temptations Classic Tuna → 44/100 (regression test)
- [ ] DMB conversion test: wet food with 78% moisture
- [ ] Edge cases: missing GA, null kcal, no ingredients, unsupported species → graceful handling
- [ ] Performance: scan → score ≤2s perceived latency
- [ ] RLS verification: user A cannot see user B's pets, scans, or pantry
- [ ] UPVM compliance audit: grep all UI strings for prohibited terms (D-095)
- [ ] Suitability framing audit: no screen displays a score without pet name context (D-094)
- [ ] Breed modifier audit: all `vet_audit_status = 'cleared'` before production

---

## M12: Public Launch (Week 45)

> Goal: iOS App Store. Android 4-6 weeks later.

- [ ] Submit to App Store review
- [ ] Monitor review feedback, respond to initial ratings
- [ ] Review prompt: after 3+ scans AND a positive moment (high score or Safe Switch completion)
- [ ] Never prompt on first session
- [ ] Target: 4.7+ rating

---

## M13–M15: Growth (Weeks 46–56)

### Retention Optimization (M13)
- [ ] Scan streak incentives
- [ ] Weekly pantry digest push notifications
- [ ] "New score available" when re-scraped formula changes

### iOS Home Screen Widget (D-131)
- [ ] Small widget: next feeding time + pet photo
- [ ] Medium widget: pantry low-stock + feeding + treat battery
- [ ] Large widget: weekly summary + feeding schedule + recall badge
- [ ] expo-widgets or native WidgetKit bridge

### Android Launch (M14)
- [ ] Port to Android via Expo EAS
- [ ] Play Store ASO (different keyword dynamics)
- [ ] Test paywall conversion rates vs iOS

### International (M15)
- [ ] UK/Canada/Australia keyword localization ("pet food checker UK")
- [ ] Currency localization for affiliate links
- [ ] Regional AAFCO equivalent standards (FEDIAF for EU)

---

## M16+: Expansion (Post-Launch)

### Elimination Diet Trial Tracker (D-100 — First Priority)
> Goal: Transform Kiba from a scanner into a longitudinal health platform. Daily engagement for 8-12 weeks.
> **Depends on:** M9 (Symptom Detective), D-097 (conditions), D-098 (cross-reactivity), D-099 (vet report PDF)

- [ ] Trial setup wizard (4 steps: pet → novel protein/carb → vet info → settings)
- [ ] Trial state machine (SETUP → ACTIVE ↔ PAUSED → COMPLETE → REINTRODUCTION → CLOSED)
- [ ] Active trial scanning: whitelist/blocked list evaluation with D-098 cross-reactivity
- [ ] CONTAMINATION verdict with alert card + auto-logged contamination event
- [ ] AMBIGUOUS verdict for umbrella terms during trial (heightened sensitivity)
- [ ] Upgrade Symptom Detective to 6-dimension 0-4 scale during active trial
- [ ] Daily push notification at user-configured check-in time
- [ ] Pattern detection engine (nightly rule-based v1.0): lag correlation, baseline drift, improvement signal, stale trial alert
- [ ] Reintroduction phase: single protein, 14-day observation, REACTION/TOLERATED/INCONCLUSIVE outcomes
- [ ] Vet Report Type B: trial completion report upgrading D-099 PDF with symptom timeline, contamination log, pattern insights, reintroduction log
- [ ] All trial copy D-095 compliant — "possible correlation" not "confirmed," "dietary sensitivity" not "food allergy"
- [ ] Premium hard gate on trial start

### Apple Watch Companion App (D-131)
- [ ] Watch complications: trial day, next feeding, quick symptom log
- [ ] 2-tap symptom logging from Watch face
- [ ] Elimination diet daily check-in
- [ ] Feeding schedule reminders on wrist
- [ ] WatchOS companion via native SwiftUI bridge

### Cosmetics & Grooming (Deferred from Phase 1)
- [ ] Shampoos, flea treatments, paw balms, dental products
- [ ] New scoring framework needed (ingredients-only, no GA equivalent)
- [ ] Major re-engagement marketing event — "Kiba" brand scales here, "Clearbowl" would not have

### Supplements
- [ ] Joint supplements, probiotics, calming aids
- [ ] Interaction checking with current food ingredients

### Vet Partnership (B2B)
- [ ] "Vet Verified" badge: users get scan confirmed by their vet
- [ ] Vet dashboard for recommending products to patients
- [ ] B2B revenue stream

---

## Dependencies & Critical Path

```
M0 (Schema + Types) → M1 (Scan + Score) → M2 (Pets + Vet Audit) → M3 (Data + Paywall)
                                                                        ↓
M4 (Full UI) → M5 (Pantry + Recall Siren) → M6 (Alternatives) → M7 (Safe Switch)
                                                                        ↓
                                               M8-M10 (Community) → M11 (Launch Prep) → M12 (Launch)
```

**Critical path bottleneck:** M2 Vet Audit. If delayed, all clinical copy and species-specific claims remain unvalidated. Everything can ship technically without it, but nothing should ship legally without it.

**Second bottleneck:** M3 Data Pipeline. Without populated product database, the app is an empty scanner. ScraperAPI scraping + LLM refinery must run before M4 UI work has real data to display.

**Post-launch dependency chain:** M9 (Symptom Detective) → M16+ Elimination Diet Trial Tracker (D-100). Trial tracker cannot ship until daily symptom logging has real-world usage data validating the concept. D-098 (cross-reactivity) and D-099 (vet report PDF) must also be complete.

---

*Roadmap is a living document. Milestone timing is approximate (3-4 week blocks). Scope within milestones is firm — scope between milestones can shift based on user feedback after launch.*
