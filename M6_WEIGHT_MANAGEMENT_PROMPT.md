# M6 Weight Management — D-160, D-161, D-162

> Feed this file to Claude Code. Covers weight goal slider, caloric accumulator, and BCS reference with selectable illustration.
> Use option 2 (manually approve edits) — the auto-deplete cron changes and DER consumer rewiring need eyeballing.

---

## Read These Files First

- `docs/specs/M6_WEIGHT_MANAGEMENT_SPEC.md` (full spec — slider levels, accumulator math, BCS layout)
- `src/components/PortionCard.tsx` (where the slider lives)
- `src/utils/pantryHelpers.ts` (DER functions: `computePetDer()`, `computeAutoServingSize()`, `getSystemRecommendation()`)
- `src/services/portionCalculator.ts` (RER/DER math)
- `src/utils/permissions.ts` (`canUseGoalWeight()` already exists)
- `src/types/pet.ts` (Pet type — check if `weight_goal_level` field exists)
- `src/screens/EditPantryItemScreen.tsx` (uses DER for depletion countdown)
- `src/components/pantry/AddToPantrySheet.tsx` (uses DER for budget-aware serving)
- `supabase/functions/auto-deplete/index.ts` (where accumulator logic goes)
- `src/screens/PetHubScreen.tsx` (where weight estimate banner + BCS link go)
- `src/screens/NotificationPreferencesScreen.tsx` (add weight_estimates toggle)
- `src/utils/constants.ts` (for any new constants)

---

## Phase 1: Weight Goal Slider + DER Integration

### Migration (next sequential number after existing migrations)

```sql
-- Caloric accumulator for estimated weight tracking (D-161)
ALTER TABLE pets ADD COLUMN IF NOT EXISTS caloric_accumulator NUMERIC DEFAULT 0;
ALTER TABLE pets ADD COLUMN IF NOT EXISTS accumulator_last_reset_at TIMESTAMPTZ;
ALTER TABLE pets ADD COLUMN IF NOT EXISTS accumulator_notification_sent BOOLEAN DEFAULT FALSE;

-- BCS self-assessment (D-162)
ALTER TABLE pets ADD COLUMN IF NOT EXISTS bcs_score SMALLINT;
ALTER TABLE pets ADD COLUMN IF NOT EXISTS bcs_assessed_at TIMESTAMPTZ;

-- Weight estimate notification preference
ALTER TABLE user_settings ADD COLUMN IF NOT EXISTS notify_weight_estimates BOOLEAN DEFAULT TRUE;
```

Note: `weight_goal_level SMALLINT DEFAULT 0` should already exist on the `pets` table from M5. If not, add it:
```sql
ALTER TABLE pets ADD COLUMN IF NOT EXISTS weight_goal_level SMALLINT DEFAULT 0 CHECK (weight_goal_level BETWEEN -3 AND 3);
```

### Weight Goal Multipliers

Create or add to an appropriate utils file:

```typescript
export const WEIGHT_GOAL_MULTIPLIERS: Record<number, number> = {
  [-3]: 0.80,
  [-2]: 0.90,
  [-1]: 0.95,
  [0]:  1.00,
  [1]:  1.05,
  [2]:  1.10,
  [3]:  1.20,
};
```

### `getAdjustedDER(pet)` helper

```typescript
function getAdjustedDER(pet: Pet): number {
  const baseDER = computePetDer(pet); // existing function
  const multiplier = WEIGHT_GOAL_MULTIPLIERS[pet.weight_goal_level ?? 0];
  return Math.round(baseDER * multiplier);
}
```

### `getAvailableLevels(pet)` helper

```typescript
function getAvailableLevels(pet: Pet): number[] {
  const all = [-3, -2, -1, 0, 1, 2, 3];
  const blocked = new Set<number>();

  // Species constraint — cats can't do -3 (hepatic lipidosis risk)
  if (pet.species === 'cat') {
    blocked.add(-3);
  }

  // Health condition constraints
  const conditions = pet.health_conditions || [];
  const isOverweight = conditions.some(c => /obesity|overweight|obese/i.test(c));
  const isUnderweight = conditions.some(c => /underweight|undernourished/i.test(c));

  if (isOverweight) {
    blocked.add(1); blocked.add(2); blocked.add(3);
  }
  if (isUnderweight) {
    blocked.add(-1); blocked.add(-2); blocked.add(-3);
  }

  return all.filter(level => !blocked.has(level));
}
```

