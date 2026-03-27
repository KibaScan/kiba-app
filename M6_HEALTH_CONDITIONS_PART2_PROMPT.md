# M6 Health Conditions — Part 2 of 3: Schema + Types + Pet Profile UI

> Feed this file to Claude Code. No scoring changes (Part 1 is done). Advisory UI is included as a plain functional placeholder — will be redesigned by a designer later.

---

## Read These Files First

Read all of these before making any changes:

- `docs/specs/M6_HEALTH_CONDITION_SCORING_SPEC.md` (§ Schema Changes, § Per-Condition Rules for mutual exclusions + sub-types)
- `src/types/pet.ts`
- `src/services/petService.ts`
- `src/screens/PetHubScreen.tsx`
- `src/utils/permissions.ts`
- `src/utils/conditionScoring.ts` (to see the condition keys used in CONDITION_RULES)
- `supabase/migrations/` (check highest migration number — next one follows sequentially)
- `DECISIONS.md` (search for D-160, D-162, D-163 for schema patterns)
- `M6_HANDOFF.md` (§ Health Conditions Expansion for medication tracking schema)

---

## 1. Migration: `pet_condition_details` + `pet_medications`

Use the next sequential migration number after whatever currently exists.

### pet_condition_details

```sql
CREATE TABLE IF NOT EXISTS pet_condition_details (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pet_id UUID NOT NULL REFERENCES pets(id) ON DELETE CASCADE,
  condition TEXT NOT NULL,
  sub_type TEXT,                    -- e.g., 'iodine_restricted', 'medication_managed'
  severity TEXT DEFAULT 'moderate', -- 'mild', 'moderate', 'severe'
  diagnosed_at DATE,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(pet_id, condition)
);

ALTER TABLE pet_condition_details ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own pet conditions" ON pet_condition_details
  USING (pet_id IN (SELECT id FROM pets WHERE user_id = auth.uid()));
```

### pet_medications

```sql
CREATE TABLE IF NOT EXISTS pet_medications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pet_id UUID NOT NULL REFERENCES pets(id) ON DELETE CASCADE,
  medication_name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'current' CHECK (status IN ('current', 'past', 'as_needed')),
  dosage TEXT,
  started_at DATE,
  ended_at DATE,
  prescribed_for TEXT,              -- links to a condition name
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE pet_medications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own pet medications" ON pet_medications
  USING (pet_id IN (SELECT id FROM pets WHERE user_id = auth.uid()));
```

### Backward compatibility

The existing `health_conditions TEXT[]` on the `pets` table stays. The detail table adds structured data on top. Code should read from both:
- `health_conditions` for condition names (scoring engine uses this)
- `pet_condition_details` for sub-type/severity (UI and future iodine-restricted scoring)

When a condition is toggled on/off, write to BOTH the `health_conditions` array AND the `pet_condition_details` table. They must stay in sync.

---

## 2. Types

In `src/types/pet.ts`, add:

```typescript
export interface PetConditionDetail {
  id: string;
  pet_id: string;
  condition: string;
  sub_type: string | null;
  severity: 'mild' | 'moderate' | 'severe';
  diagnosed_at: string | null;
  notes: string | null;
  created_at: string;
}

export interface PetMedication {
  id: string;
  pet_id: string;
  medication_name: string;
  status: 'current' | 'past' | 'as_needed';
  dosage: string | null;
  started_at: string | null;
  ended_at: string | null;
  prescribed_for: string | null;
  notes: string | null;
  created_at: string;
}
```

---

## 3. petService.ts — CRUD for Both Tables

Add these functions with offline guards (same pattern as existing appointment/pantry CRUD):

### pet_condition_details

- `getConditionDetails(petId: string): Promise<PetConditionDetail[]>`
- `upsertConditionDetail(petId: string, detail: Omit<PetConditionDetail, 'id' | 'pet_id' | 'created_at'>): Promise<void>` — upsert on (pet_id, condition) unique constraint
- `deleteConditionDetail(petId: string, condition: string): Promise<void>`

### pet_medications

- `getMedications(petId: string): Promise<PetMedication[]>`
- `createMedication(petId: string, med: Omit<PetMedication, 'id' | 'pet_id' | 'created_at'>): Promise<PetMedication>`
- `updateMedication(medId: string, updates: Partial<PetMedication>): Promise<void>`
- `deleteMedication(medId: string): Promise<void>`

---

## 4. Health Conditions Screen — Expanded List + Mutual Exclusions

Update the health conditions picker (wherever it currently lives — likely in pet profile edit flow).

### Full condition list

All condition string keys MUST exactly match those in `conditionScoring.ts` CONDITION_RULES:

