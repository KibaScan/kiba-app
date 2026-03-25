// Kiba — Recall Detail Screen (D-158)
// Shows full recall information from recall_log for a recalled product.
// D-084: no emoji. D-095: factual tone. D-125: always free.

import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  TouchableOpacity,
  Image,
  Linking,
  ActivityIndicator,
} from 'react-native';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';

import { Colors, FontSizes, Spacing } from '../utils/constants';
import type { ScanStackParamList, HomeStackParamList, PantryStackParamList, CommunityStackParamList } from '../types/navigation';
import { supabase } from '../services/supabase';
import { usePantryStore } from '../stores/usePantryStore';
import type { RecallEntry } from '../types/recall';

// ─── Navigation Types ────────────────────────────────────

type AnyRecallStack = ScanStackParamList | HomeStackParamList | PantryStackParamList | CommunityStackParamList;
type ScreenRoute = RouteProp<AnyRecallStack, 'RecallDetail'>;
type ScreenNav = NativeStackNavigationProp<AnyRecallStack, 'RecallDetail'>;

interface ProductInfo {
  id: string;
  name: string;
  brand: string;
  image_url: string | null;
}

// ─── Component ───────────────────────────────────────────

export default function RecallDetailScreen() {
  const navigation = useNavigation<ScreenNav>();
  const route = useRoute<ScreenRoute>();
  const { productId } = route.params;

  const [recall, setRecall] = useState<RecallEntry | null>(null);
  const [product, setProduct] = useState<ProductInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const pantryItems = usePantryStore((s) => s.items);
  const removeItem = usePantryStore((s) => s.removeItem);

  const pantryMatch = pantryItems.find(
    (item) => item.product_id === productId && item.is_active,
  );

  useEffect(() => {
    async function load() {
      try {
        const [recallRes, productRes] = await Promise.all([
          supabase
            .from('recall_log')
            .select('*')
            .eq('product_id', productId)
            .order('detected_at', { ascending: false })
            .limit(1)
            .maybeSingle(),
          supabase
            .from('products')
            .select('id, name, brand, image_url')
            .eq('id', productId)
            .single(),
        ]);

        if (recallRes.data) setRecall(recallRes.data as RecallEntry);
        if (productRes.data) setProduct(productRes.data as ProductInfo);
        if (recallRes.error && productRes.error) {
          setError('Unable to load recall details.');
        }
      } catch {
        setError('Unable to load recall details.');
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [productId]);

  const handleViewFda = () => {
    if (recall?.fda_url) {
      Linking.openURL(recall.fda_url);
    }
  };

  const handleRemoveFromPantry = async () => {
    if (!pantryMatch) return;
    await removeItem(pantryMatch.id);
  };

  const handleFindAlternatives = () => {
    // Navigate to Search tab
    const parent = navigation.getParent();
    if (parent) {
      parent.navigate('Community');
    }
  };

  const formatDate = (dateStr: string | null): string => {
    if (!dateStr) return 'Unknown';
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={Colors.severityRed} />
        </View>
      </SafeAreaView>
    );
  }

  if (error) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} hitSlop={12}>
            <Ionicons name="arrow-back" size={24} color={Colors.textPrimary} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Recall Alert</Text>
          <View style={styles.headerSpacer} />
        </View>
        <View style={styles.loadingContainer}>
          <Ionicons name="cloud-offline-outline" size={48} color={Colors.textTertiary} />
          <Text style={styles.errorText}>{error}</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} hitSlop={12}>
          <Ionicons name="arrow-back" size={24} color={Colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Recall Alert</Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Product image */}
        {product?.image_url && (
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
          </View>
        )}

        {/* Product info */}
        {product && (
          <View style={styles.productInfo}>
            <Text style={styles.productBrand}>{product.brand}</Text>
            <Text style={styles.productName}>{product.name}</Text>
          </View>
        )}

        {/* Recall badge */}
        <View style={styles.recallBadgeContainer}>
          <View style={styles.recallBadge}>
            <Ionicons name="alert-circle" size={24} color="#FFFFFF" />
            <Text style={styles.recallBadgeText}>Recalled Product</Text>
          </View>
        </View>

        {/* Recall information */}
        <View style={styles.infoSection}>
          <Text style={styles.sectionHeader}>RECALL INFORMATION</Text>

          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Date</Text>
            <Text style={styles.infoValue}>
              {formatDate(recall?.recall_date ?? null)}
            </Text>
          </View>

          {recall?.reason && (
            <View style={styles.reasonContainer}>
              <Text style={styles.infoLabel}>Reason</Text>
              <Text style={styles.reasonText}>{recall.reason}</Text>
            </View>
          )}
        </View>

        {/* Lot numbers */}
        {recall?.lot_numbers && recall.lot_numbers.length > 0 && (
          <View style={styles.infoSection}>
            <Text style={styles.sectionHeader}>LOT NUMBERS</Text>
            {recall.lot_numbers.map((lot, i) => (
              <View key={i} style={styles.lotRow}>
                <View style={styles.lotDot} />
                <Text style={styles.lotText}>{lot}</Text>
              </View>
            ))}
          </View>
        )}

        {/* View FDA Notice */}
        {recall?.fda_url && (
          <TouchableOpacity
            style={styles.fdaButton}
            onPress={handleViewFda}
            activeOpacity={0.7}
          >
            <Ionicons name="open-outline" size={20} color={Colors.severityRed} />
            <Text style={styles.fdaButtonText}>View FDA Notice</Text>
          </TouchableOpacity>
        )}

        {/* Remove from Pantry */}
        {pantryMatch && (
          <TouchableOpacity
            style={styles.actionButton}
            onPress={handleRemoveFromPantry}
            activeOpacity={0.7}
          >
            <Ionicons name="trash-outline" size={20} color={Colors.severityRed} />
            <Text style={styles.actionButtonTextRed}>Remove from Pantry</Text>
          </TouchableOpacity>
        )}

        {/* Find Alternatives */}
        <TouchableOpacity
          style={styles.actionButton}
          onPress={handleFindAlternatives}
          activeOpacity={0.7}
        >
          <Ionicons name="search-outline" size={20} color={Colors.accent} />
          <Text style={styles.actionButtonTextAccent}>Find Alternatives</Text>
        </TouchableOpacity>

        {/* Disclaimer */}
        <Text style={styles.disclaimer}>
          This information is from the FDA's official recall database.
          Contact the manufacturer for return or refund instructions.
        </Text>

        <View style={styles.bottomSpacer} />
      </ScrollView>
    </SafeAreaView>
  );
}

