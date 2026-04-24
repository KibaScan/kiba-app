// Kiba — M9 Community KibaKitchenSubmitScreen (Task 24)
// Recipe submission form. Heavy lifting (UUID gen + Storage upload + INSERT +
// validate-recipe Edge Function) lives in `recipeService.submitRecipe`. This
// screen is just form-side gating + branch handling for the three result paths
// (pending_review, auto_rejected, thrown error).
//
// Spec §6.1 + §15.1. AAFCO acknowledgment is required (D-095 + nutritional
// adequacy guard). Auto-reject reason renders inline so the user can edit and
// resubmit without leaving the screen.

import React, { useCallback, useMemo, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  Alert,
  Image,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import { Colors, FontSizes, Spacing, SEVERITY_COLORS } from '../utils/constants';
import { chipToggle, speciesToggle } from '../utils/haptics';
import type { CommunityStackParamList } from '../types/navigation';
import type {
  RecipeSpecies,
  RecipeLifeStage,
  SubmitRecipeInput,
} from '../types/recipe';
import { RecipeOfflineError } from '../types/recipe';
import { submitRecipe } from '../services/recipeService';
import {
  RecipeIngredientRow,
  type RecipeIngredientDraft,
} from '../components/community/RecipeIngredientRow';
import { RecipePrepStepRow } from '../components/community/RecipePrepStepRow';
import { RecipeDisclaimerBanner } from '../components/community/RecipeDisclaimerBanner';

// ─── Constants ──────────────────────────────────────────

const MIN_TITLE = 4;
const MAX_TITLE = 80;
const MAX_SUBTITLE = 140;
const MIN_INGREDIENTS = 2;
const MAX_INGREDIENTS = 20;
const MIN_STEPS = 1;
const MAX_STEPS = 15;

const SPECIES_OPTIONS: { value: RecipeSpecies; label: string }[] = [
  { value: 'dog', label: 'Dog' },
  { value: 'cat', label: 'Cat' },
  { value: 'both', label: 'Both' },
];

const LIFE_STAGE_OPTIONS: { value: RecipeLifeStage; label: string }[] = [
  { value: 'puppy', label: 'Puppy' },
  { value: 'adult', label: 'Adult' },
  { value: 'senior', label: 'Senior' },
  { value: 'all', label: 'All' },
];

const AAFCO_CHECKBOX_TEXT =
  'I understand this recipe is not a complete-and-balanced AAFCO diet and should only be fed as an occasional supplement, not as my pet’s primary food.';

// ─── Pure helpers (testable) ────────────────────────────

/**
 * Trims whitespace and parses an ingredient quantity string. Returns null when
 * the value is empty / NaN / non-positive — those cases must block submit.
 */
export function parseQuantity(raw: string): number | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const n = Number(trimmed);
  if (!isFinite(n) || n <= 0) return null;
  return n;
}

/**
 * True when every gating constraint is satisfied. Pure function so the screen's
 * Submit button enable/disable state stays predictable.
 */
export function canSubmitRecipe(state: {
  title: string;
  ingredients: RecipeIngredientDraft[];
  prepSteps: string[];
  coverImageUri: string | null;
  aafcoAcknowledged: boolean;
}): boolean {
  const titleLen = state.title.trim().length;
  if (titleLen < MIN_TITLE || titleLen > MAX_TITLE) return false;

  if (
    state.ingredients.length < MIN_INGREDIENTS ||
    state.ingredients.length > MAX_INGREDIENTS
  ) {
    return false;
  }

  for (const ing of state.ingredients) {
    if (!ing.name.trim()) return false;
    if (parseQuantity(ing.quantity) === null) return false;
    // unit is optional (allows raw counts like "1 egg")
  }

  const filledSteps = state.prepSteps.filter((s) => s.trim().length > 0);
  if (filledSteps.length < MIN_STEPS || state.prepSteps.length > MAX_STEPS) {
    return false;
  }

  if (!state.coverImageUri) return false;
  if (!state.aafcoAcknowledged) return false;

  return true;
}

