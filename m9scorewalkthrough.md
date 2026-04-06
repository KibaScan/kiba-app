# ResultScreen UI Overhaul — Walkthrough

## Summary

Executed 9 targeted fixes across 9 files to address expert feedback on the ResultScreen. Zero new TypeScript errors.

---

## Changes Made

### Fix 1: Contrast Collapse — Invisible Text → Readable Silver
| File | Change |
|---|---|
| [IngredientList.tsx](file:///Users/stevendiaz/kiba-antigravity/src/components/ingredients/IngredientList.tsx) | Position numbers `#737373` → `Colors.textSecondary` (#A0A0A0) |
| [IngredientDetailModal.tsx](file:///Users/stevendiaz/kiba-antigravity/src/components/ingredients/IngredientDetailModal.tsx) | Citations header + body `#737373` → `Colors.textSecondary` |
| [AafcoProgressBars.tsx](file:///Users/stevendiaz/kiba-antigravity/src/components/scoring/AafcoProgressBars.tsx) | DMB explainer + standard label `textTertiary` → `textSecondary`; consolidated redundant DMB text into one conditional sentence |

### Fix 2: Kill Tag Soup
```diff:IngredientList.tsx
// IngredientList — Full ingredient list grouped by severity tier (D-031).
// All ingredients visible on scroll, NOT behind a toggle (D-108).
// Each row tappable for singleton modal detail (D-030).
// Ionicons only — zero emoji (D-084). D-095 compliant copy.

import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import type { ProductIngredient, IngredientSeverity } from '../../types/scoring';
import { Colors, FontSizes, Spacing, SEVERITY_COLORS, SEVERITY_DISPLAY_LABELS } from '../../utils/constants';
import { toDisplayName } from '../../utils/formatters';

// ─── Props ──────────────────────────────────────────────

interface FlavorAnnotation {
  primaryProteinName: string;
  namedProtein: string;
}

interface IngredientListProps {
  ingredients: ProductIngredient[];
  species: 'dog' | 'cat';
  onIngredientPress: (ingredient: ProductIngredient) => void;
  flavorAnnotation?: FlavorAnnotation | null;
}

// ─── Helpers ────────────────────────────────────────────

const SEVERITY_ORDER: Record<IngredientSeverity, number> = {
  danger: 0,
  caution: 1,
  neutral: 2,
  good: 3,
};

// SEVERITY_COLORS + SEVERITY_DISPLAY_LABELS imported from constants.ts — single source of truth

function getSeverity(
  ingredient: ProductIngredient,
  species: 'dog' | 'cat',
): IngredientSeverity {
  return species === 'cat'
    ? ingredient.cat_base_severity
    : ingredient.dog_base_severity;
}

function formatName(ingredient: ProductIngredient): string {
  if (ingredient.display_name) return ingredient.display_name;
  return toDisplayName(ingredient.canonical_name);
}

/** Split "Animal Fat (generic, preserved with BHA)" into primary + parenthetical */
function parseName(fullName: string): { primary: string; parenthetical: string | null } {
  const parenIdx = fullName.indexOf('(');
  if (parenIdx < 0) return { primary: fullName, parenthetical: null };
  const primary = fullName.substring(0, parenIdx).trim();
  const closeParen = fullName.lastIndexOf(')');
  const content = closeParen > parenIdx
    ? fullName.substring(parenIdx + 1, closeParen).trim()
    : fullName.substring(parenIdx + 1).trim();
  return { primary, parenthetical: content || null };
}

// ─── Component ──────────────────────────────────────────

export function IngredientList({
  ingredients,
  species,
  onIngredientPress,
  flavorAnnotation,
}: IngredientListProps) {
  // Build ordinal position map: DB position → 1-based ordinal index
  // (DB positions can be non-contiguous, e.g. preservative sub-ingredients at #905)
  const byPosition = [...ingredients].sort((a, b) => a.position - b.position);
  const ordinalMap = new Map<number, number>();
  byPosition.forEach((ing, idx) => ordinalMap.set(ing.position, idx + 1));

  // Sort by severity worst→best, then by position within same severity
  const sorted = [...ingredients].sort((a, b) => {
    const sevA = SEVERITY_ORDER[getSeverity(a, species)];
    const sevB = SEVERITY_ORDER[getSeverity(b, species)];
    if (sevA !== sevB) return sevA - sevB;
    return a.position - b.position;
  });

  // Pre-count per severity for section headers
  const severityCounts = new Map<IngredientSeverity, number>();
  for (const ing of sorted) {
    const sev = getSeverity(ing, species);
    severityCounts.set(sev, (severityCounts.get(sev) ?? 0) + 1);
  }

  // Build elements with section headers between severity groups
  const elements: React.ReactNode[] = [];
  let currentSeverity: IngredientSeverity | null = null;

  for (const ingredient of sorted) {
    const severity = getSeverity(ingredient, species);
    const color = SEVERITY_COLORS[severity];
    const label = SEVERITY_DISPLAY_LABELS[severity];
    const count = severityCounts.get(severity) ?? 0;

    // Insert section header when severity group changes
    if (severity !== currentSeverity) {
      currentSeverity = severity;
      elements.push(
        <View key={`section-${severity}`} style={styles.sectionDivider}>
          <Text style={[styles.sectionDividerLabel, { color }]}>
            {label} {'\u00B7'} {count}
          </Text>
        </View>,
      );
    }

    const fullName = formatName(ingredient);
    const { primary, parenthetical } = parseName(fullName);

    elements.push(
      <TouchableOpacity
        key={`${ingredient.canonical_name}-${ingredient.position}`}
        style={styles.row}
        onPress={() => onIngredientPress(ingredient)}
        activeOpacity={0.7}
      >
        <View style={styles.rowTop}>
          <Text style={styles.positionNumber}>#{ordinalMap.get(ingredient.position) ?? ingredient.position}</Text>
          <View style={styles.nameBlock}>
            <Text style={styles.ingredientName}>{primary}</Text>
            {parenthetical && (
              <Text style={styles.parenthetical} numberOfLines={1}>
                {parenthetical}
              </Text>
            )}
          </View>
          <Text style={[styles.severityLabel, { color }]}>{label}</Text>
        </View>
        {ingredient.definition && (
          <Text style={styles.definition} numberOfLines={1}>
            {ingredient.definition}
          </Text>
        )}
        {flavorAnnotation &&
          fullName.toLowerCase() ===
            flavorAnnotation.primaryProteinName.toLowerCase() && (
          <Text style={styles.flavorAnnotation}>
            Primary protein (product named as {flavorAnnotation.namedProtein})
          </Text>
        )}
      </TouchableOpacity>,
    );
  }

  return (
    <View style={styles.container}>
      {elements}
    </View>
  );
}

// ─── Styles ─────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    marginBottom: Spacing.md,
  },
  sectionHeader: {
    fontSize: FontSizes.lg,
    fontWeight: '700',
    color: Colors.textPrimary,
    marginBottom: Spacing.md,
  },
  sectionDivider: {
    marginTop: 8,
    marginBottom: 6,
  },
  sectionDividerLabel: {
    fontSize: FontSizes.xs,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  row: {
    backgroundColor: Colors.card,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 6,
  },
  rowTop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  positionNumber: {
    fontSize: FontSizes.xs,
    color: '#737373',
    marginRight: 8,
    marginTop: 2,
    minWidth: 20,
  },
  nameBlock: {
    flex: 1,
    marginRight: 8,
  },
  ingredientName: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.textPrimary,
  },
  parenthetical: {
    fontSize: 12,
    color: '#9CA3AF',
    marginTop: 1,
  },
  severityLabel: {
    fontSize: FontSizes.xs,
    fontWeight: '700',
    flexShrink: 0,
  },
  definition: {
    fontSize: FontSizes.sm,
    color: Colors.textSecondary,
    marginTop: 4,
    marginLeft: 28,
  },
  flavorAnnotation: {
    fontSize: FontSizes.xs,
    color: Colors.textTertiary,
    marginTop: 3,
    marginLeft: 28,
    fontStyle: 'italic',
  },
});
===
// IngredientList — Full ingredient list grouped by severity tier (D-031).
// All ingredients visible on scroll, NOT behind a toggle (D-108).
// Each row tappable for singleton modal detail (D-030).
// Ionicons only — zero emoji (D-084). D-095 compliant copy.

import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import type { ProductIngredient, IngredientSeverity } from '../../types/scoring';
import { Colors, FontSizes, Spacing, SEVERITY_COLORS, SEVERITY_DISPLAY_LABELS } from '../../utils/constants';
import { toDisplayName } from '../../utils/formatters';

// ─── Props ──────────────────────────────────────────────

interface FlavorAnnotation {
  primaryProteinName: string;
  namedProtein: string;
}

interface IngredientListProps {
  ingredients: ProductIngredient[];
  species: 'dog' | 'cat';
  onIngredientPress: (ingredient: ProductIngredient) => void;
  flavorAnnotation?: FlavorAnnotation | null;
}

// ─── Helpers ────────────────────────────────────────────

const SEVERITY_ORDER: Record<IngredientSeverity, number> = {
  danger: 0,
  caution: 1,
  neutral: 2,
  good: 3,
};

// SEVERITY_COLORS + SEVERITY_DISPLAY_LABELS imported from constants.ts — single source of truth

function getSeverity(
  ingredient: ProductIngredient,
  species: 'dog' | 'cat',
): IngredientSeverity {
  return species === 'cat'
    ? ingredient.cat_base_severity
    : ingredient.dog_base_severity;
}

function formatName(ingredient: ProductIngredient): string {
  if (ingredient.display_name) return ingredient.display_name;
  return toDisplayName(ingredient.canonical_name);
}

/** Split "Animal Fat (generic, preserved with BHA)" into primary + parenthetical */
function parseName(fullName: string): { primary: string; parenthetical: string | null } {
  const parenIdx = fullName.indexOf('(');
  if (parenIdx < 0) return { primary: fullName, parenthetical: null };
  const primary = fullName.substring(0, parenIdx).trim();
  const closeParen = fullName.lastIndexOf(')');
  const content = closeParen > parenIdx
    ? fullName.substring(parenIdx + 1, closeParen).trim()
    : fullName.substring(parenIdx + 1).trim();
  return { primary, parenthetical: content || null };
}

// ─── Component ──────────────────────────────────────────

export function IngredientList({
  ingredients,
  species,
  onIngredientPress,
  flavorAnnotation,
}: IngredientListProps) {
  // Build ordinal position map: DB position → 1-based ordinal index
  // (DB positions can be non-contiguous, e.g. preservative sub-ingredients at #905)
  const byPosition = [...ingredients].sort((a, b) => a.position - b.position);
  const ordinalMap = new Map<number, number>();
  byPosition.forEach((ing, idx) => ordinalMap.set(ing.position, idx + 1));

  // Sort by severity worst→best, then by position within same severity
  const sorted = [...ingredients].sort((a, b) => {
    const sevA = SEVERITY_ORDER[getSeverity(a, species)];
    const sevB = SEVERITY_ORDER[getSeverity(b, species)];
    if (sevA !== sevB) return sevA - sevB;
    return a.position - b.position;
  });

  // Pre-count per severity for section headers
  const severityCounts = new Map<IngredientSeverity, number>();
  for (const ing of sorted) {
    const sev = getSeverity(ing, species);
    severityCounts.set(sev, (severityCounts.get(sev) ?? 0) + 1);
  }

  // Build elements with section headers between severity groups
  const elements: React.ReactNode[] = [];
  let currentSeverity: IngredientSeverity | null = null;

  for (const ingredient of sorted) {
    const severity = getSeverity(ingredient, species);
    const color = SEVERITY_COLORS[severity];
    const label = SEVERITY_DISPLAY_LABELS[severity];
    const count = severityCounts.get(severity) ?? 0;

    // Insert section header when severity group changes
    if (severity !== currentSeverity) {
      currentSeverity = severity;
      elements.push(
        <View key={`section-${severity}`} style={styles.sectionDivider}>
          <Text style={[styles.sectionDividerLabel, { color }]}>
            {label} {'\u00B7'} {count}
          </Text>
        </View>,
      );
    }

    const fullName = formatName(ingredient);
    const { primary, parenthetical } = parseName(fullName);

    elements.push(
      <TouchableOpacity
        key={`${ingredient.canonical_name}-${ingredient.position}`}
        style={styles.row}
        onPress={() => onIngredientPress(ingredient)}
        activeOpacity={0.7}
      >
        <View style={styles.rowTop}>
          <Text style={styles.positionNumber}>#{ordinalMap.get(ingredient.position) ?? ingredient.position}</Text>
          <View style={styles.nameBlock}>
            <Text style={styles.ingredientName}>{primary}</Text>
            {parenthetical && (
              <Text style={styles.parenthetical} numberOfLines={1}>
                {parenthetical}
              </Text>
            )}
          </View>
        </View>
        {ingredient.definition && (
          <Text style={styles.definition} numberOfLines={1}>
            {ingredient.definition}
          </Text>
        )}
        {flavorAnnotation &&
          fullName.toLowerCase() ===
            flavorAnnotation.primaryProteinName.toLowerCase() && (
          <Text style={styles.flavorAnnotation}>
            Primary protein (product named as {flavorAnnotation.namedProtein})
          </Text>
        )}
      </TouchableOpacity>,
    );
  }

  return (
    <View style={styles.container}>
      {elements}
    </View>
  );
}

// ─── Styles ─────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    marginBottom: Spacing.md,
  },
  sectionHeader: {
    fontSize: FontSizes.lg,
    fontWeight: '700',
    color: Colors.textPrimary,
    marginBottom: Spacing.md,
  },
  sectionDivider: {
    marginTop: 8,
    marginBottom: 6,
  },
  sectionDividerLabel: {
    fontSize: FontSizes.xs,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  row: {
    backgroundColor: Colors.card,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 6,
  },
  rowTop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  positionNumber: {
    fontSize: FontSizes.xs,
    color: Colors.textSecondary,
    marginRight: 8,
    marginTop: 2,
    minWidth: 20,
  },
  nameBlock: {
    flex: 1,
    marginRight: 8,
  },
  ingredientName: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.textPrimary,
  },
  parenthetical: {
    fontSize: 12,
    color: '#9CA3AF',
    marginTop: 1,
  },

  definition: {
    fontSize: FontSizes.sm,
    color: Colors.textSecondary,
    marginTop: 4,
    marginLeft: 28,
  },
  flavorAnnotation: {
    fontSize: FontSizes.xs,
    color: Colors.textTertiary,
    marginTop: 3,
    marginLeft: 28,
    fontStyle: 'italic',
  },
});
```

Removed the per-row `<Text style={severityLabel}>Neutral</Text>` — the section header `NEUTRAL · 8` already groups items.

### Fix 3: Prune Top Picks Cards
```diff:SafeSwapSection.tsx
// Kiba — Safe Swap Section (M6)
// Shows higher-scoring alternatives on ResultScreen.
// Premium users see real recommendations; free users see blurred placeholder.
// D-094: suitability framing. D-095: UPVM compliance. D-020: brand-blind.

import React, { useEffect, useState, useRef, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  StyleSheet,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';

import { Colors, FontSizes, Spacing } from '../../utils/constants';
import { getScoreColor } from '../scoring/ScoreRing';
import { canUseSafeSwaps, canCompare } from '../../utils/permissions';
import { fetchSafeSwaps, type SafeSwapResult } from '../../services/safeSwapService';
import { batchScoreHybrid } from '../../services/batchScoreOnDevice';
import { supabase } from '../../services/supabase';
import type { ScanStackParamList } from '../../types/navigation';

// ─── Props ──────────────────────────────────────────────

interface SafeSwapSectionProps {
  productId: string;
  petId: string;
  species: 'dog' | 'cat';
  category: string;
  productForm: string | null;
  isSupplemental: boolean;
  scannedScore: number;
  petName: string;
  allergenGroups: string[];
  conditionTags: string[];
  petLifeStage: string | null;
  isBypassed: boolean;
  /** M7: Callback to start a Safe Switch from a swap card. */
  onSwitchTo?: (newProductId: string) => void;
}

// ─── Slot Icon Mapping ─────────────────────────────────

function slotIcon(label: string): keyof typeof Ionicons.glyphMap {
  switch (label) {
    case 'Top Pick': return 'star-outline';
    case 'Fish-Based': return 'fish-outline';
    case 'Another Pick': return 'sparkles-outline';
    case 'Great Value': return 'pricetag-outline';
    default: return 'star-outline';
  }
}

// ─── Component ──────────────────────────────────────────

export function SafeSwapSection(props: SafeSwapSectionProps) {
  const {
    productId, petId, species, category, productForm, isSupplemental,
    scannedScore, petName, allergenGroups, conditionTags, petLifeStage, isBypassed,
    onSwitchTo,
  } = props;

  const navigation = useNavigation<NativeStackNavigationProp<ScanStackParamList>>();
  const [result, setResult] = useState<SafeSwapResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [preparing, setPreparing] = useState(false);
  const batchTriedRef = useRef(false);
  const fetchIdRef = useRef(0);
  const cachedRef = useRef<SafeSwapResult | null>(null);
  const [expanded, setExpanded] = useState(false);

  const premium = canUseSafeSwaps();

  // ─── Fetch logic ────────────────────────────────────
  const loadSwaps = useCallback(async () => {
    if (isBypassed || !premium) return;
    if (cachedRef.current) { setResult(cachedRef.current); return; }

    const thisId = ++fetchIdRef.current;
    setLoading(true);

    try {
      let swapResult = await fetchSafeSwaps({
        petId, species, category, productForm, isSupplemental,
        scannedProductId: productId, scannedScore, allergenGroups, conditionTags, petLifeStage,
      });

      if (fetchIdRef.current !== thisId) return;

      // If cache empty or no candidates, trigger on-device scoring and retry
      if ((swapResult.cacheEmpty || swapResult.candidates.length === 0) && !batchTriedRef.current) {
        batchTriedRef.current = true;
        setPreparing(true);
        setLoading(false);
        try {
          // petProfile needed for scoring — use minimal shape from props
          const { data: petRow } = await supabase
            .from('pets').select('*').eq('id', petId).single();
          if (petRow && fetchIdRef.current === thisId) {
            await batchScoreHybrid(petId, petRow, category, productForm);
            swapResult = await fetchSafeSwaps({
              petId, species, category, productForm, isSupplemental,
              scannedProductId: productId, scannedScore, allergenGroups, conditionTags, petLifeStage,
            });
          }
        } catch { /* swallow */ }
        finally {
          if (fetchIdRef.current === thisId) setPreparing(false);
        }
      }

      if (fetchIdRef.current !== thisId) return;
      cachedRef.current = swapResult;
      setResult(swapResult);
    } catch {
      if (fetchIdRef.current !== thisId) return;
      setResult(null);
    } finally {
      if (fetchIdRef.current === thisId) setLoading(false);
    }
  }, [
    isBypassed, premium, petId, species, category, productForm,
    isSupplemental, productId, scannedScore, allergenGroups, conditionTags, petLifeStage,
  ]);

  useEffect(() => { loadSwaps(); }, [loadSwaps]);

  // ─── Early returns (after all hooks) ────────────────
  if (isBypassed) return null;

  // Premium users: hide section entirely if no results (after loading)
  if (premium && !loading && !preparing && (!result || result.candidates.length === 0)) return null;

  // ─── Render ─────────────────────────────────────────
  return (
    <View style={s.container}>
      {/* Collapsible header */}
      <TouchableOpacity
        style={s.headerRow}
        activeOpacity={0.7}
        onPress={() => setExpanded(prev => !prev)}
      >
        <View style={s.headerTextGroup}>
          <Text style={s.header}>
            Top picks for {petName}
          </Text>
          <Text style={s.subtitle}>
            Alternatives matched to {petName}'s dietary needs.
          </Text>
        </View>
        <Ionicons
          name={expanded ? 'chevron-up' : 'chevron-down'}
          size={20}
          color={Colors.textSecondary}
        />
      </TouchableOpacity>

      {/* Expanded body */}
      {expanded && !premium && (
        <TouchableOpacity
          style={s.premiumCta}
          activeOpacity={0.7}
          onPress={() => {
            (navigation as any).navigate('Paywall', {
              trigger: 'safe_swap',
              petName,
            });
          }}
        >
          <Text style={s.premiumCtaText}>
            Become a member to see higher-scoring alternatives
          </Text>
          <Ionicons name="arrow-forward" size={16} color={Colors.accent} />
        </TouchableOpacity>
      )}

      {expanded && premium && (loading || preparing) && (
        <View style={s.preparingContainer}>
          <ActivityIndicator size="small" color={Colors.accent} />
          <Text style={s.preparingText}>
            {preparing
              ? `Preparing recommendations for ${petName}...`
              : 'Loading alternatives...'}
          </Text>
        </View>
      )}

      {expanded && premium && result && result.candidates.length > 0 && <View style={s.cardRow}>
        {result.candidates.map((c) => (
          <TouchableOpacity
            key={c.product_id}
            style={s.card}
            activeOpacity={0.7}
            onPress={() => {
              navigation.push('Result', { productId: c.product_id, petId });
            }}
          >
            {/* Product image */}
            <View style={s.imageContainer}>
              {c.image_url ? (
                <Image source={{ uri: c.image_url }} style={s.image} resizeMode="contain" />
              ) : (
                <View style={s.imageFallback}>
                  <Ionicons name="cube-outline" size={32} color={Colors.textTertiary} />
                </View>
              )}
            </View>

            {/* Slot label (curated mode only) */}
            {c.slot_label && (
              <View style={s.slotLabelRow}>
                <Ionicons name={slotIcon(c.slot_label)} size={12} color={Colors.accent} />
                <Text style={s.slotLabelText}>{c.slot_label.toUpperCase()}</Text>
              </View>
            )}

            {/* Brand */}
            <Text style={s.brand} numberOfLines={1}>
              {c.brand}
            </Text>

            {/* Product name */}
            <Text style={s.name} numberOfLines={2}>
              {c.product_name}
            </Text>

            {/* Bottom-anchored section — aligns across cards */}
            <View style={s.cardBottom}>
              {/* Score */}
              <View style={s.scoreRow}>
                <View style={[s.scoreDot, { backgroundColor: getScoreColor(c.final_score, c.is_supplemental) }]} />
                <Text style={s.scoreText}>{Math.round(c.final_score)}% match</Text>
              </View>
              <Text style={s.scoreLabel}>for {petName}</Text>

              {/* Swap reason */}
              <Text style={s.reason} numberOfLines={2}>
                {c.reason}
              </Text>
            </View>

            {/* Compare link */}
            <TouchableOpacity
              style={s.compareLink}
              onPress={() => {
                if (!canCompare()) {
                  (navigation as any).navigate('Paywall', {
                    trigger: 'compare',
                    petName,
                  });
                  return;
                }
                (navigation as any).navigate('Compare', {
                  productAId: productId,
                  productBId: c.product_id,
                  petId,
                });
              }}
            >
              <Text style={s.compareLinkText}>Compare</Text>
            </TouchableOpacity>

            {/* M7: Switch to this (Safe Switch entry point) */}
            {onSwitchTo && category === 'daily_food' && !isSupplemental && (
              <TouchableOpacity
                style={s.switchLink}
                onPress={() => onSwitchTo(c.product_id)}
              >
                <Ionicons name="swap-horizontal-outline" size={14} color={Colors.accent} />
                <Text style={s.switchLinkText}>Switch to this</Text>
              </TouchableOpacity>
            )}
          </TouchableOpacity>
        ))}
      </View>}
    </View>
  );
}

// ─── Styles ─────────────────────────────────────────────

const s = StyleSheet.create({
  container: {
    marginBottom: Spacing.lg,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.card,
    borderRadius: 12,
    paddingHorizontal: Spacing.md,
    paddingVertical: 14,
    marginBottom: Spacing.md,
  },
  headerTextGroup: {
    flex: 1,
  },
  header: {
    fontSize: FontSizes.lg,
    fontWeight: '700',
    color: Colors.textPrimary,
    marginBottom: Spacing.xs,
  },
  subtitle: {
    fontSize: FontSizes.sm,
    color: Colors.textSecondary,
  },
  cardRow: {
    flexDirection: 'row',
    gap: 10,
  },
  card: {
    flex: 1,
    backgroundColor: Colors.card,
    borderRadius: 12,
    padding: 10,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
  },
  imageContainer: {
    width: '100%',
    height: 100,
    borderRadius: 8,
    backgroundColor: Colors.background,
    marginBottom: Spacing.sm,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  image: {
    width: '100%',
    height: '100%',
  },
  imageFallback: {
    alignItems: 'center',
    justifyContent: 'center',
    flex: 1,
  },
  slotLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 4,
    minHeight: 16,
  },
  slotLabelText: {
    fontSize: FontSizes.xs,
    fontWeight: '600',
    color: Colors.accent,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  brand: {
    fontSize: FontSizes.xs,
    fontWeight: '500',
    color: Colors.textSecondary,
    textTransform: 'uppercase',
    marginBottom: 2,
  },
  name: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.textPrimary,
    minHeight: 32,
  },
  cardBottom: {
    marginTop: 'auto',
    paddingTop: Spacing.sm,
  },
  scoreRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  scoreDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  scoreText: {
    fontSize: FontSizes.lg,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  scoreLabel: {
    fontSize: FontSizes.xs,
    color: Colors.textSecondary,
    marginBottom: Spacing.xs,
  },
  reason: {
    fontSize: 10,
    fontStyle: 'italic',
    color: Colors.textTertiary,
    marginBottom: Spacing.sm,
  },
  compareLink: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: Colors.cardBorder,
    paddingTop: Spacing.sm,
  },
  compareLinkText: {
    fontSize: FontSizes.sm,
    fontWeight: '600',
    color: Colors.accent,
  },

  // ─── Premium CTA (free users) ──────────────────────────
  premiumCta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: Colors.card,
    borderRadius: 12,
    padding: Spacing.lg,
    borderWidth: 1,
    borderColor: Colors.accent + '30',
  },
  premiumCtaText: {
    fontSize: FontSizes.sm,
    fontWeight: '600',
    color: Colors.accent,
  },

  // ─── Preparing state ─────────────────────────────────
  preparingContainer: {
    backgroundColor: Colors.card,
    borderRadius: 12,
    padding: Spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  preparingText: {
    fontSize: FontSizes.sm,
    color: Colors.textSecondary,
  },

  // ─── Switch CTA (M7) ──────────────────────────────────
  switchLink: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: Colors.cardBorder,
    paddingTop: Spacing.sm,
    marginTop: Spacing.xs,
  },
  switchLinkText: {
    fontSize: FontSizes.sm,
    fontWeight: '600',
    color: Colors.accent,
  },
});
===
// Kiba — Safe Swap Section (M6)
// Shows higher-scoring alternatives on ResultScreen.
// Premium users see real recommendations; free users see blurred placeholder.
// D-094: suitability framing. D-095: UPVM compliance. D-020: brand-blind.

import React, { useEffect, useState, useRef, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  StyleSheet,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';

import { Colors, FontSizes, Spacing } from '../../utils/constants';
import { getScoreColor } from '../scoring/ScoreRing';
import { canUseSafeSwaps, canCompare } from '../../utils/permissions';
import { fetchSafeSwaps, type SafeSwapResult } from '../../services/safeSwapService';
import { batchScoreHybrid } from '../../services/batchScoreOnDevice';
import { supabase } from '../../services/supabase';
import type { ScanStackParamList } from '../../types/navigation';

// ─── Props ──────────────────────────────────────────────

interface SafeSwapSectionProps {
  productId: string;
  petId: string;
  species: 'dog' | 'cat';
  category: string;
  productForm: string | null;
  isSupplemental: boolean;
  scannedScore: number;
  petName: string;
  allergenGroups: string[];
  conditionTags: string[];
  petLifeStage: string | null;
  isBypassed: boolean;
  /** M7: Callback to start a Safe Switch from a swap card. */
  onSwitchTo?: (newProductId: string) => void;
}

// ─── Slot Icon Mapping ─────────────────────────────────

function slotIcon(label: string): keyof typeof Ionicons.glyphMap {
  switch (label) {
    case 'Top Pick': return 'star-outline';
    case 'Fish-Based': return 'fish-outline';
    case 'Another Pick': return 'sparkles-outline';
    case 'Great Value': return 'pricetag-outline';
    default: return 'star-outline';
  }
}

// ─── Component ──────────────────────────────────────────

export function SafeSwapSection(props: SafeSwapSectionProps) {
  const {
    productId, petId, species, category, productForm, isSupplemental,
    scannedScore, petName, allergenGroups, conditionTags, petLifeStage, isBypassed,
    onSwitchTo,
  } = props;

  const navigation = useNavigation<NativeStackNavigationProp<ScanStackParamList>>();
  const [result, setResult] = useState<SafeSwapResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [preparing, setPreparing] = useState(false);
  const batchTriedRef = useRef(false);
  const fetchIdRef = useRef(0);
  const cachedRef = useRef<SafeSwapResult | null>(null);
  const [expanded, setExpanded] = useState(false);

  const premium = canUseSafeSwaps();

  // ─── Fetch logic ────────────────────────────────────
  const loadSwaps = useCallback(async () => {
    if (isBypassed || !premium) return;
    if (cachedRef.current) { setResult(cachedRef.current); return; }

    const thisId = ++fetchIdRef.current;
    setLoading(true);

    try {
      let swapResult = await fetchSafeSwaps({
        petId, species, category, productForm, isSupplemental,
        scannedProductId: productId, scannedScore, allergenGroups, conditionTags, petLifeStage,
      });

      if (fetchIdRef.current !== thisId) return;

      // If cache empty or no candidates, trigger on-device scoring and retry
      if ((swapResult.cacheEmpty || swapResult.candidates.length === 0) && !batchTriedRef.current) {
        batchTriedRef.current = true;
        setPreparing(true);
        setLoading(false);
        try {
          // petProfile needed for scoring — use minimal shape from props
          const { data: petRow } = await supabase
            .from('pets').select('*').eq('id', petId).single();
          if (petRow && fetchIdRef.current === thisId) {
            await batchScoreHybrid(petId, petRow, category, productForm);
            swapResult = await fetchSafeSwaps({
              petId, species, category, productForm, isSupplemental,
              scannedProductId: productId, scannedScore, allergenGroups, conditionTags, petLifeStage,
            });
          }
        } catch { /* swallow */ }
        finally {
          if (fetchIdRef.current === thisId) setPreparing(false);
        }
      }

      if (fetchIdRef.current !== thisId) return;
      cachedRef.current = swapResult;
      setResult(swapResult);
    } catch {
      if (fetchIdRef.current !== thisId) return;
      setResult(null);
    } finally {
      if (fetchIdRef.current === thisId) setLoading(false);
    }
  }, [
    isBypassed, premium, petId, species, category, productForm,
    isSupplemental, productId, scannedScore, allergenGroups, conditionTags, petLifeStage,
  ]);

  useEffect(() => { loadSwaps(); }, [loadSwaps]);

  // ─── Early returns (after all hooks) ────────────────
  if (isBypassed) return null;

  // Premium users: hide section entirely if no results (after loading)
  if (premium && !loading && !preparing && (!result || result.candidates.length === 0)) return null;

  // ─── Render ─────────────────────────────────────────
  return (
    <View style={s.container}>
      {/* Collapsible header */}
      <TouchableOpacity
        style={s.headerRow}
        activeOpacity={0.7}
        onPress={() => setExpanded(prev => !prev)}
      >
        <View style={s.headerTextGroup}>
          <Text style={s.header}>
            Top picks for {petName}
          </Text>
          <Text style={s.subtitle}>
            Alternatives matched to {petName}'s dietary needs.
          </Text>
        </View>
        <Ionicons
          name={expanded ? 'chevron-up' : 'chevron-down'}
          size={20}
          color={Colors.textSecondary}
        />
      </TouchableOpacity>

      {/* Expanded body */}
      {expanded && !premium && (
        <TouchableOpacity
          style={s.premiumCta}
          activeOpacity={0.7}
          onPress={() => {
            (navigation as any).navigate('Paywall', {
              trigger: 'safe_swap',
              petName,
            });
          }}
        >
          <Text style={s.premiumCtaText}>
            Become a member to see higher-scoring alternatives
          </Text>
          <Ionicons name="arrow-forward" size={16} color={Colors.accent} />
        </TouchableOpacity>
      )}

      {expanded && premium && (loading || preparing) && (
        <View style={s.preparingContainer}>
          <ActivityIndicator size="small" color={Colors.accent} />
          <Text style={s.preparingText}>
            {preparing
              ? `Preparing recommendations for ${petName}...`
              : 'Loading alternatives...'}
          </Text>
        </View>
      )}

      {expanded && premium && result && result.candidates.length > 0 && <View style={s.cardRow}>
        {result.candidates.map((c) => (
          <TouchableOpacity
            key={c.product_id}
            style={s.card}
            activeOpacity={0.7}
            onPress={() => {
              navigation.push('Result', { productId: c.product_id, petId });
            }}
          >
            {/* Product image */}
            <View style={s.imageContainer}>
              {c.image_url ? (
                <Image source={{ uri: c.image_url }} style={s.image} resizeMode="contain" />
              ) : (
                <View style={s.imageFallback}>
                  <Ionicons name="cube-outline" size={32} color={Colors.textTertiary} />
                </View>
              )}
            </View>

            {/* Slot label (curated mode only) */}
            {c.slot_label && (
              <View style={s.slotLabelRow}>
                <Ionicons name={slotIcon(c.slot_label)} size={12} color={Colors.accent} />
                <Text style={s.slotLabelText}>{c.slot_label.toUpperCase()}</Text>
              </View>
            )}

            {/* Brand */}
            <Text style={s.brand} numberOfLines={1}>
              {c.brand}
            </Text>

            {/* Product name */}
            <Text style={s.name} numberOfLines={2}>
              {c.product_name}
            </Text>

            {/* Bottom-anchored section — aligns across cards */}
            <View style={s.cardBottom}>
              {/* Score pill */}
              <View style={[s.scorePill, { backgroundColor: getScoreColor(c.final_score, c.is_supplemental) + '1F' }]}>
                <View style={[s.scoreDot, { backgroundColor: getScoreColor(c.final_score, c.is_supplemental) }]} />
                <Text style={[s.scorePillText, { color: getScoreColor(c.final_score, c.is_supplemental) }]}>
                  {Math.round(c.final_score)}%
                </Text>
              </View>
            </View>

            {/* Action buttons with proper spacing */}
            <View style={s.actionRow}>
              {/* Compare */}
              <TouchableOpacity
                style={s.compareLink}
                onPress={() => {
                  if (!canCompare()) {
                    (navigation as any).navigate('Paywall', {
                      trigger: 'compare',
                      petName,
                    });
                    return;
                  }
                  (navigation as any).navigate('Compare', {
                    productAId: productId,
                    productBId: c.product_id,
                    petId,
                  });
                }}
              >
                <Text style={s.compareLinkText}>Compare</Text>
              </TouchableOpacity>

              {/* M7: Switch to this (Safe Switch entry point) — daily food only */}
              {onSwitchTo && category === 'daily_food' && !isSupplemental && (
                <TouchableOpacity
                  style={s.switchLink}
                  onPress={() => onSwitchTo(c.product_id)}
                >
                  <Ionicons name="swap-horizontal-outline" size={14} color={Colors.accent} />
                  <Text style={s.switchLinkText}>Switch to this</Text>
                </TouchableOpacity>
              )}
            </View>
          </TouchableOpacity>
        ))}
      </View>}
    </View>
  );
}

// ─── Styles ─────────────────────────────────────────────

const s = StyleSheet.create({
  container: {
    marginBottom: Spacing.lg,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.cardSurface,
    borderRadius: 12,
    paddingHorizontal: Spacing.md,
    paddingVertical: 14,
    marginBottom: Spacing.md,
  },
  headerTextGroup: {
    flex: 1,
  },
  header: {
    fontSize: FontSizes.lg,
    fontWeight: '700',
    color: Colors.textPrimary,
    marginBottom: Spacing.xs,
  },
  subtitle: {
    fontSize: FontSizes.sm,
    color: Colors.textSecondary,
  },
  cardRow: {
    flexDirection: 'row',
    gap: 10,
  },
  card: {
    flex: 1,
    backgroundColor: Colors.cardSurface,
    borderRadius: 12,
    padding: 10,
    borderWidth: 1,
    borderColor: Colors.hairlineBorder,
  },
  imageContainer: {
    width: '100%',
    height: 100,
    borderRadius: 8,
    backgroundColor: Colors.background,
    marginBottom: Spacing.sm,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  image: {
    width: '100%',
    height: '100%',
  },
  imageFallback: {
    alignItems: 'center',
    justifyContent: 'center',
    flex: 1,
  },
  slotLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 4,
    minHeight: 16,
  },
  slotLabelText: {
    fontSize: FontSizes.xs,
    fontWeight: '600',
    color: Colors.accent,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  brand: {
    fontSize: FontSizes.xs,
    fontWeight: '500',
    color: Colors.textSecondary,
    textTransform: 'uppercase',
    marginBottom: 2,
  },
  name: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.textPrimary,
    minHeight: 32,
  },
  cardBottom: {
    marginTop: 'auto',
    paddingTop: Spacing.sm,
  },
  scorePill: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 5,
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  scoreDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  scorePillText: {
    fontSize: FontSizes.md,
    fontWeight: '700',
  },
  actionRow: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: Colors.hairlineBorder,
    paddingTop: Spacing.sm,
    marginTop: Spacing.sm,
    gap: Spacing.sm,
  },
  compareLink: {
    paddingVertical: 4,
  },
  compareLinkText: {
    fontSize: FontSizes.sm,
    fontWeight: '600',
    color: Colors.accent,
  },

  // ─── Premium CTA (free users) ──────────────────────────
  premiumCta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: Colors.cardSurface,
    borderRadius: 12,
    padding: Spacing.lg,
    borderWidth: 1,
    borderColor: Colors.hairlineBorder,
  },
  premiumCtaText: {
    fontSize: FontSizes.sm,
    fontWeight: '600',
    color: Colors.accent,
  },

  // ─── Preparing state ─────────────────────────────────
  preparingContainer: {
    backgroundColor: Colors.cardSurface,
    borderRadius: 12,
    padding: Spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  preparingText: {
    fontSize: FontSizes.sm,
    color: Colors.textSecondary,
  },

  // ─── Switch CTA (M7) ──────────────────────────────────
  switchLink: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 4,
  },
  switchLinkText: {
    fontSize: FontSizes.sm,
    fontWeight: '600',
    color: Colors.accent,
  },
});
```

- Replaced stacked `91% match` / `for Xhia` / `Higher overall match` with a **compact score pill** (colored dot + percentage)
- Wrapped Compare + Switch in an `actionRow` container with `gap: Spacing.sm` for proper spacing
- Both buttons remain — no accidental removals

### Fix 4: Soften Toxic Macros
- `ZONE_COLORS.red` changed from `Colors.severityRed` → `Colors.severityAmber`
- Failing protein/fat bars now render **amber/orange** instead of alarming neon red
- Red is reserved strictly for FDA recall alerts

### Fix 5: Modernize Controls
- Replaced `<Ionicons name="checkbox" />` checkbox with React Native `<Switch />` component
- Uses iOS-native toggle appearance: cyan track when on, dark gray off, white thumb
- Scaled to 80% to match compact design density

### Fix 6: Score Waterfall — Dots Replace Glitch Lines
```diff:ScoreWaterfall.tsx
// ScoreWaterfall — Visual breakdown of score calculation, layer by layer (D-094).
// Shows how the final suitability score was derived from 100 down.
// D-094: pet-named layer labels. D-084: zero emoji. D-095: no editorial copy.
// Interactive accordion: expand/collapse each layer for detailed breakdown.

import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  LayoutAnimation,
  Platform,
  UIManager,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { ScoredResult, Penalty, AppliedRule, PersonalizationDetail, IngredientPenaltyResult, ProductIngredient } from '../../types/scoring';
import { Colors, FontSizes, Spacing, SCORING_WEIGHTS, SEVERITY_COLORS, AAFCO_STATEMENT_STATUS, getScoreColor } from '../../utils/constants';
import { toDisplayName } from '../../utils/formatters';
import { InfoTooltip } from '../ui/InfoTooltip';

// Enable LayoutAnimation on Android
if (
  Platform.OS === 'android' &&
  UIManager.setLayoutAnimationEnabledExperimental
) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

// ─── Props ──────────────────────────────────────────────

interface ScoreWaterfallProps {
  scoredResult: ScoredResult;
  petName: string;
  species: 'dog' | 'cat';
  category: 'daily_food' | 'treat' | 'supplemental';
  ingredients?: ProductIngredient[];
}

// Weights imported from constants.ts — single source of truth (D-010, D-136)
const WEIGHTS = SCORING_WEIGHTS;

// ─── Tooltip Copy ────────────────────────────────────────

const TOOLTIP_TEXT: Record<string, string> = {
  iq: 'Point values reflect ingredient quality, adjusted by position. Ingredients listed earlier carry more weight.',
  np: "How well this product's guaranteed analysis matches AAFCO nutritional standards for your pet's life stage.",
  fc: "Evaluates the product's AAFCO compliance statement, preservative type, and protein source naming.",
  species: 'Species-specific safety rules including heart health risk factors, carbohydrate load, and mandatory nutrient checks.',
  personalization: "Adjustments based on your pet's breed-specific nutritional needs and life stage.",
  allergen: "Ingredients that match allergens in your pet's health profile.",
};

const MONOSPACE_FONT = Platform.OS === 'ios' ? 'Menlo' : 'monospace';

// ─── Row Model ──────────────────────────────────────────

interface WaterfallRow {
  key: string;
  label: string;
  points: number;
}

function buildRows(
  scoredResult: ScoredResult,
  petName: string,
  species: 'dog' | 'cat',
  category: 'daily_food' | 'treat' | 'supplemental',
): WaterfallRow[] {
  const isPartial = scoredResult.isPartialScore && category === 'daily_food';
  const weightKey = category === 'treat'
    ? 'treat'
    : category === 'supplemental'
      ? 'supplemental'
      : isPartial
        ? 'daily_food_partial'
        : 'daily_food';
  const w = WEIGHTS[weightKey];
  const { layer1, layer2, layer3 } = scoredResult;
  const rows: WaterfallRow[] = [];

  // Layer 1a — Ingredient Quality
  const iqDeduction = -Math.round((100 - layer1.ingredientQuality) * w.iq);
  rows.push({ key: 'iq', label: 'Ingredients', points: iqDeduction });

  // Layer 1b — Nutritional Profile (daily food + supplemental, hidden when partial)
  if ((category === 'daily_food' || category === 'supplemental') && !isPartial) {
    const npDeduction = -Math.round((100 - layer1.nutritionalProfile) * w.np);
    rows.push({ key: 'np', label: 'Nutritional Fit', points: npDeduction });
  }

  // Layer 1c — Formulation (daily food only — 0% for supplemental/treat)
  if (category === 'daily_food') {
    const fcDeduction = -Math.round((100 - layer1.formulation) * w.fc);
    rows.push({ key: 'fc', label: 'Formulation Quality', points: fcDeduction });
  }

  // Layer 2 — Species Rules (D-094: "[Species] Safety Checks")
  const speciesLabel = species === 'dog' ? 'Canine Safety Checks' : 'Feline Safety Checks';
  rows.push({
    key: 'species',
    label: speciesLabel,
    points: layer2.speciesAdjustment,
  });

  // Layer 3 — Personalization
  const l3Total = layer3.personalizations.reduce(
    (sum, p) => sum + p.adjustment,
    0,
  );
  rows.push({ key: 'personalization', label: 'Breed & Age', points: l3Total });

  // D-129: Allergen sensitivity row (only when allergen overrides fired)
  if (scoredResult.allergenDelta > 0) {
    rows.push({
      key: 'allergen',
      label: 'Allergen Sensitivity',
      points: -Math.round(scoredResult.allergenDelta),
    });
  }

  return rows;
}

// ─── Helpers ────────────────────────────────────────────

function formatPoints(points: number): string {
  if (points === 0) return '0 pts';
  const sign = points > 0 ? '+' : '';
  return `${sign}${points} pts`;
}

function getPointsColor(points: number, severity?: 'danger' | 'caution' | 'good' | 'neutral'): string {
  if (points > 0) return Colors.severityGreen;
  if (points === 0) return Colors.textTertiary;
  // Negative: color matches ingredient severity when available
  if (severity === 'caution') return Colors.severityAmber;
  return Colors.severityRed; // danger or unspecified default
}

// formatIngredientName replaced by toDisplayName from utils/formatters

// ─── Proportional Rounding (Largest Remainder Method) ────
// Distributes an integer `total` among items proportionally to `values`,
// guaranteeing the sum of returned integers exactly equals `total`.

function distributeRounded(values: number[], total: number): number[] {
  if (total === 0 || values.length === 0) return values.map(() => 0);
  const sum = values.reduce((s, v) => s + v, 0);
  if (sum === 0) return values.map(() => 0);

  const scaled = values.map(v => (v / sum) * total);
  const floored = scaled.map(Math.floor);
  let remaining = total - floored.reduce((s, v) => s + v, 0);

  const indices = scaled
    .map((v, i) => ({ i, rem: v - floored[i] }))
    .sort((a, b) => b.rem - a.rem);

  for (const { i } of indices) {
    if (remaining <= 0) break;
    floored[i]++;
    remaining--;
  }

  return floored;
}

// ─── Ingredient-Specific Description (P1-6, D-095 compliant) ──

const ARTIFICIAL_COLORANTS = new Set([
  'red_40', 'yellow_5', 'yellow_6', 'blue_2', 'titanium_dioxide', 'red_3', 'blue_1',
]);
const SYNTHETIC_PRESERVATIVES = new Set([
  'bha', 'bht', 'tbhq', 'ethoxyquin',
]);

function getEnrichedReason(
  penalty: Penalty,
  ingredient?: ProductIngredient,
): string {
  // Already specific (unnamed species penalty from scoring engine)
  if (penalty.reason.includes('Unnamed species')) return penalty.reason;

  const name = toDisplayName(penalty.ingredientName);

  // Priority 1: tldr from ingredients_dict (D-105 content)
  if (ingredient?.tldr) return ingredient.tldr;

  // Priority 2: Property-based descriptions
  if (ingredient?.is_unnamed_species) {
    return `${name} — unnamed species source, variable supply chain`;
  }

  if (ARTIFICIAL_COLORANTS.has(penalty.ingredientName)) {
    return `${name} — artificial colorant, no nutritional function`;
  }

  if (SYNTHETIC_PRESERVATIVES.has(penalty.ingredientName)) {
    return `${name} — synthetic preservative linked to health concerns in animal studies`;
  }

  if (penalty.ingredientName.includes('by_product')) {
    return `${name} — byproduct, variable quality depending on source`;
  }

  if (penalty.ingredientName === 'propylene_glycol') {
    return `${name} — synthetic humectant, restricted in cat food by FDA`;
  }

  if (penalty.ingredientName === 'salt' && penalty.position <= 10) {
    return 'Added sodium — position suggests use as flavor enhancer';
  }

  if (penalty.ingredientName === 'sugar' || penalty.ingredientName === 'cane_molasses') {
    return `${name} — added sugar, no nutritional benefit`;
  }

  if (penalty.ingredientName === 'corn_syrup') {
    return `${name} — high-glycemic sweetener, no nutritional benefit`;
  }

  // Fallback
  return penalty.reason;
}

// ─── Expanded Content Renderers ─────────────────────────

function renderIqExpanded(
  ingredientResults: IngredientPenaltyResult[],
  headerPoints: number,
  ingredients?: ProductIngredient[],
): React.ReactNode {
  if (ingredientResults.length === 0) {
    return (
      <Text style={styles.expandedEmpty}>No ingredient concerns identified</Text>
    );
  }

  const absHeader = Math.abs(headerPoints);

  // Proportional distribution: scale position-weighted totals to match category-weighted header
  const rawTotals = ingredientResults.map(ir => ir.totalWeightedPoints);
  const displayTotals = distributeRounded(rawTotals, absHeader);

  // Build ingredient lookup for enriched reason text
  const ingredientMap = new Map<string, ProductIngredient>();
  if (ingredients) {
    for (const ing of ingredients) {
      ingredientMap.set(ing.canonical_name, ing);
    }
  }

  // Dev-mode math check
  const sum = displayTotals.reduce((s, v) => s + v, 0);
  const mathError = __DEV__ && sum !== absHeader;

  return (
    <>
      {ingredientResults.map((ir, idx) => {
        const displayTotal = displayTotals[idx];
        const dotColor = SEVERITY_COLORS[ir.severity];
        const ingredient = ingredientMap.get(ir.canonicalName);

        // Distribute ingredient total among sub-reasons
        const rawReasons = ir.reasons.map(r => r.weightedPoints);
        const displayReasons = distributeRounded(rawReasons, displayTotal);

        // Join unique citations for tooltip
        const citations = [...new Set(ir.reasons.map(r => r.citationSource))].join('; ');

        return (
          <View key={ir.canonicalName} style={styles.ingredientGroup}>
            {/* Parent row: dot + name + points + citation tooltip */}
            <View style={styles.ingredientParentRow}>
              <View style={[styles.severityDot, { backgroundColor: dotColor }]} />
              <Text style={styles.ingredientName}>
                {toDisplayName(ir.canonicalName)}
              </Text>
              <Text style={[styles.ingredientPoints, { color: dotColor }]}>
                {`\u2212${displayTotal}`}
              </Text>
              <View style={styles.ingredientTooltipWrap}>
                <InfoTooltip size={10} opacity={0.18} text={citations} />
              </View>
            </View>

            {/* Sub-reason rows with continuous left border */}
            <View style={[styles.subReasonContainer, { borderLeftColor: dotColor }]}>
              {ir.reasons.map((reason, ri) => {
                // Enrich generic engine text via getEnrichedReason, then strip name prefix
                const enriched = getEnrichedReason(
                  { ingredientName: ir.canonicalName, reason: reason.reason, rawPenalty: reason.rawPoints, positionAdjustedPenalty: reason.weightedPoints, position: ir.position, citationSource: reason.citationSource },
                  ingredient,
                );
                const dashIdx = enriched.indexOf(' \u2014 ');
                const displayReason = dashIdx >= 0
                  ? enriched.charAt(dashIdx + 3).toUpperCase() + enriched.slice(dashIdx + 4)
                  : enriched;

                return (
                  <View key={ri} style={styles.subReasonRow}>
                    <Text style={styles.subReasonText} numberOfLines={2}>
                      {displayReason}
                    </Text>
                    <Text style={styles.subReasonPoints}>
                      ({`\u2212${displayReasons[ri]}`})
                    </Text>
                  </View>
                );
              })}
            </View>
          </View>
        );
      })}
      {__DEV__ && mathError && (
        <Text style={{ color: '#EF4444', fontSize: 11 }}>
          {'\u26A0'} Display math: items sum to {sum}, header shows {absHeader}
        </Text>
      )}
    </>
  );
}

function renderNpExpanded(scoredResult: ScoredResult): React.ReactNode {
  const npScore = scoredResult.layer1.nutritionalProfile;
  return (
    <View style={styles.expandedItem}>
      <Text style={styles.expandedSummary}>
        Nutritional adequacy scored {npScore}/100 based on guaranteed analysis values vs AAFCO thresholds
      </Text>
    </View>
  );
}

function renderFcExpanded(_scoredResult: ScoredResult): React.ReactNode {
  return (
    <View style={styles.expandedItem}>
      <Text style={styles.expandedSummary}>
        Based on AAFCO compliance, preservative quality, and protein source naming
      </Text>
    </View>
  );
}

function renderSpeciesExpanded(appliedRules: AppliedRule[]): React.ReactNode {
  const firedRules = appliedRules.filter((r) => r.fired);

  if (firedRules.length === 0) {
    return (
      <Text style={styles.expandedEmpty}>
        No species-specific adjustments applied
      </Text>
    );
  }

  return firedRules.map((rule) => (
    <View key={rule.ruleId} style={styles.expandedItem}>
      <View style={styles.expandedItemRow}>
        <Text style={styles.expandedItemName} numberOfLines={1}>
          {rule.label}
        </Text>
        <Text style={styles.expandedItemPoints}>
          {rule.adjustment > 0 ? '+' : ''}{rule.adjustment} pts
        </Text>
      </View>
      {rule.citation && (
        <TouchableOpacity activeOpacity={0.7}>
          <Text style={styles.expandedCitation}>{rule.citation}</Text>
        </TouchableOpacity>
      )}
    </View>
  ));
}

function renderPersonalizationExpanded(
  personalizations: PersonalizationDetail[],
  petName: string,
): React.ReactNode {
  // Filter out breed_contraindications (shown separately as cards)
  const adjustments = personalizations.filter(
    (p) => p.type !== 'breed_contraindication',
  );

  if (adjustments.length === 0) {
    return (
      <Text style={styles.expandedEmpty}>
        No breed or age adjustments for {petName}'s profile
      </Text>
    );
  }

  return adjustments.map((p, i) => (
    <View key={`${p.type}-${p.label}-${i}`} style={styles.expandedItem}>
      <View style={styles.expandedItemRow}>
        <Text style={styles.expandedItemName} numberOfLines={1}>
          {p.label}
        </Text>
        <Text style={styles.expandedItemPoints}>
          {p.adjustment > 0 ? '+' : ''}{p.adjustment} pts
        </Text>
      </View>
    </View>
  ));
}

function renderAllergenExpanded(
  allergenWarnings: PersonalizationDetail[],
  petName: string,
): React.ReactNode {
  if (allergenWarnings.length === 0) {
    return (
      <Text style={styles.expandedEmpty}>
        No allergen matches for {petName}
      </Text>
    );
  }

  return allergenWarnings.map((w, i) => (
    <View key={`allergen-${i}`} style={styles.expandedItem}>
      <Text style={styles.expandedSummary}>{w.label}</Text>
    </View>
  ));
}

// ─── Collapsed Summary Logic ─────────────────────────────

function getSummaryContent(
  key: string,
  scoredResult: ScoredResult,
): { text: string; isGood: boolean } {
  switch (key) {
    case 'iq': {
      const count = scoredResult.ingredientPenalties.length;
      if (count === 0) return { text: 'No ingredient concerns', isGood: true };
      return { text: `${count} ingredient${count !== 1 ? 's' : ''} flagged`, isGood: false };
    }
    case 'np': {
      if (scoredResult.layer1.nutritionalProfile >= 100) {
        return { text: 'All nutrients within range', isGood: true };
      }
      return { text: 'Nutritional gaps detected', isGood: false };
    }
    case 'fc': {
      if (scoredResult.flags.includes('aafco_statement_not_available')) {
        return { text: AAFCO_STATEMENT_STATUS.missing.collapsedSummary, isGood: false };
      }
      if (scoredResult.flags.includes('aafco_statement_unrecognized')) {
        return { text: AAFCO_STATEMENT_STATUS.unrecognized.collapsedSummary, isGood: false };
      }
      return { text: 'Complete AAFCO statement verified', isGood: true };
    }
    case 'species': {
      const fired = scoredResult.layer2.appliedRules.filter((r) => r.fired);
      if (fired.length === 0) return { text: 'No species-specific concerns', isGood: true };
      return { text: fired[0].label, isGood: false };
    }
    case 'personalization': {
      const adjustments = scoredResult.layer3.personalizations.filter(
        (p) => p.type !== 'breed_contraindication',
      );
      if (adjustments.length === 0) return { text: 'No breed-specific adjustments', isGood: true };
      return { text: adjustments[0].label, isGood: false };
    }
    case 'allergen': {
      const warnings = scoredResult.layer3.allergenWarnings;
      if (warnings.length === 0) return { text: 'No allergen matches', isGood: true };
      return { text: warnings[0].label, isGood: false };
    }
    default:
      return { text: '', isGood: false };
  }
}

// ─── Component ──────────────────────────────────────────

export function ScoreWaterfall({
  scoredResult,
  petName,
  species,
  category,
  ingredients,
}: ScoreWaterfallProps) {
  const [expandedKey, setExpandedKey] = useState<string | null>(null);
  const rows = buildRows(scoredResult, petName, species, category);
  const maxMagnitude = Math.max(
    ...rows.map((r) => Math.abs(r.points)),
    1, // avoid division by zero
  );
  const isSupplemental = category === 'supplemental';
  const scoreColor = getScoreColor(scoredResult.finalScore, isSupplemental);
  const verdictLabel = scoredResult.finalScore >= 85 ? 'Excellent match'
    : scoredResult.finalScore >= 70 ? 'Good match'
    : scoredResult.finalScore >= 65 ? 'Fair match'
    : scoredResult.finalScore >= 51 ? 'Low match'
    : 'Poor match';

  const toggleRow = (key: string) => {
    LayoutAnimation.configureNext({
      duration: 250,
      create: { type: LayoutAnimation.Types.easeInEaseOut, property: LayoutAnimation.Properties.opacity },
      update: { type: LayoutAnimation.Types.easeInEaseOut },
      delete: { type: LayoutAnimation.Types.easeInEaseOut, property: LayoutAnimation.Properties.opacity },
    });
    setExpandedKey((prev) => (prev === key ? null : key));
  };

  const renderExpandedContent = (key: string, rowPoints: number): React.ReactNode => {
    switch (key) {
      case 'iq':
        return renderIqExpanded(scoredResult.ingredientResults, rowPoints, ingredients);
      case 'np':
        return renderNpExpanded(scoredResult);
      case 'fc':
        return renderFcExpanded(scoredResult);
      case 'species':
        return renderSpeciesExpanded(scoredResult.layer2.appliedRules);
      case 'personalization':
        return renderPersonalizationExpanded(
          scoredResult.layer3.personalizations,
          petName,
        );
      case 'allergen':
        return renderAllergenExpanded(scoredResult.layer3.allergenWarnings, petName);
      default:
        return null;
    }
  };

  return (
    <View style={styles.container}>
      {/* Baseline */}
      <View style={styles.baselineRow}>
        <Text style={styles.baselineLabel}>Starts at 100</Text>
        <View style={styles.baselineDot} />
      </View>

      {/* Layer rows */}
      {rows.map((row) => {
        const isExpanded = expandedKey === row.key;
        const barColor = getPointsColor(row.points);
        const barWidthPercent = row.points === 0
          ? 0
          : Math.min(Math.abs(row.points) / 50, 1) * 100;
        const barFillColor = Math.abs(row.points) >= 10
          ? SEVERITY_COLORS.danger
          : SEVERITY_COLORS.caution;
        const summary = getSummaryContent(row.key, scoredResult);

        return (
          <View key={row.key} style={styles.row}>
            <TouchableOpacity
              style={styles.rowHeader}
              onPress={() => toggleRow(row.key)}
              activeOpacity={0.7}
            >
              <View style={styles.rowLeft}>
                <Text style={styles.rowLabel}>
                  {row.label}
                </Text>
                {TOOLTIP_TEXT[row.key] && (
                  <View style={styles.tooltipWrap}>
                    <InfoTooltip text={TOOLTIP_TEXT[row.key]} />
                  </View>
                )}
              </View>
              <Text style={[styles.rowPoints, { color: barColor }]}>
                {formatPoints(row.points)}
              </Text>
              <Ionicons
                name={isExpanded ? 'chevron-up-outline' : 'chevron-down-outline'}
                size={16}
                color={Colors.textSecondary}
                style={styles.chevron}
              />
            </TouchableOpacity>

            {/* Collapsed summary */}
            {!isExpanded && summary.text !== '' && (
              <View style={styles.summaryRow}>
                {summary.isGood && (
                  <Ionicons
                    name="checkmark"
                    size={12}
                    color={SEVERITY_COLORS.good}
                    style={styles.summaryIcon}
                  />
                )}
                <Text
                  style={[
                    styles.summaryText,
                    summary.isGood && { color: SEVERITY_COLORS.good },
                  ]}
                  numberOfLines={1}
                >
                  {summary.text}
                </Text>
              </View>
            )}

            {/* Progress bar */}
            <View style={styles.barTrack}>
              {barWidthPercent > 0 && (
                <View
                  style={[
                    styles.barFill,
                    {
                      width: `${barWidthPercent}%`,
                      backgroundColor: barFillColor,
                    },
                  ]}
                />
              )}
            </View>

            {isExpanded && (
              <View style={styles.expandedContainer}>
                {renderExpandedContent(row.key, row.points)}
              </View>
            )}
          </View>
        );
      })}

      {/* Final score */}
      <View style={styles.finalRow}>
        <Text style={styles.finalLabel}>Final</Text>
        <Text style={[styles.finalScore, { color: scoreColor }]}>
          {scoredResult.finalScore}% · {verdictLabel}
        </Text>
      </View>
    </View>
  );
}

// ─── Styles ─────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    backgroundColor: Colors.card,
    borderRadius: 12,
    padding: Spacing.md,
    marginBottom: Spacing.md,
  },
  sectionHeader: {
    fontSize: FontSizes.lg,
    fontWeight: '700',
    color: Colors.textPrimary,
    marginBottom: Spacing.md,
  },
  baselineRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.cardBorder,
  },
  baselineLabel: {
    fontSize: FontSizes.sm,
    color: Colors.textSecondary,
  },
  baselineDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: Colors.textSecondary,
  },
  row: {
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.cardBorder,
  },
  rowHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  rowLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  rowLabel: {
    fontSize: FontSizes.md,
    fontWeight: '600',
    color: Colors.textPrimary,
  },
  tooltipWrap: {
    marginLeft: 8,
  },
  rowPoints: {
    fontSize: FontSizes.md,
    fontWeight: '600',
    fontFamily: MONOSPACE_FONT,
    flexShrink: 0,
  },
  chevron: {
    marginLeft: 6,
  },
  summaryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  summaryIcon: {
    marginRight: 4,
  },
  summaryText: {
    fontSize: 12,
    color: '#9CA3AF',
  },
  barTrack: {
    height: 3,
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    borderRadius: 2,
    overflow: 'hidden',
  },
  barFill: {
    height: 3,
    borderRadius: 2,
  },
  finalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 12,
    marginTop: 4,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.08)',
  },
  finalLabel: {
    fontSize: FontSizes.lg,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  finalScore: {
    fontSize: FontSizes.lg,
    fontWeight: '700',
  },

  // ─── Expanded Content ─────────────────────────────────
  expandedContainer: {
    backgroundColor: Colors.card,
    marginTop: 8,
    paddingLeft: 16,
    paddingTop: 8,
    paddingBottom: 4,
    borderLeftWidth: 2,
    borderLeftColor: Colors.cardBorder,
  },
  expandedItem: {
    marginBottom: 10,
  },
  expandedItemRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  expandedItemName: {
    fontSize: FontSizes.sm,
    fontWeight: '600',
    color: Colors.textPrimary,
    flex: 1,
    marginRight: 8,
  },
  expandedItemPoints: {
    fontSize: FontSizes.sm,
    fontWeight: '500',
    color: Colors.textSecondary,
  },
  expandedItemReason: {
    fontSize: FontSizes.xs,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  expandedCitation: {
    fontSize: FontSizes.xs,
    color: Colors.accent,
    textDecorationLine: 'underline',
    marginTop: 2,
  },
  expandedSummary: {
    fontSize: FontSizes.sm,
    color: Colors.textSecondary,
    lineHeight: 18,
  },
  expandedEmpty: {
    fontSize: FontSizes.sm,
    color: Colors.textTertiary,
    fontStyle: 'italic',
  },

  // ─── Grouped Ingredient Rows ───────────────────────────
  ingredientGroup: {
    marginBottom: 10,
  },
  ingredientParentRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  severityDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginRight: 8,
  },
  ingredientName: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.textPrimary,
    flex: 1,
  },
  ingredientPoints: {
    fontSize: 14,
    fontWeight: '600',
    fontFamily: MONOSPACE_FONT,
    marginRight: 6,
  },
  ingredientTooltipWrap: {
    flexShrink: 0,
  },
  subReasonContainer: {
    marginLeft: 3,
    paddingLeft: 19,
    borderLeftWidth: 2,
    marginTop: 4,
  },
  subReasonRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 2,
  },
  subReasonText: {
    fontSize: FontSizes.sm,
    color: '#9CA3AF',
    flex: 1,
    marginRight: 8,
  },
  subReasonPoints: {
    fontSize: FontSizes.sm,
    color: '#9CA3AF',
    fontFamily: MONOSPACE_FONT,
  },
});
===
// ScoreWaterfall — Visual breakdown of score calculation, layer by layer (D-094).
// Shows how the final suitability score was derived from 100 down.
// D-094: pet-named layer labels. D-084: zero emoji. D-095: no editorial copy.
// Interactive accordion: expand/collapse each layer for detailed breakdown.

import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  LayoutAnimation,
  Platform,
  UIManager,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { ScoredResult, Penalty, AppliedRule, PersonalizationDetail, IngredientPenaltyResult, ProductIngredient } from '../../types/scoring';
import { Colors, FontSizes, Spacing, SCORING_WEIGHTS, SEVERITY_COLORS, AAFCO_STATEMENT_STATUS, getScoreColor } from '../../utils/constants';
import { toDisplayName } from '../../utils/formatters';
import { InfoTooltip } from '../ui/InfoTooltip';

// Enable LayoutAnimation on Android
if (
  Platform.OS === 'android' &&
  UIManager.setLayoutAnimationEnabledExperimental
) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

// ─── Props ──────────────────────────────────────────────

interface ScoreWaterfallProps {
  scoredResult: ScoredResult;
  petName: string;
  species: 'dog' | 'cat';
  category: 'daily_food' | 'treat' | 'supplemental';
  ingredients?: ProductIngredient[];
}

// Weights imported from constants.ts — single source of truth (D-010, D-136)
const WEIGHTS = SCORING_WEIGHTS;

// ─── Tooltip Copy ────────────────────────────────────────

const TOOLTIP_TEXT: Record<string, string> = {
  iq: 'Point values reflect ingredient quality, adjusted by position. Ingredients listed earlier carry more weight.',
  np: "How well this product's guaranteed analysis matches AAFCO nutritional standards for your pet's life stage.",
  fc: "Evaluates the product's AAFCO compliance statement, preservative type, and protein source naming.",
  species: 'Species-specific safety rules including heart health risk factors, carbohydrate load, and mandatory nutrient checks.',
  personalization: "Adjustments based on your pet's breed-specific nutritional needs and life stage.",
  allergen: "Ingredients that match allergens in your pet's health profile.",
};

const MONOSPACE_FONT = Platform.OS === 'ios' ? 'Menlo' : 'monospace';

// ─── Row Model ──────────────────────────────────────────

interface WaterfallRow {
  key: string;
  label: string;
  points: number;
}

function buildRows(
  scoredResult: ScoredResult,
  petName: string,
  species: 'dog' | 'cat',
  category: 'daily_food' | 'treat' | 'supplemental',
): WaterfallRow[] {
  const isPartial = scoredResult.isPartialScore && category === 'daily_food';
  const weightKey = category === 'treat'
    ? 'treat'
    : category === 'supplemental'
      ? 'supplemental'
      : isPartial
        ? 'daily_food_partial'
        : 'daily_food';
  const w = WEIGHTS[weightKey];
  const { layer1, layer2, layer3 } = scoredResult;
  const rows: WaterfallRow[] = [];

  // Layer 1a — Ingredient Quality
  const iqDeduction = -Math.round((100 - layer1.ingredientQuality) * w.iq);
  rows.push({ key: 'iq', label: 'Ingredients', points: iqDeduction });

  // Layer 1b — Nutritional Profile (daily food + supplemental, hidden when partial)
  if ((category === 'daily_food' || category === 'supplemental') && !isPartial) {
    const npDeduction = -Math.round((100 - layer1.nutritionalProfile) * w.np);
    rows.push({ key: 'np', label: 'Nutritional Fit', points: npDeduction });
  }

  // Layer 1c — Formulation (daily food only — 0% for supplemental/treat)
  if (category === 'daily_food') {
    const fcDeduction = -Math.round((100 - layer1.formulation) * w.fc);
    rows.push({ key: 'fc', label: 'Formulation Quality', points: fcDeduction });
  }

  // Layer 2 — Species Rules (D-094: "[Species] Safety Checks")
  const speciesLabel = species === 'dog' ? 'Canine Safety Checks' : 'Feline Safety Checks';
  rows.push({
    key: 'species',
    label: speciesLabel,
    points: layer2.speciesAdjustment,
  });

  // Layer 3 — Personalization
  const l3Total = layer3.personalizations.reduce(
    (sum, p) => sum + p.adjustment,
    0,
  );
  rows.push({ key: 'personalization', label: 'Breed & Age', points: l3Total });

  // D-129: Allergen sensitivity row (only when allergen overrides fired)
  if (scoredResult.allergenDelta > 0) {
    rows.push({
      key: 'allergen',
      label: 'Allergen Sensitivity',
      points: -Math.round(scoredResult.allergenDelta),
    });
  }

  return rows;
}

// ─── Helpers ────────────────────────────────────────────

function formatPoints(points: number): string {
  if (points === 0) return '0 pts';
  const sign = points > 0 ? '+' : '';
  return `${sign}${points} pts`;
}

function getPointsColor(points: number, severity?: 'danger' | 'caution' | 'good' | 'neutral'): string {
  if (points > 0) return Colors.severityGreen;
  if (points === 0) return Colors.textTertiary;
  // Negative: color matches ingredient severity when available
  if (severity === 'caution') return Colors.severityAmber;
  return Colors.severityRed; // danger or unspecified default
}

// formatIngredientName replaced by toDisplayName from utils/formatters

// ─── Proportional Rounding (Largest Remainder Method) ────
// Distributes an integer `total` among items proportionally to `values`,
// guaranteeing the sum of returned integers exactly equals `total`.

function distributeRounded(values: number[], total: number): number[] {
  if (total === 0 || values.length === 0) return values.map(() => 0);
  const sum = values.reduce((s, v) => s + v, 0);
  if (sum === 0) return values.map(() => 0);

  const scaled = values.map(v => (v / sum) * total);
  const floored = scaled.map(Math.floor);
  let remaining = total - floored.reduce((s, v) => s + v, 0);

  const indices = scaled
    .map((v, i) => ({ i, rem: v - floored[i] }))
    .sort((a, b) => b.rem - a.rem);

  for (const { i } of indices) {
    if (remaining <= 0) break;
    floored[i]++;
    remaining--;
  }

  return floored;
}

// ─── Ingredient-Specific Description (P1-6, D-095 compliant) ──

const ARTIFICIAL_COLORANTS = new Set([
  'red_40', 'yellow_5', 'yellow_6', 'blue_2', 'titanium_dioxide', 'red_3', 'blue_1',
]);
const SYNTHETIC_PRESERVATIVES = new Set([
  'bha', 'bht', 'tbhq', 'ethoxyquin',
]);

function getEnrichedReason(
  penalty: Penalty,
  ingredient?: ProductIngredient,
): string {
  // Already specific (unnamed species penalty from scoring engine)
  if (penalty.reason.includes('Unnamed species')) return penalty.reason;

  const name = toDisplayName(penalty.ingredientName);

  // Priority 1: tldr from ingredients_dict (D-105 content)
  if (ingredient?.tldr) return ingredient.tldr;

  // Priority 2: Property-based descriptions
  if (ingredient?.is_unnamed_species) {
    return `${name} — unnamed species source, variable supply chain`;
  }

  if (ARTIFICIAL_COLORANTS.has(penalty.ingredientName)) {
    return `${name} — artificial colorant, no nutritional function`;
  }

  if (SYNTHETIC_PRESERVATIVES.has(penalty.ingredientName)) {
    return `${name} — synthetic preservative linked to health concerns in animal studies`;
  }

  if (penalty.ingredientName.includes('by_product')) {
    return `${name} — byproduct, variable quality depending on source`;
  }

  if (penalty.ingredientName === 'propylene_glycol') {
    return `${name} — synthetic humectant, restricted in cat food by FDA`;
  }

  if (penalty.ingredientName === 'salt' && penalty.position <= 10) {
    return 'Added sodium — position suggests use as flavor enhancer';
  }

  if (penalty.ingredientName === 'sugar' || penalty.ingredientName === 'cane_molasses') {
    return `${name} — added sugar, no nutritional benefit`;
  }

  if (penalty.ingredientName === 'corn_syrup') {
    return `${name} — high-glycemic sweetener, no nutritional benefit`;
  }

  // Fallback
  return penalty.reason;
}

// ─── Expanded Content Renderers ─────────────────────────

function renderIqExpanded(
  ingredientResults: IngredientPenaltyResult[],
  headerPoints: number,
  ingredients?: ProductIngredient[],
): React.ReactNode {
  if (ingredientResults.length === 0) {
    return (
      <Text style={styles.expandedEmpty}>No ingredient concerns identified</Text>
    );
  }

  const absHeader = Math.abs(headerPoints);

  // Proportional distribution: scale position-weighted totals to match category-weighted header
  const rawTotals = ingredientResults.map(ir => ir.totalWeightedPoints);
  const displayTotals = distributeRounded(rawTotals, absHeader);

  // Build ingredient lookup for enriched reason text
  const ingredientMap = new Map<string, ProductIngredient>();
  if (ingredients) {
    for (const ing of ingredients) {
      ingredientMap.set(ing.canonical_name, ing);
    }
  }

  // Dev-mode math check
  const sum = displayTotals.reduce((s, v) => s + v, 0);
  const mathError = __DEV__ && sum !== absHeader;

  return (
    <>
      {ingredientResults.map((ir, idx) => {
        const displayTotal = displayTotals[idx];
        const dotColor = SEVERITY_COLORS[ir.severity];
        const ingredient = ingredientMap.get(ir.canonicalName);

        // Distribute ingredient total among sub-reasons
        const rawReasons = ir.reasons.map(r => r.weightedPoints);
        const displayReasons = distributeRounded(rawReasons, displayTotal);

        // Join unique citations for tooltip
        const citations = [...new Set(ir.reasons.map(r => r.citationSource))].join('; ');

        return (
          <View key={ir.canonicalName} style={styles.ingredientGroup}>
            {/* Parent row: dot + name + points + citation tooltip */}
            <View style={styles.ingredientParentRow}>
              <View style={[styles.severityDot, { backgroundColor: dotColor }]} />
              <Text style={styles.ingredientName}>
                {toDisplayName(ir.canonicalName)}
              </Text>
              <Text style={[styles.ingredientPoints, { color: dotColor }]}>
                {`\u2212${displayTotal}`}
              </Text>
              <View style={styles.ingredientTooltipWrap}>
                <InfoTooltip size={10} opacity={0.18} text={citations} />
              </View>
            </View>

            {/* Sub-reason rows with continuous left border */}
            <View style={[styles.subReasonContainer, { borderLeftColor: dotColor }]}>
              {ir.reasons.map((reason, ri) => {
                // Enrich generic engine text via getEnrichedReason, then strip name prefix
                const enriched = getEnrichedReason(
                  { ingredientName: ir.canonicalName, reason: reason.reason, rawPenalty: reason.rawPoints, positionAdjustedPenalty: reason.weightedPoints, position: ir.position, citationSource: reason.citationSource },
                  ingredient,
                );
                const dashIdx = enriched.indexOf(' \u2014 ');
                const displayReason = dashIdx >= 0
                  ? enriched.charAt(dashIdx + 3).toUpperCase() + enriched.slice(dashIdx + 4)
                  : enriched;

                return (
                  <View key={ri} style={styles.subReasonRow}>
                    <Text style={styles.subReasonText} numberOfLines={2}>
                      {displayReason}
                    </Text>
                    <Text style={styles.subReasonPoints}>
                      ({`\u2212${displayReasons[ri]}`})
                    </Text>
                  </View>
                );
              })}
            </View>
          </View>
        );
      })}
      {__DEV__ && mathError && (
        <Text style={{ color: '#EF4444', fontSize: 11 }}>
          {'\u26A0'} Display math: items sum to {sum}, header shows {absHeader}
        </Text>
      )}
    </>
  );
}

function renderNpExpanded(scoredResult: ScoredResult): React.ReactNode {
  const npScore = scoredResult.layer1.nutritionalProfile;
  return (
    <View style={styles.expandedItem}>
      <Text style={styles.expandedSummary}>
        Nutritional adequacy scored {npScore}/100 based on guaranteed analysis values vs AAFCO thresholds
      </Text>
    </View>
  );
}

function renderFcExpanded(_scoredResult: ScoredResult): React.ReactNode {
  return (
    <View style={styles.expandedItem}>
      <Text style={styles.expandedSummary}>
        Based on AAFCO compliance, preservative quality, and protein source naming
      </Text>
    </View>
  );
}

function renderSpeciesExpanded(appliedRules: AppliedRule[]): React.ReactNode {
  const firedRules = appliedRules.filter((r) => r.fired);

  if (firedRules.length === 0) {
    return (
      <Text style={styles.expandedEmpty}>
        No species-specific adjustments applied
      </Text>
    );
  }

  return firedRules.map((rule) => (
    <View key={rule.ruleId} style={styles.expandedItem}>
      <View style={styles.expandedItemRow}>
        <Text style={styles.expandedItemName} numberOfLines={1}>
          {rule.label}
        </Text>
        <Text style={styles.expandedItemPoints}>
          {rule.adjustment > 0 ? '+' : ''}{rule.adjustment} pts
        </Text>
      </View>
      {rule.citation && (
        <TouchableOpacity activeOpacity={0.7}>
          <Text style={styles.expandedCitation}>{rule.citation}</Text>
        </TouchableOpacity>
      )}
    </View>
  ));
}

function renderPersonalizationExpanded(
  personalizations: PersonalizationDetail[],
  petName: string,
): React.ReactNode {
  // Filter out breed_contraindications (shown separately as cards)
  const adjustments = personalizations.filter(
    (p) => p.type !== 'breed_contraindication',
  );

  if (adjustments.length === 0) {
    return (
      <Text style={styles.expandedEmpty}>
        No breed or age adjustments for {petName}'s profile
      </Text>
    );
  }

  return adjustments.map((p, i) => (
    <View key={`${p.type}-${p.label}-${i}`} style={styles.expandedItem}>
      <View style={styles.expandedItemRow}>
        <Text style={styles.expandedItemName} numberOfLines={1}>
          {p.label}
        </Text>
        <Text style={styles.expandedItemPoints}>
          {p.adjustment > 0 ? '+' : ''}{p.adjustment} pts
        </Text>
      </View>
    </View>
  ));
}

function renderAllergenExpanded(
  allergenWarnings: PersonalizationDetail[],
  petName: string,
): React.ReactNode {
  if (allergenWarnings.length === 0) {
    return (
      <Text style={styles.expandedEmpty}>
        No allergen matches for {petName}
      </Text>
    );
  }

  return allergenWarnings.map((w, i) => (
    <View key={`allergen-${i}`} style={styles.expandedItem}>
      <Text style={styles.expandedSummary}>{w.label}</Text>
    </View>
  ));
}

// ─── Collapsed Summary Logic ─────────────────────────────

function getSummaryContent(
  key: string,
  scoredResult: ScoredResult,
): { text: string; isGood: boolean } {
  switch (key) {
    case 'iq': {
      const count = scoredResult.ingredientPenalties.length;
      if (count === 0) return { text: 'No ingredient concerns', isGood: true };
      return { text: `${count} ingredient${count !== 1 ? 's' : ''} flagged`, isGood: false };
    }
    case 'np': {
      if (scoredResult.layer1.nutritionalProfile >= 100) {
        return { text: 'All nutrients within range', isGood: true };
      }
      return { text: 'Nutritional gaps detected', isGood: false };
    }
    case 'fc': {
      if (scoredResult.flags.includes('aafco_statement_not_available')) {
        return { text: AAFCO_STATEMENT_STATUS.missing.collapsedSummary, isGood: false };
      }
      if (scoredResult.flags.includes('aafco_statement_unrecognized')) {
        return { text: AAFCO_STATEMENT_STATUS.unrecognized.collapsedSummary, isGood: false };
      }
      return { text: 'Complete AAFCO statement verified', isGood: true };
    }
    case 'species': {
      const fired = scoredResult.layer2.appliedRules.filter((r) => r.fired);
      if (fired.length === 0) return { text: 'No species-specific concerns', isGood: true };
      return { text: fired[0].label, isGood: false };
    }
    case 'personalization': {
      const adjustments = scoredResult.layer3.personalizations.filter(
        (p) => p.type !== 'breed_contraindication',
      );
      if (adjustments.length === 0) return { text: 'No breed-specific adjustments', isGood: true };
      return { text: adjustments[0].label, isGood: false };
    }
    case 'allergen': {
      const warnings = scoredResult.layer3.allergenWarnings;
      if (warnings.length === 0) return { text: 'No allergen matches', isGood: true };
      return { text: warnings[0].label, isGood: false };
    }
    default:
      return { text: '', isGood: false };
  }
}

// ─── Component ──────────────────────────────────────────

export function ScoreWaterfall({
  scoredResult,
  petName,
  species,
  category,
  ingredients,
}: ScoreWaterfallProps) {
  const [expandedKey, setExpandedKey] = useState<string | null>(null);
  const rows = buildRows(scoredResult, petName, species, category);
  const maxMagnitude = Math.max(
    ...rows.map((r) => Math.abs(r.points)),
    1, // avoid division by zero
  );
  const isSupplemental = category === 'supplemental';
  const scoreColor = getScoreColor(scoredResult.finalScore, isSupplemental);
  const verdictLabel = scoredResult.finalScore >= 85 ? 'Excellent match'
    : scoredResult.finalScore >= 70 ? 'Good match'
    : scoredResult.finalScore >= 65 ? 'Fair match'
    : scoredResult.finalScore >= 51 ? 'Low match'
    : 'Poor match';

  const toggleRow = (key: string) => {
    LayoutAnimation.configureNext({
      duration: 250,
      create: { type: LayoutAnimation.Types.easeInEaseOut, property: LayoutAnimation.Properties.opacity },
      update: { type: LayoutAnimation.Types.easeInEaseOut },
      delete: { type: LayoutAnimation.Types.easeInEaseOut, property: LayoutAnimation.Properties.opacity },
    });
    setExpandedKey((prev) => (prev === key ? null : key));
  };

  const renderExpandedContent = (key: string, rowPoints: number): React.ReactNode => {
    switch (key) {
      case 'iq':
        return renderIqExpanded(scoredResult.ingredientResults, rowPoints, ingredients);
      case 'np':
        return renderNpExpanded(scoredResult);
      case 'fc':
        return renderFcExpanded(scoredResult);
      case 'species':
        return renderSpeciesExpanded(scoredResult.layer2.appliedRules);
      case 'personalization':
        return renderPersonalizationExpanded(
          scoredResult.layer3.personalizations,
          petName,
        );
      case 'allergen':
        return renderAllergenExpanded(scoredResult.layer3.allergenWarnings, petName);
      default:
        return null;
    }
  };

  return (
    <View style={styles.container}>
      {/* Baseline */}
      <View style={styles.baselineRow}>
        <Text style={styles.baselineLabel}>Starts at 100</Text>
        <View style={styles.baselineDot} />
      </View>

      {/* Layer rows */}
      {rows.map((row) => {
        const isExpanded = expandedKey === row.key;
        const barColor = getPointsColor(row.points);
        const summary = getSummaryContent(row.key, scoredResult);

        return (
          <View key={row.key} style={styles.row}>
            <TouchableOpacity
              style={styles.rowHeader}
              onPress={() => toggleRow(row.key)}
              activeOpacity={0.7}
            >
              <View style={styles.rowLeft}>
                <Text style={styles.rowLabel}>
                  {row.label}
                </Text>
                {TOOLTIP_TEXT[row.key] && (
                  <View style={styles.tooltipWrap}>
                    <InfoTooltip text={TOOLTIP_TEXT[row.key]} />
                  </View>
                )}
              </View>
              <Text style={[styles.rowPoints, { color: barColor }]}>
                {formatPoints(row.points)}
              </Text>
              <Ionicons
                name={isExpanded ? 'chevron-up-outline' : 'chevron-down-outline'}
                size={16}
                color={Colors.textSecondary}
                style={styles.chevron}
              />
            </TouchableOpacity>

            {/* Collapsed summary with status dot */}
            {!isExpanded && summary.text !== '' && (
              <View style={styles.summaryRow}>
                {summary.isGood ? (
                  <Ionicons
                    name="checkmark"
                    size={12}
                    color={SEVERITY_COLORS.good}
                    style={styles.summaryIcon}
                  />
                ) : (
                  <View style={[styles.statusDot, {
                    backgroundColor: Colors.severityAmber,
                  }]} />
                )}
                <Text
                  style={[
                    styles.summaryText,
                    summary.isGood && { color: SEVERITY_COLORS.good },
                  ]}
                  numberOfLines={1}
                >
                  {summary.text}
                </Text>
              </View>
            )}



            {isExpanded && (
              <View style={styles.expandedContainer}>
                {renderExpandedContent(row.key, row.points)}
              </View>
            )}
          </View>
        );
      })}

      {/* Final score */}
      <View style={styles.finalRow}>
        <Text style={styles.finalLabel}>Final</Text>
        <Text style={[styles.finalScore, { color: scoreColor }]}>
          {scoredResult.finalScore}% · {verdictLabel}
        </Text>
      </View>
    </View>
  );
}

// ─── Styles ─────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    backgroundColor: Colors.cardSurface,
    borderRadius: 12,
    padding: Spacing.md,
    marginBottom: Spacing.md,
  },
  sectionHeader: {
    fontSize: FontSizes.lg,
    fontWeight: '700',
    color: Colors.textPrimary,
    marginBottom: Spacing.md,
  },
  baselineRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.hairlineBorder,
  },
  baselineLabel: {
    fontSize: FontSizes.sm,
    color: Colors.textSecondary,
  },
  baselineDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: Colors.textSecondary,
  },
  row: {
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.hairlineBorder,
  },
  rowHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  rowLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  rowLabel: {
    fontSize: FontSizes.md,
    fontWeight: '600',
    color: Colors.textPrimary,
  },
  tooltipWrap: {
    marginLeft: 8,
  },
  rowPoints: {
    fontSize: FontSizes.md,
    fontWeight: '600',
    fontFamily: MONOSPACE_FONT,
    flexShrink: 0,
  },
  chevron: {
    marginLeft: 6,
  },
  summaryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  summaryIcon: {
    marginRight: 4,
  },
  summaryText: {
    fontSize: 12,
    color: '#9CA3AF',
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 4,
  },

  finalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 12,
    marginTop: 4,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.08)',
  },
  finalLabel: {
    fontSize: FontSizes.lg,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  finalScore: {
    fontSize: FontSizes.lg,
    fontWeight: '700',
  },

  // ─── Expanded Content ─────────────────────────────────
  expandedContainer: {
    backgroundColor: Colors.card,
    marginTop: 8,
    paddingLeft: 16,
    paddingTop: 8,
    paddingBottom: 4,
    borderLeftWidth: 2,
    borderLeftColor: Colors.hairlineBorder,
  },
  expandedItem: {
    marginBottom: 10,
  },
  expandedItemRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  expandedItemName: {
    fontSize: FontSizes.sm,
    fontWeight: '600',
    color: Colors.textPrimary,
    flex: 1,
    marginRight: 8,
  },
  expandedItemPoints: {
    fontSize: FontSizes.sm,
    fontWeight: '500',
    color: Colors.textSecondary,
  },
  expandedItemReason: {
    fontSize: FontSizes.xs,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  expandedCitation: {
    fontSize: FontSizes.xs,
    color: Colors.accent,
    textDecorationLine: 'underline',
    marginTop: 2,
  },
  expandedSummary: {
    fontSize: FontSizes.sm,
    color: Colors.textSecondary,
    lineHeight: 18,
  },
  expandedEmpty: {
    fontSize: FontSizes.sm,
    color: Colors.textTertiary,
    fontStyle: 'italic',
  },

  // ─── Grouped Ingredient Rows ───────────────────────────
  ingredientGroup: {
    marginBottom: 10,
  },
  ingredientParentRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  severityDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginRight: 8,
  },
  ingredientName: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.textPrimary,
    flex: 1,
  },
  ingredientPoints: {
    fontSize: 14,
    fontWeight: '600',
    fontFamily: MONOSPACE_FONT,
    marginRight: 6,
  },
  ingredientTooltipWrap: {
    flexShrink: 0,
  },
  subReasonContainer: {
    marginLeft: 3,
    paddingLeft: 19,
    borderLeftWidth: 2,
    marginTop: 4,
  },
  subReasonRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 2,
  },
  subReasonText: {
    fontSize: FontSizes.sm,
    color: '#9CA3AF',
    flex: 1,
    marginRight: 8,
  },
  subReasonPoints: {
    fontSize: FontSizes.sm,
    color: '#9CA3AF',
    fontFamily: MONOSPACE_FONT,
  },
});
```

- Deleted the `barTrack` + `barFill` views (thin hairlines that looked like render glitches)
- Added **amber status dots** (8px circles) next to non-good summaries
- Green checkmarks remain for "no concerns" rows

### Fix 7: Fill Wireframes — Solid Badge Pills
- Neutral pills (Daily Food, Wet, Adult, etc.) now use solid `#2A2A2E` background with `Colors.textPrimary` white text
- No more hollow wireframe outlines

### Fix 8: Delete Floating Share Button
- Removed the mid-scroll `<TouchableOpacity>Share Result</TouchableOpacity>`
- Header share icon (top-right) remains the single share entry point
- Removed unused `shareButton` + `shareButtonText` styles

### Fix 9: Position Map Legend
```diff:PositionMap.tsx
// Kiba — Position Map
// Horizontal strip of colored segments representing ingredient composition.
// First ingredient = widest segment, tapering right. Color = severity.
// Tap a segment to identify; tap again to dismiss. Zero emoji (D-084).

import React, { useState } from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';

import { Colors, FontSizes, Spacing, SEVERITY_COLORS } from '../../utils/constants';
import { toDisplayName } from '../../utils/formatters';

// ─── Props ──────────────────────────────────────────────

interface PositionMapProps {
  ingredients: Array<{
    canonical_name: string;
    position: number;
    severity: 'good' | 'neutral' | 'caution' | 'danger';
    allergenOverride?: boolean;
  }>;
  onSegmentPress?: (position: number) => void;
}

// ─── Severity → Color ──────────────────────────────────

// SEVERITY_COLORS imported from constants.ts — single source of truth

const UNRATED_COLOR = '#C7C7CC'; // unrated — no severity assigned
const ALLERGEN_BORDER_COLOR = Colors.severityAmber;

// ─── Position Weight ────────────────────────────────────

function getPositionWeight(pos: number): number {
  if (pos === 1) return 15;
  if (pos === 2) return 12;
  if (pos >= 3 && pos <= 5) return 10;
  if (pos >= 6 && pos <= 10) return 5;
  return 2;
}

// ─── Component ──────────────────────────────────────────

export function PositionMap({ ingredients, onSegmentPress }: PositionMapProps) {
  if (ingredients.length === 0) return null;

  const [selectedPosition, setSelectedPosition] = useState<number | null>(null);
  const [labelWidth, setLabelWidth] = useState(0);
  const [barWidth, setBarWidth] = useState(0);

  const sorted = [...ingredients].sort((a, b) => a.position - b.position);

  // Compute raw weights and normalize to 100%
  const rawWeights = sorted.map((ing) => getPositionWeight(ing.position));
  const totalWeight = rawWeights.reduce((sum, w) => sum + w, 0);

  // Cumulative widths for label positioning
  const cumulativeWidths: number[] = [];
  let cumWidth = 0;
  for (let i = 0; i < sorted.length; i++) {
    cumulativeWidths.push(cumWidth);
    cumWidth += rawWeights[i];
  }

  // Find the cumulative weight% where position 10 ends (for Top 10 marker)
  let top10CumulativePct = 0;
  let top10Found = false;
  let cumulativeWeight = 0;
  for (let idx = 0; idx < sorted.length; idx++) {
    cumulativeWeight += rawWeights[idx];
    if (sorted[idx].position >= 10 && !top10Found) {
      top10CumulativePct = (cumulativeWeight / totalWeight) * 100;
      top10Found = true;
    }
  }

  // ─── Tap handler: toggle segment selection ──────────
  function handleSegmentTap(position: number) {
    setSelectedPosition((prev) => {
      if (prev === position) return null; // tap same → dismiss
      return position;
    });
    setLabelWidth(0); // re-measure for new label
    onSegmentPress?.(position);
  }

  // Selected segment label data
  const selectedIdx = selectedPosition != null
    ? sorted.findIndex(s => s.position === selectedPosition)
    : -1;
  const labelCenterPct = selectedIdx >= 0
    ? ((cumulativeWidths[selectedIdx] + rawWeights[selectedIdx] / 2) / totalWeight) * 100
    : 0;
  const selectedDisplayName = selectedIdx >= 0
    ? `${toDisplayName(sorted[selectedIdx].canonical_name)} #${selectedIdx + 1}`
    : '';

  return (
    <View style={styles.container}>
      <Text style={styles.sectionTitle}>Ingredient Composition</Text>
      <View
        style={[styles.barWrapper, selectedIdx >= 0 && { marginBottom: 36 }]}
        onLayout={(e) => setBarWidth(e.nativeEvent.layout.width)}
      >
        {/* Floating label below bar — clamped to bar edges */}
        {selectedIdx >= 0 && (
          <View
            key={selectedPosition}
            style={[
              styles.floatingLabel,
              {
                left: (() => {
                  if (barWidth === 0 || labelWidth === 0) return `${labelCenterPct}%`;
                  const LABEL_MARGIN = 4;
                  const centerPx = (labelCenterPct / 100) * barWidth;
                  const idealLeft = centerPx - labelWidth / 2;
                  return Math.max(LABEL_MARGIN, Math.min(idealLeft, barWidth - labelWidth - LABEL_MARGIN));
                })(),
                opacity: labelWidth === 0 ? 0 : 1,
              },
            ]}
            onLayout={(e) => setLabelWidth(e.nativeEvent.layout.width)}
          >
            <Text style={styles.floatingLabelText}>{selectedDisplayName}</Text>
          </View>
        )}

        <View style={styles.bar}>
          {sorted.map((ing, idx) => {
            const widthPct = (rawWeights[idx] / totalWeight) * 100;
            const color = SEVERITY_COLORS[ing.severity] ?? UNRATED_COLOR;
            const hasAllergenBorder = ing.allergenOverride === true;
            const isDimmed = selectedPosition != null && selectedPosition !== ing.position;

            return (
              <Pressable
                key={`${ing.position}-${ing.canonical_name}`}
                onPress={() => handleSegmentTap(ing.position)}
                style={[
                  styles.segment,
                  {
                    width: `${widthPct}%`,
                    backgroundColor: color,
                    opacity: isDimmed ? 0.4 : 1,
                  },
                  hasAllergenBorder && styles.allergenBorder,
                  idx === 0 && styles.firstSegment,
                  idx === sorted.length - 1 && styles.lastSegment,
                ]}
              />
            );
          })}
        </View>
        {/* Inner highlight for depth */}
        <View style={styles.barHighlight} pointerEvents="none" />
        {/* Top 10 divider */}
        {top10Found && top10CumulativePct < 98 && (
          <View style={[styles.top10Line, { left: `${top10CumulativePct}%` }]} pointerEvents="none" />
        )}
      </View>
      {top10Found && top10CumulativePct < 98 && (
        <Text style={styles.top10Label}>Top 10</Text>
      )}
    </View>
  );
}

// ─── Styles ─────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    marginBottom: Spacing.md,
  },
  sectionTitle: {
    fontSize: FontSizes.lg,
    fontWeight: '700',
    color: Colors.textPrimary,
    marginBottom: Spacing.sm,
  },
  barWrapper: {
    position: 'relative',
    height: 20,
  },
  bar: {
    flexDirection: 'row',
    height: 20,
    borderRadius: 10,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.15,
    shadowRadius: 3,
    elevation: 2,
  },
  barHighlight: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 10,
    height: 8,
    borderRadius: 10,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
  },
  segment: {
    height: '100%',
  },
  firstSegment: {
    borderTopLeftRadius: 10,
    borderBottomLeftRadius: 10,
  },
  lastSegment: {
    borderTopRightRadius: 10,
    borderBottomRightRadius: 10,
  },
  allergenBorder: {
    borderWidth: 2,
    borderColor: ALLERGEN_BORDER_COLOR,
  },
  top10Line: {
    position: 'absolute',
    width: 2,
    height: 26,
    backgroundColor: 'rgba(255, 255, 255, 0.5)',
    top: -3,
    marginLeft: -1,
    borderRadius: 1,
  },
  top10Label: {
    fontSize: FontSizes.xs,
    color: Colors.textTertiary,
    marginTop: 4,
  },
  floatingLabel: {
    position: 'absolute',
    top: 26,
    backgroundColor: '#1F1F1F',
    padding: 8,
    borderRadius: 6,
    zIndex: 10,
  },
  floatingLabelText: {
    color: '#FFFFFF',
    fontSize: 11,
  },
});
===
// Kiba — Position Map
// Horizontal strip of colored segments representing ingredient composition.
// First ingredient = widest segment, tapering right. Color = severity.
// Tap a segment to identify; tap again to dismiss. Zero emoji (D-084).

