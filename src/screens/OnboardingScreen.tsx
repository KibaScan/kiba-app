// Kiba — Onboarding (D-092)
// 2-screen intro → minimal pet profile (name + species) → navigate to Home
import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Colors, FontSizes, Spacing } from '../utils/constants';
import { Species } from '../types';
import { useAppStore } from '../stores/useAppStore';
import { usePetStore } from '../stores/usePetStore';

type Step = 'welcome' | 'meet_pet';

export default function OnboardingScreen() {
  const [step, setStep] = useState<Step>('welcome');
  const [petName, setPetName] = useState('');
  const [species, setSpecies] = useState<Species>(Species.Dog);

  const completeOnboarding = useAppStore((s) => s.completeOnboarding);
  const addPet = usePetStore((s) => s.addPet);

  const handleSubmit = () => {
    if (!petName.trim()) return;
    addPet({ name: petName.trim(), species });
    completeOnboarding();
  };

  if (step === 'welcome') {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.content}>
          <Text style={styles.logo}>Kiba</Text>
          <Text style={styles.tagline}>
            Scan pet food and find out{'\n'}what's really inside.
          </Text>
          <Text style={styles.subtitle}>
            Ingredient-level safety scores{'\n'}personalized for your pet.
          </Text>
        </View>
        <View style={styles.footer}>
          <TouchableOpacity style={styles.primaryButton} onPress={() => setStep('meet_pet')}>
            <Text style={styles.primaryButtonText}>Get Started</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <View style={styles.content}>
          <Text style={styles.stepTitle}>Let's meet your pet</Text>
          <Text style={styles.stepSubtitle}>
            We'll personalize scores based on their needs.
          </Text>

          <View style={styles.speciesToggle}>
            <TouchableOpacity
              style={[styles.speciesOption, species === Species.Dog && styles.speciesActive]}
              onPress={() => setSpecies(Species.Dog)}
            >
              <Text style={styles.speciesEmoji}>🐕</Text>
              <Text
                style={[styles.speciesLabel, species === Species.Dog && styles.speciesLabelActive]}
              >
                Dog
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.speciesOption, species === Species.Cat && styles.speciesActive]}
              onPress={() => setSpecies(Species.Cat)}
            >
              <Text style={styles.speciesEmoji}>🐈</Text>
              <Text
                style={[styles.speciesLabel, species === Species.Cat && styles.speciesLabelActive]}
              >
                Cat
              </Text>
            </TouchableOpacity>
          </View>

          <TextInput
            style={styles.input}
            placeholder="Pet's name"
            placeholderTextColor={Colors.textTertiary}
            value={petName}
            onChangeText={setPetName}
            autoCapitalize="words"
            returnKeyType="done"
            onSubmitEditing={handleSubmit}
          />
        </View>

        <View style={styles.footer}>
          <TouchableOpacity
            style={[styles.primaryButton, !petName.trim() && styles.buttonDisabled]}
            onPress={handleSubmit}
            disabled={!petName.trim()}
          >
            <Text style={styles.primaryButtonText}>Continue</Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: Spacing.xl,
  },
  logo: {
    fontSize: 52,
    fontWeight: '800',
    color: Colors.accent,
    marginBottom: Spacing.md,
    letterSpacing: 2,
  },
  tagline: {
    fontSize: FontSizes.xl,
    fontWeight: '600',
    color: Colors.textPrimary,
    textAlign: 'center',
    lineHeight: 30,
    marginBottom: Spacing.md,
  },
  subtitle: {
    fontSize: FontSizes.md,
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
  },
  stepTitle: {
    fontSize: FontSizes.xxl,
    fontWeight: '700',
    color: Colors.textPrimary,
    marginBottom: Spacing.sm,
  },
  stepSubtitle: {
    fontSize: FontSizes.md,
    color: Colors.textSecondary,
    textAlign: 'center',
    marginBottom: Spacing.xl,
  },
  speciesToggle: {
    flexDirection: 'row',
    gap: Spacing.md,
    marginBottom: Spacing.xl,
  },
  speciesOption: {
    width: 120,
    height: 120,
    borderRadius: 16,
    backgroundColor: Colors.card,
    borderWidth: 2,
    borderColor: Colors.cardBorder,
    justifyContent: 'center',
    alignItems: 'center',
  },
  speciesActive: {
    borderColor: Colors.accent,
    backgroundColor: '#00B4D815',
  },
  speciesEmoji: {
    fontSize: 40,
    marginBottom: Spacing.sm,
  },
  speciesLabel: {
    fontSize: FontSizes.md,
    fontWeight: '600',
    color: Colors.textSecondary,
  },
  speciesLabelActive: {
    color: Colors.accent,
  },
  input: {
    width: '100%',
    height: 52,
    backgroundColor: Colors.card,
    borderRadius: 12,
    paddingHorizontal: Spacing.md,
    fontSize: FontSizes.lg,
    color: Colors.textPrimary,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
  },
  footer: {
    paddingHorizontal: Spacing.xl,
    paddingBottom: Spacing.xl,
  },
  primaryButton: {
    height: 52,
    borderRadius: 12,
    backgroundColor: Colors.accent,
    justifyContent: 'center',
    alignItems: 'center',
  },
  buttonDisabled: {
    opacity: 0.4,
  },
  primaryButtonText: {
    fontSize: FontSizes.lg,
    fontWeight: '700',
    color: '#FFFFFF',
  },
});
