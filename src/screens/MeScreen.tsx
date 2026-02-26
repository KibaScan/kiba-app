// Kiba — Me (Profile & Settings)
import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, SafeAreaView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, FontSizes, Spacing } from '../utils/constants';
import { usePetStore } from '../stores/usePetStore';

export default function MeScreen() {
  const pets = usePetStore((s) => s.pets);
  const activePetId = usePetStore((s) => s.activePetId);
  const activePet = pets.find((p) => p.id === activePetId);

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Me</Text>
      </View>

      <View style={styles.content}>
        {activePet && (
          <View style={styles.petCard}>
            <View style={styles.petAvatar}>
              <Text style={styles.petAvatarEmoji}>
                {activePet.species === 'dog' ? '🐕' : '🐈'}
              </Text>
            </View>
            <View style={styles.petInfo}>
              <Text style={styles.petName}>{activePet.name}</Text>
              <Text style={styles.petSpecies}>
                {activePet.species === 'dog' ? 'Dog' : 'Cat'} · {activePet.life_stage}
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color={Colors.textTertiary} />
          </View>
        )}

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Settings</Text>
          <SettingsRow icon="notifications-outline" label="Recall Alerts" />
          <SettingsRow icon="shield-checkmark-outline" label="Subscription" />
          <SettingsRow icon="information-circle-outline" label="About Kiba" />
        </View>
      </View>
    </SafeAreaView>
  );
}

function SettingsRow({ icon, label }: { icon: string; label: string }) {
  return (
    <TouchableOpacity style={styles.settingsRow} activeOpacity={0.6}>
      <Ionicons name={icon as keyof typeof Ionicons.glyphMap} size={22} color={Colors.textSecondary} />
      <Text style={styles.settingsLabel}>{label}</Text>
      <Ionicons name="chevron-forward" size={18} color={Colors.textTertiary} />
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  header: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.md,
    paddingBottom: Spacing.sm,
  },
  title: {
    fontSize: FontSizes.xxl,
    fontWeight: '800',
    color: Colors.textPrimary,
  },
  content: {
    flex: 1,
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.md,
  },
  petCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.card,
    borderRadius: 16,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    marginBottom: Spacing.xl,
  },
  petAvatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#00B4D815',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: Spacing.md,
  },
  petAvatarEmoji: {
    fontSize: 28,
  },
  petInfo: {
    flex: 1,
  },
  petName: {
    fontSize: FontSizes.lg,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  petSpecies: {
    fontSize: FontSizes.sm,
    color: Colors.textSecondary,
    marginTop: 2,
    textTransform: 'capitalize',
  },
  section: {
    marginTop: Spacing.md,
  },
  sectionTitle: {
    fontSize: FontSizes.sm,
    fontWeight: '600',
    color: Colors.textTertiary,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: Spacing.md,
  },
  settingsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: Colors.cardBorder,
    gap: Spacing.md,
  },
  settingsLabel: {
    flex: 1,
    fontSize: FontSizes.md,
    color: Colors.textPrimary,
  },
});