import React, { useState } from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';

import { Colors, FontSizes, Spacing, SEVERITY_COLORS } from '../../utils/constants';
import { toDisplayName } from '../../utils/formatters';

// ─── Props ──────────────────────────────────────────────

interface PositionMapProps {
  ingredients: Array<{
    canonical_name: string;
    position: number;
    severity: 'good' | 'neutral' | 'caution' | 'danger';
    allergenOverride?: boolean;
  }>;
  onSegmentPress?: (position: number) => void;
}

// ─── Severity → Color ──────────────────────────────────

// SEVERITY_COLORS imported from constants.ts — single source of truth

const UNRATED_COLOR = '#C7C7CC'; // unrated — no severity assigned
const ALLERGEN_BORDER_COLOR = Colors.severityAmber;

// ─── Position Weight ────────────────────────────────────

function getPositionWeight(pos: number): number {
  if (pos === 1) return 15;
  if (pos === 2) return 12;
  if (pos >= 3 && pos <= 5) return 10;
  if (pos >= 6 && pos <= 10) return 5;
  return 2;
}

// ─── Component ──────────────────────────────────────────

export function PositionMap({ ingredients, onSegmentPress }: PositionMapProps) {
  if (ingredients.length === 0) return null;

  const [selectedPosition, setSelectedPosition] = useState<number | null>(null);
  const [labelWidth, setLabelWidth] = useState(0);
  const [barWidth, setBarWidth] = useState(0);

  const sorted = [...ingredients].sort((a, b) => a.position - b.position);

  // Compute raw weights and normalize to 100%
  const rawWeights = sorted.map((ing) => getPositionWeight(ing.position));
  const totalWeight = rawWeights.reduce((sum, w) => sum + w, 0);

  // Cumulative widths for label positioning
  const cumulativeWidths: number[] = [];
  let cumWidth = 0;
  for (let i = 0; i < sorted.length; i++) {
    cumulativeWidths.push(cumWidth);
    cumWidth += rawWeights[i];
  }

  // Find the cumulative weight% where position 10 ends (for Top 10 marker)
  let top10CumulativePct = 0;
  let top10Found = false;
  let cumulativeWeight = 0;
  for (let idx = 0; idx < sorted.length; idx++) {
    cumulativeWeight += rawWeights[idx];
    if (sorted[idx].position >= 10 && !top10Found) {
      top10CumulativePct = (cumulativeWeight / totalWeight) * 100;
      top10Found = true;
    }
  }

  // ─── Tap handler: toggle segment selection ──────────
  function handleSegmentTap(position: number) {
    setSelectedPosition((prev) => {
      if (prev === position) return null; // tap same → dismiss
      return position;
    });
    setLabelWidth(0); // re-measure for new label
    onSegmentPress?.(position);
  }

  // Selected segment label data
  const selectedIdx = selectedPosition != null
    ? sorted.findIndex(s => s.position === selectedPosition)
    : -1;
  const labelCenterPct = selectedIdx >= 0
    ? ((cumulativeWidths[selectedIdx] + rawWeights[selectedIdx] / 2) / totalWeight) * 100
    : 0;
  const selectedDisplayName = selectedIdx >= 0
    ? `${toDisplayName(sorted[selectedIdx].canonical_name)} #${selectedIdx + 1}`
    : '';

  return (
    <View style={styles.container}>
      <Text style={styles.sectionTitle}>Ingredient Composition</Text>
      <View
        style={[styles.barWrapper, selectedIdx >= 0 && { marginBottom: 36 }]}
        onLayout={(e) => setBarWidth(e.nativeEvent.layout.width)}
      >
        {/* Floating label below bar — clamped to bar edges */}
        {selectedIdx >= 0 && (
          <View
            key={selectedPosition}
            style={[
              styles.floatingLabel,
              {
                left: (() => {
                  if (barWidth === 0 || labelWidth === 0) return `${labelCenterPct}%`;
                  const LABEL_MARGIN = 4;
                  const centerPx = (labelCenterPct / 100) * barWidth;
                  const idealLeft = centerPx - labelWidth / 2;
                  return Math.max(LABEL_MARGIN, Math.min(idealLeft, barWidth - labelWidth - LABEL_MARGIN));
                })(),
                opacity: labelWidth === 0 ? 0 : 1,
              },
            ]}
            onLayout={(e) => setLabelWidth(e.nativeEvent.layout.width)}
          >
            <Text style={styles.floatingLabelText}>{selectedDisplayName}</Text>
          </View>
        )}

        <View style={styles.bar}>
          {sorted.map((ing, idx) => {
            const widthPct = (rawWeights[idx] / totalWeight) * 100;
            const color = SEVERITY_COLORS[ing.severity] ?? UNRATED_COLOR;
            const hasAllergenBorder = ing.allergenOverride === true;
            const isDimmed = selectedPosition != null && selectedPosition !== ing.position;

            return (
              <Pressable
                key={`${ing.position}-${ing.canonical_name}`}
                onPress={() => handleSegmentTap(ing.position)}
                style={[
                  styles.segment,
                  {
                    width: `${widthPct}%`,
                    backgroundColor: color,
                    opacity: isDimmed ? 0.4 : 1,
                  },
                  hasAllergenBorder && styles.allergenBorder,
                  idx === 0 && styles.firstSegment,
                  idx === sorted.length - 1 && styles.lastSegment,
                ]}
              />
            );
          })}
        </View>
        {/* Inner highlight for depth */}
        <View style={styles.barHighlight} pointerEvents="none" />
        {/* Top 10 divider */}
        {top10Found && top10CumulativePct < 98 && (
          <View style={[styles.top10Line, { left: `${top10CumulativePct}%` }]} pointerEvents="none" />
        )}
      </View>
      {top10Found && top10CumulativePct < 98 && (
        <Text style={styles.top10Label}>Top 10</Text>
      )}

      {/* Legend */}
      <View style={styles.legend}>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: SEVERITY_COLORS.good }]} />
          <Text style={styles.legendLabel}>Good</Text>
        </View>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: SEVERITY_COLORS.neutral }]} />
          <Text style={styles.legendLabel}>Neutral</Text>
        </View>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: SEVERITY_COLORS.caution }]} />
          <Text style={styles.legendLabel}>Caution</Text>
        </View>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: SEVERITY_COLORS.danger }]} />
          <Text style={styles.legendLabel}>Concern</Text>
        </View>
      </View>
    </View>
  );
}

