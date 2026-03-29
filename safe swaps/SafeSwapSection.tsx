// M6 Safe Swap Section — Curated alternatives displayed on ResultScreen.
// Shows 3 curated picks (daily dry) or generic top-5 scroll (everything else).
// Multi-pet chip row for same-species pets + "All [Species]" group mode.
// Daily rotation + manual refresh. Free users see cards, tapping is scan-gated.
//
// Spec: M6_SAFE_SWAP_COMPARE_SPEC.md §1–§7
// Integration: ResultScreen, between SeverityBadgeStrip and Share button

import React, { useEffect, useState, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';

import { Colors, FontSizes, Spacing } from '../../utils/constants';
import { getScoreColor } from '../scoring/ScoreRing';
import { isPremium } from '../../utils/permissions';
import { useActivePetStore } from '../../stores/useActivePetStore';
import { supabase } from '../../services/supabase';
import { getPetAllergens } from '../../services/petService';
import {
  fetchSafeSwaps,
  fetchGroupSwaps,
  refreshFromPool,
  getSwapHeaderCopy,
  type SafeSwapCandidate,
  type SafeSwapResult,
} from '../../services/safeSwapService';

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
}

// ─── Component ──────────────────────────────────────────

export function SafeSwapSection({
  productId,
  petId,
  species,
  category,
  productForm,
  isSupplemental,
  scannedScore,
  petName,
}: SafeSwapSectionProps) {
  const navigation = useNavigation<any>();
  const allPets = useActivePetStore(s => s.pets);

  // Same-species pets for multi-pet chips
  const sameSpeciesPets = useMemo(
    () => allPets.filter(p => p.species === species),
    [allPets, species],
  );
  const showChips = sameSpeciesPets.length > 1;

  // ─── State ──────────────────────────────────────────

  const [selectedPetId, setSelectedPetId] = useState(petId);
  const [groupMode, setGroupMode] = useState(false);
  const [result, setResult] = useState<SafeSwapResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshCount, setRefreshCount] = useState(0);

  const selectedPet = allPets.find(p => p.id === selectedPetId);
  const displayPetName = groupMode
    ? `your ${species === 'dog' ? 'dogs' : 'cats'}`
    : selectedPet?.name ?? petName;

  const headerCopy = getSwapHeaderCopy(scannedScore, displayPetName);

  // ─── Fetch swaps ────────────────────────────────────

  const loadSwaps = useCallback(async () => {
    setLoading(true);
    try {
      const { data: userData } = await supabase.auth.getUser();
      const userId = userData?.user?.id;
      if (!userId) {
        setLoading(false);
        return;
      }

      if (groupMode) {
        // Group mode: all same-species pets
        const petIds = sameSpeciesPets.map(p => p.id);

        // Union of all allergens
        const allergenSets = await Promise.all(
          petIds.map(async pid => {
            const rows = await getPetAllergens(pid);
            return rows.map(r => r.allergen);
          }),
        );
        const unionAllergens = [...new Set(allergenSets.flat())];

        const groupPool = await fetchGroupSwaps(
          petIds,
          {
            species,
            scannedProductId: productId,
            scannedCategory: category,
            scannedForm: productForm,
            scannedIsSupplemental: isSupplemental,
            scannedScore,
            userId,
          },
          unionAllergens,
          80,
        );

        // Build result from group pool
        const isCurated = category === 'daily_food' && productForm === 'dry' && !isSupplemental;
        setResult(refreshFromPool(groupPool, petIds[0], refreshCount, isCurated));
      } else {
        // Single pet mode
        const allergenRows = await getPetAllergens(selectedPetId);
        const allergenGroups = allergenRows.map(r => r.allergen);

        const swapResult = await fetchSafeSwaps({
          petId: selectedPetId,
          species,
          scannedProductId: productId,
          scannedCategory: category,
          scannedForm: productForm,
          scannedIsSupplemental: isSupplemental,
          scannedScore,
          allergenGroups,
          userId,
        }, refreshCount);

        setResult(swapResult);
      }
    } catch (err) {
      console.warn('[SafeSwapSection] Failed to load:', err);
      setResult(null);
    } finally {
      setLoading(false);
    }
  }, [selectedPetId, groupMode, species, productId, category, productForm, isSupplemental, scannedScore, refreshCount, sameSpeciesPets]);

  useEffect(() => {
    loadSwaps();
  }, [loadSwaps]);

  // ─── Refresh handler (client-side reshuffle) ────────

  const handleRefresh = useCallback(() => {
    if (!result?.pool) return;
    const newCount = refreshCount + 1;
    setRefreshCount(newCount);

    const isCurated = result.mode === 'curated';
    const targetPetId = groupMode ? sameSpeciesPets[0]?.id ?? petId : selectedPetId;
    setResult(refreshFromPool(result.pool, targetPetId, newCount, isCurated));
  }, [result, refreshCount, groupMode, sameSpeciesPets, petId, selectedPetId]);

  // ─── Card tap handler ──────────────────────────────

  const handleCardPress = useCallback((candidate: SafeSwapCandidate) => {
    // Navigate to ResultScreen for this product
    // For free users this counts against scan limit (spec §11)
    navigation.push('Result', {
      productId: candidate.product_id,
      petId: selectedPetId,
    });
  }, [navigation, selectedPetId]);

  // ─── Compare handler ──────────────────────────────

  const handleCompare = useCallback((candidateProductId: string) => {
    if (!isPremium()) {
      navigation.navigate('Paywall', {
        trigger: 'compare',
        petName: displayPetName,
      });
      return;
    }
    navigation.navigate('Compare', {
      productAId: productId,
      productBId: candidateProductId,
      petId: selectedPetId,
    });
  }, [navigation, productId, selectedPetId, displayPetName]);

  // ─── Don't render for bypassed products ─────────────

  // Hidden for supplements (D-096 not scored)
  if (category === 'supplement') return null;

  // ─── Loading state ─────────────────────────────────

  if (loading) {
    return (
      <View style={styles.container}>
        <View style={styles.headerRow}>
          <Text style={styles.headerTitle}>{headerCopy.title}</Text>
        </View>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="small" color={Colors.textTertiary} />
          <Text style={styles.loadingText}>Finding alternatives...</Text>
        </View>
      </View>
    );
  }

  // ─── Empty state ────────────────────────────────────

  const hasResults = result && (
    (result.mode === 'curated' && result.curated &&
      (result.curated.topPick || result.curated.fishBased || result.curated.greatValue)) ||
    (result.mode === 'generic' && result.generic.length > 0)
  );

  if (!hasResults) return null; // Silently hide if no alternatives

  // ─── Render ──────────────────────────────────────────

  return (
    <View style={styles.container}>
      {/* Multi-pet chip row */}
      {showChips && (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.chipRow}
          contentContainerStyle={styles.chipRowContent}
        >
          {sameSpeciesPets.map(p => (
            <TouchableOpacity
              key={p.id}
              style={[
                styles.chip,
                !groupMode && selectedPetId === p.id && styles.chipActive,
              ]}
              onPress={() => {
                setGroupMode(false);
                setSelectedPetId(p.id);
              }}
            >
              <Text style={[
                styles.chipText,
                !groupMode && selectedPetId === p.id && styles.chipTextActive,
              ]}>
                {p.name}
              </Text>
              {!groupMode && selectedPetId === p.id && (
                <Ionicons name="checkmark" size={14} color={Colors.accent} />
              )}
            </TouchableOpacity>
          ))}
          <TouchableOpacity
            style={[styles.chip, groupMode && styles.chipActive]}
            onPress={() => setGroupMode(true)}
          >
            <Text style={[styles.chipText, groupMode && styles.chipTextActive]}>
              All {species === 'dog' ? 'Dogs' : 'Cats'}
            </Text>
            {groupMode && (
              <Ionicons name="checkmark" size={14} color={Colors.accent} />
            )}
          </TouchableOpacity>
        </ScrollView>
      )}

      {/* Section header + refresh */}
      <View style={styles.headerRow}>
        <View style={{ flex: 1 }}>
          <Text style={styles.headerTitle}>{headerCopy.title}</Text>
          <Text style={styles.headerSubtitle}>{headerCopy.subtitle}</Text>
        </View>
        <TouchableOpacity onPress={handleRefresh} hitSlop={12} style={styles.refreshButton}>
          <Ionicons name="refresh-outline" size={18} color={Colors.textTertiary} />
        </TouchableOpacity>
      </View>

      {/* Cards */}
      {result!.mode === 'curated' && result!.curated ? (
        <CuratedCards
          curated={result!.curated}
          displayPetName={displayPetName}
          onCardPress={handleCardPress}
          onCompare={handleCompare}
        />
      ) : (
        <GenericScroll
          candidates={result!.generic}
          displayPetName={displayPetName}
          onCardPress={handleCardPress}
          onCompare={handleCompare}
        />
      )}

      {/* See all link (premium) */}
      {result!.pool.length > 5 && (
        <TouchableOpacity
          style={styles.seeAllLink}
          onPress={() => {
            if (!isPremium()) {
              navigation.navigate('Paywall', {
                trigger: 'see_all_alternatives',
                petName: displayPetName,
              });
              return;
            }
            // TODO M6: navigate to full alternatives list
          }}
        >
          <Text style={styles.seeAllText}>See all alternatives</Text>
          <Ionicons name="chevron-forward" size={16} color={Colors.accent} />
        </TouchableOpacity>
      )}
    </View>
  );
}

