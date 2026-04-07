// Kiba — Scan Screen (M1: Camera + UPC Lookup)
// D-092: Camera opens immediately. Scan-first flow.
// D-084: No emoji. Ionicons only.
// Zero scoring logic — this screen only scans and routes.
import React, { useState, useCallback, useEffect } from 'react';
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
import { BlurView } from 'expo-blur';
import { CameraView, useCameraPermissions, BarcodeScanningResult } from 'expo-camera';
import { useAudioPlayer } from 'expo-audio';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useIsFocused } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Colors, FontSizes, Spacing } from '../utils/constants';
import { barcodeRecognized, speciesToggle, scanError, scanWarning } from '../utils/haptics';
import { canScan } from '../utils/permissions';
import { Species, Product } from '../types';
import { ScanStackParamList } from '../types/navigation';
import { lookupByUpc, lookupExternalUpc } from '../services/scanner';
import { useActivePetStore } from '../stores/useActivePetStore';
import { useScanStore } from '../stores/useScanStore';
import { createPet } from '../services/petService';
import ScannerOverlay from '../components/ui/ScannerOverlay';

type ScreenNav = NativeStackNavigationProp<ScanStackParamList, 'ScanMain'>;

const SOUND_PREF_KEY = '@kiba_scan_sound_enabled';
// eslint-disable-next-line @typescript-eslint/no-var-requires
const scanConfirmSound = require('../../assets/sounds/scan-confirm.mp3');

export default function ScanScreen() {
  const navigation = useNavigation<ScreenNav>();
  const isFocused = useIsFocused();
  const insets = useSafeAreaInsets();
  const [permission, requestPermission] = useCameraPermissions();

  // Scan state
  const [isLocked, setIsLocked] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [overlayLocked, setOverlayLocked] = useState(false);

  // Sound
  const [soundEnabled, setSoundEnabled] = useState(true);
  const player = useAudioPlayer(scanConfirmSound);

  useEffect(() => {
    AsyncStorage.getItem(SOUND_PREF_KEY).then((val) => {
      if (val === 'false') setSoundEnabled(false);
    });
  }, []);

  const toggleSound = useCallback(async () => {
    const next = !soundEnabled;
    setSoundEnabled(next);
    await AsyncStorage.setItem(SOUND_PREF_KEY, String(next));
  }, [soundEnabled]);

  const playScanSound = useCallback(() => {
    if (!soundEnabled) return;
    try {
      player.play();
    } catch {
      // Sound playback is best-effort
    }
  }, [soundEnabled, player]);

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
          scanWarning();
          try {
            const external = await lookupExternalUpc(result.data);

            if (external.found && external.product_name) {
              navigation.navigate('ProductConfirm', {
                scannedUpc: result.data,
                externalName: external.product_name,
                externalBrand: external.brand,
                externalImageUrl: external.image_url,
              });
            } else {
              navigation.navigate('IngredientCapture', {
                scannedUpc: result.data,
                productName: null,
                brand: null,
              });
            }
          } catch {
            navigation.navigate('IngredientCapture', {
              scannedUpc: result.data,
              productName: null,
              brand: null,
            });
          }
          return;
        }

        // Product found — sensory feedback then navigate
        barcodeRecognized();
        playScanSound();
        setOverlayLocked(true);
        useScanStore.getState().addToScanCache(lookup.product);
        const hasPet = pets.length > 0 && activePetId !== null;

        // Brief delay so user sees "locked" animation
        await new Promise((r) => setTimeout(r, 200));
        setOverlayLocked(false);

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
        weight_goal_level: null,
        caloric_accumulator: null,
        accumulator_last_reset_at: null,
        accumulator_notification_sent: null,
        bcs_score: null,
        bcs_assessed_at: null,
        feeding_style: 'dry_only',
        wet_reserve_kcal: 0,
        wet_reserve_source: null,
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
        {/* Top bar: title + sound toggle */}
        <View style={styles.topBar}>
          <View style={styles.topBarSpacer} />
          <Text style={styles.topHintText}>Scan</Text>
          <TouchableOpacity
            onPress={toggleSound}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            style={styles.soundToggle}
          >
            <Ionicons
              name={soundEnabled ? 'volume-high-outline' : 'volume-mute-outline'}
              size={22}
              color="#FFFFFF"
            />
          </TouchableOpacity>
        </View>

        {/* Center reticle — animated ScannerOverlay */}
        <View style={styles.reticleContainer} pointerEvents="none">
          <ScannerOverlay locked={overlayLocked} />
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
        <BlurView intensity={40} tint="dark" style={styles.loadingOverlay}>
          <View style={styles.loadingCard}>
            <ActivityIndicator size="large" color={Colors.accent} />
            <Text style={styles.loadingText}>Looking up product...</Text>
          </View>
        </BlurView>
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
          <BlurView intensity={40} tint="dark" style={StyleSheet.absoluteFill} />
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
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: Spacing.md,
    paddingHorizontal: Spacing.lg,
  },
  topBarSpacer: {
    width: 32,
  },
  soundToggle: {
    width: 32,
    alignItems: 'center',
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
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingCard: {
    backgroundColor: Colors.cardSurface,
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
    backgroundColor: Colors.cardSurface,
    borderWidth: 2,
    borderColor: Colors.hairlineBorder,
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
    backgroundColor: Colors.cardSurface,
    borderRadius: 12,
    paddingHorizontal: Spacing.md,
    fontSize: FontSizes.lg,
    color: Colors.textPrimary,
    borderWidth: 1,
    borderColor: Colors.hairlineBorder,
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
    opacity: 0.5,
  },
  modalButtonText: {
    fontSize: FontSizes.lg,
    fontWeight: '700',
    color: '#FFFFFF',
  },
});
