// Kiba — Safe Switch Setup Screen (M7)
// Transition setup: old product → new product, preview schedule, start switch.
// Entry from ResultScreen Safe Swap CTA or PantryCard.
// D-084: Zero emoji. D-094: Score framing. D-095: UPVM compliant.

import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Image,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  Alert,
  Modal,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import { Colors, FontSizes, Spacing, getScoreColor } from '../utils/constants';
import { stripBrandFromName } from '../utils/formatters';
import {
  getDefaultDuration,
  getTransitionSchedule,
  getSpeciesNote,
} from '../utils/safeSwitchHelpers';
import { createSafeSwitch, hasActiveSwitchForPet } from '../services/safeSwitchService';
import { getPantryAnchor } from '../services/pantryService';
import { rescheduleAllSafeSwitchNotifications } from '../services/safeSwitchNotificationScheduler';
import { useActivePetStore } from '../stores/useActivePetStore';
import { supabase } from '../services/supabase';
import type { PantryStackParamList } from '../types/navigation';
import type { SafeSwitchProduct } from '../types/safeSwitch';
import type { PantryAnchor } from '../types/pantry';

type Props = NativeStackScreenProps<PantryStackParamList, 'SafeSwitchSetup'>;

function roleLabel(feedingRole: string | null): string | null {
  if (feedingRole === 'base') return 'Base food';
  if (feedingRole === 'rotational') return 'Rotational';
  return null;
}

// ─── Component ──────────────────────────────────────────