// ─── Curated 3-Pick Cards ───────────────────────────────

function CuratedCards({
  curated,
  displayPetName,
  onCardPress,
  onCompare,
}: {
  curated: NonNullable<SafeSwapResult['curated']>;
  displayPetName: string;
  onCardPress: (c: SafeSwapCandidate) => void;
  onCompare: (productId: string) => void;
}) {
  const slots: Array<{ label: string; icon: string; candidate: SafeSwapCandidate | null }> = [
    { label: 'Top Pick', icon: 'star-outline', candidate: curated.topPick },
    { label: 'Fish-Based', icon: 'fish-outline', candidate: curated.fishBased },
    { label: 'Great Value', icon: 'pricetag-outline', candidate: curated.greatValue },
  ];

  const filledSlots = slots.filter(s => s.candidate);

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.cardsRow}
    >
      {filledSlots.map(({ label, icon, candidate }) => (
        <SwapCard
          key={candidate!.product_id}
          candidate={candidate!}
          slotLabel={label}
          slotIcon={icon}
          displayPetName={displayPetName}
          onPress={() => onCardPress(candidate!)}
          onCompare={() => onCompare(candidate!.product_id)}
        />
      ))}
    </ScrollView>
  );
}

// ─── Generic Horizontal Scroll ──────────────────────────

