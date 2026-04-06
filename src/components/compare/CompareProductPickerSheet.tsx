// M6 CompareProductPickerSheet — Bottom sheet for selecting Product B.
// Used in both ResultScreen (initial pick) and CompareScreen (swap).
// Includes search, recent scans (category-filtered), and scan-to-compare camera.

import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  FlatList,
  TouchableOpacity,
  Modal,
  StyleSheet,
  Alert,
  Image,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { Colors, FontSizes, Spacing } from '../../utils/constants';
import { searchProducts, ProductSearchResult } from '../../services/topMatches';
import { getRecentScans } from '../../services/scanHistoryService';
import { lookupByUpc } from '../../services/scanner';
import type { ScanHistoryItem } from '../../types/scanHistory';

// ─── Types ──────────────────────────────────────────────

interface Props {
  visible: boolean;
  onClose: () => void;
  onSelectProduct: (productId: string) => void;
  productAId: string;
  petId: string;
  species: 'dog' | 'cat';
  category: 'daily_food' | 'treat';
}

interface ListItem {
  id: string;
  productId: string;
  name: string;
  brand: string;
  imageUrl: string | null;
  type: 'recent' | 'search';
}

const { height: SCREEN_HEIGHT } = Dimensions.get('window');
const SHEET_HEIGHT = SCREEN_HEIGHT * 0.75;

// ─── Component ──────────────────────────────────────────

