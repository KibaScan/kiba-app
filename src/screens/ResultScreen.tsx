// Kiba — Result Screen
// Single scrollable screen with progressive disclosure (D-108).
// Score framing: "[X]% match for [Pet Name]" (D-094). Zero emoji (D-084).
// Wires LoadingTerminal + scoreProduct pipeline.

import React, { useEffect, useRef, useState, useCallback, useMemo, createRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  TouchableOpacity,
  Image,
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
import { LoadingTerminal } from '../components/LoadingTerminal';
import { ScoreRing, getScoreColor, getVerdictLabel } from '../components/ScoreRing';
import { ConcernTags } from '../components/ConcernTags';
import { SeverityBadgeStrip } from '../components/SeverityBadgeStrip';
import { ScoreWaterfall } from '../components/ScoreWaterfall';
import { GATable } from '../components/GATable';
import { IngredientList } from '../components/IngredientList';
import { IngredientDetailModal } from '../components/IngredientDetailModal';
import { BreedContraindicationCard } from '../components/BreedContraindicationCard';
import { BenchmarkBar } from '../components/BenchmarkBar';
import { AafcoProgressBars } from '../components/AafcoProgressBars';
import { BonusNutrientGrid } from '../components/BonusNutrientGrid';
import { PositionMap } from '../components/PositionMap';
import { SplittingDetectionCard, buildSplittingClusters } from '../components/SplittingDetectionCard';
import { deriveBonusNutrientFlags } from '../utils/bonusNutrients';
import { FlavorDeceptionCard } from '../components/FlavorDeceptionCard';
import { detectFlavorDeception } from '../utils/flavorDeception';
import { DcmAdvisoryCard } from '../components/DcmAdvisoryCard';
import { FormulaChangeTimeline } from '../components/FormulaChangeTimeline';
import { WhatGoodLooksLike } from '../components/WhatGoodLooksLike';
import { PetShareCard } from '../components/PetShareCard';
import { captureAndShare } from '../utils/shareCard';
import PortionCard from '../components/PortionCard';
import { getAgeMonths } from '../components/PortionCard';
import TreatBatteryGauge from '../components/TreatBatteryGauge';
import { calculateTreatBudget, calculateTreatsPerDay } from '../services/treatBattery';
import { lbsToKg, calculateRER, getDerMultiplier } from '../services/portionCalculator';

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

  const treatBudget = petDer != null ? calculateTreatBudget(petDer) : 0;
  const treatsPerDay =
    product?.kcal_per_unit && treatBudget > 0
      ? calculateTreatsPerDay(treatBudget, product.kcal_per_unit)
      : null;

  // D-094: never display a naked score — fall back to species name
  const petName = pet?.name ?? null;
  const species: 'dog' | 'cat' =
    pet?.species === 'cat' ? 'cat' : 'dog';
  const displayName = petName ?? (species === 'dog' ? 'your dog' : 'your cat');

  // ─── State ──────────────────────────────────────────────
  const [product, setProduct] = useState<Product | null>(
    scanCache.find((p) => p.id === productId) ?? null,
  );
  const [scoredResult, setScoredResult] = useState<ScoredResult | null>(null);
  const [hydratedIngredients, setHydratedIngredients] = useState<ProductIngredient[]>([]);
  const [terminalDone, setTerminalDone] = useState(false);
  const [scoringDone, setScoringDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedIngredient, setSelectedIngredient] = useState<ProductIngredient | null>(null);
  const shareCardRef = useRef<View>(null);

  const phase: 'loading' | 'ready' =
    terminalDone && scoringDone ? 'ready' : 'loading';

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
              <Text style={styles.productName} numberOfLines={1}>
                {product.name}
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

  // ─── Flags for display (below ScoreRing) ──────────────
  const displayFlags = (scoredResult?.flags ?? []).filter(
    (f) => f !== 'dcm_advisory' && f !== 'no_ingredient_data',
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
            <Text style={styles.productName} numberOfLines={1}>
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

          {/* AAFCO statement */}
          {product!.aafco_statement && (
            <Text style={styles.aafcoText}>{product!.aafco_statement}</Text>
          )}

          <View style={styles.bottomSpacer} />
        </ScrollView>
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
          <Text style={styles.productName} numberOfLines={1}>
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

        {/* Score Ring (D-094) */}
        <ScoreRing
          score={score}
          petName={displayName}
          petPhotoUri={pet?.photo_url ?? null}
          species={species}
          isPartialScore={scoredResult?.isPartialScore ?? false}
        />

        {/* Verdict text — qualitative suitability label (D-094 compliant) */}
        <Text style={[styles.verdictText, { color: getScoreColor(score) }]}>
          {getVerdictLabel(score, petName)}
        </Text>

        {/* Share button */}
        <TouchableOpacity
          style={styles.shareButton}
          activeOpacity={0.7}
          onPress={() => captureAndShare(shareCardRef, displayName, score)}
        >
          <Ionicons name="share-outline" size={18} color={Colors.accent} />
          <Text style={styles.shareButtonText}>Share Result</Text>
        </TouchableOpacity>

        {/* Benchmark Bar (D-132) */}
        {product && (
          <BenchmarkBar
            score={score}
            category={scoredResult?.category ?? 'daily_food'}
            targetSpecies={species}
            isGrainFree={product.is_grain_free}
          />
        )}

        {/* Flag chips (non-splitting flags only — splitting chip relocated below fold) */}
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
                // Generic flag
                const label = flag.replace(/_/g, ' ').replace(/^\w/, (c) => c.toUpperCase());
                return (
                  <View key={flag} style={styles.flagChipGeneric}>
                    <Text style={styles.flagChipGenericText}>{label}</Text>
                  </View>
                );
              })}
          </View>
        )}

        {/* Recall warning */}
        {scoredResult?.isRecalled && (
          <View style={styles.recallBanner}>
            <Ionicons name="warning-outline" size={20} color={Colors.severityRed} />
            <Text style={styles.recallText}>
              This product has been subject to a recall
            </Text>
          </View>
        )}

        {/* Concern Tags (D-107) */}
        {hydratedIngredients.length > 0 && product && (
          <ConcernTags
            ingredients={hydratedIngredients}
            product={product}
            species={species}
          />
        )}

        {/* Breed Contraindication Cards (D-112) */}
        {scoredResult && (
          <BreedContraindicationCard
            contraindications={scoredResult.layer3.personalizations.filter(
              (p) => p.type === 'breed_contraindication',
            )}
          />
        )}

        {/* Severity Badge Strip (D-108) */}
        {hydratedIngredients.length > 0 && (
          <SeverityBadgeStrip
            ingredients={hydratedIngredients}
            species={species}
            onIngredientPress={setSelectedIngredient}
          />
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

        {/* ─── Below Fold ─────────────────────────────────── */}

        {/* Score Waterfall (D-094) */}
        {scoredResult && (
          <ScoreWaterfall
            scoredResult={scoredResult}
            petName={displayName}
            species={species}
            category={scoredResult.category}
          />
        )}

        {/* Portion advisory — daily food (D-106: display-only, no score impact) */}
        {scoredResult && pet && product && product.category === 'daily_food' && pet.weight_current_lbs != null && (
          <View style={styles.portionSection}>
            <PortionCard pet={pet} product={product} conditions={[]} />
          </View>
        )}

        {/* Treat advisory — treat budget + per-day count */}
        {scoredResult && pet && product && product.category === 'treat' && petDer != null && (
          <View style={styles.portionSection}>
            <TreatBatteryGauge
              treatBudgetKcal={treatBudget}
              consumedKcal={0}
              petName={displayName}
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
          </View>
        )}

        {/* GA Table (D-038, D-104, D-016) */}
        {scoredResult && product && (
          <GATable
            product={product}
            scoredResult={scoredResult}
            species={species}
          />
        )}

        {/* AAFCO Progress Bars — nutritional bucket transparency */}
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
          />
        )}

        {/* Bonus Nutrient Grid — supplemental nutrient indicators */}
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

        {/* Position Map — ingredient composition strip */}
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

        {/* Splitting Detection Card — replaces old splitting chip */}
        {hydratedIngredients.length > 0 && (
          <SplittingDetectionCard
            clusters={buildSplittingClusters(hydratedIngredients)}
          />
        )}

        {/* Flavor Deception Card (D-133) */}
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

        {/* DCM Advisory Card (D-013 — dog-only, grain-free + legumes) */}
        {scoredResult && product && species === 'dog' && product.is_grain_free && (() => {
          const dcmRule = scoredResult.layer2.appliedRules.find(r => r.ruleId === 'DCM_ADVISORY');
          const mitigationRule = scoredResult.layer2.appliedRules.find(r => r.ruleId === 'TAURINE_MITIGATION');
          if (!dcmRule?.fired) return null;
          const legumesFound = hydratedIngredients
            .filter(i => i.position <= 7 && i.is_legume)
            .map(i => ({
              name: i.display_name || i.canonical_name.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' '),
              position: i.position,
            }));
          const hasTaurine = hydratedIngredients.some(i => i.canonical_name.toLowerCase().includes('taurine'));
          const hasLCarnitine = hydratedIngredients.some(i =>
            i.canonical_name.toLowerCase().includes('l-carnitine') ||
            i.canonical_name.toLowerCase().includes('l_carnitine'),
          );
          const dcmPenalty = Math.abs(dcmRule.adjustment) - (mitigationRule?.adjustment ?? 0);
          return (
            <DcmAdvisoryCard
              legumesFound={legumesFound}
              isGrainFree={product.is_grain_free}
              hasTaurine={hasTaurine}
              hasLCarnitine={hasLCarnitine}
              dcmPenalty={dcmPenalty}
              petName={displayName}
            />
          );
        })()}

        {/* Formula Change Timeline (D-044) */}
        {product?.formula_change_log && product.formula_change_log.length > 0 && (
          <FormulaChangeTimeline
            changes={product.formula_change_log}
            currentScore={score}
          />
        )}

        {/* Full Ingredient List (D-031, D-108) */}
        {hydratedIngredients.length > 0 && (() => {
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

        {/* Track this food (M5 placeholder) */}
        <TouchableOpacity style={styles.trackButton} disabled>
          <Ionicons name="add-circle-outline" size={20} color={Colors.textTertiary} />
          <Text style={styles.trackButtonText}>Track this food</Text>
          <Text style={styles.comingSoonBadge}>Coming soon</Text>
        </TouchableOpacity>

        {/* "What Good Looks Like" reference card */}
        {scoredResult && (
          <WhatGoodLooksLike
            category={scoredResult.category === 'treat' ? 'treat' : 'daily_food'}
            species={species}
          />
        )}

        {/* AAFCO statement */}
        {product!.aafco_statement && (
          <Text style={styles.aafcoText}>{product!.aafco_statement}</Text>
        )}

        <View style={styles.bottomSpacer} />
      </ScrollView>

      {/* Singleton ingredient detail modal (D-030) */}
      <IngredientDetailModal
        ingredient={selectedIngredient}
        species={species}
        onClose={() => setSelectedIngredient(null)}
      />

      {/* Off-screen share card for capture */}
      <View style={styles.offScreen} pointerEvents="none">
        <PetShareCard
          ref={shareCardRef}
          petName={displayName}
          petPhoto={pet?.photo_url ?? null}
          species={species}
          productName={product ? `${product.brand} ${product.name}` : ''}
          score={score}
          scoreColor={getScoreColor(score)}
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
    opacity: 0.5,
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

  // ─── AAFCO Statement
  aafcoText: {
    fontSize: FontSizes.xs,
    color: Colors.textTertiary,
    textAlign: 'center',
    marginTop: Spacing.lg,
    lineHeight: 16,
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
