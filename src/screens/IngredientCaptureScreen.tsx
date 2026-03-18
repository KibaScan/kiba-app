// Kiba — Ingredient Capture Screen (M3 Session 4: D-091, D-128)
// Step 3 of database miss flow:
//   Camera → photograph ingredient list → OCR → parse → classify → route
// D-084: No emoji. D-094: Scores include pet name. D-127: Edge Function for Haiku.
// D-128: Haiku classifies. Supplement/grooming → store only, no score.
import React, { useState, useCallback, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  SafeAreaView,
  TouchableOpacity,
  ActivityIndicator,
  Image,
  Alert,
  ScrollView,
} from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Colors, FontSizes, Spacing } from '../utils/constants';
import { ScanStackParamList } from '../types/navigation';
import { useActivePetStore } from '../stores/useActivePetStore';
import {
  parseIngredients,
  saveCommunityProduct,
  type ParseIngredientsResult,
} from '../services/scanner';
import { barcodeRecognized, scanError } from '../utils/haptics';

type ScreenRoute = RouteProp<ScanStackParamList, 'IngredientCapture'>;
type ScreenNav = NativeStackNavigationProp<ScanStackParamList, 'IngredientCapture'>;

// ─── Classification Chip Data ─────────────────────────

const CATEGORY_OPTIONS = [
  { key: 'daily_food', label: 'Daily Food' },
  { key: 'treat', label: 'Treat' },
  { key: 'supplement', label: 'Supplement' },
  { key: 'grooming', label: 'Grooming' },
] as const;

const SPECIES_OPTIONS = [
  { key: 'dog', label: 'Dog' },
  { key: 'cat', label: 'Cat' },
  { key: 'all', label: 'Any Pet' },
] as const;

// ─── Phase Enum ───────────────────────────────────────

type Phase = 'camera' | 'preview' | 'processing' | 'classify' | 'saving';

