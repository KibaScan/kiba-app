// EditPantryItemScreen — Full-screen edit for a pantry item.
// Navigated from PantryCard tap. Auto-saves on field change.
// D-155: Empty item states. D-158: Recalled item states. D-157: Remove nudge.
// D-084: Zero emoji. D-094: Score framing. D-095: UPVM compliant.

import React, { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  TextInput,
  Alert,
  Image,
  Modal,
  Pressable,
  SafeAreaView,
  Switch,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import DateTimePicker, { DateTimePickerEvent } from '@react-native-community/datetimepicker';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import type { PantryStackParamList } from '../types/navigation';
import type { PantryCardData, FeedingFrequency } from '../types/pantry';
import type { Product } from '../types';
import { PantryOfflineError } from '../types/pantry';
import { usePantryStore } from '../stores/usePantryStore';
import { rescheduleAllFeeding } from '../services/feedingNotificationScheduler';
import { useActivePetStore } from '../stores/useActivePetStore';
import {
  updatePantryItem,
  updatePetAssignment,
} from '../services/pantryService';
import {
  calculateDepletionBreakdown,
} from '../utils/pantryHelpers';
import { canUseGoalWeight } from '../utils/permissions';
import { stripBrandFromName, formatServing } from '../utils/formatters';
import { shouldShowD157Nudge } from './PantryScreen';
import { SharePantrySheet } from '../components/pantry/SharePantrySheet';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { chipToggle } from '../utils/haptics';
import {
  Colors,
  FontSizes,
  Spacing,
  SEVERITY_COLORS,
} from '../utils/constants';

// ─── Types ──────────────────────────────────────────────

type Props = NativeStackScreenProps<PantryStackParamList, 'EditPantryItem'>;

// ─── Exported Pure Helpers ──────────────────────────────

export function formatTime(time24: string): string {
  const [hStr, mStr] = time24.split(':');
  const h = parseInt(hStr, 10);
  const period = h >= 12 ? 'PM' : 'AM';
  const displayH = h === 0 ? 12 : h > 12 ? h - 12 : h;
  return `${displayH}:${mStr} ${period}`;
}

// D-164: unit label is always 'servings' — picker removed

// ─── Component ──────────────────────────────────────────

export default function EditPantryItemScreen({ navigation, route }: Props) {
  const { itemId } = route.params;

  // ── Stores ──
  const items = usePantryStore(s => s.items);
  const restockItem = usePantryStore(s => s.restockItem);
  const removeItem = usePantryStore(s => s.removeItem);
  const loadPantry = usePantryStore(s => s.loadPantry);
  const activePetId = useActivePetStore(s => s.activePetId);
  const activePet = useActivePetStore(s => s.pets.find(p => p.id === s.activePetId));

  const item = items.find(i => i.id === itemId);

  const myAssignment = useMemo(() =>
    item?.assignments.find(a => a.pet_id === activePetId) ?? item?.assignments[0] ?? null,
    [item, activePetId],
  );

  // ── Item fields (local state) ──
  const [qtyRemaining, setQtyRemaining] = useState(() => String(item?.quantity_remaining ?? 0));
  const [qtyOriginal, setQtyOriginal] = useState(() => String(item?.quantity_original ?? 0));
  // D-164: unitLabel always 'servings'

  // ── Assignment fields (local state) ──
  const [feedingFrequency, setFeedingFrequency] = useState<FeedingFrequency>(
    () => myAssignment?.feeding_frequency ?? 'daily',
  );
  const [feedingTimes, setFeedingTimes] = useState<string[]>(
    () => myAssignment?.feeding_times ?? [],
  );
  const [notificationsOn, setNotificationsOn] = useState(
    () => myAssignment?.notifications_on ?? false,
  );

  // ── Modals ──
  const [shareSheetVisible, setShareSheetVisible] = useState(false);
  const [timePickerVisible, setTimePickerVisible] = useState(false);
  const [removeModalVisible, setRemoveModalVisible] = useState(false);
  const [pickerTime, setPickerTime] = useState(() => {
    const d = new Date();
    d.setHours(7, 0, 0, 0);
    return d;
  });

  // Hide global tab bar on this screen (matches CustomFeedingStyle + CompareScreen).
  useEffect(() => {
    const parent = (navigation as any).getParent?.();
    parent?.setOptions({ tabBarStyle: { display: 'none' } });
    return () => { parent?.setOptions({ tabBarStyle: undefined }); };
  }, [navigation]);

  const product = item?.product ?? null;
  const isRecalled = product?.is_recalled ?? false;
  const isEmpty = item?.is_empty ?? false;
  const isUnitMode = item?.serving_mode === 'unit';
  const displayName = product ? stripBrandFromName(product.brand, product.name) : '';
  const isShared = (item?.assignments?.length ?? 0) > 1;

  // ── Derived: depletion ──
  const depletion = useMemo(() => {
    if (!item || !myAssignment || !product || isRecalled || product.category === 'treat') return null;
    const qty = parseFloat(qtyRemaining);
    if (isNaN(qty) || qty < 0) return null;
    return calculateDepletionBreakdown(
      myAssignment.serving_size,
      isUnitMode ? 'units' : myAssignment.serving_size_unit,
      myAssignment.feedings_per_day,
      qty,
      isUnitMode ? 'units' : item.quantity_unit,
      isUnitMode ? 'servings' : null,
      product as unknown as Product,
    );
  }, [item, myAssignment, product, isRecalled, qtyRemaining, isUnitMode]);

  // ── Card opacity helpers ──
  const feedingOpacity = isRecalled ? 0.4 : isEmpty ? 0.6 : 1;
  const scheduleOpacity = isRecalled ? 0.4 : isEmpty ? 0.6 : 1;
  const feedingDisabled = isRecalled;
  const scheduleDisabled = isRecalled;

  // ── Save handlers (auto-save) ──

  const saveError = () => Alert.alert('Error', 'Failed to save. Check your connection.');

  const saveItemField = useCallback(async (field: 'quantity_remaining' | 'quantity_original', value: number) => {
    try {
      await updatePantryItem(itemId, { [field]: value } as Record<string, unknown>);
    } catch (e) {
      if (e instanceof PantryOfflineError) Alert.alert('Offline', e.message);
      else saveError();
    }
  }, [itemId]);

  const saveAssignmentField = useCallback(async (updates: Record<string, unknown>) => {
    if (!myAssignment) return;
    try {
      await updatePetAssignment(myAssignment.id, updates as Parameters<typeof updatePetAssignment>[1]);
    } catch (e) {
      if (e instanceof PantryOfflineError) Alert.alert('Offline', e.message);
      else saveError();
    }
  }, [myAssignment]);

  // ── Field handlers ──

  const handleQtyRemainingBlur = useCallback(() => {
    const val = parseFloat(qtyRemaining);
    if (!isNaN(val) && val >= 0) {
      const clamped = Math.round(val * 10) / 10;
      setQtyRemaining(formatServing(clamped));
      saveItemField('quantity_remaining', clamped);
    }
  }, [qtyRemaining, saveItemField]);

  const handleQtyOriginalBlur = useCallback(() => {
    const val = parseFloat(qtyOriginal);
    if (!isNaN(val) && val > 0) {
      const clamped = Math.round(val * 10) / 10;
      setQtyOriginal(formatServing(clamped));
      saveItemField('quantity_original', clamped);
    }
  }, [qtyOriginal, saveItemField]);

  // D-164: handleUnitLabelChange removed — unit label is always 'servings'

  const handleFrequencyToggle = useCallback((freq: FeedingFrequency) => {
    chipToggle();
    setFeedingFrequency(freq);
    saveAssignmentField({ feeding_frequency: freq });
    if (freq === 'as_needed') {
      setNotificationsOn(false);
      saveAssignmentField({ feeding_frequency: freq, notifications_on: false });
    }
    rescheduleAllFeeding().catch(() => {});
  }, [saveAssignmentField]);

  const handleNotificationsToggle = useCallback((val: boolean) => {
    setNotificationsOn(val);
    saveAssignmentField({ notifications_on: val });
    rescheduleAllFeeding().catch(() => {});
  }, [saveAssignmentField]);

  const handleAddTime = useCallback((time: string) => {
    setTimePickerVisible(false);
    if (feedingTimes.includes(time)) return;
    const next = [...feedingTimes, time].sort();
    setFeedingTimes(next);
    saveAssignmentField({ feeding_times: next });
    rescheduleAllFeeding().catch(() => {});
  }, [feedingTimes, saveAssignmentField]);

  const handlePickerChange = useCallback((_: DateTimePickerEvent, date?: Date) => {
    if (date) setPickerTime(date);
  }, []);

  const handlePickerConfirm = useCallback(() => {
    const h = String(pickerTime.getHours()).padStart(2, '0');
    const m = String(pickerTime.getMinutes()).padStart(2, '0');
    handleAddTime(`${h}:${m}`);
  }, [pickerTime, handleAddTime]);

  const handleRemoveTime = useCallback((time: string) => {
    const next = feedingTimes.filter(t => t !== time);
    setFeedingTimes(next);
    saveAssignmentField({ feeding_times: next.length > 0 ? next : null });
    rescheduleAllFeeding().catch(() => {});
  }, [feedingTimes, saveAssignmentField]);

  // ── Action handlers ──

  const handleRestock = useCallback(async () => {
    if (!item || !product) return;
    try {
      await restockItem(itemId);
      setQtyRemaining(String(item.quantity_original));
      Alert.alert('Restocked', `${product.name} restocked.`);
    } catch {
      saveError();
    }
  }, [item, product, itemId, restockItem]);

  const handleRemoveSingle = useCallback(() => {
    if (!product || !item) return;
    Alert.alert(
      'Remove Item',
      `Remove ${product.name} from your pantry?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove', style: 'destructive', onPress: async () => {
            const remaining = items.filter(i => i.id !== itemId);
            await removeItem(itemId);
            if (activePetId && shouldShowD157Nudge(item, remaining, activePetId)) {
              Alert.alert('Intake Changed', `${activePet?.name ?? 'Your pet'}'s daily intake from pantry items has changed.`);
            }
            navigation.goBack();
          },
        },
      ],
    );
  }, [product, item, items, itemId, removeItem, activePetId, activePet, navigation]);

  const handleRemoveSharedAll = useCallback(async () => {
    if (!item) return;
    setRemoveModalVisible(false);
    const remaining = items.filter(i => i.id !== itemId);
    await removeItem(itemId);
    if (activePetId && shouldShowD157Nudge(item, remaining, activePetId)) {
      Alert.alert('Intake Changed', `${activePet?.name ?? 'Your pet'}'s daily intake from pantry items has changed.`);
    }
    navigation.goBack();
  }, [item, items, itemId, removeItem, activePetId, activePet, navigation]);

  const handleRemoveSharedPetOnly = useCallback(async () => {
    if (!item) return;
    setRemoveModalVisible(false);
    const remaining = items.filter(i => i.id !== itemId);
    await removeItem(itemId, activePetId!);
    if (activePetId && shouldShowD157Nudge(item, remaining, activePetId)) {
      Alert.alert('Intake Changed', `${activePet?.name ?? 'Your pet'}'s daily intake from pantry items has changed.`);
    }
    navigation.goBack();
  }, [item, items, itemId, removeItem, activePetId, activePet, navigation]);

  const handleRemovePress = useCallback(() => {
    if (isShared) {
      setRemoveModalVisible(true);
    } else {
      handleRemoveSingle();
    }
  }, [isShared, handleRemoveSingle]);

  const handleShareChanged = useCallback(() => {
    if (activePetId) loadPantry(activePetId);
  }, [activePetId, loadPantry]);

  // ── Depletion summary text ──
  const depletionText = useMemo(() => {
    if (!depletion) return null;
    const base = depletion.rateText;
    if (isEmpty) return `${base} \u00B7 Empty`;
    return depletion.daysText ? `${base} \u00B7 ${depletion.daysText}` : base;
  }, [depletion, isEmpty]);

  // ── Not found guard (after all hooks) ──
  if (!item || !myAssignment || !product) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.headerBar}>
          <TouchableOpacity onPress={() => navigation.goBack()} hitSlop={12}>
            <Ionicons name="chevron-back" size={24} color={Colors.textPrimary} />
          </TouchableOpacity>
        </View>
        <View style={styles.notFound}>
          <Text style={styles.notFoundText}>Item not found</Text>
        </View>
      </SafeAreaView>
    );
  }

  // ── Render ──
  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
          {/* Header */}
          <View style={styles.headerBar}>
            <TouchableOpacity onPress={() => navigation.goBack()} hitSlop={12}>
              <Ionicons name="chevron-back" size={24} color={Colors.textPrimary} />
            </TouchableOpacity>
            <View style={styles.headerInfo}>
              <Text style={styles.headerBrand} numberOfLines={1}>{product.brand}</Text>
              <Text style={styles.headerName} numberOfLines={1}>{displayName}</Text>
            </View>
            {product.image_url ? (
              <Image source={{ uri: product.image_url }} style={styles.headerImage} />
            ) : (
              <View style={[styles.headerImage, styles.headerImagePlaceholder]}>
                <Ionicons name="cube-outline" size={20} color={Colors.textTertiary} />
              </View>
            )}
          </View>

          {/* ── Quantity Card ── */}
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Quantity</Text>

            <Text style={styles.label}>Remaining</Text>
            <View style={styles.inputRow}>
              <TextInput
                style={styles.numberInput}
                keyboardType="decimal-pad"
                value={qtyRemaining}
                onChangeText={setQtyRemaining}
                onBlur={handleQtyRemainingBlur}
              />
              <Text style={styles.unitSuffix}>
                {isUnitMode ? 'servings' : item.quantity_unit}
              </Text>
            </View>

            <Text style={styles.label}>Original size</Text>
            <View style={styles.inputRow}>
              <TextInput
                style={styles.numberInput}
                keyboardType="decimal-pad"
                value={qtyOriginal}
                onChangeText={setQtyOriginal}
                onBlur={handleQtyOriginalBlur}
              />
              <Text style={styles.unitSuffix}>
                {isUnitMode ? 'servings' : item.quantity_unit}
              </Text>
            </View>

            {/* D-164: Unit type picker removed — always 'servings' */}
          </View>

          {/* ── Feeding Details ── */}
          <View style={[styles.card, { opacity: feedingOpacity }]} pointerEvents={feedingDisabled ? 'none' : 'auto'}>
            <Text style={styles.cardTitle}>Feeding Configuration</Text>

            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Role</Text>
              <View style={styles.rolePill}>
                <Text style={styles.rolePillText}>
                  {myAssignment.feeding_role === 'base' ? 'Base Diet' : myAssignment.feeding_role === 'rotational' ? 'Rotational Food' : 'Treat / Supplement'}
                </Text>
              </View>
            </View>

            {myAssignment.feeding_role === 'base' && myAssignment.calorie_share_pct != null && (
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Calorie Share</Text>
                <Text style={styles.infoValue}>{myAssignment.calorie_share_pct}%</Text>
              </View>
            )}

            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Auto-Deplete</Text>
              <Text style={styles.infoValue}>{myAssignment.auto_deplete_enabled ? 'Enabled' : 'Disabled'}</Text>
            </View>

            <TouchableOpacity
              style={styles.editSplitsLink}
              onPress={() => navigation.navigate('CustomFeedingStyle', { petId: activePetId! })}
              activeOpacity={0.7}
              accessibilityRole="button"
              accessibilityLabel="Edit splits in Custom Splits screen"
            >
              <Text style={styles.editSplitsText}>Edit in Custom Splits</Text>
              <Ionicons name="chevron-forward" size={16} color={Colors.accent} />
            </TouchableOpacity>
          </View>

          {/* ── Schedule Card ── */}
          <View style={[styles.card, { opacity: scheduleOpacity }]} pointerEvents={scheduleDisabled ? 'none' : 'auto'}>
            <Text style={styles.cardTitle}>Schedule</Text>

            <Text style={styles.label}>Feeding schedule</Text>
            <View style={styles.toggleRow}>
              <TouchableOpacity
                style={[styles.toggleBtn, feedingFrequency === 'daily' && styles.toggleBtnActive]}
                onPress={() => handleFrequencyToggle('daily')}
                activeOpacity={0.7}
              >
                <Text style={[styles.toggleText, feedingFrequency === 'daily' && styles.toggleTextActive]}>
                  Daily
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.toggleBtn, feedingFrequency === 'as_needed' && styles.toggleBtnActive]}
                onPress={() => handleFrequencyToggle('as_needed')}
                activeOpacity={0.7}
              >
                <Text style={[styles.toggleText, feedingFrequency === 'as_needed' && styles.toggleTextActive]}>
                  As needed
                </Text>
              </TouchableOpacity>
            </View>

            {feedingFrequency === 'daily' && (
              <>
                <View style={styles.switchRow}>
                  <Text style={styles.switchLabel}>Notifications</Text>
                  <Switch
                    value={notificationsOn}
                    onValueChange={handleNotificationsToggle}
                    trackColor={{ false: Colors.chipSurface, true: Colors.accent }}
                    thumbColor="#FFFFFF"
                  />
                </View>

                {notificationsOn && (
                  <>
                    <Text style={styles.label}>Feeding times</Text>
                    <View style={styles.timesContainer}>
                      {feedingTimes.map(t => (
                        <View key={t} style={styles.timeTag}>
                          <Text style={styles.timeTagText}>{formatTime(t)}</Text>
                          <TouchableOpacity onPress={() => handleRemoveTime(t)} hitSlop={8}>
                            <Ionicons name="close-circle" size={16} color={Colors.textTertiary} />
                          </TouchableOpacity>
                        </View>
                      ))}
                      {feedingTimes.length < myAssignment.feedings_per_day && (
                        <TouchableOpacity
                          style={styles.addTimeBtn}
                          onPress={() => setTimePickerVisible(true)}
                          activeOpacity={0.7}
                        >
                          <Ionicons name="add" size={16} color={Colors.accent} />
                          <Text style={styles.addTimeText}>Add time</Text>
                        </TouchableOpacity>
                      )}
                    </View>
                  </>
                )}
              </>
            )}
          </View>

          {/* ── Depletion Summary ── */}
          {!isRecalled && depletionText && (
            <View style={styles.depletionRow}>
              <Ionicons name="timer-outline" size={14} color={Colors.textSecondary} />
              <Text style={styles.depletionText}>{depletionText}</Text>
            </View>
          )}

          {/* ── Recall link ── */}
          {isRecalled && (
            <TouchableOpacity
              style={styles.recallLink}
              onPress={() => navigation.navigate('Result', { productId: item.product_id, petId: activePetId })}
              activeOpacity={0.7}
            >
              <Ionicons name="warning-outline" size={16} color={SEVERITY_COLORS.danger} />
              <Text style={styles.recallLinkText}>View Recall Details</Text>
              <Ionicons name="chevron-forward" size={16} color={SEVERITY_COLORS.danger} />
            </TouchableOpacity>
          )}

          {/* ── Actions ──
              Adaptive hierarchy per 2026-04-12 polish spec:
              - Restock: primary cyan fill when empty/low, chipSurface secondary otherwise.
              - Share: always chipSurface secondary.
              - Remove: red text-link (no background, no border). */}
          <View style={styles.actions}>
            {!isRecalled && (() => {
              const restockIsPrimary = isEmpty || item.is_low_stock;
              return (
                <TouchableOpacity
                  style={[
                    styles.actionBtn,
                    restockIsPrimary ? styles.actionBtnPrimary : styles.actionBtnSecondary,
                  ]}
                  onPress={handleRestock}
                  activeOpacity={0.7}
                >
                  <Ionicons
                    name="refresh-outline"
                    size={18}
                    color={restockIsPrimary ? '#FFFFFF' : Colors.accent}
                  />
                  <Text style={[
                    styles.actionBtnText,
                    restockIsPrimary ? styles.actionBtnTextPrimary : styles.actionBtnTextSecondary,
                  ]}>
                    Restock
                  </Text>
                </TouchableOpacity>
              );
            })()}

            {!isRecalled && (
              <TouchableOpacity
                style={[styles.actionBtn, styles.actionBtnSecondary]}
                onPress={() => setShareSheetVisible(true)}
                activeOpacity={0.7}
              >
                <Ionicons name="people-outline" size={18} color={Colors.accent} />
                <Text style={[styles.actionBtnText, styles.actionBtnTextSecondary]}>
                  Share with other pets
                </Text>
              </TouchableOpacity>
            )}

            <TouchableOpacity
              style={styles.actionBtnLink}
              onPress={handleRemovePress}
              activeOpacity={0.7}
            >
              <Ionicons name="trash-outline" size={16} color={SEVERITY_COLORS.danger} />
              <Text style={styles.actionBtnTextLink}>Remove from Pantry</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.bottomSpacer} />
        </ScrollView>
      </KeyboardAvoidingView>

      {/* ── Time Picker Modal ── */}
      <Modal visible={timePickerVisible} transparent animationType="fade" onRequestClose={() => setTimePickerVisible(false)}>
        <Pressable style={styles.modalOverlay} onPress={() => setTimePickerVisible(false)} />
        <View style={styles.modalSheet}>
          <Text style={styles.modalTitle}>Select Time</Text>
          <DateTimePicker
            value={pickerTime}
            mode="time"
            display="spinner"
            onChange={handlePickerChange}
            themeVariant="dark"
            minuteInterval={5}
          />
          <TouchableOpacity
            style={styles.pickerConfirmBtn}
            onPress={handlePickerConfirm}
            activeOpacity={0.7}
          >
            <Text style={styles.pickerConfirmText}>Add Time</Text>
          </TouchableOpacity>
        </View>
      </Modal>

      {/* ── Shared Remove Modal ── */}
      <Modal visible={removeModalVisible} transparent animationType="fade" onRequestClose={() => setRemoveModalVisible(false)}>
        <Pressable style={styles.modalOverlay} onPress={() => setRemoveModalVisible(false)} />
        <View style={styles.modalSheet}>
          <Text style={styles.modalTitle}>Remove Item</Text>
          <Text style={styles.modalSubtitle}>
            {product.name} is shared with multiple pets.
          </Text>
          <TouchableOpacity
            style={styles.modalOption}
            onPress={handleRemoveSharedAll}
            activeOpacity={0.7}
          >
            <Text style={[styles.modalOptionText, { color: SEVERITY_COLORS.danger }]}>
              Remove for all pets
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.modalOption}
            onPress={handleRemoveSharedPetOnly}
            activeOpacity={0.7}
          >
            <Text style={styles.modalOptionText}>
              Remove for {activePet?.name ?? 'this pet'} only
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.modalOption}
            onPress={() => setRemoveModalVisible(false)}
            activeOpacity={0.7}
          >
            <Text style={[styles.modalOptionText, { color: Colors.textTertiary }]}>Cancel</Text>
          </TouchableOpacity>
        </View>
      </Modal>

      {/* ── Share Sheet ── */}
      <SharePantrySheet
        item={item}
        activePetId={activePetId!}
        visible={shareSheetVisible}
        onClose={() => setShareSheetVisible(false)}
        onChanged={handleShareChanged}
      />
    </SafeAreaView>
  );
}

