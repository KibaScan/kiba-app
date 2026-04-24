// Kiba — M9 Community ToxicEntrySheet
// Bottom-sheet detail for a tapped ToxicEntryRow. Hero (name + category badge),
// symptoms list, optional safe_threshold_note, tappable references, and a
// non-medical source-citation footnote (UPVM compliance — D-095).
// Uses react-native Modal with presentationStyle="pageSheet" — same convention
// as AllergenSelector / BreedSelector. Sheet hidden when entry === null.

import React from 'react';
import {
  Modal,
  ScrollView,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Linking,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Colors, FontSizes, Spacing, SEVERITY_COLORS } from '../../utils/constants';
import type { ToxicEntry, ToxicSeverity } from '../../types/toxic';

const CATEGORY_LABELS: Record<ToxicEntry['category'], string> = {
  food: 'Food',
  plant: 'Plant',
  medication: 'Medication',
  household: 'Household',
};

const SEVERITY_LABELS: Record<ToxicSeverity, string> = {
  toxic: 'Toxic',
  caution: 'Caution',
  safe: 'Generally safe',
};

function severityToColorKey(s: ToxicSeverity): keyof typeof SEVERITY_COLORS {
  if (s === 'toxic') return 'danger';
  if (s === 'caution') return 'caution';
  return 'good';
}

interface Props {
  entry: ToxicEntry | null;
  species: 'dog' | 'cat';
  onClose: () => void;
}

export function ToxicEntrySheet({ entry, species, onClose }: Props) {
  const visible = entry !== null;

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <SafeAreaView style={styles.container}>
        {entry && (
          <>
            <View style={styles.header}>
              <Text style={styles.title} numberOfLines={2}>
                {entry.name}
              </Text>
              <TouchableOpacity
                onPress={onClose}
                hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                accessibilityRole="button"
                accessibilityLabel="Close"
              >
                <Ionicons name="close" size={24} color={Colors.textPrimary} />
              </TouchableOpacity>
            </View>

            <ScrollView
              style={styles.scroll}
              contentContainerStyle={styles.content}
              showsVerticalScrollIndicator={false}
            >
              <View style={styles.badgeRow}>
                <SeverityBadge severity={entry.species_severity[species]} species={species} />
                <View style={styles.categoryBadge}>
                  <Text style={styles.categoryBadgeText}>
                    {CATEGORY_LABELS[entry.category]}
                  </Text>
                </View>
              </View>

              <Section label="Symptoms">
                {entry.symptoms.map((s, i) => (
                  <View key={i} style={styles.bulletRow}>
                    <Text style={styles.bullet}>{'•'}</Text>
                    <Text style={styles.bulletText}>{s}</Text>
                  </View>
                ))}
              </Section>

              {entry.safe_threshold_note ? (
                <Section label="What to know">
                  <Text style={styles.bodyText}>{entry.safe_threshold_note}</Text>
                </Section>
              ) : null}

              {entry.references.length > 0 && (
                <Section label="References">
                  {entry.references.map((r, i) => (
                    <TouchableOpacity
                      key={i}
                      style={styles.refRow}
                      onPress={() => Linking.openURL(r.url)}
                      accessibilityRole="link"
                      accessibilityLabel={`${r.label}, opens ${r.url}`}
                    >
                      <Text style={styles.refText}>{r.label}</Text>
                      <Ionicons
                        name="open-outline"
                        size={16}
                        color={Colors.accent}
                      />
                    </TouchableOpacity>
                  ))}
                </Section>
              )}

              <Text style={styles.footnote}>
                Educational reference only. If your pet may have ingested any
                amount, contact your veterinarian or an animal poison control
                line immediately.
              </Text>
            </ScrollView>
          </>
        )}
      </SafeAreaView>
    </Modal>
  );
}

function SeverityBadge({
  severity,
  species,
}: {
  severity: ToxicSeverity;
  species: 'dog' | 'cat';
}) {
  const color = SEVERITY_COLORS[severityToColorKey(severity)];
  const label = `${SEVERITY_LABELS[severity]} for ${species === 'dog' ? 'dogs' : 'cats'}`;
  return (
    <View style={[styles.severityBadge, { borderColor: color }]}>
      <View style={[styles.severityDot, { backgroundColor: color }]} />
      <Text style={[styles.severityText, { color }]}>{label}</Text>
    </View>
  );
}

function Section({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionLabel}>{label}</Text>
      <View style={styles.sectionBody}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.hairlineBorder,
  },
  title: {
    flex: 1,
    fontSize: FontSizes.xl,
    fontWeight: '800',
    color: Colors.textPrimary,
  },
  scroll: { flex: 1 },
  content: {
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.lg,
    paddingBottom: Spacing.xxl,
  },
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: Spacing.sm,
    marginBottom: Spacing.lg,
  },
  severityBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: 1,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 4,
    borderRadius: 8,
  },
  severityDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  severityText: {
    fontSize: FontSizes.xs,
    fontWeight: '700',
    letterSpacing: 0.3,
    textTransform: 'uppercase',
  },
  categoryBadge: {
    backgroundColor: Colors.chipSurface,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 4,
    borderRadius: 8,
  },
  categoryBadgeText: {
    fontSize: FontSizes.xs,
    fontWeight: '600',
    color: Colors.textSecondary,
  },
  section: {
    marginBottom: Spacing.lg,
  },
  sectionLabel: {
    fontSize: FontSizes.xs,
    fontWeight: '600',
    color: Colors.textSecondary,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    marginBottom: Spacing.sm,
  },
  sectionBody: {
    backgroundColor: Colors.cardSurface,
    borderRadius: 16,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.hairlineBorder,
  },
  bulletRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.sm,
    marginBottom: 4,
  },
  bullet: {
    fontSize: FontSizes.md,
    color: Colors.textSecondary,
    lineHeight: 20,
  },
  bulletText: {
    flex: 1,
    fontSize: FontSizes.md,
    color: Colors.textPrimary,
    lineHeight: 20,
  },
  bodyText: {
    fontSize: FontSizes.md,
    color: Colors.textPrimary,
    lineHeight: 20,
  },
  refRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: Spacing.sm,
  },
  refText: {
    flex: 1,
    fontSize: FontSizes.md,
    color: Colors.accent,
    fontWeight: '600',
  },
  footnote: {
    marginTop: Spacing.md,
    fontSize: FontSizes.xs,
    color: Colors.textTertiary,
    lineHeight: 16,
  },
});
