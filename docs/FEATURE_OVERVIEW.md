# Kiba Feature Overview

> What the app does by M11 (launch-ready) and what comes after.
> Source of truth: ROADMAP.md + DECISIONS.md (129 decisions, D-001 through D-167).

---

## Core Product

**Kiba** is a pet food scanner for dogs and cats. Scan a barcode, get an ingredient-level safety score 0-100 tailored to your specific pet. The score adapts to species, breed, age, weight, health conditions, and allergens. Framed as suitability ("82% match for Luna"), never as a grade.

---

## By M11 (Launch-Ready)

### Scan-to-Score Pipeline
- Barcode scan via camera with haptic feedback and scan animation
- 3-layer scoring engine: Ingredient Quality (IQ), Nutritional Profile (NP), Formulation Context (FC)
- Category-adaptive weights: daily food (55/30/15), supplemental (65/35/0), treats (100% IQ)
- Score ring with dual color systems (green family for daily food, teal/cyan for supplemental)
- 19,058+ products from Chewy, Amazon, and Walmart
- Database miss flow: product not found triggers Haiku classification + community contribution save

### Score Presentation
- Progressive disclosure: score, concern tags, and severity badges above the fold; waterfall breakdown, full ingredient list, and nutrition data below
- Concern tags: Artificial Color, Added Sugar, Unnamed Source, Synthetic Additive, Heart Risk
- Ingredient detail modals with consumer-friendly descriptions, citations, and position context
- Score waterfall grouped by severity with progress bars
- Composition bar with swipeable scrub interaction
- Carbohydrate estimation display with confidence badges (Exact / Estimated / Unknown)
- Benchmark bar comparing score against 8 category segments (species x category x grain-free)
- Suitability framing on every screen ("82% match for Luna") -- never a naked score
- UPVM-compliant copy throughout (no "prescribe," "treat," "cure," "prevent," "diagnose")

### Pet Profiles
- Multi-pet support with Instagram Stories-style carousel switching
- Species (dog/cat), breed (23 dogs, 21 cats with breed-specific modifiers), weight, DOB
- Approximate age mode for rescue pets with unknown birth dates
- Activity level with species-specific labels (dogs: Low/Moderate/High/Working; cats: Indoor/Indoor-Outdoor/Outdoor)
- Sex field (optional, for vet report + pronoun personalization)
- Stale weight indicator (prompts update after 90 days)
- Photo upload to Supabase storage
- Free tier: 1 pet. Premium: unlimited.

### Health Conditions & Allergens
- 12 health conditions with Layer 3 scoring adjustments: joint, allergy, GI sensitive, obesity, underweight, diabetes, CKD, urinary, cardiac, pancreatitis, skin, hypothyroid/hyperthyroid
- "Perfectly Healthy" chip that deselects all conditions
- Mutual exclusions and sub-types in condition picker
- Allergen profile with cross-reactivity expansion (marking "Chicken" also flags chicken fat, chicken meal, chicken by-product)
- Allergen score cap: hard ceiling at 50 for allergen-triggered products
- Per-condition scoring rules with species-aware splits (e.g., diabetes in dogs vs cats uses different nutrient targets)
- Cardiac + DCM pulse detection zeroes out score for dogs with heart disease eating pulse-heavy food
- Breed contraindication warnings (Dalmatian + purines, Irish Setter + gluten, Border Terrier + gluten)

### Portion Calculator & Weight Management
- RER/DER-based daily calorie calculation adapted to species, life stage, activity, neutered status
- PortionCard showing daily calories and cups/day with cups-to-grams toggle
- Weight goal slider: 7-position discrete slider (-3 to +3), premium-gated, auto-resets on condition conflict
- Cat hepatic lipidosis safety guard (blocks aggressive calorie restriction)
- Geriatric cat calorie floor (prevents under-feeding elderly cats)
- Caloric accumulator: estimates weight change from feeding data, pushes for confirmation when threshold crossed
- BCS reference tool: 9-point educational body condition guide with species tabs and primordial pouch callout for cats
- Condition-aware feeding frequency: auto-populates recommended meals/day based on health conditions (pancreatitis, GI sensitive, CKD, diabetes, obesity, underweight, liver)