// ─── Component ──────────────────────────────────────────

type Props = NativeStackScreenProps<CommunityStackParamList, 'KibaKitchenSubmit'>;

type SubmitState = 'idle' | 'submitting';

export default function KibaKitchenSubmitScreen({ navigation }: Props) {
  const insets = useSafeAreaInsets();

  // Form state.
  const [title, setTitle] = useState('');
  const [subtitle, setSubtitle] = useState('');
  const [species, setSpecies] = useState<RecipeSpecies>('dog');
  const [lifeStage, setLifeStage] = useState<RecipeLifeStage>('adult');
  const [ingredients, setIngredients] = useState<RecipeIngredientDraft[]>([
    { name: '', quantity: '', unit: '' },
    { name: '', quantity: '', unit: '' },
  ]);
  const [prepSteps, setPrepSteps] = useState<string[]>(['']);
  const [coverImageUri, setCoverImageUri] = useState<string | null>(null);
  const [aafcoAcknowledged, setAafcoAcknowledged] = useState(false);

  // Submit state.
  const [submitState, setSubmitState] = useState<SubmitState>('idle');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // ── Derived ──
  const canSubmit = useMemo(
    () =>
      canSubmitRecipe({
        title,
        ingredients,
        prepSteps,
        coverImageUri,
        aafcoAcknowledged,
      }),
    [title, ingredients, prepSteps, coverImageUri, aafcoAcknowledged],
  );

  // ── Image picker ──
  const handlePickCover = useCallback(async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        allowsEditing: true,
        aspect: [4, 3],
        quality: 0.7,
        mediaTypes: ['images'],
      });
      if (!result.canceled && result.assets && result.assets[0]) {
        setCoverImageUri(result.assets[0].uri);
        // Clear any prior error once the user has acted on the form.
        setErrorMessage(null);
      }
    } catch {
      // Swallow — picker errors are non-actionable for the user; the cover
      // simply stays unset and the gated Submit blocks the path.
    }
  }, []);

  // ── Ingredient handlers ──
  const handleIngredientChange = useCallback(
    (idx: number, next: RecipeIngredientDraft) => {
      setIngredients((prev) => prev.map((row, i) => (i === idx ? next : row)));
    },
    [],
  );

  const handleAddIngredient = useCallback(() => {
    setIngredients((prev) => {
      if (prev.length >= MAX_INGREDIENTS) return prev;
      return [...prev, { name: '', quantity: '', unit: '' }];
    });
  }, []);

  const handleRemoveIngredient = useCallback((idx: number) => {
    setIngredients((prev) => {
      if (prev.length <= MIN_INGREDIENTS) return prev;
      return prev.filter((_, i) => i !== idx);
    });
  }, []);

  // ── Prep step handlers ──
  const handleStepChange = useCallback((idx: number, next: string) => {
    setPrepSteps((prev) => prev.map((s, i) => (i === idx ? next : s)));
  }, []);

  const handleAddStep = useCallback(() => {
    setPrepSteps((prev) => {
      if (prev.length >= MAX_STEPS) return prev;
      return [...prev, ''];
    });
  }, []);

  const handleRemoveStep = useCallback((idx: number) => {
    setPrepSteps((prev) => {
      if (prev.length <= MIN_STEPS) return prev;
      return prev.filter((_, i) => i !== idx);
    });
  }, []);

  // ── Toggles (with haptics) ──
  const handleSpecies = useCallback((next: RecipeSpecies) => {
    speciesToggle();
    setSpecies(next);
  }, []);

  const handleLifeStage = useCallback((next: RecipeLifeStage) => {
    chipToggle();
    setLifeStage(next);
  }, []);

  const handleToggleAafco = useCallback(() => {
    chipToggle();
    setAafcoAcknowledged((v) => !v);
  }, []);

  // ── Submit ──
  const handleSubmit = useCallback(async () => {
    if (!canSubmit || submitState === 'submitting' || !coverImageUri) return;

    // Build the typed payload from validated drafts. parseQuantity already
    // ran inside canSubmitRecipe, so the bang here is safe.
    const payload: SubmitRecipeInput = {
      title: title.trim(),
      subtitle: subtitle.trim() || undefined,
      species,
      life_stage: lifeStage,
      ingredients: ingredients.map((ing) => ({
        name: ing.name.trim(),
        quantity: parseQuantity(ing.quantity)!,
        unit: ing.unit.trim(),
      })),
      prep_steps: prepSteps.map((s) => s.trim()).filter((s) => s.length > 0),
      cover_image_uri: coverImageUri,
    };

    setSubmitState('submitting');
    setErrorMessage(null);

    try {
      const result = await submitRecipe(payload);
      if (result.status === 'auto_rejected') {
        setErrorMessage(result.reason);
        setSubmitState('idle');
        return;
      }
      // pending_review → success.
      Alert.alert('Submitted', 'Submitted for review.');
      navigation.goBack();
    } catch (e) {
      if (e instanceof RecipeOfflineError) {
        setErrorMessage(
          'You’re offline — recipes need a network connection.',
        );
      } else {
        setErrorMessage('Something went wrong. Please try again.');
      }
      setSubmitState('idle');
    }
  }, [
    canSubmit,
    submitState,
    coverImageUri,
    title,
    subtitle,
    species,
    lifeStage,
    ingredients,
    prepSteps,
    navigation,
  ]);

  const submitting = submitState === 'submitting';
  const submitDisabled = !canSubmit || submitting;

  // ── Render ──
  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity
            onPress={() => navigation.goBack()}
            hitSlop={12}
            accessibilityRole="button"
            accessibilityLabel="Cancel"
          >
            <Ionicons name="close" size={24} color={Colors.textPrimary} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Submit a Recipe</Text>
          <View style={styles.headerSpacer} />
        </View>

        <ScrollView
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Cover photo */}
          <Text style={styles.sectionLabel}>Cover Photo</Text>
          <TouchableOpacity
            style={styles.coverButton}
            onPress={handlePickCover}
            activeOpacity={0.7}
            accessibilityRole="button"
            accessibilityLabel={
              coverImageUri ? 'Change cover photo' : 'Add cover photo'
            }
          >
            {coverImageUri ? (
              <Image source={{ uri: coverImageUri }} style={styles.coverImage} />
            ) : (
              <View style={styles.coverPlaceholder}>
                <Ionicons
                  name="image-outline"
                  size={32}
                  color={Colors.textTertiary}
                />
                <Text style={styles.coverPlaceholderText}>Tap to add photo</Text>
              </View>
            )}
          </TouchableOpacity>

          {/* Title */}
          <Text style={styles.sectionLabel}>Title</Text>
          <TextInput
            style={styles.input}
            placeholder="Title (4-80 chars)"
            placeholderTextColor={Colors.textTertiary}
            value={title}
            onChangeText={setTitle}
            maxLength={MAX_TITLE}
            accessibilityLabel="Recipe title"
          />

          {/* Subtitle */}
          <Text style={styles.sectionLabel}>Subtitle (optional)</Text>
          <TextInput
            style={styles.input}
            placeholder="Subtitle"
            placeholderTextColor={Colors.textTertiary}
            value={subtitle}
            onChangeText={setSubtitle}
            maxLength={MAX_SUBTITLE}
            accessibilityLabel="Recipe subtitle"
          />

          {/* Species */}
          <Text style={styles.sectionLabel}>Species</Text>
          <View style={styles.chipRow}>
            {SPECIES_OPTIONS.map((opt) => (
              <TouchableOpacity
                key={opt.value}
                style={[styles.chip, species === opt.value && styles.chipActive]}
                onPress={() => handleSpecies(opt.value)}
                activeOpacity={0.7}
                accessibilityRole="button"
                accessibilityLabel={`Species ${opt.label}`}
                accessibilityState={{ selected: species === opt.value }}
              >
                <Text
                  style={[
                    styles.chipText,
                    species === opt.value && styles.chipTextActive,
                  ]}
                >
                  {opt.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Life Stage */}
          <Text style={styles.sectionLabel}>Life Stage</Text>
          <View style={styles.chipRow}>
            {LIFE_STAGE_OPTIONS.map((opt) => (
              <TouchableOpacity
                key={opt.value}
                style={[styles.chip, lifeStage === opt.value && styles.chipActive]}
                onPress={() => handleLifeStage(opt.value)}
                activeOpacity={0.7}
                accessibilityRole="button"
                accessibilityLabel={`Life stage ${opt.label}`}
                accessibilityState={{ selected: lifeStage === opt.value }}
              >
                <Text
                  style={[
                    styles.chipText,
                    lifeStage === opt.value && styles.chipTextActive,
                  ]}
                >
                  {opt.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Ingredients */}
          <Text style={styles.sectionLabel}>
            Ingredients ({ingredients.length}/{MAX_INGREDIENTS})
          </Text>
          {ingredients.map((ing, idx) => (
            <RecipeIngredientRow
              key={idx}
              ingredient={ing}
              onChange={(next) => handleIngredientChange(idx, next)}
              onRemove={() => handleRemoveIngredient(idx)}
              canRemove={ingredients.length > MIN_INGREDIENTS}
            />
          ))}
          {ingredients.length < MAX_INGREDIENTS && (
            <TouchableOpacity
              style={styles.addRowBtn}
              onPress={handleAddIngredient}
              activeOpacity={0.7}
              accessibilityRole="button"
              accessibilityLabel="Add ingredient"
            >
              <Ionicons name="add" size={18} color={Colors.accent} />
              <Text style={styles.addRowText}>Add ingredient</Text>
            </TouchableOpacity>
          )}

          {/* Prep Steps */}
          <Text style={styles.sectionLabel}>
            Prep Steps ({prepSteps.length}/{MAX_STEPS})
          </Text>
          {prepSteps.map((step, idx) => (
            <RecipePrepStepRow
              key={idx}
              step={step}
              index={idx}
              onChange={(next) => handleStepChange(idx, next)}
              onRemove={() => handleRemoveStep(idx)}
              canRemove={prepSteps.length > MIN_STEPS}
            />
          ))}
          {prepSteps.length < MAX_STEPS && (
            <TouchableOpacity
              style={styles.addRowBtn}
              onPress={handleAddStep}
              activeOpacity={0.7}
              accessibilityRole="button"
              accessibilityLabel="Add step"
            >
              <Ionicons name="add" size={18} color={Colors.accent} />
              <Text style={styles.addRowText}>Add step</Text>
            </TouchableOpacity>
          )}

          {/* Disclaimer */}
          <View style={styles.disclaimerWrap}>
            <RecipeDisclaimerBanner />
          </View>

          {/* AAFCO Checkbox */}
          <TouchableOpacity
            style={styles.checkboxRow}
            onPress={handleToggleAafco}
            activeOpacity={0.7}
            accessibilityRole="checkbox"
            accessibilityLabel={AAFCO_CHECKBOX_TEXT}
            accessibilityState={{ checked: aafcoAcknowledged }}
          >
            <Ionicons
              name={aafcoAcknowledged ? 'checkbox' : 'square-outline'}
              size={22}
              color={aafcoAcknowledged ? Colors.accent : Colors.textTertiary}
            />
            <Text style={styles.checkboxText}>{AAFCO_CHECKBOX_TEXT}</Text>
          </TouchableOpacity>

          {/* Inline error banner */}
          {errorMessage && (
            <View style={styles.errorBanner} accessibilityRole="alert">
              <Ionicons
                name="alert-circle-outline"
                size={18}
                color={SEVERITY_COLORS.danger}
                style={{ marginTop: 1 }}
              />
              <Text style={styles.errorText}>{errorMessage}</Text>
            </View>
          )}

          <View style={styles.bottomSpacer} />
        </ScrollView>

        {/* Footer */}
        <View style={[styles.footer, { paddingBottom: insets.bottom + Spacing.md }]}>
          <TouchableOpacity
            style={[styles.submitBtn, submitDisabled && styles.submitBtnDisabled]}
            onPress={handleSubmit}
            disabled={submitDisabled}
            activeOpacity={0.7}
            accessibilityRole="button"
            accessibilityLabel="Submit recipe"
            accessibilityState={{ disabled: submitDisabled }}
          >
            {submitting ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Text style={styles.submitBtnText}>Submit Recipe</Text>
            )}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}

// ─── Styles ─────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  flex: { flex: 1 },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    borderBottomColor: Colors.hairlineBorder,
    borderBottomWidth: 1,
  },
  headerTitle: {
    flex: 1,
    fontSize: FontSizes.lg,
    fontWeight: '700',
    color: Colors.textPrimary,
    textAlign: 'center',
  },
  headerSpacer: { width: 24 },

  // Scroll
  scroll: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.md,
  },

  // Section label
  sectionLabel: {
    fontSize: FontSizes.sm,
    fontWeight: '600',
    color: Colors.textSecondary,
    marginTop: Spacing.lg,
    marginBottom: Spacing.sm,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },

  // Cover photo
  coverButton: {
    backgroundColor: Colors.cardSurface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.hairlineBorder,
    overflow: 'hidden',
    aspectRatio: 4 / 3,
  },
  coverImage: {
    width: '100%',
    height: '100%',
  },
  coverPlaceholder: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
  },
  coverPlaceholderText: {
    color: Colors.textTertiary,
    fontSize: FontSizes.sm,
  },

  // Inputs
  input: {
    backgroundColor: Colors.cardSurface,
    borderRadius: 12,
    padding: Spacing.md,
    fontSize: FontSizes.md,
    color: Colors.textPrimary,
    borderWidth: 1,
    borderColor: Colors.hairlineBorder,
  },

  // Chips
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
  },
  chip: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: 10,
    backgroundColor: Colors.cardSurface,
    borderWidth: 1,
    borderColor: Colors.hairlineBorder,
  },
  chipActive: {
    backgroundColor: Colors.accent,
    borderColor: Colors.accent,
  },
  chipText: {
    fontSize: FontSizes.sm,
    color: Colors.textSecondary,
    fontWeight: '600',
  },
  chipTextActive: {
    color: Colors.textPrimary,
  },

  // Add-row buttons
  addRowBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    backgroundColor: Colors.chipSurface,
    borderRadius: 10,
    alignSelf: 'flex-start',
    marginTop: Spacing.xs,
  },
  addRowText: {
    fontSize: FontSizes.sm,
    fontWeight: '600',
    color: Colors.accent,
  },

  // Disclaimer wrap
  disclaimerWrap: {
    marginTop: Spacing.lg,
  },

  // Checkbox row
  checkboxRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.sm,
    marginTop: Spacing.md,
    paddingVertical: Spacing.sm,
  },
  checkboxText: {
    flex: 1,
    fontSize: FontSizes.sm,
    color: Colors.textSecondary,
    lineHeight: 18,
  },

  // Error banner
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.sm,
    marginTop: Spacing.md,
    backgroundColor: 'rgba(239, 68, 68, 0.12)',
    borderRadius: 12,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.32)',
  },
  errorText: {
    flex: 1,
    fontSize: FontSizes.sm,
    color: SEVERITY_COLORS.danger,
    lineHeight: 18,
  },

  bottomSpacer: { height: 24 },

  // Footer
  footer: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.md,
    borderTopColor: Colors.hairlineBorder,
    borderTopWidth: 1,
  },
  submitBtn: {
    backgroundColor: Colors.accent,
    borderRadius: 14,
    paddingVertical: Spacing.md,
    alignItems: 'center',
  },
  submitBtnDisabled: {
    opacity: 0.4,
  },
  submitBtnText: {
    fontSize: FontSizes.lg,
    fontWeight: '700',
    color: '#FFFFFF',
  },
});