function GenericScroll({
  candidates,
  displayPetName,
  onCardPress,
  onCompare,
}: {
  candidates: SafeSwapCandidate[];
  displayPetName: string;
  onCardPress: (c: SafeSwapCandidate) => void;
  onCompare: (productId: string) => void;
}) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.cardsRow}
    >
      {candidates.map(c => (
        <SwapCard
          key={c.product_id}
          candidate={c}
          displayPetName={displayPetName}
          onPress={() => onCardPress(c)}
          onCompare={() => onCompare(c.product_id)}
        />
      ))}
    </ScrollView>
  );
}

// ─── Individual Card ────────────────────────────────────

function SwapCard({
  candidate,
  slotLabel,
  slotIcon,
  displayPetName,
  onPress,
  onCompare,
}: {
  candidate: SafeSwapCandidate;
  slotLabel?: string;
  slotIcon?: string;
  displayPetName: string;
  onPress: () => void;
  onCompare: () => void;
}) {
  const scoreColor = getScoreColor(candidate.final_score, false);

  return (
    <TouchableOpacity
      style={styles.card}
      onPress={onPress}
      activeOpacity={0.7}
    >
      {/* Product image */}
      <View style={styles.cardImageContainer}>
        {candidate.image_url ? (
          <Image
            source={{ uri: candidate.image_url }}
            style={styles.cardImage}
            resizeMode="contain"
          />
        ) : (
          <View style={styles.cardImagePlaceholder}>
            <Ionicons name="nutrition-outline" size={28} color={Colors.textTertiary} />
          </View>
        )}
      </View>

      {/* Slot label (curated only) */}
      {slotLabel && (
        <View style={styles.slotLabelRow}>
          <Ionicons name={slotIcon as any} size={12} color={Colors.accent} />
          <Text style={styles.slotLabelText}>{slotLabel}</Text>
        </View>
      )}

      {/* Brand + name */}
      <Text style={styles.cardBrand} numberOfLines={1}>{candidate.brand}</Text>
      <Text style={styles.cardName} numberOfLines={2}>{candidate.product_name}</Text>

      {/* Score */}
      <View style={styles.cardScoreRow}>
        <View style={[styles.cardScoreDot, { backgroundColor: scoreColor }]} />
        <Text style={[styles.cardScoreText, { color: scoreColor }]}>
          {candidate.final_score}% match
        </Text>
      </View>
      <Text style={styles.cardScorePetName}>for {displayPetName}</Text>

      {/* Compare link */}
      <TouchableOpacity
        style={styles.compareLink}
        onPress={(e) => {
          e.stopPropagation?.();
          onCompare();
        }}
        hitSlop={8}
      >
        <Ionicons name="git-compare-outline" size={14} color={Colors.accent} />
        <Text style={styles.compareLinkText}>Compare</Text>
      </TouchableOpacity>
    </TouchableOpacity>
  );
}

