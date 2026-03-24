// TreatQuickPickerSheet — D-124 (Revised): Quick picker for one-tap treat logging.
// Opens from PetHubScreen "Log a Treat" button. Lists active pantry treats for
// the active pet. Tap to log, scanner fallback at bottom.

import React, { useMemo, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  ScrollView,
  Pressable,
  Image,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { usePantryStore } from '../../stores/usePantryStore';
import { Colors, FontSizes, Spacing } from '../../utils/constants';

// ─── Props ──────────────────────────────────────────────

interface TreatQuickPickerSheetProps {
  visible: boolean;
  petId: string;
  petName: string;
  onClose: () => void;
  onScanNew: () => void;
}

// ─── Helpers (exported for testing) ─────────────────────

/** Servings label with color hint based on remaining count. */
export function servingsLabel(qty: number): { text: string; color: string } {
  if (qty <= 0) return { text: 'Empty', color: Colors.textTertiary };
  if (qty <= 3) return { text: `${qty} servings left`, color: '#F59E0B' }; // amber
  return { text: `${qty} servings left`, color: Colors.textSecondary };
}

// ─── Component ──────────────────────────────────────────

export function TreatQuickPickerSheet({
  visible,
  petId,
  petName,
  onClose,
  onScanNew,
}: TreatQuickPickerSheetProps) {
  const items = usePantryStore(s => s.items);
  const loading = usePantryStore(s => s.loading);
  const logTreat = usePantryStore(s => s.logTreat);
  const loadPantry = usePantryStore(s => s.loadPantry);

  // Load pantry data when sheet opens (PetHubScreen doesn't pre-load it)
  useEffect(() => {
    if (visible && petId) loadPantry(petId);
  }, [visible, petId, loadPantry]);

  // Active treats assigned to this pet (non-active items already filtered by store)
  const treats = useMemo(() =>
    items.filter(i =>
      i.product.category === 'treat' &&
      i.assignments.some(a => a.pet_id === petId),
    ),
    [items, petId],
  );

  const handleTap = useCallback(async (itemId: string, productName: string) => {
    await logTreat(itemId, petId);
    onClose();
    // Brief alert as toast stand-in (no toast library installed)
    Alert.alert('Logged', `Logged 1 ${productName}`);
  }, [logTreat, petId, onClose]);

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.overlay} onPress={onClose}>
        <Pressable style={styles.sheet} onPress={() => {}}>
          <ScrollView showsVerticalScrollIndicator={false}>
            {/* Header */}
            <View style={styles.header}>
              <Text style={styles.title}>Log a Treat for {petName}</Text>
              <TouchableOpacity onPress={onClose} hitSlop={12}>
                <Ionicons name="close-outline" size={24} color={Colors.textSecondary} />
              </TouchableOpacity>
            </View>

            {loading ? (
              <View style={styles.emptyState}>
                <ActivityIndicator color={Colors.accent} size="small" />
              </View>
            ) : treats.length === 0 ? (
              /* Empty state */
              <View style={styles.emptyState}>
                <Ionicons name="nutrition-outline" size={40} color={Colors.textTertiary} />
                <Text style={styles.emptyText}>
                  No treats in {petName}'s pantry yet.{'\n'}Scan one to start tracking.
                </Text>
                <TouchableOpacity
                  style={styles.scanButton}
                  onPress={() => { onClose(); onScanNew(); }}
                  activeOpacity={0.7}
                >
                  <Ionicons name="scan-outline" size={18} color="#FFFFFF" />
                  <Text style={styles.scanButtonText}>Scan a Treat</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <>
                {treats.map(item => {
                  const isEmpty = item.is_empty || item.quantity_remaining <= 0;
                  const label = servingsLabel(item.quantity_remaining);

                  return (
                    <TouchableOpacity
                      key={item.id}
                      style={[styles.treatRow, isEmpty && styles.treatRowDisabled]}
                      onPress={() => handleTap(item.id, item.product.name)}
                      activeOpacity={0.7}
                      disabled={isEmpty}
                    >
                      {item.product.image_url ? (
                        <Image source={{ uri: item.product.image_url }} style={styles.productImage} />
                      ) : (
                        <View style={styles.productImagePlaceholder}>
                          <Ionicons name="nutrition-outline" size={20} color={Colors.textTertiary} />
                        </View>
                      )}
                      <View style={styles.treatInfo}>
                        <Text style={[styles.treatName, isEmpty && styles.treatNameDisabled]} numberOfLines={1}>
                          {item.product.name}
                        </Text>
                        <Text style={[styles.treatServings, { color: label.color }]}>
                          {label.text}
                        </Text>
                      </View>
                    </TouchableOpacity>
                  );
                })}

                {/* Scan fallback link */}
                <TouchableOpacity
                  style={styles.scanLink}
                  onPress={() => { onClose(); onScanNew(); }}
                  activeOpacity={0.7}
                >
                  <Ionicons name="scan-outline" size={16} color={Colors.accent} />
                  <Text style={styles.scanLinkText}>Scan a new treat</Text>
                </TouchableOpacity>
              </>
            )}

            <View style={styles.bottomSpacer} />
          </ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

// ─── Styles ─────────────────────────────────────────────

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: Colors.card,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '65%',
    paddingTop: Spacing.lg,
    paddingHorizontal: Spacing.lg,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.lg,
  },
  title: {
    fontSize: FontSizes.lg,
    fontWeight: '700',
    color: Colors.textPrimary,
    flex: 1,
  },

  // Empty state
  emptyState: {
    alignItems: 'center',
    paddingVertical: Spacing.xl,
    gap: Spacing.md,
  },
  emptyText: {
    fontSize: FontSizes.md,
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
  },
  scanButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: Colors.accent,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 12,
    marginTop: Spacing.sm,
  },
  scanButtonText: {
    fontSize: FontSizes.md,
    fontWeight: '600',
    color: '#FFFFFF',
  },

  // Treat rows
  treatRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 14,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: Colors.cardBorder,
  },
  treatRowDisabled: {
    opacity: 0.4,
  },
  productImage: {
    width: 40,
    height: 40,
    borderRadius: 8,
    backgroundColor: Colors.background,
  },
  productImagePlaceholder: {
    width: 40,
    height: 40,
    borderRadius: 8,
    backgroundColor: Colors.background,
    justifyContent: 'center',
    alignItems: 'center',
  },
  treatInfo: {
    flex: 1,
    gap: 2,
  },
  treatName: {
    fontSize: FontSizes.md,
    fontWeight: '600',
    color: Colors.textPrimary,
  },
  treatNameDisabled: {
    color: Colors.textTertiary,
  },
  treatServings: {
    fontSize: FontSizes.sm,
  },

  // Scan fallback
  scanLink: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 16,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: Colors.cardBorder,
  },
  scanLinkText: {
    fontSize: FontSizes.md,
    fontWeight: '600',
    color: Colors.accent,
  },

  bottomSpacer: { height: 34 },
});
