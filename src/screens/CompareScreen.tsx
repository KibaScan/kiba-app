// M6 CompareScreen — Two-column side-by-side product comparison.
// Premium-gated (canCompare). D-095 compliant: factual, never editorial.
// All scores computed on-the-fly via scoreProduct() — never cached/base.

import React, { useEffect, useState, useCallback, useMemo, type ComponentProps } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  Image,
  ActivityIndicator,
} from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { supabase } from '../services/supabase';
import { scoreProduct, PipelineResult } from '../services/scoring/pipeline';
import { computeKeyDifferences, KeyDifference } from '../utils/keyDifferences';
import { ScoreRing, getScoreColor } from '../components/scoring/ScoreRing';
import { Colors, FontSizes, Spacing, SCORING_WEIGHTS } from '../utils/constants';
import { stripBrandFromName, toDisplayName } from '../utils/formatters';
import { getPetAllergens, getPetConditions } from '../services/petService';
import { useActivePetStore } from '../stores/useActivePetStore';
import { CompareProductPickerSheet } from '../components/compare/CompareProductPickerSheet';
import type { ScanStackParamList } from '../types/navigation';
import type { Product } from '../types';
import { resolveKcalPerCup } from '../utils/calorieEstimation';
import type { ProductIngredient, ScoredResult } from '../types/scoring';

// ─── Constants ──────────────────────────────────────────

const BUCKET_LABELS = [
  { key: 'ingredientQuality' as const, label: 'Ingredient Quality', maxKey: 'iq' as const },
  { key: 'nutritionalProfile' as const, label: 'Nutritional Profile', maxKey: 'np' as const },
  { key: 'formulation' as const, label: 'Formulation', maxKey: 'fc' as const },
];

const NUTRITION_ROWS = [
  { key: 'protein', label: 'Protein', field: 'ga_protein_pct' as const },
  { key: 'fat', label: 'Fat', field: 'ga_fat_pct' as const },
  { key: 'fiber', label: 'Fiber', field: 'ga_fiber_pct' as const },
  { key: 'moisture', label: 'Moisture', field: 'ga_moisture_pct' as const },
];

const SEVERITY_DOT: Record<string, string> = {
  danger: Colors.severityRed,
  caution: Colors.severityAmber,
  neutral: Colors.textTertiary,
  good: Colors.severityGreen,
};

const KEY_DIFF_ICONS: Record<KeyDifference['icon'], ComponentProps<typeof Ionicons>['name']> = {
  warning: 'warning',
  checkmark: 'checkmark-circle',
  'arrow-up': 'arrow-up-circle',
  'arrow-down': 'arrow-down-circle',
};

const KEY_DIFF_COLORS: Record<KeyDifference['severity'], string> = {
  negative: Colors.severityRed,
  positive: Colors.severityGreen,
  neutral: Colors.textSecondary,
};

type Props = NativeStackScreenProps<ScanStackParamList, 'Compare'>;

// ─── Component ──────────────────────────────────────────

