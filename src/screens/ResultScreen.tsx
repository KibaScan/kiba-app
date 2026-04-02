// Kiba — Result Screen
// Single scrollable screen with progressive disclosure (D-108).
// Score framing: "[X]% match for [Pet Name]" (D-094). Zero emoji (D-084).
// Wires LoadingTerminal + scoreProduct pipeline.

import React, { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import {
  View,
  Text,
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
import { styles } from './result/ResultScreenStyles';
import {
  ResultNoIngredientData,
  ResultVetDietBypass,
  ResultSpeciesMismatchBypass,
  ResultRecalledBypass,
  ResultVarietyPackBypass,
} from './result/ResultBypassViews';
import { canCompare } from '../utils/permissions';
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
import TreatBatteryGauge from '../components/TreatBatteryGauge';
import { isSupplementalByName } from '../utils/supplementalClassifier';
import { AddToPantrySheet } from '../components/pantry/AddToPantrySheet';
import { CompareProductPickerSheet } from '../components/compare/CompareProductPickerSheet';
import { HealthConditionAdvisories } from '../components/result/HealthConditionAdvisories';
import { SafeSwapSection } from '../components/result/SafeSwapSection';
import { KibaIndexSection } from '../components/result/KibaIndexSection';
import { AffiliateBuyButtons } from '../components/result/AffiliateBuyButtons';
import { checkDuplicateUpc, restockPantryItem } from '../services/pantryService';
import { calculateTreatBudget, calculateTreatsPerDay } from '../services/treatBattery';

import { resolveCalories, resolveKcalPerCup } from '../utils/calorieEstimation';
import { stripBrandFromName } from '../utils/formatters';
import { useTreatBatteryStore } from '../stores/useTreatBatteryStore';
import { computePetDer } from '../utils/pantryHelpers';
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
  // D-160: Uses computePetDer which respects weight_goal_level
  const petDer = useMemo(() => {
    if (!pet) return null;
    return computePetDer(pet, false, pet.weight_goal_level);
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

  // Calorie note for health condition advisories (joint advisory)
  const kcalNote = useMemo(() => {
    if (!product) return null;
    const cupResult = resolveKcalPerCup(product);
    if (cupResult) return `${cupResult.kcalPerCup.toLocaleString()} kcal/cup`;
    if (calorieData && calorieData.kcalPerKg > 0) return `${calorieData.kcalPerKg.toLocaleString()} kcal/kg`;
    return null;
  }, [product, calorieData]);

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
  const [comparePickerVisible, setComparePickerVisible] = useState(false);
  const [petConditions, setPetConditions] = useState<string[]>([]);
  const [petAllergenGroups, setPetAllergenGroups] = useState<string[]>([]);
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
        setPetConditions(petConditions);
        setPetAllergenGroups(petAllergens);
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
      <ResultNoIngredientData
        product={product!}
        scoredResult={scoredResult!}
        onGoBack={() => navigation.goBack()}
      />
    );
  }

  // ─── D-135: Vet diet bypass — no score, ingredients only ──
  const isVetDiet = product?.is_vet_diet === true;

  if (isVetDiet && scoredResult) {
    return (
      <ResultVetDietBypass
        product={product!}
        pet={pet}
        displayName={displayName}
        species={species}
        scoredResult={scoredResult}
        hydratedIngredients={hydratedIngredients}
        selectedIngredient={selectedIngredient}
        setSelectedIngredient={setSelectedIngredient}
        onGoBack={() => navigation.goBack()}
        onTrackFood={handleTrackFood}
        pantrySheetVisible={pantrySheetVisible}
        onClosePantrySheet={() => setPantrySheetVisible(false)}
      />
    );
  }

  // ─── Species mismatch bypass — wrong species, no score ──
  const isSpeciesMismatch = scoredResult?.bypass === 'species_mismatch';

  if (isSpeciesMismatch && scoredResult && product) {
    return (
      <ResultSpeciesMismatchBypass
        product={product}
        displayName={displayName}
        species={species}
        scoredResult={scoredResult}
        hydratedIngredients={hydratedIngredients}
        selectedIngredient={selectedIngredient}
        setSelectedIngredient={setSelectedIngredient}
        onGoBack={() => navigation.goBack()}
      />
    );
  }

  // ─── D-158: Recalled product bypass — no score, warning + ingredients ──
  const isRecalled = scoredResult?.bypass === 'recalled';

  if (isRecalled && scoredResult && product) {
    return (
      <ResultRecalledBypass
        product={product}
        pet={pet}
        displayName={displayName}
        species={species}
        scoredResult={scoredResult}
        hydratedIngredients={hydratedIngredients}
        selectedIngredient={selectedIngredient}
        setSelectedIngredient={setSelectedIngredient}
        onGoBack={() => navigation.goBack()}
        onNavigateToRecallDetail={() => navigation.navigate('RecallDetail', { productId })}
      />
    );
  }

  // ─── Variety pack bypass — multi-recipe, no score ──
  const isVarietyPack = scoredResult?.bypass === 'variety_pack';

  if (isVarietyPack && scoredResult && product) {
    return (
      <ResultVarietyPackBypass
        product={product}
        pet={pet}
        displayName={displayName}
        scoredResult={scoredResult}
        onGoBack={() => navigation.goBack()}
        onTrackFood={handleTrackFood}
        pantrySheetVisible={pantrySheetVisible}
        onClosePantrySheet={() => setPantrySheetVisible(false)}
      />
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

        {/* Health Condition Advisories (M6) */}
        {petConditions.length > 0 && scoredResult && !scoredResult.bypass && (
          <HealthConditionAdvisories
            conditions={petConditions}
            species={species}
            petName={displayName}
            personalizations={scoredResult.layer3.personalizations.filter(
              (p) => p.type === 'condition',
            )}
            finalScore={scoredResult.finalScore}
            kcalNote={kcalNote}
          />
        )}

        {/* Safe Swap Alternatives (M6) */}
        {product && (
          <SafeSwapSection
            productId={product.id}
            petId={pet?.id ?? ''}
            species={species}
            category={product.category}
            productForm={product.product_form}
            isSupplemental={product.is_supplemental}
            scannedScore={scoredResult?.finalScore ?? 0}
            petName={displayName}
            allergenGroups={petAllergenGroups}
            conditionTags={petConditions}
            petLifeStage={pet?.life_stage ?? null}
            isBypassed={!!scoredResult?.bypass}
            onSwitchTo={pet?.id ? (newProductId: string) => {
              // M7: Cross-navigate to Pantry stack → SafeSwitchSetup
              (navigation.getParent() as any)?.navigate('Pantry', {
                screen: 'SafeSwitchSetup',
                params: {
                  oldProductId: product.id,
                  newProductId,
                  petId: pet.id,
                },
              });
            } : undefined}
          />
        )}

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

        {/* Kiba Index Section (M8) */}
        {product && (
          <KibaIndexSection
            productId={product.id}
            petId={pet?.id ?? null}
            species={species}
            petName={petName}
            isBypassed={!!scoredResult?.bypass}
            onAddPet={() => (navigation.getParent() as any)?.navigate('Me', { screen: 'SpeciesSelect' })}
          />
        )}

        {/* Portion advisory — daily food only (standalone, not collapsible) */}
        {scoredResult && pet && product && product.category === 'daily_food' && pet.weight_current_lbs != null && (
          <View style={styles.portionSection}>
            <PortionCard pet={pet} product={product} conditions={petConditions} isSupplemental={isSupplemental} />
          </View>
        )}

        {/* Affiliate buy buttons (D-020, D-053) */}
        {product && (
          <AffiliateBuyButtons
            product={product}
            score={score}
            isBypassed={!!scoredResult?.bypass}
          />
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
            setComparePickerVisible(true);
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
          conditions={petConditions}
        />
      )}

      {/* Compare product picker (M6) */}
      {product && petId && (
        <CompareProductPickerSheet
          visible={comparePickerVisible}
          onClose={() => setComparePickerVisible(false)}
          onSelectProduct={(selectedProductBId) => {
            setComparePickerVisible(false);
            navigation.navigate('Compare', {
              productAId: productId,
              productBId: selectedProductBId,
              petId: petId,
            });
          }}
          productAId={productId}
          petId={petId}
          species={species}
          category={product.category === 'treat' ? 'treat' : 'daily_food'}
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