export default function SafeSwitchSetupScreen({ navigation, route }: Props) {
  const { pantryItemId, newProductId, petId, newServingSize, newServingSizeUnit, newFeedingsPerDay } = route.params;
  const insets = useSafeAreaInsets();

  const pets = useActivePetStore(s => s.pets);
  const pet = pets.find(p => p.id === petId);
  const species = (pet?.species ?? 'dog') as 'dog' | 'cat';
  const petName = pet?.name ?? 'Your pet';

  const totalDays = getDefaultDuration(species);
  const schedule = getTransitionSchedule(totalDays);
  const speciesNote = getSpeciesNote(species, petName, totalDays);

  // ── State ──
  const [oldProduct, setOldProduct] = useState<SafeSwitchProduct | null>(null);
  const [newProduct, setNewProduct] = useState<SafeSwitchProduct | null>(null);
  const [feedingRole, setFeedingRole] = useState<string | null>(null);
  const [oldScore, setOldScore] = useState<number | null>(null);
  const [newScore, setNewScore] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [hasExisting, setHasExisting] = useState(false);
  /** All this pet's daily-food anchors — used for the slot picker modal. */
  const [allAnchors, setAllAnchors] = useState<PantryAnchor[]>([]);
  const [slotPickerVisible, setSlotPickerVisible] = useState(false);

  // ── Load pantry anchor (old product via join) + new product + scores ──
  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);

      // M9 Phase B: load old product via pantry_items join. This validates the
      // anchor exists, is active, and belongs to this pet in one round-trip.
      const [itemRes, newRes, anchorList] = await Promise.all([
        supabase
          .from('pantry_items')
          .select(`
            id,
            product_id,
            is_active,
            products!product_id (id, name, brand, image_url, category, is_supplemental, ga_kcal_per_cup, ga_kcal_per_kg),
            pantry_pet_assignments!inner (pet_id, feeding_role)
          `)
          .eq('id', pantryItemId)
          .eq('is_active', true)
          .eq('pantry_pet_assignments.pet_id', petId)
          .maybeSingle(),
        supabase
          .from('products')
          .select('id, name, brand, image_url, category, is_supplemental, ga_kcal_per_cup, ga_kcal_per_kg')
          .eq('id', newProductId)
          .single(),
        getPantryAnchor(petId),
      ]);

      if (cancelled) return;

      if (itemRes.error || !itemRes.data) {
        Alert.alert('Item not found', 'This pantry item is no longer available for a Safe Switch.');
        navigation.goBack();
        return;
      }

      const item = itemRes.data as unknown as {
        id: string;
        product_id: string;
        is_active: boolean;
        products: SafeSwitchProduct | null;
        pantry_pet_assignments: { pet_id: string; feeding_role: string | null }[];
      };

      if (!item.products) {
        Alert.alert('Item not found', 'This pantry item is missing product data.');
        navigation.goBack();
        return;
      }

      setOldProduct(item.products);
      const asgn = item.pantry_pet_assignments.find(a => a.pet_id === petId);
      setFeedingRole(asgn?.feeding_role ?? null);
      setAllAnchors(anchorList);

      if (newRes.data) setNewProduct(newRes.data as SafeSwitchProduct);

      // Resolve scores for active pet
      const { data: scores } = await supabase
        .from('pet_product_scores')
        .select('product_id, final_score')
        .eq('pet_id', petId)
        .in('product_id', [item.product_id, newProductId]);

      if (!cancelled && scores) {
        for (const row of scores as { product_id: string; final_score: number }[]) {
          if (row.product_id === item.product_id) setOldScore(row.final_score);
          if (row.product_id === newProductId) setNewScore(row.final_score);
        }
      }
      // Check for existing active switch proactively
      const existing = await hasActiveSwitchForPet(petId);
      if (!cancelled) setHasExisting(existing);

      if (!cancelled) setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [pantryItemId, newProductId, petId, navigation]);

  // ── Start switch ──
  const handleStart = useCallback(async () => {
    setSubmitting(true);
    try {
      // Check for existing active switch
      const hasActive = await hasActiveSwitchForPet(petId);
      if (hasActive) {
        Alert.alert(
          'Active Transition',
          `${petName} already has a food transition in progress. Complete or cancel it first.`,
        );
        setSubmitting(false);
        return;
      }

      const sw = await createSafeSwitch({
        pet_id: petId,
        pantry_item_id: pantryItemId,
        new_product_id: newProductId,
        total_days: totalDays,
        new_serving_size: newServingSize ?? null,
        new_serving_size_unit: newServingSizeUnit ?? null,
        new_feedings_per_day: newFeedingsPerDay ?? null,
      });

      // Schedule notifications
      await rescheduleAllSafeSwitchNotifications();

      // Navigate to detail screen
      navigation.replace('SafeSwitchDetail', { switchId: sw.id });
    } catch (e) {
      Alert.alert('Error', (e as Error).message || 'Failed to start safe switch.');
    } finally {
      setSubmitting(false);
    }
  }, [petId, petName, pantryItemId, newProductId, totalDays, navigation]);

  // ── Slot picker: swap anchor to a different pantry slot ──
  const handlePickSlot = useCallback((nextAnchor: PantryAnchor) => {
    setSlotPickerVisible(false);
    if (nextAnchor.pantryItemId === pantryItemId) return;
    navigation.replace('SafeSwitchSetup', {
      pantryItemId: nextAnchor.pantryItemId,
      newProductId,
      petId,
      newServingSize,
      newServingSizeUnit,
      newFeedingsPerDay,
    });
  }, [pantryItemId, newProductId, petId, newServingSize, newServingSizeUnit, newFeedingsPerDay, navigation]);

  // ── Loading ──
  if (loading || !oldProduct || !newProduct) {
    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <ActivityIndicator size="large" color={Colors.accent} style={{ marginTop: 100 }} />
      </View>
    );
  }

  // ── Phase summary for mini-timeline ──
  const phases = [
    { label: `Days 1-${species === 'cat' ? 3 : 2}`, oldPct: 75, newPct: 25 },
    { label: `Days ${species === 'cat' ? '4-6' : '3-4'}`, oldPct: 50, newPct: 50 },
    { label: `Days ${species === 'cat' ? '7-9' : '5-6'}`, oldPct: 25, newPct: 75 },
    { label: `Day ${totalDays}`, oldPct: 0, newPct: 100 },
  ];

  const oldName = stripBrandFromName(oldProduct.brand, oldProduct.name);
  const newName = stripBrandFromName(newProduct.brand, newProduct.name);

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
          <Ionicons name="chevron-back" size={24} color={Colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Start Safe Switch</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Switching From */}
        <View style={styles.sectionHeaderRow}>
          <Text style={styles.sectionLabel}>SWITCHING FROM</Text>
          {/* M9 Phase B: slot indicator + Change link (only for 2+ slot pets). */}
          {roleLabel(feedingRole) && (
            <Text style={styles.slotLabel}>{roleLabel(feedingRole)}</Text>
          )}
        </View>
        <View style={[styles.productCard, { borderLeftColor: Colors.severityAmber }]}>
          {oldProduct.image_url && (
            <Image source={{ uri: oldProduct.image_url }} style={styles.productImage} />
          )}
          <View style={styles.productInfo}>
            <Text style={styles.productName} numberOfLines={2}>{oldProduct.brand} {oldName}</Text>
            {oldScore != null && (
              <View style={[styles.scoreBadge, { backgroundColor: `${getScoreColor(oldScore, oldProduct.is_supplemental)}33` }]}>
                <Text style={[styles.scoreBadgeText, { color: getScoreColor(oldScore, oldProduct.is_supplemental) }]}>
                  {oldScore}% match for {petName}
                </Text>
              </View>
            )}
            <Text style={styles.productSub}>Currently in {petName}'s pantry</Text>
          </View>
        </View>
        {allAnchors.length >= 2 && (
          <TouchableOpacity
            style={styles.changeSlotLink}
            onPress={() => setSlotPickerVisible(true)}
            activeOpacity={0.7}
          >
            <Ionicons name="swap-vertical-outline" size={14} color={Colors.accent} />
            <Text style={styles.changeSlotText}>Replace a different food</Text>
          </TouchableOpacity>
        )}

        {/* Arrow */}
        <View style={styles.arrowContainer}>
          <Ionicons name="arrow-down" size={20} color={Colors.textTertiary} />
        </View>

        {/* Switching To */}
        <Text style={styles.sectionLabel}>SWITCHING TO</Text>
        <View style={[styles.productCard, { borderLeftColor: Colors.severityGreen }]}>
          {newProduct.image_url && (
            <Image source={{ uri: newProduct.image_url }} style={styles.productImage} />
          )}
          <View style={styles.productInfo}>
            <Text style={styles.productName} numberOfLines={2}>{newProduct.brand} {newName}</Text>
            {newScore != null && (
              <View style={[styles.scoreBadge, { backgroundColor: `${getScoreColor(newScore, newProduct.is_supplemental)}33` }]}>
                <Text style={[styles.scoreBadgeText, { color: getScoreColor(newScore, newProduct.is_supplemental) }]}>
                  {newScore}% match for {petName}
                </Text>
              </View>
            )}
            <Text style={styles.productSub}>Safe Swap recommendation</Text>
          </View>
        </View>

        {/* Transition Plan */}
        <Text style={[styles.sectionLabel, { marginTop: Spacing.lg }]}>TRANSITION PLAN</Text>
        <Text style={styles.planTitle}>{totalDays}-Day Gradual Switch</Text>
        <Text style={styles.planSubtitle}>
          {species === 'cat' ? 'Cats' : 'Dogs'} need gradual food transitions to avoid digestive upset
        </Text>

        {/* Mini phase bars */}
        <View style={styles.phasesRow}>
          {phases.map((phase, i) => (
            <View key={i} style={styles.phaseItem}>
              <Text style={styles.phaseLabel}>{phase.label}</Text>
              <View style={styles.phaseBar}>
                {phase.oldPct > 0 && (
                  <View style={[styles.phaseBarSegment, {
                    flex: phase.oldPct,
                    backgroundColor: `${Colors.severityAmber}60`,
                    borderTopLeftRadius: 4,
                    borderBottomLeftRadius: 4,
                  }]} />
                )}
                <View style={[styles.phaseBarSegment, {
                  flex: phase.newPct,
                  backgroundColor: `${Colors.severityGreen}60`,
                  borderTopRightRadius: 4,
                  borderBottomRightRadius: 4,
                  ...(phase.oldPct === 0 && { borderTopLeftRadius: 4, borderBottomLeftRadius: 4 }),
                }]} />
              </View>
              <Text style={styles.phaseRatio}>
                {phase.newPct === 100 ? '100%' : `${phase.oldPct}/${phase.newPct}`}
              </Text>
            </View>
          ))}
        </View>

        {/* Species note */}
        <View style={styles.noteCard}>
          <Ionicons name="information-circle-outline" size={18} color={Colors.textSecondary} />
          <Text style={styles.noteText}>{speciesNote}</Text>
        </View>
      </ScrollView>

      {/* Existing switch warning */}
      {hasExisting && (
        <View style={styles.existingBanner}>
          <Ionicons name="information-circle-outline" size={18} color={Colors.severityAmber} />
          <Text style={styles.existingBannerText}>
            {petName} already has a food transition in progress. Complete or cancel it before starting a new one.
          </Text>
        </View>
      )}

      {/* CTA */}
      <View style={[styles.ctaContainer, { paddingBottom: insets.bottom + 88 + Spacing.md }]}>
        <TouchableOpacity
          style={[styles.ctaButton, (submitting || hasExisting) && styles.ctaButtonDisabled]}
          onPress={handleStart}
          disabled={submitting || hasExisting}
          activeOpacity={0.7}
        >
          {submitting ? (
            <ActivityIndicator color="#FFFFFF" size="small" />
          ) : (
            <>
              <Ionicons name="swap-horizontal-outline" size={20} color="#FFFFFF" />
              <Text style={styles.ctaText}>Start Safe Switch</Text>
            </>
          )}
        </TouchableOpacity>
      </View>

      {/* M9 Phase B: slot picker modal — 2-slot pets override the auto-picked anchor */}
      <Modal
        visible={slotPickerVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setSlotPickerVisible(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={[styles.modalSheet, { paddingBottom: insets.bottom + Spacing.lg }]}>
            <View style={styles.modalHandle} />
            <Text style={styles.modalTitle}>Replace which food?</Text>
            <Text style={styles.modalSubtitle}>
              Pick the base food {petName}'s Safe Switch should replace.
            </Text>
            {allAnchors.map((anchor) => {
              const isCurrent = anchor.pantryItemId === pantryItemId;
              return (
                <TouchableOpacity
                  key={anchor.pantryItemId}
                  style={[styles.slotOption, isCurrent && styles.slotOptionCurrent]}
                  onPress={() => handlePickSlot(anchor)}
                  activeOpacity={0.7}
                >
                  <View style={styles.slotOptionInfo}>
                    <Text style={styles.slotOptionLabel}>
                      {roleLabel(anchor.feedingRole) ?? 'Base food'}
                    </Text>
                    <Text style={styles.slotOptionScore}>
                      {anchor.resolvedScore != null ? `${anchor.resolvedScore}% match` : 'Not yet scored'}
                      {anchor.productForm ? ` · ${anchor.productForm}` : ''}
                    </Text>
                  </View>
                  {isCurrent && (
                    <Ionicons name="checkmark" size={20} color={Colors.accent} />
                  )}
                </TouchableOpacity>
              );
            })}
            <TouchableOpacity
              style={styles.modalCancel}
              onPress={() => setSlotPickerVisible(false)}
              activeOpacity={0.7}
            >
              <Text style={styles.modalCancelText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

// ─── Styles ─────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
  },
  headerTitle: {
    fontSize: FontSizes.lg,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  scroll: { flex: 1 },
  scrollContent: {
    paddingHorizontal: Spacing.lg,
    paddingBottom: 200,
  },

  // Section labels
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Spacing.sm,
    marginTop: Spacing.md,
  },
  sectionLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: Colors.textTertiary,
    letterSpacing: 0.5,
    marginBottom: Spacing.sm,
    marginTop: Spacing.md,
  },
  slotLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: Colors.accent,
    letterSpacing: 0.3,
  },
  changeSlotLink: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    alignSelf: 'flex-start',
    marginTop: Spacing.sm,
    paddingVertical: 4,
  },
  changeSlotText: {
    fontSize: FontSizes.sm,
    fontWeight: '600',
    color: Colors.accent,
  },

  // Product card
  productCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: Colors.cardSurface,
    borderRadius: 16,
    padding: Spacing.md,
    borderLeftWidth: 3,
    borderWidth: 1,
    borderColor: Colors.hairlineBorder,
  },
  productImage: {
    width: 56,
    height: 56,
    borderRadius: 12,
    backgroundColor: Colors.hairlineBorder,
  },
  productInfo: {
    flex: 1,
    gap: 4,
  },
  productName: {
    fontSize: FontSizes.md,
    fontWeight: '600',
    color: Colors.textPrimary,
    lineHeight: 20,
  },
  productSub: {
    fontSize: 11,
    color: Colors.textTertiary,
  },
  scoreBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  scoreBadgeText: {
    fontSize: 11,
    fontWeight: '600',
  },

  // Arrow
  arrowContainer: {
    alignItems: 'center',
    paddingVertical: Spacing.sm,
  },

  // Plan
  planTitle: {
    fontSize: FontSizes.lg,
    fontWeight: '700',
    color: Colors.textPrimary,
    marginBottom: 4,
  },
  planSubtitle: {
    fontSize: FontSizes.sm,
    color: Colors.textSecondary,
    lineHeight: 18,
    marginBottom: Spacing.md,
  },
  phasesRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: Spacing.lg,
  },
  phaseItem: {
    flex: 1,
    alignItems: 'center',
    gap: 4,
  },
  phaseLabel: {
    fontSize: 10,
    color: Colors.textSecondary,
  },
  phaseBar: {
    flexDirection: 'row',
    height: 8,
    borderRadius: 4,
    overflow: 'hidden',
    width: '100%',
  },
  phaseBarSegment: {
    height: 8,
  },
  phaseRatio: {
    fontSize: 10,
    color: Colors.textTertiary,
    fontWeight: '600',
  },

  // Note
  noteCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    backgroundColor: Colors.cardSurface,
    borderRadius: 12,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.hairlineBorder,
  },
  noteText: {
    flex: 1,
    fontSize: FontSizes.sm,
    color: Colors.textSecondary,
    lineHeight: 20,
  },

  // Existing switch warning
  existingBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    marginHorizontal: Spacing.lg,
    padding: Spacing.md,
    backgroundColor: `${Colors.severityAmber}10`,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: `${Colors.severityAmber}30`,
  },
  existingBannerText: {
    flex: 1,
    fontSize: FontSizes.sm,
    color: Colors.severityAmber,
    lineHeight: 20,
  },

  // CTA
  ctaContainer: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.md,
    backgroundColor: Colors.background,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: Colors.hairlineBorder,
  },
  ctaButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: Colors.accent,
    borderRadius: 16,
    paddingVertical: 16,
  },
  ctaButtonDisabled: {
    opacity: 0.6,
  },
  ctaText: {
    fontSize: FontSizes.lg,
    fontWeight: '700',
    color: '#FFFFFF',
  },

  // Slot picker modal (M9 Phase B)
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.55)',
    justifyContent: 'flex-end',
  },
  modalSheet: {
    backgroundColor: Colors.cardSurface,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.sm,
    borderTopWidth: 1,
    borderColor: Colors.hairlineBorder,
  },
  modalHandle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: Colors.hairlineBorder,
    alignSelf: 'center',
    marginBottom: Spacing.md,
  },
  modalTitle: {
    fontSize: FontSizes.lg,
    fontWeight: '700',
    color: Colors.textPrimary,
    marginBottom: 4,
  },
  modalSubtitle: {
    fontSize: FontSizes.sm,
    color: Colors.textSecondary,
    marginBottom: Spacing.md,
    lineHeight: 20,
  },
  slotOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    paddingHorizontal: Spacing.md,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.hairlineBorder,
    marginBottom: Spacing.sm,
  },
  slotOptionCurrent: {
    borderColor: Colors.accent,
    backgroundColor: 'rgba(255,255,255,0.04)',
  },
  slotOptionInfo: {
    flex: 1,
    gap: 2,
  },
  slotOptionLabel: {
    fontSize: FontSizes.md,
    fontWeight: '600',
    color: Colors.textPrimary,
  },
  slotOptionScore: {
    fontSize: 12,
    color: Colors.textTertiary,
  },
  modalCancel: {
    alignItems: 'center',
    paddingVertical: Spacing.md,
    marginTop: Spacing.sm,
  },
  modalCancelText: {
    fontSize: FontSizes.md,
    color: Colors.textSecondary,
    fontWeight: '500',
  },
});
