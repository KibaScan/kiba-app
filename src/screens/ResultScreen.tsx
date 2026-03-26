// Kiba — Result Screen
// Single scrollable screen with progressive disclosure (D-108).
// Score framing: "[X]% match for [Pet Name]" (D-094). Zero emoji (D-084).
// Wires LoadingTerminal + scoreProduct pipeline.

import React, { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  TouchableOpacity,
  Image,
  Alert,
} from 'react-native';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';

import { Colors, FontSizes, Spacing } from '../utils/constants';
import { canUseSafeSwaps, canCompare } from '../utils/permissions';
import { ScanStackParamList } from '../types/navigation';
import type { Product, PetProfile } from '../types';
import type { ScoredResult, ProductIngredient } from '../types/scoring';
import { useActivePetStore } from '../stores/useActivePetStore';
import { useScanStore } from '../stores/useScanStore';
import { supabase } from '../services/supabase';
import { getPetAllergens, getPetConditions } from '../services/petService';
import { scoreProduct } from '../services/scoring/pipeline';
import { LoadingTerminal } from '../components/ui/LoadingTerminal';
import { ScoreRing, getScoreColor, getVerdictLabel } from '../components/scoring/ScoreRing';
import { ConcernTags } from '../components/scoring/ConcernTags';
import { SeverityBadgeStrip } from '../components/scoring/SeverityBadgeStrip';
import { ScoreWaterfall } from '../components/scoring/ScoreWaterfall';
import { CollapsibleSection } from '../components/ui/CollapsibleSection';
// GATable removed — raw GA values now accessible via expand/collapse in AafcoProgressBars
import { IngredientList } from '../components/ingredients/IngredientList';
import { IngredientDetailModal } from '../components/ingredients/IngredientDetailModal';
import { BreedContraindicationCard } from '../components/pet/BreedContraindicationCard';
import { BenchmarkBar } from '../components/scoring/BenchmarkBar';
import { MetadataBadgeStrip } from '../components/ui/MetadataBadgeStrip';
import { AafcoProgressBars } from '../components/scoring/AafcoProgressBars';
import { BonusNutrientGrid } from '../components/scoring/BonusNutrientGrid';
import { PositionMap } from '../components/scoring/PositionMap';
import { SplittingDetectionCard, buildSplittingClusters } from '../components/ingredients/SplittingDetectionCard';
import { deriveBonusNutrientFlags } from '../utils/bonusNutrients';
import { FlavorDeceptionCard } from '../components/ingredients/FlavorDeceptionCard';
import { detectFlavorDeception } from '../utils/flavorDeception';
import { DcmAdvisoryCard } from '../components/ingredients/DcmAdvisoryCard';
import { NursingAdvisoryCard } from '../components/pet/NursingAdvisoryCard';
import { evaluateDcmRisk } from '../services/scoring/speciesRules';
import { FormulaChangeTimeline } from '../components/ui/FormulaChangeTimeline';
import { WhatGoodLooksLike } from '../components/scoring/WhatGoodLooksLike';
import { PetShareCard } from '../components/pet/PetShareCard';
import { captureAndShare } from '../utils/shareCard';
import PortionCard from '../components/PortionCard';
import { getAgeMonths } from '../components/PortionCard';
import TreatBatteryGauge from '../components/TreatBatteryGauge';
import { isSupplementalByName } from '../utils/supplementalClassifier';
import { AddToPantrySheet } from '../components/pantry/AddToPantrySheet';
import { checkDuplicateUpc, restockPantryItem } from '../services/pantryService';
import { calculateTreatBudget, calculateTreatsPerDay } from '../services/treatBattery';
import { lbsToKg, calculateRER, getDerMultiplier } from '../services/portionCalculator';
import { resolveCalories } from '../utils/calorieEstimation';
import { stripBrandFromName } from '../utils/formatters';
import { usePantryStore } from '../stores/usePantryStore';
import { useTreatBatteryStore } from '../stores/useTreatBatteryStore';
import type { CalorieSource } from '../utils/calorieEstimation';

// ─── Navigation Types ────────────────────────────────────

type ScreenRoute = RouteProp<ScanStackParamList, 'Result'>;
type ScreenNav = NativeStackNavigationProp<ScanStackParamList, 'Result'>;

// ─── Component ───────────────────────────────────────────

