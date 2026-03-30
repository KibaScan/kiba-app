// Kiba — Safe Swap Section (M6)
// Shows higher-scoring alternatives on ResultScreen.
// Premium users see real recommendations; free users see blurred placeholder.
// D-094: suitability framing. D-095: UPVM compliance. D-020: brand-blind.

import React, { useEffect, useState, useMemo, useRef, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Image,
  ScrollView,
  ActivityIndicator,
  StyleSheet,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';

import { Colors, FontSizes, Spacing } from '../../utils/constants';
import { getScoreColor } from '../scoring/ScoreRing';
import { canUseSafeSwaps, canCompare } from '../../utils/permissions';
import { fetchSafeSwaps, fetchGroupSafeSwaps, type SafeSwapResult } from '../../services/safeSwapService';
import { batchScoreOnDevice } from '../../services/batchScoreOnDevice';
import { getPetAllergens, getPetConditions } from '../../services/petService';
import { useActivePetStore } from '../../stores/useActivePetStore';
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
  isBypassed: boolean;
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
    scannedScore, petName, allergenGroups, conditionTags, isBypassed,
  } = props;

  const navigation = useNavigation<NativeStackNavigationProp<ScanStackParamList>>();
  const [result, setResult] = useState<SafeSwapResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [preparing, setPreparing] = useState(false);
  const batchTriedRef = useRef(false);

  const premium = canUseSafeSwaps();

  // ─── Multi-pet state ────────────────────────────────
  const allPets = useActivePetStore(st => st.pets);
  const sameSpeciesPets = useMemo(
    () => allPets.filter(p => p.species === species),
    [allPets, species],
  );
  const showChips = sameSpeciesPets.length > 1;

  const [selectedPetId, setSelectedPetId] = useState(petId);
  const [groupMode, setGroupMode] = useState(false);

  // Client-side cache: avoids re-fetching when switching chips
  const cacheRef = useRef(new Map<string, SafeSwapResult>());
  // Stale closure guard: incremented on each fetch, checked after async
  const fetchIdRef = useRef(0);

  const selectedPet = sameSpeciesPets.find(p => p.id === selectedPetId);
  const displayName = groupMode
    ? `your ${species === 'dog' ? 'dogs' : 'cats'}`
    : (selectedPet?.name ?? petName);

  // ─── Fetch logic ────────────────────────────────────
  const loadSwaps = useCallback(async () => {
    if (isBypassed || !premium) return;

    const cacheKey = groupMode ? '__group__' : selectedPetId;
    const cached = cacheRef.current.get(cacheKey);
    if (cached) { setResult(cached); return; }

    const thisId = ++fetchIdRef.current;
    setLoading(true);

    try {
      let swapResult: SafeSwapResult;

      if (groupMode) {
        swapResult = await fetchGroupSafeSwaps({
          petIds: sameSpeciesPets.map(p => p.id),
          species, category, productForm, isSupplemental,
          scannedProductId: productId, scannedScore,
        });
      } else if (selectedPetId === petId) {
        // Active pet — use props allergens/conditions (no extra fetch)
        swapResult = await fetchSafeSwaps({
          petId, species, category, productForm, isSupplemental,
          scannedProductId: productId, scannedScore, allergenGroups, conditionTags,
        });
      } else {
        // Different pet — fetch their allergens/conditions
        const [aRows, cRows] = await Promise.all([
          getPetAllergens(selectedPetId),
          getPetConditions(selectedPetId),
        ]);
        swapResult = await fetchSafeSwaps({
          petId: selectedPetId, species, category, productForm, isSupplemental,
          scannedProductId: productId, scannedScore,
          allergenGroups: aRows.map(r => r.allergen),
          conditionTags: cRows.map(r => r.condition_tag),
        });
      }

      if (fetchIdRef.current !== thisId) return; // stale
      // If cache is empty OR no candidates survived filters, trigger on-device scoring and retry
      if ((swapResult.cacheEmpty || swapResult.candidates.length === 0) && !batchTriedRef.current) {
        batchTriedRef.current = true;
        setPreparing(true);
        setLoading(false);
        try {
          const targetPet = allPets.find(p => p.id === (groupMode ? petId : selectedPetId));
          if (targetPet) {
            await batchScoreOnDevice(targetPet.id, targetPet, category, productForm);
            // Retry fetch after on-device scoring populates cache
            if (groupMode) {
              swapResult = await fetchGroupSafeSwaps({
                petIds: sameSpeciesPets.map(p => p.id),
                species, category, productForm, isSupplemental,
                scannedProductId: productId, scannedScore,
              });
            } else {
              swapResult = await fetchSafeSwaps({
                petId: selectedPetId, species, category, productForm, isSupplemental,
                scannedProductId: productId, scannedScore, allergenGroups, conditionTags,
              });
            }
          }
        } catch {
        } finally {
          if (fetchIdRef.current === thisId) setPreparing(false);
        }
      }

      if (fetchIdRef.current !== thisId) return; // stale after retry
      cacheRef.current.set(cacheKey, swapResult);
      setResult(swapResult);
    } catch {
      if (fetchIdRef.current !== thisId) return;
      setResult(null);
    } finally {
      if (fetchIdRef.current === thisId) setLoading(false);
    }
  }, [
    isBypassed, premium, groupMode, selectedPetId, petId,
    sameSpeciesPets, species, category, productForm, isSupplemental,
    productId, scannedScore, allergenGroups, conditionTags,
  ]);

  useEffect(() => { loadSwaps(); }, [loadSwaps]);

  // ─── Early returns (after all hooks) ────────────────
  if (isBypassed) return null;

  if (!premium) {
    const headline = scannedScore < 60
      ? `Better-scoring options exist for ${petName}`
      : `Higher-scoring alternatives for ${petName}`;

    return (
      <TouchableOpacity
        style={s.container}
        activeOpacity={0.7}
        onPress={() => {
          (navigation as any).navigate('Paywall', {
            trigger: 'safe_swap',
            petName,
          });
        }}
      >
        <View style={s.freeBanner}>
          {/* Header */}
          <View style={s.freeBannerHeader}>
            <Ionicons name="shield-checkmark-outline" size={24} color={Colors.accent} />
            <Text style={s.freeBannerHeadline}>{headline}</Text>
          </View>
          <Text style={s.freeBannerSubtitle}>
            Products with stronger match scores are available in this category.
          </Text>

          {/* Ghost cards */}
          <View style={s.ghostCardRow}>
            {[0, 1, 2].map(i => (
              <View key={i} style={s.ghostCard}>
                <View style={s.ghostImageBox}>
                  <Ionicons name="cube-outline" size={20} color={Colors.textTertiary + '60'} />
                </View>
                <View style={s.ghostBar} />
                <View style={[s.ghostBar, { width: '50%' }]} />
                <Text style={s.ghostScore}>??%</Text>
              </View>
            ))}
          </View>

          {/* CTA */}
          <View style={s.freeBannerCta}>
            <Text style={s.freeBannerCtaText}>See What Scores Higher</Text>
            <Ionicons name="arrow-forward-outline" size={16} color={Colors.accent} />
          </View>
        </View>
      </TouchableOpacity>
    );
  }

  if (loading || preparing) {
    return (
      <View style={s.container}>
        <View style={s.preparingContainer}>
          <ActivityIndicator size="small" color={Colors.accent} />
          <Text style={s.preparingText}>
            {preparing
              ? `Preparing recommendations for ${displayName}...`
              : 'Loading alternatives...'}
          </Text>
        </View>
      </View>
    );
  }

  if (!result || result.candidates.length === 0) return null;

  // ─── Derived values for navigation ──────────────────
  const navPetId = groupMode ? petId : selectedPetId;

  // ─── Real recommendations ───────────────────────────
  return (
    <View style={s.container}>
      {/* Multi-pet chip row */}
      {showChips && (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={s.chipRow}
          contentContainerStyle={s.chipRowContent}
        >
          {sameSpeciesPets.map(p => (
            <TouchableOpacity
              key={p.id}
              style={[s.chip, !groupMode && selectedPetId === p.id && s.chipActive]}
              onPress={() => { setGroupMode(false); setSelectedPetId(p.id); }}
            >
              {!groupMode && selectedPetId === p.id && (
                <Ionicons name="checkmark" size={14} color={Colors.accent} />
              )}
              <Text style={[s.chipText, !groupMode && selectedPetId === p.id && s.chipTextActive]}>
                {p.name}
              </Text>
            </TouchableOpacity>
          ))}
          <TouchableOpacity
            style={[s.chip, groupMode && s.chipActive]}
            onPress={() => setGroupMode(true)}
          >
            {groupMode && <Ionicons name="checkmark" size={14} color={Colors.accent} />}
            <Text style={[s.chipText, groupMode && s.chipTextActive]}>
              All {species === 'dog' ? 'Dogs' : 'Cats'}
            </Text>
          </TouchableOpacity>
        </ScrollView>
      )}

      {/* Header */}
      <Text style={s.header}>
        Higher-scoring alternatives for {displayName}
      </Text>
      <Text style={s.subtitle}>
        {groupMode
          ? `Products that work well for all ${displayName}.`
          : `Based on ${displayName}'s unique dietary needs.`}
      </Text>

      {/* 3-card row */}
      <View style={s.cardRow}>
        {result.candidates.map((c) => (
          <TouchableOpacity
            key={c.product_id}
            style={s.card}
            activeOpacity={0.7}
            onPress={() => {
              navigation.push('Result', { productId: c.product_id, petId: navPetId });
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

            {/* Score */}
            <View style={s.scoreRow}>
              <View style={[s.scoreDot, { backgroundColor: getScoreColor(c.final_score, c.is_supplemental) }]} />
              <Text style={s.scoreText}>{Math.round(c.final_score)}% match</Text>
            </View>
            <Text style={s.scoreLabel}>for {displayName}</Text>

            {/* Swap reason */}
            <Text style={s.reason} numberOfLines={1}>
              {c.reason}
            </Text>

            {/* Compare link */}
            <TouchableOpacity
              style={s.compareLink}
              onPress={() => {
                if (!canCompare()) {
                  (navigation as any).navigate('Paywall', {
                    trigger: 'compare',
                    petName: displayName,
                  });
                  return;
                }
                (navigation as any).navigate('Compare', {
                  productAId: productId,
                  productBId: c.product_id,
                  petId: navPetId,
                });
              }}
            >
              <Text style={s.compareLinkText}>Compare</Text>
            </TouchableOpacity>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
}

// ─── Styles ─────────────────────────────────────────────

const s = StyleSheet.create({
  container: {
    marginBottom: Spacing.lg,
  },
  chipRow: {
    marginBottom: Spacing.sm,
  },
  chipRowContent: {
    gap: 8,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
  },
  chipActive: {
    backgroundColor: Colors.accent + '18',
    borderColor: Colors.accent + '40',
  },
  chipText: {
    fontSize: FontSizes.sm,
    fontWeight: '500',
    color: Colors.textSecondary,
  },
  chipTextActive: {
    color: Colors.accent,
    fontWeight: '600',
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
    marginBottom: Spacing.md,
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
    marginBottom: Spacing.sm,
    minHeight: 32,
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

  // ─── Free user paywall banner ──────────────────────────
  freeBanner: {
    backgroundColor: Colors.card,
    borderRadius: 12,
    padding: Spacing.lg,
    borderWidth: 1,
    borderColor: Colors.accent + '30',
  },
  freeBannerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: Spacing.sm,
  },
  freeBannerHeadline: {
    flex: 1,
    fontSize: FontSizes.lg,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  freeBannerSubtitle: {
    fontSize: FontSizes.sm,
    color: Colors.textSecondary,
    lineHeight: 18,
    marginBottom: Spacing.md,
  },
  ghostCardRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: Spacing.md,
  },
  ghostCard: {
    flex: 1,
    backgroundColor: Colors.background,
    borderRadius: 10,
    padding: 8,
    alignItems: 'center',
    opacity: 0.6,
  },
  ghostImageBox: {
    width: '100%',
    height: 48,
    borderRadius: 6,
    backgroundColor: Colors.cardBorder + '40',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6,
  },
  ghostBar: {
    width: '70%',
    height: 8,
    borderRadius: 4,
    backgroundColor: Colors.cardBorder,
    marginBottom: 4,
  },
  ghostScore: {
    fontSize: FontSizes.md,
    fontWeight: '700',
    color: Colors.textTertiary,
    marginTop: 2,
  },
  freeBannerCta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingTop: Spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: Colors.cardBorder,
  },
  freeBannerCtaText: {
    fontSize: FontSizes.md,
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
});
