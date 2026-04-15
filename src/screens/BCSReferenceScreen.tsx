// BCSReferenceScreen — D-162: Educational body condition score guide.
// 9-point BCS scale with selectable illustration and species tabs.
// Owner-reported, NOT diagnostic. No DER impact, no scoring impact.
// Free for all users. D-095: no prescriptive language.

import React, { useState, useMemo, useCallback, useLayoutEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  SafeAreaView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { MeStackParamList } from '../types/navigation';
import type { Species } from '../types/pet';
import { useActivePetStore } from '../stores/useActivePetStore';
import { updatePet } from '../services/petService';
import { Colors, FontSizes, Spacing } from '../utils/constants';

type Props = NativeStackScreenProps<MeStackParamList, 'BCSReference'>;

// ─── BCS Data ────────────────────────────────────────────

interface BCSLevel {
  score: number;
  label: string;
  group: 'underweight' | 'ideal' | 'overweight' | 'obese';
  dogDescription: string;
  catDescription: string;
}

const BCS_LEVELS: BCSLevel[] = [
  {
    score: 1,
    label: 'Emaciated',
    group: 'underweight',
    dogDescription: 'Ribs, spine, and hip bones easily visible. No body fat. Severe muscle wasting.',
    catDescription: 'Ribs, spine, and hip bones easily visible. No body fat. Severe muscle wasting.',
  },
  {
    score: 2,
    label: 'Very thin',
    group: 'underweight',
    dogDescription: 'Ribs easily visible. Minimal fat covering. Waist and abdominal tuck prominent.',
    catDescription: 'Ribs easily visible. Minimal fat covering. Pronounced waist when viewed from above.',
  },
  {
    score: 3,
    label: 'Thin',
    group: 'underweight',
    dogDescription: 'Ribs easily felt with minimal fat. Waist easily noted from above. Abdominal tuck evident.',
    catDescription: 'Ribs easily felt with slight fat covering. Waist visible from above.',
  },
  {
    score: 4,
    label: 'Ideal (lean)',
    group: 'ideal',
    dogDescription: 'Ribs easily felt with slight fat covering. Waist observed from above. Abdominal tuck present.',
    catDescription: 'Ribs felt with slight fat covering. Waist visible from above. Slight belly fat pad.',
  },
  {
    score: 5,
    label: 'Ideal',
    group: 'ideal',
    dogDescription: 'Ribs felt without excess fat. Waist viewed from above. Abdominal tuck when viewed from the side.',
    catDescription: 'Ribs felt without excess fat. Waist visible. Minimal belly fat pad.',
  },
  {
    score: 6,
    label: 'Slightly overweight',
    group: 'overweight',
    dogDescription: 'Ribs felt with slight excess fat. Waist visible but not prominent. Slight abdominal tuck.',
    catDescription: 'Ribs felt with slight excess fat. Waist less distinct. Moderate belly fat pad.',
  },
  {
    score: 7,
    label: 'Overweight',
    group: 'overweight',
    dogDescription: 'Ribs difficult to feel under moderate fat. Waist barely visible. No abdominal tuck.',
    catDescription: 'Ribs difficult to feel. Waist not easily seen. Noticeable belly fat pad.',
  },
  {
    score: 8,
    label: 'Obese',
    group: 'obese',
    dogDescription: 'Ribs not easily felt under heavy fat. No waist. Abdomen may distend.',
    catDescription: 'Ribs very difficult to feel. No waist. Prominent belly fat pad. Fat deposits over back.',
  },
  {
    score: 9,
    label: 'Severely obese',
    group: 'obese',
    dogDescription: 'Massive fat deposits. Ribs not felt. Heavy abdominal distension. Fat deposits on limbs and face.',
    catDescription: 'Massive fat deposits. Ribs cannot be felt. Heavy belly fat. Fat deposits on limbs and face.',
  },
];

const GROUP_COLORS: Record<string, string> = {
  underweight: '#F59E0B',
  ideal: Colors.severityGreen,
  overweight: '#F59E0B',
  obese: '#EF4444',
};

// ─── Component ───────────────────────────────────────────

export default function BCSReferenceScreen({ navigation, route }: Props) {
  const { petId } = route.params;
  const pet = useActivePetStore((s) => s.pets.find((p) => p.id === petId));
  const petName = pet?.name ?? 'your pet';

  const [selectedSpecies, setSelectedSpecies] = useState<Species>(pet?.species ?? 'dog');
  const [selectedScore, setSelectedScore] = useState<number | null>(pet?.bcs_score ?? null);
  const [saving, setSaving] = useState(false);

  const savedScore = pet?.bcs_score ?? null;
  const hasUnsavedChange = selectedScore !== savedScore && selectedScore !== null;

  // Hide tab bar on this pushed screen
  useLayoutEffect(() => {
    const parent = navigation.getParent();
    parent?.setOptions({ tabBarStyle: { display: 'none' } });
    return () => {
      parent?.setOptions({
        tabBarStyle: {
          position: 'absolute' as const,
          backgroundColor: 'transparent',
          borderTopColor: 'rgba(255,255,255,0.08)',
          borderTopWidth: 1,
          height: 88,
          paddingBottom: 28,
          paddingTop: 8,
        },
      });
    };
  }, [navigation]);

  const handleSave = useCallback(async () => {
    if (selectedScore == null || !pet) return;
    setSaving(true);
    try {
      await updatePet(pet.id, {
        bcs_score: selectedScore,
        bcs_assessed_at: new Date().toISOString(),
      } as Partial<typeof pet>);
      navigation.goBack();
    } catch {
      // Silent — user can retry
    } finally {
      setSaving(false);
    }
  }, [selectedScore, pet, navigation]);

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} activeOpacity={0.7}>
          <Ionicons name="arrow-back" size={24} color={Colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Body Condition Guide</Text>
        <View style={{ width: 24 }} />
      </View>

      {/* Species tabs */}
      <View style={styles.tabRow}>
        <TouchableOpacity
          style={[styles.tab, selectedSpecies === 'dog' && styles.tabActive]}
          onPress={() => setSelectedSpecies('dog')}
          activeOpacity={0.7}
        >
          <Text style={[styles.tabText, selectedSpecies === 'dog' && styles.tabTextActive]}>Dog</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, selectedSpecies === 'cat' && styles.tabActive]}
          onPress={() => setSelectedSpecies('cat')}
          activeOpacity={0.7}
        >
          <Text style={[styles.tabText, selectedSpecies === 'cat' && styles.tabTextActive]}>Cat</Text>
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        {/* Instruction */}
        <Text style={styles.instruction}>
          Tap the body condition that best matches {petName}:
        </Text>

        {/* BCS cards */}
        {BCS_LEVELS.map((level) => {
          const isSelected = selectedScore === level.score;
          const isIdeal = level.group === 'ideal';
          const groupColor = GROUP_COLORS[level.group];
          const description = selectedSpecies === 'dog' ? level.dogDescription : level.catDescription;

          return (
            <TouchableOpacity
              key={level.score}
              style={[
                styles.bcsCard,
                isSelected && { borderColor: Colors.accent, borderWidth: 2 },
                isIdeal && !isSelected && { borderColor: Colors.severityGreen, borderWidth: 1 },
              ]}
              onPress={() => setSelectedScore(level.score)}
              activeOpacity={0.7}
            >
              <View style={styles.bcsCardHeader}>
                {/* Score circle */}
                <View style={[styles.scoreCircle, { backgroundColor: groupColor }]}>
                  <Text style={styles.scoreCircleText}>{level.score}</Text>
                </View>

                <View style={styles.bcsCardTitleRow}>
                  <Text style={styles.bcsLabel}>{level.label}</Text>
                  {isIdeal && (
                    <View style={styles.idealBadge}>
                      <Ionicons name="checkmark-circle" size={14} color={Colors.severityGreen} />
                      <Text style={styles.idealBadgeText}>IDEAL</Text>
                    </View>
                  )}
                </View>

                {isSelected && (
                  <Ionicons name="checkmark-circle" size={22} color={Colors.accent} />
                )}
              </View>

              <Text style={styles.bcsDescription}>{description}</Text>
            </TouchableOpacity>
          );
        })}

        {/* Cat primordial pouch callout */}
        {selectedSpecies === 'cat' && (
          <View style={styles.pouchCallout}>
            <Ionicons name="information-circle" size={20} color={Colors.accent} />
            <Text style={styles.pouchText}>
              Note for cat owners: The "primordial pouch" — a loose belly flap — is
              normal in many cats and is NOT a sign of obesity.
            </Text>
          </View>
        )}

        {/* 10% rule */}
        <View style={styles.ruleCard}>
          <Text style={styles.ruleText}>
            The 10% Rule: Each BCS point above ideal is approximately 10% overweight.
          </Text>
        </View>

        {/* Sources */}
        <Text style={styles.sources}>
          Sources: AAHA 2021, WSAVA Global Nutrition Guidelines
        </Text>

        {/* Spacer for bottom bar */}
        {hasUnsavedChange && <View style={{ height: 80 }} />}
      </ScrollView>

      {/* Confirmation bar */}
      {hasUnsavedChange && (
        <View style={styles.confirmBar}>
          <Text style={styles.confirmText} numberOfLines={1}>
            Set {petName}'s body condition to BCS {selectedScore} — {BCS_LEVELS[selectedScore! - 1]?.label}?
          </Text>
          <View style={styles.confirmButtons}>
            <TouchableOpacity
              style={styles.cancelButton}
              onPress={() => setSelectedScore(savedScore)}
              activeOpacity={0.7}
            >
              <Text style={styles.cancelButtonText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.saveButton}
              onPress={handleSave}
              disabled={saving}
              activeOpacity={0.7}
            >
              <Text style={styles.saveButtonText}>{saving ? 'Saving...' : 'Save'}</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}
    </SafeAreaView>
  );
}