// ─── Styles ─────────────────────────────────────────────

const CARD_WIDTH = 160;

const styles = StyleSheet.create({
  container: {
    marginTop: Spacing.lg,
    marginBottom: Spacing.md,
  },

  // Chip row
  chipRow: {
    marginBottom: Spacing.sm,
  },
  chipRowContent: {
    paddingHorizontal: Spacing.lg,
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

  // Header
  headerRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingHorizontal: Spacing.lg,
    marginBottom: Spacing.md,
  },
  headerTitle: {
    fontSize: FontSizes.lg,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  headerSubtitle: {
    fontSize: FontSizes.sm,
    color: Colors.textSecondary,
    marginTop: 4,
    lineHeight: 18,
  },
  refreshButton: {
    padding: 4,
    marginLeft: Spacing.sm,
    marginTop: 2,
  },

  // Loading
  loadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: Spacing.xl,
  },
  loadingText: {
    fontSize: FontSizes.sm,
    color: Colors.textTertiary,
  },

  // Cards row
  cardsRow: {
    paddingHorizontal: Spacing.lg,
    gap: 12,
  },

  // Individual card
  card: {
    width: CARD_WIDTH,
    backgroundColor: Colors.card,
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
  },
  cardImageContainer: {
    width: CARD_WIDTH - 24,
    height: 90,
    borderRadius: 8,
    overflow: 'hidden',
    backgroundColor: Colors.background,
    marginBottom: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardImage: {
    width: '100%',
    height: '100%',
  },
  cardImagePlaceholder: {
    alignItems: 'center',
    justifyContent: 'center',
    flex: 1,
  },

  // Slot label (curated)
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

  // Text
  cardBrand: {
    fontSize: FontSizes.xs,
    fontWeight: '500',
    color: Colors.textSecondary,
    marginBottom: 2,
  },
  cardName: {
    fontSize: FontSizes.sm,
    fontWeight: '600',
    color: Colors.textPrimary,
    lineHeight: 18,
    marginBottom: 8,
    minHeight: 36,
  },

  // Score
  cardScoreRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  cardScoreDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  cardScoreText: {
    fontSize: FontSizes.sm,
    fontWeight: '700',
  },
  cardScorePetName: {
    fontSize: FontSizes.xs,
    color: Colors.textSecondary,
    marginTop: 1,
    marginBottom: 8,
  },

  // Compare link
  compareLink: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingTop: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: Colors.cardBorder,
  },
  compareLinkText: {
    fontSize: FontSizes.xs,
    fontWeight: '600',
    color: Colors.accent,
  },

  // See all
  seeAllLink: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingVertical: Spacing.md,
  },
  seeAllText: {
    fontSize: FontSizes.sm,
    fontWeight: '600',
    color: Colors.accent,
  },
});
