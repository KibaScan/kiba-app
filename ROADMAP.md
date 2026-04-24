# Kiba — Product Roadmap

> Master timeline from foundation to scale.
> Updated: April 23, 2026
> Reference: DECISIONS.md for rationale behind each item.

---

## Current Status: M9 In Progress — Community tab shipped (M0–M8 Done)

**M9 Community tab shipped (April 23, 2026 — branch `m9-community`):**
- Server-side XP engine — points for camera scans (anti-abuse: prior `scan_history` row required), Kiba Index votes, recipe approvals, missing-product approvals; calendar-day streak with 1-day grace; `get_user_xp_summary` RPC
- Kiba Kitchen — community-recipe submission + feed + detail; auto-validators (toxic JSON + UPVM regex via `validate-recipe` Edge Function); `is_killed` kill-switch; client-supplied UUID storage path; pending → approved/auto_rejected/rejected status flow
- Vendor Directory — Studio-CMS `vendors` table + bundled `assets/vendors.json` for offline reads; A-Z search + inline expand + mailto/website actions
- ResultScreen overflow → "Contact {brand}" deep-link (offline-safe)
- Toxic Database — 35 curated entries, species toggle + search + category filter; single source of truth shared with `validate-recipe`
- Blog — Studio CMS + `react-native-marked` rendering; carousel on Community + dedicated list/detail screens
- Recall Live Feed banner on CommunityScreen
- D-072 community safety flags — `SafetyFlagSheet` + tabbed `SafetyFlagsScreen` (My Flags + Community Activity); ResultScreen overflow entry
- 9 migrations (041–049) + 2 storage buckets (recipe-images, blog-images) — all written, NOT yet applied to staging (Docker was unavailable during dev). Apply via `npx supabase db push`. See `docs/qa/2026-04-23-m9-community-qa.md` for the full migration apply checklist.
- D-170 — Kitchen recipe-flag entry deferred to a future `recipe_flags` table (`score_flags.pet_id NOT NULL` + `product_id NOT NULL` constraints intentionally preserved)

