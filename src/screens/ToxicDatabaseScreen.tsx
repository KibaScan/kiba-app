// Kiba — M9 Community ToxicDatabaseScreen (Task 21)
// Browseable directory of human foods, plants, medications, and household
// items that are toxic or cautionary for dogs / cats. The 35-entry curated
// dataset in `src/data/toxic_foods.json` (Task 10) is the single source of
// truth — bundled client-side and fully offline-capable.
//
// Layout: species toggle (Dog | Cat) + search + category chips + SectionList
// grouped by severity (Toxic / Caution / Safe). Tap a row → ToxicEntrySheet.
//
// D-084: Ionicons only. D-095 UPVM compliance — copy stays educational, never
// "treat / cure / prevent / diagnose."

import React, { useMemo, useState } from 'react';
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

import { Colors, FontSizes, Spacing, SEVERITY_COLORS } from '../utils/constants';
import type { CommunityStackParamList } from '../types/navigation';
import type { ToxicCategory, ToxicEntry, ToxicSeverity } from '../types/toxic';
import { ToxicEntryRow } from '../components/community/ToxicEntryRow';
import { ToxicEntrySheet } from '../components/community/ToxicEntrySheet';
import toxicFoods from '../data/toxic_foods.json';

type Props = NativeStackScreenProps<CommunityStackParamList, 'ToxicDatabase'>;

type CategoryFilter = ToxicCategory | 'all';

interface ToxicSection {
  severity: ToxicSeverity;
  label: string;
  data: ToxicEntry[];
}

const SECTION_ORDER: { severity: ToxicSeverity; label: string }[] = [
  { severity: 'toxic', label: 'Toxic' },
  { severity: 'caution', label: 'Caution' },
  { severity: 'safe', label: 'Safe' },
];

const CATEGORY_FILTERS: { id: CategoryFilter; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'food', label: 'Food' },
  { id: 'plant', label: 'Plant' },
  { id: 'medication', label: 'Medication' },
  { id: 'household', label: 'Household' },
];

// ─── Pure helpers (testable in isolation) ───────────────────────────────────

export interface FilterArgs {
  species: 'dog' | 'cat';
  query: string;
  category: CategoryFilter;
}

/** Case-insensitive substring match against name AND each alt_name. */
function matchesQuery(entry: ToxicEntry, q: string): boolean {
  if (!q) return true;
  const needle = q.trim().toLowerCase();
  if (!needle) return true;
  if (entry.name.toLowerCase().includes(needle)) return true;
  return entry.alt_names.some((n) => n.toLowerCase().includes(needle));
}

/**
 * Filter the curated entries by category + search query, then group by the
 * active species' severity. Empty sections are dropped (parity with
 * BookmarksScreen empty-bucket suppression). Within each section, entries are
 * alphabetized by name.
 */
export function filterAndGroupToxics(
  entries: ToxicEntry[],
  { species, query, category }: FilterArgs,
): ToxicSection[] {
  const filtered = entries.filter((e) => {
    if (category !== 'all' && e.category !== category) return false;
    return matchesQuery(e, query);
  });

  return SECTION_ORDER
    .map(({ severity, label }) => {
      const data = filtered
        .filter((e) => e.species_severity[species] === severity)
        .sort((a, b) => a.name.localeCompare(b.name));
      return { severity, label, data };
    })
    .filter((s) => s.data.length > 0);
}

// ─── Component ──────────────────────────────────────────────────────────────

const RAW_ENTRIES = (toxicFoods as { toxics: ToxicEntry[] }).toxics;

