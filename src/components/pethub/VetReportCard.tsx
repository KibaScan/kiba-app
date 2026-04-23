// PetHub — Vet Report card sub-component
// Extracted from PetHubScreen.tsx. Props only — no local state, no hooks.

import React from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../utils/constants';
import { styles } from '../../screens/pethub/PetHubStyles';

interface Props {
  loading: boolean;
  onPress: () => void;
}

export function VetReportCard({ loading, onPress }: Props) {
  return (
    <TouchableOpacity
      style={styles.vetReportCard}
      activeOpacity={0.7}
      onPress={onPress}
      disabled={loading}
    >
      <View style={styles.vetReportRow}>
        {loading ? (
          <ActivityIndicator size="small" color={Colors.accent} />
        ) : (
          <Ionicons name="document-text-outline" size={22} color={Colors.accent} />
        )}
        <View style={{ flex: 1 }}>
          <Text style={styles.vetReportTitle}>Vet Report</Text>
          <Text style={styles.vetReportDesc}>
            {loading ? 'Generating…' : 'Generate a shareable diet summary for your vet'}
          </Text>
        </View>
        <Ionicons name="chevron-forward" size={16} color={Colors.textTertiary} />
      </View>
    </TouchableOpacity>
  );
}
