// PantryCard — List item for pantry screen.
// Displays product info, score, depletion, alerts, and contextual metadata.

import React from 'react';
import {
  Image,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';

import type { PantryCardData } from '../../types/pantry';
import type { Pet } from '../../types/pet';
import {
  Colors,
  FontSizes,
  Spacing,
  SEVERITY_COLORS,
  getScoreColor,
} from '../../utils/constants';
import { stripBrandFromName } from '../../utils/formatters';

// ─── Props ──────────────────────────────────────────────

interface PantryCardProps {
  item: PantryCardData;
  activePet: Pet;
  onTap: (itemId: string) => void;
  onRestock: (itemId: string) => void;
  onRemove: (itemId: string) => void;
}

// ─── Helpers ────────────────────────────────────────────

function formatForm(form: string | null): string | null {
  if (!form) return null;
  switch (form) {
    case 'dry': return 'Dry';
    case 'wet': return 'Wet';
    case 'freeze_dried': return 'Freeze-Dried';
    case 'dehydrated': return 'Dehydrated';
    case 'raw': return 'Raw';
    default: return form.charAt(0).toUpperCase() + form.slice(1);
  }
}

function formatCategory(category: string): string {
  switch (category) {
    case 'daily_food': return 'Food';
    case 'treat': return 'Treat';
    case 'supplement': return 'Supplement';
    default: return category;
  }
}

function getRemainingText(
  item: PantryCardData,
  isTreat: boolean,
): { text: string; color: string } {
  if (item.is_empty) {
    return { text: 'Empty', color: SEVERITY_COLORS.caution };
  }

  if (isTreat || item.serving_mode === 'unit') {
    const label = item.unit_label ?? 'units';
    return {
      text: `${item.quantity_remaining} ${label} left`,
      color: item.is_low_stock ? SEVERITY_COLORS.caution : Colors.textPrimary,
    };
  }

  if (item.days_remaining != null) {
    return {
      text: `~${Math.ceil(item.days_remaining)} days`,
      color: item.is_low_stock ? SEVERITY_COLORS.caution : Colors.textPrimary,
    };
  }

  return {
    text: `${item.quantity_remaining} ${item.quantity_unit} left`,
    color: item.is_low_stock ? SEVERITY_COLORS.caution : Colors.textPrimary,
  };
}

function getDepletionBarColor(pct: number): string {
  if (pct > 0.20) return SEVERITY_COLORS.good;
  if (pct > 0.05) return SEVERITY_COLORS.caution;
  return SEVERITY_COLORS.danger;
}

// ─── Component ──────────────────────────────────────────

export function PantryCard({ item, activePet, onTap, onRestock, onRemove }: PantryCardProps) {
  const { product } = item;
  const isRecalled = product.is_recalled;
  const isVetDiet = product.is_vet_diet;
  const isTreat = product.category === 'treat'
    || item.assignments.every(a => a.feeding_frequency === 'as_needed');

  const myAssignment = item.assignments.find(a => a.pet_id === activePet.id)
    ?? item.assignments[0];

  const displayName = stripBrandFromName(product.brand, product.name);
  const remaining = getRemainingText(item, isTreat);

  // Depletion bar
  const showDepletionBar = !isTreat && !item.is_empty;
  const depletionPct = item.quantity_original > 0
    ? item.quantity_remaining / item.quantity_original
    : 0;

  // Feeding summary
  let feedingSummary: string;
  if (!myAssignment || myAssignment.feeding_frequency === 'as_needed') {
    feedingSummary = 'As needed';
  } else {
    const unit = myAssignment.serving_size_unit === 'units'
      ? (item.unit_label ?? 'units')
      : myAssignment.serving_size_unit;
    feedingSummary = `${myAssignment.feedings_per_day}x daily \u00B7 ${myAssignment.serving_size} ${unit}`;
  }

  // Form + category badge text
  const formLabel = formatForm(product.product_form);
  const categoryLabel = formatCategory(product.category);
  const badgeText = formLabel ? `${formLabel} ${categoryLabel}` : categoryLabel;

  // Shared indicator
  const isShared = item.assignments.length > 1;

  return (
    <TouchableOpacity
      style={[styles.card, isRecalled && styles.cardRecalled]}
      onPress={() => onTap(item.id)}
      activeOpacity={0.7}
    >
      {/* Main content — reduced opacity when empty */}
      <View style={item.is_empty ? styles.emptyContent : undefined}>
        {/* Main row: image | info | score */}
        <View style={styles.mainRow}>
          {/* LEFT: Product image */}
          <View style={styles.imageContainer}>
            {product.image_url ? (
              <>
                <Image
                  source={{ uri: product.image_url }}
                  style={styles.productImage}
                  resizeMode="contain"
                />
                <LinearGradient
                  colors={[Colors.card, 'transparent', 'transparent', Colors.card]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={styles.imageSideFade}
                />
              </>
            ) : (
              <View style={styles.imagePlaceholder}>
                <Ionicons name="cube-outline" size={24} color={Colors.textTertiary} />
              </View>
            )}
          </View>

          {/* CENTER: Info column */}
          <View style={styles.infoColumn}>
            <Text style={styles.brand} numberOfLines={1}>{product.brand}</Text>
            <Text style={styles.productName} numberOfLines={2}>{displayName}</Text>

            <View style={styles.metadataRow}>
              <View style={styles.badge}>
                <Text style={styles.badgeText}>{badgeText}</Text>
              </View>
              {product.is_supplemental && (
                <View style={styles.supplementalBadge}>
                  <Text style={styles.supplementalBadgeText}>Supplemental</Text>
                </View>
              )}
            </View>

            <Text style={styles.feedingSummary} numberOfLines={1}>{feedingSummary}</Text>
          </View>

          {/* RIGHT: Score + remaining */}
          <View style={styles.rightColumn}>
            <ScoreBadge
              score={product.base_score}
              isRecalled={isRecalled}
              isVetDiet={isVetDiet}
              isSupplemental={product.is_supplemental}
            />
            <Text style={[styles.remainingText, { color: remaining.color }]}>
              {remaining.text}
            </Text>
          </View>
        </View>

        {/* Depletion bar */}
        {showDepletionBar && (
          <View style={styles.depletionTrack}>
            <View
              style={[
                styles.depletionFill,
                {
                  width: `${Math.min(depletionPct * 100, 100)}%`,
                  backgroundColor: getDepletionBarColor(depletionPct),
                },
              ]}
            />
          </View>
        )}

        {/* Alert bars */}
        {isRecalled && (
          <View style={styles.alertRecalled}>
            <Ionicons name="warning-outline" size={14} color={Colors.severityRed} />
            <Text style={styles.alertRecalledText}>Recalled — tap for details</Text>
          </View>
        )}
        {item.is_low_stock && !item.is_empty && !isTreat && (
          <View style={styles.alertLowStock}>
            <Text style={styles.alertLowStockText}>
              Running low{item.days_remaining != null ? ` — ~${Math.ceil(item.days_remaining)} days remaining` : ''}
            </Text>
          </View>
        )}

        {/* Shared indicator */}
        {isShared && (
          <Text style={styles.sharedText}>
            Shared with {item.assignments.length - 1} {item.assignments.length === 2 ? 'pet' : 'pets'}
          </Text>
        )}

        {/* Calorie context */}
        {!isTreat && item.calorie_context && (
          <Text style={styles.calorieText}>
            ~{item.calorie_context.daily_kcal} kcal/day of {item.calorie_context.target_kcal} kcal target
          </Text>
        )}
      </View>

      {/* Empty actions row — full opacity */}
      {item.is_empty && (
        <View style={styles.emptyActions}>
          <TouchableOpacity
            style={styles.actionButton}
            onPress={() => onRestock(item.id)}
          >
            <Ionicons name="refresh-outline" size={16} color={SEVERITY_COLORS.caution} />
            <Text style={styles.actionTextRestock}>Restock</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.actionButton}
            onPress={() => onRemove(item.id)}
          >
            <Ionicons name="trash-outline" size={16} color={SEVERITY_COLORS.danger} />
            <Text style={styles.actionTextRemove}>Remove</Text>
          </TouchableOpacity>
        </View>
      )}
    </TouchableOpacity>
  );
}

// ─── Score Badge Sub-component ──────────────────────────

function ScoreBadge({
  score,
  isRecalled,
  isVetDiet,
  isSupplemental,
}: {
  score: number | null;
  isRecalled: boolean;
  isVetDiet: boolean;
  isSupplemental: boolean;
}) {
  if (isRecalled) {
    return (
      <View style={[styles.bypassBadge, { backgroundColor: `${SEVERITY_COLORS.danger}1F` }]}>
        <Text style={[styles.bypassBadgeText, { color: SEVERITY_COLORS.danger }]}>Recalled</Text>
      </View>
    );
  }

  if (isVetDiet) {
    return (
      <View style={[styles.bypassBadge, { backgroundColor: '#6366F11F' }]}>
        <Text style={[styles.bypassBadgeText, { color: '#6366F1' }]}>Vet Diet</Text>
      </View>
    );
  }

  if (score == null) {
    return (
      <View style={[styles.bypassBadge, { backgroundColor: `${SEVERITY_COLORS.neutral}1F` }]}>
        <Text style={[styles.bypassBadgeText, { color: SEVERITY_COLORS.neutral }]}>No score</Text>
      </View>
    );
  }

  const color = getScoreColor(score, isSupplemental);
  return (
    <Text style={[styles.scoreText, { color }]}>
      {score}% match
    </Text>
  );
}

// ─── Styles ─────────────────────────────────────────────

const styles = StyleSheet.create({
  card: {
    backgroundColor: Colors.card,
    borderRadius: 12,
    padding: Spacing.md,
    gap: Spacing.sm,
  },
  cardRecalled: {
    borderLeftWidth: 3,
    borderLeftColor: Colors.severityRed,
  },
  emptyContent: {
    opacity: 0.4,
  },

  // Main row
  mainRow: {
    flexDirection: 'row',
    gap: 12,
  },

  // Image
  imageContainer: {
    width: 56,
    height: 56,
    borderRadius: 8,
    overflow: 'hidden',
    backgroundColor: Colors.background,
  },
  productImage: {
    width: '100%',
    height: '100%',
  },
  imageSideFade: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  imagePlaceholder: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Info column
  infoColumn: {
    flex: 1,
    gap: 2,
  },
  brand: {
    fontSize: FontSizes.xs,
    color: Colors.textSecondary,
  },
  productName: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.textPrimary,
    lineHeight: 18,
  },
  metadataRow: {
    flexDirection: 'row',
    gap: 6,
    marginTop: 2,
  },
  badge: {
    backgroundColor: `${Colors.textTertiary}1F`,
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  badgeText: {
    fontSize: FontSizes.xs,
    color: Colors.textSecondary,
    fontWeight: '500',
  },
  supplementalBadge: {
    backgroundColor: '#14B8A61F',
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  supplementalBadgeText: {
    fontSize: FontSizes.xs,
    color: '#14B8A6',
    fontWeight: '500',
  },
  feedingSummary: {
    fontSize: 12,
    color: Colors.textSecondary,
    marginTop: 2,
  },

  // Right column
  rightColumn: {
    alignItems: 'flex-end',
    justifyContent: 'center',
    gap: 4,
  },
  scoreText: {
    fontSize: FontSizes.sm,
    fontWeight: '700',
  },
  bypassBadge: {
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  bypassBadgeText: {
    fontSize: FontSizes.xs,
    fontWeight: '600',
  },
  remainingText: {
    fontSize: FontSizes.sm,
  },

  // Depletion bar
  depletionTrack: {
    height: 3,
    borderRadius: 1.5,
    backgroundColor: Colors.background,
    overflow: 'hidden',
  },
  depletionFill: {
    height: '100%',
    borderRadius: 1.5,
  },

  // Alert bars
  alertRecalled: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: `${SEVERITY_COLORS.danger}1F`,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  alertRecalledText: {
    fontSize: FontSizes.xs,
    color: Colors.severityRed,
    fontWeight: '500',
  },
  alertLowStock: {
    backgroundColor: `${SEVERITY_COLORS.caution}1F`,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  alertLowStockText: {
    fontSize: FontSizes.xs,
    color: Colors.severityAmber,
    fontWeight: '500',
  },

  // Shared + calorie context
  sharedText: {
    fontSize: FontSizes.xs,
    color: Colors.textTertiary,
  },
  calorieText: {
    fontSize: FontSizes.xs,
    color: Colors.textSecondary,
  },

  // Empty actions
  emptyActions: {
    flexDirection: 'row',
    gap: Spacing.md,
    paddingTop: Spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: Colors.cardBorder,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  actionTextRestock: {
    fontSize: FontSizes.sm,
    color: SEVERITY_COLORS.caution,
    fontWeight: '600',
  },
  actionTextRemove: {
    fontSize: FontSizes.sm,
    color: SEVERITY_COLORS.danger,
    fontWeight: '600',
  },
});
