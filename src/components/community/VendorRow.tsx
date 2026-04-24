// Kiba — M9 Community VendorRow (Task 22)
// One row in the VendorDirectoryScreen SectionList. Shows brand_name in the
// collapsed state; when `expanded` is true, reveals an inline action panel with
// email + website buttons and the HQ country (when present). parent_company is
// intentionally NEVER rendered (spec §7.1 — analytics-only signal).
// D-084: Ionicons only. Matte Premium tokens (cardSurface, hairlineBorder).

import React from 'react';
import {
  TouchableOpacity,
  View,
  Text,
  StyleSheet,
  Linking,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { Colors, FontSizes, Spacing } from '../../utils/constants';
import type { Vendor } from '../../services/vendorService';

interface Props {
  vendor: Vendor;
  expanded: boolean;
  onPress: () => void;
}

export function VendorRow({ vendor, expanded, onPress }: Props) {
  const a11yState = { expanded };

  return (
    <View style={styles.container}>
      <TouchableOpacity
        style={styles.row}
        onPress={onPress}
        activeOpacity={0.7}
        accessibilityRole="button"
        accessibilityLabel={vendor.brand_name}
        accessibilityState={a11yState}
      >
        <Text style={styles.name} numberOfLines={1}>
          {vendor.brand_name}
        </Text>
        <Ionicons
          name={expanded ? 'chevron-up' : 'chevron-down'}
          size={18}
          color={Colors.textTertiary}
        />
      </TouchableOpacity>

      {expanded && (
        <View style={styles.actions}>
          {vendor.contact_email ? (
            <TouchableOpacity
              style={styles.actionButton}
              onPress={() => Linking.openURL(`mailto:${vendor.contact_email}`)}
              accessibilityRole="link"
              accessibilityLabel={`Email ${vendor.brand_name}`}
            >
              <Ionicons name="mail-outline" size={16} color={Colors.accent} />
              <Text style={styles.actionText}>Email</Text>
            </TouchableOpacity>
          ) : null}

          {vendor.website_url ? (
            <TouchableOpacity
              style={styles.actionButton}
              onPress={() => Linking.openURL(vendor.website_url as string)}
              accessibilityRole="link"
              accessibilityLabel={`Visit ${vendor.brand_name} website`}
            >
              <Ionicons name="open-outline" size={16} color={Colors.accent} />
              <Text style={styles.actionText}>Website</Text>
            </TouchableOpacity>
          ) : null}

          {vendor.headquarters_country ? (
            <Text style={styles.metaText}>HQ: {vendor.headquarters_country}</Text>
          ) : null}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: Colors.cardSurface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.hairlineBorder,
    marginBottom: Spacing.sm,
    overflow: 'hidden',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: Spacing.md,
  },
  name: {
    flex: 1,
    fontSize: FontSizes.md,
    fontWeight: '600',
    color: Colors.textPrimary,
  },
  actions: {
    paddingLeft: Spacing.md + Spacing.sm, // hierarchy indent under brand_name
    paddingRight: Spacing.md,
    paddingBottom: Spacing.md,
    gap: Spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: Colors.hairlineBorder,
    paddingTop: Spacing.md,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingVertical: 6,
  },
  actionText: {
    fontSize: FontSizes.md,
    fontWeight: '600',
    color: Colors.accent,
  },
  metaText: {
    fontSize: FontSizes.sm,
    color: Colors.textSecondary,
    marginTop: Spacing.xs,
  },
});