| Key | Display Name | Species | Mutually Exclusive With |
|---|---|---|---|
| `obesity` | Overweight / Obese | Both | `underweight` |
| `underweight` | Underweight | Both | `obesity` |
| `gi_sensitive` | Sensitive Stomach | Both | — |
| `diabetes` | Diabetes | Both | — |
| `pancreatitis` | Pancreatitis | Both | — |
| `ckd` | Kidney Disease | Both | — |
| `cardiac` | Heart Disease | Both | — |
| `urinary` | Urinary Issues | Both | — |
| `joint` | Joint Issues | Both | — |
| `skin` | Skin & Coat Issues | Both | — |
| `hypothyroid` | Hypothyroidism | Dogs primarily | `hyperthyroid` |
| `hyperthyroid` | Hyperthyroidism | Cats primarily | `hypothyroid` |

### Mutual exclusion UI behavior

- Selecting `obesity` grays out `underweight` (and vice versa). Tap on grayed option shows toast: "Can't select both — [Pet Name] is already marked as [condition]."
- Selecting `hypothyroid` grays out `hyperthyroid` (and vice versa).
- `hypothyroid`: if a **cat** user tries to select it, show toast: "Hypothyroidism is extremely rare in cats. Did you mean Hyperthyroidism?"
- `hyperthyroid`: if a **dog** user tries to select it, show toast: "Hyperthyroidism is extremely rare in dogs. Did you mean Hypothyroidism?"

### Sub-type question (hyperthyroidism only)

When a cat owner selects `hyperthyroid`, show a follow-up question:

**"How is [Pet Name]'s hyperthyroidism being managed?"**
- "Iodine-restricted diet (e.g., Hill's y/d)" → `sub_type = 'iodine_restricted'`
- "Medication (e.g., methimazole)" → `sub_type = 'medication_managed'`
- "Surgery / radioactive iodine" → `sub_type = 'medication_managed'`

Store in `pet_condition_details` via the upsert function.

### Score cache invalidation

When any health condition is toggled on/off, set `health_reviewed_at = now()` on the `pets` table. This is the existing invalidation pattern — `checkCacheFreshness()` in `topMatches.ts` detects the change and triggers a re-score of `pet_product_scores`.

---

## 5. Medication Tracking on PetHubScreen

Add a "Medications" section on PetHubScreen below health conditions.

### Display

- Current meds shown with green dot, medication name, dosage
- Past meds collapsed by default
- Empty state: "No medications logged yet."

### Add Medication

