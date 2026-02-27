// Kiba — Result Screen (Score Display Placeholder)
// Accepts product + petId from navigation params.
// Scoring engine is NOT wired — all scores display as "--" placeholders.
import React from 'react';
import { View, Text, StyleSheet, SafeAreaView, TouchableOpacity } from 'react-native';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';

import { Colors, FontSizes, Spacing } from '../utils/constants';
import { ScanStackParamList } from '../types/navigation';
import { usePetStore } from '../stores/usePetStore';

type ScreenRoute = RouteProp<ScanStackParamList, 'Result'>;
type ScreenNav = NativeStackNavigationProp<ScanStackParamList, 'Result'>;

export default function ResultScreen() {
  const navigation = useNavigation<ScreenNav>();
  const route = useRoute<ScreenRoute>();
  const { product, petId } = route.params;

  const pets = usePetStore((s) => s.pets);
  const pet = pets.find((p) => p.id === petId);
  const petName = pet?.name ?? 'your pet';

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} hitSlop={12}>
          <Ionicons name="arrow-back" size={24} color={Colors.textPrimary} />
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={styles.productBrand} numberOfLines={1}>
            {product.brand}
          </Text>
          <Text style={styles.productName} numberOfLines={1}>
            {product.name}
          </Text>
        </View>
        <View style={styles.headerSpacer} />
      </View>

      <View style={styles.content}>
        <View style={styles.scorePlaceholder}>
          <Text style={styles.scoreValue}>--</Text>
          <Text style={styles.scoreLabel}>% match for {petName}</Text>
        </View>

        <View style={styles.waterfallCard}>
          <Text style={styles.sectionTitle}>Score Breakdown</Text>
          <View style={styles.layerRow}>
            <Text style={styles.layerLabel}>Ingredient Concerns</Text>
            <Text style={styles.layerValue}>--</Text>
          </View>
          <View style={styles.layerRow}>
            <Text style={styles.layerLabel}>{petName}'s Nutritional Fit</Text>
            <Text style={styles.layerValue}>--</Text>
          </View>
          <View style={[styles.layerRow, styles.layerRowLast]}>
            <Text style={styles.layerLabel}>{petName}'s Breed & Age Adjustments</Text>
            <Text style={styles.layerValue}>--</Text>
          </View>
        </View>

        <Text style={styles.placeholder}>
          Scoring engine coming in M1.
        </Text>
      </View>
    </SafeAreaView>
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
    paddingTop: Spacing.md,
    paddingBottom: Spacing.sm,
  },
  headerCenter: {
    flex: 1,
    alignItems: 'center',
    paddingHorizontal: Spacing.sm,
  },
  headerSpacer: {
    width: 24,
  },
  productBrand: {
    fontSize: FontSizes.sm,
    fontWeight: '500',
    color: Colors.textSecondary,
  },
  productName: {
    fontSize: FontSizes.lg,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  content: {
    flex: 1,
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.xl,
    alignItems: 'center',
  },
  scorePlaceholder: {
    width: 180,
    height: 180,
    borderRadius: 90,
    borderWidth: 6,
    borderColor: Colors.cardBorder,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: Spacing.xl,
  },
  scoreValue: {
    fontSize: 48,
    fontWeight: '800',
    color: Colors.textTertiary,
  },
  scoreLabel: {
    fontSize: FontSizes.sm,
    color: Colors.textTertiary,
  },
  waterfallCard: {
    width: '100%',
    backgroundColor: Colors.card,
    borderRadius: 16,
    padding: Spacing.lg,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    marginBottom: Spacing.lg,
  },
  sectionTitle: {
    fontSize: FontSizes.lg,
    fontWeight: '700',
    color: Colors.textPrimary,
    marginBottom: Spacing.md,
  },
  layerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: Spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: Colors.cardBorder,
  },
  layerRowLast: {
    borderBottomWidth: 0,
  },
  layerLabel: {
    fontSize: FontSizes.md,
    color: Colors.textSecondary,
    flex: 1,
  },
  layerValue: {
    fontSize: FontSizes.md,
    fontWeight: '600',
    color: Colors.textTertiary,
  },
  placeholder: {
    fontSize: FontSizes.sm,
    color: Colors.textTertiary,
    marginTop: Spacing.md,
  },
});
