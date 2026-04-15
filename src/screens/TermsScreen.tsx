// Kiba — Terms & Conditions Clickwrap (D-094)
// Active checkbox required before proceeding. Blocks all app usage until accepted.
// No emoji (D-084). Professional legal presentation.

import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  SafeAreaView,
  ScrollView,
  Linking,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { Colors, FontSizes, Spacing } from '../utils/constants';
import { useAppStore } from '../stores/useAppStore';

// Placeholder URLs — replace with real URLs when available
const TOS_URL = 'https://kibascan.com/terms';
const PRIVACY_URL = 'https://kibascan.com/privacy';

export default function TermsScreen() {
  const [accepted, setAccepted] = useState(false);
  const acceptTos = useAppStore((s) => s.acceptTos);

  const handleContinue = () => {
    if (!accepted) return;
    acceptTos();
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Logo / Wordmark */}
        <View style={styles.logoSection}>
          <View style={styles.logoCircle}>
            <Ionicons name="shield-checkmark" size={32} color={Colors.accent} />
          </View>
          <Text style={styles.wordmark}>Kiba</Text>
        </View>

        {/* Disclaimer (D-094 attorney-approved copy) */}
        <View style={styles.disclaimerCard}>
          <Text style={styles.disclaimerText}>
            Kiba provides algorithmically generated suitability estimates based
            on public veterinary research and your pet's specific profile. Kiba
            scores do not constitute absolute product quality or safety ratings,
            nor are they an assessment of regulatory compliance.
          </Text>
        </View>

        {/* Active checkbox */}
        <TouchableOpacity
          style={styles.checkboxRow}
          onPress={() => setAccepted((v) => !v)}
          activeOpacity={0.7}
        >
          <View style={[styles.checkbox, accepted && styles.checkboxChecked]}>
            {accepted && (
              <Ionicons name="checkmark" size={16} color="#FFFFFF" />
            )}
          </View>
          <Text style={styles.checkboxLabel}>I understand and agree</Text>
        </TouchableOpacity>

        {/* Legal links */}
        <View style={styles.linksRow}>
          <TouchableOpacity onPress={() => Linking.openURL(TOS_URL)}>
            <Text style={styles.linkText}>Terms of Service</Text>
          </TouchableOpacity>
          <Text style={styles.linkSeparator}>|</Text>
          <TouchableOpacity onPress={() => Linking.openURL(PRIVACY_URL)}>
            <Text style={styles.linkText}>Privacy Policy</Text>
          </TouchableOpacity>
        </View>

        {/* Continue button — disabled until checkbox tapped */}
        <TouchableOpacity
          style={[styles.continueButton, !accepted && styles.continueDisabled]}
          onPress={handleContinue}
          disabled={!accepted}
          activeOpacity={0.8}
        >
          <Text style={styles.continueText}>Continue</Text>
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
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.xxl,
  },

  // ─── Logo
  logoSection: {
    alignItems: 'center',
    marginBottom: Spacing.xl,
  },
  logoCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: `${Colors.accent}20`,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: Spacing.sm,
  },
  wordmark: {
    fontSize: FontSizes.title,
    fontWeight: '800',
    color: Colors.textPrimary,
    letterSpacing: 1,
  },

  // ─── Disclaimer
  disclaimerCard: {
    backgroundColor: Colors.cardSurface,
    borderRadius: 12,
    padding: Spacing.lg,
    borderWidth: 1,
    borderColor: Colors.hairlineBorder,
    marginBottom: Spacing.xl,
  },
  disclaimerText: {
    fontSize: FontSizes.md,
    color: Colors.textSecondary,
    lineHeight: 22,
  },

  // ─── Checkbox
  checkboxRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: Spacing.lg,
    paddingVertical: Spacing.sm,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: Colors.textTertiary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkboxChecked: {
    backgroundColor: Colors.accent,
    borderColor: Colors.accent,
  },
  checkboxLabel: {
    fontSize: FontSizes.md,
    fontWeight: '600',
    color: Colors.textPrimary,
  },

  // ─── Links
  linksRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
    marginBottom: Spacing.xl,
  },
  linkText: {
    fontSize: FontSizes.sm,
    color: Colors.accent,
  },
  linkSeparator: {
    fontSize: FontSizes.sm,
    color: Colors.textTertiary,
  },

  // ─── Continue
  continueButton: {
    height: 52,
    borderRadius: 12,
    backgroundColor: Colors.accent,
    justifyContent: 'center',
    alignItems: 'center',
  },
  continueDisabled: {
    opacity: 0.35,
  },
  continueText: {
    fontSize: FontSizes.lg,
    fontWeight: '700',
    color: '#FFFFFF',
  },
});