export default function IngredientCaptureScreen() {
  const navigation = useNavigation<ScreenNav>();
  const route = useRoute<ScreenRoute>();
  const { scannedUpc, productName, brand } = route.params;

  const activePetId = useActivePetStore((s) => s.activePetId);
  const cameraRef = useRef<CameraView>(null);
  const [permission, requestPermission] = useCameraPermissions();

  // Phase management
  const [phase, setPhase] = useState<Phase>('camera');
  const [capturedUri, setCapturedUri] = useState<string | null>(null);
  const [parseResult, setParseResult] = useState<ParseIngredientsResult | null>(null);
  const [extractedText, setExtractedText] = useState('');

  // Classification state
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [selectedSpecies, setSelectedSpecies] = useState<string | null>(null);

  // ─── Take Photo ─────────────────────────────────────

  const handleCapture = useCallback(async () => {
    if (!cameraRef.current) return;

    try {
      const photo = await cameraRef.current.takePictureAsync({
        quality: 0.8,
      });

      if (!photo) {
        Alert.alert('Capture Failed', 'Could not take photo. Please try again.');
        return;
      }

      setCapturedUri(photo.uri);
      setPhase('preview');
    } catch (err) {
      console.error('[IngredientCapture] Photo error:', err);
      Alert.alert('Capture Failed', 'Could not take photo. Please try again.');
    }
  }, []);

  // ─── Process Photo ──────────────────────────────────

  const handleUsePhoto = useCallback(async () => {
    if (!capturedUri) return;

    setPhase('processing');

    try {
      // For now we use a simple approach: the user photographs the ingredient list,
      // we send it to the parse-ingredients Edge Function as raw OCR text.
      // In production this would use on-device OCR (MLKit / Google Vision).
      // For M3 MVP: prompt user to type or paste ingredient text after photo.
      // The photo serves as reference; actual parsing happens from text input.

      // Show text input for ingredient text (OCR is a future enhancement)
      setPhase('classify');
      setParseResult(null);
      // We'll let the user trigger parsing after entering text
    } catch (err) {
      console.error('[IngredientCapture] Processing error:', err);
      scanError();
      Alert.alert(
        'Processing Error',
        'We couldn\'t read that clearly. Try again with better lighting.',
        [{ text: 'OK', onPress: () => setPhase('camera') }],
      );
    }
  }, [capturedUri]);

  // ─── Parse + Classify ───────────────────────────────

  const handleParseText = useCallback(async (rawText: string) => {
    if (!rawText.trim()) {
      Alert.alert('No Text', 'Please enter the ingredient list text.');
      return;
    }

    setPhase('processing');
    setExtractedText(rawText);

    try {
      const result = await parseIngredients(rawText, productName ?? undefined, brand ?? undefined);

      if (!result) {
        Alert.alert(
          'Parsing Error',
          'This doesn\'t appear to be a pet food ingredient list. Please try again.',
          [{ text: 'OK', onPress: () => setPhase('classify') }],
        );
        return;
      }

      barcodeRecognized();
      setParseResult(result);

      // Pre-select classification based on Haiku suggestion
      if (result.category_confidence !== 'low') {
        setSelectedCategory(result.suggested_category);
      }
      if (result.suggested_species) {
        setSelectedSpecies(result.suggested_species);
      }

      setPhase('classify');
    } catch (err) {
      console.error('[IngredientCapture] Parse error:', err);
      scanError();
      Alert.alert(
        'Processing Error',
        'Something went wrong. Please try again.',
        [{ text: 'OK', onPress: () => setPhase('classify') }],
      );
    }
  }, [productName, brand]);

  // ─── Category Routing (D-128) ───────────────────────

  const handleContinue = useCallback(async () => {
    if (!selectedCategory || !selectedSpecies) {
      Alert.alert('Selection Required', 'Please select both a product type and species.');
      return;
    }

    const haikuCategory = parseResult?.suggested_category ?? selectedCategory;
    const haikuSpecies = parseResult?.suggested_species ?? selectedSpecies;
    const userCorrectedCategory = selectedCategory !== haikuCategory;
    const userCorrectedSpecies = selectedSpecies !== haikuSpecies;

    // Supplement/grooming exit paths (D-128, D-096, D-083)
    if (selectedCategory === 'supplement' || selectedCategory === 'grooming') {
      setPhase('saving');

      const result = await saveCommunityProduct({
        upc: scannedUpc,
        name: productName || 'Unknown Product',
        brand: brand || 'Unknown',
        category: selectedCategory,
        targetSpecies: selectedSpecies,
        ingredientsRaw: extractedText,
        parsedIngredients: parseResult?.ingredients ?? [],
        haikuSuggestedCategory: haikuCategory,
        haikuSuggestedSpecies: haikuSpecies,
        userCorrectedCategory,
        userCorrectedSpecies,
      });

      if (result.status === 'error') {
        Alert.alert('Save Error', 'Could not save this product. Please try again.');
        setPhase('classify');
        return;
      }

      const message = selectedCategory === 'supplement'
        ? 'We\'ve saved this supplement. Supplement scoring is coming soon!'
        : 'We\'ve saved this grooming product. Grooming analysis is coming soon!';

      Alert.alert('Product Saved', message, [
        { text: 'OK', onPress: () => navigation.popToTop() },
      ]);
      return;
    }

    // Daily food / treat → save + score
    setPhase('saving');

    const result = await saveCommunityProduct({
      upc: scannedUpc,
      name: productName || 'Unknown Product',
      brand: brand || 'Unknown',
      category: selectedCategory,
      targetSpecies: selectedSpecies,
      ingredientsRaw: extractedText,
      parsedIngredients: parseResult?.ingredients ?? [],
      haikuSuggestedCategory: haikuCategory,
      haikuSuggestedSpecies: haikuSpecies,
      userCorrectedCategory,
      userCorrectedSpecies,
    });

    if (result.status === 'error' || !result.productId) {
      Alert.alert('Save Error', 'Could not save this product. Please try again.');
      setPhase('classify');
      return;
    }

    // Navigate to ResultScreen with partial score (D-017: 78/22 reweight)
    navigation.navigate('Result', {
      productId: result.productId,
      petId: activePetId,
    });
  }, [
    selectedCategory,
    selectedSpecies,
    parseResult,
    scannedUpc,
    productName,
    brand,
    extractedText,
    activePetId,
    navigation,
  ]);

  // ─── Retake ─────────────────────────────────────────

  const handleRetake = useCallback(() => {
    setCapturedUri(null);
    setPhase('camera');
  }, []);

  // ─── Permission Check ──────────────────────────────

  if (!permission) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color={Colors.accent} />
      </View>
    );
  }

  if (!permission.granted) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} hitSlop={12}>
            <Ionicons name="arrow-back" size={24} color={Colors.textPrimary} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Ingredient Photo</Text>
          <View style={styles.headerSpacer} />
        </View>
        <View style={styles.centerContent}>
          <Ionicons name="camera-outline" size={56} color={Colors.textTertiary} />
          <Text style={styles.permissionTitle}>Camera Access Required</Text>
          <Text style={styles.permissionBody}>
            Kiba needs your camera to photograph the ingredient list.
          </Text>
          <TouchableOpacity style={styles.primaryButton} onPress={requestPermission}>
            <Text style={styles.primaryButtonText}>Grant Camera Access</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  // ─── Camera Phase ───────────────────────────────────

  if (phase === 'camera') {
    return (
      <View style={styles.cameraContainer}>
        <CameraView
          ref={cameraRef}
          style={StyleSheet.absoluteFillObject}
          facing="back"
        />

        <SafeAreaView style={styles.cameraOverlay} pointerEvents="box-none">
          <View style={styles.cameraHeader}>
            <TouchableOpacity onPress={() => navigation.goBack()} hitSlop={12}>
              <Ionicons name="arrow-back" size={24} color="#FFFFFF" />
            </TouchableOpacity>
            <Text style={styles.cameraHeaderTitle}>Photograph the ingredient list</Text>
            <View style={styles.headerSpacer} />
          </View>

          <View style={styles.cameraHint}>
            <Text style={styles.cameraHintText}>
              Turn the package to find the ingredient list, then take a clear photo.
            </Text>
          </View>

          <View style={styles.captureRow}>
            <TouchableOpacity style={styles.captureButton} onPress={handleCapture}>
              <View style={styles.captureButtonInner} />
            </TouchableOpacity>
          </View>
        </SafeAreaView>
      </View>
    );
  }

  // ─── Preview Phase ──────────────────────────────────

  if (phase === 'preview' && capturedUri) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={handleRetake} hitSlop={12}>
            <Ionicons name="arrow-back" size={24} color={Colors.textPrimary} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Review Photo</Text>
          <View style={styles.headerSpacer} />
        </View>

        <View style={styles.previewContainer}>
          <Image source={{ uri: capturedUri }} style={styles.previewImage} resizeMode="contain" />
        </View>

        <View style={styles.previewButtons}>
          <TouchableOpacity style={styles.secondaryButton} onPress={handleRetake}>
            <Ionicons name="refresh-outline" size={20} color={Colors.textPrimary} />
            <Text style={styles.secondaryButtonText}>Retake</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.primaryButton} onPress={handleUsePhoto}>
            <Ionicons name="checkmark-outline" size={20} color="#FFFFFF" />
            <Text style={styles.primaryButtonText}>Use This Photo</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  // ─── Processing Phase ───────────────────────────────

  if (phase === 'processing') {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.centerContent}>
          <ActivityIndicator size="large" color={Colors.accent} />
          <Text style={styles.processingText}>Analyzing ingredients...</Text>
        </View>
      </SafeAreaView>
    );
  }

  // ─── Saving Phase ───────────────────────────────────

  if (phase === 'saving') {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.centerContent}>
          <ActivityIndicator size="large" color={Colors.accent} />
          <Text style={styles.processingText}>Saving product...</Text>
        </View>
      </SafeAreaView>
    );
  }

  // ─── Classify Phase (text input + classification chips) ─

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} hitSlop={12}>
          <Ionicons name="arrow-back" size={24} color={Colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Add Product</Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView
        style={styles.scrollContainer}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        {/* Ingredient text input */}
        {!parseResult && (
          <IngredientTextInput
            onSubmit={handleParseText}
            capturedUri={capturedUri}
          />
        )}

        {/* Parse result summary */}
        {parseResult && (
          <View style={styles.parseResultCard}>
            <View style={styles.parseResultHeader}>
              <Ionicons name="checkmark-circle-outline" size={20} color={Colors.severityGreen} />
              <Text style={styles.parseResultTitle}>
                {parseResult.parsed_count} ingredients found
              </Text>
            </View>
            <Text style={styles.parseResultPreview} numberOfLines={3}>
              {parseResult.ingredients.slice(0, 5).join(', ')}
              {parseResult.parsed_count > 5 ? '...' : ''}
            </Text>
          </View>
        )}

        {/* Classification chips — shown after parsing */}
        {parseResult && (
          <>
            {/* Classification hint */}
            {parseResult.category_confidence !== 'low' && selectedCategory && selectedSpecies ? (
              <Text style={styles.classifyHint}>
                We think this is a {CATEGORY_OPTIONS.find((c) => c.key === selectedCategory)?.label.toLowerCase() ?? 'product'} for{' '}
                {SPECIES_OPTIONS.find((s) => s.key === selectedSpecies)?.label.toLowerCase() ?? 'pets'}.
                Tap to correct if needed.
              </Text>
            ) : (
              <Text style={styles.classifyHint}>
                Select the product type and species below.
              </Text>
            )}

            {/* Category chips */}
            <Text style={styles.chipGroupLabel}>Product Type</Text>
            <View style={styles.chipRow}>
              {CATEGORY_OPTIONS.map((opt) => (
                <TouchableOpacity
                  key={opt.key}
                  style={[
                    styles.chip,
                    selectedCategory === opt.key && styles.chipActive,
                  ]}
                  onPress={() => setSelectedCategory(opt.key)}
                >
                  <Text
                    style={[
                      styles.chipText,
                      selectedCategory === opt.key && styles.chipTextActive,
                    ]}
                  >
                    {opt.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Species chips */}
            <Text style={styles.chipGroupLabel}>Species</Text>
            <View style={styles.chipRow}>
              {SPECIES_OPTIONS.map((opt) => (
                <TouchableOpacity
                  key={opt.key}
                  style={[
                    styles.chip,
                    selectedSpecies === opt.key && styles.chipActive,
                  ]}
                  onPress={() => setSelectedSpecies(opt.key)}
                >
                  <Text
                    style={[
                      styles.chipText,
                      selectedSpecies === opt.key && styles.chipTextActive,
                    ]}
                  >
                    {opt.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Continue button */}
            <TouchableOpacity
              style={[
                styles.primaryButton,
                styles.continueButton,
                (!selectedCategory || !selectedSpecies) && styles.buttonDisabled,
              ]}
              onPress={handleContinue}
              disabled={!selectedCategory || !selectedSpecies}
            >
              <Text style={styles.primaryButtonText}>
                {selectedCategory === 'supplement' || selectedCategory === 'grooming'
                  ? 'Save Product'
                  : 'Continue to Score'}
              </Text>
            </TouchableOpacity>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

// ─── Ingredient Text Input Sub-Component ──────────────

function IngredientTextInput({
  onSubmit,
  capturedUri,
}: {
  onSubmit: (text: string) => void;
  capturedUri: string | null;
}) {
  const [text, setText] = useState('');

  return (
    <View style={styles.textInputSection}>
      {capturedUri && (
        <Image
          source={{ uri: capturedUri }}
          style={styles.thumbnailImage}
          resizeMode="cover"
        />
      )}

      <Text style={styles.textInputLabel}>
        Type or paste the ingredient list from the label:
      </Text>

      <TextInput
        style={styles.ingredientTextInput}
        placeholder="Chicken, Chicken Meal, Brown Rice, Oatmeal, Barley..."
        placeholderTextColor={Colors.textTertiary}
        value={text}
        onChangeText={setText}
        multiline
        textAlignVertical="top"
        autoCapitalize="sentences"
        autoCorrect={false}
      />

      <TouchableOpacity
        style={[styles.primaryButton, !text.trim() && styles.buttonDisabled]}
        onPress={() => onSubmit(text)}
        disabled={!text.trim()}
      >
        <Ionicons name="search-outline" size={20} color="#FFFFFF" />
        <Text style={styles.primaryButtonText}>Analyze Ingredients</Text>
      </TouchableOpacity>
    </View>
  );
}

// ─── Styles ──────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  cameraContainer: {
    flex: 1,
    backgroundColor: '#000',
  },
  centerContainer: {
    flex: 1,
    backgroundColor: Colors.background,
    justifyContent: 'center',
    alignItems: 'center',
  },
  centerContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: Spacing.xl,
  },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.md,
    paddingBottom: Spacing.sm,
  },
  headerTitle: {
    fontSize: FontSizes.lg,
    fontWeight: '600',
    color: Colors.textPrimary,
  },
  headerSpacer: {
    width: 24,
  },

  // Camera overlay
  cameraOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'space-between',
  },
  cameraHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.md,
  },
  cameraHeaderTitle: {
    fontSize: FontSizes.lg,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  cameraHint: {
    alignItems: 'center',
    paddingHorizontal: Spacing.xl,
  },
  cameraHintText: {
    fontSize: FontSizes.md,
    color: '#FFFFFF',
    textAlign: 'center',
    backgroundColor: 'rgba(0,0,0,0.6)',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: 12,
    overflow: 'hidden',
  },

  // Capture button
  captureRow: {
    alignItems: 'center',
    paddingBottom: Spacing.xxl,
  },
  captureButton: {
    width: 72,
    height: 72,
    borderRadius: 36,
    borderWidth: 4,
    borderColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  captureButtonInner: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#FFFFFF',
  },

  // Preview
  previewContainer: {
    flex: 1,
    paddingHorizontal: Spacing.md,
  },
  previewImage: {
    flex: 1,
    borderRadius: 12,
  },
  previewButtons: {
    flexDirection: 'row',
    gap: Spacing.md,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.lg,
  },

  // Permission
  permissionTitle: {
    fontSize: FontSizes.xl,
    fontWeight: '700',
    color: Colors.textPrimary,
    marginTop: Spacing.lg,
    marginBottom: Spacing.sm,
  },
  permissionBody: {
    fontSize: FontSizes.md,
    color: Colors.textSecondary,
    textAlign: 'center',
    marginBottom: Spacing.xl,
  },

  // Buttons
  primaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    height: 52,
    paddingHorizontal: Spacing.xl,
    borderRadius: 12,
    backgroundColor: Colors.accent,
    flex: 1,
  },
  primaryButtonText: {
    fontSize: FontSizes.lg,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  secondaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    height: 52,
    paddingHorizontal: Spacing.xl,
    borderRadius: 12,
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    flex: 1,
  },
  secondaryButtonText: {
    fontSize: FontSizes.lg,
    fontWeight: '600',
    color: Colors.textPrimary,
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  continueButton: {
    flex: 0,
    width: '100%',
    marginTop: Spacing.lg,
  },

  // Processing
  processingText: {
    fontSize: FontSizes.md,
    color: Colors.textSecondary,
    marginTop: Spacing.md,
  },

  // Scroll
  scrollContainer: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.md,
    paddingBottom: 88,
  },

  // Text input section
  textInputSection: {
    gap: Spacing.md,
  },
  textInputLabel: {
    fontSize: FontSizes.md,
    color: Colors.textSecondary,
  },
  thumbnailImage: {
    width: '100%',
    height: 160,
    borderRadius: 12,
    backgroundColor: Colors.card,
  },
  ingredientTextInput: {
    width: '100%',
    minHeight: 120,
    maxHeight: 200,
    backgroundColor: Colors.card,
    borderRadius: 12,
    paddingHorizontal: Spacing.md,
    paddingTop: Spacing.md,
    paddingBottom: Spacing.md,
    fontSize: FontSizes.md,
    color: Colors.textPrimary,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    lineHeight: 22,
  },

  // Parse result card
  parseResultCard: {
    backgroundColor: Colors.card,
    borderRadius: 12,
    padding: Spacing.md,
    marginBottom: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
  },
  parseResultHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    marginBottom: Spacing.xs,
  },
  parseResultTitle: {
    fontSize: FontSizes.md,
    fontWeight: '600',
    color: Colors.severityGreen,
  },
  parseResultPreview: {
    fontSize: FontSizes.sm,
    color: Colors.textSecondary,
    lineHeight: 20,
  },

  // Classification chips
  classifyHint: {
    fontSize: FontSizes.md,
    color: Colors.textSecondary,
    textAlign: 'center',
    marginBottom: Spacing.lg,
  },
  chipGroupLabel: {
    fontSize: FontSizes.sm,
    fontWeight: '600',
    color: Colors.textTertiary,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: Spacing.sm,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
    marginBottom: Spacing.lg,
  },
  chip: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: 20,
    backgroundColor: Colors.card,
    borderWidth: 1.5,
    borderColor: Colors.cardBorder,
  },
  chipActive: {
    borderColor: Colors.accent,
    backgroundColor: '#00B4D815',
  },
  chipText: {
    fontSize: FontSizes.md,
    fontWeight: '500',
    color: Colors.textSecondary,
  },
  chipTextActive: {
    color: Colors.accent,
    fontWeight: '600',
  },
});
