import { StyleSheet } from 'react-native';
import { Colors, FontSizes, Spacing } from '../../utils/constants';

export const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: Colors.cardSurface,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '85%',
    paddingTop: Spacing.lg,
    paddingHorizontal: Spacing.lg,
  },

  // Header
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: Spacing.lg,
  },
  headerLeft: {
    flexDirection: 'row',
    flex: 1,
    gap: 12,
    alignItems: 'center',
  },
  productImage: {
    width: 56,
    height: 56,
    borderRadius: 8,
    backgroundColor: Colors.background,
  },
  productImagePlaceholder: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerText: {
    flex: 1,
  },
  brandText: {
    fontSize: FontSizes.sm,
    color: Colors.textSecondary,
  },
  nameText: {
    fontSize: FontSizes.lg,
    fontWeight: '600',
    color: Colors.textPrimary,
    marginTop: 2,
  },
  closeButton: {
    padding: 4,
  },

  // Warning banner (D-165: significantly over budget)
  warningBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(255, 179, 71, 0.12)',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: Spacing.lg,
  },
  warningBannerText: {
    fontSize: FontSizes.xs,
    color: Colors.severityAmber,
    flex: 1,
  },

  // Toggle
  toggleRow: {
    flexDirection: 'row',
    backgroundColor: Colors.background,
    borderRadius: 10,
    padding: 3,
    marginBottom: Spacing.lg,
  },
  toggleButton: {
    flex: 1,
    paddingVertical: 8,
    alignItems: 'center',
    borderRadius: 8,
  },
  toggleButtonActive: {
    backgroundColor: Colors.cardSurface,
  },
  toggleText: {
    fontSize: FontSizes.md,
    fontWeight: '600',
    color: Colors.textTertiary,
  },
  toggleTextActive: {
    color: Colors.textPrimary,
  },

  // Section
  section: {
    marginBottom: Spacing.md,
  },
  label: {
    fontSize: FontSizes.sm,
    color: Colors.textSecondary,
    marginBottom: Spacing.sm,
    marginTop: Spacing.md,
  },

  // Inputs
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  numberInput: {
    backgroundColor: Colors.background,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: FontSizes.md,
    color: Colors.textPrimary,
    minWidth: 70,
    borderWidth: 1,
    borderColor: Colors.hairlineBorder,
  },
  customInput: {
    marginTop: Spacing.sm,
    width: '100%',
  },
  unitSuffix: {
    fontSize: FontSizes.md,
    color: Colors.textSecondary,
  },
  servingsLink: {
    fontSize: FontSizes.xs,
    color: Colors.accent,
    marginTop: Spacing.xs,
  },

  // Auto serving display (D-165)
  autoServingDisplay: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 6,
    paddingVertical: 8,
  },
  autoServingValue: {
    fontSize: FontSizes.xxl,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  autoServingUnit: {
    fontSize: FontSizes.md,
    color: Colors.textSecondary,
  },
  autoServingMath: {
    fontSize: FontSizes.xs,
    color: Colors.textTertiary,
    marginTop: 2,
  },
  budgetMetText: {
    fontSize: FontSizes.sm,
    color: Colors.severityAmber,
    marginTop: Spacing.sm,
  },
  autoReference: {
    fontSize: FontSizes.xs,
    color: Colors.textTertiary,
    marginTop: Spacing.sm,
  },
  warningText: {
    fontSize: FontSizes.xs,
    color: Colors.severityAmber,
    marginTop: Spacing.sm,
  },
  underBudgetText: {
    fontSize: FontSizes.xs,
    color: Colors.textTertiary,
    marginTop: Spacing.sm,
  },

  // Chips
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  chip: {
    backgroundColor: Colors.background,
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: Colors.hairlineBorder,
  },
  chipSelected: {
    borderColor: Colors.accent,
    backgroundColor: Colors.cardSurface,
  },
  chipText: {
    fontSize: FontSizes.sm,
    color: Colors.textSecondary,
  },
  chipTextSelected: {
    color: Colors.accent,
  },

  // Stepper
  stepperRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  stepperButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Colors.background,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: Colors.hairlineBorder,
  },
  stepperValue: {
    fontSize: FontSizes.xl,
    fontWeight: '700',
    color: Colors.textPrimary,
    minWidth: 24,
    textAlign: 'center',
  },

  // Info rows
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: Spacing.sm,
  },
  infoText: {
    fontSize: FontSizes.xs,
    color: Colors.textSecondary,
    flex: 1,
  },

  // Error
  errorText: {
    fontSize: FontSizes.sm,
    color: Colors.severityRed,
    marginBottom: Spacing.sm,
  },

  // Confirm
  confirmButton: {
    backgroundColor: Colors.accent,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: Spacing.lg,
  },
  confirmButtonDisabled: {
    opacity: 0.5,
  },
  confirmButtonText: {
    fontSize: FontSizes.md,
    fontWeight: '700',
    color: Colors.textPrimary,
  },

  // ─── Phase C Specific Styles ────────────────────────────

  // Yes/No Toggle (Pill)
  pillToggleRow: {
    flexDirection: 'row',
    backgroundColor: Colors.background,
    borderRadius: 20, // pill shape
    padding: 3,
    marginBottom: Spacing.md,
  },
  pillButton: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderRadius: 18,
  },
  pillButtonActive: {
    backgroundColor: Colors.cardSurface,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 1.41,
    elevation: 2,
  },
  pillText: {
    fontSize: FontSizes.md,
    fontWeight: '600',
    color: Colors.textTertiary,
  },
  pillTextActive: {
    color: Colors.textPrimary,
  },

  // Safe Switch Flow
  advisoryCard: {
    backgroundColor: 'rgba(255, 179, 71, 0.08)',
    borderRadius: 12,
    padding: Spacing.md,
    borderLeftWidth: 3,
    borderLeftColor: Colors.severityAmber,
    marginBottom: Spacing.lg,
  },
  advisoryTitle: {
    fontSize: FontSizes.sm,
    fontWeight: '600',
    color: Colors.severityAmber,
    marginBottom: 4,
  },
  advisoryText: {
    fontSize: FontSizes.sm,
    color: Colors.textSecondary,
    lineHeight: 20,
  },

  // Meal Allocation
  mealSentence: {
    fontSize: FontSizes.md,
    color: Colors.textSecondary,
    marginBottom: Spacing.md,
  },
  mealSentenceBold: {
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  stepperContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    borderRadius: 12,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.hairlineBorder,
  },
  stepperLabel: {
    fontSize: FontSizes.md,
    fontWeight: '500',
    color: Colors.textPrimary,
  },
  stepperDisabled: {
    opacity: 0.3,
  },

  // Auto Computation Status
  autoStatusRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    marginTop: Spacing.lg,
    gap: 8,
  },
  autoBadge: {
    backgroundColor: 'rgba(10, 132, 255, 0.15)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  autoBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    color: Colors.accent,
    textTransform: 'uppercase',
  },
  manualBadge: {
    backgroundColor: 'transparent',
    borderColor: Colors.textTertiary,
    borderWidth: 1,
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 4,
  },
  manualBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    color: Colors.textTertiary,
    textTransform: 'uppercase',
  },
  autoResultValue: {
    fontSize: 32,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  autoResultUnit: {
    fontSize: FontSizes.lg,
    color: Colors.textSecondary,
  },
  autoMathLine: {
    fontSize: FontSizes.sm,
    color: Colors.textTertiary,
    marginTop: 4,
  },
  dimmedText: {
    opacity: 0.6,
  },

  // Conversions
  conversionToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: Spacing.md,
  },
  conversionLinkText: {
    fontSize: FontSizes.sm,
    fontWeight: '600',
    color: Colors.textTertiary,
  },
  conversionExpanded: {
    marginTop: Spacing.sm,
    padding: Spacing.md,
    backgroundColor: 'rgba(255, 255, 255, 0.02)',
    borderRadius: 8,
  },
  conversionText: {
    fontSize: FontSizes.sm,
    color: Colors.textSecondary,
    marginBottom: 4,
  },

  // Rebalance Note
  rebalanceNoteRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: Spacing.md,
    backgroundColor: 'rgba(255, 179, 71, 0.15)',
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 16,
  },
  rebalanceNoteText: {
    fontSize: FontSizes.xs,
    fontWeight: '500',
    color: Colors.severityAmber,
  },
  stepperHintText: {
    fontSize: FontSizes.xs,
    color: Colors.textTertiary,
    marginTop: 4,
    marginBottom: Spacing.sm,
  },

  cupEstimate: {
    fontSize: FontSizes.sm,
    color: Colors.textSecondary,
    marginTop: Spacing.xs,
  },

  // Overrides / Utils
  resetToAutoLink: {
    marginTop: Spacing.sm,
  },
  resetToAutoText: {
    fontSize: FontSizes.sm,
    fontWeight: '600',
    color: Colors.accent,
  },
  bottomSpacer: {
    height: 34,
  },
});
