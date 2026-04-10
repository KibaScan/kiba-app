// Kiba — Pet Share Card (Viral Infrastructure)
// Renders a styled card for capture + sharing via native share sheet.
// 9:16 aspect ratio (Instagram story format).
// D-084: No emoji. D-094: "[X]% match for [Pet Name]" framing.

import React from 'react';
import { View, Text, Image, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';

export interface PetShareCardProps {
  petName: string;
  petPhoto: string | null;
  species: 'dog' | 'cat';
  productName: string;
  score: number;
  scoreColor: string;
}

/**
 * Renders a share-ready card. Mount off-screen (absolute positioned, off viewport)
 * and capture with react-native-view-shot via captureAndShare().
 */
export const PetShareCard = React.forwardRef<View, PetShareCardProps>(
  function PetShareCard({ petName, petPhoto, species, productName, score, scoreColor }, ref) {
    return (
      <View ref={ref} style={styles.card} collapsable={false}>
        <LinearGradient
          colors={['#1A1A1A', '#0D0D0D']}
          style={StyleSheet.absoluteFill}
        />

        {/* Top spacer */}
        <View style={styles.topSpacer} />

        {/* Pet photo */}
        <View style={styles.photoContainer}>
          {petPhoto ? (
            <Image source={{ uri: petPhoto }} style={styles.photo} />
          ) : (
            <View style={styles.photoPlaceholder}>
              <Ionicons name="paw-outline" size={48} color="#00B4D8" />
            </View>
          )}
        </View>

        {/* Pet name */}
        <Text style={styles.petName}>{petName}</Text>

        {/* Score block */}
        <View style={styles.scoreBlock}>
          <Text style={[styles.scoreNumber, { color: scoreColor }]}>
            {score}%
          </Text>
          <Text style={styles.matchText}>match for</Text>
          <Text style={styles.matchName}>{petName}</Text>
        </View>

        {/* Product name */}
        <Text style={styles.productName} numberOfLines={2} adjustsFontSizeToFit minimumFontScale={0.7}>
          {productName}
        </Text>

        {/* Branding footer */}
        <View style={styles.footer}>
          <View style={styles.dividerRow}>
            <View style={styles.divider} />
            <Text style={styles.brandUrl}>kibascan.com</Text>
            <View style={styles.divider} />
          </View>
          <Text style={styles.tagline}>Scan. Score. Share.</Text>
        </View>

        {/* Bottom spacer */}
        <View style={styles.bottomSpacer} />
      </View>
    );
  },
);

/**
 * Simplified share card for PetHub — no product context.
 * Just pet photo + name + Kiba branding.
 */
export interface PetHubShareCardProps {
  petName: string;
  petPhoto: string | null;
  species: 'dog' | 'cat';
}

export const PetHubShareCard = React.forwardRef<View, PetHubShareCardProps>(
  function PetHubShareCard({ petName, petPhoto }, ref) {
    return (
      <View ref={ref} style={styles.card} collapsable={false}>
        <LinearGradient
          colors={['#1A1A1A', '#0D0D0D']}
          style={StyleSheet.absoluteFill}
        />

        <View style={{ flex: 1 }} />

        {/* Pet photo — larger for hub card */}
        <View style={styles.hubPhotoContainer}>
          {petPhoto ? (
            <Image source={{ uri: petPhoto }} style={styles.hubPhoto} />
          ) : (
            <View style={styles.hubPhotoPlaceholder}>
              <Ionicons name="paw-outline" size={64} color="#00B4D8" />
            </View>
          )}
        </View>

        {/* Pet name */}
        <Text style={styles.hubPetName}>{petName}</Text>

        <View style={{ flex: 1 }} />

        {/* Branding footer */}
        <View style={styles.footer}>
          <View style={styles.dividerRow}>
            <View style={styles.divider} />
            <Text style={styles.brandUrl}>kibascan.com</Text>
            <View style={styles.divider} />
          </View>
          <Text style={styles.tagline}>Scan. Score. Share.</Text>
        </View>

        <View style={styles.bottomSpacer} />
      </View>
    );
  },
);

// ─── Styles ──────────────────────────────────────────────

// 9:16 aspect ratio at a reasonable capture size
const CARD_WIDTH = 270;
const CARD_HEIGHT = 480;

const styles = StyleSheet.create({
  card: {
    width: CARD_WIDTH,
    height: CARD_HEIGHT,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  topSpacer: {
    height: 40,
  },

  // ─── Pet Photo (Result card)
  photoContainer: {
    width: 120,
    height: 120,
    borderRadius: 60,
    overflow: 'hidden',
    marginBottom: 12,
  },
  photo: {
    width: 120,
    height: 120,
    borderRadius: 60,
  },
  photoPlaceholder: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: '#00B4D815',
    justifyContent: 'center',
    alignItems: 'center',
  },

  // ─── Pet Name
  petName: {
    fontSize: 20,
    fontWeight: '700',
    color: '#FFFFFF',
    textAlign: 'center',
    marginBottom: 20,
  },

  // ─── Score Block
  scoreBlock: {
    backgroundColor: Colors.cardSurface,
    borderRadius: 16,
    paddingHorizontal: 24,
    paddingVertical: 16,
    alignItems: 'center',
    marginBottom: 16,
  },
  scoreNumber: {
    fontSize: 44,
    fontWeight: '800',
  },
  matchText: {
    fontSize: 14,
    color: '#A0A0A0',
    marginTop: 2,
  },
  matchName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
    marginTop: 2,
  },

  // ─── Product Name
  productName: {
    fontSize: 13,
    color: '#A0A0A0',
    textAlign: 'center',
    paddingHorizontal: 20,
    marginBottom: 16,
  },

  // ─── Footer / Branding
  footer: {
    alignItems: 'center',
    gap: 6,
  },
  dividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  divider: {
    width: 32,
    height: 1,
    backgroundColor: '#333333',
  },
  brandUrl: {
    fontSize: 13,
    fontWeight: '600',
    color: '#00B4D8',
  },
  tagline: {
    fontSize: 11,
    color: '#666666',
    letterSpacing: 1,
  },
  bottomSpacer: {
    height: 24,
  },

  // ─── Hub card (larger photo, no score)
  hubPhotoContainer: {
    width: 160,
    height: 160,
    borderRadius: 80,
    overflow: 'hidden',
    marginBottom: 16,
  },
  hubPhoto: {
    width: 160,
    height: 160,
    borderRadius: 80,
  },
  hubPhotoPlaceholder: {
    width: 160,
    height: 160,
    borderRadius: 80,
    backgroundColor: '#00B4D815',
    justifyContent: 'center',
    alignItems: 'center',
  },
  hubPetName: {
    fontSize: 28,
    fontWeight: '800',
    color: '#FFFFFF',
    textAlign: 'center',
  },
});
