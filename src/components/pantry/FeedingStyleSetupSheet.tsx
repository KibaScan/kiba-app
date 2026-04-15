import React from 'react';
import { View, Text, StyleSheet, Pressable, Platform, ScrollView, Modal, KeyboardAvoidingView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { Colors, FontSizes, Spacing } from '../../utils/constants';
import { chipToggle } from '../../utils/haptics';
import type { FeedingStyle } from '../../types/pet';
import { DailyDryIcon, DailyFoodIcon, DailyWetIcon } from '../icons/speciesIcons';

interface FeedingStyleSetupSheetProps {
  isVisible: boolean;
  petName: string;
  onSelect: (style: FeedingStyle) => void;
  onDismiss: () => void;
}

export function FeedingStyleSetupSheet({ isVisible, petName, onSelect, onDismiss }: FeedingStyleSetupSheetProps) {
  const handleSelect = (style: FeedingStyle) => {
    chipToggle();
    onSelect(style);
  };

  return (
    <Modal visible={isVisible} transparent animationType="slide" onRequestClose={onDismiss}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <Pressable style={styles.overlay} onPress={onDismiss}>
          <Pressable style={styles.sheet} onPress={() => {}}>
            <View style={styles.contentContainer}>
              <View style={styles.header}>
                <Text style={styles.title}>How do you feed {petName}?</Text>
                <Text style={styles.subtitle}>Select their daily feeding routine.</Text>
              </View>

              <ScrollView contentContainerStyle={styles.scrollContent}>
                <Pressable style={styles.optionCard} onPress={() => handleSelect('dry_only')}>
                  <View style={[styles.iconBox, { backgroundColor: Colors.chipSurface }]}>
                    <DailyDryIcon size={48} color={Colors.accent} />
                  </View>
                  <View style={styles.optionTextContainer}>
                    <Text style={styles.optionTitle}>Dry food only</Text>
                    <Text style={styles.optionSubtitle}>Standard kibble diet.</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={20} color={Colors.textSecondary} />
                </Pressable>

                <Pressable style={styles.optionCard} onPress={() => handleSelect('dry_and_wet')}>
                  <View style={[styles.iconBox, { backgroundColor: Colors.chipSurface }]}>
                    <DailyFoodIcon size={40} color={Colors.accent} />
                  </View>
                  <View style={styles.optionTextContainer}>
                    <Text style={styles.optionTitle}>Mixed feeding</Text>
                    <Text style={styles.optionSubtitle}>Kibble base with other food rotation.</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={20} color={Colors.textSecondary} />
                </Pressable>

                <Pressable style={styles.optionCard} onPress={() => handleSelect('wet_only')}>
                  <View style={[styles.iconBox, { backgroundColor: Colors.chipSurface }]}>
                    <DailyWetIcon size={40} color={Colors.accent} />
                  </View>
                  <View style={styles.optionTextContainer}>
                    <Text style={styles.optionTitle}>Wet food only</Text>
                    <Text style={styles.optionSubtitle}>Exclusively canned or pouch diet.</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={20} color={Colors.textSecondary} />
                </Pressable>

                <Pressable style={styles.optionCard} onPress={() => handleSelect('custom')}>
                  <View style={[styles.iconBox, { backgroundColor: Colors.chipSurface }]}>
                    <Ionicons name="options" size={24} color={Colors.accent} />
                  </View>
                  <View style={styles.optionTextContainer}>
                    <Text style={styles.optionTitle}>Custom split</Text>
                    <Text style={styles.optionSubtitle}>Set calorie amounts per food.</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={20} color={Colors.textSecondary} />
                </Pressable>
              </ScrollView>
            </View>
            <View style={styles.bottomSpacer} />
          </Pressable>
        </Pressable>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: Colors.background,
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    maxHeight: '80%',
    paddingTop: Spacing.xl,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.hairlineBorder,
  },
  bottomSpacer: {
    height: 40,
  },
  contentContainer: {
    paddingHorizontal: Spacing.lg,
  },
  header: {
    alignItems: 'center',
    marginBottom: Spacing.xl,
  },
  title: {
    fontSize: FontSizes.xl,
    fontWeight: '700',
    color: Colors.textPrimary,
    marginBottom: Spacing.xs,
  },
  subtitle: {
    fontSize: FontSizes.md,
    color: Colors.textSecondary,
    textAlign: 'center',
  },
  scrollContent: {
    paddingBottom: Spacing.xxl,
    gap: Spacing.md,
  },
  optionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.md,
    backgroundColor: Colors.cardSurface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.hairlineBorder,
  },
  iconBox: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: Spacing.md,
  },
  optionTextContainer: {
    flex: 1,
  },
  optionTitle: {
    fontSize: FontSizes.md,
    fontWeight: '600',
    color: Colors.accent,
    marginBottom: 4,
  },
  optionSubtitle: {
    fontSize: FontSizes.sm,
    color: Colors.textSecondary,
  },
});
