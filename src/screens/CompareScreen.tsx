// M6 CompareScreen — Two-column side-by-side product comparison.
// Premium-gated (canCompare). D-095 compliant: factual, never editorial.
// All scores computed on-the-fly via scoreProduct() — never cached/base.

import React, { useEffect, useState, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { supabase } from '../services/supabase';
import { scoreProduct, PipelineResult } from '../services/scoring/pipeline';
import { computeKeyDifferences } from '../utils/keyDifferences';
import { Colors, FontSizes, Spacing, getVerdictLabel } from '../utils/constants';
import { getConversationalName } from '../utils/formatters';
import { getPetAllergens, getPetConditions } from '../services/petService';
import { useActivePetStore } from '../stores/useActivePetStore';
import { CompareProductPickerSheet } from '../components/compare/CompareProductPickerSheet';
import { CompareProductHeader } from '../components/compare/CompareProductHeader';
import { CompareScoreBreakdown } from '../components/compare/CompareScoreBreakdown';
import { CompareNutrition } from '../components/compare/CompareNutrition';
import { CompareKeyDifferences } from '../components/compare/CompareKeyDifferences';
import { CompareOtherPets } from '../components/compare/CompareOtherPets';
import { CompareIngredientsSection } from '../components/compare/CompareIngredientsSection';
import type { ScanStackParamList } from '../types/navigation';
import type { Product } from '../types';

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

  // ─── Hide global tab bar while CompareScreen is focused ──
  useEffect(() => {
    const parent = navigation.getParent();
    parent?.setOptions({ tabBarStyle: { display: 'none' } });
    return () => {
      parent?.setOptions({ tabBarStyle: undefined });
    };
  }, [navigation]);

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

  // ─── Handlers ───────────────────────────────────────────
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
          <CompareProductHeader
            product={productA}
            score={scoreA}
            petName={displayName}
            species={pet?.species ?? 'dog'}
            isPartial={resultA.scoredResult.isPartialScore}
          />
          <View style={ss.headerDivider} />
          <CompareProductHeader
            product={productB}
            score={scoreB}
            petName={displayName}
            species={pet?.species ?? 'dog'}
            isPartial={resultB.scoredResult.isPartialScore}
          />
        </View>

        {/* ─── Score Breakdown ─────────────────────────── */}
        <CompareScoreBreakdown
          layer1A={resultA.scoredResult.layer1}
          layer1B={resultB.scoredResult.layer1}
          category={category}
        />

        {/* ─── Nutrition DMB ───────────────────────────── */}
        <CompareNutrition productA={productA} productB={productB} />

        {/* ─── Key Differences ─────────────────────────── */}
        <CompareKeyDifferences differences={keyDifferences} />

        {/* ─── Your Other Pets ──────────────────────────── */}
        <CompareOtherPets
          otherPets={otherPets}
          scoresMap={otherPetScores}
          expanded={otherPetsExpanded}
          loading={otherPetsLoading}
          onToggle={() => setOtherPetsExpanded(!otherPetsExpanded)}
        />

        {/* ─── Ingredients ─────────────────────────────── */}
        <CompareIngredientsSection
          ingredientsA={resultA.ingredients}
          ingredientsB={resultB.ingredients}
          species={pet?.species ?? 'dog'}
          expanded={ingredientsExpanded}
          onToggle={() => setIngredientsExpanded(!ingredientsExpanded)}
        />

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
                  ? `View ${getConversationalName(productB)}`
                  : `Keep ${getConversationalName(productA)}`}
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
    borderBottomColor: Colors.hairlineBorder,
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
    backgroundColor: Colors.cardSurface,
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
    marginBottom: Spacing.md,
  },
  headerDivider: {
    width: Spacing.sm,
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
