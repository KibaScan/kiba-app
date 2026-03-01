// Kiba — Species Selection (Pre-Create)
// Full-screen "I have a..." with two large tappable cards.
// Species is locked after this selection — not editable on the create/edit form.

import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Colors, FontSizes, Spacing } from '../utils/constants';
import { speciesToggle } from '../utils/haptics';
import type { MeStackParamList } from '../types/navigation';

type Props = NativeStackScreenProps<MeStackParamList, 'SpeciesSelect'>;

export default function SpeciesSelectScreen({ navigation }: Props) {
  function handleSelect(species: 'dog' | 'cat') {
    speciesToggle();
    navigation.navigate('CreatePet', { species });
  }

  return (
    <SafeAreaView style={styles.container}>
      <TouchableOpacity
        style={styles.backButton}
        onPress={() => navigation.goBack()}
        hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
      >
        <Ionicons name="arrow-back" size={24} color={Colors.textPrimary} />
      </TouchableOpacity>

      <View style={styles.content}>
        <Text style={styles.title}>I have a...</Text>

        <View style={styles.cardRow}>
          <TouchableOpacity
            style={styles.speciesCard}
            activeOpacity={0.7}
            onPress={() => handleSelect('dog')}
          >
            <Ionicons name="paw" size={48} color={Colors.accent} />
            <Text style={styles.speciesLabel}>Dog</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.speciesCard}
            activeOpacity={0.7}
            onPress={() => handleSelect('cat')}
          >
            <Ionicons name="paw" size={48} color={Colors.accent} />
            <Text style={styles.speciesLabel}>Cat</Text>
          </TouchableOpacity>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  backButton: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.md,
    alignSelf: 'flex-start',
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: Spacing.xl,
  },
  title: {
    fontSize: FontSizes.xxl,
    fontWeight: '700',
    color: Colors.textPrimary,
    marginBottom: Spacing.xl,
  },
  cardRow: {
    flexDirection: 'row',
    gap: Spacing.md,
  },
  speciesCard: {
    flex: 1,
    aspectRatio: 1,
    maxWidth: 160,
    backgroundColor: Colors.card,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    gap: Spacing.sm,
  },
  speciesLabel: {
    fontSize: FontSizes.lg,
    fontWeight: '600',
    color: Colors.textPrimary,
  },
});
