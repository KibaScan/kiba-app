# Pet Profile Spec — M2

> Canonical reference for pet profile data model, editing UI, allergen system, and Layer 3 integration.
> Read this before implementing any M2 pet profile work.
> Updated: March 1, 2026 — D-116 through D-121 integrated, life stages expanded to 6 tiers, NEEDS DECISION flags resolved. Species selection moved to pre-create screen (sex promoted to Card 1). D-123: species-specific activity labels.
> Depends on: D-064, D-092, D-094, D-095, D-097, D-098, D-102, D-106, D-109, D-110, D-112, D-116, D-117, D-118, D-119, D-120, D-121, D-122, D-123

---

## 1. Profile Fields

### 1a. Core Fields (Light Profile — captured at onboarding per D-092)

| Field | Type | Required | Default | Validation |
|-------|------|----------|---------|------------|
| `name` | TEXT | ✅ | — | 1–20 chars, trimmed |
| `species` | ENUM('dog','cat') | ✅ | — | Only dog or cat. Refuse all other species. |

These two fields are the minimum for D-094 compliance ("no naked scores"). Captured after first scan, before score displays. Layer 2 species rules activate with species alone.

### 1b. Full Profile Fields (progressive — drives Layer 3)

| Field | Type | Required | Default | Validation | Notes |
|-------|------|----------|---------|------------|-------|
| `breed` | TEXT | No | 'Mixed Breed' | Must match `breeds` lookup or 'Mixed Breed'/'Unknown / Other' | Drives breed modifiers (D-109) and contraindications (D-112) |
| `weight_current_lbs` | DECIMAL(5,1) | No | null | 0.5–300 lbs | Stored in lbs, converted to kg for DER: `kg = lbs / 2.205` |
| `weight_goal_lbs` | DECIMAL(5,1) | No | null | 0.5–300 lbs | Only active when obesity OR underweight condition set (D-106) |
| `weight_updated_at` | TIMESTAMPTZ | — | Auto-set | Set on every write to weight_current_lbs | D-117: stale weight guard (amber prompt >6 months) |
| `date_of_birth` | DATE | No | null | Not in future, not >30 years ago | Used for age + life stage derivation (D-064) |
| `dob_is_approximate` | BOOLEAN | No | false | — | D-116: true when DOB synthesized from approximate age inputs |
| `activity_level` | ENUM | No | Species-dependent | 'low','moderate','high','working' | D-123: Dogs default 'moderate', cats default 'low'. 'working' only valid for dogs. Affects DER multiplier (see PORTION_CALCULATOR_SPEC) |
| `is_neutered` | BOOLEAN | No | true | — | Affects DER multiplier. Default true — majority of pets are neutered. |
| `sex` | TEXT | No | null | 'male' or 'female', null valid | D-118: optional. For vet report credibility + pronoun personalization. Zero scoring impact. |
| `photo_url` | TEXT | No | null | Valid Supabase storage path | Displayed on score ring per D-094 |
| `life_stage` | TEXT | — | Derived | Auto-calculated, never user-set | See §2 |
| `breed_size` | TEXT | — | Derived | Auto-calculated from breed lookup | 'small','medium','large','giant' |

### 1c. Canonical Table (D-110)

Table name is `pets`, not `pet_profiles`. All FKs reference `pets(id)`. RLS via `user_id = auth.uid()`.

```sql
CREATE TABLE pets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  species TEXT NOT NULL CHECK (species IN ('dog', 'cat')),
  breed TEXT DEFAULT 'Mixed Breed',
  weight_current_lbs DECIMAL(5,1),
  weight_goal_lbs DECIMAL(5,1),
  weight_updated_at TIMESTAMPTZ,         -- D-117: set on every weight write
  date_of_birth DATE,
  dob_is_approximate BOOLEAN DEFAULT false, -- D-116: true for synthesized DOB
  activity_level TEXT DEFAULT 'moderate' CHECK (activity_level IN ('low','moderate','high','working')), -- D-123: DB default 'moderate'; app overrides to 'low' for cats, hides 'working' for cats
  is_neutered BOOLEAN DEFAULT true,
  sex TEXT CHECK (sex IN ('male', 'female')), -- D-118: optional, null valid
  photo_url TEXT,
  life_stage TEXT,                        -- derived, never user-set
  breed_size TEXT,                        -- derived from breed lookup
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE pets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own pets"
  ON pets FOR ALL USING (user_id = auth.uid());
```