// ─── Styles ─────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  flex: { flex: 1 },

  // Header
  headerBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    gap: 12,
  },
  headerInfo: {
    flex: 1,
    gap: 2,
  },
  headerBrand: {
    fontSize: FontSizes.xs,
    color: Colors.textSecondary,
  },
  headerName: {
    fontSize: FontSizes.lg,
    fontWeight: '600',
    color: Colors.textPrimary,
  },
  headerImage: {
    width: 44,
    height: 44,
    borderRadius: 8,
    backgroundColor: Colors.cardSurface,
  },
  headerImagePlaceholder: {
    justifyContent: 'center',
    alignItems: 'center',
  },

  // Not found
  notFound: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  notFoundText: {
    fontSize: FontSizes.md,
    color: Colors.textSecondary,
  },

  // Cards
  card: {
    backgroundColor: Colors.cardSurface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.hairlineBorder,
    padding: Spacing.md,
    marginHorizontal: Spacing.lg,
    marginBottom: Spacing.sm,
    gap: 4,
  },
  cardTitle: {
    fontSize: FontSizes.sm,
    fontWeight: '700',
    color: Colors.textPrimary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: Spacing.xs,
  },
  label: {
    fontSize: FontSizes.sm,
    color: Colors.textSecondary,
    marginTop: Spacing.sm,
  },

  // Behavioral Info
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.hairlineBorder,
  },
  infoLabel: {
    fontSize: FontSizes.md,
    color: Colors.textSecondary,
  },
  infoValue: {
    fontSize: FontSizes.md,
    color: Colors.textPrimary,
    fontWeight: '500',
  },
  infoSubtext: {
    fontSize: FontSizes.sm,
    color: Colors.textTertiary,
    marginTop: Spacing.sm,
    fontStyle: 'italic',
  },
  // Dimmed role pill — read-only indicator, not a tappable chip.
  // Editing lives in Custom Splits; linked via editSplitsLink below.
  rolePill: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: Colors.chipSurface,
  },
  rolePillText: {
    fontSize: FontSizes.sm,
    color: Colors.textTertiary,
    fontWeight: '600',
  },
  editSplitsLink: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 4,
    paddingVertical: Spacing.sm,
    marginTop: Spacing.xs,
  },
  editSplitsText: {
    fontSize: FontSizes.sm,
    color: Colors.accent,
    fontWeight: '600',
  },

  // Inputs
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 4,
  },
  numberInput: {
    backgroundColor: Colors.background,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: FontSizes.md,
    color: Colors.textPrimary,
    minWidth: 80,
    borderWidth: 1,
    borderColor: Colors.hairlineBorder,
  },
  unitSuffix: {
    fontSize: FontSizes.md,
    color: Colors.textSecondary,
  },

  // Auto serving display (D-165 parity)
  autoServingDisplay: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 6,
    paddingVertical: 8,
  },
  autoServingValue: {
    fontSize: FontSizes.xxl,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  autoServingUnit: {
    fontSize: FontSizes.md,
    color: Colors.textSecondary,
  },
  autoServingMath: {
    fontSize: FontSizes.xs,
    color: Colors.textTertiary,
    marginTop: 2,
  },

  // Chips
  chipRow: {
    flexDirection: 'row',
    gap: 6,
    marginTop: 4,
  },
  chip: {
    backgroundColor: Colors.background,
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: Colors.hairlineBorder,
  },
  chipSelected: {
    borderColor: Colors.accent,
    backgroundColor: Colors.cardSurface,
  },
  chipText: {
    fontSize: FontSizes.sm,
    color: Colors.textSecondary,
  },
  chipTextSelected: {
    color: Colors.accent,
  },

  // Stepper
  stepperRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginTop: 4,
  },
  stepperBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Colors.background,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: Colors.hairlineBorder,
  },
  stepperValue: {
    fontSize: FontSizes.xl,
    fontWeight: '700',
    color: Colors.textPrimary,
    minWidth: 24,
    textAlign: 'center',
  },

  // Toggle row
  toggleRow: {
    flexDirection: 'row',
    backgroundColor: Colors.background,
    borderRadius: 10,
    padding: 3,
    marginTop: 4,
  },
  toggleBtn: {
    flex: 1,
    paddingVertical: 8,
    alignItems: 'center',
    borderRadius: 8,
  },
  toggleBtnActive: {
    backgroundColor: Colors.cardSurface,
  },
  toggleText: {
    fontSize: FontSizes.md,
    fontWeight: '600',
    color: Colors.textTertiary,
  },
  toggleTextActive: {
    color: Colors.textPrimary,
  },

  // Switch
  switchRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: Spacing.sm,
  },
  switchLabel: {
    fontSize: FontSizes.md,
    color: Colors.textPrimary,
  },

  // Feeding times
  timesContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 6,
  },
  timeTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: Colors.background,
    borderRadius: 16,
    paddingLeft: 12,
    paddingRight: 6,
    paddingVertical: 6,
  },
  timeTagText: {
    fontSize: FontSizes.sm,
    color: Colors.textPrimary,
  },
  addTimeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: Colors.chipSurface,
  },
  addTimeText: {
    fontSize: FontSizes.sm,
    color: Colors.accent,
    fontWeight: '600',
  },

  // Depletion row
  depletionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginHorizontal: Spacing.lg,
    marginTop: Spacing.xs,
    marginBottom: Spacing.sm,
  },
  depletionText: {
    fontSize: FontSizes.sm,
    color: Colors.textSecondary,
  },

  // Recall link
  recallLink: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginHorizontal: Spacing.lg,
    marginVertical: Spacing.sm,
    backgroundColor: `${SEVERITY_COLORS.danger}1F`,
    borderRadius: 12,
    padding: Spacing.md,
  },
  recallLinkText: {
    flex: 1,
    fontSize: FontSizes.md,
    color: SEVERITY_COLORS.danger,
    fontWeight: '600',
  },

  // Actions — adaptive hierarchy (2026-04-12 polish spec)
  actions: {
    marginHorizontal: Spacing.lg,
    marginTop: Spacing.md,
    gap: Spacing.sm,
  },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    borderRadius: 12,
  },
  actionBtnPrimary: {
    backgroundColor: Colors.accent,
  },
  actionBtnSecondary: {
    backgroundColor: Colors.chipSurface,
  },
  actionBtnLink: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: Spacing.md,
  },
  actionBtnText: {
    fontSize: FontSizes.md,
    fontWeight: '600',
  },
  actionBtnTextPrimary: {
    color: '#FFFFFF',
  },
  actionBtnTextSecondary: {
    color: Colors.accent,
  },
  actionBtnTextLink: {
    fontSize: FontSizes.md,
    fontWeight: '600',
    color: SEVERITY_COLORS.danger,
    textAlign: 'center',
  },

  // Modals
  modalOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  modalSheet: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: Colors.cardSurface,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.lg,
    paddingBottom: Spacing.xxl,
  },
  modalTitle: {
    fontSize: FontSizes.lg,
    fontWeight: '700',
    color: Colors.textPrimary,
    marginBottom: Spacing.md,
  },
  modalSubtitle: {
    fontSize: FontSizes.md,
    color: Colors.textSecondary,
    marginBottom: Spacing.md,
    lineHeight: 22,
  },
  modalOption: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 14,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: Colors.hairlineBorder,
  },
  modalOptionText: {
    fontSize: FontSizes.md,
    color: Colors.textPrimary,
  },

  // Time picker confirm
  pickerConfirmBtn: {
    backgroundColor: Colors.accent,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: Spacing.sm,
  },
  pickerConfirmText: {
    fontSize: FontSizes.md,
    fontWeight: '600',
    color: '#FFFFFF',
  },

  bottomSpacer: { height: 88 },

  // Rebalance note
  rebalanceNoteRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: Spacing.md,
    backgroundColor: 'rgba(255, 179, 71, 0.15)',
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 16,
  },
  rebalanceNoteText: {
    fontSize: FontSizes.xs,
    fontWeight: '500',
    color: Colors.severityAmber,
  },
});
