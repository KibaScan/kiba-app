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
  cupEquivalent: {
    fontSize: FontSizes.xs,
    color: Colors.textTertiary,
    marginTop: Spacing.xs,
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

  bottomSpacer: {
    height: 34,
  },
});