### `estimatedWeeklyChange(pet)` helper

```typescript
function estimatedWeeklyChange(pet: Pet): { lbs: number; direction: 'loss' | 'gain' | 'maintain' } {
  const baseDER = computePetDer(pet);
  const adjustedDER = getAdjustedDER(pet);
  const dailyDelta = adjustedDER - baseDER;

  if (dailyDelta === 0) return { lbs: 0, direction: 'maintain' };

  const threshold = pet.species === 'cat' ? 3000 : 3150; // kcal per lb mixed-tissue
  const weeklyDelta = dailyDelta * 7;
  const weeklyLbs = Math.abs(weeklyDelta / threshold);

  return {
    lbs: Math.round(weeklyLbs * 10) / 10,
    direction: dailyDelta < 0 ? 'loss' : 'gain',
  };
}
```

### Slider UI on PortionCard

Add a 7-position discrete slider to PortionCard (both on ResultScreen and EditPantryItemScreen):

- **7 detents** — each tap snaps to a position, no continuous sliding
- **Cat profiles**: render 6 positions (-2 to +3), -3 physically absent
- **Blocked positions**: rendered but grayed out. On tap show tooltip: "Not available — [Pet Name] is marked as [condition] in their health profile."
- **Active position** highlighted with label below: "Significant loss", "Moderate loss", "Gradual loss", "Maintain", "Gradual gain", "Moderate gain", "Significant gain"
- **Live calorie context** updates as user moves:
  - "~[X] kcal/day ([Y]% below/above maintenance)"
  - If loss: "Safe loss rate: ~[Z] lbs/week"
  - If gain: "Expected gain rate: ~[Z] lbs/week"
- **Premium gate**: free users see slider locked at 0 with "Premium" badge. Tapping any non-zero position triggers paywall via `canUseGoalWeight()`.
- **D-095 compliant**: "estimated daily intake target" — never "prescribed", "recommended diet"

### Wire `getAdjustedDER()` into all DER consumers

Every place that currently uses `computePetDer()` or base DER needs to use `getAdjustedDER()` instead:

| Consumer | File | Change |
|---|---|---|
| `computeAutoServingSize()` | `src/utils/pantryHelpers.ts` | Use `getAdjustedDER()` |
| `getSystemRecommendation()` | `src/utils/pantryHelpers.ts` | Use adjusted DER |
| PortionCard display | `src/components/PortionCard.tsx` | Show adjusted DER + context line |
| Pantry depletion countdown | `src/screens/EditPantryItemScreen.tsx` | Based on adjusted DER |
| Calorie budget warnings | `src/components/pantry/AddToPantrySheet.tsx` | Compare to adjusted DER |
| Budget-aware auto-serving | `src/utils/pantryHelpers.ts` | Use adjusted DER |

### Persistence

When user moves the slider, save `weight_goal_level` to the `pets` table via petService. Also set `health_reviewed_at = now()` to trigger score cache invalidation (changing the weight goal affects portion recommendations which affects pantry budget warnings).

### Auto-reset on condition conflict

When a health condition is added that conflicts with the current slider position (e.g., add "obesity" while slider is at +2), auto-reset `weight_goal_level` to 0 and show toast: "[Pet Name]'s weight goal was reset to Maintain because they're marked as overweight." This should be checked in the HealthConditionsScreen save handler. If Part 2 already wired this, verify it works with the real slider.

**Pause: verify slider renders on PortionCard, blocked positions work, DER consumers use adjusted values, premium gate works. Run tests.**

---

## Phase 2: Caloric Accumulator in Auto-Deplete Cron

### Logic in `supabase/functions/auto-deplete/index.ts`

After the existing daily depletion loop computes what each pet ate, add:

