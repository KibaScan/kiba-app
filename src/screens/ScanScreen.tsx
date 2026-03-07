// Kiba — Scan Screen (M1: Camera + UPC Lookup)
// D-092: Camera opens immediately. Scan-first flow.
// D-084: No emoji. Ionicons only.
// Zero scoring logic — this screen only scans and routes.
import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  Modal,
} from 'react-native';
import { CameraView, useCameraPermissions, BarcodeScanningResult } from 'expo-camera';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useIsFocused } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Colors, FontSizes, Spacing } from '../utils/constants';
import { barcodeRecognized, speciesToggle, scanError } from '../utils/haptics';
import { canScan } from '../utils/permissions';
import { Species, Product } from '../types';
import { ScanStackParamList } from '../types/navigation';
import { lookupByUpc, lookupExternalUpc } from '../services/scanner';
import { useActivePetStore } from '../stores/useActivePetStore';
import { useScanStore } from '../stores/useScanStore';
import { createPet } from '../services/petService';

type ScreenNav = NativeStackNavigationProp<ScanStackParamList, 'ScanMain'>;

export default function ScanScreen() {
  const navigation = useNavigation<ScreenNav>();
  const isFocused = useIsFocused();
  const insets = useSafeAreaInsets();
  const [permission, requestPermission] = useCameraPermissions();

  // Scan state
  const [isLocked, setIsLocked] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  // Pet profile modal state
  const [showPetModal, setShowPetModal] = useState(false);
  const [pendingProduct, setPendingProduct] = useState<Product | null>(null);
  const [petName, setPetName] = useState('');
  const [petSpecies, setPetSpecies] = useState<Species>(Species.Dog);

  // Store
  const activePetId = useActivePetStore((s) => s.activePetId);
  const pets = useActivePetStore((s) => s.pets);

  // ─── Scan Handler ──────────────────────────────────────

  const handleBarcodeScan = useCallback(
    async (result: BarcodeScanningResult) => {
      if (isLocked || isLoading) return;

      setIsLocked(true);
      setIsLoading(true);

      try {
        // D-052: Check scan limit BEFORE lookup (trigger on next attempt after limit)
        const allowed = await canScan();
        if (!allowed) {
          setIsLoading(false);
          (navigation as any).navigate('Paywall', { trigger: 'scan_limit' });
          setTimeout(() => setIsLocked(false), 500);
          return;
        }

        const lookup = await lookupByUpc(result.data);

        if (lookup.status === 'error') {
          const errorMessage =
            lookup.code === 'NETWORK_TIMEOUT'
              ? 'Connection error — check your network'
              : 'Something went wrong — try again';
          Alert.alert('Scan Error', errorMessage, [
            { text: 'OK', onPress: () => setIsLocked(false) },
          ]);
          return;
        }

        if (lookup.status === 'not_found') {
          // M3 D-091: External UPC lookup → confirm → OCR → classify
          try {
            const external = await lookupExternalUpc(result.data);

            if (external.found && external.product_name) {
              // External match — show confirmation screen
              navigation.navigate('ProductConfirm', {
                scannedUpc: result.data,
                externalName: external.product_name,
                externalBrand: external.brand,
                externalImageUrl: external.image_url,
              });
            } else {
              // No external match — skip straight to ingredient capture
              navigation.navigate('IngredientCapture', {
                scannedUpc: result.data,
                productName: null,
                brand: null,
              });
            }
          } catch {
            // External lookup failed — fall through to OCR
            navigation.navigate('IngredientCapture', {
              scannedUpc: result.data,
              productName: null,
              brand: null,
            });
          }
          return;
        }

        // Product found — cache before routing
        barcodeRecognized();
        useScanStore.getState().addToScanCache(lookup.product);
        const hasPet = pets.length > 0 && activePetId !== null;

        if (!hasPet) {
          setPendingProduct(lookup.product);
          setShowPetModal(true);
        } else {
          navigation.navigate('Result', {
            productId: lookup.product.id,
            petId: activePetId,
          });
        }
      } catch (err) {
        console.error('[ScanScreen] Unexpected error:', err);
        scanError();
        Alert.alert('Error', 'Something went wrong. Please try again.');
      } finally {
        setIsLoading(false);
        setTimeout(() => setIsLocked(false), 2000);
      }
    },
    [isLocked, isLoading, activePetId, pets, navigation],
  );

  // ─── Pet Modal Submit ──────────────────────────────────

  const [isSavingPet, setIsSavingPet] = useState(false);

  const handlePetSubmit = async () => {
    if (!petName.trim() || !pendingProduct || isSavingPet) return;

    const productId = pendingProduct.id;
    setIsSavingPet(true);
    try {
      const pet = await createPet({
        user_id: '', // Supabase RLS provides the real user_id
        name: petName.trim(),
        species: petSpecies === Species.Dog ? 'dog' : 'cat',
        breed: null,
        weight_current_lbs: null,
        weight_goal_lbs: null,
        weight_updated_at: null,
        date_of_birth: null,
        dob_is_approximate: false,
        activity_level: 'moderate',
        is_neutered: true,
        sex: null,
        photo_url: null,
        life_stage: null,
        breed_size: null,
        health_reviewed_at: null,
      });

      setShowPetModal(false);
      setPetName('');
      setPendingProduct(null);

      navigation.navigate('Result', {
        productId,
        petId: pet.id,
      });
    } catch (err) {
      console.error('[ScanScreen] Failed to create pet:', err);
      Alert.alert('Something went wrong', 'Could not save your pet. Please try again.');
    } finally {
      setIsSavingPet(false);
    }
  };

  // ─── Permission Denied View ────────────────────────────

  if (!permission) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color={Colors.accent} />
      </View>
    );
  }

  if (!permission.granted) {
    return (
      <View style={styles.centerContainer}>
        <View style={styles.permissionCard}>
          <Ionicons
            name="camera-outline"
            size={56}
            color={Colors.textTertiary}
          />
          <Text style={styles.permissionTitle}>Camera Access Required</Text>
          <Text style={styles.permissionBody}>
            Kiba needs your camera to scan pet food barcodes.
          </Text>
          <TouchableOpacity
            style={styles.permissionButton}
            onPress={requestPermission}
          >
            <Text style={styles.permissionButtonText}>Grant Camera Access</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  // ─── Camera View ───────────────────────────────────────

  return (
    <View style={styles.container}>
      {/* Live camera — only when tab is focused */}
      {isFocused && (
        <CameraView
          style={StyleSheet.absoluteFillObject}
          facing="back"
          barcodeScannerSettings={{
            barcodeTypes: ['ean13', 'upc_a', 'upc_e'],
          }}
          onBarcodeScanned={isLocked ? undefined : handleBarcodeScan}
        />
      )}

      {/* Scan reticle overlay */}
      <View style={[styles.overlay, { paddingTop: insets.top }]} pointerEvents="box-none">
        {/* Top hint */}
        <View style={styles.topHint}>
          <Text style={styles.topHintText}>Scan</Text>
        </View>

        {/* Center reticle */}
        <View style={styles.reticleContainer} pointerEvents="none">
          <View style={styles.reticle}>
            {/* Four corners */}
            <View style={[styles.corner, styles.cornerTL]} />
            <View style={[styles.corner, styles.cornerTR]} />
            <View style={[styles.corner, styles.cornerBL]} />
            <View style={[styles.corner, styles.cornerBR]} />
          </View>
        </View>

        {/* Bottom hint */}
        <View style={styles.bottomHint}>
          <View style={styles.hintRow}>
            <Ionicons
              name="barcode-outline"
              size={18}
              color={Colors.accent}
            />
            <Text style={styles.hintText}>
              Point at any pet food barcode
            </Text>
          </View>
        </View>
      </View>

      {/* Loading overlay */}
      {isLoading && (
        <View style={styles.loadingOverlay}>
          <View style={styles.loadingCard}>
            <ActivityIndicator size="large" color={Colors.accent} />
            <Text style={styles.loadingText}>Looking up product...</Text>
          </View>
        </View>
      )}

      {/* Inline pet profile modal (D-092: light capture) */}
      <Modal
        visible={showPetModal}
        animationType="slide"
        transparent
        onRequestClose={() => {
          setShowPetModal(false);
          setPendingProduct(null);
        }}
      >
        <KeyboardAvoidingView
          style={styles.modalBackdrop}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>First, tell us about your pet</Text>
            <Text style={styles.modalSubtitle}>
              We'll personalize this score just for them.
            </Text>

            {/* Species toggle — Ionicons, NOT emoji (D-084) */}
            <View style={styles.speciesToggle}>
              <TouchableOpacity
                style={[
                  styles.speciesOption,
                  petSpecies === Species.Dog && styles.speciesActive,
                ]}
                onPress={() => { speciesToggle(); setPetSpecies(Species.Dog); }}
              >
                <Ionicons
                  name="paw-outline"
                  size={28}
                  color={
                    petSpecies === Species.Dog
                      ? Colors.accent
                      : Colors.textTertiary
                  }
                />
                <Text
                  style={[
                    styles.speciesLabel,
                    petSpecies === Species.Dog && styles.speciesLabelActive,
                  ]}
                >
                  Dog
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.speciesOption,
                  petSpecies === Species.Cat && styles.speciesActive,
                ]}
                onPress={() => { speciesToggle(); setPetSpecies(Species.Cat); }}
              >
                <Ionicons
                  name="paw-outline"
                  size={28}
                  color={
                    petSpecies === Species.Cat
                      ? Colors.accent
                      : Colors.textTertiary
                  }
                />
                <Text
                  style={[
                    styles.speciesLabel,
                    petSpecies === Species.Cat && styles.speciesLabelActive,
                  ]}
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
              onSubmitEditing={handlePetSubmit}
              autoFocus
            />

            <TouchableOpacity
              style={[
                styles.modalButton,
                (!petName.trim() || isSavingPet) && styles.buttonDisabled,
              ]}
              onPress={handlePetSubmit}
              disabled={!petName.trim() || isSavingPet}
            >
              {isSavingPet ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <Text style={styles.modalButtonText}>Continue</Text>
              )}
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

