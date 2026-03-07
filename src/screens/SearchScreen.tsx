// Kiba — Search (Premium Feature, D-055)
// Free users see lock state; tapping search bar triggers PaywallScreen.
import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, SafeAreaView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { Colors, FontSizes, Spacing } from '../utils/constants';
import { canSearch } from '../utils/permissions';

export default function SearchScreen() {
  const navigation = useNavigation();

  const handleSearchPress = () => {
    if (!canSearch()) {
      (navigation as any).navigate('Paywall', { trigger: 'search' });
      return;
    }
    // TODO: Premium search flow (M5+)
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Search</Text>
      </View>

      <View style={styles.content}>
        <TouchableOpacity style={styles.searchBar} onPress={handleSearchPress} activeOpacity={0.7}>
          <Ionicons name="search-outline" size={18} color={Colors.textTertiary} />
          <Text style={styles.searchPlaceholder}>Search pet food products...</Text>
        </TouchableOpacity>

        <View style={styles.premiumBadge}>
          <Ionicons name="lock-closed" size={32} color={Colors.textTertiary} style={{ marginBottom: Spacing.md }} />
          <Text style={styles.premiumTitle}>Premium Feature</Text>
          <Text style={styles.premiumSubtitle}>
            Text search is available with Kiba Premium.{'\n'}
            Scan barcodes for free!
          </Text>
          <TouchableOpacity style={styles.upgradeButton} onPress={handleSearchPress} activeOpacity={0.7}>
            <Text style={styles.upgradeText}>Upgrade</Text>
          </TouchableOpacity>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  header: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.md,
    paddingBottom: Spacing.sm,
  },
  title: {
    fontSize: FontSizes.xxl,
    fontWeight: '800',
    color: Colors.textPrimary,
  },
  content: {
    flex: 1,
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.md,
  },
  searchBar: {
    height: 48,
    backgroundColor: Colors.card,
    borderRadius: 12,
    paddingHorizontal: Spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    marginBottom: Spacing.xl,
  },
  searchPlaceholder: {
    fontSize: FontSizes.md,
    color: Colors.textTertiary,
  },
  premiumBadge: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingBottom: 100,
  },
  premiumTitle: {
    fontSize: FontSizes.xl,
    fontWeight: '700',
    color: Colors.textPrimary,
    marginBottom: Spacing.sm,
  },
  premiumSubtitle: {
    fontSize: FontSizes.md,
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: Spacing.lg,
  },
  upgradeButton: {
    backgroundColor: Colors.accent,
    paddingHorizontal: Spacing.xl,
    paddingVertical: 12,
    borderRadius: 12,
  },
  upgradeText: {
    fontSize: FontSizes.md,
    fontWeight: '700',
    color: '#FFFFFF',
  },
});