export function CompareProductPickerSheet({
  visible,
  onClose,
  onSelectProduct,
  productAId,
  petId,
  species,
  category,
}: Props) {
  // ─── State ────────────────────────────────────────────
  const [query, setQuery] = useState('');
  const [searchResults, setSearchResults] = useState<ProductSearchResult[]>([]);
  const [recentScans, setRecentScans] = useState<ScanHistoryItem[]>([]);
  const [searching, setSearching] = useState(false);
  const [cameraOpen, setCameraOpen] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [permission, requestPermission] = useCameraPermissions();
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const scannedRef = useRef(false);

  // ─── Load recent scans on mount ───────────────────────
  useEffect(() => {
    if (!visible) return;
    setQuery('');
    setSearchResults([]);
    scannedRef.current = false;

    (async () => {
      try {
        const scans = await getRecentScans(petId, 10);
        // Filter to same category and exclude Product A
        const filtered = scans.filter(
          (s) => s.product.category === category && s.product_id !== productAId,
        );
        setRecentScans(filtered.slice(0, 5));
      } catch {
        setRecentScans([]);
      }
    })();
  }, [visible, petId, category, productAId]);

  // ─── Debounced search ─────────────────────────────────
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);

    if (!query.trim()) {
      setSearchResults([]);
      setSearching(false);
      return;
    }

    setSearching(true);
    debounceRef.current = setTimeout(async () => {
      try {
        const results = await searchProducts(query, species, { category });
        // Exclude Product A
        setSearchResults(results.filter((r) => r.product_id !== productAId));
      } catch {
        setSearchResults([]);
      } finally {
        setSearching(false);
      }
    }, 300);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query, species, category, productAId]);

  // ─── Camera handling ──────────────────────────────────
  const handleOpenCamera = useCallback(async () => {
    if (!permission?.granted) {
      const result = await requestPermission();
      if (!result.granted) {
        Alert.alert('Camera Permission', 'Camera access is needed to scan barcodes.');
        return;
      }
    }
    scannedRef.current = false;
    setCameraOpen(true);
  }, [permission, requestPermission]);

  const handleBarcodeScanned = useCallback(async ({ data }: { data: string }) => {
    if (scannedRef.current || scanning) return;
    scannedRef.current = true;
    setScanning(true);

    try {
      const result = await lookupByUpc(data);

      if (result.status === 'found') {
        const scannedProduct = result.product;
        const scannedCategory = scannedProduct.category === 'treat' ? 'treat' : 'daily_food';

        // Category guard
        if (scannedCategory !== category) {
          const categoryLabel = category === 'treat' ? 'treats' : 'daily foods';
          Alert.alert(
            'Category Mismatch',
            `This is a ${scannedCategory === 'treat' ? 'treat' : 'daily food'} — you're comparing ${categoryLabel}.`,
          );
          scannedRef.current = false;
          setScanning(false);
          return;
        }

        // Same product guard
        if (scannedProduct.id === productAId) {
          Alert.alert('Same Product', "You scanned the same product you're already comparing.");
          scannedRef.current = false;
          setScanning(false);
          return;
        }

        setCameraOpen(false);
        setScanning(false);
        onSelectProduct(scannedProduct.id);
      } else {
        Alert.alert('Not Found', 'This product is not in our database yet.');
        scannedRef.current = false;
        setScanning(false);
      }
    } catch {
      Alert.alert('Error', 'Could not look up this barcode. Try again.');
      scannedRef.current = false;
      setScanning(false);
    }
  }, [scanning, category, productAId, onSelectProduct]);

  // ─── List data ────────────────────────────────────────
  const hasQuery = query.trim().length > 0;

  const listData: ListItem[] = hasQuery
    ? searchResults.map((r) => ({
        id: r.product_id,
        productId: r.product_id,
        name: r.product_name,
        brand: r.brand,
        imageUrl: r.image_url,
        type: 'search' as const,
      }))
    : recentScans.map((s) => ({
        id: s.product_id,
        productId: s.product_id,
        name: s.product.name,
        brand: s.product.brand,
        imageUrl: s.product.image_url,
        type: 'recent' as const,
      }));

  // ─── Render ───────────────────────────────────────────
  return (
    <>
      <Modal
        visible={visible}
        animationType="slide"
        transparent
        onRequestClose={onClose}
      >
        <TouchableOpacity
          style={ss.backdrop}
          activeOpacity={1}
          onPress={onClose}
        />
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={ss.sheetContainer}
        >
          <View style={[ss.sheet, { height: SHEET_HEIGHT }]}>
            {/* Drag handle */}
            <View style={ss.handleBar} />

            {/* Header */}
            <View style={ss.sheetHeader}>
              <Text style={ss.sheetTitle}>Swap Product</Text>
              <TouchableOpacity
                onPress={handleOpenCamera}
                hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                style={ss.cameraButton}
              >
                <Ionicons name="camera-outline" size={24} color={Colors.accent} />
              </TouchableOpacity>
            </View>

            {/* Search */}
            <View style={ss.searchContainer}>
              <Ionicons name="search" size={18} color={Colors.textTertiary} style={ss.searchIcon} />
              <TextInput
                style={ss.searchInput}
                placeholder="Search products..."
                placeholderTextColor={Colors.textTertiary}
                value={query}
                onChangeText={setQuery}
                autoCorrect={false}
                autoCapitalize="none"
                returnKeyType="search"
              />
              {query.length > 0 && (
                <TouchableOpacity onPress={() => setQuery('')}>
                  <Ionicons name="close-circle" size={18} color={Colors.textTertiary} />
                </TouchableOpacity>
              )}
            </View>

            {/* Section label */}
            <Text style={ss.sectionLabel}>
              {hasQuery ? 'SEARCH RESULTS' : 'RECENT SCANS'}
            </Text>

            {/* List */}
            {searching ? (
              <View style={ss.spinnerContainer}>
                <ActivityIndicator size="small" color={Colors.accent} />
              </View>
            ) : listData.length === 0 ? (
              <View style={ss.emptyContainer}>
                <Text style={ss.emptyText}>
                  {hasQuery ? 'No products found' : 'No recent scans'}
                </Text>
              </View>
            ) : (
              <FlatList
                data={listData}
                keyExtractor={(item) => item.id}
                renderItem={({ item }) => (
                  <TouchableOpacity
                    style={ss.resultRow}
                    onPress={() => onSelectProduct(item.productId)}
                    activeOpacity={0.7}
                  >
                    {item.imageUrl ? (
                      <Image source={{ uri: item.imageUrl }} style={ss.resultImage} />
                    ) : (
                      <View style={ss.resultImagePlaceholder}>
                        <Ionicons name="cube-outline" size={18} color={Colors.textTertiary} />
                      </View>
                    )}
                    <View style={ss.resultInfo}>
                      <Text style={ss.resultBrand} numberOfLines={1}>{item.brand}</Text>
                      <Text style={ss.resultName} numberOfLines={1}>{item.name}</Text>
                    </View>
                    <Ionicons name="chevron-forward" size={18} color={Colors.textTertiary} />
                  </TouchableOpacity>
                )}
                showsVerticalScrollIndicator={false}
                contentContainerStyle={ss.listContent}
                keyboardShouldPersistTaps="handled"
              />
            )}
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Camera Modal */}
      <Modal
        visible={cameraOpen}
        animationType="fade"
        onRequestClose={() => { setCameraOpen(false); scannedRef.current = false; }}
      >
        <View style={ss.cameraContainer}>
          <CameraView
            style={StyleSheet.absoluteFill}
            barcodeScannerSettings={{
              barcodeTypes: ['ean13', 'upc_a', 'upc_e'],
            }}
            onBarcodeScanned={handleBarcodeScanned}
          />

          {/* Scan overlay */}
          <View style={ss.scanOverlay}>
            <View style={ss.scanReticle} />
            <Text style={ss.scanHint}>
              {scanning ? 'Looking up product…' : 'Point at a barcode'}
            </Text>
          </View>

          {/* Close button */}
          <TouchableOpacity
            style={ss.cameraClose}
            onPress={() => { setCameraOpen(false); scannedRef.current = false; }}
          >
            <Ionicons name="close" size={28} color="#FFFFFF" />
          </TouchableOpacity>

          {scanning && (
            <ActivityIndicator
              size="large"
              color={Colors.accent}
              style={ss.scanSpinner}
            />
          )}
        </View>
      </Modal>
    </>
  );
}

