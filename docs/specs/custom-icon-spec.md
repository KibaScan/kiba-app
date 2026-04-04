# Kiba Custom Icon Spec — Complete Inventory

> **Total icons:** 43 completed (8 category v2 + 35 v1 awaiting re-gen), 5 pending
> **Style:** Single-color cyan (#00B4D8), PNG with alpha transparency, 1024×1024
> **Stroke weight:** Bold 2px (v2) — matches system icons (Home, Search, Filter). V1 thin-stroke icons to be re-generated.
> **Source:** Google Labs → JPEG → checkerboard-stripped → PNG via saturation threshold

---

## Icon Versions

### V2 (Bold Stroke) — Current Standard
- **Categories:** 4 outline + 4 filled = 8 icons ✅ Done
- **All other groups:** Need re-generation with bold 2px stroke prompt

### V1 (Thin Stroke) — Deprecated, Awaiting Re-gen
- Concerns (6), Advisories (7), Conditions (14), Forms (5), Treat-forms (3), Supplement-forms (1)
- These still work but visually don't match system icon weight
- Re-generate using v2 bold prompt suffix when ready

---

## File Structure

```
assets/
  icons/
    concerns/                     # ResultScreen concern tags (6) — V1, needs re-gen
      heart-risk.png              # Heart + pulse line
      synthetic-additive.png      # Flask + molecule
      artificial-color.png        # Dropper + drops
      unnamed-source.png          # Drumstick + question mark
      added-sugar.png             # Sugar cube + plus
      label-mismatch.png          # Tag + X

    advisories/                   # ResultScreen advisory cards (7) — V1, needs re-gen
      dcm-advisory.png            # Heart + broken chain
      nursing-advisory.png        # Baby bottle + paw
      flavor-deception.png        # Tag + opposing arrows
      ingredient-splitting.png    # Pie chart splitting
      breed-alert.png             # Dog + cat + exclamation
      supplemental-note.png       # Bowl + plus
      allergen-warning.png        # Circle + crossed wheat

    conditions/                   # Health condition advisories on ResultScreen (14) — V1, needs re-gen
      joint-issues.png            # Bone + pain indicator
      sensitive-stomach.png       # Stomach + exclamation
      overweight.png              # Scale + up arrow
      underweight.png             # Scale + down arrow
      diabetes.png                # Blood drop + molecule
      kidney-disease.png          # Kidney + X
      urinary-issues.png          # Bladder + droplet
      heart-disease.png           # Heart + X
      pancreatitis.png            # Pancreas + flame
      skin-coat-issues.png        # Paw + radiating lines
      hypothyroidism.png          # Thyroid butterfly + down arrow
      liver-disease.png           # Liver + warning triangle
      seizures-epilepsy.png       # Brain + lightning
      no-known-conditions.png     # Circle + checkmark

    categories/                   # Search main categories (4 outline + 4 filled) — V2 ✅
      daily-food.png              # Pet food bowl + kibble (outline)
      daily-food-filled.png       # Pet food bowl + kibble (solid silhouette)
      toppers-mixers.png          # Spoon pouring drops over bowl (outline)
      toppers-mixers-filled.png   # Spoon pouring drops over bowl (solid silhouette)
      treats.png                  # Jar + paw + treats/bones/fish (outline)
      treats-filled.png           # Jar + paw + treats/bones/fish (solid silhouette)
      supplements.png             # Pill capsule + plus (outline)
      supplements-filled.png      # Pill capsule + plus (solid silhouette)

    forms/                        # Daily Food & Toppers sub-filters (5) — V1, needs re-gen
      dry.png                     # Kibble bag
      wet.png                     # Opened tin can + pull tab
      freeze-dried.png            # Snowflake + cube
      vet-diet.png                # Stethoscope + bowl
      other.png                   # Milk carton

    treat-forms/                  # Treats sub-filters (3 + freeze-dried reuse) — V1, needs re-gen
      crunchy-biscuits.png        # Cracked cookie circle
      lickables-purees.png        # Churu sachet torn open + drops
      dental.png                  # Tooth + sparkle
      # freeze-dried → reuse forms/freeze-dried.png

    supplement-forms/             # Supplements sub-filters (1 done, 4 pending) — V1, needs re-gen
      digestive.png               # Stomach + checkmark (benefit framing)
      # PENDING: joint-hip.png    — bone + shield checkmark
      # PENDING: skin-coat.png    — paw + heart
      # PENDING: calming.png      — crescent moon + leaf
      # PENDING: jerky-chews.png  — twisted stick (in treat-forms/)
```

---

## Filled Variants (Line-to-Solid Transition)

Filled variants exist **only for category icons** on the SearchScreen. When a category card is selected (active), the outline icon swaps to the filled version for a tactile "pressed" feel.

**How it works:**
- Outline icon = inactive state (hollow line-art)
- Filled icon = active state (solid silhouette with white/transparent cutouts for inner details)
- `tintColor` in React Native overrides the cyan at runtime (e.g., Treats → orange when active)

**Why only categories:** Concern tags, advisories, conditions, and sub-filter chips don't have a toggle state that warrants the visual weight shift. Outline-only with `tintColor` overrides is sufficient.

---

## Export Rules

- **Format:** PNG with alpha transparency (no JPEG — checkerboard bakes in)
- **Canvas:** Square, 1024×1024 from Google Labs
- **Color:** Single-color `#00B4D8` cyan. `tintColor` in React Native overrides at runtime.
- **Naming:** lowercase kebab-case. Filled variants append `-filled` suffix.
- **Conversion:** If Google Labs exports JPEG, run through saturation-based checkerboard stripper (script in project)

---

## Pending Icons (5)

Generate using v2 bold prompt suffix. Outline only (no filled variants needed for sub-filters).

| Icon | Folder | Prompt subject | Framing |
|---|---|---|---|
| Joint & Hip | `supplement-forms/` | Bone with shield checkmark | Benefit (not ailment) |
| Skin & Coat | `supplement-forms/` | Paw with small heart | Benefit (not ailment) |
| Calming | `supplement-forms/` | Crescent moon with leaf | Benefit |
| Digestive | `supplement-forms/` | Done — stomach + checkmark | Benefit |
| Jerky & Chews | `treat-forms/` | Twisted stick chew | Picked but not exported |

---

## Re-generation Queue (35 V1 → V2)

All V1 thin-stroke icons need re-generation with the bold 2px prompt. Outline only (no filled variants). Regenerate in batches by group:

| Group | Count | Priority |
|---|---|---|
| Concerns | 6 | High — visible on ResultScreen |
| Advisories | 7 | High — visible on ResultScreen |
| Conditions | 14 | Medium — only shown when pet has matching condition |
| Forms | 5 | Medium — search sub-filters |
| Treat-forms | 3 | Medium — search sub-filters |
| Supplement-forms | 1 (+ 4 pending) | Low — generate pending icons fresh with v2 prompt |

---

## TypeScript Icon Maps

### `src/constants/iconMaps.ts`

```typescript
import { ImageSourcePropType } from 'react-native';

// ─── Concern Tag Icons (ResultScreen) ────────────────────
export const CONCERN_TAG_ICONS: Record<string, ImageSourcePropType> = {
  heart_risk: require('../../assets/icons/concerns/heart-risk.png'),
  synthetic_additive: require('../../assets/icons/concerns/synthetic-additive.png'),
  artificial_color: require('../../assets/icons/concerns/artificial-color.png'),
  unnamed_source: require('../../assets/icons/concerns/unnamed-source.png'),
  added_sugar: require('../../assets/icons/concerns/added-sugar.png'),
  label_mismatch: require('../../assets/icons/concerns/label-mismatch.png'),
} as const;

// ─── Advisory Card Icons (ResultScreen) ──────────────────
export const ADVISORY_ICONS: Record<string, ImageSourcePropType> = {
  dcm_advisory: require('../../assets/icons/advisories/dcm-advisory.png'),
  nursing_advisory: require('../../assets/icons/advisories/nursing-advisory.png'),
  flavor_deception: require('../../assets/icons/advisories/flavor-deception.png'),
  ingredient_splitting: require('../../assets/icons/advisories/ingredient-splitting.png'),
  breed_alert: require('../../assets/icons/advisories/breed-alert.png'),
  supplemental_note: require('../../assets/icons/advisories/supplemental-note.png'),
  allergen_warning: require('../../assets/icons/advisories/allergen-warning.png'),
} as const;

// ─── Health Condition Icons (ResultScreen advisories) ────
export const CONDITION_ICONS: Record<string, ImageSourcePropType> = {
  joint_issues: require('../../assets/icons/conditions/joint-issues.png'),
  sensitive_stomach: require('../../assets/icons/conditions/sensitive-stomach.png'),
  overweight: require('../../assets/icons/conditions/overweight.png'),
  underweight: require('../../assets/icons/conditions/underweight.png'),
  diabetes: require('../../assets/icons/conditions/diabetes.png'),
  kidney_disease: require('../../assets/icons/conditions/kidney-disease.png'),
  urinary_issues: require('../../assets/icons/conditions/urinary-issues.png'),
  heart_disease: require('../../assets/icons/conditions/heart-disease.png'),
  pancreatitis: require('../../assets/icons/conditions/pancreatitis.png'),
  skin_coat_issues: require('../../assets/icons/conditions/skin-coat-issues.png'),
  hypothyroidism: require('../../assets/icons/conditions/hypothyroidism.png'),
  liver_disease: require('../../assets/icons/conditions/liver-disease.png'),
  seizures_epilepsy: require('../../assets/icons/conditions/seizures-epilepsy.png'),
  no_known_conditions: require('../../assets/icons/conditions/no-known-conditions.png'),
} as const;

// ─── Category Icons (Search main categories) ────────────
// Outline = inactive, Filled = active (line-to-solid transition)
export const CATEGORY_ICONS: Record<string, ImageSourcePropType> = {
  daily_food: require('../../assets/icons/categories/daily-food.png'),
  toppers_mixers: require('../../assets/icons/categories/toppers-mixers.png'),
  treats: require('../../assets/icons/categories/treats.png'),
  supplements: require('../../assets/icons/categories/supplements.png'),
} as const;

export const CATEGORY_ICONS_FILLED: Record<string, ImageSourcePropType> = {
  daily_food: require('../../assets/icons/categories/daily-food-filled.png'),
  toppers_mixers: require('../../assets/icons/categories/toppers-mixers-filled.png'),
  treats: require('../../assets/icons/categories/treats-filled.png'),
  supplements: require('../../assets/icons/categories/supplements-filled.png'),
} as const;

// ─── Form Icons (Daily Food & Toppers sub-filters) ──────
export const FORM_ICONS: Record<string, ImageSourcePropType> = {
  dry: require('../../assets/icons/forms/dry.png'),
  wet: require('../../assets/icons/forms/wet.png'),
  freeze_dried: require('../../assets/icons/forms/freeze-dried.png'),
  vet_diet: require('../../assets/icons/forms/vet-diet.png'),
  other: require('../../assets/icons/forms/other.png'),
} as const;

// ─── Treat Form Icons (Treats sub-filters) ──────────────
export const TREAT_FORM_ICONS: Record<string, ImageSourcePropType> = {
  crunchy_biscuits: require('../../assets/icons/treat-forms/crunchy-biscuits.png'),
  freeze_dried: require('../../assets/icons/forms/freeze-dried.png'), // reuse
  lickables_purees: require('../../assets/icons/treat-forms/lickables-purees.png'),
  dental: require('../../assets/icons/treat-forms/dental.png'),
  // jerky_chews: require('../../assets/icons/treat-forms/jerky-chews.png'), // PENDING
} as const;

// ─── Supplement Form Icons (Supplements sub-filters) ────
export const SUPPLEMENT_FORM_ICONS: Record<string, ImageSourcePropType> = {
  digestive: require('../../assets/icons/supplement-forms/digestive.png'),
  // joint_hip: require('../../assets/icons/supplement-forms/joint-hip.png'),       // PENDING
  // skin_coat: require('../../assets/icons/supplement-forms/skin-coat.png'),       // PENDING
  // calming: require('../../assets/icons/supplement-forms/calming.png'),           // PENDING
} as const;

// ─── Type-safe key types ─────────────────────────────────
export type ConcernTagKey = keyof typeof CONCERN_TAG_ICONS;
export type AdvisoryKey = keyof typeof ADVISORY_ICONS;
export type ConditionKey = keyof typeof CONDITION_ICONS;
export type CategoryKey = keyof typeof CATEGORY_ICONS;
export type FormKey = keyof typeof FORM_ICONS;
export type TreatFormKey = keyof typeof TREAT_FORM_ICONS;
export type SupplementFormKey = keyof typeof SUPPLEMENT_FORM_ICONS;
```

---

## Platter Component

### `src/components/ui/IconPlatter.tsx`

```typescript
import React from 'react';
import { View, Image, ImageSourcePropType, StyleSheet } from 'react-native';
import { Colors } from '../../utils/constants';

interface IconPlatterProps {
  icon: ImageSourcePropType;
  /** Platter diameter. Default: 32 */
  size?: number;
  /** Icon size inside platter. Default: 18 */
  iconSize?: number;
  /** Override tint color. Default: Colors.accent */
  tintColor?: string;
  /** Override platter background. Default: Colors.background */
  backgroundColor?: string;
}

export const IconPlatter: React.FC<IconPlatterProps> = ({
  icon,
  size = 32,
  iconSize = 18,
  tintColor = Colors.accent,
  backgroundColor = Colors.background,
}) => (
  <View
    style={[
      styles.platter,
      {
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor,
      },
    ]}
  >
    <Image
      source={icon}
      style={{
        width: iconSize,
        height: iconSize,
        tintColor,
      }}
      resizeMode="contain"
    />
  </View>
);

const styles = StyleSheet.create({
  platter: {
    justifyContent: 'center',
    alignItems: 'center',
  },
});
```

---

## Usage by Screen

### ResultScreen — Concern Tags (ConcernTags.tsx)

```typescript
import { IconPlatter } from '../ui/IconPlatter';
import { CONCERN_TAG_ICONS, ConcernTagKey } from '../../constants/iconMaps';

<View style={styles.tagRow}>
  <IconPlatter icon={CONCERN_TAG_ICONS[tag.key as ConcernTagKey]} />
  <Text style={styles.tagLabel}>{tag.label}</Text>
</View>
```

### ResultScreen — Advisory Cards (DcmAdvisoryCard.tsx, etc.)

```typescript
import { IconPlatter } from '../ui/IconPlatter';
import { ADVISORY_ICONS } from '../../constants/iconMaps';

<View style={styles.cardHeader}>
  <IconPlatter
    icon={ADVISORY_ICONS.dcm_advisory}
    size={36}
    iconSize={20}
    tintColor={Colors.severityAmber}
  />
  <Text style={styles.cardTitle}>DCM Advisory</Text>
</View>
```

### ResultScreen — Health Condition Advisories (HealthConditionAdvisories.tsx)

```typescript
import { IconPlatter } from '../ui/IconPlatter';
import { CONDITION_ICONS, ConditionKey } from '../../constants/iconMaps';

<View style={styles.advisoryHeader}>
  <IconPlatter
    icon={CONDITION_ICONS[condition.key as ConditionKey]}
    size={36}
    iconSize={20}
  />
  <View style={styles.advisoryText}>
    <Text style={styles.advisoryTitle}>{condition.label}</Text>
    <Text style={styles.advisoryBody}>{advisory.message}</Text>
  </View>
</View>
```

### SearchScreen — Category Cards with Line-to-Solid Transition

```typescript
import { IconPlatter } from '../ui/IconPlatter';
import {
  CATEGORY_ICONS,
  CATEGORY_ICONS_FILLED,
  CategoryKey,
} from '../../constants/iconMaps';

const iconSource = isActive
  ? CATEGORY_ICONS_FILLED[category.key as CategoryKey]
  : CATEGORY_ICONS[category.key as CategoryKey];

<View style={styles.categoryRow}>
  <IconPlatter
    icon={iconSource}
    size={40}
    iconSize={22}
    tintColor={isActive ? Colors.activeCategory : Colors.accent}
  />
  <Text style={styles.categoryLabel}>{category.label}</Text>
</View>
```

### SearchScreen — Sub-Filter Chips

```typescript
import { FORM_ICONS, FormKey } from '../../constants/iconMaps';

// Inside a filter chip — no platter, just tinted icon
<Image
  source={FORM_ICONS[form.key as FormKey]}
  style={{
    width: 16,
    height: 16,
    tintColor: isActive ? Colors.accent : Colors.textSecondary,
  }}
  resizeMode="contain"
/>
```

### SearchScreen — Product Row Thumbnail Fallback

When `image_url` is null, use the form icon as a placeholder:

```typescript
import { FORM_ICONS, FormKey } from '../../constants/iconMaps';
import { CATEGORY_ICONS } from '../../constants/iconMaps';

const getProductFallbackIcon = (productForm: string | null) => {
  if (productForm && productForm in FORM_ICONS) {
    return FORM_ICONS[productForm as FormKey];
  }
  return CATEGORY_ICONS.daily_food; // generic fallback
};

// In ProductRow
{product.image_url ? (
  <Image source={{ uri: product.image_url }} style={styles.thumbnail} />
) : (
  <View style={styles.thumbnailPlaceholder}>
    <Image
      source={getProductFallbackIcon(product.product_form)}
      style={{ width: 24, height: 24, tintColor: Colors.textTertiary }}
      resizeMode="contain"
    />
  </View>
)}
```

---

## Design System Alignment

| Context | Platter Size | Icon Size | Background | Tint | Filled Variant |
|---|---|---|---|---|---|
| Concern tag chip | 32×32 | 18px | `Colors.background` | `Colors.accent` | No |
| Advisory card header | 36×36 | 20px | `Colors.background` | Severity-based | No |
| Condition advisory header | 36×36 | 20px | `Colors.background` | `Colors.accent` | No |
| Search category card (inactive) | 40×40 | 22px | `Colors.background` | `Colors.accent` | No (outline) |
| Search category card (active) | 40×40 | 22px | `Colors.background` | `Colors.activeCategory` | **Yes (filled)** |
| Search sub-filter chip | No platter | 16px | N/A | Active: accent / Inactive: textSecondary | No |
| Product thumbnail fallback | No platter | 24px | `Colors.cardSurface` container | `Colors.textTertiary` | No |
| Top Picks list row | 32×32 | 18px | `Colors.background` | `Colors.accent` | No |

### Severity Tint Overrides (Advisory Cards)

```typescript
// Critical (recall, allergen match)
tintColor={Colors.severityRed}      // #EF4444

// Warning (DCM, nursing, breed alert)
tintColor={Colors.severityAmber}    // #F59E0B

// Informational (supplemental note, splitting)
tintColor={Colors.accent}           // #00B4D8 (default)
```

---

## Shared Icons (Cross-Context Reuse)

| Icon | Primary location | Also used by |
|---|---|---|
| `forms/freeze-dried.png` | Daily Food sub-filter | Treats sub-filter, Toppers sub-filter |
| `forms/wet.png` | Daily Food sub-filter | Toppers sub-filter |
| `forms/dry.png` | Daily Food sub-filter | Toppers sub-filter |

These are referenced via `FORM_ICONS` in all contexts — no duplication needed.

**Important:** Condition icons (ailment framing: exclamation, X, warning) are NOT reused for supplement sub-filters (benefit framing: checkmark, heart, shield). Same organs, different visual modifiers.

---

## Fallback Strategy

If a key doesn't match any icon in the map:

```typescript
import { Ionicons } from '@expo/vector-icons';

const getIconWithFallback = (
  key: string,
  iconMap: Record<string, ImageSourcePropType>,
  fallbackIonicon: string = 'ellipsis-horizontal-circle-outline'
) => {
  if (key in iconMap) {
    return <IconPlatter icon={iconMap[key]} />;
  }
  return (
    <View style={styles.platter}>
      <Ionicons name={fallbackIonicon as any} size={18} color={Colors.accent} />
    </View>
  );
};
```

This ensures new categories, conditions, or forms can ship before custom icons are ready.

---

## Icon Generation Reference

### Generation Workflow

1. Generate **outline** with bold stroke prompt in Google Labs
2. Pick the best result (selection criteria below)
3. If filled variant needed: select the chosen outline → instruct Google Labs to fill it in
4. Export both JPEGs
5. Run through checkerboard stripper → PNG

### Prompt Suffixes

**Outline (v2 — current standard):**
```
bold 2px stroke, cyan outline only, no fill, no shading, flat vector, icon style, centered, 128x128, transparent background
```

**Solid fill (instruct on selected outline):**
```
Fill this icon completely as a solid cyan silhouette, keep the inner details as white cutouts, no outlines
```

If generating solid from scratch (no source image):
```
Simple icon, [subject], completely filled solid shape, cyan colored silhouette, no outlines, no strokes, flat vector, icon style, centered, 128x128, transparent background
```

### ~~V1 Prompt (Deprecated — do not use)~~
```
single thin stroke, cyan outline only, no fill, no shading, flat vector, icon style, centered, 128x128, transparent background
```

### Checkerboard Removal

Run `convert_icons.py` (saturation threshold 0.08–0.25, strips gray checkerboard, outputs RGBA PNG).

### Selection Criteria

- **Confident stroke weight** matching system icons (Home, Search, Filter) — no razor-thin lines
- Readable at 18px
- True transparent background
- No filled regions (for outline variants)
- No text or labels
- Outline and filled variants should be recognizably the same icon (use fill-from-selection workflow)