---

## 2. Life Stage Derivation (D-064)

Life stage is **auto-derived** from age + species + breed size. Never ask users to select it. Recalculate on birthday, weight update, or breed change.

### 6-Tier System

Six tiers across both species. Two additional tiers (`junior` and `mature`) provide more accurate UI display and AAFCO matching than the traditional 4-tier veterinary model.

### Dog Life Stages (breed-size-adjusted)

| Life Stage | Small (<25 lbs) | Medium (25–55 lbs) | Large (55–90 lbs) | Giant (>90 lbs) |
|------------|----------------|---------------------|---------------------|------------------|
| Puppy | 0–12 mo | 0–12 mo | 0–12 mo | 0–18 mo |
| Junior | 12–24 mo | 12–24 mo | 12–24 mo | 18–24 mo |
| Adult | 2–7 yr | 2–7 yr | 2–6 yr | 2–5 yr |
| Mature | 7–10 yr | 7–10 yr | 6–8 yr | 5–8 yr |
| Senior | 10–13 yr | 10–13 yr | 8–11 yr | 8–10 yr |
| Geriatric | 13+ yr | 13+ yr | 11+ yr | 10+ yr |

### Cat Life Stages

| Life Stage | All Cats |
|------------|----------|
| Kitten | 0–12 months |
| Junior | 1–2 years |
| Adult | 2–7 years |
| Mature | 7–11 years |
| Senior | 11–14 years |
| Geriatric | 14+ years |

**CRITICAL — Geriatric cats (D-063):** Cats 14+ (geriatric) need MORE calories (1.4–1.6x RER), not fewer, due to sarcopenia and declining digestive efficiency. Do NOT linearly reduce calories with age for cats. See PORTION_CALCULATOR_SPEC.md §5.

### DER Mapping (6-tier → 4 metabolic buckets)

The veterinary literature (NRC 2006, AAHA 2021) defines DER multipliers for four metabolic buckets. The 6-tier system collapses cleanly:

| 6-Tier Stage | DER Maps To | Rationale |
|---|---|---|
| Puppy / Kitten | `puppy` | Growth multipliers (2.0–3.0x) |
| Junior | `adult` | Growth essentially complete, standard adult energy needs |
| Adult | `adult` | Standard |
| Mature | `adult` | No significant metabolic decline yet — senior multipliers would underfeed |
| Senior | `senior` | Reduced activity, moderate metabolic decline |
| Geriatric | `geriatric` | Dogs: further reduced. Cats: INCREASED (D-063) |

```typescript
function getDerLifeStage(
  lifeStage: LifeStage
): 'puppy' | 'adult' | 'senior' | 'geriatric' {
  if (lifeStage === 'junior' || lifeStage === 'mature') return 'adult';
  if (lifeStage === 'puppy' || lifeStage === 'kitten') return 'puppy';
  return lifeStage; // 'senior' | 'geriatric' pass through
}
```

### Where 6 Tiers Matter Beyond DER

- **AAFCO life stage matching** (NP bucket): Junior dogs may still benefit from "Growth" formulas. Mature cats don't need "Senior" formulas yet.
- **Breed modifier applicability**: Some modifiers apply only to specific stages (giant breed calcium = puppies only, not junior).
- **UI display**: "Mature" badge on a 9-year-old Lab is more informative than "Adult." "Junior" on a 14-month-old Golden is more accurate than "Puppy."

### Breed Size Derivation