**Completed (pre-M9 Community):**
- Brand finalized (Kiba / kibascan.com)
- Scoring architecture validated (55/30/15 daily food, 65/35/0 supplemental, 100% treats)
- 2 interactive HTML prototypes (Cat Treat V3.1, Dog Food V3)
- Decision log established (132 decisions, D-001 through D-170, non-sequential)
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
- M4.5 (complete): D-137 DCM Pulse Framework — replaced grain-free gate with positional pulse load detection, narrowed scope from all legumes to pulses only, updated Pure Balance regression 65 → 62. DcmAdvisoryCard shows rule-specific copy, Heart Risk concern tag fires on D-137 rules. 509 tests passing.
- M4.5: Migration 008 — backfill dropped dataset fields (feeding_guidelines, is_vet_diet, special_diet, image_url, source_url). 9,078 products updated, 0 errors. See `docs/references/dataset-field-mapping.md`.
- M4.5: D-135 vet diet bypass — pipeline skips scoring engine for `is_vet_diet = true` products, ResultScreen renders vet diet badge + ingredient list only (no score ring, no waterfall, no benchmark).
- UI Polish Sessions A–C (D-138–D-141): Score waterfall redesign (grouped ingredients, severity progress bars, tooltips, final score color fix), global severity color constants (SEVERITY_COLORS single source of truth), AAFCO statement copy standardization, ingredient list grouped by severity tier, nutritional fit consolidation (removed duplicate GATable section), bonus nutrient present-first layout, composition bar tap-to-identify, carb estimate "Est." format, modal citation demotion. 509 tests passing.
- UI Polish Session D (D-142–D-149): Artificial colorant severity escalation (caution → danger), "Danger" → "Severe" display labels, preservative_type_unknown chip suppressed, ScoreRing fill animation (900ms ease-out cubic), species mismatch bypass (D-144), variety pack detection + bypass (D-145), expanded supplemental classifier with product name keywords (D-146), BenchmarkBar ≥30 peer threshold, PortionCard supplemental guidance text, presentation layer polish (D-147: supplemental-aware AAFCO headers, treat GA bar suppression, ultra-high-moisture DMB note, benchmark delta labels, AAFCO chip consistency, product name wrapping, portion name truncation, orphan text suppression, PositionMap ordinal fix), composition bar swipeable scrub (D-148), Atwater caloric estimation fallback for missing kcal data (D-149). 558 tests passing.
- D-150 through D-162: Life stage mismatch moved to Layer 3 (D-150), under-4-weeks nursing advisory (D-151), M5 pantry decisions locked (D-152–D-158), low-score feeding context line (D-159). D-160: weight goal slider replaces raw goal weight (D-061 superseded) — 7 levels (-3 to +3), cat cap at -2, percentage-based DER adjustment. D-161: caloric accumulator for estimated weight tracking via auto-deplete cron — species-specific thresholds (dogs 3,150 kcal/lb, cats 3,000 kcal/lb), notify-and-confirm. D-162: BCS reference tool — educational body condition chart, not diagnostic. 641 tests passing across 32 suites.
- M5 Pantry backend: Migration 011 (pantry_items + pantry_pet_assignments tables with RLS), `src/types/pantry.ts` (all union types, DB interfaces, composite types, PantryOfflineError), `src/services/pantryService.ts` (9 CRUD functions with offline guards via `@react-native-community/netinfo`), `src/utils/pantryHelpers.ts` (6 pure functions: depletion math, calorie context, system recommendations, serving mode defaults), `src/utils/network.ts` (isOnline helper). 677 tests passing across 34 suites.
- M5 Pantry UI: `src/components/pantry/AddToPantrySheet.tsx` (bottom sheet for adding products to pantry), `src/components/pantry/PantryCard.tsx` (pantry list item card — product image with gradient fade, score badge with bypass states, depletion bar, low stock/recalled alerts, shared indicator, calorie context, treat-aware display, empty state with restock/remove actions). `src/screens/PantryScreen.tsx` (full pantry tab screen — pet carousel with multi-pet switching, diet completeness banner, 7 filter chips with color conventions, 4 sort modes, FlatList of PantryCards with pull-to-refresh, two empty states, shared remove modal, D-157 mixed feeding nudge, restock flow). `src/components/pantry/SharePantrySheet.tsx` (share pantry item with same-species pets — D-154 species filter, no premium gate, per-pet score badge, inline serving/feedings editor, toggle on/off). `src/screens/EditPantryItemScreen.tsx` (full-screen pantry item edit — quantity/feeding/schedule cards, auto-save, D-155 empty states with opacity overlays, D-158 recalled states with disabled feeding/schedule, depletion summary, restock/share/remove actions, time picker for feeding notifications, shared remove modal). PantryCard tap now navigates to EditPantryItem. 746 tests passing across 37 suites.
- M5 Top Matches backend: Migration 012 (`pet_product_scores` cache table with UNIQUE pet+product, category CHECK, invalidation anchors, composite index on pet_id/category/final_score DESC, RLS via pets.user_id join). `src/services/topMatches.ts` (checkCacheFreshness with 5 staleness checks: empty cache, life stage drift, profile edit, health update, engine version; fetchTopMatches with product join + client-side search; triggerBatchScore Edge Function caller). `CURRENT_SCORING_VERSION` constant. `supabase/functions/batch-score/index.ts` (Deno Edge Function: auth + rate limit + bulk product/ingredient queries + scoring loop + chunked upsert into pet_product_scores; verified engine copy in `scoring/` subfolder, Pure Balance = 62). 752 tests passing across 38 suites.
- M5 Push infra: Migration 013 (`push_tokens` table — per-device Expo push tokens with UNIQUE user_id+device_id, RLS), Migration 014 (`user_settings` table — per-user notification prefs with global kill switch + per-category toggles, RLS). `src/services/pushService.ts` (registerPushToken upserts both tables, getNotificationPreferences reads user_settings). `src/utils/notifications.ts` (registerForPushNotificationsAsync, setupNotificationHandlers with tap routing by NotificationType). 761 tests passing across 38 suites.
- M5 Feeding notification scheduler: `src/services/feedingNotificationScheduler.ts` (client-side local notifications via expo-notifications — full-resync approach: rescheduleAllFeeding() cancels all + rebuilds; multi-pet grouping same-time feedings into single notification; meal labels from time of day; unicode fraction serving display; D-084/D-095 compliant copy). Integrated into usePantryStore (add/remove/share), EditPantryItemScreen (frequency/toggle/time changes), App.tsx (launch resync). 771 tests passing across 39 suites.
- M5 Auto-deplete cron: `supabase/functions/auto-deplete/index.ts` (Deno Edge Function — service role auth, daily-total deduction across all users, unit conversion cups->kg->quantity_unit with calorie-based or 0.1134 fallback, idempotency via last_deducted_at guard, state transition detection for low stock/empty, push notifications via Expo Push API with dead token cleanup). Migration 015 (pg_cron + pg_net schedule, vault secrets for auth). 771 tests passing across 39 suites.
- M5 Pet Appointments backend (D-103): Migration 017 (`pet_appointments` table — UUID[] pet_ids, 5 appointment types, reminder/recurring options, partial index on upcoming, GIN index on pet_ids, RLS). `src/types/appointment.ts` (Appointment, CreateAppointmentInput, UpdateAppointmentInput types). `src/services/appointmentService.ts` (6 CRUD functions with offline guards — create, update, hard delete, complete with auto-recurring spawn, getUpcoming/getPast with optional pet filter via array containment). `canCreateAppointment()` in permissions.ts (free tier: 2 active max, premium: unlimited). `freeAppointmentsMax` in constants.ts. 822 tests passing across 41 suites.
- M5 Pet Appointments UI + reminders (D-103): `src/screens/AppointmentsListScreen.tsx` (upcoming/past segmented control, type icons, relative date formatting, pet name resolution, paywall gate on "+"). `src/screens/CreateAppointmentScreen.tsx` (form — 5 type chips, DateTimePicker via `@react-native-community/datetimepicker`, pet multi-select with active pet default, location/notes, reminder/recurring chip pickers, "Schedule" button). `src/screens/AppointmentDetailScreen.tsx` (edit all fields, "Save Changes" on dirty, "Mark Complete" with recurring auto-spawn, "Delete" with BlurView confirmation modal, completed badge for past). `src/services/appointmentNotificationScheduler.ts` (local one-shot reminders via expo-notifications DATE trigger — full resync approach matching feedingNotificationScheduler pattern; D-084/D-095 compliant copy; multi-pet name formatting; preference check via user_settings). Integrated into App.tsx (launch resync), create/edit/delete/complete flows. PetHubScreen "Appointments" settings row added. Navigation: 3 screens on MeStack, `appointment_limit` PaywallTrigger. 834 tests passing across 42 suites.
- M5 Weekly/daily digest (D-130): `supabase/functions/weekly-digest/index.ts` (Deno Edge Function — single function handles both weekly and daily modes via POST body `{mode}`. Service role auth, batch queries all eligible users from user_settings + push_tokens. Gathers scan activity, pantry state, recalled items, upcoming appointments. Adaptive content: active users get scan counts, inactive get pantry summary, cold start gets CTA. Recall alerts always prioritized first. Multi-pet: first pet + "and N other pets". Under 200 chars, D-084/D-095 compliant. Tap routes to HomeScreen. Skips accounts < 3 days old. Dead token cleanup via Expo Push API). Migration 018 (two pg_cron schedules: weekly Sunday 9 AM UTC, daily 9 AM UTC).
- M5 Treat battery wiring: `src/stores/useTreatBatteryStore.ts` (Zustand + AsyncStorage persist — per-pet daily kcal/count tracking, midnight auto-reset, `resolveTreatKcal()` fallback chain: kcal_per_unit → derive from ga_kcal_per_kg × unit_weight_g → null). `usePantryStore.logTreat()` (optimistic deduct 1 unit + resolve kcal + update battery, server revert on error). PantryCard "Gave a treat" button for treat items. PetHubScreen + ResultScreen wired to real consumed data. 20 new tests. 862 tests passing across 43 suites.
- M5 Pet health records (D-163): `src/services/appointmentService.ts` extended with `getHealthRecords()` and `logHealthRecord()`. `src/types/appointment.ts` extended with `PetHealthRecord` type. PetHubScreen health records section with recent records list, HealthRecordLogSheet bottom sheet for manual entry.
- M5 Notification preferences: `src/screens/NotificationPreferencesScreen.tsx` (global kill switch + per-category toggles for feeding/low_stock/empty/recall/appointment + digest frequency selector Weekly/Daily/Off). Reads/writes user_settings table. On feeding toggle: rescheduleAllFeeding(). On appointment toggle: rescheduleAllAppointments(). On global disable: cancel all local notifications. Recall disable requires confirmation dialog with pet name. PetHubScreen settings row "Notifications" navigates to screen. 862 tests passing across 43 suites.
- M5 HomeScreen updates: Recall siren banner (active recalled pantry items with navigation to RecallDetailScreen), upcoming appointment card (next appointment with relative date + navigate to detail), recent scan history section.
- M5 bugfix D-164: Unit label simplification — collapsed cans/pouches/units to single 'servings' value. Migration 019, removed unit picker from AddToPantrySheet and EditPantryItemScreen.
- M5 bugfix D-165: Calorie-budget-aware serving recommendations — AddToPantrySheet rewritten with Auto/Manual toggle (auto default). Auto mode computes remaining calorie budget from existing pantry items and divides by feedings per day. Smart default feedings (1 if pet already has daily food, 2 otherwise). Product size pre-fill from name regex. Decimal-pad keyboard fix. Budget warnings (>120% amber banner, >100% inline, <80% muted). New pure helpers: `computePetDer()`, `computeExistingPantryKcal()`, `computeAutoServingSize()`, `computeBudgetWarning()`, `getSmartDefaultFeedingsPerDay()`, `parseProductSize()`. 895 tests passing across 43 suites.
- M5 bugfix: Applied migrations 011-019 to production database (tables + cron jobs were never pushed). Combined SQL script for pantry, scores, push tokens, settings, recalls, appointments, health records.
- M5 bugfix: EditPantryItemScreen crash on delete — early return guard was between hooks (React rules violation). Moved guard after all hooks, added null safety to hook bodies.
- M5 bugfix: "Log a Treat" navigation from PetHub opened stale Result screen instead of camera. Fixed by navigating to `Scan` → `ScanMain` to reset the stack.
- M5 bugfix: AddToPantrySheet error messages — surface actual Supabase error instead of generic "Failed to add to pantry" string.

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
├── default_serving_format TEXT       ← 'weight' | 'unit' (derived from product_form per D-152)
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
├── is_vet_diet BOOLEAN DEFAULT false      ← Migration 008: veterinary/prescription diet flag (~125 products)
├── special_diet TEXT                      ← Migration 008: diet tags (high-protein, limited-ingredient, etc.)
├── image_url TEXT                         ← Migration 008: Chewy product image URL
├── feeding_guidelines TEXT                ← Migration 008: full feeding guide text (D-136 supplemental detection)
├── source_url TEXT                        ← Migration 008: Chewy product page URL (debugging + rescrapes)
├── product_form TEXT                     ← Migration 010: 'dry' | 'wet' | 'raw' | 'freeze-dried' | 'dehydrated' | etc.
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
├── is_pulse BOOLEAN DEFAULT false         ← D-137: peas, lentils, chickpeas, fava/beans (NOT potatoes, soy)
├── is_pulse_protein BOOLEAN DEFAULT false  ← D-137: pulse protein isolates/concentrates only (subset of is_pulse)
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
├── weight_goal_lbs DECIMAL(5,1)         ← DEPRECATED by D-160 → weight_goal_level SMALLINT (-3 to +3, default 0)
├── weight_goal_level SMALLINT DEFAULT 0 ← D-160: replaces weight_goal_lbs. CHECK (-3 to +3). Cat cap at -2.
├── weight_updated_at TIMESTAMPTZ        ← D-117: stale weight guard (amber prompt >6 months)
├── date_of_birth DATE                   ← renamed from birth_date per PET_PROFILE_SPEC
├── dob_is_approximate BOOLEAN DEFAULT false  ← D-116: rescue pet approximate age mode
├── life_stage TEXT                       ← derived, never user-entered (D-064)
├── breed_size TEXT                       ← derived from breed lookup ('small'|'medium'|'large'|'giant')
├── activity_level TEXT DEFAULT 'moderate' ('low' | 'moderate' | 'high' | 'working')
├── is_neutered BOOLEAN                  ← renamed from is_spayed_neutered per PET_PROFILE_SPEC
├── sex TEXT CHECK ('male' | 'female')   ← D-118: optional, null valid. For vet report + pronouns.
├── photo_url TEXT                        ← Supabase storage path
├── health_reviewed_at TIMESTAMPTZ       ← Migration 003: null = never visited health screen. Used for Top Matches cache invalidation.
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