// ─── Styles ──────────────────────────────────────────────

const RETICLE_SIZE = 260;
const CORNER_SIZE = 32;
const CORNER_THICKNESS = 3;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  centerContainer: {
    flex: 1,
    backgroundColor: Colors.background,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: Spacing.xl,
  },

  // ─── Permission ──────────────────────────────────────
  permissionCard: {
    alignItems: 'center',
  },
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
  permissionButton: {
    height: 52,
    paddingHorizontal: Spacing.xl,
    borderRadius: 12,
    backgroundColor: Colors.accent,
    justifyContent: 'center',
    alignItems: 'center',
  },
  permissionButtonText: {
    fontSize: FontSizes.lg,
    fontWeight: '700',
    color: '#FFFFFF',
  },

  // ─── Overlay ─────────────────────────────────────────
  overlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'space-between',
  },
  topHint: {
    alignItems: 'center',
    paddingTop: Spacing.md,
  },
  topHintText: {
    fontSize: FontSizes.xxl,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  reticleContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  reticle: {
    width: RETICLE_SIZE,
    height: RETICLE_SIZE,
  },
  corner: {
    position: 'absolute',
    width: CORNER_SIZE,
    height: CORNER_SIZE,
  },
  cornerTL: {
    top: 0,
    left: 0,
    borderTopWidth: CORNER_THICKNESS,
    borderLeftWidth: CORNER_THICKNESS,
    borderColor: '#FFFFFF',
    borderTopLeftRadius: 4,
  },
  cornerTR: {
    top: 0,
    right: 0,
    borderTopWidth: CORNER_THICKNESS,
    borderRightWidth: CORNER_THICKNESS,
    borderColor: '#FFFFFF',
    borderTopRightRadius: 4,
  },
  cornerBL: {
    bottom: 0,
    left: 0,
    borderBottomWidth: CORNER_THICKNESS,
    borderLeftWidth: CORNER_THICKNESS,
    borderColor: '#FFFFFF',
    borderBottomLeftRadius: 4,
  },
  cornerBR: {
    bottom: 0,
    right: 0,
    borderBottomWidth: CORNER_THICKNESS,
    borderRightWidth: CORNER_THICKNESS,
    borderColor: '#FFFFFF',
    borderBottomRightRadius: 4,
  },
  bottomHint: {
    alignItems: 'center',
    paddingBottom: 120, // clear tab bar + raised scan button
  },
  hintRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    backgroundColor: 'rgba(0,0,0,0.6)',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: 20,
  },
  hintText: {
    fontSize: FontSizes.sm,
    color: '#FFFFFF',
  },

  // ─── Loading ─────────────────────────────────────────
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingCard: {
    backgroundColor: Colors.card,
    borderRadius: 16,
    padding: Spacing.xl,
    alignItems: 'center',
    gap: Spacing.md,
  },
  loadingText: {
    fontSize: FontSizes.md,
    color: Colors.textSecondary,
  },

  // ─── Pet Profile Modal ───────────────────────────────
  modalBackdrop: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  modalContent: {
    backgroundColor: Colors.background,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: Spacing.xl,
    paddingTop: Spacing.xl,
    paddingBottom: Spacing.xxl,
    alignItems: 'center',
  },
  modalTitle: {
    fontSize: FontSizes.xl,
    fontWeight: '700',
    color: Colors.textPrimary,
    marginBottom: Spacing.xs,
  },
  modalSubtitle: {
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
    width: 110,
    height: 90,
    borderRadius: 16,
    backgroundColor: Colors.card,
    borderWidth: 2,
    borderColor: Colors.cardBorder,
    justifyContent: 'center',
    alignItems: 'center',
    gap: Spacing.xs,
  },
  speciesActive: {
    borderColor: Colors.accent,
    backgroundColor: '#00B4D815',
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
    marginBottom: Spacing.lg,
  },
  modalButton: {
    width: '100%',
    height: 52,
    borderRadius: 12,
    backgroundColor: Colors.accent,
    justifyContent: 'center',
    alignItems: 'center',
  },
  buttonDisabled: {
    opacity: 0.4,
  },
  modalButtonText: {
    fontSize: FontSizes.lg,
    fontWeight: '700',
    color: '#FFFFFF',
  },
});
