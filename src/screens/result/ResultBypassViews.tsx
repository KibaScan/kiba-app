// Kiba — Result Screen Bypass Views
// Extracted from ResultScreen.tsx for modularity.
// Each bypass is a full-screen early return when the product cannot be scored normally.

import React from 'react';
import {
  View,
  Text,
  SafeAreaView,
  ScrollView,
  TouchableOpacity,
  Image,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';

import { Colors } from '../../utils/constants';
import { styles } from './ResultScreenStyles';
import type { Product, PetProfile } from '../../types';
import type { ScoredResult, ProductIngredient } from '../../types/scoring';
import { IngredientList } from '../../components/ingredients/IngredientList';
import { IngredientDetailModal } from '../../components/ingredients/IngredientDetailModal';
import { BreedContraindicationCard } from '../../components/pet/BreedContraindicationCard';
import { SeverityBadgeStrip } from '../../components/scoring/SeverityBadgeStrip';
import { SplittingDetectionCard, buildSplittingClusters } from '../../components/ingredients/SplittingDetectionCard';
import { FlavorDeceptionCard } from '../../components/ingredients/FlavorDeceptionCard';
import { detectFlavorDeception } from '../../utils/flavorDeception';
import { FormulaChangeTimeline } from '../../components/ui/FormulaChangeTimeline';
import { AddToPantrySheet } from '../../components/pantry/AddToPantrySheet';
import { stripBrandFromName } from '../../utils/formatters';
import { usePantryStore } from '../../stores/usePantryStore';

// ─── Shared Props ──────────────────────────────────────────

interface BypassViewProps {
  product: Product;
  pet: PetProfile | null;
  displayName: string;
  species: 'dog' | 'cat';
  scoredResult: ScoredResult;
  hydratedIngredients: ProductIngredient[];
  selectedIngredient: ProductIngredient | null;
  setSelectedIngredient: (ing: ProductIngredient | null) => void;
  onGoBack: () => void;
  onTrackFood: () => void;
  pantrySheetVisible: boolean;
  onClosePantrySheet: () => void;
}

// ─── Shared: Header ─────────────────────────────────────────

function BypassHeader({ product, onGoBack }: { product: Product; onGoBack: () => void }) {
  return (
    <View style={styles.header}>
      <TouchableOpacity onPress={onGoBack} hitSlop={12}>
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
  );
}

// ─── Shared: Product Image ──────────────────────────────────

function ProductImage({ imageUrl }: { imageUrl: string | null }) {
  if (!imageUrl) return null;
  return (
    <View style={styles.productImageContainer}>
      <Image
        source={{ uri: imageUrl }}
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
  );
}

// ─── Shared: Recall Warning Banner ──────────────────────────

function RecallWarning({ isRecalled }: { isRecalled?: boolean }) {
  if (!isRecalled) return null;
  return (
    <View style={styles.recallBanner}>
      <Ionicons name="warning-outline" size={20} color={Colors.severityRed} />
      <Text style={styles.recallText}>
        This product has been subject to a recall
      </Text>
    </View>
  );
}

// ─── 1. No Ingredient Data ─────────────────────────────────

export function ResultNoIngredientData({
  product, scoredResult, onGoBack,
}: Pick<BypassViewProps, 'product' | 'scoredResult' | 'onGoBack'>) {
  return (
    <SafeAreaView style={styles.container}>
      <BypassHeader product={product} onGoBack={onGoBack} />
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <RecallWarning isRecalled={scoredResult.isRecalled} />
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

// ─── 2. Vet Diet Bypass (D-135) ────────────────────────────

export function ResultVetDietBypass({
  product, pet, displayName, species, scoredResult, hydratedIngredients,
  selectedIngredient, setSelectedIngredient, onGoBack, onTrackFood,
  pantrySheetVisible, onClosePantrySheet,
}: BypassViewProps) {
  const fd = detectFlavorDeception(product.name, hydratedIngredients);
  const flavorAnnotation = fd?.detected && fd.actualPrimaryProtein && fd.namedProtein
    ? { primaryProteinName: fd.actualPrimaryProtein, namedProtein: fd.namedProtein }
    : null;

  return (
    <SafeAreaView style={styles.container}>
      <BypassHeader product={product} onGoBack={onGoBack} />
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <ProductImage imageUrl={product.image_url} />

        {/* Vet diet badge — replaces ScoreRing (D-135) */}
        <View style={styles.vetDietBadgeContainer}>
          <View style={styles.vetDietBadge}>
            <Ionicons name="medkit-outline" size={24} color="#6366F1" />
            <Text style={styles.vetDietBadgeTitle}>Veterinary Diet</Text>
          </View>
          <Text style={styles.vetDietCopy}>
            This is a veterinary diet formulated for specific health needs.
            Discuss suitability with your veterinarian.
          </Text>
        </View>

        <RecallWarning isRecalled={scoredResult.isRecalled} />

        {/* Allergen warnings — always shown for safety (D-135) */}
        {scoredResult.layer3.allergenWarnings.length > 0 && (
          <View style={styles.recallBanner}>
            <Ionicons name="alert-circle-outline" size={20} color={Colors.severityAmber} />
            <Text style={styles.recallText}>
              Contains potential allergens for {displayName}
            </Text>
          </View>
        )}

        <BreedContraindicationCard
          contraindications={scoredResult.layer3.personalizations.filter(
            (p) => p.type === 'breed_contraindication',
          )}
        />

        {hydratedIngredients.length > 0 && (
          <SeverityBadgeStrip
            ingredients={hydratedIngredients}
            species={species}
            onIngredientPress={setSelectedIngredient}
          />
        )}

        {hydratedIngredients.length > 0 && (
          <IngredientList
            ingredients={hydratedIngredients}
            species={species}
            onIngredientPress={setSelectedIngredient}
            flavorAnnotation={flavorAnnotation}
          />
        )}

        {hydratedIngredients.length > 0 && (
          <SplittingDetectionCard
            clusters={buildSplittingClusters(hydratedIngredients)}
          />
        )}

        {fd?.detected && fd.namedProtein && fd.actualPrimaryProtein && (
          <FlavorDeceptionCard
            namedProtein={fd.namedProtein}
            actualPrimaryProtein={fd.actualPrimaryProtein}
            actualPrimaryPosition={fd.actualPrimaryPosition}
            namedProteinPosition={fd.namedProteinPosition}
            variant={fd.variant}
          />
        )}

        {product.formula_change_log && product.formula_change_log.length > 0 && (
          <FormulaChangeTimeline
            changes={product.formula_change_log}
            currentScore={0}
          />
        )}

        {pet && (
          <TouchableOpacity
            style={styles.trackButton}
            onPress={onTrackFood}
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

      {selectedIngredient && (
        <IngredientDetailModal
          ingredient={selectedIngredient}
          species={species}
          onClose={() => setSelectedIngredient(null)}
        />
      )}

      {product && pet && (
        <AddToPantrySheet
          product={product}
          pet={pet}
          visible={pantrySheetVisible}
          onClose={onClosePantrySheet}
          onAdded={onClosePantrySheet}
        />
      )}
    </SafeAreaView>
  );
}

// ─── 3. Species Mismatch Bypass (D-144) ────────────────────

export function ResultSpeciesMismatchBypass({
  product, displayName, species, scoredResult, hydratedIngredients,
  selectedIngredient, setSelectedIngredient, onGoBack,
}: Pick<BypassViewProps, 'product' | 'displayName' | 'species' | 'scoredResult' | 'hydratedIngredients' | 'selectedIngredient' | 'setSelectedIngredient' | 'onGoBack'>) {
  const targetSpeciesLabel = product.target_species === 'cat' ? 'cats' : 'dogs';
  const ingredientSpecies: 'dog' | 'cat' = product.target_species === 'cat' ? 'cat' : 'dog';

  return (
    <SafeAreaView style={styles.container}>
      <BypassHeader product={product} onGoBack={onGoBack} />
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <ProductImage imageUrl={product.image_url} />

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

        <RecallWarning isRecalled={scoredResult.isRecalled} />

        {hydratedIngredients.length > 0 && (
          <IngredientList
            ingredients={hydratedIngredients}
            species={ingredientSpecies}
            onIngredientPress={setSelectedIngredient}
          />
        )}

        <View style={styles.bottomSpacer} />
      </ScrollView>

      {selectedIngredient && (
        <IngredientDetailModal
          ingredient={selectedIngredient}
          species={ingredientSpecies}
          onClose={() => setSelectedIngredient(null)}
        />
      )}
    </SafeAreaView>
  );
}

// ─── 4. Recalled Product Bypass (D-158) ────────────────────

export function ResultRecalledBypass({
  product, pet, displayName, species, scoredResult, hydratedIngredients,
  selectedIngredient, setSelectedIngredient, onGoBack,
  onNavigateToRecallDetail,
}: Pick<BypassViewProps, 'product' | 'pet' | 'displayName' | 'species' | 'scoredResult' | 'hydratedIngredients' | 'selectedIngredient' | 'setSelectedIngredient' | 'onGoBack'> & {
  onNavigateToRecallDetail: () => void;
}) {
  const fd = detectFlavorDeception(product.name, hydratedIngredients);
  const flavorAnnotation = fd?.detected && fd.actualPrimaryProtein && fd.namedProtein
    ? { primaryProteinName: fd.actualPrimaryProtein, namedProtein: fd.namedProtein }
    : null;

  const recalledPantryItem = usePantryStore.getState().items.find(
    (item) => item.product_id === product.id && item.is_active,
  );

  return (
    <SafeAreaView style={styles.container}>
      <BypassHeader product={product} onGoBack={onGoBack} />
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <ProductImage imageUrl={product.image_url} />

        {/* Recall badge — larger/more prominent (D-158) */}
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

        <TouchableOpacity
          style={styles.recallDetailButton}
          onPress={onNavigateToRecallDetail}
          activeOpacity={0.7}
        >
          <Ionicons name="document-text-outline" size={20} color={Colors.severityRed} />
          <Text style={styles.recallDetailButtonText}>View Recall Details</Text>
        </TouchableOpacity>

        {scoredResult.layer3.allergenWarnings.length > 0 && (
          <View style={styles.recallBanner}>
            <Ionicons name="alert-circle-outline" size={20} color={Colors.severityAmber} />
            <Text style={styles.recallText}>
              Contains potential allergens for {displayName}
            </Text>
          </View>
        )}

        <BreedContraindicationCard
          contraindications={scoredResult.layer3.personalizations.filter(
            (p) => p.type === 'breed_contraindication',
          )}
        />

        {hydratedIngredients.length > 0 && (
          <SeverityBadgeStrip
            ingredients={hydratedIngredients}
            species={species}
            onIngredientPress={setSelectedIngredient}
          />
        )}

        {hydratedIngredients.length > 0 && (
          <IngredientList
            ingredients={hydratedIngredients}
            species={species}
            onIngredientPress={setSelectedIngredient}
            flavorAnnotation={flavorAnnotation}
          />
        )}

        {hydratedIngredients.length > 0 && (
          <SplittingDetectionCard
            clusters={buildSplittingClusters(hydratedIngredients)}
          />
        )}

        {fd?.detected && fd.namedProtein && fd.actualPrimaryProtein && (
          <FlavorDeceptionCard
            namedProtein={fd.namedProtein}
            actualPrimaryProtein={fd.actualPrimaryProtein}
            actualPrimaryPosition={fd.actualPrimaryPosition}
            namedProteinPosition={fd.namedProteinPosition}
            variant={fd.variant}
          />
        )}

        {recalledPantryItem && (
          <TouchableOpacity
            style={styles.removeFromPantryButton}
            onPress={async () => {
              await usePantryStore.getState().removeItem(recalledPantryItem.id);
              onGoBack();
            }}
            activeOpacity={0.7}
          >
            <Ionicons name="trash-outline" size={20} color={Colors.severityRed} />
            <Text style={styles.removeFromPantryText}>Remove from Pantry</Text>
          </TouchableOpacity>
        )}

        <View style={styles.bottomSpacer} />
      </ScrollView>

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

// ─── 5. Variety Pack Bypass (D-145) ────────────────────────

export function ResultVarietyPackBypass({
  product, pet, displayName, scoredResult, onGoBack, onTrackFood,
  pantrySheetVisible, onClosePantrySheet,
}: Pick<BypassViewProps, 'product' | 'pet' | 'displayName' | 'scoredResult' | 'onGoBack' | 'onTrackFood' | 'pantrySheetVisible' | 'onClosePantrySheet'>) {
  return (
    <SafeAreaView style={styles.container}>
      <BypassHeader product={product} onGoBack={onGoBack} />
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <ProductImage imageUrl={product.image_url} />

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

        <RecallWarning isRecalled={scoredResult.isRecalled} />

        {pet && (
          <TouchableOpacity
            style={styles.trackButton}
            onPress={onTrackFood}
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

      {product && pet && (
        <AddToPantrySheet
          product={product}
          pet={pet}
          visible={pantrySheetVisible}
          onClose={onClosePantrySheet}
          onAdded={onClosePantrySheet}
        />
      )}
    </SafeAreaView>
  );
}