pantry_items                            ← Migration 011: D-152/D-154/D-155 user-set serving model
├── id UUID PK
├── user_id UUID FK → auth.users(id) ON DELETE CASCADE
├── product_id UUID FK → products(id) ON DELETE CASCADE
├── quantity_original DECIMAL(10,2) NOT NULL  ← bag weight or unit count at time of adding
├── quantity_remaining DECIMAL(10,2) NOT NULL ← decremented by auto-depletion, floors at 0 (D-155)
├── quantity_unit TEXT NOT NULL ('lbs' | 'oz' | 'kg' | 'g' | 'units')
├── serving_mode TEXT NOT NULL ('weight' | 'unit')  ← D-152: weight-based (dry/raw) or unit-based (cans/pouches)
├── unit_label TEXT DEFAULT 'units' ('cans' | 'pouches' | 'units')  ← display label for unit mode
├── added_at TIMESTAMPTZ DEFAULT NOW()
├── is_active BOOLEAN DEFAULT true     ← false = soft-deleted from pantry (D-155)
├── last_deducted_at TIMESTAMPTZ       ← tracks last auto-depletion
├── created_at TIMESTAMPTZ DEFAULT NOW()
├── updated_at TIMESTAMPTZ DEFAULT NOW()
├── INDEX (user_id, is_active) WHERE is_active = true
├── RLS: auth.uid() = user_id