export default function ToxicDatabaseScreen(_props: Props) {
  const insets = useSafeAreaInsets();
  const [species, setSpecies] = useState<'dog' | 'cat'>('dog');
  const [query, setQuery] = useState<string>('');
  const [category, setCategory] = useState<CategoryFilter>('all');
  const [selectedEntry, setSelectedEntry] = useState<ToxicEntry | null>(null);

  const sections = useMemo<ToxicSection[]>(
    () => filterAndGroupToxics(RAW_ENTRIES, { species, query, category }),
    [species, query, category],
  );

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <Text style={styles.title}>Toxic Database</Text>
        <Text style={styles.subtitle}>
          Foods, plants, and medications to watch for.
        </Text>
      </View>

      {/* Species toggle */}
      <View style={styles.segmented}>
        {(['dog', 'cat'] as const).map((s) => {
          const active = species === s;
          const label = s === 'dog' ? 'Dog' : 'Cat';
          return (
            <TouchableOpacity
              key={s}
              style={[styles.segTab, active && styles.segTabActive]}
              onPress={() => setSpecies(s)}
              accessibilityRole="button"
              accessibilityLabel={label}
              accessibilityState={{ selected: active }}
            >
              <Text style={[styles.segTabText, active && styles.segTabTextActive]}>
                {label}
              </Text>
            </TouchableOpacity>
          );
        })}
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
          placeholder="Search foods, plants, meds..."
          placeholderTextColor={Colors.textTertiary}
          value={query}
          onChangeText={setQuery}
          autoCapitalize="none"
          autoCorrect={false}
          returnKeyType="search"
          accessibilityLabel="Search the toxic database"
        />
        {query.length > 0 && (
          <TouchableOpacity
            onPress={() => setQuery('')}
            accessibilityRole="button"
            accessibilityLabel="Clear search"
          >
            <Ionicons
              name="close-circle"
              size={18}
              color={Colors.textTertiary}
            />
          </TouchableOpacity>
        )}
      </View>

      {/* Category chips */}
      <View style={styles.chipsRow}>
        {CATEGORY_FILTERS.map(({ id, label }) => {
          const active = category === id;
          return (
            <TouchableOpacity
              key={id}
              style={[styles.chip, active && styles.chipActive]}
              onPress={() => setCategory(id)}
              accessibilityRole="button"
              accessibilityLabel={`Filter category: ${label}`}
              accessibilityState={{ selected: active }}
            >
              <Text style={[styles.chipText, active && styles.chipTextActive]}>
                {label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* List */}
      {sections.length === 0 ? (
        <View style={styles.empty}>
          <Ionicons
            name="search"
            size={40}
            color={Colors.textTertiary}
            style={{ marginBottom: Spacing.md }}
          />
          <Text style={styles.emptyTitle}>No matches</Text>
          <Text style={styles.emptyBody}>
            Try a different search term or clear the category filter.
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
              <View
                style={[
                  styles.sectionDot,
                  {
                    backgroundColor:
                      SEVERITY_COLORS[
                        section.severity === 'toxic'
                          ? 'danger'
                          : section.severity === 'caution'
                            ? 'caution'
                            : 'good'
                      ],
                  },
                ]}
              />
              <Text style={styles.sectionLabel}>
                {section.label} · {section.data.length}
              </Text>
            </View>
          )}
          renderItem={({ item }) => (
            <ToxicEntryRow
              entry={item}
              species={species}
              onPress={() => setSelectedEntry(item)}
            />
          )}
        />
      )}

      <ToxicEntrySheet
        entry={selectedEntry}
        species={species}
        onClose={() => setSelectedEntry(null)}
      />
    </View>
  );
}

// ─── Styles ─────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
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
  segmented: {
    flexDirection: 'row',
    marginHorizontal: Spacing.lg,
    borderRadius: 10,
    backgroundColor: Colors.cardSurface,
    padding: 3,
    borderWidth: 1,
    borderColor: Colors.hairlineBorder,
  },
  segTab: {
    flex: 1,
    paddingVertical: Spacing.sm,
    borderRadius: 8,
    alignItems: 'center',
  },
  segTabActive: {
    backgroundColor: Colors.accent,
  },
  segTabText: {
    fontSize: FontSizes.sm,
    fontWeight: '600',
    color: Colors.textSecondary,
  },
  segTabTextActive: {
    color: Colors.textPrimary,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.cardSurface,
    borderRadius: 12,
    marginHorizontal: Spacing.lg,
    marginTop: Spacing.md,
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
  chipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.md,
    paddingBottom: Spacing.sm,
  },
  chip: {
    paddingHorizontal: Spacing.md,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: Colors.cardSurface,
    borderWidth: 1,
    borderColor: Colors.hairlineBorder,
  },
  chipActive: {
    backgroundColor: Colors.accent,
    borderColor: Colors.accent,
  },
  chipText: {
    fontSize: FontSizes.sm,
    fontWeight: '600',
    color: Colors.textSecondary,
  },
  chipTextActive: {
    color: Colors.textPrimary,
  },
  listContent: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.sm,
    paddingBottom: 88,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingTop: Spacing.md,
    paddingBottom: 6,
  },
  sectionDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  sectionLabel: {
    color: Colors.textSecondary,
    fontSize: FontSizes.xs,
    fontWeight: '700',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
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
  },
  emptyBody: {
    color: Colors.textSecondary,
    fontSize: FontSizes.sm,
    textAlign: 'center',
  },
});
