// Kiba — Affiliate Buy Buttons (M6)
// Side-by-side Chewy + Amazon buy buttons on ResultScreen.
// D-020: Hidden when score < 50 (replaced by Safe Swap CTAs).
// D-053: Chewy shows estimated price, Amazon hides price (TOS).
// D-084: Zero emoji. D-095: No clinical language.

import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Linking,
  StyleSheet,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { Colors, FontSizes, Spacing } from '../../utils/constants';
import { getAffiliateLinks, type AffiliateLink } from '../../services/affiliateService';
import type { Product } from '../../types';

// ─── Props ──────────────────────────────────────────────

interface AffiliateBuyButtonsProps {
  product: Product;
  score: number;
  isBypassed: boolean;
}

// ─── Retailer Brand Colors ─────────────────────────────

const RETAILER_ACCENTS = {
  chewy: '#E24118',   // Chewy brand red-orange
  amazon: '#FF9900',  // Amazon brand orange
} as const;

const RETAILER_ICONS: Record<string, keyof typeof Ionicons.glyphMap> = {
  chewy: 'storefront-outline',
  amazon: 'cart-outline',
};

// ─── Component ──────────────────────────────────────────

export function AffiliateBuyButtons({ product, score, isBypassed }: AffiliateBuyButtonsProps) {
  // D-020: Hide buy buttons for products scoring < 50
  if (score < 50) return null;

  // Hide for bypassed products (vet diet, recalled, variety pack, species mismatch)
  if (isBypassed) return null;

  const links = getAffiliateLinks(product);

  // No affiliate data → hide silently (no empty state)
  if (links.length === 0) return null;

  const handlePress = (link: AffiliateLink) => {
    Linking.openURL(link.url).catch((err) => {
      console.warn('[AffiliateBuyButtons] Failed to open URL:', err);
    });
  };

  const isMulti = links.length > 1;

  return (
    <View style={s.container}>
      <View style={[s.buttonRow, !isMulti && s.buttonRowSingle]}>
        {links.map((link) => (
          <TouchableOpacity
            key={link.retailer}
            style={[
              s.button,
              isMulti ? s.buttonHalf : s.buttonFull,
              { borderLeftColor: RETAILER_ACCENTS[link.retailer] ?? Colors.accent },
            ]}
            activeOpacity={0.7}
            onPress={() => handlePress(link)}
          >
            <View style={s.buttonContent}>
              <Ionicons
                name={RETAILER_ICONS[link.retailer] ?? 'open-outline'}
                size={18}
                color={Colors.textPrimary}
                style={s.icon}
              />
              <View style={s.labelGroup}>
                <Text style={s.buttonLabel} numberOfLines={1}>
                  {link.label}
                </Text>
                {link.priceLabel && (
                  <Text style={s.priceLabel} numberOfLines={1}>
                    {link.priceLabel}
                  </Text>
                )}
              </View>
              <Ionicons
                name="open-outline"
                size={14}
                color={Colors.textTertiary}
              />
            </View>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
}

// ─── Styles ─────────────────────────────────────────────

const s = StyleSheet.create({
  container: {
    marginTop: Spacing.md,
    marginBottom: Spacing.sm,
  },
  buttonRow: {
    flexDirection: 'row',
    gap: 10,
  },
  buttonRowSingle: {
    // No special styles needed for single button
  },
  button: {
    backgroundColor: Colors.cardSurface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.hairlineBorder,
    borderLeftWidth: 3,
    paddingVertical: 14,
    paddingHorizontal: 14,
  },
  buttonHalf: {
    flex: 1,
  },
  buttonFull: {
    flex: 1,
  },
  buttonContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  icon: {
    marginRight: 10,
  },
  labelGroup: {
    flex: 1,
  },
  buttonLabel: {
    fontSize: FontSizes.md,
    fontWeight: '600',
    color: Colors.textPrimary,
  },
  priceLabel: {
    fontSize: FontSizes.sm,
    color: Colors.textSecondary,
    marginTop: 2,
  },
});