pantry_pet_assignments                  ← Migration 011: D-154 per-pet serving config
├── id UUID PK
├── pantry_item_id UUID FK → pantry_items(id) ON DELETE CASCADE
├── pet_id UUID FK → pets(id) ON DELETE CASCADE
├── serving_size DECIMAL(8,4) NOT NULL ← user-set: cups/scoops (weight) or fractional units (D-152)
├── serving_size_unit TEXT NOT NULL ('cups' | 'scoops' | 'units')
├── feedings_per_day SMALLINT NOT NULL DEFAULT 2
├── feeding_frequency TEXT NOT NULL DEFAULT 'daily' ('daily' | 'as_needed')
├── feeding_times JSONB                ← D-101: clock times for feeding notifications
├── notifications_on BOOLEAN DEFAULT true
├── created_at TIMESTAMPTZ DEFAULT NOW()
├── updated_at TIMESTAMPTZ DEFAULT NOW()
├── UNIQUE(pantry_item_id, pet_id)
├── RLS: pantry_item_id IN (SELECT id FROM pantry_items WHERE user_id = auth.uid())

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
  - [x] Dog: DCM advisory (−8% via D-137 positional pulse load — supersedes D-013 grain-free gate)
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
- [x] 6-step terminal message sequence (D-037)
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
- [ ] Weight goal slider (D-160, premium-gated) — 7-level slider replacing raw goal weight (D-061 superseded). Cat cap at -2. Moved to M6.
- [x] Stale weight indicator (D-117) — amber prompt on Hub if weight >6 months old
- [x] Sex field (D-118) — segmented control `[Male] [Female]`, optional, for vet report + pronouns
- [x] Pet deletion: type name to confirm + 30-day soft-delete grace period
- [ ] Haptic feedback (D-121) — `utils/haptics.ts` utility with named functions, wired to all interactive elements (code exists, untested on iOS)

### Portion Calculator
- [x] RER calculation: `70 × (kg)^0.75`
- [x] DER multiplier tables (species-specific, see D-060 through D-063)
- [x] Daily portion display (cups/day or grams/day based on kcal/cup)
- [ ] Weight goal level mode (D-160): adjusted DER = baseDER x multiplier from weight_goal_level. Premium only (D-153). Moved to M6.