// ─── Styles ─────────────────────────────────────────────

const ss = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  sheetContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
  },
  sheet: {
    backgroundColor: Colors.background,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingTop: Spacing.sm,
    paddingHorizontal: Spacing.md,
    overflow: 'hidden',
  },
  handleBar: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: Colors.cardBorder,
    alignSelf: 'center',
    marginBottom: Spacing.md,
  },
  sheetHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.md,
  },
  sheetTitle: {
    fontSize: FontSizes.lg,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  cameraButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.cardSurface,
    justifyContent: 'center',
    alignItems: 'center',
  },

  // Search
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.cardSurface,
    borderRadius: 12,
    paddingHorizontal: Spacing.sm + 4,
    paddingVertical: Spacing.sm,
    marginBottom: Spacing.md,
  },
  searchIcon: {
    marginRight: Spacing.sm,
  },
  searchInput: {
    flex: 1,
    fontSize: FontSizes.md,
    color: Colors.textPrimary,
    padding: 0,
  },

  // Section
  sectionLabel: {
    fontSize: FontSizes.xs,
    fontWeight: '600',
    color: Colors.textTertiary,
    letterSpacing: 0.5,
    marginBottom: Spacing.sm,
  },

  // List
  listContent: {
    paddingBottom: Spacing.xxl,
  },
  resultRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Spacing.sm + 2,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.hairlineBorder,
  },
  resultImage: {
    width: 40,
    height: 40,
    borderRadius: 8,
  },
  resultImagePlaceholder: {
    width: 40,
    height: 40,
    borderRadius: 8,
    backgroundColor: Colors.cardSurface,
    justifyContent: 'center',
    alignItems: 'center',
  },
  resultInfo: {
    flex: 1,
    marginLeft: Spacing.sm,
    marginRight: Spacing.sm,
  },
  resultBrand: {
    fontSize: FontSizes.xs,
    fontWeight: '600',
    color: Colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  resultName: {
    fontSize: FontSizes.sm,
    color: Colors.textPrimary,
    marginTop: 1,
  },
  spinnerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: Spacing.xl,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: Spacing.xl,
  },
  emptyText: {
    fontSize: FontSizes.sm,
    color: Colors.textTertiary,
  },

  // Camera
  cameraContainer: {
    flex: 1,
    backgroundColor: '#000',
  },
  scanOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
  },
  scanReticle: {
    width: 250,
    height: 120,
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.5)',
    borderRadius: 16,
  },
  scanHint: {
    fontSize: FontSizes.md,
    color: 'rgba(255, 255, 255, 0.8)',
    marginTop: Spacing.md,
    textAlign: 'center',
  },
  cameraClose: {
    position: 'absolute',
    top: 60,
    right: 20,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  scanSpinner: {
    position: 'absolute',
    bottom: 100,
    alignSelf: 'center',
  },
});
