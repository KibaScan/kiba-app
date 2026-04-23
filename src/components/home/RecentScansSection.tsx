import React from 'react';
import { View, Text, TouchableOpacity, Image, ActivityIndicator, StyleSheet } from 'react-native';
import * as Haptics from 'expo-haptics';
import { Ionicons } from '@expo/vector-icons';
import { Colors, FontSizes, Spacing, Limits, getScoreColor } from '../../utils/constants';
import { stripBrandFromName, sanitizeBrand } from '../../utils/formatters';
import { InfoTooltip } from '../ui/InfoTooltip';
import type { ScanHistoryItem } from '../../types/scanHistory';

interface RecentScansSectionProps {
  recentScans: ScanHistoryItem[];
  petName: string;
  weeklyCount: number;
  premium: boolean;
  scanWindowInfo: { count: number; remaining: number; oldestScanAt: string | null } | null;
  scanCounterColor: string;
  scanTooltipText: string;
  onScanPress: (productId: string, isRecalled: boolean) => void;
  onLongPress: (productId: string) => void;
  onSeeAll: () => void;
}

export function RecentScansSection({
  recentScans,
  petName,
  weeklyCount,
  premium,
  scanWindowInfo,
  scanCounterColor,
  scanTooltipText,
  onScanPress,
  onLongPress,
  onSeeAll,
}: RecentScansSectionProps) {
  return (
    <View style={styles.recentScansSection}>
      <View style={styles.recentScansHeader}>
        <Text style={styles.recentScansTitle}>Recent Scans</Text>
        <View style={styles.recentScansHeaderRight}>
          {!premium && scanWindowInfo ? (
            <View style={styles.scanCounterRow}>
              <View style={[styles.scanCounterPill, { backgroundColor: `${scanCounterColor}20` }]}>
                <Text style={[styles.scanCounterText, { color: scanCounterColor }]}>
                  {scanWindowInfo.count}/{Limits.freeScansPerWeek} this week
                </Text>
              </View>
              <InfoTooltip text={scanTooltipText} size={14} />
            </View>
          ) : (
            <Text style={styles.recentScansWeekly}>{weeklyCount} this week</Text>
          )}
          <TouchableOpacity
            onPress={onSeeAll}
            activeOpacity={0.7}
            accessibilityRole="button"
            accessibilityLabel="See all recent scans"
          >
            <Text style={styles.seeAllLink}>See all ›</Text>
          </TouchableOpacity>
        </View>
      </View>
      {recentScans.map((scan) => {
        const scoreColor =
          scan.final_score != null
            ? getScoreColor(scan.final_score, scan.product.is_supplemental)
            : null;

        return (
          <TouchableOpacity
            key={scan.id}
            style={styles.scanRow}
            onPress={() => onScanPress(scan.product_id, scan.product.is_recalled ?? false)}
            onLongPress={() => {
              void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
              onLongPress(scan.product_id);
            }}
            delayLongPress={400}
            activeOpacity={0.7}
            accessibilityLabel={
              scan.final_score != null
                ? `${scan.final_score}% match for ${petName}, ${scan.product.brand} ${scan.product.name}`
                : `${scan.product.brand} ${scan.product.name}${scan.product.is_recalled ? ', recalled product' : ''}`
            }
          >
            {scan.product.image_url ? (
              <Image
                source={{ uri: scan.product.image_url }}
                style={styles.scanRowImage}
              />
            ) : (
              <View style={styles.scanRowImagePlaceholder}>
                <Ionicons
                  name="cube-outline"
                  size={18}
                  color={Colors.textTertiary}
                />
              </View>
            )}
            <View style={styles.scanRowInfo}>
              <Text style={styles.scanRowBrand} numberOfLines={1}>
                {sanitizeBrand(scan.product.brand)}
              </Text>
              <Text style={styles.scanRowName} numberOfLines={2}>
                {stripBrandFromName(scan.product.brand, scan.product.name)}
              </Text>
            </View>
            {scoreColor ? (
              <View
                style={[
                  styles.scorePill,
                  { backgroundColor: `${scoreColor}1A` },
                ]}
              >
                <Text style={[styles.scorePillText, { color: scoreColor }]}>
                  {scan.final_score}%
                </Text>
              </View>
            ) : (
              <Ionicons
                name="chevron-forward"
                size={16}
                color={Colors.textTertiary}
              />
            )}
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  recentScansSection: {
    marginBottom: Spacing.md,
  },
  recentScansHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.sm,
  },
  recentScansHeaderRight: {
    alignItems: 'flex-end',
    gap: 4,
  },
  recentScansTitle: {
    fontSize: FontSizes.md,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  recentScansWeekly: {
    fontSize: FontSizes.sm,
    color: Colors.accent,
  },
  seeAllLink: {
    color: Colors.accent,
    fontSize: 15,
    fontWeight: '500',
  },
  scanCounterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  scanCounterPill: {
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  scanCounterText: {
    fontSize: FontSizes.xs,
    fontWeight: '600',
  },
  scanRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingVertical: Spacing.sm,
  },
  scanRowImage: {
    width: 40,
    height: 40,
    borderRadius: 8,
  },
  scanRowImagePlaceholder: {
    width: 40,
    height: 40,
    borderRadius: 8,
    backgroundColor: Colors.cardSurface,
    justifyContent: 'center',
    alignItems: 'center',
  },
  scanRowInfo: {
    flex: 1,
    gap: 2,
  },
  scanRowBrand: {
    fontSize: 12,
    color: Colors.textSecondary,
  },
  scanRowName: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.textPrimary,
  },
  scorePill: {
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  scorePillText: {
    fontSize: FontSizes.xs,
    fontWeight: '700',
  },
});
