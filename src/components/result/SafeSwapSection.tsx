// Kiba — Safe Swap Section (M6)
// Shows higher-scoring alternatives on ResultScreen.
// Premium users see real recommendations; free users see blurred placeholder.
// D-094: suitability framing. D-095: UPVM compliance. D-020: brand-blind.

import React, { useEffect, useState } from 'react';
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
import { fetchSafeSwaps, SwapCandidate } from '../../services/safeSwapService';
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

// ─── Component ──────────────────────────────────────────

export function SafeSwapSection(props: SafeSwapSectionProps) {
  const {
    productId, petId, species, category, productForm, isSupplemental,
    scannedScore, petName, allergenGroups, conditionTags, isBypassed,
  } = props;

  const navigation = useNavigation<NativeStackNavigationProp<ScanStackParamList>>();
  const [candidates, setCandidates] = useState<SwapCandidate[]>([]);
  const [loading, setLoading] = useState(false);
  const [fetched, setFetched] = useState(false);

  // Don't render for bypassed products (vet diet, recalled, variety pack, species mismatch)
  if (isBypassed) return null;

  const premium = canUseSafeSwaps();

  // Fetch alternatives on mount (premium only)
  useEffect(() => {
    if (!premium || !petId || fetched) return;
    setLoading(true);

    fetchSafeSwaps({
      petId, species, category, productForm, isSupplemental,
      scannedProductId: productId, scannedScore, allergenGroups, conditionTags,
    })
      .then(setCandidates)
      .catch(() => setCandidates([]))
      .finally(() => { setLoading(false); setFetched(true); });
  }, [premium, petId]); // eslint-disable-line react-hooks/exhaustive-deps

  // ─── Free user: blurred placeholder ─────────────────
  if (!premium) {
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
        <View style={s.blur}>
          <View style={s.lockOverlay}>
            <Ionicons name="lock-closed" size={20} color="#FFFFFF" />
            <Text style={s.lockText}>Discover healthier alternatives</Text>
          </View>
          <View style={s.placeholderRow}>
            <View style={[s.placeholderDot, { backgroundColor: Colors.severityGreen }]} />
            <View style={s.placeholderBar} />
            <View style={s.placeholderBadge} />
          </View>
          <View style={s.placeholderRow}>
            <View style={[s.placeholderDot, { backgroundColor: Colors.severityGreen }]} />
            <View style={s.placeholderBar} />
            <View style={s.placeholderBadge} />
          </View>
        </View>
      </TouchableOpacity>
    );
  }

  // ─── Loading state ──────────────────────────────────
  if (loading) {
    return (
      <View style={s.container}>
        <ActivityIndicator size="small" color={Colors.textSecondary} />
      </View>
    );
  }

  // ─── No results: silent hide ────────────────────────
  if (fetched && candidates.length === 0) return null;
  if (!fetched) return null;

  // ─── Real recommendations ───────────────────────────
  return (
    <View style={s.container}>
      {/* Header */}
      <Text style={s.header}>
        Higher-scoring alternatives for {petName}
      </Text>
      <Text style={s.subtitle}>
        Based on {petName}'s unique dietary needs.
      </Text>

      {/* 3-card row */}
      <View style={s.cardRow}>
        {candidates.map((c) => (
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
              <Text style={s.scoreText}>{Math.round(c.final_score)}%</Text>
            </View>
            <Text style={s.scoreLabel}>for {petName}</Text>

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

  // ─── Free user placeholder (migrated from ResultScreenStyles)
  blur: {
    backgroundColor: Colors.card,
    borderRadius: 12,
    padding: Spacing.md,
    overflow: 'hidden',
    opacity: 0.7,
  },
  lockOverlay: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: Spacing.sm,
    marginBottom: Spacing.sm,
  },
  lockText: {
    fontSize: FontSizes.md,
    fontWeight: '600',
    color: Colors.textPrimary,
  },
  placeholderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 6,
  },
  placeholderDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  placeholderBar: {
    flex: 1,
    height: 12,
    borderRadius: 6,
    backgroundColor: Colors.cardBorder,
  },
  placeholderBadge: {
    width: 36,
    height: 12,
    borderRadius: 6,
    backgroundColor: Colors.cardBorder,
  },
});