export default function ResultScreen() {
  const navigation = useNavigation<ScreenNav>();
  const route = useRoute<ScreenRoute>();
  const { productId, petId } = route.params;

  // ─── Store reads ────────────────────────────────────────
  const pets = useActivePetStore((s) => s.pets);
  const scanCache = useScanStore((s) => s.scanCache);

  const pet: PetProfile | null = petId
    ? pets.find((p) => p.id === petId) ?? null
    : null;
  const consumedTreatKcal = useTreatBatteryStore((s) =>
    petId ? (s.consumedByPet[petId]?.kcal ?? 0) : 0,
  );

  // DER computation for portion/treat advisory (D-106: display-only)
  const petDer = useMemo(() => {
    if (!pet || pet.weight_current_lbs == null) return null;
    const ageMonths = getAgeMonths(pet.date_of_birth) ?? undefined;
    const rer = calculateRER(lbsToKg(pet.weight_current_lbs));
    const { multiplier } = getDerMultiplier({
      species: pet.species,
      lifeStage: pet.life_stage,
      isNeutered: pet.is_neutered,
      activityLevel: pet.activity_level,
      ageMonths,
    });
    return Math.round(rer * multiplier);
  }, [pet]);

  // ─── State ──────────────────────────────────────────────
  const [product, setProduct] = useState<Product | null>(
    scanCache.find((p) => p.id === productId) ?? null,
  );

  const treatBudget = petDer != null ? calculateTreatBudget(petDer) : 0;
  const calorieData = product ? resolveCalories(product) : null;
  const effectiveKcalPerUnit = calorieData?.kcalPerUnit ?? null;
  const calorieSource: CalorieSource = calorieData?.source ?? null;
  const treatsPerDay =
    effectiveKcalPerUnit && treatBudget > 0
      ? calculateTreatsPerDay(treatBudget, effectiveKcalPerUnit)
      : null;

  // D-094: never display a naked score — fall back to species name
  const petName = pet?.name ?? null;
  const species: 'dog' | 'cat' =
    pet?.species === 'cat' ? 'cat' : 'dog';
  const displayName = petName ?? (species === 'dog' ? 'your dog' : 'your cat');
  const [scoredResult, setScoredResult] = useState<ScoredResult | null>(null);
  const [hydratedIngredients, setHydratedIngredients] = useState<ProductIngredient[]>([]);
  const [terminalDone, setTerminalDone] = useState(false);
  const [scoringDone, setScoringDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedIngredient, setSelectedIngredient] = useState<ProductIngredient | null>(null);
  const [pantrySheetVisible, setPantrySheetVisible] = useState(false);
  const shareCardRef = useRef<View>(null);

  const phase: 'loading' | 'ready' =
    terminalDone && scoringDone ? 'ready' : 'loading';

  // ─── Add to Pantry handler ────────────────────────────
  const handleTrackFood = useCallback(async () => {
    if (!product || !pet) return;

    if (product.target_species !== pet.species) {
      Alert.alert(
        'Species Mismatch',
        `This is a ${product.target_species} food \u2014 can't add to ${pet.name}'s pantry.`,
      );
      return;
    }

    const dupeItemId = await checkDuplicateUpc(product.id, pet.id);
    if (dupeItemId) {
      Alert.alert(
        'Already in Pantry',
        'This product is already in the pantry. Restock instead?',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Restock',
            onPress: async () => {
              try {
                await restockPantryItem(dupeItemId);
                Alert.alert('Restocked', `${product.name} has been restocked.`);
              } catch {
                Alert.alert('Error', 'Failed to restock. Please try again.');
              }
            },
          },
        ],
      );
      return;
    }

    setPantrySheetVisible(true);
  }, [product, pet]);

  // ─── Product fallback fetch ─────────────────────────────
  useEffect(() => {
    if (product) return;

    let cancelled = false;
    (async () => {
      const { data, error: fetchError } = await supabase
        .from('products')
        .select('*')
        .eq('id', productId)
        .single();

      if (cancelled) return;

      if (fetchError || !data) {
        console.error('[ResultScreen] Product fetch failed:', fetchError?.message);
        setError('Could not load product data.');
        return;
      }
      setProduct(data as Product);
    })();

    return () => { cancelled = true; };
  }, [productId]); // eslint-disable-line react-hooks/exhaustive-deps

  // ─── Scoring pipeline ──────────────────────────────────
  const scoringStarted = useRef(false);

  useEffect(() => {
    if (!product || scoringStarted.current) return;
    scoringStarted.current = true;

    (async () => {
      try {
        // D-129: fetch pet's allergens and conditions for scoring
        let petAllergens: string[] = [];
        let petConditions: string[] = [];
        if (pet?.id) {
          const [allergenRows, conditionRows] = await Promise.all([
            getPetAllergens(pet.id),
            getPetConditions(pet.id),
          ]);
          petAllergens = allergenRows.map((a) => a.allergen);
          petConditions = conditionRows.map((c) => c.condition_tag);
        }
        const { scoredResult: result, ingredients } = await scoreProduct(product, pet, petAllergens, petConditions);
        setScoredResult(result);
        setHydratedIngredients(ingredients);

        // Persist to scan_history for D-156 pantry score cascade (fire-and-forget)
        if (pet?.id && !result.bypass) {
          supabase.auth.getUser().then(({ data: userData }) => {
            console.log('[ResultScreen] scan_history insert: userId=', userData?.user?.id, 'petId=', pet.id, 'productId=', product.id);
            if (!userData?.user?.id) return;
            supabase.from('scan_history').insert({
              user_id: userData.user.id,
              pet_id: pet.id,
              product_id: product.id,
              final_score: result.finalScore,
              score_breakdown: {
                layer1: result.layer1,
                layer2: result.layer2,
                layer3: result.layer3,
                category: result.category,
                isPartialScore: result.isPartialScore,
              },
            }).then(({ error: insertErr }) => {
              if (insertErr) {
                console.warn('[ResultScreen] scan_history insert failed:', insertErr.message);
              }
            });
          });
        }
      } catch (err) {
        console.error('[ResultScreen] Scoring failed:', err);
        setError('Scoring failed. Please try again.');
      } finally {
        setScoringDone(true);
      }
    })();
  }, [product, pet]);

  // ─── Terminal complete handler ──────────────────────────
  const handleTerminalComplete = useCallback(() => {
    setTerminalDone(true);
  }, []);

  // ─── Treat logging auto-open (D-124) ─────────────────────
  const treatLoggingHandled = useRef(false);
  useEffect(() => {
    if (phase !== 'ready' || !product || !pet || treatLoggingHandled.current) return;
    const { treatLogging, setTreatLogging } = useScanStore.getState();
    if (treatLogging) {
      setTreatLogging(false);
      treatLoggingHandled.current = true;
      if (product.category === 'treat') {
        handleTrackFood();
      }
    }
  }, [phase, product, pet, handleTrackFood]);

  // ─── Error state ───────────────────────────────────────
  if (error) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} hitSlop={12}>
            <Ionicons name="arrow-back" size={24} color={Colors.textPrimary} />
          </TouchableOpacity>
        </View>
        <View style={styles.errorContainer}>
          <Ionicons name="alert-circle-outline" size={48} color={Colors.severityAmber} />
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity
            style={styles.retryButton}
            onPress={() => navigation.goBack()}
          >
            <Text style={styles.retryText}>Go back</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  // ─── Loading state ─────────────────────────────────────
  if (phase === 'loading') {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} hitSlop={12}>
            <Ionicons name="arrow-back" size={24} color={Colors.textPrimary} />
          </TouchableOpacity>
          {product && (
            <View style={styles.headerCenter}>
              <Text style={styles.productBrand} numberOfLines={1}>
                {product.brand}
              </Text>
              <Text style={styles.productName} numberOfLines={2} adjustsFontSizeToFit minimumFontScale={0.7}>
                {stripBrandFromName(product.brand, product.name)}
              </Text>
            </View>
          )}
          <View style={styles.headerSpacer} />
        </View>
        {product ? (
          <LoadingTerminal
            ingredientCount={15}
            species={species}
            petName={petName}
            proteinPct={product.ga_protein_pct}
            fatPct={product.ga_fat_pct}
            onComplete={handleTerminalComplete}
          />
        ) : (
          <View style={styles.loadingFallback}>
            <Text style={styles.loadingText}>Loading product data...</Text>
          </View>
        )}
      </SafeAreaView>
    );
  }

  // ─── Ready state (scrollable result) ───────────────────
  const score = scoredResult?.finalScore ?? 0;
  const hasNoIngredientData = scoredResult?.flags.includes('no_ingredient_data') ?? false;

  // Runtime supplemental detection — DB flag OR product name keywords
  const isSupplemental = (product?.is_supplemental ?? false) || isSupplementalByName(product?.name ?? null);

  // ─── Flags for display (below ScoreRing) ──────────────
  const displayFlags = (scoredResult?.flags ?? []).filter(
    (f) => f !== 'dcm_advisory' && f !== 'no_ingredient_data' && f !== 'preservative_type_unknown',
  );

  // ─── No ingredient data — simplified view ─────────────
  if (hasNoIngredientData) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} hitSlop={12}>
            <Ionicons name="arrow-back" size={24} color={Colors.textPrimary} />
          </TouchableOpacity>
          <View style={styles.headerCenter}>
            <Text style={styles.productBrand} numberOfLines={1}>
              {product!.brand}
            </Text>
            <Text style={styles.productName} numberOfLines={2}>
              {product!.name}
            </Text>
          </View>
          <View style={styles.headerSpacer} />
        </View>

        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {/* Recall warning (can still appear) */}
          {scoredResult?.isRecalled && (
            <View style={styles.recallBanner}>
              <Ionicons name="warning-outline" size={20} color={Colors.severityRed} />
              <Text style={styles.recallText}>
                This product has been subject to a recall
              </Text>
            </View>
          )}

          <View style={styles.noDataCard}>
            <Ionicons name="document-text-outline" size={40} color={Colors.textTertiary} />
            <Text style={styles.noDataTitle}>
              We found this product but don't have ingredient data yet
            </Text>
            <Text style={styles.noDataSubtext}>
              Ingredient data is being added to our database. Check back soon.
            </Text>
            <TouchableOpacity style={styles.contributeButton} disabled>
              <Ionicons name="camera-outline" size={18} color={Colors.textTertiary} />
              <Text style={styles.contributeText}>Contribute ingredient list</Text>
              <Text style={styles.comingSoonBadge}>Coming soon</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.bottomSpacer} />
        </ScrollView>
      </SafeAreaView>
    );
  }

  // ─── D-135: Vet diet bypass — no score, ingredients only ──
  const isVetDiet = product?.is_vet_diet === true;

  if (isVetDiet && scoredResult) {
    const fd = product ? detectFlavorDeception(product.name, hydratedIngredients) : null;
    const flavorAnnotation = fd?.detected && fd.actualPrimaryProtein && fd.namedProtein
      ? { primaryProteinName: fd.actualPrimaryProtein, namedProtein: fd.namedProtein }
      : null;

    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} hitSlop={12}>
            <Ionicons name="arrow-back" size={24} color={Colors.textPrimary} />
          </TouchableOpacity>
          <View style={styles.headerCenter}>
            <Text style={styles.productBrand} numberOfLines={1}>
              {product!.brand}
            </Text>
            <Text style={styles.productName} numberOfLines={2}>
              {product!.name}
            </Text>
          </View>
          <View style={styles.headerSpacer} />
        </View>

        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {/* Product image */}
          {product!.image_url && (
            <View style={styles.productImageContainer}>
              <Image
                source={{ uri: product!.image_url }}
                style={styles.productImage}
                resizeMode="contain"
              />
              <LinearGradient
                colors={['transparent', Colors.background]}
                style={styles.imageGradientBottom}
              />
              <LinearGradient
                colors={[Colors.background, 'transparent', 'transparent', Colors.background]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.imageGradientSides}
              />
            </View>
          )}

          {/* Vet diet badge — replaces ScoreRing (D-135) */}
          <View style={styles.vetDietBadgeContainer}>
            <View style={styles.vetDietBadge}>
              <Ionicons name="medkit-outline" size={24} color="#6366F1" />
              <Text style={styles.vetDietBadgeTitle}>Veterinary Diet</Text>
            </View>
            <Text style={styles.vetDietCopy}>
              This is a veterinary diet formulated for specific health needs.
              Ingredient details are shown below — discuss suitability with your veterinarian.
            </Text>
          </View>

          {/* Recall warning */}
          {scoredResult.isRecalled && (
            <View style={styles.recallBanner}>
              <Ionicons name="warning-outline" size={20} color={Colors.severityRed} />
              <Text style={styles.recallText}>
                This product has been subject to a recall
              </Text>
            </View>
          )}

          {/* Allergen warnings — always shown for safety (D-135) */}
          {scoredResult.layer3.allergenWarnings.length > 0 && (
            <View style={styles.recallBanner}>
              <Ionicons name="alert-circle-outline" size={20} color={Colors.severityAmber} />
              <Text style={styles.recallText}>
                Contains potential allergens for {displayName}
              </Text>
            </View>
          )}

          {/* Breed Contraindication Cards (D-112) — safety-critical, always render */}
          <BreedContraindicationCard
            contraindications={scoredResult.layer3.personalizations.filter(
              (p) => p.type === 'breed_contraindication',
            )}
          />

          {/* Severity Badge Strip */}
          {hydratedIngredients.length > 0 && (
            <SeverityBadgeStrip
              ingredients={hydratedIngredients}
              species={species}
              onIngredientPress={setSelectedIngredient}
            />
          )}

          {/* Full Ingredient List */}
          {hydratedIngredients.length > 0 && (
            <IngredientList
              ingredients={hydratedIngredients}
              species={species}
              onIngredientPress={setSelectedIngredient}
              flavorAnnotation={flavorAnnotation}
            />
          )}

          {/* Splitting Detection */}
          {hydratedIngredients.length > 0 && (
            <SplittingDetectionCard
              clusters={buildSplittingClusters(hydratedIngredients)}
            />
          )}

          {/* Flavor Deception Card */}
          {fd?.detected && fd.namedProtein && fd.actualPrimaryProtein && (
            <FlavorDeceptionCard
              namedProtein={fd.namedProtein}
              actualPrimaryProtein={fd.actualPrimaryProtein}
              actualPrimaryPosition={fd.actualPrimaryPosition}
              namedProteinPosition={fd.namedProteinPosition}
              variant={fd.variant}
            />
          )}

          {/* Formula Change Timeline */}
          {product?.formula_change_log && product.formula_change_log.length > 0 && (
            <FormulaChangeTimeline
              changes={product.formula_change_log}
              currentScore={0}
            />
          )}

          {/* Add to Pantry — vet diets are purchasable, need inventory tracking */}
          {product && pet && (
            <TouchableOpacity
              style={styles.trackButton}
              onPress={handleTrackFood}
              activeOpacity={0.7}
            >
              <Ionicons name="add-circle-outline" size={20} color={Colors.accent} />
              <Text style={[styles.trackButtonText, { color: Colors.accent }]}>
                Add to {displayName}'s Pantry
              </Text>
            </TouchableOpacity>
          )}

          <View style={styles.bottomSpacer} />
        </ScrollView>

        {/* Ingredient Detail Modal */}
        {selectedIngredient && (
          <IngredientDetailModal
            ingredient={selectedIngredient}
            species={species}
            onClose={() => setSelectedIngredient(null)}
          />
        )}

        {/* Add to Pantry sheet (M5) */}
        {product && pet && (
          <AddToPantrySheet
            product={product}
            pet={pet}
            visible={pantrySheetVisible}
            onClose={() => setPantrySheetVisible(false)}
            onAdded={() => setPantrySheetVisible(false)}
          />
        )}
      </SafeAreaView>
    );
  }

  // ─── Species mismatch bypass — wrong species, no score ──
  const isSpeciesMismatch = scoredResult?.bypass === 'species_mismatch';

  if (isSpeciesMismatch && scoredResult && product) {
    const targetSpeciesLabel = product.target_species === 'cat' ? 'cats' : 'dogs';

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
            <Text style={styles.productName} numberOfLines={2}>
              {stripBrandFromName(product.brand, product.name)}
            </Text>
          </View>
          <View style={styles.headerSpacer} />
        </View>

        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {/* Product image */}
          {product.image_url && (
            <View style={styles.productImageContainer}>
              <Image
                source={{ uri: product.image_url }}
                style={styles.productImage}
                resizeMode="contain"
              />
              <LinearGradient
                colors={['transparent', Colors.background]}
                style={styles.imageGradientBottom}
              />
              <LinearGradient
                colors={[Colors.background, 'transparent', 'transparent', Colors.background]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.imageGradientSides}
              />
            </View>
          )}

          {/* Species mismatch badge — red, replaces ScoreRing */}
          <View style={styles.speciesMismatchContainer}>
            <View style={styles.speciesMismatchBadge}>
              <Ionicons name="close-circle-outline" size={24} color="#FFFFFF" />
              <Text style={styles.speciesMismatchBadgeText}>
                For {targetSpeciesLabel} only
              </Text>
            </View>
            <Text style={styles.speciesMismatchCopy}>
              {product.name} is formulated for {targetSpeciesLabel}.
              It is not recommended for {displayName}.
            </Text>
          </View>

          {/* Recall warning */}
          {scoredResult.isRecalled && (
            <View style={styles.recallBanner}>
              <Ionicons name="warning-outline" size={20} color={Colors.severityRed} />
              <Text style={styles.recallText}>
                This product has been subject to a recall
              </Text>
            </View>
          )}

          {/* Full Ingredient List — still useful for curious owners */}
          {hydratedIngredients.length > 0 && (
            <IngredientList
              ingredients={hydratedIngredients}
              species={product.target_species === 'cat' ? 'cat' : 'dog'}
              onIngredientPress={setSelectedIngredient}
            />
          )}

          <View style={styles.bottomSpacer} />
        </ScrollView>

        {/* Ingredient Detail Modal */}
        {selectedIngredient && (
          <IngredientDetailModal
            ingredient={selectedIngredient}
            species={product.target_species === 'cat' ? 'cat' : 'dog'}
            onClose={() => setSelectedIngredient(null)}
          />
        )}
      </SafeAreaView>
    );
  }

  // ─── D-158: Recalled product bypass — no score, warning + ingredients ──
  const isRecalled = scoredResult?.bypass === 'recalled';

  // Pantry check for recalled product removal
  const recalledPantryItem = isRecalled
    ? usePantryStore.getState().items.find(
        (item) => item.product_id === productId && item.is_active,
      )
    : null;

  if (isRecalled && scoredResult && product) {
    const fd = detectFlavorDeception(product.name, hydratedIngredients);
    const flavorAnnotation = fd?.detected && fd.actualPrimaryProtein && fd.namedProtein
      ? { primaryProteinName: fd.actualPrimaryProtein, namedProtein: fd.namedProtein }
      : null;

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
            <Text style={styles.productName} numberOfLines={2}>
              {stripBrandFromName(product.brand, product.name)}
            </Text>
          </View>
          <View style={styles.headerSpacer} />
        </View>

        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {/* Product image */}
          {product.image_url && (
            <View style={styles.productImageContainer}>
              <Image
                source={{ uri: product.image_url }}
                style={styles.productImage}
                resizeMode="contain"
              />
              <LinearGradient
                colors={['transparent', Colors.background]}
                style={styles.imageGradientBottom}
              />
              <LinearGradient
                colors={[Colors.background, 'transparent', 'transparent', Colors.background]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.imageGradientSides}
              />
            </View>
          )}

          {/* Recall badge — larger/more prominent than vet diet (D-158) */}
          <View style={styles.recallBypassContainer}>
            <View style={styles.recallBypassBadge}>
              <Ionicons name="alert-circle" size={28} color="#FFFFFF" />
              <Text style={styles.recallBypassBadgeText}>Recall Alert</Text>
            </View>
            <Text style={styles.recallBypassCopy}>
              This product has been recalled by the FDA.
              Tap below for recall details.
            </Text>
          </View>

          {/* View Recall Details button */}
          <TouchableOpacity
            style={styles.recallDetailButton}
            onPress={() => navigation.navigate('RecallDetail', { productId })}
            activeOpacity={0.7}
          >
            <Ionicons name="document-text-outline" size={20} color={Colors.severityRed} />
            <Text style={styles.recallDetailButtonText}>View Recall Details</Text>
          </TouchableOpacity>

          {/* Allergen warnings — always shown for safety (D-135 pattern) */}
          {scoredResult.layer3.allergenWarnings.length > 0 && (
            <View style={styles.recallBanner}>
              <Ionicons name="alert-circle-outline" size={20} color={Colors.severityAmber} />
              <Text style={styles.recallText}>
                Contains potential allergens for {displayName}
              </Text>
            </View>
          )}

          {/* Breed Contraindication Cards — safety-critical, always render */}
          <BreedContraindicationCard
            contraindications={scoredResult.layer3.personalizations.filter(
              (p) => p.type === 'breed_contraindication',
            )}
          />

          {/* Severity Badge Strip */}
          {hydratedIngredients.length > 0 && (
            <SeverityBadgeStrip
              ingredients={hydratedIngredients}
              species={species}
              onIngredientPress={setSelectedIngredient}
            />
          )}

          {/* Full Ingredient List */}
          {hydratedIngredients.length > 0 && (
            <IngredientList
              ingredients={hydratedIngredients}
              species={species}
              onIngredientPress={setSelectedIngredient}
              flavorAnnotation={flavorAnnotation}
            />
          )}

          {/* Splitting Detection */}
          {hydratedIngredients.length > 0 && (
            <SplittingDetectionCard
              clusters={buildSplittingClusters(hydratedIngredients)}
            />
          )}

          {/* Flavor Deception Card */}
          {fd?.detected && fd.namedProtein && fd.actualPrimaryProtein && (
            <FlavorDeceptionCard
              namedProtein={fd.namedProtein}
              actualPrimaryProtein={fd.actualPrimaryProtein}
              actualPrimaryPosition={fd.actualPrimaryPosition}
              namedProteinPosition={fd.namedProteinPosition}
              variant={fd.variant}
            />
          )}

          {/* Remove from Pantry — if recalled product is in active pantry */}
          {recalledPantryItem && (
            <TouchableOpacity
              style={styles.removeFromPantryButton}
              onPress={async () => {
                await usePantryStore.getState().removeItem(recalledPantryItem.id);
                navigation.goBack();
              }}
              activeOpacity={0.7}
            >
              <Ionicons name="trash-outline" size={20} color={Colors.severityRed} />
              <Text style={styles.removeFromPantryText}>Remove from Pantry</Text>
            </TouchableOpacity>
          )}

          <View style={styles.bottomSpacer} />
        </ScrollView>

        {/* Ingredient Detail Modal */}
        {selectedIngredient && (
          <IngredientDetailModal
            ingredient={selectedIngredient}
            species={species}
            onClose={() => setSelectedIngredient(null)}
          />
        )}
      </SafeAreaView>
    );
  }

  // ─── Variety pack bypass — multi-recipe, no score ──
  const isVarietyPack = scoredResult?.bypass === 'variety_pack';

  if (isVarietyPack && scoredResult && product) {
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
            <Text style={styles.productName} numberOfLines={2}>
              {stripBrandFromName(product.brand, product.name)}
            </Text>
          </View>
          <View style={styles.headerSpacer} />
        </View>

        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {/* Product image */}
          {product.image_url && (
            <View style={styles.productImageContainer}>
              <Image
                source={{ uri: product.image_url }}
                style={styles.productImage}
                resizeMode="contain"
              />
              <LinearGradient
                colors={['transparent', Colors.background]}
                style={styles.imageGradientBottom}
              />
              <LinearGradient
                colors={[Colors.background, 'transparent', 'transparent', Colors.background]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.imageGradientSides}
              />
            </View>
          )}

          {/* Variety pack badge — amber, replaces ScoreRing */}
          <View style={styles.varietyPackContainer}>
            <View style={styles.varietyPackBadge}>
              <Ionicons name="layers-outline" size={24} color="#FFFFFF" />
              <Text style={styles.varietyPackBadgeText}>Variety Pack</Text>
            </View>
            <Text style={styles.varietyPackCopy}>
              This product contains multiple recipes.
              For accurate scoring, scan individual items from the pack.
            </Text>
          </View>

          {/* Recall warning */}
          {scoredResult.isRecalled && (
            <View style={styles.recallBanner}>
              <Ionicons name="warning-outline" size={20} color={Colors.severityRed} />
              <Text style={styles.recallText}>
                This product has been subject to a recall
              </Text>
            </View>
          )}

          {/* Add to Pantry — variety packs are purchasable, need inventory tracking */}
          {pet && (
            <TouchableOpacity
              style={styles.trackButton}
              onPress={handleTrackFood}
              activeOpacity={0.7}
            >
              <Ionicons name="add-circle-outline" size={20} color={Colors.accent} />
              <Text style={[styles.trackButtonText, { color: Colors.accent }]}>
                Add to {displayName}'s Pantry
              </Text>
            </TouchableOpacity>
          )}

          <View style={styles.bottomSpacer} />
        </ScrollView>

        {/* Add to Pantry sheet (M5) */}
        {product && pet && (
          <AddToPantrySheet
            product={product}
            pet={pet}
            visible={pantrySheetVisible}
            onClose={() => setPantrySheetVisible(false)}
            onAdded={() => setPantrySheetVisible(false)}
          />
        )}
      </SafeAreaView>
    );
  }

  // ─── Full result view ─────────────────────────────────
  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} hitSlop={12}>
          <Ionicons name="arrow-back" size={24} color={Colors.textPrimary} />
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={styles.productBrand} numberOfLines={1}>
            {product!.brand}
          </Text>
          <Text style={styles.productName} numberOfLines={2}>
            {stripBrandFromName(product!.brand, product!.name)}
          </Text>
        </View>
        <TouchableOpacity
          onPress={() => captureAndShare(shareCardRef, displayName, score)}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Ionicons name="share-outline" size={22} color={Colors.textSecondary} />
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Product image with gradient edge fade (D-093) */}
        {product!.image_url && (
          <View style={styles.productImageContainer}>
            <Image
              source={{ uri: product!.image_url }}
              style={styles.productImage}
              resizeMode="contain"
            />
            <LinearGradient
              colors={['transparent', Colors.background]}
              style={styles.imageGradientBottom}
            />
            <LinearGradient
              colors={[Colors.background, 'transparent', 'transparent', Colors.background]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.imageGradientSides}
            />
          </View>
        )}

        {/* ─── Above Fold ─────────────────────────────────── */}

        {/* Score Ring (D-094, D-136) */}
        <ScoreRing
          score={score}
          petName={displayName}
          petPhotoUri={pet?.photo_url ?? null}
          species={species}
          isPartialScore={scoredResult?.isPartialScore ?? false}
          isSupplemental={isSupplemental}
        />

        {/* Verdict text — qualitative suitability label (D-094 compliant) */}
        <Text
          style={[styles.verdictText, { color: getScoreColor(score, isSupplemental) }]}
          numberOfLines={1}
          ellipsizeMode="tail"
        >
          {getVerdictLabel(score, petName)}
        </Text>

        {/* Supplemental contextual line below score ring (D-136, D-095 compliant) */}
        {isSupplemental && (
          <Text style={styles.supplementalRingLine}>
            Best paired with a complete meal
          </Text>
        )}

        {/* Low-score feeding context (D-159) */}
        {score <= 64 && (
          <Text style={{
            fontSize: FontSizes.sm,
            color: Colors.textSecondary,
            textAlign: 'center',
            marginTop: Spacing.xs,
          }}>
            {score <= 50
              ? `Explore higher-scoring alternatives for ${displayName}`
              : 'Consider for occasional use'}
          </Text>
        )}

        {/* Metadata Badge Strip — TL;DR zone */}
        {product && scoredResult && (
          <MetadataBadgeStrip
            aafcoStatement={product.aafco_statement}
            category={scoredResult.category}
            isSupplemental={isSupplemental}
            productForm={product.product_form}
            preservativeType={product.preservative_type}
            lifeStageClaim={product.life_stage_claim}
            targetSpecies={species}
          />
        )}

        {/* Benchmark Bar (D-132) */}
        {product && (
          <BenchmarkBar
            score={score}
            category={scoredResult?.category ?? 'daily_food'}
            targetSpecies={species}
            isGrainFree={product.is_grain_free}
            isSupplemental={isSupplemental}
          />
        )}

        {/* Flag chips (non-splitting flags only) */}
        {displayFlags.filter((f) => f !== 'ingredient_splitting_detected').length > 0 && (
          <View style={styles.flagChipsRow}>
            {displayFlags
              .filter((f) => f !== 'ingredient_splitting_detected')
              .map((flag) => {
                if (flag === 'partial_ingredient_data') {
                  return (
                    <View key={flag} style={styles.flagChipMuted}>
                      <Text style={styles.flagChipMutedText}>Some ingredient data missing</Text>
                    </View>
                  );
                }
                if (flag === 'aafco_statement_not_available' || flag === 'aafco_statement_unrecognized') {
                  return null;
                }
                const label = flag.replace(/_/g, ' ').replace(/^\w/, (c) => c.toUpperCase());
                return (
                  <View key={flag} style={styles.flagChipGeneric}>
                    <Text style={styles.flagChipGenericText}>{label}</Text>
                  </View>
                );
              })}
          </View>
        )}

        {/* Concern Tags (D-107) — above fold, quick glance */}
        {hydratedIngredients.length > 0 && product && (
          <ConcernTags
            ingredients={hydratedIngredients}
            product={product}
            species={species}
            dcmFires={species === 'dog' && scoredResult?.layer2.appliedRules.some(r => r.ruleId === 'DCM_ADVISORY' && r.fired)}
          />
        )}

        {/* Severity Badge Strip (D-108) — above fold */}
        {hydratedIngredients.length > 0 && (
          <SeverityBadgeStrip
            ingredients={hydratedIngredients}
            species={species}
            onIngredientPress={setSelectedIngredient}
          />
        )}

        {/* ─── Advisories (expanded — safety-relevant) ─── */}
        {(scoredResult?.isRecalled ||
          scoredResult?.flags.includes('nursing_advisory') ||
          (scoredResult?.layer3.personalizations.some((p) => p.type === 'breed_contraindication') ?? false)) && (
          <CollapsibleSection title="Advisories" defaultExpanded>
            {scoredResult?.isRecalled && (
              <View style={styles.recallBanner}>
                <Ionicons name="warning-outline" size={20} color={Colors.severityRed} />
                <Text style={styles.recallText}>
                  This product has been subject to a recall
                </Text>
              </View>
            )}
            {scoredResult?.flags.includes('nursing_advisory') && (
              <NursingAdvisoryCard />
            )}
            {scoredResult && (
              <BreedContraindicationCard
                contraindications={scoredResult.layer3.personalizations.filter(
                  (p) => p.type === 'breed_contraindication',
                )}
              />
            )}
          </CollapsibleSection>
        )}

        {/* Safe Swap CTA (D-126: blur + lock for free users) */}
        <TouchableOpacity
          style={styles.safeSwapCard}
          activeOpacity={0.7}
          onPress={() => {
            if (!canUseSafeSwaps()) {
              (navigation as any).navigate('Paywall', {
                trigger: 'safe_swap',
                petName: displayName,
              });
            }
            // TODO: Safe Swap flow (M6+)
          }}
        >
          <View style={styles.safeSwapBlur}>
            <View style={styles.safeSwapLockOverlay}>
              <Ionicons name="lock-closed" size={20} color="#FFFFFF" />
              <Text style={styles.safeSwapLockText}>
                Discover healthier alternatives
              </Text>
            </View>
            {/* Fake blurred rows */}
            <View style={styles.safeSwapRow}>
              <View style={[styles.safeSwapDot, { backgroundColor: Colors.severityGreen }]} />
              <View style={styles.safeSwapPlaceholderBar} />
              <View style={styles.safeSwapScoreBadge} />
            </View>
            <View style={styles.safeSwapRow}>
              <View style={[styles.safeSwapDot, { backgroundColor: Colors.severityGreen }]} />
              <View style={styles.safeSwapPlaceholderBar} />
              <View style={styles.safeSwapScoreBadge} />
            </View>
          </View>
        </TouchableOpacity>

        {/* Share button */}
        <TouchableOpacity
          style={styles.shareButton}
          activeOpacity={0.7}
          onPress={() => captureAndShare(shareCardRef, displayName, score)}
        >
          <Ionicons name="share-outline" size={18} color={Colors.accent} />
          <Text style={styles.shareButtonText}>Share Result</Text>
        </TouchableOpacity>

        {/* ─── Below Fold — Collapsible Sections ─────────── */}

        {/* Score Breakdown OR Treat Battery */}
        {scoredResult?.category === 'treat' ? (
          petDer != null && (
            <CollapsibleSection title="Treat Battery">
              <TreatBatteryGauge
                treatBudgetKcal={treatBudget}
                consumedKcal={consumedTreatKcal}
                petName={displayName}
                calorieSource={calorieSource}
              />
              {treatsPerDay != null && treatsPerDay.count > 0 && (
                <Text style={styles.treatCountText}>
                  {displayName} can have {treatsPerDay.count} of these per day
                </Text>
              )}
              {treatsPerDay?.warning && (
                <Text style={styles.treatWarningText}>
                  A single treat exceeds {displayName}'s daily treat budget
                </Text>
              )}
            </CollapsibleSection>
          )
        ) : (
          <CollapsibleSection title="Score Breakdown">
            {scoredResult && (
              <ScoreWaterfall
                scoredResult={scoredResult}
                petName={displayName}
                species={species}
                category={isSupplemental ? 'supplemental' : scoredResult.category}
                ingredients={hydratedIngredients}
              />
            )}
          </CollapsibleSection>
        )}

        {/* Ingredients */}
        {hydratedIngredients.length > 0 && (
          <CollapsibleSection
            title="Ingredients"
            subtitle={`(${hydratedIngredients.length})`}
          >
            {(() => {
              const fd = product ? detectFlavorDeception(product.name, hydratedIngredients) : null;
              const annotation = fd?.detected && fd.actualPrimaryProtein && fd.namedProtein
                ? { primaryProteinName: fd.actualPrimaryProtein, namedProtein: fd.namedProtein }
                : null;
              return (
                <IngredientList
                  ingredients={hydratedIngredients}
                  species={species}
                  onIngredientPress={setSelectedIngredient}
                  flavorAnnotation={annotation}
                />
              );
            })()}
          </CollapsibleSection>
        )}

        {/* Insights */}
        <CollapsibleSection title="Insights">
          {hydratedIngredients.length > 0 && (
            <SplittingDetectionCard
              clusters={buildSplittingClusters(hydratedIngredients)}
            />
          )}
          {product && hydratedIngredients.length > 0 && (() => {
            const fd = detectFlavorDeception(product.name, hydratedIngredients);
            return fd.detected && fd.namedProtein && fd.actualPrimaryProtein ? (
              <FlavorDeceptionCard
                namedProtein={fd.namedProtein}
                actualPrimaryProtein={fd.actualPrimaryProtein}
                actualPrimaryPosition={fd.actualPrimaryPosition}
                namedProteinPosition={fd.namedProteinPosition}
                variant={fd.variant}
              />
            ) : null;
          })()}
          {scoredResult && product && species === 'dog' && (() => {
            const dcmRule = scoredResult.layer2.appliedRules.find(r => r.ruleId === 'DCM_ADVISORY');
            const mitigationRule = scoredResult.layer2.appliedRules.find(r => r.ruleId === 'TAURINE_MITIGATION');
            if (!dcmRule?.fired) return null;
            const dcmResult = evaluateDcmRisk(hydratedIngredients);
            const dcmPenalty = Math.abs(dcmRule.adjustment) - (mitigationRule?.adjustment ?? 0);
            return (
              <DcmAdvisoryCard
                dcmResult={dcmResult}
                dcmPenalty={dcmPenalty}
                petName={displayName}
              />
            );
          })()}
          {product?.formula_change_log && product.formula_change_log.length > 0 && (
            <FormulaChangeTimeline
              changes={product.formula_change_log}
              currentScore={score}
            />
          )}
          {scoredResult && (
            <WhatGoodLooksLike
              category={scoredResult.category === 'treat' ? 'treat' : 'daily_food'}
              species={species}
            />
          )}
        </CollapsibleSection>

        {/* Ingredient Composition — position map */}
        {hydratedIngredients.length > 0 && (
          <PositionMap
            ingredients={hydratedIngredients.map((ing) => ({
              canonical_name: ing.canonical_name,
              position: ing.position,
              severity: species === 'dog' ? ing.dog_base_severity : ing.cat_base_severity,
              allergenOverride: scoredResult?.layer3.allergenWarnings.some(
                (w) => w.label.includes(ing.canonical_name),
              ),
            }))}
          />
        )}

        {/* Nutritional Fit — AAFCO progress bars + bonus nutrients */}
        {scoredResult && product && (
          <AafcoProgressBars
            gaValues={{
              protein_pct: product.ga_protein_pct,
              fat_pct: product.ga_fat_pct,
              fiber_pct: product.ga_fiber_pct,
              moisture_pct: product.ga_moisture_pct,
            }}
            dmbValues={
              product.ga_moisture_pct != null && product.ga_moisture_pct > 12
                ? {
                    protein_pct: product.ga_protein_pct != null
                      ? (product.ga_protein_pct / (100 - product.ga_moisture_pct)) * 100
                      : 0,
                    fat_pct: product.ga_fat_pct != null
                      ? (product.ga_fat_pct / (100 - product.ga_moisture_pct)) * 100
                      : 0,
                    fiber_pct: product.ga_fiber_pct != null
                      ? (product.ga_fiber_pct / (100 - product.ga_moisture_pct)) * 100
                      : 0,
                  }
                : undefined
            }
            species={species}
            lifeStage={pet?.life_stage ?? null}
            category={scoredResult.category}
            petName={displayName}
            nutritionalDataSource={product.nutritional_data_source}
            isSupplemental={isSupplemental}
            carbEstimate={scoredResult.carbEstimate}
          />
        )}
        {product && hydratedIngredients.length > 0 && (
          <BonusNutrientGrid
            nutrients={{
              dha_pct: product.ga_dha_pct,
              omega3_pct: product.ga_omega3_pct,
              omega6_pct: product.ga_omega6_pct,
              taurine_pct: product.ga_taurine_pct,
              ...deriveBonusNutrientFlags(hydratedIngredients),
            }}
            species={species}
            petName={displayName}
          />
        )}

        {/* Portion advisory — daily food only (standalone, not collapsible) */}
        {scoredResult && pet && product && product.category === 'daily_food' && pet.weight_current_lbs != null && (
          <View style={styles.portionSection}>
            <PortionCard pet={pet} product={product} conditions={[]} isSupplemental={isSupplemental} />
          </View>
        )}

        {/* Compare button (D-052: premium gate) */}
        <TouchableOpacity
          style={styles.compareButton}
          activeOpacity={0.7}
          onPress={() => {
            if (!canCompare()) {
              (navigation as any).navigate('Paywall', {
                trigger: 'compare',
                petName: displayName,
              });
              return;
            }
            // TODO: Compare flow (M6+)
          }}
        >
          <Ionicons name="git-compare-outline" size={18} color={Colors.accent} />
          <Text style={styles.compareButtonText}>Compare with another product</Text>
        </TouchableOpacity>

        {/* Add to Pantry */}
        {product && pet && (
          <TouchableOpacity
            style={styles.trackButton}
            onPress={handleTrackFood}
            activeOpacity={0.7}
          >
            <Ionicons name="add-circle-outline" size={20} color={Colors.accent} />
            <Text style={[styles.trackButtonText, { color: Colors.accent }]}>
              Add to {displayName}'s Pantry
            </Text>
          </TouchableOpacity>
        )}

        <View style={styles.bottomSpacer} />
      </ScrollView>

      {/* Singleton ingredient detail modal (D-030) */}
      <IngredientDetailModal
        ingredient={selectedIngredient}
        species={species}
        onClose={() => setSelectedIngredient(null)}
      />

      {/* Add to Pantry sheet (M5) */}
      {product && pet && (
        <AddToPantrySheet
          product={product}
          pet={pet}
          visible={pantrySheetVisible}
          onClose={() => setPantrySheetVisible(false)}
          onAdded={() => setPantrySheetVisible(false)}
        />
      )}

      {/* Off-screen share card for capture */}
      <View style={styles.offScreen} pointerEvents="none">
        <PetShareCard
          ref={shareCardRef}
          petName={displayName}
          petPhoto={pet?.photo_url ?? null}
          species={species}
          productName={product ? `${product.brand} ${product.name.startsWith(product.brand) ? product.name.slice(product.brand.length).trim() : product.name}` : ''}
          score={score}
          scoreColor={getScoreColor(score, isSupplemental)}
        />
      </View>
    </SafeAreaView>
  );
}

