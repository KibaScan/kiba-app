// Kiba — MissedWarningBanner
// Inline advisory shown when the user has missed consecutive days of logging.
// D-084: Zero emoji. D-095: UPVM compliant copy.

import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, FontSizes, Spacing } from '../../utils/constants';

interface MissedWarningBannerProps {
  onRestart: () => void;
  onDismiss: () => void;
}

export default function MissedWarningBanner({ onRestart, onDismiss }: MissedWarningBannerProps) {
  return (
    <View style={styles.missedWarningBanner}>
      <Ionicons name="warning-outline" size={18} color={Colors.severityAmber} />
      <View style={styles.missedWarningContent}>
        <Text style={styles.missedWarningText}>
          You missed several days of logging. If you haven't been mixing the food as planned, consider restarting the schedule to reduce the risk of digestive discomfort.
        </Text>
        <View style={styles.missedWarningActions}>
          <TouchableOpacity onPress={onRestart} activeOpacity={0.7}>
            <Text style={styles.missedWarningActionRestart}>Restart</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={onDismiss} activeOpacity={0.7}>
            <Text style={styles.missedWarningActionDismiss}>Dismiss</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  missedWarningBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    backgroundColor: `${Colors.severityAmber}10`,
    borderLeftWidth: 3,
    borderLeftColor: Colors.severityAmber,
    borderRadius: 12,
    padding: Spacing.md,
    marginBottom: Spacing.md,
    borderWidth: 1,
    borderColor: `${Colors.severityAmber}30`,
  },
  missedWarningContent: { flex: 1, gap: 10 },
  missedWarningText: { fontSize: FontSizes.sm, color: Colors.severityAmber, lineHeight: 20 },
  missedWarningActions: { flexDirection: 'row', gap: 16 },
  missedWarningActionRestart: { fontSize: FontSizes.sm, fontWeight: '700', color: Colors.accent },
  missedWarningActionDismiss: { fontSize: FontSizes.sm, fontWeight: '600', color: Colors.textSecondary },
});
