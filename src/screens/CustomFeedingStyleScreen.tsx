// Kiba — Custom Feeding Style Configuration Screen
// Allows users to set explicit calorie amounts per food when feeding_style === 'custom'.
// Stores percentages of DER for scale-invariance (kcal auto-adjusts if DER changes).

import React, { useState, useCallback, useMemo, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  StyleSheet,
  SafeAreaView,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
  Image,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BlurView } from 'expo-blur';
import { Colors, FontSizes, Spacing } from '../utils/constants';
import { getConversationalName } from '../utils/formatters';
import { computePetDer } from '../utils/pantryHelpers';
import { getPantryForPet, updateCalorieShares } from '../services/pantryService';
import { useActivePetStore } from '../stores/useActivePetStore';
import { saveSuccess } from '../utils/haptics';
import type { FeedingRole, FeedingFrequency } from '../types/pantry';
import type { Pet } from '../types/pet';

// ─── Types ──────────────────────────────────────────────

interface FoodRow {
  assignmentId: string;
  pantryItemId: string;
  productName: string;
  productBrand: string;
  productImage: string | null;
  calorie_share_pct: number;
  feedingRole: FeedingRole;
}

type Props = {
  route: { params: { petId: string } };
  navigation: { goBack: () => void };
};

// ─── Component ──────────────────────────────────────────

