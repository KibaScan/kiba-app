// Kiba — Pet Profile (Edit)
import React from 'react';
import { View, Text, StyleSheet, SafeAreaView } from 'react-native';
import { Colors, FontSizes, Spacing } from '../utils/constants';
import { usePetStore } from '../stores/usePetStore';

export default function PetProfileScreen() {
  const activePetId = usePetStore((s) => s.activePetId);
  const pets = usePetStore((s) => s.pets);
  const activePet = pets.find((p) => p.id === activePetId);

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>
          {activePet ? activePet.name : 'Pet Profile'}
        </Text>
      </View>

      <View style={styles.content}>
        <View style={styles.fieldGroup}>
          <FieldPlaceholder label="Name" value={activePet?.name ?? '--'} />
          <FieldPlaceholder
            label="Species"
            value={activePet?.species === 'dog' ? 'Dog' : activePet?.species === 'cat' ? 'Cat' : '--'}
          />
          <FieldPlaceholder label="Breed" value={activePet?.breed ?? 'Not set'} />
          <FieldPlaceholder label="Age" value="Not set" />
          <FieldPlaceholder label="Weight" value="Not set" />
        </View>

        <Text style={styles.note}>
          Full profile editing coming in M1.{'\n'}
          Breed and age will unlock personalized scoring.
        </Text>
      </View>
    </SafeAreaView>
  );
}

function FieldPlaceholder({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <Text style={styles.fieldValue}>{value}</Text>
    </View>
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
    paddingTop: Spacing.lg,
  },
  fieldGroup: {
    backgroundColor: Colors.card,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    overflow: 'hidden',
  },
  field: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.cardBorder,
  },
  fieldLabel: {
    fontSize: FontSizes.md,
    color: Colors.textSecondary,
  },
  fieldValue: {
    fontSize: FontSizes.md,
    color: Colors.textPrimary,
    fontWeight: '500',
  },
  note: {
    fontSize: FontSizes.sm,
    color: Colors.textTertiary,
    textAlign: 'center',
    marginTop: Spacing.xl,
    lineHeight: 20,
  },
});