"Add Medication" button opens a simple form:
- Medication name — text input (required, no autocomplete — we're not a pharmacy DB)
- Status — chip selector: Current / Past / As Needed
- Dosage — text input (optional, free text: "1 tablet daily", "0.5ml twice daily")
- Prescribed for — dropdown of pet's active conditions (optional, links medication to a condition)
- Started at — date picker (optional)
- Notes — text input (optional)

### Edit / Delete

- Tap existing medication to edit (same form, pre-filled)
- Swipe to delete with confirmation dialog

### Rules

- Medications do NOT influence scoring. Display-only, for the vet report (future Phase 3).
- D-095 compliant: label is "Medications" not "Prescriptions". No prescriptive language.

---

## 6. Auto-Reset Weight Goal on Condition Conflict

Verify this works (may already be implemented from M5):

- User adds `obesity` and `weight_goal_level` is +1/+2/+3 → auto-reset to 0, show toast: "[Pet Name]'s weight goal was reset to Maintain because they're marked as overweight."
- User adds `underweight` and `weight_goal_level` is -1/-2/-3 → auto-reset to 0, show toast: "[Pet Name]'s weight goal was reset to Maintain because they're marked as underweight."
- Check that `getAvailableLevels()` in the weight slider reads from the updated conditions.
- If this already works, leave it alone.

---

## 7. Health Condition Advisories on ResultScreen

When a pet has health conditions AND the product is scored (not bypassed), show a plain advisory section on the ResultScreen. This is a **functional placeholder** — it will be redesigned with custom icons and interactive expand/collapse by a designer later. Build it clean and simple so it's easy to replace.

### Component

Create `src/components/result/HealthConditionAdvisories.tsx`.

### Where it renders

On ResultScreen, in the normal scored result layout, between ConcernTags/SeverityBadgeStrip and the existing SafeSwapSection placeholder (or the Score Breakdown collapsible). Read the ResultScreen layout to find the right spot — it should be above the fold, visible without scrolling past the score.

### Props

```typescript
interface HealthConditionAdvisoriesProps {
  conditions: string[];           // pet's active health_conditions
  species: 'dog' | 'cat';
  petName: string;
  scannedScore: number;
  conditionAdjustments: Array<{   // from PersonalizationDetail entries with type 'condition'
    condition: string;
    rule: string;
    points: number;
    bucket: string;
    reason: string;
    citation: string;
  }>;
  isZeroedOut?: boolean;          // cardiac + DCM zero-out case
  zeroOutReason?: string;
}
```

### Layout — plain version

For each condition the pet has:

```
┌─────────────────────────────────────────────────────┐
│  Health Profile for [Pet Name]                       │
│                                                     │
│  ┌─────────────────────────────────────────────────┐│
│  │  ● Pancreatitis                                 ││
│  │                                                 ││
│  │  "High-fat foods can trigger life-threatening   ││
│  │  flare-ups in dogs. This product has 16.7% fat  ││
│  │  on a dry matter basis."                        ││
│  │                                                 ││
│  │  Score impact: −5 pts                           ││
│  │  (fat >12% DMB penalty)                         ││
│  │                                                 ││
│  │  Feeding: 3-4 smaller meals per day             ││
│  └─────────────────────────────────────────────────┘│
│                                                     │
│  ┌─────────────────────────────────────────────────┐│
│  │  ● Joint Issues                                 ││
│  │                                                 ││
│  │  "Keeping Buster lean is the single most        ││
│  │  effective way to manage joint health."          ││
│  │                                                 ││
│  │  Score impact: +2 pts                           ││
│  │  (omega-3 source detected)                      ││
│  └─────────────────────────────────────────────────┘│
│                                                     │
│  ℹ Based on veterinary nutrition guidelines.        │
│  Discuss therapeutic diets with your veterinarian.  │
└─────────────────────────────────────────────────────┘
```

### Cardiac + DCM zero-out case

When `isZeroedOut` is true, show a prominent warning instead of the normal cards:

```
┌─────────────────────────────────────────────────────┐
│  ⚠ Critical Warning for [Pet Name]                  │
│                                                     │
│  [Pet Name] has heart disease. This product         │
│  contains pulse ingredients linked to DCM in dogs.  │
│  Discuss alternatives with your veterinarian        │
│  immediately.                                       │
│                                                     │
│  This product scored 0% match due to this           │
│  combination.                                       │
└─────────────────────────────────────────────────────┘
```

### Data sources

- Advisory text: import `getConditionAdvisory()` from `src/data/conditionAdvisories.ts` (built in Part 1)
- Score adjustments: read from the `PersonalizationDetail` entries in `scoredResult.layer3.personalizations` where `type === 'condition'`
- Zero-out: read from `scoredResult` — check however Part 1 exposes the zeroOut flag

### Styling

- Plain cards with `Colors.card` background, `Colors.cardBorder` border, standard border radius
- Condition name in `fontWeight: '700'`, `Colors.textPrimary`
- Advisory text in `Colors.textSecondary`, standard body size
- Score impact: green text for bonuses, amber/red for penalties
- The entire section gets a header "Health Profile for [Pet Name]" with a medical cross icon (`Ionicons medkit-outline`)
- Bottom disclaimer in `Colors.textTertiary`, italic
- No custom assets, no animations, no expand/collapse interaction — those come from the designer later

### D-095 compliance

- All advisory text comes from `conditionAdvisories.ts` which is already D-095 vetted
- Score impact shown as factual: "−5 pts (fat >12% DMB penalty)" — never "this food is bad"
- Disclaimer always present: "Based on veterinary nutrition guidelines. Discuss therapeutic diets with your veterinarian."

---

## Rules (apply to all changes)

- **RLS** on both new tables — user can only see/edit their own pets' data
- **Offline guards** on all write functions (same pattern as pantry/appointments — check network, throw `PantryOfflineError`-style error if offline)
- **D-095**: no prescriptive language anywhere. "Medications" not "Prescriptions", no "you should take" copy
- **Sync**: `health_conditions TEXT[]` on pets AND `pet_condition_details` rows must stay in sync when conditions are toggled
- **Condition keys**: all condition string keys must exactly match those in `conditionScoring.ts` CONDITION_RULES
- **No scoring changes**: Part 1 is complete and tested. Do not modify `conditionScoring.ts`, `personalization.ts`, or any scoring file.
- **ResultScreen advisory**: build the plain `HealthConditionAdvisories` component and wire it into ResultScreen. Keep it simple — it will be replaced by a designer later. Make it easy to swap out (single component, clean props interface).
- **Tests**: write tests for petService CRUD (condition details + medications), mutual exclusion logic, and sub-type upsert. All existing tests must still pass.