export default function CustomFeedingStyleScreen({ route, navigation }: Props) {
  const { petId } = route.params;
  const pets = useActivePetStore(s => s.pets);
  const pet = useMemo(() => pets.find(p => p.id === petId) ?? null, [pets, petId]);
  const insets = useSafeAreaInsets();

  const [foods, setFoods] = useState<FoodRow[]>([]);
  const [selectedFoodDetail, setSelectedFoodDetail] = useState<FoodRow | null>(null);
  const [inputs, setInputs] = useState<Record<string, string>>({});
  const [roleOverrides, setRoleOverrides] = useState<Record<string, FeedingRole>>({});
  const [inputMode, setInputMode] = useState<'kcal' | 'pct'>('kcal');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Hide tab bar on this screen (same pattern as CompareScreen)
  useEffect(() => {
    const parent = (navigation as any).getParent?.();
    parent?.setOptions({ tabBarStyle: { display: 'none' } });
    return () => { parent?.setOptions({ tabBarStyle: undefined }); };
  }, [navigation]);

  const der = useMemo(() => {
    if (!pet) return 0;
    return computePetDer(pet, false, pet.weight_goal_level) ?? 0;
  }, [pet]);

  // Load daily food assignments on focus
  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      async function load() {
        setLoading(true);
        const items = await getPantryForPet(petId);
        if (cancelled) return;

        // Filter to daily foods only (exclude treats/supplements)
        const dailyItems = items.filter(
          i => i.product.category === 'daily_food' && !i.product.is_supplemental,
        );

        const rows: FoodRow[] = [];
        const initialInputs: Record<string, string> = {};
        const initialRoles: Record<string, FeedingRole> = {};

        for (const item of dailyItems) {
          const myAssignment = item.assignments.find(a => a.pet_id === petId);
          if (!myAssignment) continue;

          const role = myAssignment.feeding_role ?? 'base';
          const sharePct = myAssignment.calorie_share_pct ?? 100;
          const kcal = role === 'rotational' ? 0 : (der > 0 ? Math.round(der * sharePct / 100) : 0);

          rows.push({
            assignmentId: myAssignment.id,
            pantryItemId: item.id,
            productName: item.product.name,
            productBrand: item.product.brand,
            productImage: item.product.image_url,
            calorie_share_pct: sharePct,
            feedingRole: role,
          });

          initialInputs[myAssignment.id] = role === 'rotational' ? '' : String(kcal);
          initialRoles[myAssignment.id] = role;
        }

        setFoods(rows);
        setInputs(initialInputs);
        setRoleOverrides(initialRoles);
        setLoading(false);
      }
      load();
      return () => { cancelled = true; };
    }, [petId, der]),
  );

  // Compute totals from base items only (rotational items logged separately)
  const totalKcal = useMemo(() => {
    return foods.reduce((sum, f) => {
      const role = roleOverrides[f.assignmentId] ?? f.feedingRole;
      if (role === 'rotational') return sum;
      const n = parseFloat(inputs[f.assignmentId] || '0');
      return sum + (isNaN(n) ? 0 : n);
    }, 0);
  }, [inputs, foods, roleOverrides]);

  const totalPct = der > 0 ? Math.round((totalKcal / der) * 100) : 0;

  const sumColor =
    totalPct > 120 ? Colors.severityRed :
    totalPct > 100 ? Colors.severityAmber :
    totalPct < 80 ? Colors.severityAmber :
    Colors.severityGreen;

  // Save handler — includes V2-2 role changes
  const handleSave = useCallback(async () => {
    // Validate at least 1 base item
    const baseCount = foods.filter(f => (roleOverrides[f.assignmentId] ?? f.feedingRole) !== 'rotational').length;
    if (baseCount === 0) {
      Alert.alert('Base food required', 'At least one food must be a base item to anchor your pet\'s daily calories.');
      return;
    }

    setSaving(true);
    try {
      const shares = foods.map(f => {
        const role = roleOverrides[f.assignmentId] ?? f.feedingRole;
        const isRotational = role === 'rotational';
        const kcal = isRotational ? 0 : (parseFloat(inputs[f.assignmentId] || '0') || 0);
        const pct = isRotational ? 0 : (der > 0 ? Math.round((kcal / der) * 100) : 0);

        const entry: {
          assignmentId: string;
          calorie_share_pct: number;
          target_kcal?: number;
          feeding_role?: FeedingRole;
          feeding_frequency?: FeedingFrequency;
          auto_deplete_enabled?: boolean;
        } = { 
          assignmentId: f.assignmentId, 
          calorie_share_pct: pct,
          target_kcal: Math.round(kcal),
        };

        // Include role fields if role changed from original
        if (role !== f.feedingRole) {
          entry.feeding_role = role;
          entry.feeding_frequency = isRotational ? 'as_needed' : 'daily';
          entry.auto_deplete_enabled = !isRotational;
        }

        return entry;
      });

      await updateCalorieShares(petId, shares);
      // PantryScreen's useFocusEffect will reload on goBack — no need to reload here.
      saveSuccess();
      navigation.goBack();
    } catch (e) {
      Alert.alert('Error', (e as Error).message);
    } finally {
      setSaving(false);
    }
  }, [foods, inputs, roleOverrides, der, petId, navigation]);

  // Update input — converts from % to internal kcal when in pct mode
  const updateInputConverted = useCallback((assignmentId: string, value: string) => {
    if (inputMode === 'pct') {
      const pctVal = parseFloat(value) || 0;
      const kcalVal = der > 0 ? Math.round(der * pctVal / 100) : 0;
      setInputs(prev => ({ ...prev, [assignmentId]: String(kcalVal) }));
    } else {
      setInputs(prev => ({ ...prev, [assignmentId]: value }));
    }
  }, [inputMode, der]);

  // Toggle a food's role between base and rotational
  const toggleRole = useCallback((assignmentId: string) => {
    setRoleOverrides(prev => {
      const current = prev[assignmentId] ?? 'base';
      const next = current === 'rotational' ? 'base' : 'rotational';
      return { ...prev, [assignmentId]: next };
    });
  }, []);

  // Render
  if (!pet) {
    return (
      <SafeAreaView style={styles.container}>
        <Text style={styles.emptyText}>Pet not found.</Text>
      </SafeAreaView>
    );
  }

  const renderFoodRow = ({ item }: { item: FoodRow }) => {
    const role = roleOverrides[item.assignmentId] ?? item.feedingRole;
    const isRotational = role === 'rotational';
    const kcalStr = inputs[item.assignmentId] ?? '0';
    const kcal = parseFloat(kcalStr) || 0;
    const pct = der > 0 ? Math.round((kcal / der) * 100) : 0;

    // Display value depends on input mode
    const displayValue = inputMode === 'pct' ? String(pct) : kcalStr;
    const inputLabel = inputMode === 'pct' ? 'Percent' : 'Amount';
    const convertedValueStr = inputMode === 'pct' ? `${Math.round(kcal)} kcal` : `${pct}%`;

    return (
      <View style={styles.foodCard}>
        <TouchableOpacity style={styles.foodInfo} onPress={() => setSelectedFoodDetail(item)} activeOpacity={0.7}>
          {item.productImage ? (
            <View style={styles.cardImageStage}>
              <Image source={{ uri: item.productImage }} style={styles.cardThumbnailImage} />
            </View>
          ) : (
            <View style={[styles.cardImageStage, { justifyContent: 'center', alignItems: 'center', backgroundColor: Colors.chipSurface }]}>
              <Ionicons name="cube-outline" size={16} color={Colors.textTertiary} />
            </View>
          )}
          <View style={styles.cardTextStack}>
            <Text style={styles.foodBrand} numberOfLines={1}>{item.productBrand}</Text>
            <Text style={styles.foodName} numberOfLines={1}>{getConversationalName({ brand: item.productBrand, name: item.productName })}</Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color={Colors.textTertiary} style={styles.cardChevron} />
        </TouchableOpacity>

        {/* V2-2: Role toggle chips */}
        <View style={styles.roleRow}>
          <TouchableOpacity
            style={[styles.roleChip, !isRotational && styles.roleChipActive]}
            onPress={() => isRotational && toggleRole(item.assignmentId)}
            activeOpacity={0.7}
          >
            <Text style={[styles.roleChipText, !isRotational && styles.roleChipTextActive]}>Base</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.roleChip, isRotational && styles.roleChipActive]}
            onPress={() => !isRotational && toggleRole(item.assignmentId)}
            activeOpacity={0.7}
          >
            <Text style={[styles.roleChipText, isRotational && styles.roleChipTextActive]}>Rotational</Text>
          </TouchableOpacity>
        </View>

        {isRotational ? (
          <View style={styles.rotationalLabel}>
            <Ionicons name="restaurant-outline" size={14} color={Colors.textTertiary} />
            <Text style={styles.rotationalText}>Logged via "Fed This Today"</Text>
          </View>
        ) : (
          <View style={styles.inputRow}>
            <View style={styles.inputContainer}>
              <Text style={styles.inputLeftLabel}>{inputLabel}</Text>
              <TextInput
                style={styles.kcalInput}
                keyboardType="decimal-pad"
                returnKeyType="done"
                value={displayValue}
                onChangeText={(v) => updateInputConverted(item.assignmentId, v)}
                placeholderTextColor={Colors.textTertiary}
                selectTextOnFocus
              />
            </View>
            <View style={styles.convertedBadge}>
              <Text style={styles.convertedBadgeText}>{convertedValueStr}</Text>
            </View>
          </View>
        )}
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity
            onPress={navigation.goBack}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            activeOpacity={0.7}
            accessibilityRole="button"
            accessibilityLabel="Go back"
          >
            <Ionicons name="chevron-back" size={24} color={Colors.textPrimary} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Custom Splits</Text>
          <View style={styles.segmentedContainer}>
            <TouchableOpacity
              style={[styles.segmentedPill, inputMode === 'pct' && styles.segmentedPillActive]}
              onPress={() => setInputMode('pct')}
              activeOpacity={0.7}
            >
              <Text style={[styles.segmentedPillText, inputMode === 'pct' && styles.segmentedPillTextActive]}>%</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.segmentedPill, inputMode === 'kcal' && styles.segmentedPillActive]}
              onPress={() => setInputMode('kcal')}
              activeOpacity={0.7}
            >
              <Text style={[styles.segmentedPillText, inputMode === 'kcal' && styles.segmentedPillTextActive]}>kcal</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* DER banner */}
        <View style={styles.derBanner}>
          <Ionicons name="flame" size={18} color={Colors.accent} />
          <Text style={styles.derText}>
            {pet.name}'s daily energy: <Text style={styles.derValue}>{Math.round(der)} kcal/day</Text>
          </Text>
        </View>

        {loading ? (
          <ActivityIndicator style={{ marginTop: Spacing.xl }} color={Colors.accent} />
        ) : foods.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>No daily foods in {pet.name}'s pantry.</Text>
            <Text style={styles.emptySubtext}>Add food first, then configure splits.</Text>
          </View>
        ) : (
          <>
            <FlatList
              data={foods}
              keyExtractor={item => item.assignmentId}
              renderItem={renderFoodRow}
              contentContainerStyle={styles.listContent}
              keyboardShouldPersistTaps="handled"
            />

            {/* Sum bar */}
            <View style={styles.sumBar}>
              <View style={styles.sumRow}>
                <Text style={styles.sumLabel}>Base total</Text>
                <Text style={[styles.sumValue, { color: sumColor }]}>
                  {Math.round(totalKcal)} / {Math.round(der)} kcal
                </Text>
                <Text style={[styles.sumPct, { color: sumColor }]}>{totalPct}%</Text>
              </View>
              {foods.some(f => (roleOverrides[f.assignmentId] ?? f.feedingRole) === 'rotational') && (
                <Text style={styles.rotationalNote}>Rotational items logged separately</Text>
              )}
              <View style={styles.progressTrack}>
                <View
                  style={[
                    styles.progressFill,
                    { width: `${Math.min(totalPct, 100)}%`, backgroundColor: sumColor },
                  ]}
                />
              </View>
              {totalPct > 120 && (
                <Text style={styles.sumWarning}>Significantly over daily requirement.</Text>
              )}
              {totalPct < 80 && totalPct > 0 && (
                <Text style={styles.sumWarning}>Below 80% of daily requirement.</Text>
              )}
            </View>

            {/* Save button */}
            <TouchableOpacity
              style={[styles.saveButton, saving && styles.saveButtonDisabled, { marginBottom: Math.max(insets.bottom, Spacing.md) }]}
              onPress={handleSave}
              disabled={saving}
              activeOpacity={0.7}
            >
              {saving ? (
                <ActivityIndicator color={Colors.background} size="small" />
              ) : (
                <Text style={styles.saveButtonText}>Save Splits</Text>
              )}
            </TouchableOpacity>
          </>
        )}
      </KeyboardAvoidingView>

      {/* Product Detail Bottom Sheet */}
      <Modal
        visible={!!selectedFoodDetail}
        transparent
        animationType="slide"
        onRequestClose={() => setSelectedFoodDetail(null)}
      >
        <Pressable style={styles.modalOverlay} onPress={() => setSelectedFoodDetail(null)}>
          <BlurView intensity={40} tint="dark" style={StyleSheet.absoluteFill} />
        </Pressable>
        <View style={styles.modalSheetContainer}>
          <View style={[styles.modalSheet, { paddingBottom: Math.max(insets.bottom, Spacing.md) + Spacing.md }]}>
            <View style={styles.modalHandle} />
            <View style={styles.modalHeaderRow}>
              {selectedFoodDetail?.productImage ? (
                <View style={styles.modalImageStage}>
                  <Image source={{ uri: selectedFoodDetail.productImage }} style={styles.modalProductImage} />
                </View>
              ) : (
                <View style={[styles.modalImageStage, { justifyContent: 'center', alignItems: 'center', backgroundColor: Colors.chipSurface }]}>
                  <Ionicons name="cube-outline" size={24} color={Colors.textTertiary} />
                </View>
              )}
              <View style={styles.modalHeaderTextContainer}>
                <Text style={styles.modalBrandText} numberOfLines={1}>{selectedFoodDetail?.productBrand}</Text>
                <Text style={styles.modalNameText}>{selectedFoodDetail?.productName}</Text>
              </View>
            </View>
            <TouchableOpacity
              style={styles.modalCloseButton}
              onPress={() => setSelectedFoodDetail(null)}
              activeOpacity={0.7}
              accessibilityRole="button"
              accessibilityLabel="Close product details"
            >
              <Text style={styles.modalCloseText}>Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
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
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
  },
  headerTitle: {
    fontSize: FontSizes.lg,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  derBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    marginHorizontal: Spacing.md,
    marginBottom: Spacing.sm,
    backgroundColor: Colors.accentTint,
    borderRadius: 12,
  },
  derText: {
    fontSize: FontSizes.sm,
    color: Colors.textSecondary,
  },
  derValue: {
    fontWeight: '600',
    color: Colors.textPrimary,
  },
  listContent: {
    paddingHorizontal: Spacing.md,
    paddingBottom: Spacing.md,
  },
  foodCard: {
    backgroundColor: Colors.cardSurface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.hairlineBorder,
    padding: Spacing.md,
    marginBottom: Spacing.md,
  },
  foodInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Spacing.sm,
  },
  cardImageStage: {
    width: 40,
    height: 40,
    borderRadius: 8,
    backgroundColor: Colors.productStage,
    padding: 4,
    marginRight: Spacing.sm,
  },
  cardThumbnailImage: {
    width: '100%',
    height: '100%',
    resizeMode: 'contain',
  },
  cardTextStack: {
    flex: 1,
    justifyContent: 'center',
  },
  cardChevron: {
    marginLeft: Spacing.xs,
  },
  foodBrand: {
    fontSize: FontSizes.xs,
    color: Colors.textTertiary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  foodName: {
    fontSize: FontSizes.md,
    fontWeight: '600',
    color: Colors.textPrimary,
    marginTop: 2,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
  },
  inputContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.background,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.hairlineBorder,
    paddingHorizontal: Spacing.md,
  },
  inputLeftLabel: {
    fontSize: FontSizes.md,
    color: Colors.textSecondary,
  },
  kcalInput: {
    flex: 1,
    paddingVertical: Spacing.xs,
    paddingLeft: Spacing.sm,
    fontSize: FontSizes.lg,
    fontWeight: '600',
    color: Colors.textPrimary,
    textAlign: 'right',
  },
  convertedBadge: {
    backgroundColor: Colors.chipSurface,
    borderRadius: 8,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 8,
    justifyContent: 'center',
    alignItems: 'center',
    minWidth: 70,
  },
  convertedBadgeText: {
    fontSize: FontSizes.md,
    fontWeight: '600',
    color: Colors.textSecondary,
  },
  sumBar: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderTopWidth: 1,
    borderTopColor: Colors.hairlineBorder,
  },
  sumRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Spacing.xs,
  },
  sumLabel: {
    fontSize: FontSizes.sm,
    fontWeight: '600',
    color: Colors.textSecondary,
  },
  sumValue: {
    flex: 1,
    fontSize: FontSizes.md,
    fontWeight: '700',
    textAlign: 'right',
    marginRight: Spacing.sm,
  },
  sumPct: {
    fontSize: FontSizes.sm,
    fontWeight: '700',
    minWidth: 40,
    textAlign: 'right',
  },
  progressTrack: {
    height: 6,
    backgroundColor: Colors.hairlineBorder,
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 3,
  },
  sumWarning: {
    fontSize: FontSizes.xs,
    color: Colors.severityAmber,
    marginTop: Spacing.xs,
  },
  saveButton: {
    backgroundColor: Colors.accent,
    borderRadius: 12,
    paddingVertical: Spacing.sm + 2,
    marginHorizontal: Spacing.md,
    marginBottom: Spacing.md,
    alignItems: 'center',
  },
  saveButtonDisabled: {
    opacity: 0.6,
  },
  saveButtonText: {
    fontSize: FontSizes.md,
    fontWeight: '700',
    color: Colors.background,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: Spacing.lg,
  },
  emptyText: {
    fontSize: FontSizes.md,
    color: Colors.textSecondary,
    textAlign: 'center',
  },
  emptySubtext: {
    fontSize: FontSizes.sm,
    color: Colors.textTertiary,
    textAlign: 'center',
    marginTop: Spacing.xs,
  },
  segmentedContainer: {
    flexDirection: 'row',
    backgroundColor: Colors.background,
    borderRadius: 8,
    padding: 2,
  },
  segmentedPill: {
    paddingHorizontal: Spacing.sm + 2,
    paddingVertical: 4,
    borderRadius: 6,
  },
  segmentedPillActive: {
    backgroundColor: Colors.accent,
  },
  segmentedPillText: {
    fontSize: FontSizes.xs,
    fontWeight: '700',
    color: Colors.textTertiary,
  },
  segmentedPillTextActive: {
    color: Colors.textPrimary,
  },
  roleRow: {
    flexDirection: 'row',
    gap: Spacing.xs,
    marginBottom: Spacing.sm,
  },
  roleChip: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'transparent',
    backgroundColor: Colors.chipSurface,
  },
  roleChipActive: {
    backgroundColor: Colors.accent,
    borderColor: Colors.accent,
  },
  roleChipText: {
    fontSize: FontSizes.xs,
    fontWeight: '600',
    color: Colors.textSecondary,
  },
  roleChipTextActive: {
    color: Colors.background,
  },
  rotationalLabel: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    paddingVertical: Spacing.xs,
  },
  rotationalText: {
    fontSize: FontSizes.sm,
    color: Colors.textTertiary,
    fontStyle: 'italic',
  },
  rotationalNote: {
    fontSize: FontSizes.xs,
    color: Colors.textTertiary,
    marginTop: 2,
  },
  modalOverlay: { ...StyleSheet.absoluteFillObject },
  modalSheetContainer: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  modalSheet: {
    backgroundColor: Colors.cardSurface,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.md,
    maxHeight: '85%',
  },
  modalHandle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: Colors.textTertiary,
    alignSelf: 'center',
    marginBottom: Spacing.md,
  },
  modalHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Spacing.xl,
  },
  modalImageStage: {
    width: 64,
    height: 64,
    borderRadius: 8,
    backgroundColor: Colors.productStage,
    padding: 12,
    marginRight: Spacing.md,
  },
  modalProductImage: {
    width: '100%',
    height: '100%',
    resizeMode: 'contain',
  },
  modalHeaderTextContainer: {
    flex: 1,
  },
  modalBrandText: {
    fontSize: FontSizes.xs,
    color: Colors.textTertiary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  modalNameText: {
    fontSize: FontSizes.md,
    fontWeight: '600',
    color: Colors.textPrimary,
  },
  modalCloseButton: {
    alignItems: 'center',
    paddingVertical: Spacing.sm + 2,
    borderRadius: 12,
    backgroundColor: Colors.chipSurface,
  },
  modalCloseText: {
    fontSize: FontSizes.md,
    fontWeight: '600',
    color: Colors.textPrimary,
  },
});