```typescript
// 1. Sum actual daily intake across all assigned pantry items for this pet
const actualIntake = petPantryItems.reduce((sum, item) => {
  return sum + (item.serving_size_kcal * item.feedings_per_day);
}, 0);

// 2. Skip if no pantry items (actualIntake = 0 is meaningless)
if (actualIntake === 0) continue; // skip accumulator for this pet

// 3. Get adjusted DER (includes weight_goal_level)
const adjustedDER = getAdjustedDER(pet);

// 4. Daily delta
const dailyDelta = actualIntake - adjustedDER;

// 5. Update accumulator
const newAccumulator = (pet.caloric_accumulator || 0) + dailyDelta;

// 6. Check threshold crossing
const threshold = pet.species === 'cat' ? 3000 : 3150;
const lbsChanged = Math.floor(Math.abs(newAccumulator) / threshold);

if (lbsChanged >= 1 && !pet.accumulator_notification_sent) {
  const direction = newAccumulator > 0 ? 'gained' : 'lost';

  // Send push notification (respect user notification preferences)
  // Check user_settings.notify_weight_estimates before sending
  await sendWeightEstimateNotification(pet, lbsChanged, direction);

  // Set flag to prevent daily spam
  await supabase.from('pets').update({
    caloric_accumulator: newAccumulator,
    accumulator_notification_sent: true,
  }).eq('id', pet.id);
} else {
  // Update accumulator only
  await supabase.from('pets').update({
    caloric_accumulator: newAccumulator,
  }).eq('id', pet.id);
}
```

### Notification copy

- Title: `"${pet.name}'s weight update"`
- Body: `"Based on feeding data, ${pet.name} may have ${direction} about ${lbsChanged} lb. Tap to update."`
- Data payload: `{ type: 'weight_estimate', pet_id: pet.id, estimated_change_lbs: direction === 'gained' ? lbsChanged : -lbsChanged }`

### DER in the cron

The auto-deplete cron runs server-side (Deno). It needs `getAdjustedDER()`. Either:
- Import the shared helper (if the function structure allows), OR
- Inline the same math: `baseDER * WEIGHT_GOAL_MULTIPLIERS[pet.weight_goal_level ?? 0]`

The cron already fetches pet data — just ensure `weight_goal_level` is included in the SELECT.

### Accumulator reset conditions

All three options reset the accumulator to 0:
1. User confirms estimated weight → `weight_current_lbs += change`, `accumulator = 0`, `notification_sent = false`
2. User enters actual weight → `weight_current_lbs = input`, `accumulator = 0`, `notification_sent = false`
3. User dismisses → `accumulator = 0`, `notification_sent = false`
4. Manual weight update on pet profile → `accumulator = 0`, `notification_sent = false`

Also: reset `accumulator_notification_sent` after 7 days even if user hasn't responded (so it can re-notify if drift continues).

**Pause: verify accumulator logic in cron, notification fires correctly, reset conditions work. Run tests.**

---

## Phase 3: Weight Estimate Prompt UI

### `src/components/WeightEstimateSheet.tsx` (NEW)

Bottom sheet that appears when:
- User taps the weight estimate push notification (route to pet profile → auto-open)
- In-app banner on PetHubScreen when `accumulator_notification_sent = true`

### Layout

```
┌─────────────────────────────────────────┐
│  Weight Estimate for [Pet Name]         │
│                                         │
│  Based on [X] days of feeding data,     │
│  [Pet Name] may have [gained/lost]      │
│  about [N] lb.                          │
│                                         │
│  Current weight: [X] lbs                │
│  Estimated weight: ~[Y] lbs             │
│                                         │
│  ┌─────────────────────────────────┐    │
│  │  Update to [Y] lbs              │    │  ← primary action
│  └─────────────────────────────────┘    │
│                                         │
│  ┌─────────────────────────────────┐    │
│  │  Enter actual weight             │    │  ← opens weight input
│  └─────────────────────────────────┘    │
│                                         │
│  ┌─────────────────────────────────┐    │
│  │  Dismiss                         │    │  ← resets accumulator only
│  └─────────────────────────────────┘    │
│                                         │
│  This is an estimate based on tracked   │
│  feeding. For accurate weight, use a    │
│  pet scale or ask your vet.             │
└─────────────────────────────────────────┘
```

### Three actions

1. **"Update to [Y] lbs"** — `weight_current_lbs += change`, `weight_updated_at = now()`, reset accumulator + flag
2. **"Enter actual weight"** — show inline text input (decimal-pad keyboard), save entered value as `weight_current_lbs`, reset accumulator + flag
3. **"Dismiss"** — reset accumulator + flag only

