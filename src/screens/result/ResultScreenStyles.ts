import { StyleSheet } from 'react-native';
import { Colors, FontSizes, Spacing } from '../../utils/constants';

export const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.md,
    paddingBottom: Spacing.sm,
  },
  headerCenter: {
    flex: 1,
    alignItems: 'center',
    paddingHorizontal: Spacing.sm,
  },
  headerSpacer: {
    width: 24,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  headerIconButton: {
    padding: Spacing.xs,
  },
  productBrand: {
    fontSize: FontSizes.sm,
    fontWeight: '500',
    color: Colors.textSecondary,
  },
  productName: {
    fontSize: FontSizes.lg,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.md,
    paddingBottom: 88,
  },

  // ─── Product Image (D-093)
  productImageContainer: {
    width: '100%',
    height: 200,
    marginBottom: Spacing.lg,
    position: 'relative',
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
  imageGradientSides: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },

  // ─── Verdict Text
  verdictText: {
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
    marginBottom: Spacing.md,
  },

  // ─── Recall Banner
  recallBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 59, 48, 0.12)',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: 12,
    marginBottom: Spacing.md,
    gap: 8,
  },
  recallText: {
    fontSize: FontSizes.md,
    fontWeight: '600',
    color: Colors.severityRed,
    flex: 1,
  },

  // ─── Flag Chips
  flagChipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 8,
    marginTop: Spacing.sm,
    marginBottom: Spacing.md,
  },
  flagChipMuted: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
  },
  flagChipMutedText: {
    fontSize: FontSizes.xs,
    color: Colors.textTertiary,
  },
  flagChipGeneric: {
    backgroundColor: Colors.cardSurface,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
  },
  flagChipGenericText: {
    fontSize: FontSizes.xs,
    color: Colors.textSecondary,
  },

  // ─── Supplemental Ring Line (D-136)
  supplementalRingLine: {
    fontSize: FontSizes.sm,
    color: Colors.textSecondary,
    textAlign: 'center',
    marginBottom: Spacing.sm,
  },

  // ─── Portion / Treat Section
  portionSection: {
    marginBottom: Spacing.md,
  },
  treatCountText: {
    fontSize: FontSizes.md,
    color: Colors.textPrimary,
    textAlign: 'center',
    marginTop: Spacing.sm,
  },
  treatWarningText: {
    fontSize: FontSizes.sm,
    color: Colors.severityAmber,
    textAlign: 'center',
    marginTop: Spacing.sm,
  },

  // ─── Compare Button
  compareButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.cardSurface,
    borderRadius: 16,
    paddingVertical: 14,
    marginTop: Spacing.sm,
    gap: 8,
    borderWidth: 1,
    borderColor: Colors.hairlineBorder,
  },
  compareButtonText: {
    fontSize: FontSizes.md,
    fontWeight: '600',
    color: Colors.accent,
  },

  // ─── D-135 Vet Diet Bypass
  vetDietBadgeContainer: {
    alignItems: 'center',
    paddingVertical: Spacing.lg,
    paddingHorizontal: Spacing.md,
    marginBottom: Spacing.md,
  },
  vetDietBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#EEF2FF',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    marginBottom: 12,
  },
  vetDietBadgeTitle: {
    fontSize: FontSizes.md,
    fontWeight: '600',
    color: '#6366F1',
  },
  vetDietCopy: {
    fontSize: FontSizes.md,
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
    paddingHorizontal: Spacing.md,
  },

  // ─── D-158 Recall Bypass
  recallBypassContainer: {
    alignItems: 'center',
    paddingVertical: Spacing.lg,
    paddingHorizontal: Spacing.md,
    marginBottom: Spacing.md,
  },
  recallBypassBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: Colors.severityRed,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 24,
    marginBottom: 12,
  },
  recallBypassBadgeText: {
    fontSize: FontSizes.lg,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  recallBypassCopy: {
    fontSize: FontSizes.md,
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
    paddingHorizontal: Spacing.md,
  },
  recallDetailButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255, 59, 48, 0.12)',
    borderRadius: 12,
    paddingVertical: 14,
    marginBottom: Spacing.md,
    gap: 8,
  },
  recallDetailButtonText: {
    fontSize: FontSizes.md,
    fontWeight: '600',
    color: Colors.severityRed,
  },
  removeFromPantryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.cardSurface,
    borderRadius: 12,
    paddingVertical: 14,
    marginBottom: Spacing.md,
    gap: 8,
    borderWidth: 1,
    borderColor: Colors.hairlineBorder,
  },
  removeFromPantryText: {
    fontSize: FontSizes.md,
    fontWeight: '600',
    color: Colors.severityRed,
  },

  // ─── Variety Pack Bypass
  varietyPackContainer: {
    alignItems: 'center',
    paddingVertical: Spacing.lg,
    paddingHorizontal: Spacing.md,
    marginBottom: Spacing.md,
  },
  varietyPackBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: Colors.severityAmber,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    marginBottom: 12,
  },
  varietyPackBadgeText: {
    fontSize: FontSizes.md,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  varietyPackCopy: {
    fontSize: FontSizes.md,
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
    paddingHorizontal: Spacing.md,
  },

  // ─── Species Mismatch Bypass
  speciesMismatchContainer: {
    alignItems: 'center',
    paddingVertical: Spacing.lg,
    paddingHorizontal: Spacing.md,
    marginBottom: Spacing.md,
  },
  speciesMismatchBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: Colors.severityRed,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    marginBottom: 12,
  },
  speciesMismatchBadgeText: {
    fontSize: FontSizes.md,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  speciesMismatchCopy: {
    fontSize: FontSizes.md,
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
    paddingHorizontal: Spacing.md,
  },

  // ─── No Ingredient Data
  noDataCard: {
    backgroundColor: Colors.cardSurface,
    borderRadius: 12,
    padding: Spacing.lg,
    alignItems: 'center',
    gap: 12,
    marginTop: Spacing.xl,
  },
  noDataTitle: {
    fontSize: FontSizes.lg,
    fontWeight: '600',
    color: Colors.textPrimary,
    textAlign: 'center',
  },
  noDataSubtext: {
    fontSize: FontSizes.md,
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
  },
  contributeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: Colors.background,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 10,
    marginTop: 4,
    opacity: 0.5,
  },
  contributeText: {
    fontSize: FontSizes.md,
    fontWeight: '600',
    color: Colors.textTertiary,
  },

  // ─── Track Button (M5 placeholder)
  trackButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.cardSurface,
    borderRadius: 16,
    paddingVertical: 14,
    marginTop: Spacing.lg,
    gap: 8,
    borderWidth: 1,
    borderColor: Colors.hairlineBorder,
  },
  trackButtonText: {
    fontSize: FontSizes.md,
    fontWeight: '600',
    color: Colors.textTertiary,
  },
  comingSoonBadge: {
    fontSize: FontSizes.xs,
    color: Colors.textTertiary,
    backgroundColor: Colors.background,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
    overflow: 'hidden',
  },

  // ─── Off-screen Share Card
  offScreen: {
    position: 'absolute',
    left: -9999,
    top: 0,
  },

  // ─── Bottom Spacer
  bottomSpacer: {
    height: 40,
  },

  // ─── Error State
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: Spacing.xl,
    gap: 16,
  },
  errorText: {
    fontSize: FontSizes.md,
    color: Colors.textSecondary,
    textAlign: 'center',
  },
  retryButton: {
    backgroundColor: Colors.cardSurface,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 12,
    marginTop: 8,
  },
  retryText: {
    fontSize: FontSizes.md,
    fontWeight: '600',
    color: Colors.accent,
  },

  // ─── Loading Fallback
  loadingFallback: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    fontSize: FontSizes.md,
    color: Colors.textSecondary,
  },
});