Breed → breed_size mapping stored in `src/data/breeds.ts`. For unknown/mixed breeds:

| Species | Fallback |
|---------|----------|
| Dog ('Mixed Breed' or unknown) | Derive from `weight_current_lbs` if available: <25 lbs=small, 25–55=medium, 55–90=large, >90=giant. If no weight: default 'medium'. |
| Cat (all breeds) | Not applicable — cats don't use breed_size for life stage thresholds |

### Implementation

```typescript
function deriveLifeStage(
  dateOfBirth: Date | null,
  species: 'dog' | 'cat',
  breedSize?: 'small' | 'medium' | 'large' | 'giant'
): LifeStage | null
// Returns null if dateOfBirth is null (age unknown)
// Uses 'medium' default if breedSize is null for dogs
```

- Call on every profile save where `date_of_birth` or `breed` changes
- Store result in `pets.life_stage` column
- Feeds into: AAFCO life stage matching (NP bucket), DER multiplier selection, breed modifier applicability

---

## 3. Approximate Age Mode (D-116)

~25-30% of pet owners have rescue animals with unknown exact birthdays. Forcing an exact date causes friction or abandonment.

### UI

Date of birth field offers a toggle: `[ Exact Date ] | [ Approximate Age ]`

- **Exact Date:** Date picker (month/year only — day not needed)
- **Approximate Age:** Two stepper inputs side by side — Years (0–30) + Months (0–11)
- Toggle fires `haptics.chipToggle()` (D-121)
- Default: Exact Date mode

### Backend

```typescript
function synthesizeDob(years: number, months: number): Date
// Returns: today - (years * 12 + months) months, pinned to 1st of month
// If both 0: returns today (newborn)
```

Stores result in `pets.date_of_birth` with `pets.dob_is_approximate = true`.

The life stage engine treats synthesized and exact DOBs identically — `dob_is_approximate` is provenance metadata only, never affecting calculations.

---

## 4. Stale Weight Indicator (D-117)

### Trigger

If `weight_updated_at` is >6 months ago AND `weight_current_lbs` is not null.

### UI