// ─── Styles ─────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    marginBottom: Spacing.md,
  },
  sectionTitle: {
    fontSize: FontSizes.lg,
    fontWeight: '700',
    color: Colors.textPrimary,
    marginBottom: Spacing.sm,
  },
  barWrapper: {
    position: 'relative',
    height: 20,
  },
  bar: {
    flexDirection: 'row',
    height: 20,
    borderRadius: 10,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.15,
    shadowRadius: 3,
    elevation: 2,
  },
  barHighlight: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 10,
    height: 8,
    borderRadius: 10,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
  },
  segment: {
    height: '100%',
  },
  firstSegment: {
    borderTopLeftRadius: 10,
    borderBottomLeftRadius: 10,
  },
  lastSegment: {
    borderTopRightRadius: 10,
    borderBottomRightRadius: 10,
  },
  allergenBorder: {
    borderWidth: 2,
    borderColor: ALLERGEN_BORDER_COLOR,
  },
  top10Line: {
    position: 'absolute',
    width: 2,
    height: 26,
    backgroundColor: 'rgba(255, 255, 255, 0.5)',
    top: -3,
    marginLeft: -1,
    borderRadius: 1,
  },
  top10Label: {
    fontSize: FontSizes.xs,
    color: Colors.textTertiary,
    marginTop: 4,
  },
  floatingLabel: {
    position: 'absolute',
    top: 26,
    backgroundColor: '#1F1F1F',
    padding: 8,
    borderRadius: 6,
    zIndex: 10,
  },
  floatingLabelText: {
    color: '#FFFFFF',
    fontSize: 11,
  },
  legend: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 16,
    marginTop: Spacing.sm,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  legendDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  legendLabel: {
    fontSize: FontSizes.xs,
    color: Colors.textSecondary,
  },
});
```

Added a 4-color legend (Good / Neutral / Caution / Concern) below the ingredient composition bar.

---

## Legacy Token Migration

All `Colors.card` → `Colors.cardSurface` and `Colors.cardBorder` → `Colors.hairlineBorder` references migrated in:
- ResultScreenStyles.ts (9 references)
- SafeSwapSection.tsx (6 references)
- AafcoProgressBars.tsx (2 references)
- ScoreWaterfall.tsx (4 references)
- IngredientDetailModal.tsx (2 references)

---

## Verification

- **TypeScript**: `npx tsc --noEmit` — zero new errors (only pre-existing Supabase edge function `.ts` extension issues)
- **Visual**: All changes need to be verified on-device via `npx expo start`
