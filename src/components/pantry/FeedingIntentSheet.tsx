import React from 'react';
import { View, Text, StyleSheet, Pressable, Platform, ScrollView, Modal, KeyboardAvoidingView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { Colors, FontSizes, Spacing } from '../../utils/constants';
import { chipToggle } from '../../utils/haptics';

interface FeedingIntentSheetProps {
  isVisible: boolean;
  petName: string;
  onRegularMeal: () => void;
  onTopperExtras: () => void;
  onDismiss: () => void;
}

export function FeedingIntentSheet({
  isVisible,
  petName,
  onRegularMeal,
  onTopperExtras,
  onDismiss,
}: FeedingIntentSheetProps) {
  if (!isVisible) return null;

  const handleRegularMeal = () => {
    chipToggle();
    onRegularMeal();
  };

  const handleTopperExtras = () => {
    chipToggle();
    onTopperExtras();
  };

  return (
    <Modal visible={isVisible} transparent animationType="slide" onRequestClose={onDismiss}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <Pressable style={styles.overlay} onPress={onDismiss}>
          <Pressable style={styles.sheet} onPress={() => {}}>
            <View style={styles.contentContainer}>
              <View style={styles.header}>
                <Text style={styles.title}>How will {petName} eat this?</Text>
                <Text style={styles.subtitle}>
                  This affects how we track feedings and portions.
                </Text>
              </View>

              <ScrollView contentContainerStyle={styles.scrollContent}>
                <Pressable style={styles.optionCard} onPress={handleRegularMeal}>
                  <View style={[styles.iconBox, { backgroundColor: Colors.chipSurface }]}>
                    <Ionicons name="restaurant-outline" size={28} color={Colors.accent} />
                  </View>
                  <View style={styles.optionTextContainer}>
                    <Text style={styles.optionTitle}>Regular meal</Text>
                    <Text style={styles.optionSubtitle}>
                      This is a main meal for {petName}. I'll feed it on a schedule.
                    </Text>
                  </View>
                  <Ionicons name="chevron-forward" size={20} color={Colors.textSecondary} />
                </Pressable>

                <Pressable style={styles.optionCard} onPress={handleTopperExtras}>
                  <View style={[styles.iconBox, { backgroundColor: Colors.chipSurface }]}>
                    <Ionicons name="add-circle-outline" size={28} color={Colors.accent} />
                  </View>
                  <View style={styles.optionTextContainer}>
                    <Text style={styles.optionTitle}>Just a topper or extra</Text>
                    <Text style={styles.optionSubtitle}>
                      I'll add it on top of {petName}'s dry food occasionally. I'll log when I feed it.
                    </Text>
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
    textAlign: 'center',
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
