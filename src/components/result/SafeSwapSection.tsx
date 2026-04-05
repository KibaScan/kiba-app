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
        style={[s.headerRow, expanded && s.headerRowExpanded]}
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

              {/* Swap reason — only when an honest reason exists (condition- or
                  allergen-specific). Generic swaps return null from
                  generateSwapReason to avoid misleading "Higher overall match" */}
              {c.reason && (
                <Text style={s.reason} numberOfLines={2}>
                  {c.reason}
                </Text>
              )}
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
    backgroundColor: Colors.cardSurface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.hairlineBorder,
    padding: Spacing.md,
    marginBottom: Spacing.md,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerRowExpanded: {
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
    backgroundColor: 'rgba(255,255,255,0.04)',
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
  reason: {
    fontSize: 10,
    fontStyle: 'italic',
    color: Colors.textTertiary,
    marginTop: Spacing.xs,
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
    borderColor: Colors.accent + '30',
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
