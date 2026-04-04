import { StyleSheet } from 'react-native';
import { Colors, FontSizes, Spacing } from '../../utils/constants';

export const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  scrollContent: {
    paddingHorizontal: Spacing.lg,
    paddingBottom: 88,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: Spacing.md,
    paddingBottom: Spacing.sm,
  },
  title: {
    fontSize: FontSizes.xxl,
    fontWeight: '800',
    color: Colors.textPrimary,
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingBottom: Spacing.xxl,
  },
  emptyText: {
    fontSize: FontSizes.md,
    color: Colors.textSecondary,
  },
  addPetButton: {
    marginTop: Spacing.lg,
    backgroundColor: Colors.accent,
    paddingHorizontal: Spacing.lg,
    paddingVertical: 12,
    borderRadius: 12,
  },
  addPetButtonText: {
    fontSize: FontSizes.md,
    fontWeight: '700',
    color: '#FFFFFF',
  },

  // ─── Carousel ───────────────────────────────────────────
  carousel: {
    marginBottom: Spacing.md,
  },
  carouselContent: {
    paddingVertical: Spacing.sm,
    gap: Spacing.md,
  },
  carouselItem: {
    alignItems: 'center',
    width: 56,
  },
  carouselAvatar: {
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: Colors.background,
  },
  carouselAvatarActive: {
    width: 50,
    height: 50,
    borderRadius: 25,
    borderWidth: 2,
    borderColor: Colors.accent,
    padding: 3, // Story Ring cutout — 3px gap between ring and photo
  },
  carouselAvatarInactive: {
    width: 36,
    height: 36,
    borderRadius: 18,
    opacity: 0.5,
  },
  carouselAvatarAdd: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Colors.hairlineBorder,
  },
  carouselPhoto: {
    borderRadius: 24,
  },
  carouselPhotoActive: {
    width: 40,
    height: 40,
    borderRadius: 20,
  },
  carouselPhotoInactive: {
    width: 32,
    height: 32,
    borderRadius: 16,
  },
  carouselName: {
    fontSize: FontSizes.xs,
    color: Colors.textPrimary,
    marginTop: 4,
    textAlign: 'center',
  },
  carouselNameInactive: {
    opacity: 0.5,
  },
  carouselNameAdd: {
    fontSize: FontSizes.xs,
    color: Colors.textTertiary,
    marginTop: 4,
  },

  // ─── Single pet (no carousel) ──────────────────────────
  singlePetRow: {
    alignItems: 'center',
    marginBottom: Spacing.md,
    paddingVertical: Spacing.sm,
  },
  singlePetName: {
    fontSize: FontSizes.md,
    fontWeight: '600',
    color: Colors.textPrimary,
    marginTop: Spacing.xs,
  },

  // ─── Summary Card ──────────────────────────────────────
  summaryCard: {
    backgroundColor: Colors.cardSurface,
    borderRadius: 16,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.hairlineBorder,
    marginBottom: Spacing.md,
  },
  summaryTop: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  summaryPhotoWrap: {
    marginRight: Spacing.md,
  },
  summaryPhoto: {
    width: 56,
    height: 56,
    borderRadius: 28,
  },
  summaryPhotoPlaceholder: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#00B4D815',
    justifyContent: 'center',
    alignItems: 'center',
  },
  summaryInfo: {
    flex: 1,
  },
  summaryName: {
    fontSize: FontSizes.lg,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  summaryMeta: {
    fontSize: FontSizes.sm,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  summaryLifeStage: {
    fontSize: FontSizes.sm,
    color: Colors.accent,
    marginTop: 2,
    textTransform: 'capitalize',
  },

  // ─── Score Accuracy ────────────────────────────────────
  accuracySection: {
    marginTop: Spacing.md,
    borderTopWidth: 1,
    borderTopColor: Colors.hairlineBorder,
    paddingTop: Spacing.md,
  },
  accuracyHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: Spacing.sm,
  },
  accuracyLabel: {
    fontSize: FontSizes.sm,
    fontWeight: '600',
    color: Colors.textPrimary,
  },
  accuracyTrack: {
    height: 6,
    backgroundColor: Colors.hairlineBorder,
    borderRadius: 3,
    overflow: 'hidden',
  },
  accuracyFill: {
    height: 6,
    borderRadius: 3,
    // Note: replaced by LinearGradient in PetHubScreen render
    backgroundColor: Colors.accent,
  },
  accuracyHint: {
    fontSize: FontSizes.sm,
    color: Colors.textSecondary,
    marginTop: Spacing.sm,
  },

  // ─── Stale Weight ──────────────────────────────────────
  staleWeightCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F59E0B15',
    borderRadius: 12,
    padding: Spacing.md,
    borderLeftWidth: 3,
    borderLeftColor: Colors.severityAmber,
    marginBottom: Spacing.md,
    gap: Spacing.sm,
  },
  staleWeightText: {
    flex: 1,
    fontSize: FontSizes.sm,
    color: Colors.severityAmber,
  },

  // ─── D-161: Weight Estimate Banner ────────────────────
  weightEstimateBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(96, 165, 250, 0.12)',
    borderRadius: 12,
    padding: Spacing.md,
    borderLeftWidth: 3,
    borderLeftColor: Colors.accent,
    marginBottom: Spacing.md,
    gap: Spacing.sm,
  },
  weightEstimateText: {
    flex: 1,
    fontSize: FontSizes.sm,
    color: Colors.textPrimary,
  },

  // ─── Quick Stats ───────────────────────────────────────
  statsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.md,
    marginBottom: Spacing.md,
  },
  statChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#2A2A2E',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    gap: 6,
  },
  statValue: {
    fontSize: FontSizes.sm,
    color: Colors.textPrimary,
  },

  // ─── Portion Section ─────────────────────────────────
  portionSection: {
    gap: Spacing.sm,
    marginBottom: Spacing.md,
  },

  // ─── Health Card ───────────────────────────────────────
  healthCard: {
    backgroundColor: Colors.cardSurface,
    borderRadius: 16,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.hairlineBorder,
    marginBottom: Spacing.md,
  },
  healthHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  healthTitle: {
    fontSize: FontSizes.md,
    fontWeight: '600',
    color: Colors.textPrimary,
  },
  healthPrompt: {
    fontSize: FontSizes.sm,
    color: Colors.textSecondary,
    marginTop: Spacing.sm,
  },
  healthyBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: Spacing.sm,
    gap: 6,
  },
  healthyText: {
    fontSize: FontSizes.sm,
    color: Colors.severityGreen,
    fontWeight: '600',
  },
  conditionChips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: Spacing.sm,
  },
  conditionChip: {
    backgroundColor: Colors.background,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: Colors.hairlineBorder,
  },
  conditionChipText: {
    fontSize: FontSizes.xs,
    color: Colors.textPrimary,
  },
  allergenCount: {
    fontSize: FontSizes.sm,
    color: Colors.textSecondary,
    marginTop: Spacing.sm,
  },

  // ─── Health Records (D-163) ──────────────────────────────
  healthRecordCard: {
    backgroundColor: Colors.cardSurface,
    borderRadius: 16,
    padding: Spacing.lg,
    borderWidth: 1,
    borderColor: Colors.hairlineBorder,
    marginBottom: Spacing.md,
  },
  healthRecordHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  healthRecordTitle: {
    fontSize: FontSizes.md,
    fontWeight: '700',
    color: Colors.textPrimary,
    marginBottom: Spacing.sm,
  },
  addRecordLink: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  addRecordLinkText: {
    fontSize: FontSizes.sm,
    fontWeight: '600',
    color: Colors.accent,
  },
  healthRecordRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Spacing.sm,
    borderTopWidth: 1,
    borderTopColor: Colors.hairlineBorder,
  },
  healthRecordInfo: {
    flex: 1,
    gap: 2,
  },
  healthRecordName: {
    fontSize: FontSizes.md,
    fontWeight: '600',
    color: Colors.textPrimary,
  },
  healthRecordDate: {
    fontSize: FontSizes.sm,
    color: Colors.textSecondary,
  },
  healthRecordVet: {
    fontSize: FontSizes.xs,
    color: Colors.textTertiary,
  },
  seeAllLink: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingVertical: Spacing.sm,
    marginTop: Spacing.xs,
  },
  seeAllLinkText: {
    fontSize: FontSizes.sm,
    fontWeight: '600',
    color: Colors.accent,
  },
  headerSeeAll: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  healthDisclaimer: {
    fontSize: FontSizes.xs,
    color: Colors.textTertiary,
    textAlign: 'center',
    marginBottom: Spacing.lg,
    paddingHorizontal: Spacing.md,
  },

  // ─── Settings Nav Row ────────────────────────────────────
  settingsNavRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    gap: Spacing.md,
    marginTop: Spacing.md,
  },
  settingsNavLabel: {
    flex: 1,
    fontSize: FontSizes.md,
    color: Colors.textPrimary,
  },

  // ─── Share Link (inside summary card) ──────────────────
  shareLink: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginTop: Spacing.md,
    borderTopWidth: 1,
    borderTopColor: Colors.hairlineBorder,
    paddingTop: Spacing.md,
  },
  shareLinkText: {
    fontSize: FontSizes.sm,
    fontWeight: '600',
    color: Colors.accent,
  },
  // ─── Consolidated inline styles ─────────────────────────
  loadingSpinner: {
    marginTop: Spacing.sm,
  },
  medicationRowInner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
  },
  medicationStatusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  pastMedsToggle: {
    marginTop: Spacing.sm,
  },
  healthRecordNameMuted: {
    fontSize: FontSizes.md,
    fontWeight: '600',
    color: Colors.textSecondary,
  },
  medicalRecordIcon: {
    marginRight: Spacing.sm,
  },
  apptIconCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: Colors.background,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: Spacing.sm,
  },
  scrollBottomSpacer: {
    height: Spacing.xxl,
  },

  offScreen: {
    position: 'absolute',
    left: -9999,
    top: 0,
  },

  // ─── Vet Report Card (Fix 5) ──────────────────────────
  vetReportCard: {
    backgroundColor: Colors.cardSurface,
    borderRadius: 16,
    padding: Spacing.lg,
    borderWidth: 1,
    borderColor: Colors.hairlineBorder,
    marginBottom: Spacing.md,
  },
  vetReportRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
  },
  vetReportTitle: {
    fontSize: FontSizes.md,
    fontWeight: '700',
    color: Colors.accent,
  },
  vetReportDesc: {
    fontSize: FontSizes.sm,
    color: Colors.textSecondary,
    marginTop: 2,
  },
});
