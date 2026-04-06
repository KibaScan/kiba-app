// Kiba — Product Confirm Screen (M3 Session 4: D-091, D-128)
// Step 2 of database miss flow:
//   External UPC match → user confirms product identity → classification chips → route
// D-084: No emoji. D-094: Scores include pet name. D-127: Edge Function for Haiku.
import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  TouchableOpacity,
  TextInput,
  Image,
  ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Colors, FontSizes, Spacing } from '../utils/constants';
import { ScanStackParamList } from '../types/navigation';

type ScreenRoute = RouteProp<ScanStackParamList, 'ProductConfirm'>;
type ScreenNav = NativeStackNavigationProp<ScanStackParamList, 'ProductConfirm'>;

export default function ProductConfirmScreen() {
  const navigation = useNavigation<ScreenNav>();
  const route = useRoute<ScreenRoute>();
  const { scannedUpc, externalName, externalBrand, externalImageUrl } = route.params;

  const [manualName, setManualName] = useState('');

  // ─── Confirm Product Identity ─────────────────────────

  const handleConfirm = useCallback(() => {
    // Navigate to ingredient capture with product info pre-filled
    navigation.navigate('IngredientCapture', {
      scannedUpc,
      productName: externalName,
      brand: externalBrand,
    });
  }, [navigation, scannedUpc, externalName, externalBrand]);

  const handleReject = useCallback(() => {
    // User says wrong product — go to OCR with manual name
    navigation.navigate('IngredientCapture', {
      scannedUpc,
      productName: manualName.trim() || null,
      brand: null,
    });
  }, [navigation, scannedUpc, manualName]);

  // ─── Render ──────────────────────────────────────────

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} hitSlop={12}>
          <Ionicons name="arrow-back" size={24} color={Colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Product Lookup</Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView
        style={styles.scrollContainer}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        {/* Product card */}
        <View style={styles.productCard}>
          {externalImageUrl ? (
            <Image
              source={{ uri: externalImageUrl }}
              style={styles.productImage}
              resizeMode="contain"
            />
          ) : (
            <View style={styles.productImagePlaceholder}>
              <Ionicons name="cube-outline" size={40} color={Colors.textTertiary} />
            </View>
          )}

          <View style={styles.productInfo}>
            {externalName ? (
              <Text style={styles.productName} numberOfLines={3}>
                {externalName}
              </Text>
            ) : null}
            {externalBrand ? (
              <Text style={styles.productBrand}>{externalBrand}</Text>
            ) : null}
          </View>
        </View>

        <Text style={styles.question}>Is this the product you scanned?</Text>

        {/* Confirm / Reject buttons */}
        <View style={styles.buttonRow}>
          <TouchableOpacity
            style={styles.confirmButton}
            onPress={handleConfirm}
          >
            <Ionicons name="checkmark-outline" size={20} color="#FFFFFF" />
            <Text style={styles.confirmButtonText}>Yes, that's it</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.rejectButton}
            onPress={handleReject}
          >
            <Ionicons name="close-outline" size={20} color={Colors.textPrimary} />
            <Text style={styles.rejectButtonText}>No, wrong product</Text>
          </TouchableOpacity>
        </View>

        {/* Manual name input (shown always, used if rejected) */}
        <View style={styles.manualSection}>
          <Text style={styles.manualLabel}>
            Wrong product? Enter the name (optional):
          </Text>
          <TextInput
            style={styles.manualInput}
            placeholder="Product name"
            placeholderTextColor={Colors.textTertiary}
            value={manualName}
            onChangeText={setManualName}
            autoCapitalize="words"
            returnKeyType="done"
          />
        </View>

        {/* UPC badge */}
        <View style={styles.upcBadge}>
          <Ionicons name="barcode-outline" size={16} color={Colors.textTertiary} />
          <Text style={styles.upcText}>{scannedUpc}</Text>
        </View>
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
  scrollContainer: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.lg,
    paddingBottom: 88,
    alignItems: 'center',
  },

  // Product card
  productCard: {
    width: '100%',
    flexDirection: 'row',
    backgroundColor: Colors.cardSurface,
    borderRadius: 16,
    padding: Spacing.md,
    gap: Spacing.md,
    marginBottom: Spacing.lg,
  },
  productImage: {
    width: 80,
    height: 80,
    borderRadius: 8,
    backgroundColor: Colors.background,
  },
  productImagePlaceholder: {
    width: 80,
    height: 80,
    borderRadius: 8,
    backgroundColor: Colors.background,
    justifyContent: 'center',
    alignItems: 'center',
  },
  productInfo: {
    flex: 1,
    justifyContent: 'center',
  },
  productName: {
    fontSize: FontSizes.lg,
    fontWeight: '600',
    color: Colors.textPrimary,
    marginBottom: Spacing.xs,
  },
  productBrand: {
    fontSize: FontSizes.md,
    color: Colors.textSecondary,
  },

  question: {
    fontSize: FontSizes.xl,
    fontWeight: '700',
    color: Colors.textPrimary,
    textAlign: 'center',
    marginBottom: Spacing.lg,
  },

  // Buttons
  buttonRow: {
    width: '100%',
    gap: Spacing.sm,
    marginBottom: Spacing.lg,
  },
  confirmButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    height: 52,
    borderRadius: 12,
    backgroundColor: Colors.accent,
  },
  confirmButtonText: {
    fontSize: FontSizes.lg,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  rejectButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    height: 52,
    borderRadius: 12,
    backgroundColor: Colors.cardSurface,
    borderWidth: 1,
    borderColor: Colors.hairlineBorder,
  },
  rejectButtonText: {
    fontSize: FontSizes.lg,
    fontWeight: '600',
    color: Colors.textPrimary,
  },

  // Manual entry
  manualSection: {
    width: '100%',
    marginBottom: Spacing.lg,
  },
  manualLabel: {
    fontSize: FontSizes.sm,
    color: Colors.textSecondary,
    marginBottom: Spacing.sm,
  },
  manualInput: {
    width: '100%',
    height: 48,
    backgroundColor: Colors.cardSurface,
    borderRadius: 12,
    paddingHorizontal: Spacing.md,
    fontSize: FontSizes.md,
    color: Colors.textPrimary,
    borderWidth: 1,
    borderColor: Colors.hairlineBorder,
  },

  // UPC badge
  upcBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    backgroundColor: Colors.cardSurface,
    borderRadius: 8,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
  },
  upcText: {
    fontSize: FontSizes.sm,
    color: Colors.textTertiary,
    fontVariant: ['tabular-nums'],
  },
});
