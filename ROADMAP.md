# Kiba — Product Roadmap

> Master timeline from foundation to scale.
> Updated: February 24, 2026
> Reference: DECISIONS.md for rationale behind each item.

---

## Current Status: Pre-Build (Data Collection + Design Sprint Complete)

**Completed:**
- Brand finalized (Kiba / kibascan.com)
- Scoring architecture validated (55/30/15 daily food, 100% treats)
- 2 interactive HTML prototypes (Cat Treat V3.1, Dog Food V3)
- Decision log established (103 decisions locked)
- 5 toxicity databases compiled (380+ items across dog/cat)
- Competitive analysis (Pawdi teardown complete)
- Pricing model locked ($24.99/yr annual, $5.99/mo monthly, 5 free scans/week)
- App Store strategy drafted (ASO, screenshot sequencing, description copy)
- Recall Event PR playbook written
- LLM Nutritional Refinery pipeline designed
- Nutritional Profile Bucket spec complete (`NUTRITIONAL_PROFILE_BUCKET_SPEC.md`) — AAFCO thresholds, DMB conversion, trapezoidal scoring curves, life stage modifiers, sub-nutrient weights
- Dog breed modifier research complete (`BREED_MODIFIERS_DOGS.md`) — 20 breeds, 3 tiers, vet-reviewed for accuracy
- Cat breed modifier research complete (`BREED_MODIFIERS_CATS.md`) — 18 breeds, 3 tiers, vet-reviewed for accuracy
- Suitability score reframing strategy complete (D-094) — attorney-approved legal strategy
- UPVM compliance rules locked (D-095) — prohibited terms list for all UI copy

---

## M0: Foundation (Weeks 1–3)

> Goal: Bootable app skeleton with type-safe data models, database schema, and navigation shell.

### Infrastructure
- [ ] Register kibascan.com via Porkbun
- [ ] Initialize Expo + TypeScript project (strict mode, no `any` types)
- [ ] Set up Supabase project (see schema below)
- [ ] Configure Zustand global store (active pet, modal state, scan cache)
- [ ] Scaffold folder structure: `src/{components,screens,stores,types,utils,services,assets}`
- [ ] Set up EAS Build for iOS development builds

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
├── created_at TIMESTAMPTZ DEFAULT NOW()

product_ingredients (junction — links products to ingredients with position)
├── id UUID PK
├── product_id UUID FK → products(id)
├── ingredient_id UUID FK → ingredients_dict(id)
├── position INT NOT NULL            ← label order (1 = first listed)
├── UNIQUE(product_id, position)

pet_profiles
├── id UUID PK
├── user_id UUID FK → auth.users(id) ON DELETE CASCADE
├── name TEXT NOT NULL
├── species TEXT NOT NULL ('dog' | 'cat')
├── breed TEXT
├── weight_lbs DECIMAL(5,2) NOT NULL
├── goal_weight_lbs DECIMAL(5,2)     ← null = no weight loss mode
├── birth_date DATE                  ← used to derive life_stage
├── life_stage TEXT                  ← derived, never user-entered
├── activity_level TEXT DEFAULT 'moderate' ('sedentary' | 'moderate' | 'active' | 'working')
├── is_spayed_neutered BOOLEAN DEFAULT true
├── is_indoor BOOLEAN                ← cats only, affects DER multiplier
├── allergies TEXT[]
├── weight_loss_target_rate DECIMAL(5,3)  ← calculated, warns if >1% for cats
├── RLS: auth.uid() = user_id

scan_history
├── id UUID PK
├── user_id UUID FK → auth.users(id)
├── pet_id UUID FK → pet_profiles(id)
├── product_id UUID FK → products(id)
├── final_score INT
├── score_breakdown JSONB            ← full Layer 1/2/3 snapshot
├── scanned_at TIMESTAMPTZ DEFAULT NOW()

pantry_items
├── id UUID PK
├── user_id UUID FK → auth.users(id)
├── pet_id UUID FK → pet_profiles(id)
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
├── pet_id UUID FK → pet_profiles(id)
├── product_id UUID FK → products(id)  ← what they were eating
├── symptom TEXT ('itchy' | 'vomit' | 'loose' | 'low_energy' | 'great')
├── logged_at TIMESTAMPTZ DEFAULT NOW()