### D-095 compliance

- "may have gained" — never "has gained"
- "estimate based on tracked feeding" — never "accurate weight change"
- Disclaimer always present: "For accurate weight, use a pet scale or ask your vet."

### PetHubScreen banner

When `pet.accumulator_notification_sent === true`, show a subtle banner at the top of PetHubScreen:
- "[Pet Name] may have [gained/lost] about [N] lb based on feeding data."
- Tap opens WeightEstimateSheet

### D-117 stale weight guard interaction

If the accumulator is active (caloric_accumulator != 0), suppress the existing 6-month stale weight nag. The system is already tracking — the nag is redundant.

**Pause: verify sheet renders, all 3 actions update correctly, banner shows on PetHub. Run tests.**

---

## Phase 4: BCS Reference Screen with Selectable Illustration

### `src/screens/BCSReferenceScreen.tsx` (NEW)

Educational body condition score panel with the ability for the user to select their pet's current BCS.

### Layout

```
┌─────────────────────────────────────────┐
│  ← Back    Body Condition Guide         │
│                                         │
│  [Dog]  |  [Cat]                        │  ← species tab, default = pet's species
│                                         │
│  Tap the body condition that best       │
│  matches [Pet Name]:                    │
│                                         │
│  ┌─────────────────────────────────┐    │
│  │  [BCS 1 placeholder]            │    │
│  │  Emaciated                      │    │
│  │  Ribs, spine, hip bones easily  │    │
│  │  visible. No body fat. Severe   │    │
│  │  muscle wasting.                │    │
│  └─────────────────────────────────┘    │
│                                         │
│  ┌─────────────────────────────────┐    │
│  │  [BCS 4-5 placeholder]  ✓ IDEAL │    │  ← green accent on 4-5
│  │  Ideal                          │    │
│  │  Ribs easily felt with slight   │    │
│  │  fat covering. Visible waist    │    │
│  │  from above. Abdominal tuck.    │    │
│  └─────────────────────────────────┘    │
│                                         │
│  ... (all 9 scores)                    │
│                                         │
│  ┌─────────────────────────────────┐    │
│  │  🐱 Note for cat owners:        │    │  ← cats only
│  │  The "primordial pouch" — a     │    │
│  │  loose belly flap — is normal   │    │
│  │  in many cats and is NOT a      │    │
│  │  sign of obesity.               │    │
│  └─────────────────────────────────┘    │
│                                         │
│  The 10% Rule: Each BCS point above    │
│  ideal ≈ 10% overweight.               │
│                                         │
│  Sources: AAHA 2021, WSAVA Global      │
│  Nutrition Guidelines                   │
└─────────────────────────────────────────┘
```

### Selectable behavior

- Each BCS card (1-9) is tappable
- When the user taps a BCS card, it gets a cyan/accent highlight border
- A confirmation bar appears at the bottom: "Set [Pet Name]'s body condition to BCS [X] — [Label]?" with "Save" and "Cancel" buttons
- On save: update `pets.bcs_score = X`, `pets.bcs_assessed_at = now()` via petService
- If the pet already has a BCS saved, that card is pre-selected on screen load
- The selection is owner-reported, NOT diagnostic — the screen makes no recommendations based on the selection

### Placeholder illustrations

For each BCS level, use a simple placeholder. Options:
- Colored silhouette (thin → normal → round) using a basic SVG or icon
- Or just a numbered circle with the BCS label and description text
- These get replaced with real illustrations later — keep the component structure clean for easy swap

Group the 9 BCS levels into visual sections:
- BCS 1-3: Underweight (thin silhouette placeholder)
- BCS 4-5: Ideal (normal silhouette placeholder, green accent)
- BCS 6-7: Overweight (round silhouette placeholder)
- BCS 8-9: Obese (very round silhouette placeholder)

### Cat primordial pouch callout

Only visible when species tab is "Cat". Styled as an info card — not a warning, not alarming.

### Entry points

1. **PortionCard** → "What's my pet's body condition?" link (next to weight goal slider)
2. **PetHubScreen** → weight section → "Body Condition Guide" link
3. **WeightEstimateSheet** → "Learn more" link

### Navigation