export default function CompareScreen({ route, navigation }: Props) {
  const { productAId, productBId: initialBId, petId } = route.params;
  const insets = useSafeAreaInsets();

  // ─── State ──────────────────────────────────────────────
  const [productBId, setProductBId] = useState(initialBId);
  const [productA, setProductA] = useState<Product | null>(null);
  const [productB, setProductB] = useState<Product | null>(null);
  const [resultA, setResultA] = useState<PipelineResult | null>(null);
  const [resultB, setResultB] = useState<PipelineResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pickerVisible, setPickerVisible] = useState(false);
  const [ingredientsExpanded, setIngredientsExpanded] = useState(false);
  const [petAllergens, setPetAllergens] = useState<string[]>([]);

  // Pet data
  const pets = useActivePetStore((s) => s.pets);
  const pet = useMemo(() => pets.find((p) => p.id === petId) ?? null, [pets, petId]);
  const otherPets = useMemo(
    () => pets.filter(p => p.species === pet?.species && p.id !== petId),
    [pets, pet, petId],
  );

  // ─── Other pets' scores (lazy-loaded on expand) ────────
  const [otherPetScores, setOtherPetScores] = useState<
    Map<string, { scoreA: number; scoreB: number }>
  >(new Map());
  const [otherPetsExpanded, setOtherPetsExpanded] = useState(false);
  const [otherPetsLoading, setOtherPetsLoading] = useState(false);

  // ─── Premium gate (stub: implement when paywall ships) ──

  // ─── Fetch pet allergens + conditions ───────────────────
  const [petConditions, setPetConditions] = useState<string[]>([]);

  useEffect(() => {
    (async () => {
      try {
        const [allergens, conditions] = await Promise.all([
          getPetAllergens(petId),
          getPetConditions(petId),
        ]);
        const allergenNames = allergens.map((a) => a.allergen);
        setPetAllergens(allergenNames);
        setPetConditions(conditions.map((c) => c.condition_tag));
      } catch {
        // Non-blocking — differences just won't include allergen rule
      }
    })();
  }, [petId]);

  // ─── Load products + score ──────────────────────────────
  useEffect(() => {
    let cancelled = false;

    (async () => {
      setLoading(true);
      setError(null);

      try {
        // Fetch both products
        const [prodARes, prodBRes] = await Promise.all([
          supabase.from('products').select('*').eq('id', productAId).single(),
          supabase.from('products').select('*').eq('id', productBId).single(),
        ]);

        if (cancelled) return;
        if (prodARes.error || !prodARes.data) throw new Error('Product A not found');
        if (prodBRes.error || !prodBRes.data) throw new Error('Product B not found');

        const pA = prodARes.data as Product;
        const pB = prodBRes.data as Product;
        setProductA(pA);
        setProductB(pB);

        // Score both products (on-the-fly, personalized)
        const [resA, resB] = await Promise.all([
          scoreProduct(pA, pet, petAllergens, petConditions),
          scoreProduct(pB, pet, petAllergens, petConditions),
        ]);

        if (cancelled) return;
        setResultA(resA);
        setResultB(resB);
      } catch (err) {
        if (!cancelled) setError((err as Error).message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => { cancelled = true; };
  }, [productAId, productBId, pet?.id, petAllergens.join(), petConditions.join()]);

  // Reset other pet scores when products change
  useEffect(() => {
    setOtherPetScores(new Map());
  }, [productBId]);

  // ─── Lazy-load other pets' scores on expand ─────────────
  useEffect(() => {
    if (!otherPetsExpanded || otherPetScores.size > 0 || !productA || !productB) return;
    let cancelled = false;

    (async () => {
      setOtherPetsLoading(true);
      const scores = new Map<string, { scoreA: number; scoreB: number }>();

      for (const op of otherPets) {
        if (cancelled) return;
        const [allergens, conditions] = await Promise.all([
          getPetAllergens(op.id),
          getPetConditions(op.id),
        ]);
        const [resA, resB] = await Promise.all([
          scoreProduct(productA, op, allergens.map(a => a.allergen), conditions.map(c => c.condition_tag)),
          scoreProduct(productB, op, allergens.map(a => a.allergen), conditions.map(c => c.condition_tag)),
        ]);
        scores.set(op.id, {
          scoreA: resA.scoredResult.finalScore,
          scoreB: resB.scoredResult.finalScore,
        });
      }

      if (!cancelled) {
        setOtherPetScores(scores);
        setOtherPetsLoading(false);
      }
    })();

    return () => { cancelled = true; };
  }, [otherPetsExpanded, otherPetScores.size, productA, productB, otherPets]);

  // ─── Computed values ────────────────────────────────────
  const keyDifferences = useMemo(() => {
    if (!productA || !productB || !resultA || !resultB) return [];
    return computeKeyDifferences(
      productA, productB,
      resultA.ingredients, resultB.ingredients,
      pet?.species ?? 'dog',
      petAllergens,
      pet?.name ?? '',
    );
  }, [productA, productB, resultA, resultB, pet, petAllergens]);

  const scoreA = resultA?.scoredResult.finalScore ?? 0;
  const scoreB = resultB?.scoredResult.finalScore ?? 0;
  const displayName = pet?.name ?? 'your pet';
  const category = productA?.category === 'treat' ? 'treat' : 'daily_food';

  // ─── Helpers ────────────────────────────────────────────
  const getShortName = (product: Product) =>
    stripBrandFromName(product.brand, product.name);

  const getMaxBucket = (cat: string) => {
    const w = cat === 'treat' ? SCORING_WEIGHTS.treat : SCORING_WEIGHTS.daily_food;
    return {
      iq: Math.round(w.iq * 100),
      np: Math.round(w.np * 100),
      fc: Math.round(w.fc * 100),
    };
  };

  const handleSwapProduct = useCallback((newBId: string) => {
    setPickerVisible(false);
    setProductBId(newBId);
  }, []);

  // ─── Loading / Error states ─────────────────────────────
  if (loading) {
    return (
      <View style={[ss.container, { paddingTop: insets.top }]}>
        <View style={ss.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
            <Ionicons name="chevron-back" size={28} color={Colors.textPrimary} />
          </TouchableOpacity>
          <Text style={ss.headerTitle}>Compare</Text>
          <View style={{ width: 28 }} />
        </View>
        <View style={ss.loadingContainer}>
          <ActivityIndicator size="large" color={Colors.accent} />
          <Text style={ss.loadingText}>Scoring both products for {displayName}…</Text>
        </View>
      </View>
    );
  }

  if (error || !productA || !productB || !resultA || !resultB) {
    return (
      <View style={[ss.container, { paddingTop: insets.top }]}>
        <View style={ss.header}>
          <TouchableOpacity onPress={() => navigation.goBack()}>
            <Ionicons name="chevron-back" size={28} color={Colors.textPrimary} />
          </TouchableOpacity>
          <Text style={ss.headerTitle}>Compare</Text>
          <View style={{ width: 28 }} />
        </View>
        <View style={ss.loadingContainer}>
          <Ionicons name="alert-circle-outline" size={48} color={Colors.severityRed} />
          <Text style={ss.errorText}>{error ?? 'Could not load comparison data.'}</Text>
          <TouchableOpacity style={ss.retryButton} onPress={() => navigation.goBack()}>
            <Text style={ss.retryText}>Go Back</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  const bucketMax = getMaxBucket(category);

  // ─── Render ─────────────────────────────────────────────
  return (
    <View style={[ss.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={ss.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
          <Ionicons name="chevron-back" size={28} color={Colors.textPrimary} />
        </TouchableOpacity>
        <Text style={ss.headerTitle}>Compare</Text>
        <TouchableOpacity
          onPress={() => setPickerVisible(true)}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
        >
          <Ionicons name="swap-horizontal" size={24} color={Colors.accent} />
        </TouchableOpacity>
      </View>

      <ScrollView
        contentContainerStyle={[ss.scrollContent, { paddingBottom: insets.bottom + 100 }]}
        showsVerticalScrollIndicator={false}
      >
        {/* ─── Product Headers ─────────────────────────── */}
        <View style={ss.productHeaders}>
          <ProductHeader
            product={productA}
            score={scoreA}
            petName={displayName}
            species={pet?.species ?? 'dog'}
            isPartial={resultA.scoredResult.isPartialScore}
          />
          <View style={ss.headerDivider} />
          <ProductHeader
            product={productB}
            score={scoreB}
            petName={displayName}
            species={pet?.species ?? 'dog'}
            isPartial={resultB.scoredResult.isPartialScore}
          />
        </View>

        {/* ─── Score Breakdown ─────────────────────────── */}
        <View style={ss.section}>
          <Text style={ss.sectionTitle}>Score Breakdown</Text>
          {BUCKET_LABELS.map(({ key, label, maxKey }) => {
            const rawA = resultA.scoredResult.layer1[key];
            const rawB = resultB.scoredResult.layer1[key];
            const max = bucketMax[maxKey];
            if (max === 0) return null; // treat: skip NP/FC

            // Convert raw 0-100 bucket score → weighted contribution out of max
            const valA = Math.round((rawA / 100) * max);
            const valB = Math.round((rawB / 100) * max);
            const highlightA = valA > valB;
            const highlightB = valB > valA;

            return (
              <View key={key} style={ss.bucketRow}>
                <Text style={[
                  ss.bucketValue,
                  highlightA && { color: Colors.accent },
                ]}>
                  {valA}/{max}
                </Text>
                <Text style={ss.bucketLabel}>{label}</Text>
                <Text style={[
                  ss.bucketValue,
                  highlightB && { color: Colors.accent },
                ]}>
                  {valB}/{max}
                </Text>
              </View>
            );
          })}
        </View>

        {/* ─── Nutrition DMB ───────────────────────────── */}
        <View style={ss.section}>
          <Text style={ss.sectionTitle}>Nutrition (DMB)</Text>
          {productA.ga_protein_pct == null && productB.ga_protein_pct == null ? (
            <Text style={ss.emptyText}>No nutritional data available</Text>
          ) : (
            <>
              {NUTRITION_ROWS.map(({ key, label, field }) => {
                const valA = productA[field];
                const valB = productB[field];
                return (
                  <View key={key} style={ss.nutritionRow}>
                    <Text style={ss.nutritionValue}>{valA != null ? `${valA}%` : '—'}</Text>
                    <Text style={ss.nutritionLabel}>{label}</Text>
                    <Text style={ss.nutritionValue}>{valB != null ? `${valB}%` : '—'}</Text>
                  </View>
                );
              })}
              {/* kcal/cup row — resolved with estimation fallback */}
              {(() => {
                const cupA = resolveKcalPerCup(productA);
                const cupB = resolveKcalPerCup(productB);
                if (!cupA && !cupB) return null;
                const fmtCup = (r: { kcalPerCup: number; isEstimated: boolean } | null) =>
                  r == null ? '—' : `${r.kcalPerCup.toLocaleString()}${r.isEstimated ? '*' : ''}`;
                return (
                  <View style={ss.nutritionRow}>
                    <Text style={ss.nutritionValue}>{fmtCup(cupA)}</Text>
                    <Text style={ss.nutritionLabel}>kcal/cup</Text>
                    <Text style={ss.nutritionValue}>{fmtCup(cupB)}</Text>
                  </View>
                );
              })()}
              {(productA.ga_protein_pct == null || productB.ga_protein_pct == null) && (
                <Text style={ss.partialNote}>Partial data — some values unavailable</Text>
              )}
            </>
          )}
        </View>

        {/* ─── Key Differences ─────────────────────────── */}
        {keyDifferences.length > 0 && (
          <View style={ss.section}>
            <Text style={ss.sectionTitle}>Key Differences</Text>
            {keyDifferences.map((diff) => (
              <View key={diff.id} style={ss.diffCard}>
                <Ionicons
                  name={KEY_DIFF_ICONS[diff.icon]}
                  size={20}
                  color={KEY_DIFF_COLORS[diff.severity]}
                  style={ss.diffIcon}
                />
                <Text style={ss.diffText}>{diff.text}</Text>
              </View>
            ))}
          </View>
        )}

        {/* ─── Your Other Pets ──────────────────────────── */}
        {otherPets.length > 0 && (
          <View style={ss.section}>
            <TouchableOpacity
              style={ss.sectionHeader}
              onPress={() => setOtherPetsExpanded(!otherPetsExpanded)}
              activeOpacity={0.7}
            >
              <Text style={ss.sectionTitle}>Your Other Pets</Text>
              <Ionicons
                name={otherPetsExpanded ? 'chevron-up' : 'chevron-down'}
                size={20}
                color={Colors.textSecondary}
              />
            </TouchableOpacity>
            {otherPetsExpanded && (
              otherPetsLoading ? (
                <View style={ss.otherPetsLoading}>
                  <ActivityIndicator size="small" color={Colors.accent} />
                  <Text style={ss.otherPetsLoadingText}>Scoring for your other pets…</Text>
                </View>
              ) : (
                otherPets.map(op => {
                  const scores = otherPetScores.get(op.id);
                  if (!scores) return null;
                  const highlightA = scores.scoreA > scores.scoreB;
                  const highlightB = scores.scoreB > scores.scoreA;
                  return (
                    <View key={op.id} style={ss.otherPetRow}>
                      <View style={ss.otherPetScoreCell}>
                        <View style={[ss.otherPetDot, { backgroundColor: getScoreColor(scores.scoreA, false) }]} />
                        <Text style={[ss.otherPetScore, highlightA && { color: Colors.accent }]}>
                          {Math.round(scores.scoreA)}%
                        </Text>
                      </View>
                      <Text style={ss.otherPetName} numberOfLines={1}>{op.name}</Text>
                      <View style={ss.otherPetScoreCell}>
                        <View style={[ss.otherPetDot, { backgroundColor: getScoreColor(scores.scoreB, false) }]} />
                        <Text style={[ss.otherPetScore, highlightB && { color: Colors.accent }]}>
                          {Math.round(scores.scoreB)}%
                        </Text>
                      </View>
                    </View>
                  );
                })
              )
            )}
          </View>
        )}

        {/* ─── Ingredients ─────────────────────────────── */}
        <View style={ss.section}>
          <TouchableOpacity
            style={ss.sectionHeader}
            onPress={() => setIngredientsExpanded(!ingredientsExpanded)}
            activeOpacity={0.7}
          >
            <Text style={ss.sectionTitle}>Ingredients</Text>
            <Ionicons
              name={ingredientsExpanded ? 'chevron-up' : 'chevron-down'}
              size={20}
              color={Colors.textSecondary}
            />
          </TouchableOpacity>
          {ingredientsExpanded && (
            <View style={ss.ingredientColumns}>
              <View style={ss.ingredientCol}>
                {renderIngredientList(resultA.ingredients, pet?.species ?? 'dog')}
              </View>
              <View style={ss.ingredientDivider} />
              <View style={ss.ingredientCol}>
                {renderIngredientList(resultB.ingredients, pet?.species ?? 'dog')}
              </View>
            </View>
          )}
        </View>

        {/* ─── Bottom CTA ──────────────────────────────── */}
        <View style={ss.ctaContainer}>
          {scoreA !== scoreB ? (
            <TouchableOpacity
              style={ss.ctaButton}
              onPress={() => {
                const winnerId = scoreB > scoreA ? productBId : productAId;
                navigation.navigate('Result', { productId: winnerId, petId });
              }}
              activeOpacity={0.8}
            >
              <Text style={ss.ctaText}>
                {scoreB > scoreA
                  ? `View ${getShortName(productB)}`
                  : `Keep ${getShortName(productA)}`}
              </Text>
            </TouchableOpacity>
          ) : (
            <Text style={ss.tieText}>Both products score equally for {displayName}</Text>
          )}
        </View>
      </ScrollView>

      {/* ─── Product Picker Sheet ──────────────────────── */}
      <CompareProductPickerSheet
        visible={pickerVisible}
        onClose={() => setPickerVisible(false)}
        onSelectProduct={handleSwapProduct}
        productAId={productAId}
        petId={petId}
        species={pet?.species ?? 'dog'}
        category={category as 'daily_food' | 'treat'}
      />
    </View>
  );
}

// ─── Product Header Sub-Component ───────────────────────

function ProductHeader({
  product,
  score,
  petName,
  species,
  isPartial,
}: {
  product: Product;
  score: number;
  petName: string;
  species: 'dog' | 'cat';
  isPartial: boolean;
}) {
  return (
    <View style={ss.productCard}>
      {product.image_url ? (
        <Image source={{ uri: product.image_url }} style={ss.productImage} resizeMode="contain" />
      ) : (
        <View style={ss.productImagePlaceholder}>
          <Ionicons name="cube-outline" size={28} color={Colors.textTertiary} />
        </View>
      )}
      <Text style={ss.productBrand} numberOfLines={1}>{product.brand}</Text>
      <Text style={ss.productName} numberOfLines={2}>
        {stripBrandFromName(product.brand, product.name)}
      </Text>
      <View style={ss.scoreRingWrapper}>
        <ScoreRing
          score={score}
          petName={petName}
          petPhotoUri={null}
          species={species}
          isPartialScore={isPartial}
          size="small"
        />
      </View>
      <Text style={ss.matchLabel}>
        {score}% match for {petName.split(' ')[0]}
      </Text>
    </View>
  );
}

// ─── Ingredient List Helper ─────────────────────────────

function renderIngredientList(ingredients: ProductIngredient[], species: 'dog' | 'cat') {
  const sevKey = species === 'dog' ? 'dog_base_severity' : 'cat_base_severity';
  const display = ingredients.slice(0, 10);

  return display.map((ing, i) => (
    <View key={`${ing.canonical_name}-${i}`} style={ss.ingredientItem}>
      <View style={[ss.severityDot, { backgroundColor: SEVERITY_DOT[ing[sevKey]] ?? Colors.textTertiary }]} />
      <Text style={ss.ingredientName} numberOfLines={1}>
        {i + 1}. {toDisplayName(ing.canonical_name)}
      </Text>
    </View>
  ));
}

// ─── Styles ─────────────────────────────────────────────

const ss = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.cardBorder,
  },
  headerTitle: {
    fontSize: FontSizes.lg,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  scrollContent: {
    paddingHorizontal: Spacing.md,
    paddingTop: Spacing.md,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: Spacing.md,
  },
  loadingText: {
    fontSize: FontSizes.md,
    color: Colors.textSecondary,
    textAlign: 'center',
  },
  errorText: {
    fontSize: FontSizes.md,
    color: Colors.severityRed,
    textAlign: 'center',
    marginTop: Spacing.sm,
  },
  retryButton: {
    marginTop: Spacing.md,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
    backgroundColor: Colors.card,
    borderRadius: 12,
  },
  retryText: {
    fontSize: FontSizes.md,
    fontWeight: '600',
    color: Colors.accent,
  },

  // Product headers
  productHeaders: {
    flexDirection: 'row',
    marginBottom: Spacing.lg,
  },
  headerDivider: {
    width: Spacing.sm,
  },
  productCard: {
    flex: 1,
    backgroundColor: Colors.card,
    borderRadius: 16,
    padding: Spacing.md,
    alignItems: 'center',
  },
  productImage: {
    width: 56,
    height: 56,
    borderRadius: 8,
    marginBottom: Spacing.sm,
  },
  productImagePlaceholder: {
    width: 56,
    height: 56,
    borderRadius: 8,
    backgroundColor: Colors.cardBorder,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: Spacing.sm,
  },
  productBrand: {
    fontSize: FontSizes.xs,
    fontWeight: '600',
    color: Colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  productName: {
    fontSize: FontSizes.sm,
    fontWeight: '600',
    color: Colors.textPrimary,
    textAlign: 'center',
    marginBottom: Spacing.sm,
    minHeight: 36,
  },
  scoreRingWrapper: {
    marginBottom: Spacing.xs,
  },
  matchLabel: {
    fontSize: FontSizes.xs,
    color: Colors.textSecondary,
    textAlign: 'center',
  },

  // Sections
  section: {
    marginBottom: Spacing.lg,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  sectionTitle: {
    fontSize: FontSizes.md,
    fontWeight: '700',
    color: Colors.textPrimary,
    marginBottom: Spacing.sm,
  },

  // Score breakdown
  bucketRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Spacing.xs + 2,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.cardBorder,
  },
  bucketLabel: {
    flex: 1,
    fontSize: FontSizes.sm,
    color: Colors.textSecondary,
    textAlign: 'center',
  },
  bucketValue: {
    width: 60,
    fontSize: FontSizes.sm,
    fontWeight: '700',
    color: Colors.textPrimary,
    textAlign: 'center',
  },

  // Nutrition
  nutritionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Spacing.xs + 2,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.cardBorder,
  },
  nutritionLabel: {
    flex: 1,
    fontSize: FontSizes.sm,
    color: Colors.textSecondary,
    textAlign: 'center',
  },
  nutritionValue: {
    width: 60,
    fontSize: FontSizes.sm,
    fontWeight: '600',
    color: Colors.textPrimary,
    textAlign: 'center',
  },
  partialNote: {
    fontSize: FontSizes.xs,
    color: Colors.textTertiary,
    textAlign: 'center',
    marginTop: Spacing.xs,
    fontStyle: 'italic',
  },
  emptyText: {
    fontSize: FontSizes.sm,
    color: Colors.textTertiary,
    textAlign: 'center',
    paddingVertical: Spacing.md,
  },

  // Key differences
  diffCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: Colors.card,
    borderRadius: 12,
    padding: Spacing.md,
    marginBottom: Spacing.sm,
  },
  diffIcon: {
    marginRight: Spacing.sm,
    marginTop: 1,
  },
  diffText: {
    flex: 1,
    fontSize: FontSizes.sm,
    color: Colors.textPrimary,
    lineHeight: 20,
  },

  // Ingredients
  ingredientColumns: {
    flexDirection: 'row',
    marginTop: Spacing.xs,
  },
  ingredientCol: {
    flex: 1,
  },
  ingredientDivider: {
    width: Spacing.sm,
  },
  ingredientItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 3,
  },
  severityDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginRight: 6,
  },
  ingredientName: {
    flex: 1,
    fontSize: FontSizes.xs,
    color: Colors.textPrimary,
  },

  // Other pets
  otherPetsLoading: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    paddingVertical: Spacing.md,
  },
  otherPetsLoadingText: {
    fontSize: FontSizes.sm,
    color: Colors.textSecondary,
  },
  otherPetRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Spacing.xs + 2,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.cardBorder,
  },
  otherPetScoreCell: {
    width: 60,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  otherPetDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  otherPetScore: {
    fontSize: FontSizes.sm,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  otherPetName: {
    flex: 1,
    fontSize: FontSizes.sm,
    color: Colors.textSecondary,
    textAlign: 'center',
  },

  // CTA
  ctaContainer: {
    marginTop: Spacing.md,
    marginBottom: Spacing.lg,
    alignItems: 'center',
  },
  ctaButton: {
    backgroundColor: Colors.accent,
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.md,
    borderRadius: 16,
    width: '100%',
    alignItems: 'center',
  },
  ctaText: {
    fontSize: FontSizes.md,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  tieText: {
    fontSize: FontSizes.sm,
    color: Colors.textSecondary,
    textAlign: 'center',
  },
});