// ─── Styles ─────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.md,
    paddingVertical: 12,
  },
  headerTitle: {
    flex: 1,
    fontSize: FontSizes.lg,
    fontWeight: '700',
    color: Colors.severityRed,
    textAlign: 'center',
  },
  headerSpacer: {
    width: 24,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: Spacing.md,
  },
  productImageContainer: {
    height: 200,
    marginBottom: Spacing.md,
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: Colors.card,
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
  productInfo: {
    alignItems: 'center',
    marginBottom: Spacing.md,
  },
  productBrand: {
    fontSize: FontSizes.sm,
    fontWeight: '600',
    color: Colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  productName: {
    fontSize: FontSizes.lg,
    fontWeight: '700',
    color: Colors.textPrimary,
    textAlign: 'center',
  },
  recallBadgeContainer: {
    alignItems: 'center',
    marginBottom: Spacing.lg,
  },
  recallBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: Colors.severityRed,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 24,
  },
  recallBadgeText: {
    fontSize: FontSizes.md,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  infoSection: {
    backgroundColor: Colors.card,
    borderRadius: 12,
    padding: Spacing.md,
    marginBottom: Spacing.md,
  },
  sectionHeader: {
    fontSize: FontSizes.xs,
    fontWeight: '700',
    color: Colors.textTertiary,
    letterSpacing: 1,
    marginBottom: 12,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  infoLabel: {
    fontSize: FontSizes.md,
    fontWeight: '600',
    color: Colors.textSecondary,
  },
  infoValue: {
    fontSize: FontSizes.md,
    color: Colors.textPrimary,
  },
  reasonContainer: {
    marginTop: 4,
  },
  reasonText: {
    fontSize: FontSizes.md,
    color: Colors.textPrimary,
    lineHeight: 22,
    marginTop: 4,
  },
  lotRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 6,
  },
  lotDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: Colors.severityRed,
  },
  lotText: {
    fontSize: FontSizes.md,
    color: Colors.textPrimary,
    fontFamily: 'monospace',
  },
  fdaButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255, 59, 48, 0.12)',
    borderRadius: 12,
    paddingVertical: 14,
    marginBottom: Spacing.sm,
    gap: 8,
  },
  fdaButtonText: {
    fontSize: FontSizes.md,
    fontWeight: '600',
    color: Colors.severityRed,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.card,
    borderRadius: 12,
    paddingVertical: 14,
    marginBottom: Spacing.sm,
    gap: 8,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
  },
  actionButtonTextRed: {
    fontSize: FontSizes.md,
    fontWeight: '600',
    color: Colors.severityRed,
  },
  actionButtonTextAccent: {
    fontSize: FontSizes.md,
    fontWeight: '600',
    color: Colors.accent,
  },
  disclaimer: {
    fontSize: FontSizes.sm,
    color: Colors.textTertiary,
    textAlign: 'center',
    lineHeight: 20,
    marginTop: Spacing.md,
    paddingHorizontal: Spacing.md,
  },
  bottomSpacer: {
    height: 100,
  },
  errorText: {
    fontSize: FontSizes.md,
    color: Colors.textSecondary,
    textAlign: 'center',
    marginTop: Spacing.md,
  },
});
