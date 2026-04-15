// Kiba — Paywall Screen (D-051, D-126)
// Identity framing, annual-first anchoring, per-month math.
// RevenueCat purchase flow. Ionicons only (D-084). No emoji.

import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  SafeAreaView,
  ScrollView,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';

import { Colors, FontSizes, Spacing } from '../utils/constants';
import { purchaseSubscription } from '../utils/permissions';
import { useActivePetStore } from '../stores/useActivePetStore';
import type { RootStackParamList, PaywallTrigger } from '../types/navigation';

type ScreenRoute = RouteProp<RootStackParamList, 'Paywall'>;

// ─── Trigger-specific copy ────────────────────────────────

function getTriggerHeadline(trigger: PaywallTrigger, petName: string): string {
  switch (trigger) {
    case 'scan_limit':
      return "You've used all 5 free scans this week";
    case 'pet_limit':
      return 'Add unlimited pets with Premium';
    case 'safe_swap':
      return `Discover healthier alternatives for ${petName}`;
    case 'search':
      return 'Search any product by name';
    case 'compare':
      return 'Compare products side-by-side';
    case 'vet_report':
      return `Export a vet report for ${petName}`;
    case 'elimination_diet':
      return `Track elimination diets for ${petName}`;
    default:
      return `Upgrade to protect ${petName}`;
  }
}

// ─── Feature list items ───────────────────────────────────

const FEATURES: { icon: keyof typeof Ionicons.glyphMap; label: string }[] = [
  { icon: 'scan-outline', label: 'Unlimited scans' },
  { icon: 'paw-outline', label: 'Multiple pet profiles' },
  { icon: 'search-outline', label: 'Search by name' },
  { icon: 'git-compare-outline', label: 'Product comparison' },
  { icon: 'swap-horizontal-outline', label: 'Safe Swap alternatives' },
  { icon: 'trending-down-outline', label: 'Goal weight tracking' },
  { icon: 'battery-half-outline', label: 'Treat battery' },
];

// ─── Component ────────────────────────────────────────────

export default function PaywallScreen() {
  const navigation = useNavigation();
  const route = useRoute<ScreenRoute>();
  const { trigger, petName: paramPetName } = route.params;

  const activePet = useActivePetStore((s) => {
    const id = s.activePetId;
    return id ? s.pets.find((p) => p.id === id) : null;
  });
  const petName = paramPetName ?? activePet?.name ?? 'your pet';

  const [selectedPlan, setSelectedPlan] = useState<'annual' | 'monthly'>('annual');
  const [isPurchasing, setIsPurchasing] = useState(false);

  // ─── Purchase handler ─────────────────────────────────

  const handlePurchase = async () => {
    setIsPurchasing(true);
    try {
      const result = await purchaseSubscription(selectedPlan);
      if (result.success) {
        navigation.goBack();
      } else if (result.error) {
        Alert.alert('Purchase Failed', result.error);
      }
    } finally {
      setIsPurchasing(false);
    }
  };

  // ─── Render ───────────────────────────────────────────

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Close button */}
        <TouchableOpacity
          style={styles.closeButton}
          onPress={() => navigation.goBack()}
          hitSlop={12}
        >
          <Ionicons name="close" size={28} color={Colors.textSecondary} />
        </TouchableOpacity>

        {/* Header — identity framing (D-126) */}
        <View style={styles.headerSection}>
          <View style={styles.iconCircle}>
            <Ionicons name="shield-checkmark" size={36} color={Colors.accent} />
          </View>
          <Text style={styles.headline}>
            {getTriggerHeadline(trigger, petName)}
          </Text>
          <Text style={styles.subheadline}>
            Upgrade to protect {petName}
          </Text>
        </View>

        {/* Plan cards */}
        <View style={styles.planCards}>
          {/* Annual — primary (D-126 anchoring) */}
          <TouchableOpacity
            style={[
              styles.planCard,
              selectedPlan === 'annual' && styles.planCardSelected,
            ]}
            activeOpacity={0.7}
            onPress={() => setSelectedPlan('annual')}
          >
            <View style={styles.bestValueBadge}>
              <Text style={styles.bestValueText}>Best Value</Text>
            </View>
            <Text style={styles.planPrice}>$24.99/year</Text>
            <Text style={styles.planPerMonth}>Just $2.08/mo</Text>
            <Text style={styles.planAnchor}>
              Less than the cost of one bag of premium treats
            </Text>
            {selectedPlan === 'annual' && (
              <View style={styles.checkCircle}>
                <Ionicons name="checkmark-circle" size={24} color={Colors.accent} />
              </View>
            )}
          </TouchableOpacity>

          {/* Monthly — secondary (visually recessive) */}
          <TouchableOpacity
            style={[
              styles.planCard,
              styles.planCardSecondary,
              selectedPlan === 'monthly' && styles.planCardSelected,
            ]}
            activeOpacity={0.7}
            onPress={() => setSelectedPlan('monthly')}
          >
            <Text style={[styles.planPrice, styles.planPriceSecondary]}>
              $5.99/month
            </Text>
            {selectedPlan === 'monthly' && (
              <View style={styles.checkCircle}>
                <Ionicons name="checkmark-circle" size={24} color={Colors.accent} />
              </View>
            )}
          </TouchableOpacity>
        </View>

        {/* Feature list */}
        <View style={styles.featureList}>
          {FEATURES.map((f) => (
            <View key={f.label} style={styles.featureRow}>
              <Ionicons name={f.icon} size={20} color={Colors.accent} />
              <Text style={styles.featureLabel}>{f.label}</Text>
            </View>
          ))}
        </View>

        {/* CTA — identity framing (D-126) */}
        <TouchableOpacity
          style={[styles.ctaButton, isPurchasing && styles.ctaButtonDisabled]}
          onPress={handlePurchase}
          disabled={isPurchasing}
          activeOpacity={0.8}
        >
          {isPurchasing ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <Text style={styles.ctaText}>
              Start Protecting {petName}
            </Text>
          )}
        </TouchableOpacity>

        {/* Legal fine print */}
        <Text style={styles.legalText}>
          Cancel anytime. Recurring billing.
        </Text>

        {/* Dismiss link */}
        <TouchableOpacity
          style={styles.dismissButton}
          onPress={() => navigation.goBack()}
        >
          <Text style={styles.dismissText}>Maybe later</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