kiba_index_votes
├── id UUID PK
├── user_id UUID FK → auth.users(id)
├── pet_id UUID FK → pet_profiles(id)
├── product_id UUID FK → products(id)
├── taste_vote TEXT ('loved' | 'picky' | 'refused')
├── tummy_vote TEXT ('perfect' | 'soft_stool' | 'upset')
├── voted_at TIMESTAMPTZ DEFAULT NOW()
├── UNIQUE(user_id, pet_id, product_id)  ← one vote per pet per product
```

### Navigation Shell
- [ ] Bottom tab navigator per D-085: Home | Search | (SCAN raised) | Pantry | Me
- [ ] Stack navigators nested per tab
- [ ] Placeholder screens for each tab
- [ ] Search tab visible but gated (premium paywall on interaction)

### Onboarding Flow (D-092 — Locked)
- [ ] 2-screen intro: what Kiba does + "let's meet your pet"
- [ ] Minimal profile screen: pet name (text) + species (dog/cat toggle) — one screen, two inputs
- [ ] Camera opens immediately after profile creation
- [ ] Post-first-result prompt: "Add [Pet Name]'s breed and age for breed-specific safety checks"
- [ ] Score updates live when additional profile fields are added (Layer 3 activates)

### NOT at M0 (explicitly deferred)
- ❌ RevenueCat / paywall SDK (→ M3)
- ❌ Barcode scanning logic (→ M1)
- ❌ Scoring engine (→ M1)
- ❌ Community features (→ M8)

---

## M1: Scan → Score Pipeline (Weeks 4–7)

> Goal: User scans a barcode and sees a score result within 2 seconds (perceived).

### Camera & Barcode
- [ ] Implement `expo-camera` barcode scanning (NOT deprecated `expo-barcode-scanner`)
- [ ] UPC lookup: scanned UPC → `product_upcs` → `product_id` → full product record
- [ ] "Product not found" flow → community contribution prompt
- [ ] Haptic feedback on successful scan (`expo-haptics`)

### Scoring Engine (Core)
- [ ] Layer 1: Position-weighted ingredient scoring
  - [ ] Load product ingredients with positions from `product_ingredients`
  - [ ] Look up each ingredient in `ingredients_dict` for severity + flags
  - [ ] Apply position reduction (proportion-based only, `position_reduction_eligible = true`)
  - [ ] Calculate Ingredient Quality sub-score (0-100)
  - [ ] Unnamed species penalty: −2 per unnamed fat/protein
- [ ] Layer 1: Nutritional Profile (daily food only, 0 for treats)
  - [ ] **Implement per `NUTRITIONAL_PROFILE_BUCKET_SPEC.md`** — this is the authoritative reference
  - [ ] DMB conversion when `ga_moisture_pct > 12%`
  - [ ] 4 sub-nutrients with species-specific weights (Dog: 35/25/15/25, Cat: 45/20/10/25)
  - [ ] Trapezoidal scoring curves per sub-nutrient (not binary pass/fail)
  - [ ] Compare GA values to AAFCO thresholds by life stage
  - [ ] Life stage modifiers (puppy/kitten, senior, large breed puppy)
  - [ ] Bonus nutrient scoring (DHA, Omega-3, taurine, L-carnitine, zinc, probiotics)
- [ ] Layer 1: Formulation Completeness (daily food only, 0 for treats)
  - [ ] AAFCO statement compliance
  - [ ] Preservative quality assessment
  - [ ] Protein naming specificity
- [ ] Category-adaptive weighting: 55/30/15 for daily food, 100/0/0 for treats
- [ ] Layer 2: Species rules
  - [ ] Dog: DCM advisory (−8% for grain-free + 3+ legumes in top 7)
  - [ ] Dog: DCM mitigation (+3% for taurine + L-carnitine supplementation)
  - [ ] Cat: Carb overload (−15% for 3+ high-glycemic carbs in top 5)
  - [ ] Cat: Mandatory taurine check
  - [ ] Cat: UGT1A6 enzyme warnings for specific compounds
- [ ] Layer 3: Personalization
  - [ ] Allergy cross-reference
  - [ ] Life stage matching
  - [ ] Breed-specific modifiers per `BREED_MODIFIERS_DOGS.md` and `BREED_MODIFIERS_CATS.md`
  - [ ] Breed modifier cap: ±10 within nutritional bucket
  - [ ] Register `no_modifier` breeds to prevent false penalties
- [ ] Ingredient splitting detection: `GROUP BY cluster_id HAVING count >= 2`
- [ ] FDA recall check: boolean lookup against recall database
- [ ] Score engine must be deterministic and independently testable per layer

### Result Bottom Sheet UI
- [ ] Score gauge (animated SVG ring) — displays "[X]% match for [Pet Name]" (D-094)
- [ ] Pet name and photo always visible on result screen (legal requirement)
- [ ] Verdict text + color coding
- [ ] Benchmark bar (score vs category average)
- [ ] Stat chips row (named protein, legume count, unnamed species, AAFCO, recall status)
- [ ] Singleton modal for ingredient deep-dives
- [ ] Tappable waterfall breakdown showing score math (D-094):
  - "Ingredient Concerns: −[X] pts" with citation links
  - "[Pet Name]'s Nutritional Fit: ±[X] pts"
  - "[Pet Name]'s Breed & Age Adjustments: ±[X] pts"
- [ ] ⓘ tooltip: "Suitability is an algorithmic estimate for [Pet Name]'s specific profile based on published research. It is not a universal product rating or a substitute for veterinary medical advice."

### Loading Experience
- [ ] 6-step terminal message sequence (see D-037)
- [ ] Minimum 1.2s display time even if data returns faster (perceived thoroughness)

---

## M2: Pet Profiles + Vet Audit (Weeks 8–11)

> Goal: Personalized scanning for multi-pet households. Veterinary validation of critical data.

### Pet Profiles
- [ ] Create/edit/delete pet profiles
- [ ] Species, breed, weight, birth date, activity level, spayed/neutered, indoor/outdoor (cats)
- [ ] Breed selector: alphabetical A→Z, searchable, "Mixed Breed" and "Other" pinned last (D-102)
- [ ] Pet photo from device gallery (Expo ImagePicker → square crop → local storage + Supabase Storage sync). Default species silhouette if skipped. Renders on profile, scan result header (D-094), pet switcher, and vet report PDF header (D-099).
- [ ] Health conditions multi-select (D-097) — species-filtered list
- [ ] Food allergen sub-picker when allergy condition selected (D-097) — with cross-reactivity expansion (D-098)
- [ ] Allergies management (tag-based input)
- [ ] life_stage auto-derivation from age + species + breed size
- [ ] Active pet selector (persists across sessions)
- [ ] Goal weight field (premium-gated)
- [ ] Pet deletion: type name to confirm + 30-day soft-delete grace period

### Portion Calculator
- [ ] RER calculation: `70 × (kg)^0.75`
- [ ] DER multiplier tables (species-specific, see D-060 through D-063)
- [ ] Daily portion display (cups/day or grams/day based on kcal/cup)
- [ ] Goal weight mode: RER at goal weight, not current weight (premium)

### Treat Battery
- [ ] 10% of DER = daily treat budget in kcal
- [ ] Per-treat calculation: budget ÷ kcal_per_treat = safe count
- [ ] Visual battery gauge (% of daily budget consumed)
- [ ] Cat hepatic lipidosis guard: warn if implied weekly loss >1% body weight

### Veterinary Audit (CRITICAL — Moved to M2)
- [ ] Scope: danger-rated ingredients, species-specific physiological claims, scoring methodology
- [ ] Review `BREED_MODIFIERS_DOGS.md` — 20 breed entries, all modifiers pending vet clearance
- [ ] Review `BREED_MODIFIERS_CATS.md` — 18 breed entries, all modifiers pending vet clearance
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

### ScraperAPI Scraping Pipeline
- [ ] Scrape targets: Chewy (primary), Petco, Amazon pet food
- [ ] Capture: product name, UPC/GTIN, ingredients text, GA text, brand, category, images
- [ ] GTIN extraction from JSON-LD `<script>` tags (not DOM — Chewy stores GTINs there)
- [ ] Handle missing GTINs: insert as name-only with `manual_review` flag
- [ ] ScraperAPI ultra_premium proxies for Chewy Akamai bot protection bypass
- [ ] Store raw scraped data in staging table before processing

### LLM Nutritional Refinery
- [ ] Batch processor: identify rows where `ingredients_raw` populated but GA columns null
- [ ] Claude Haiku extraction with strict JSON schema prompt
- [ ] Python validation: range plausibility checks before DB insertion
- [ ] Flag out-of-range values for manual review (never silently corrupt)
- [ ] Set `nutritional_data_source = 'llm_extracted'` on processed records
- [ ] UI disclaimer for LLM-extracted data

### Formula Change Detection
- [ ] Hash ingredients on ingestion → `ingredients_hash`
- [ ] Monthly re-scrape: diff new hash against stored hash
- [ ] Mismatch → score marked "under review" → auto re-score → pantry notification if Δ >15 points
- [ ] `last_verified_at` timestamp updated on each successful verification

### Database Miss Handling (Level 4 Hybrid)
- [ ] Integrate external UPC API (UPCitemdb free tier: 100 lookups/day)
- [ ] UPC miss → external lookup → return product name + brand + category
- [ ] User confirmation step: "Is this [Product Name]?"
- [ ] OCR prompt: photograph ingredient list
- [ ] On-device text extraction + Claude Haiku ingredient parsing
- [ ] Layer 1 instant partial score with 78/22 missing-GA reweight
- [ ] "Partial — nutritional data unavailable" badge on result
- [ ] Auto-save parsed product to Kiba DB (`source = 'community'`, `needs_review = true`)
- [ ] If external UPC also misses → skip confirmation, go straight to OCR prompt
- [ ] Add `needs_review BOOLEAN DEFAULT false` to products table

### Paywall Implementation
- [ ] Install RevenueCat SDK (NOW, not at M0)
- [ ] Configure annual ($24.99/yr) and monthly ($5.99/mo) products in App Store Connect
- [ ] Build paywall screen: lead with annual, monthly as "pay more" option
- [ ] Personalized copy: "About $2/month to protect [pet name] for a full year"
- [ ] Implement 5 trigger moments (see D-052):
  1. 6th scan in a week
  2. Second pet profile
  3. First safe swap tap
  4. Recall alert signup
  5. Search by product name (text lookup without barcode)
- [ ] `src/utils/permissions.ts` — centralized paywall boundary (ONLY location for paywall checks)
- [ ] Free tier: 5 scans/week (rolling), 1 pet profile, barcode scan only, basic score
- [ ] Premium: unlimited scans, multi-pet, search by name, goal weight, treat battery, compare, recall siren, safe swaps

### Legal — Onboarding Clickwrap (D-094)
- [ ] TOS checkbox during account creation / first use (Tier 1 disclaimer)
- [ ] Draft: "Kiba provides algorithmically generated suitability estimates based on public veterinary research and your pet's specific profile. Kiba scores do not constitute absolute product quality or safety ratings, nor are they an assessment of regulatory compliance."
- [ ] Must be active checkbox, not passive scroll-through
- [ ] Blocks app usage until accepted

---

## M4: Product Detail + Education (Weeks 16–19)

> Goal: Full result screen with all UI components from mockups.

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
- [ ] Compare button (side-by-side product comparison)
- [ ] Vet Report (shareable PDF summary for vet visits)
- [ ] Pantry button (add to user's pantry)

---

## M5: Pantry + Recall Siren (Weeks 20–23)

> Goal: The killer retention feature. "Smoke alarm for recalled pet food."

### Pantry
- [ ] Add scanned products to pantry
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

### Pet Appointments (D-103)
- [ ] Schedule vet, grooming, medication, vaccination, and custom appointments
- [ ] Per-pet or multi-pet assignment
- [ ] Optional reminders (1hr / 1 day / 3 days / 1 week before)
- [ ] Recurring appointments (monthly, quarterly, 6-month, yearly) for flea meds, checkups
- [ ] Upcoming appointments visible on pet profile and home screen
- [ ] Past appointments archived for future vet report integration

### Recall Siren (Premium)
- [ ] FDA recall RSS feed monitoring (automated, not manual checking)
- [ ] Cross-reference recalled products against user pantry
- [ ] Push notification to affected users
- [ ] Product score → 0 with recall banner on scan result
- [ ] Recall detail screen with FDA link and recommended actions
- [ ] Historical recall log per product

---

## M6: Alternatives Engine (Weeks 24–27)

> Goal: "This scored 44. Here are three options scoring 80+."

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
- [ ] Submit missing products (photo → OCR → review)
- [ ] Two-step OCR pipeline: on-device text extraction + Claude parsing
- [ ] Moderation queue for submitted products
- [ ] XP engine: points for scanning, contributing, streaks
- [ ] Cosmetic rewards (profile borders, badges) — positioned as contributor thank-you, not primary hook
- [ ] Top contributor leaderboard
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
- [ ] Pure Balance Grain-Free Salmon → 66/100 (regression test)
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