// ─── Styles ──────────────────────────────────────────────

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
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.md,
    paddingBottom: 88,
  },

  // ─── Product Image (D-093)
  productImageContainer: {
    width: '100%',
    height: 200,
    marginBottom: Spacing.lg,
    position: 'relative',
  },
  productImage: {
    width: '100%',
    height: '100%',
  },
  imageGradientBottom: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: 60,
  },
  imageGradientSides: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },

  // ─── Verdict Text
  verdictText: {
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
    marginBottom: Spacing.md,
  },

  // ─── Recall Banner
  recallBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 59, 48, 0.12)',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: 12,
    marginBottom: Spacing.md,
    gap: 8,
  },
  recallText: {
    fontSize: FontSizes.md,
    fontWeight: '600',
    color: Colors.severityRed,
    flex: 1,
  },

  // ─── Flag Chips
  flagChipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 8,
    marginTop: Spacing.sm,
    marginBottom: Spacing.md,
  },
  flagChipMuted: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
  },
  flagChipMutedText: {
    fontSize: FontSizes.xs,
    color: Colors.textTertiary,
  },
  flagChipGeneric: {
    backgroundColor: Colors.card,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
  },
  flagChipGenericText: {
    fontSize: FontSizes.xs,
    color: Colors.textSecondary,
  },

  // ─── Supplemental Ring Line (D-136)
  supplementalRingLine: {
    fontSize: FontSizes.sm,
    color: Colors.textSecondary,
    textAlign: 'center',
    marginBottom: Spacing.sm,
  },

  // ─── Portion / Treat Section
  portionSection: {
    marginBottom: Spacing.md,
  },
  treatCountText: {
    fontSize: FontSizes.md,
    color: Colors.textPrimary,
    textAlign: 'center',
    marginTop: Spacing.sm,
  },
  treatWarningText: {
    fontSize: FontSizes.sm,
    color: Colors.severityAmber,
    textAlign: 'center',
    marginTop: Spacing.sm,
  },

  // ─── Safe Swap (D-126 blur pattern)
  safeSwapCard: {
    marginBottom: Spacing.lg,
  },
  safeSwapBlur: {
    backgroundColor: Colors.card,
    borderRadius: 12,
    padding: Spacing.md,
    overflow: 'hidden',
    opacity: 0.7,
  },
  safeSwapLockOverlay: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: Spacing.sm,
    marginBottom: Spacing.sm,
  },
  safeSwapLockText: {
    fontSize: FontSizes.md,
    fontWeight: '600',
    color: Colors.textPrimary,
  },
  safeSwapRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 6,
  },
  safeSwapDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  safeSwapPlaceholderBar: {
    flex: 1,
    height: 12,
    borderRadius: 6,
    backgroundColor: Colors.cardBorder,
  },
  safeSwapScoreBadge: {
    width: 36,
    height: 12,
    borderRadius: 6,
    backgroundColor: Colors.cardBorder,
  },

  // ─── Compare Button
  compareButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.card,
    borderRadius: 12,
    paddingVertical: 14,
    marginTop: Spacing.sm,
    gap: 8,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
  },
  compareButtonText: {
    fontSize: FontSizes.md,
    fontWeight: '600',
    color: Colors.accent,
  },

  // ─── D-135 Vet Diet Bypass
  vetDietBadgeContainer: {
    alignItems: 'center',
    paddingVertical: Spacing.lg,
    paddingHorizontal: Spacing.md,
    marginBottom: Spacing.md,
  },
  vetDietBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#EEF2FF',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    marginBottom: 12,
  },
  vetDietBadgeTitle: {
    fontSize: FontSizes.md,
    fontWeight: '600',
    color: '#6366F1',
  },
  vetDietCopy: {
    fontSize: FontSizes.md,
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
    paddingHorizontal: Spacing.md,
  },

  // ─── D-158 Recall Bypass
  recallBypassContainer: {
    alignItems: 'center',
    paddingVertical: Spacing.lg,
    paddingHorizontal: Spacing.md,
    marginBottom: Spacing.md,
  },
  recallBypassBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: Colors.severityRed,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 24,
    marginBottom: 12,
  },
  recallBypassBadgeText: {
    fontSize: FontSizes.lg,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  recallBypassCopy: {
    fontSize: FontSizes.md,
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
    paddingHorizontal: Spacing.md,
  },
  recallDetailButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255, 59, 48, 0.12)',
    borderRadius: 12,
    paddingVertical: 14,
    marginBottom: Spacing.md,
    gap: 8,
  },
  recallDetailButtonText: {
    fontSize: FontSizes.md,
    fontWeight: '600',
    color: Colors.severityRed,
  },
  removeFromPantryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.card,
    borderRadius: 12,
    paddingVertical: 14,
    marginBottom: Spacing.md,
    gap: 8,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
  },
  removeFromPantryText: {
    fontSize: FontSizes.md,
    fontWeight: '600',
    color: Colors.severityRed,
  },

  // ─── Variety Pack Bypass
  varietyPackContainer: {
    alignItems: 'center',
    paddingVertical: Spacing.lg,
    paddingHorizontal: Spacing.md,
    marginBottom: Spacing.md,
  },
  varietyPackBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: Colors.severityAmber,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    marginBottom: 12,
  },
  varietyPackBadgeText: {
    fontSize: FontSizes.md,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  varietyPackCopy: {
    fontSize: FontSizes.md,
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
    paddingHorizontal: Spacing.md,
  },

  // ─── Species Mismatch Bypass
  speciesMismatchContainer: {
    alignItems: 'center',
    paddingVertical: Spacing.lg,
    paddingHorizontal: Spacing.md,
    marginBottom: Spacing.md,
  },
  speciesMismatchBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: Colors.severityRed,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    marginBottom: 12,
  },
  speciesMismatchBadgeText: {
    fontSize: FontSizes.md,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  speciesMismatchCopy: {
    fontSize: FontSizes.md,
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
    paddingHorizontal: Spacing.md,
  },

  // ─── No Ingredient Data
  noDataCard: {
    backgroundColor: Colors.card,
    borderRadius: 12,
    padding: Spacing.lg,
    alignItems: 'center',
    gap: 12,
    marginTop: Spacing.xl,
  },
  noDataTitle: {
    fontSize: FontSizes.lg,
    fontWeight: '600',
    color: Colors.textPrimary,
    textAlign: 'center',
  },
  noDataSubtext: {
    fontSize: FontSizes.md,
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
  },
  contributeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: Colors.background,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 10,
    marginTop: 4,
    opacity: 0.5,
  },
  contributeText: {
    fontSize: FontSizes.md,
    fontWeight: '600',
    color: Colors.textTertiary,
  },

  // ─── Track Button (M5 placeholder)
  trackButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.card,
    borderRadius: 12,
    paddingVertical: 14,
    marginTop: Spacing.lg,
    gap: 8,
  },
  trackButtonText: {
    fontSize: FontSizes.md,
    fontWeight: '600',
    color: Colors.textTertiary,
  },
  comingSoonBadge: {
    fontSize: FontSizes.xs,
    color: Colors.textTertiary,
    backgroundColor: Colors.background,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
    overflow: 'hidden',
  },

  // ─── Share Button
  shareButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginBottom: Spacing.md,
  },
  shareButtonText: {
    fontSize: FontSizes.sm,
    fontWeight: '600',
    color: Colors.accent,
  },

  // ─── Off-screen Share Card
  offScreen: {
    position: 'absolute',
    left: -9999,
    top: 0,
  },

  // ─── Bottom Spacer
  bottomSpacer: {
    height: 40,
  },

  // ─── Error State
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: Spacing.xl,
    gap: 16,
  },
  errorText: {
    fontSize: FontSizes.md,
    color: Colors.textSecondary,
    textAlign: 'center',
  },
  retryButton: {
    backgroundColor: Colors.card,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 12,
    marginTop: 8,
  },
  retryText: {
    fontSize: FontSizes.md,
    fontWeight: '600',
    color: Colors.accent,
  },

  // ─── Loading Fallback
  loadingFallback: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    fontSize: FontSizes.md,
    color: Colors.textSecondary,
  },
});