Add `BCSReference` route to navigation types. Wire from PortionCard, PetHubScreen, and WeightEstimateSheet.

### NOT diagnostic (D-095)

The BCS screen does NOT:
- Suggest a weight goal level based on the selection
- Use language like "your pet is overweight"
- Feed the BCS selection into scoring or DER calculations

It IS:
- Educational reference that helps owners make informed slider decisions
- Owner-reported assessment stored on pet profile for vet report display
- Framed as "a pet at BCS 7 is approximately 20% above ideal" — third person, not "your pet"

### No paywall

BCS reference is free for all users. Educational content that builds trust.

**Pause: verify BCS screen renders, selection saves to pet profile, entry points navigate correctly, cat pouch callout appears. Run tests.**

---

## Phase 5: Notification Preferences + Final Checks

### NotificationPreferencesScreen

Add `notify_weight_estimates` toggle to the existing notification preferences screen:
- Label: "Weight Estimates"
- Description: "Get notified when feeding data suggests a weight change"
- Default: ON
- Reads/writes `user_settings.notify_weight_estimates`
- The auto-deplete cron must check this preference before sending weight estimate notifications

### D-117 stale weight guard

Verify: if `caloric_accumulator != 0` (accumulator is active/tracking), suppress the 6-month stale weight nag. The accumulator replaces the dumb timer with intelligent data-driven tracking.

### Manual weight update reset

Verify: when the user manually edits `weight_current_lbs` on the pet profile (not via WeightEstimateSheet), also reset `caloric_accumulator = 0`, `accumulator_notification_sent = false`, `accumulator_last_reset_at = now()`. The estimate cycle starts fresh from the new known weight.

### Final verification

- `npx jest` — all tests pass, report count
- Regression anchors: Pure Balance = 62, Temptations = 9
- No scoring files modified
- Slider renders correctly for dogs (7 positions) and cats (6 positions, -3 hidden)
- Blocked positions match pet health conditions
- BCS selection saves and pre-loads correctly

---

## Files Expected

### New files
| File | Purpose |
|---|---|
| Migration (next number) | accumulator columns + BCS columns + weight notification pref |
| `src/components/WeightEstimateSheet.tsx` | Bottom sheet for weight estimate confirm/enter/dismiss |
| `src/screens/BCSReferenceScreen.tsx` | Educational BCS guide with selectable illustration |

### Modified files
| File | Change |
|---|---|
| `src/components/PortionCard.tsx` | Add weight goal slider + adjusted DER display |
| `src/utils/pantryHelpers.ts` | Add `getAdjustedDER()`, `getAvailableLevels()`, `estimatedWeeklyChange()`, wire into DER consumers |
| `src/screens/EditPantryItemScreen.tsx` | Use adjusted DER for depletion |
| `src/components/pantry/AddToPantrySheet.tsx` | Use adjusted DER for budget |
| `supabase/functions/auto-deplete/index.ts` | Add accumulator computation + threshold notification |
| `src/screens/PetHubScreen.tsx` | Add weight estimate banner + BCS link |
| `src/screens/NotificationPreferencesScreen.tsx` | Add weight_estimates toggle |
| `src/types/pet.ts` | Ensure BCS fields on Pet type |
| `src/types/navigation.ts` | Add BCSReference route |

### NOT touched
- `conditionScoring.ts`, `personalization.ts`, `nutritionalProfile.ts`, `engine.ts`, `pipeline.ts` — no scoring changes
- `HealthConditionAdvisories.tsx` — no changes to condition UI

---

## Rules

- **D-095 compliance**: "estimated", "may have", "approximate" — never definitive weight claims
- **D-062 cat safety**: -3 slider position physically absent for cats (hepatic lipidosis guard is structural)
- **Paywall**: weight goal slider is premium-only via `canUseGoalWeight()`. BCS reference is free.
- **Species-specific thresholds**: dogs = 3,150 kcal/lb, cats = 3,000 kcal/lb for accumulator
- **Accumulator resets on**: user confirms estimate, user enters actual weight, user dismisses, manual weight edit on profile
- **BCS is educational only**: no DER impact, no scoring impact, no auto-suggestions
- **BCS selection saves**: `bcs_score` and `bcs_assessed_at` on pets table — displayed on future vet report
