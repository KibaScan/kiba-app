// Kiba — M9 Community VendorDirectoryScreen (Task 22)
// Curated brand directory: A-Z grouped, search, inline-expand to surface email
// + website actions. parent_company is fetched but NEVER displayed (spec §7.1
// — analytics-only). Vendors are species-agnostic; no category chips at MVP
// (too few vendors to filter meaningfully).
//
// Backed by `fetchPublishedVendors` from vendorService (returns [] on offline
// or error). `route.params.initialBrand` populates the search bar on mount —
// used by ResultScreen overflow deep-link (Task 23 wires).
//
// D-084: Ionicons only. D-095 UPVM compliance — no medical claims in copy.

import React, { useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  SectionList,
  StyleSheet,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import { Colors, FontSizes, Spacing } from '../utils/constants';
import type { CommunityStackParamList } from '../types/navigation';
import { fetchPublishedVendors, Vendor } from '../services/vendorService';
import { VendorRow } from '../components/community/VendorRow';

type Props = NativeStackScreenProps<CommunityStackParamList, 'VendorDirectory'>;

interface VendorSection {
  key: string; // 'A'-'Z' or '#'
  data: Vendor[];
}

// ─── Pure helpers (testable in isolation) ───────────────────────────────────

/** Uppercase first letter of brand_name; non-letter starts → '#'. */
function sectionKeyFor(brandName: string): string {
  const first = brandName.trim().charAt(0).toUpperCase();
  return /^[A-Z]$/.test(first) ? first : '#';
}

/**
 * Filter by case-insensitive substring against brand_name, then group A-Z
 * (alphabetical) with '#' last. Empty sections suppressed (parity with
 * filterAndGroupToxics in ToxicDatabaseScreen).
 */
export function filterAndGroupVendors(
  vendors: Vendor[],
  query: string,
): VendorSection[] {
  const needle = query.trim().toLowerCase();
  const filtered = needle
    ? vendors.filter((v) => v.brand_name.toLowerCase().includes(needle))
    : vendors;

  const buckets = new Map<string, Vendor[]>();
  for (const v of filtered) {
    const key = sectionKeyFor(v.brand_name);
    const arr = buckets.get(key);
    if (arr) arr.push(v);
    else buckets.set(key, [v]);
  }

  const keys = Array.from(buckets.keys()).sort((a, b) => {
    if (a === '#') return 1;
    if (b === '#') return -1;
    return a.localeCompare(b);
  });

  return keys.map((key) => ({
    key,
    data: (buckets.get(key) ?? []).sort((a, b) =>
      a.brand_name.localeCompare(b.brand_name),
    ),
  }));
}

// ─── Component ──────────────────────────────────────────────────────────────

export default function VendorDirectoryScreen({ route, navigation }: Props) {
  const insets = useSafeAreaInsets();
  const initialBrand = route?.params?.initialBrand ?? '';

  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [query, setQuery] = useState<string>(initialBrand);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const data = await fetchPublishedVendors();
      if (cancelled) return;
      setVendors(data);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const sections = useMemo<VendorSection[]>(
    () => filterAndGroupVendors(vendors, query),
    [vendors, query],
  );

  const handleRowPress = (vendorId: string) => {
    setSelectedId((prev) => (prev === vendorId ? null : vendorId));
  };

  const showEmpty = !loading && vendors.length === 0;
  const showNoMatches = !loading && vendors.length > 0 && sections.length === 0;

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.navBar}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          hitSlop={12}
          accessibilityRole="button"
          accessibilityLabel="Back"
        >
          <Ionicons name="arrow-back" size={24} color={Colors.textPrimary} />
        </TouchableOpacity>
      </View>
      <View style={styles.header}>
        <Text style={styles.title}>Vendor Directory</Text>
        <Text style={styles.subtitle}>
          Contact pet-food brands directly — no middleman.
        </Text>
      </View>

      {/* Search */}
      <View style={styles.searchContainer}>
        <Ionicons
          name="search"
          size={18}
          color={Colors.textTertiary}
          style={styles.searchIcon}
        />
        <TextInput
          style={styles.searchInput}
          placeholder="Search brands..."
          placeholderTextColor={Colors.textTertiary}
          value={query}
          onChangeText={setQuery}
          autoCapitalize="none"
          autoCorrect={false}
          returnKeyType="search"
          accessibilityLabel="Search vendor directory"
        />
        {query.length > 0 && (
          <TouchableOpacity
            onPress={() => setQuery('')}
            accessibilityRole="button"
            accessibilityLabel="Clear search"
          >
            <Ionicons name="close-circle" size={18} color={Colors.textTertiary} />
          </TouchableOpacity>
        )}
      </View>

      {/* Body */}
      {showEmpty ? (
        <View style={styles.empty}>
          <Ionicons
            name="storefront-outline"
            size={40}
            color={Colors.textTertiary}
            style={{ marginBottom: Spacing.md }}
          />
          <Text style={styles.emptyTitle}>Vendor directory coming soon</Text>
          <Text style={styles.emptyBody}>
            Steven is curating brand contacts.
          </Text>
        </View>
      ) : showNoMatches ? (
        <View style={styles.empty}>
          <Ionicons
            name="search"
            size={40}
            color={Colors.textTertiary}
            style={{ marginBottom: Spacing.md }}
          />
          <Text style={styles.emptyTitle}>No matches</Text>
          <Text style={styles.emptyBody}>
            Try a different search term.
          </Text>
        </View>
      ) : (
        <SectionList
          sections={sections}
          keyExtractor={(item) => item.id}
          stickySectionHeadersEnabled={false}
          contentContainerStyle={styles.listContent}
          keyboardShouldPersistTaps="handled"
          renderSectionHeader={({ section }) => (
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionLabel}>{section.key}</Text>
            </View>
          )}
          renderItem={({ item }) => (
            <VendorRow
              vendor={item}
              expanded={selectedId === item.id}
              onPress={() => handleRowPress(item.id)}
            />
          )}
        />
      )}
    </View>
  );
}

// ─── Styles ─────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  navBar: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.sm,
    paddingBottom: Spacing.xs,
  },
  header: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.sm,
    paddingBottom: Spacing.md,
  },
  title: {
    fontSize: FontSizes.xxl,
    fontWeight: '800',
    color: Colors.textPrimary,
    lineHeight: 30,
  },
  subtitle: {
    marginTop: 4,
    fontSize: FontSizes.sm,
    color: Colors.textSecondary,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.cardSurface,
    borderRadius: 12,
    marginHorizontal: Spacing.lg,
    marginTop: Spacing.sm,
    marginBottom: Spacing.md,
    paddingHorizontal: Spacing.md,
    height: 44,
    borderWidth: 1,
    borderColor: Colors.hairlineBorder,
  },
  searchIcon: {
    marginRight: Spacing.sm,
  },
  searchInput: {
    flex: 1,
    fontSize: FontSizes.md,
    color: Colors.textPrimary,
    height: 44,
  },
  listContent: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.sm,
    paddingBottom: 88,
  },
  sectionHeader: {
    paddingTop: Spacing.md,
    paddingBottom: 6,
  },
  sectionLabel: {
    color: Colors.textSecondary,
    fontSize: FontSizes.sm,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  empty: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.xl,
  },
  emptyTitle: {
    color: Colors.textPrimary,
    fontSize: FontSizes.lg,
    fontWeight: '700',
    marginBottom: Spacing.sm,
    textAlign: 'center',
  },
  emptyBody: {
    color: Colors.textSecondary,
    fontSize: FontSizes.sm,
    textAlign: 'center',
  },
});