### Treat Battery
- [x] 10% of DER = daily treat budget in kcal
- [x] Per-treat calculation: budget ÷ kcal_per_treat = safe count
- [x] Visual battery gauge (% of daily budget consumed)
- [ ] Cat hepatic lipidosis guard: architecturally replaced by D-160 cat cap at -2 (slider doesn't render -3 for cats). D-062 runtime check no longer needed.

### Veterinary Audit (CRITICAL — Pending vet partner, not blocking M2 feature completion)
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
- [x] Benchmark bar — gradient track with product pin + category average marker
- [ ] "What Good Looks Like" reference card (deferred — post-M4)

### Nutrition Panel
- [x] AAFCO progress bars with threshold markers (D-141: improved marker visibility, min/max labels)
- [x] DMB conversion display for wet food
- [x] Bonus nutrient grid (D-141: present-first layout, absent-as-line)
- [x] "[Pet Name]'s Nutritional Fit" label (D-094 — internal weight not exposed to users)
- [x] Carb estimate display with "Est." format and InfoTooltip (D-141)
- [x] Expandable raw GA view ("View guaranteed analysis") replacing duplicate Nutritional Profile section (D-141)

### Ingredient Experience
- [x] Worst-to-best sorted list with section dividers (D-141: grouped by severity tier with counts)
- [x] Position map (colored bar strip) with tap-to-identify interaction (D-141)
- [x] Ingredient splitting detection card
- [x] Flavor deception card (when applicable)
- [x] DCM advisory card with mitigation callout
- [x] Singleton modal with TL;DR, clinical copy, citations (D-141: muted citations)

### Education
- [x] Score waterfall breakdown — tappable, grouped ingredients with sub-reasons (D-138)
- [x] Loading terminal with step-by-step messages

### Actions
- [x] Pantry button (add to user's pantry)
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

## M4.5: DCM Pulse Framework — D-137 (Post-M4 Patch)

> Goal: Replace marketing-label proxy (grain-free gate) with biochemistry-based positional pulse load detection for DCM risk scoring.

### Schema
- [x] Migration 009: `is_pulse BOOLEAN DEFAULT FALSE` on `ingredients_dict`
- [x] Migration 009: `is_pulse_protein BOOLEAN DEFAULT FALSE` on `ingredients_dict`
- [x] Backfill script: `scripts/data/backfill_pulse_flags.ts` — set `is_pulse = true` on pea/lentil/chickpea/fava/bean clusters and all derivatives
- [x] Backfill script: set `is_pulse_protein = true` on pulse protein isolates/concentrates only

### Scoring Engine
- [x] `speciesRules.ts`: Replace D-013 DCM trigger with D-137 three-rule OR (heavyweight / density / substitution)
- [x] Remove `is_grain_free` dependency from DCM evaluation path
- [x] DCM penalty unchanged: −8% (×0.92), mitigation +3% (×1.03) when taurine + L-carnitine supplemented
- [x] `evaluateDcmRisk()` exported — returns `DcmResult` with triggered rules, pulse ingredients, mitigation status

### UI Updates
- [x] `DcmAdvisoryCard.tsx`: Updated copy showing which rule(s) fired + mechanism-cited explanations
- [x] `ConcernTags.tsx`: Heart Risk membership updated — pulses only, potatoes removed, fires on D-137 rules

### Testing
- [x] Update regression tests: Pure Balance = 62 (was 65) — updated in engine.test.ts, realDataTrace.test.ts, allergenOverride.test.ts
- [x] New tests: 11 D-137 tests in speciesRules.test.ts (3 rules + exclusions + mitigation + grain-free gate removal + Pure Balance)
- [x] Verify potatoes, soy, tapioca do NOT trigger DCM (explicit test cases)
- [x] Verify grain-inclusive products with pulse load correctly trigger DCM (explicit test case)
- [x] Added `is_pulse`/`is_pulse_protein` defaults to all 10 test file `makeIngredient` helpers
- [x] 509 tests passing (was 501)

### Documentation
- [x] D-137 appended to DECISIONS.md
- [x] CLAUDE.md updated: DCM description, regression target, concern tags, schema, self-check
- [x] ROADMAP.md updated: M4.5 section added

### D-135: Vet Diet Bypass
- [x] `is_vet_diet BOOLEAN` on products table (Migration 008, backfilled from dataset — 125 products)
- [x] `is_vet_diet` added to Product type (`src/types/index.ts`)
- [x] Pipeline bypass: `pipeline.ts` skips `computeScore()` when `is_vet_diet = true`, returns `vet_diet_bypass` flag
- [x] ResultScreen vet diet view: medkit badge, D-135 copy, ingredient list + severity dots, allergen warnings, breed contraindications
- [x] Suppressed for vet diets: ScoreRing, verdict, BenchmarkBar, ScoreWaterfall, ConcernTags, Safe Swap, Compare, Share, GATable, AAFCO bars, Portion/Treat cards
- [x] D-135 added to CLAUDE.md: Non-Negotiable Rule #13, "What NOT to Build", self-check items

### Migration 008: Dataset Field Backfill
- [x] Add `feeding_guidelines`, `is_vet_diet`, `special_diet`, `image_url`, `source_url` to products table
- [x] Backfill 9,078 products from `dataset_kiba_v6_merged.json` (0 errors)
- [x] `docs/references/dataset-field-mapping.md` — full audit of mapped vs dropped fields

---

## M5: Pantry + Recall Siren (Weeks 20–23)

> Goal: The killer retention feature. "Smoke alarm for recalled pet food."

### Pantry
- [x] Add scanned products to pantry
- [x] Me tab "Log a Treat" scan button under Treat Battery — auto-deducts kcal (D-124)
- [x] Per-pet pantry assignment with multi-pet sharing (many-to-many — one bag assigned to multiple pets)
- [x] Pantry card component (`PantryCard.tsx`) — product info, score/bypass badge, depletion bar, alerts, calorie context, treat mode, empty/low-stock/recalled states
- [x] Pantry dashboard showing all products with scores
- [x] Bag/pack countdown with days remaining (D-065, updated by D-152) — 2 serving formats: weight-based (dry/raw, cups per feeding) and unit-based (servings per feeding, D-164)
- [x] Shared pantry depletion: sum consumption rates across all assigned pets. Display: "Shared by Buster & Milo · 3.7 cups/day combined · ~13 days remaining"
- [x] User inputs bag size or pack quantity at add-to-pantry (D-165: product size pre-fill from name, budget-aware auto-calc serving)
- [x] Low stock nudge at ≤5 days or ≤5 units — affiliate buy button surfaces here (D-065)
- [ ] Staleness badge for products unverified >90 days (deferred — needs formula change detection infra from M3)
- [x] Feeding schedule per pantry item: daily (1-3x/day with clock times) or as-needed (D-101)
- [x] Push notifications on feeding schedule — grouped for multi-pet households
- [x] Auto-depletion tied to feeding schedule — no manual logging for daily items (D-101)
- [x] Budget-aware serving recommendations (D-165) — auto/manual toggle, remaining calorie budget from pantry, smart default feedings, decimal-pad input, budget warnings
- Weight goal slider (D-160) and caloric accumulator (D-161) moved to M6 scope

### Pantry Diet Completeness (D-136 Part 5)
- [x] Diet-level completeness check per pet when pantry composition changes (add/remove product, change assignment)
- [x] Supplemental product(s) alongside ≥1 complete food → no warning, optional "Topper" tag on pantry card
- [x] 2+ supplemental feeds with no complete food in pantry → persistent amber warning banner: "[Pet Name]'s diet may be missing essential nutrients. [Product] is designed as a supplement, not a complete meal. Consider adding a complete food."
- [x] Only supplemental products in pantry, zero complete food → red diet health card: "No complete meals found in [Pet Name]'s diet. Supplemental foods don't provide all required vitamins and minerals on their own."
- [x] Warnings are per-pet (each pet's pantry evaluated independently)
- [x] All warning copy D-095 compliant — factual, no clinical language
- [x] This is a diet-level assessment, NOT a score modifier — product scores never change based on pantry composition

### Pet Appointments (D-103)
- [x] Schedule vet, grooming, medication, vaccination, and custom appointments
- [x] Per-pet or multi-pet assignment
- [x] Optional reminders (1hr / 1 day / 3 days / 1 week before)
- [x] Recurring appointments (monthly, quarterly, 6-month, yearly) for flea meds, checkups
- [x] Upcoming appointments visible on pet profile and home screen
- [x] Past appointments archived for future vet report integration

### Recall Siren (Free Tier — D-125)
- [x] FDA recall RSS feed monitoring (automated, not manual checking)
- [x] Cross-reference recalled products against user pantry
- [x] Push notification to affected users — NOT premium-gated
- [x] Recalled product bypass — no score computed, bypass badge displayed (D-158, same pattern as vet diet D-135)
- [x] RecallDetailScreen with FDA link, allergen warnings, and "Remove from Pantry" action
- [x] Recalled pantry items pushed to top of list with red badge (D-158)
- [x] Historical recall log per product

### Weekly Digest Push Notification (D-130)
- [x] Supabase scheduled function: weekly scan summary + pantry state + recall alerts
- [x] Expo push notification integration
- [x] Adaptive content: activity summary if active, re-engagement nudge if inactive
- [x] User preference: weekly (default) or daily frequency
- [x] Free for all users (retention → conversion funnel)

---

## M6: Alternatives Engine (Weeks 24–27)

> Goal: "This scored low. Here are three options scoring 80+."

### Compare & Vet Report (moved from M4) — COMPLETE
- [x] Compare button (side-by-side product comparison) — 9-rule key differences engine, two-column CompareScreen, CompareProductPickerSheet
- [x] Vet Report (shareable PDF summary for vet visits) — 4-page diet-centric report via expo-print, premium-gated

### Weight Management (moved from M5) — COMPLETE
- [x] Weight goal slider on PortionCard (D-160) — 7 detents (-3 to +3), cat -3 hidden, swipeable pan gesture with haptic detents, live calorie context, premium-gated. Migration 022: `weight_goal_level SMALLINT` on `pets` table. All DER consumers wired. Proportional pantry serving scaling on slider change.
- [x] Caloric accumulator in auto-deplete cron (D-161) — estimated weight tracking from feeding data, species-specific thresholds (dogs 3,150 kcal/lb, cats 3,000 kcal/lb), notify-and-confirm via WeightEstimateSheet (confirm/enter actual/dismiss). PetHubScreen banner. D-117 stale weight suppressed when accumulator active. Migration 022: `caloric_accumulator` + `accumulator_last_reset_at` + `accumulator_notification_sent` on `pets`.
- [x] NotificationPreferencesScreen: weight_estimate_alerts_enabled toggle. Migration 022: `weight_estimate_alerts_enabled` on `user_settings`.

### BCS Reference Tool (D-162) — COMPLETE
- [x] Educational body condition score panel (9-point scale, species-specific)
- [x] Accessible from PortionCard, PetHubScreen, WeightEstimateSheet
- [x] Links to weight goal slider (D-160)
- [x] NOT diagnostic — no assessment, no input to scoring/DER
- [x] Primordial pouch callout for cats
- [ ] Visual assets needed: BCS silhouettes per category (dog + cat) — currently using numbered circles

### Safe Swap Recommendations — COMPLETE
- [x] Query products in same category + species with score >threshold (Plan 2 curated layout: Top Pick / Fish-Based / Great Value)
- [x] Filter by user's pet allergies (fish allergy → Fish-Based replaced with "Another Pick")
- [x] Rank by score, then by price (Great Value uses price/product_size_kg, migration 023)
- [x] "See Higher-Scoring Alternatives" CTA on all results (Safe Swap section on ResultScreen, life stage hard filter)

### Affiliate Integration
- [ ] Chewy affiliate program application (target: ~500+ active users)
- [ ] Affiliate link storage in `affiliate_links` JSONB (scoring engine blind to this)
- [ ] Amazon Associates setup with registered app URLs
- [ ] FTC disclosure auto-rendered below buy buttons
- [ ] Buy buttons hidden for products scoring <50
- [ ] Chewy: show estimated price. Amazon: "Check Current Price" (TOS compliant)

---

## M7: 7-Day Safe Switch Guide (Weeks 28–30) — COMPLETE

> Goal: Guided food transition to reduce digestive upset.

- [x] Day-by-day transition plan (old food % → new food %) — SafeSwitchDetailScreen with proportion bar, vertical timeline
- [x] Tummy Check prompts during transition — 3 pills (perfect/soft stool/upset), upset advisory on 2+ consecutive
- [x] Completion celebration + review prompt — completion card with "Done" CTA
- [x] Species-specific transition speeds (cats need slower transitions) — dogs 7 days, cats 10 days, getDefaultDuration()

---

## M8: Kiba Index (Complete)

> Goal: Community-driven taste and digestion feedback on products.

- [x] Taste Test voting (Loved it / Picky / Refused)
- [x] Tummy Check voting (Perfect / Soft stool / Upset)
- [x] Aggregate display on product results (bar charts at 5+ votes threshold)
- [x] One vote per pet per product enforcement (UPSERT on unique constraint)
- [x] Partial submissions (taste today, tummy later)
- [x] Picky Eater Approved badge (≥20 votes, ≥85% loved)
- [x] Bypass rules (hidden for vet diet, recalled, species mismatch, variety pack)
- [x] RPC aggregation function (SECURITY DEFINER, species-filtered)

---

## M9: UI Polish & Search (In Progress)

> Goal: Polish existing features and fix UX friction before adding new capabilities.

- [x] **MeScreen overhaul** — unified Medical Records card (chronological, micro-icons, top 3 + "See All"), MedicalRecordsScreen full-screen timeline, HealthRecordDetailSheet (edit/delete), health record CRUD service functions, Matte Premium visual polish, appointments card improvements (persistent add/see-all links), medication chevrons
- [x] **SwipeableRow component** — reusable swipe-to-reveal gestures on health records, medications, appointments. Swipe left → delete (with confirmation), swipe right → edit. `src/components/ui/SwipeableRow.tsx`
- [x] **Matte Premium design system** — `.agent/design.md` established: `cardSurface`, `hairlineBorder`, `pressOverlay` tokens, card anatomy, typography, spacing, anti-patterns. Checklist for polishing any screen.
- [x] **Vet diet data fix** — migration 027 restores 483 `is_vet_diet` flags lost during v7 reimport. D-135 bypass operational again. `import_products.py` updated to map `_is_vet_diet` for future imports.
- [x] **Pantry polish** — SwipeableRow on PantryCards, legacy token migration (`Colors.card` → `cardSurface`)
- [x] **Card contrast alignment** — `cardSurface` `#1C1C1E` → `#242424`, `hairlineBorder` `rgba 0.08` → `0.12`. PetHubScreen cards now match AppointmentsListScreen.
- [x] **Design system documentation** — icon platters, screen headers, disclaimer placement, Featured Action Card, zero-state text rules added to `.agent/design.md`.
- [x] **HomeScreen category browse** — 4 toggleable category cards (Daily Food, Toppers & Mixers, Treats, Supplements) with contextual sub-filter chips. Dynamic search re-triggers on filter change. Variety pack exclusion (`is_variety_pack` column, migration 029, ~1,706 flagged). `@shopify/flash-list` installed. `categoryBrowseService.ts` with cursor pagination + `fetchCategoryTopPicks` stub.
- [x] **Legacy token migration** — `Colors.card` → `Colors.cardSurface` and `Colors.cardBorder` → `Colors.hairlineBorder` across ~40 remaining files
- [x] **ResultScreen + HomeScreen matte frame pass** — card anatomy on 8 scoring cards (PositionMap, BonusNutrientGrid, CollapsibleSection, SafeSwapSection, AafcoProgressBars), HomeScreen category cards, Compare + Add to Pantry buttons
- [x] **Behavioral Feeding architecture** — migration 034, `feeding_style` + `feeding_role` model replacing slot/meal-fraction system. Wet Reserve Engine, diet completeness engine, refactored auto-deplete cron
- [x] **Custom Feeding Style** — `CustomFeedingStyleScreen`, kcal inputs per food, DER banner, visual sum bar, scale-invariant pct storage. Service layer: `updateCalorieShares`, `transitionToCustomMode/FromCustomMode`. 4th option in `FeedingStyleSetupSheet`
- [x] **`rebalanceBaseShares` auto-split** — even calorie_share_pct across base foods after add/remove/share, proportional serving_size scaling
- [x] **Feeding style mismatch detection** — `AddToPantrySheet` re-shows `FeedingStyleSetupSheet` when adding non-dry to `dry_only` (or dry to `wet_only`)
- [x] **Bookmarks + expanded history** — per-pet bookmarks (migration 040, cap 20), dedicated `BookmarksScreen` + `ScanHistoryScreen`, ResultScreen bookmark icon + overflow menu (Share / Report issue via `mailto:`), long-press entry on scan rows. D-169.
- [x] **Multi-agent cleanup (session 62)** — knip + manual dead-code sweep; 8-screen file-split refactor (3,132 LOC reduction across screens >1,000 LOC). PRs #16 + #17.
- [x] **Community tab rebuild (session 63 — pulled forward from M10 lite)** — full 11-phase / 32-task plan: server-side XP engine, Kiba Kitchen (recipe submission + auto-validators), Vendor Directory (Studio CMS + bundled offline assets), Toxic Database (35 curated entries), Blog (Studio CMS + react-native-marked), D-072 Community Safety Flags (sheet + tabbed screen + ResultScreen entry), Recall Live Feed banner. Migrations 041–049 + 2 storage buckets. D-170 (recipe-flag entry deferred to future `recipe_flags` table). Spec: `docs/superpowers/specs/2026-04-23-community-screen-design.md`. Plan: `docs/superpowers/plans/2026-04-23-community-screen.md`. QA: `docs/qa/2026-04-23-m9-community-qa.md`.
- [ ] Top Picks per category/sub-filter (up to 50, dedicated screen — stub ready)
- [ ] HomeScreen visual overhaul (custom assets, layout polish)
- [ ] General UX friction fixes

---

## Post-M9 Data Enrichment (Parallel to M10)

> Goal: Close two data quality gaps using Vertex AI Gemini Pro before launch. See `docs/plans/VERTEX_AI_BACKFILL_PLAN.md`.

- [ ] **Workstream 1 — Ingredient TLDR + citation backfill** (`ingredients_dict.tldr`, `detail_body`, `citations_display`). Whitelisted reference corpus. Human review gate before data trusted by Rule #6 penalty attribution.
- [ ] **Workstream 2 — Amazon A+ image → GA extraction** (`products.ga_*` for `asin IS NOT NULL AND ga_protein_pct IS NULL`). Requires A+ image URL scrape as prerequisite. DMB recompute downstream.
- [ ] Budget: ~$300 in Vertex credits (free ceiling). Rough spend estimate ~$60 worst case.

---

## M10: Community Points (Lite)

> Goal: Lightweight engagement loop — points and streaks only. Cosmetics and leaderboard deferred.

- [x] **XP engine: points for scanning, contributing, correcting classifications, streaks** (shipped under M9 Community — session 63). Server-side triggers in migration 046, idempotent on approvals, calendar-day streak with 1-day grace. `D-128 user_corrected_*` field-level XP not yet wired (XP currently fires on scan, vote, recipe approval, missing-product approval).
- [x] **Submit missing products** — M3 foundation built (D-091 miss flow, parse-ingredients Edge Function, community save with `contributed_by = auth.uid()`); XP grant on approval shipped under M9 Community (`process_missing_product_approval_xp` trigger, migration 046).
- [x] **Community safety flags (D-072)** — `score_flags` table (migration 045), `SafetyFlagSheet` + tabbed `SafetyFlagsScreen`, ResultScreen overflow entry. Shipped under M9 Community — session 63. Recipe-flag entry deferred to future `recipe_flags` table per D-170.

**Deferred to later update:**
- Moderation queue UI for submitted products (Studio is the M9 surface)
- Cosmetic rewards (profile borders, badges)
- Top contributor leaderboard
- `recipe_flags` table to re-enable Kitchen "Report issue" overflow (D-170)
- D-128 `user_corrected_*` field-level XP grants

---

## M11: Symptom Detective (Deferred — Major App Store Update)

> Goal: Daily health tracking with pattern detection. Big feature for post-launch update.

- [ ] Daily symptom logging (5 categories)
- [ ] Pattern detection algorithm (flag correlations after 2-4 weeks)
- [ ] "Possible sensitivity to [ingredient]" advisory when pattern detected
- [ ] Data visualization (calendar heatmap of symptoms)
- [ ] iOS Home Screen widget (7/30-day mini heatmap, WidgetKit)
- [ ] Notification quick-response logging ("How's Buster feeling today?" with one-tap actions)
- [ ] Vet Report integration (symptom timeline, ingredient correlations, diet-symptom overlay)

---

## M12: Launch Prep

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
- [ ] Pure Balance Grain-Free Salmon → 60/100 (regression test — D-137 DCM fires, mitigation applies)
- [ ] Temptations Classic Tuna → 0/100 (regression test — updated per D-142 colorant escalation + danger penalty increase)
- [ ] DMB conversion test: wet food with 78% moisture
- [ ] Edge cases: missing GA, null kcal, no ingredients, unsupported species → graceful handling
- [ ] Performance: scan → score ≤2s perceived latency
- [ ] RLS verification: user A cannot see user B's pets, scans, or pantry
- [ ] UPVM compliance audit: grep all UI strings for prohibited terms (D-095)
- [ ] Suitability framing audit: no screen displays a score without pet name context (D-094)
- [ ] Breed modifier audit: all `vet_audit_status = 'cleared'` before production

---

## M13: Public Launch

> Goal: iOS App Store. Android 4-6 weeks later.

- [ ] Submit to App Store review
- [ ] Monitor review feedback, respond to initial ratings
- [ ] Review prompt: after 3+ scans AND a positive moment (high score or Safe Switch completion)
- [ ] Never prompt on first session
- [ ] Target: 4.7+ rating

---

## M14–M16: Growth

### Retention Optimization (M14)
- [ ] Scan streak incentives
- [ ] Weekly pantry digest push notifications
- [ ] "New score available" when re-scraped formula changes

### iOS Home Screen Widget (D-131)
- [ ] Small widget: next feeding time + pet photo
- [ ] Medium widget: pantry low-stock + feeding + treat battery
- [ ] Large widget: weekly summary + feeding schedule + recall badge
- [ ] expo-widgets or native WidgetKit bridge

### Android Launch (M15)
- [ ] Port to Android via Expo EAS
- [ ] Play Store ASO (different keyword dynamics)
- [ ] Test paywall conversion rates vs iOS

### International (M16)
- [ ] UK/Canada/Australia keyword localization ("pet food checker UK")
- [ ] Currency localization for affiliate links
- [ ] Regional AAFCO equivalent standards (FEDIAF for EU)

---

## M17+: Expansion (Post-Launch)

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