### Pantry
- Add products to pantry from scan results with budget-aware auto-serving recommendations
- Per-pet serving configuration with daily/as-needed frequency
- Auto-depletion countdown (cron job, daily-total deduction, timezone-agnostic)
- Low stock and empty push notifications
- Multi-pet pantry sharing (same-species only)
- Mixed feeding nudge (contextual, not auto-rebalancing)
- Diet completeness banner, 7 filter chips, 4 sort modes
- Recalled products pushed to top with red badge and disabled feeding controls
- Offline-safe: reads return empty gracefully, writes throw clear errors

### Product Bypasses
- Vet/prescription diets: not scored, vet diet badge + ingredient list only
- Species mismatch: not scored, bypass badge shown
- Variety packs: detected and bypassed (can't score concatenated ingredient lists)
- Recalled products: not scored, bypass badge + FDA link + allergen warnings

### Safe Swap Recommendations
- "This scored low -- here are three higher-scoring options"
- Condition-aware filtering (respects allergens, health conditions)
- Curated layout for daily dry food: Top Pick / Fish-Based (or Another Pick if fish allergy) / Great Value
- Multi-pet group mode: intersects candidate pools, uses floor score, unions allergens
- Curated and generic fallback modes

### Compare Flow
- Side-by-side product comparison with 9-rule key differences engine
- Score breakdown, nutrition table, ingredients comparison
- Product picker with search, recent scans, and camera
- Premium-gated

### Vet Report PDF
- 4-page diet-centric report via expo-print (intentionally excludes Kiba scores)
- Pet profile with BCS gauge, caloric summary
- Combined nutrition with AAFCO checks, supplemental nutrients, flags
- Weight tracking history, per-product detail
- Condition management notes, owner dietary cards (28 cards with conflict detection)
- Premium-gated

### Appointments & Health Records
- Schedule vet, grooming, medication, vaccination, and custom appointments
- Multi-pet assignment, optional reminders (1hr / 1 day / 3 days / 1 week)
- Recurring appointments (monthly, quarterly, 6-month, yearly)
- Appointment completion auto-populates health records
- Free tier: 2 active appointments. Premium: unlimited.

### Push Notifications
- Feeding schedule reminders (grouped for multi-pet same-time feedings)
- Low stock and empty pantry alerts
- Recalled product alerts (free for all users)
- Appointment reminders
- Weight estimate notifications
- Weekly/daily digest (scan activity, pantry state, recall alerts)
- Per-category toggles + global kill switch

### HomeScreen
- Recall siren banner for active recalled pantry items
- Upcoming appointment card
- Recent scan history
- Top Matches recommendations (batch-scored, cache-invalidated on profile changes)

### Community Tab
- Premium text search for products
- Community contribution pipeline (database miss flow)

### Paywall (RevenueCat)
- $24.99/year annual, $5.99/month monthly
- 5 free scans/week (rolling 7-day window)
- All gates in a single permissions.ts file
- Free forever: scanning (up to limit), basic score, 1 pet, recall alerts, BCS reference

### 7-Day Safe Switch Guide (M7)
- Day-by-day food transition plan (old food % to new food %)
- Tummy Check prompts during transition
- Species-specific transition speeds (cats need slower transitions)
- Completion celebration + review prompt

### Kiba Index (M8)
- Taste Test voting: Loved it / Picky / Refused
- Tummy Check voting: Perfect / Soft stool / Upset
- Aggregate display on product results
- One vote per pet per product

### Symptom Detective (M9)
- Daily symptom logging across 5 categories
- Pattern detection algorithm (flags correlations after 2-4 weeks)
- "Possible sensitivity to [ingredient]" advisory
- Calendar heatmap visualization

### Community Contributions (M10)
- Submit missing products (photo capture, OCR, review pipeline)
- Moderation queue for submitted products
- XP engine: points for scanning, contributing, correcting, streaks
- Cosmetic rewards (profile borders, badges) -- contributor thank-you, not gamification
- Top contributor leaderboard
- Community safety flags for suspect scores

### Launch Prep (M11)
- App Store optimization (screenshots, description, keywords)
- Subreddit (r/kibascan) seeded with content
- Press outreach template for recall events
- Trademark filing
- Full QA: regression anchors, RLS verification, UPVM compliance audit, performance targets (scan-to-score under 2s)

---

## Post-Launch (M12+)

### Public Launch (M12)
- iOS App Store submission
- Review prompt logic: after 3+ scans and a positive moment (high score or Safe Switch completion), never on first session
- Target: 4.7+ rating

### Retention & Growth (M13)
- Scan streak incentives
- "New score available" push when formula changes detected
- iOS Home Screen widgets:
  - Small: next feeding time + pet photo
  - Medium: pantry low-stock + feeding + treat battery
  - Large: weekly summary + feeding schedule + recall badge

### Android (M14)
- Full port via Expo EAS
- Play Store ASO
- Paywall conversion testing vs iOS

### International (M15)
- UK/Canada/Australia keyword localization
- Currency localization for affiliate links
- Regional standards (FEDIAF for EU as AAFCO equivalent)

### Elimination Diet Trial Tracker (M16+)
- 8-12 week guided elimination diet with daily engagement
- Trial state machine: Setup, Active, Paused, Complete, Reintroduction, Closed
- 4-step setup wizard (pet, novel protein/carb, vet info, settings)
- Active trial scanning with whitelist/blocked list + cross-reactivity awareness
- Contamination detection with alert cards
- Upgraded symptom logging: 6-dimension 0-4 scale (expanded from M9's 5-category system)
- Daily push notification at configured check-in time
- Nightly pattern detection: lag correlation, baseline drift, improvement signal, stale trial alert
- Reintroduction phase: single protein, 14-day observation, Reaction/Tolerated/Inconclusive outcomes
- Trial completion vet report (Type B) with symptom timeline, contamination log, pattern insights
- Premium hard gate

### Apple Watch Companion (M16+)
- Watch complications: trial day counter, next feeding, quick symptom log
- 2-tap symptom logging from watch face
- Elimination diet daily check-in on wrist
- Feeding schedule reminders

### Cosmetics & Grooming (M16+)
- Shampoos, flea treatments, paw balms, dental products
- New scoring framework (ingredients-only, no guaranteed analysis equivalent)

### Supplements (M16+)
- Joint supplements, probiotics, calming aids
- Interaction checking with current food ingredients

### Smart Pet Device Integration (M16+)
- **Smart feeders** (PetSafe, Petlibro, SureFeed, Sure Petcare, PETKIT): pull actual portions dispensed, exact feeding times, and per-pet identification (RFID/microchip) for precise calorie tracking -- replaces manual pantry depletion with real data
- **Activity & health trackers** (Whistle, FitBark, Fi): sync activity level (steps, active minutes, calories burned), weight from smart scale readings, sleep patterns, and location data -- feeds directly into DER calculation for dynamic activity-level adjustment instead of static Low/Moderate/High/Working selection
- **Smart scales** (Whistle Health, standalone pet scales): automatic weight updates replace manual entry, eliminate stale weight problem (D-117), and give the caloric accumulator (D-161) ground-truth data to validate its estimates against
- **Integration approach**: OAuth device linking per pet profile, background sync via device cloud APIs, unified activity feed on PetHubScreen showing feeder events + activity + weight readings in one timeline
- **Calorie tracking upgrade**: smart feeder data replaces the pantry auto-depletion estimate with actual dispensed amounts -- the caloric accumulator becomes near-exact instead of estimated, making weight predictions and feeding advisories significantly more accurate
- **Elimination diet enhancement**: smart feeder logs provide tamper-proof feeding records during elimination trials -- if someone else in the household feeds the wrong food, Kiba detects the contamination event automatically from the feeder data
- Premium-gated (device linking requires subscription)

### Vet Partnership / B2B (M16+)
- "Vet Verified" badge: users get scans confirmed by their vet
- Vet dashboard for recommending products to patients
- B2B revenue stream

---

## Affiliate Integration (M6, in progress)
- Chewy affiliate links with estimated price display
- Amazon Associates with "Check Current Price" (TOS compliant)
- FTC disclosure auto-rendered below buy buttons
- Buy buttons hidden for products scoring below 50
- Affiliate data stored in products table but invisible to scoring engine (brand-blind rule)
