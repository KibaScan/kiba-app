// Kiba — Scan (Camera Placeholder)
import React from 'react';
import { View, Text, StyleSheet, SafeAreaView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, FontSizes, Spacing } from '../utils/constants';

export default function ScanScreen() {
  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Scan</Text>
      </View>

      <View style={styles.content}>
        <View style={styles.cameraPlaceholder}>
          <Ionicons name="camera-outline" size={64} color={Colors.textTertiary} />
          <Text style={styles.placeholderTitle}>Camera Preview</Text>
          <Text style={styles.placeholderSubtitle}>
            Barcode scanning coming in M1.{'\n'}
            Point camera at any pet food barcode.
          </Text>
        </View>

        <View style={styles.hint}>
          <Ionicons name="barcode-outline" size={20} color={Colors.accent} />
          <Text style={styles.hintText}>
            Works with kibble, wet food, treats, and supplements
          </Text>
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
    justifyContent: 'center',
  },
  cameraPlaceholder: {
    aspectRatio: 3 / 4,
    maxHeight: 400,
    backgroundColor: Colors.card,
    borderRadius: 20,
    borderWidth: 2,
    borderColor: Colors.cardBorder,
    borderStyle: 'dashed',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: Spacing.xl,
  },
  placeholderTitle: {
    fontSize: FontSizes.lg,
    fontWeight: '600',
    color: Colors.textSecondary,
    marginTop: Spacing.md,
  },
  placeholderSubtitle: {
    fontSize: FontSizes.sm,
    color: Colors.textTertiary,
    textAlign: 'center',
    marginTop: Spacing.sm,
    lineHeight: 20,
  },
  hint: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
  },
  hintText: {
    fontSize: FontSizes.sm,
    color: Colors.textSecondary,
  },
});