// ─── Styles ──────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  scrollContent: {
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.xxl,
  },
  closeButton: {
    alignSelf: 'flex-end',
    paddingTop: Spacing.md,
    paddingBottom: Spacing.sm,
  },

  // ─── Header
  headerSection: {
    alignItems: 'center',
    marginBottom: Spacing.xl,
  },
  iconCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: `${Colors.accent}20`,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: Spacing.md,
  },
  headline: {
    fontSize: FontSizes.xl,
    fontWeight: '700',
    color: Colors.textPrimary,
    textAlign: 'center',
    marginBottom: Spacing.xs,
  },
  subheadline: {
    fontSize: FontSizes.md,
    color: Colors.textSecondary,
    textAlign: 'center',
  },

  // ─── Plan Cards
  planCards: {
    gap: Spacing.sm,
    marginBottom: Spacing.xl,
  },
  planCard: {
    backgroundColor: Colors.cardSurface,
    borderRadius: 16,
    padding: Spacing.lg,
    borderWidth: 2,
    borderColor: Colors.hairlineBorder,
    position: 'relative',
  },
  planCardSelected: {
    borderColor: Colors.accent,
    backgroundColor: `${Colors.accent}10`,
  },
  planCardSecondary: {
    paddingVertical: Spacing.md,
  },
  bestValueBadge: {
    position: 'absolute',
    top: -10,
    right: 16,
    backgroundColor: Colors.severityGreen,
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 8,
  },
  bestValueText: {
    fontSize: FontSizes.xs,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  planPrice: {
    fontSize: FontSizes.xl,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  planPriceSecondary: {
    fontSize: FontSizes.lg,
    color: Colors.textSecondary,
  },
  planPerMonth: {
    fontSize: FontSizes.lg,
    fontWeight: '600',
    color: Colors.accent,
    marginTop: Spacing.xs,
  },
  planAnchor: {
    fontSize: FontSizes.sm,
    color: Colors.textSecondary,
    marginTop: Spacing.xs,
  },
  checkCircle: {
    position: 'absolute',
    top: 16,
    right: 16,
  },

  // ─── Features
  featureList: {
    gap: Spacing.md,
    marginBottom: Spacing.xl,
  },
  featureRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  featureLabel: {
    fontSize: FontSizes.md,
    color: Colors.textPrimary,
  },

  // ─── CTA
  ctaButton: {
    height: 56,
    borderRadius: 14,
    backgroundColor: Colors.accent,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: Spacing.sm,
  },
  ctaButtonDisabled: {
    opacity: 0.6,
  },
  ctaText: {
    fontSize: FontSizes.lg,
    fontWeight: '700',
    color: '#FFFFFF',
  },

  // ─── Legal / Dismiss
  legalText: {
    fontSize: FontSizes.xs,
    color: Colors.textTertiary,
    textAlign: 'center',
    marginBottom: Spacing.md,
  },
  dismissButton: {
    alignSelf: 'center',
    paddingVertical: Spacing.sm,
  },
  dismissText: {
    fontSize: FontSizes.md,
    color: Colors.textSecondary,
  },
});