Persistent amber (#FF9500) prompt on Pet Hub:
> "Weight last updated [N] months ago — still accurate?"

Tappable → navigates to Edit Profile with weight field focused.

### Implementation

- `weight_updated_at` is set to `NOW()` on every write to `weight_current_lbs` (in petService.updatePet)
- Stale weight corrupts DER calculations (D-060), goal weight math (D-061), and the cat hepatic lipidosis guard (D-062)
- Prompt is non-blocking — doesn't prevent scanning or scoring
- Disappears when weight is updated or user dismisses

---

## 5. Sex Field (D-118)

### UI

Segmented control: `[ Male ] [ Female ]`
Neither selected by default (null is valid). Fires `haptics.chipToggle()`.

### Uses

1. **Vet report credibility (D-099):** Sex is standard on veterinary intake forms
2. **Pronoun personalization:** "his score" / "her score" vs "their score" in D-094 copy. Falls back to "their" when null.

### Zero scoring impact.

Sex does not modify any scoring layer. Display and reporting field only.

---

## 6. Health Conditions (D-097)

### "Perfectly Healthy" Chip (D-119)

Special green chip (#34C759) with checkmark icon (SF Symbol `checkmark.shield`) at the top of the conditions grid.

**Behavior:**
- Tapping "Perfectly Healthy" → deselects ALL condition chips
- Tapping any condition chip → deselects "Perfectly Healthy"
- Mutual exclusion: "Perfectly Healthy" OR conditions, never both
- Stores **zero rows** in `pet_conditions` — functionally identical to skipping
- Neither direction is automatic — user must explicitly tap to toggle

### Condition List — Species Filtered

| UI Label | `condition_tag` | Dogs | Cats | Layer 3 Impact |
|----------|----------------|------|------|----------------|
| Perfectly Healthy | — | ✅ | ✅ | Zero rows stored. Green chip, top of list. (D-119) |
| Joint issues | `joint` | ✅ | ✅ | Glucosamine/chondroitin/omega-3 relevance flagging |
| Food allergies | `allergy` | ✅ | ✅ | Triggers allergen sub-picker (§7) |
| Sensitive stomach | `gi_sensitive` | ✅ | ✅ | Limited ingredient preference, novel protein flagging |
| Overweight | `obesity` | ✅ | ✅ | Fiber penalty suppression (D-106 §4), goal weight mode |
| Underweight | `underweight` | ✅ | ✅ | Goal weight mode (D-106 §2) |
| Diabetes | `diabetes` | ✅ | ✅ | Low-glycemic carb scoring priority |
| Kidney disease | `ckd` | ✅ | ✅ | Phosphorus restriction flagging, protein moderation |
| Urinary issues | `urinary` | ✅ | ✅ | Mineral balance flagging (Ca, P, Mg), moisture flagging |
| Heart disease | `cardiac` | ✅ | ✅ | Sodium flagging, taurine/L-carnitine relevance |
| Pancreatitis | `pancreatitis` | ✅ | ✅ | Low-fat scoring priority |
| Skin & coat issues | `skin` | ✅ | ✅ | Omega-3/6 ratio, novel protein relevance |
| Liver disease | `liver` | ✅ | ✅ | Copper sensitivity (breed-specific dogs), L-carnitine relevance |
| Hyperthyroidism | `hyperthyroid` | ❌ | ✅ | Iodine-controlled diet flagging |
| Seizures / Epilepsy | `seizures` | ✅ | ❌ | MCT oil relevance flagging |

Dogs see 14 options (including Perfectly Healthy), cats see 13.

**Mutual exclusion:** `obesity` and `underweight` cannot both be selected. Selecting one deselects the other. UI enforces via disabled state (50% opacity).

### Subtext (D-095 compliant)

Below the conditions grid:
> "Tell us about [Pet Name]'s health so we can check food ingredients against published guidelines."

NOT: "...so we can recommend the right food" (implies prescription — D-095 violation).

### UI Flow
1. "Known health conditions?" → multi-select chips, species-filtered
2. If `allergy` selected → allergen sub-picker appears (§7)
3. "Perfectly Healthy" or skip to continue

### Schema

```sql
CREATE TABLE pet_conditions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pet_id UUID REFERENCES pets(id) ON DELETE CASCADE,
  condition_tag TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(pet_id, condition_tag)
);

ALTER TABLE pet_conditions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own pet conditions"
  ON pet_conditions FOR ALL
  USING (pet_id IN (SELECT id FROM pets WHERE user_id = auth.uid()));
```

---

## 7. Food Allergen System (D-097 + D-098)

### Standard Allergen List — Species Filtered

| Allergen | Dogs | Cats | Prevalence |
|----------|------|------|------------|
| Beef | ✅ | ✅ | #1 both species (Mueller 2016) |
| Chicken | ✅ | ✅ | #1-2 (Mueller 2016, dvm360 2025) |
| Dairy | ✅ | ✅ | #2 dogs (Mueller 2016) |
| Wheat | ✅ | ❌ | #4 dogs (Mueller 2016) |
| Fish | ✅ | ✅ | Top 3 cats (Mueller 2016) |
| Lamb | ✅ | ✅ | Mueller 2016, Merck 2025 |
| Soy | ✅ | ❌ | Mueller 2016 |
| Egg | ✅ | ❌ | Mueller 2016 |
| Corn | ✅ | ❌ | Mueller 2016 |
| Pork | ✅ | ❌ | Mueller 2016 |
| Turkey | ✅ | ✅ | Cross-reactive with chicken |
| Rice | ✅ | ❌ | Uncommon but documented |
| Other | ✅ | ✅ | Searchable dropdown (see below) |

Dogs see 13 options, cats see 7 + Other.

### "Other" Allergen — Searchable Dropdown (NOT free text)

The "Other" option opens a searchable dropdown populated from every distinct protein source `allergen_group` in `ingredients_dict`. This guarantees every user-selected allergen has a working cross-reactivity mapping.

**Why not free text:** Free text "Venison" has no relational mapping → scanning a product with "Venison Meal" would silently bypass cross-reactivity → false negative on an allergen → safety gap.

**Max custom allergens:** 10 per pet (prevent abuse / accidental data issues).

### Cross-Reactivity Expansion (D-098)

At scan time, the engine expands allergen selections to ALL derivative forms:

| User Selects | `allergen_group` | Derivative Forms Flagged |
|---|---|---|
| Chicken | `chicken` | chicken, chicken meal, chicken liver, chicken by-product meal, chicken broth, chicken cartilage, chicken digest, dehydrated chicken, chicken heart, chicken gizzards |
| Beef | `beef` | beef, beef meal, beef liver, beef by-products, beef broth, beef heart, beef lung |
| Dairy | `dairy` | milk, dried milk, whey, dried whey, casein, cheese, lactose, cream, butter, lactalbumin, milk protein |
| Fish | `fish` | salmon, salmon meal, tuna, whitefish, whitefish meal, fish meal, menhaden fish meal, herring, herring meal, anchovy, sardine, pollock, cod, ocean fish meal |

(Full expansion table in D-098)

### Two Alert Tiers

| Match Type | Trigger | UI |
|---|---|---|
| **Direct match** | Ingredient's `allergen_group` matches pet's allergen | **Red card:** "Contains chicken meal — chicken is listed as a known allergen for [Pet Name]" |
| **Possible match** | Unnamed ingredient's `allergen_group_possible` includes pet's allergen | **Amber card:** "Contains poultry fat — unnamed sourcing term may include chicken. Verify with manufacturer." |

**Rendered fats & purified oils → Possible Match only.** Food allergies are IgE-mediated responses to proteins, not lipids. Chicken fat, beef tallow, fish oil etc. are `allergen_group_possible`, not `allergen_group`. Amber card with clinical explanation per D-098.

### Schema

```sql
CREATE TABLE pet_allergens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pet_id UUID REFERENCES pets(id) ON DELETE CASCADE,
  allergen TEXT NOT NULL,
  is_custom BOOLEAN DEFAULT false, -- true for "Other" dropdown entries
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(pet_id, allergen)
);

-- ingredients_dict additions (may already exist from M1):
ALTER TABLE ingredients_dict
  ADD COLUMN allergen_group TEXT,           -- 'chicken', 'beef', etc.
  ADD COLUMN allergen_group_possible TEXT[]; -- for unnamed ingredients

CREATE INDEX idx_ingredients_allergen_group ON ingredients_dict(allergen_group);

-- RLS
ALTER TABLE pet_allergens ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own pet allergens"
  ON pet_allergens FOR ALL
  USING (pet_id IN (SELECT id FROM pets WHERE user_id = auth.uid()));
```

### Scan-Time Allergen Query

```sql
-- Direct matches
SELECT pi.canonical_name, pi.position, id.allergen_group
FROM product_ingredients pi
JOIN ingredients_dict id ON pi.ingredient_id = id.id
WHERE id.allergen_group IN (SELECT allergen FROM pet_allergens WHERE pet_id = $1);

-- Possible matches (unnamed ingredients)
SELECT pi.canonical_name, pi.position, id.allergen_group_possible
FROM product_ingredients pi
JOIN ingredients_dict id ON pi.ingredient_id = id.id
WHERE id.allergen_group_possible && (SELECT array_agg(allergen) FROM pet_allergens WHERE pet_id = $1);
```

---

## 8. Breed Modifiers → Layer 3 (D-109, D-112)

### Data Source

Static typed JSON in `src/data/`:
- `breeds.ts` — breed lists, size maps, and modifier data
- Dogs: 23 breed entries from BREED_MODIFIERS_DOGS.md
- Cats: 21 breed entries from BREED_MODIFIERS_CATS.md

NOT in Supabase. NOT fetched at runtime. Ships with app. Updates via app release.

### Breed Selector (D-102)

Alphabetical A-Z with search filter. "Mixed Breed" and "Unknown / Other" always pinned at the bottom. Tap fires `haptics.chipToggle()`.

### Three Actionability Tiers

| Tier | What It Modifies | Example |
|------|-----------------|---------|
| **GA-actionable** | Adjusts nutritional sub-scores based on GA values | German Shepherd: fat_sub -5 if fat_dmb > 18% |
| **Ingredient-actionable** | Flags specific ingredients | Dalmatian: high-purine protein sources |
| **Advisory-only** | UI note, no score impact | Siamese: higher protein preference noted |

### Breed Contraindications (D-112) — Binary, Not Gradual

Some breed risks are too severe for score adjustments. These produce:
- **Zero score impact** (adjustment: 0)
- **Red warning card above fold** — same visual as allergen direct_match
- **type: 'breed_contraindication'** in PersonalizationDetail

| Breed | Trigger | Card Text |
|---|---|---|
| Dalmatian | High-purine proteins (organ meats, sardines, anchovies, mackerel, brewer's yeast) | "Contains high-purine protein sources. Dalmatians have a genetic uric acid metabolism defect (SLC2A9)..." |
| Irish Setter | Gluten grains (wheat, barley, rye, oats) | "Contains gluten-containing grains. Irish Setters have documented gluten-sensitive enteropathy..." |
| Border Terrier | Gluten grains (wheat, barley, rye — NOT oats) | "Contains gluten-containing grains. Border Terriers have documented paroxysmal gluten-sensitive dyskinesia..." |

**Contraindications are independent from breed score modifiers.** A Dalmatian can have BOTH a contraindication card (high-purine detected) AND GA-actionable modifiers (protein_dmb adjustment).

### Modifier Cap

All breed modifiers capped at +/-10 points total within the nutritional bucket. `no_modifier` breeds explicitly registered to prevent false penalties.

### Integration Point

`personalization.ts` reads breed from pet profile → looks up in static data → applies modifiers to relevant sub-scores → returns PersonalizationDetail array. The waterfall row "[Pet Name]'s Breed & Age Adjustments" displays these.

---

## 9. Multi-Pet System (D-120)

### Global State

`useActivePetStore` Zustand store manages active pet context:

```typescript
interface ActivePetStore {
  activePetId: string | null;
  pets: Pet[];
  setActivePet: (petId: string) => void;
  loadPets: () => Promise<void>;
  addPet: (pet: Pet) => void;
  removePet: (petId: string) => void;
  updatePet: (petId: string, updates: Partial<Pet>) => void;
}
```

- `activePetId` persisted via AsyncStorage (survives app restart)
- Full `pets` array fetched from Supabase on load, not persisted locally
- Consumed by: ScanScreen, ResultScreen, HomeScreen, PetHubScreen

### Pet Hub Carousel

Horizontal row of pet avatars at the top of Pet Hub (Instagram Stories-style):
- Active pet: 48px, full opacity, teal border (#00B4D8, 2px)
- Inactive pets: 36px, 50% opacity, no border
- Rightmost: "+ Add Pet" circle with plus icon
- Tap inactive → `setActivePet()`, all Hub cards update

### Free Tier Gate

Free tier = 1 pet, no carousel visible (D-052). Premium = carousel appears when 2+ pets exist. "+ Add Pet" on free tier triggers paywall via `permissions.ts`.

---

## 10. Haptic Feedback Map (D-121)

Standardized `expo-haptics` usage via `src/utils/haptics.ts`.

| Interaction | Haptic Type | Function Name |
|---|---|---|
| Chip toggle (conditions, allergens, activity, DOB mode) | Light impact | `chipToggle()` |
| Species toggle / Scan button press | Medium impact | `speciesToggle()` / `scanButton()` |
| Save success / 100% profile / Barcode recognized | Success notification | `saveSuccess()` / `profileComplete()` / `barcodeRecognized()` |
| Hepatic lipidosis warning displayed | Error notification | `hepaticWarning()` |
| Delete confirmation tap | Heavy impact | `deleteConfirm()` |

Platform-check: no-op on unsupported platforms. Single import: `import { saveSuccess, chipToggle } from '@/utils/haptics'`.

---

## 11. Profile Editing UI

### Species Selection Screen (Pre-Create)

Full-screen "I have a..." with two large tappable cards: `[ Dog ]` and `[ Cat ]`. Uses Ionicons 'paw' icon + text label.
Background: #1A1A1A. Cards: #242424, 12px border radius. Tapping fires `haptics.speciesToggle()` and navigates to CreatePetScreen with species passed as a route param.

Species is NOT shown or editable on the create/edit form — it is locked from this selection. This replaces the in-form species segmented control.

### Create Screen Layout

Single scrollable form. Three grouped cards on #1A1A1A background, #242424 card surfaces, 12px border radius. Species is already captured via SpeciesSelectScreen (above) and passed as a route param — not a form field.

**Card 1 — Identity:**
- Photo — circular frame (96px), tap to select from gallery (Expo ImagePicker, square crop, quality 0.7). Default: species silhouette icon.
- Name — text input, 1–20 chars, required. Placeholder: "What's your pet's name?"
- Sex — D-118 segmented control `[ Male ] [ Female ]`, neither pre-selected. Fires `haptics.chipToggle()`. Optional.

**Card 2 — Physical:**
- Breed — searchable dropdown per D-102 (filtered by species from route param)
- Date of Birth — D-116 toggle: `[ Exact Date ] | [ Approximate Age ]`
- Weight — numeric input with "lbs" suffix, one decimal place

**Card 3 — Details:**
- Activity Level — species-specific labels per D-123:
  - Dogs: segmented `[ Low ] [ Moderate ] [ High ] [ Working ]`, default: Moderate
  - Cats: segmented `[ Indoor ] [ Indoor/Outdoor ] [ Outdoor ]`, default: Indoor
  - Label → DB mapping: Indoor='low', Indoor/Outdoor='moderate', Outdoor='high'
  - "Working" hidden for cats (no cat DER multiplier exists)
- Neutered — toggle switch "Spayed / Neutered", default: on

Bottom: "Continue to Health" button → saves basic profile (species from route param + form fields), navigates to Health Conditions screen. Minimum required: name (species already captured).

"Skip for now" link → saves with just name + species, navigates to Hub.

### Edit Screen Differences

- Pre-populated with existing pet data
- "Save Changes" replaces "Continue to Health"
- Species: not shown in form — locked at creation via SpeciesSelectScreen. Users must delete pet and create new to change species.
- "Health & Diet" navigation link → Health Conditions screen
- Delete button at bottom (red text): "Delete [Pet Name]" → confirmation modal requiring typed pet name (case-insensitive). Fires `haptics.deleteConfirm()`.

### Validation Rules

- Name: required, 1–20 characters, trimmed
- Weight: optional, but if entered: 0.5–300 lbs
- DOB (exact): cannot be in the future, cannot be >30 years ago
- DOB (approximate): years 0–30, months 0–11, cannot both be 0 if age provided
- Goal weight: only editable when obesity OR underweight condition active
- Goal weight direction: goal < current for obesity, goal > current for underweight
- Cat hepatic lipidosis guard (D-062): if cat + obesity + goal weight → check implied loss rate. If >1% body weight/week → red warning before save.
- Species: captured on SpeciesSelectScreen before form. Not editable in create or edit form. Breed list and condition list filter by species from route param.

### Auto-Derivation on Save

1. Derive `breed_size` from breed lookup (or weight fallback for Mixed Breed)
2. Derive `life_stage` from age + species + breed_size (§2)
3. Set `weight_updated_at = NOW()` if `weight_current_lbs` changed (D-117)
4. Update `updated_at` timestamp
5. If conditions changed → clear orphaned allergens if `allergy` removed
6. If breed changed → re-derive breed_size, re-derive life_stage, update breed modifiers

---

## 12. Profile Completeness

Track populated fields to drive progressive personalization prompts.

### Completeness Formula

| Field | Weight |
|-------|--------|
| name | 20% |
| species | 20% |
| breed | 15% |
| date_of_birth | 15% |
| weight_current_lbs | 15% |
| conditions (any response, including "Perfectly Healthy") | 15% |
| **Total** | **100%** |

Display: "Score Accuracy: [X]%" with teal fill bar on Pet Hub.

### Scoring Layers Active by Tier

| Completeness | Fields Present | Layers Active |
|---|---|---|
| 40% (minimal) | name + species | Layer 1 + Layer 2 |
| 55-70% (basic) | + breed + DOB | + breed modifiers, life stage matching |
| 100% (full) | + weight + conditions | + full Layer 3, weight advisories, allergen cards |

### Prompt

After scan with incomplete profile:
> "Complete [Pet Name]'s profile for better scores"

Tappable → Edit Profile. Cap at once per session or once per 3 scans. Do NOT show if profile is 100%.

---

## 13. Scoring Integration Summary

### What Each Profile Field Activates

| Profile Field | Scoring Layer | What It Does |
|---|---|---|
| species | Layer 2 | Dog vs cat species rules (DCM, carb overload, UGT1A6) |
| breed | Layer 3 | Breed modifiers (+/-10 cap), breed contraindications (D-112) |
| life_stage | Layer 1b (NP) | AAFCO threshold selection (puppy vs adult vs all-life-stages) |
| weight | — | DER calculation for portion advisories (D-106). NOT a score modifier. |
| conditions | Layer 3 | Condition-specific modifiers (CKD→phosphorus, pancreatitis→fat, etc.) |
| allergens | Layer 3 (UI) | Allergen warning cards (red/amber). NOT score modifiers — binary safety flags. |
| activity_level | — | DER multiplier for portion calculator. NOT a score modifier. |
| sex | — | Pronoun personalization + vet report. NOT a score modifier. |

### What Is NOT a Score Modifier

- Weight (D-106: portions, not scores)
- Activity level (DER, not scores)
- Allergen warnings (binary flags, not gradients)
- Breed contraindications (red cards, not score adjustments)
- Sex (display only)

---

## 14. Edge Cases

| Scenario | Behavior |
|----------|----------|
| No breed selected | `breed_size` = derived from weight or 'medium' default (dogs). No modifiers, no contraindications. |
| No DOB | `life_stage` = null → use AAFCO "All Life Stages" thresholds as fallback |
| No weight | Skip all portion calculations, hide portion card, skip hepatic lipidosis guard |
| No conditions | Layer 3 condition modifiers = neutral (0 adjustment) |
| Breed not in lookup | Treated as 'Mixed Breed' — no modifiers, no contraindications |
| Species change | Not possible in form — species locked at creation via SpeciesSelectScreen. Delete pet and create new as escape hatch. |
| Pet deleted | CASCADE deletes pet_conditions, pet_allergens, and all scan associations |
| Allergen added after scans exist | Previously scanned products don't retroactively show warnings. Next scan of same product will. Pantry items should re-evaluate (M5). |
| Stale weight (>6 months) | Amber prompt on Hub (D-117). Non-blocking. |
| Approximate DOB | Treated identically to exact DOB by all calculation engines. `dob_is_approximate` is metadata only. |

---

## 15. Session Planning

See **M2_PROMPT_GUIDE.md** for the complete session-by-session build plan with copy-paste prompts, review checkpoints, and `/compact`/`/clear` boundaries.