// ─── Styles ──────────────────────────────────────────────

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
  tabRow: {
    flexDirection: 'row',
    marginHorizontal: Spacing.lg,
    backgroundColor: Colors.cardSurface,
    borderRadius: 10,
    padding: 3,
    marginBottom: Spacing.md,
  },
  tab: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 8,
    alignItems: 'center',
  },
  tabActive: {
    backgroundColor: Colors.accent,
  },
  tabText: {
    fontSize: FontSizes.sm,
    fontWeight: '500',
    color: Colors.textSecondary,
  },
  tabTextActive: {
    color: Colors.textPrimary,
    fontWeight: '600',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.xl,
    gap: Spacing.sm,
  },
  instruction: {
    fontSize: FontSizes.md,
    color: Colors.textSecondary,
    marginBottom: Spacing.xs,
  },
  bcsCard: {
    backgroundColor: Colors.cardSurface,
    borderRadius: 12,
    padding: Spacing.md,
    gap: Spacing.xs,
    borderWidth: 1,
    borderColor: Colors.hairlineBorder,
  },
  bcsCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  scoreCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  scoreCircleText: {
    fontSize: FontSizes.sm,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  bcsCardTitleRow: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  bcsLabel: {
    fontSize: FontSizes.md,
    fontWeight: '600',
    color: Colors.textPrimary,
  },
  idealBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: 'rgba(34, 197, 94, 0.15)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  idealBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: Colors.severityGreen,
  },
  bcsDescription: {
    fontSize: FontSizes.sm,
    color: Colors.textSecondary,
    lineHeight: 18,
    marginLeft: 44, // align with text after score circle
  },
  pouchCallout: {
    flexDirection: 'row',
    backgroundColor: 'rgba(96, 165, 250, 0.12)',
    borderRadius: 12,
    padding: Spacing.md,
    gap: Spacing.sm,
    alignItems: 'flex-start',
    marginTop: Spacing.xs,
  },
  pouchText: {
    flex: 1,
    fontSize: FontSizes.sm,
    color: Colors.textPrimary,
    lineHeight: 20,
  },
  ruleCard: {
    backgroundColor: Colors.cardSurface,
    borderRadius: 12,
    padding: Spacing.md,
    marginTop: Spacing.xs,
  },
  ruleText: {
    fontSize: FontSizes.sm,
    color: Colors.textSecondary,
    fontStyle: 'italic',
  },
  sources: {
    fontSize: FontSizes.xs,
    color: Colors.textTertiary,
    textAlign: 'center',
    marginTop: Spacing.sm,
  },
  confirmBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: Colors.cardSurface,
    borderTopWidth: 1,
    borderTopColor: Colors.hairlineBorder,
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.md,
    paddingBottom: 34,
    gap: Spacing.sm,
  },
  confirmText: {
    fontSize: FontSizes.sm,
    color: Colors.textPrimary,
  },
  confirmButtons: {
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  cancelButton: {
    flex: 1,
    backgroundColor: Colors.background,
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.hairlineBorder,
  },
  cancelButtonText: {
    fontSize: FontSizes.md,
    color: Colors.textSecondary,
    fontWeight: '500',
  },
  saveButton: {
    flex: 1,
    backgroundColor: Colors.accent,
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
  },
  saveButtonText: {
    fontSize: FontSizes.md,
    color: Colors.textPrimary,
    fontWeight: '600',
  },
});
