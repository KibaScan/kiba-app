import React from 'react';
import { View, Text, Image, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, FontSizes, Spacing } from '../../utils/constants';

interface PantryNavRowProps {
  petName: string;
  photoUrl?: string | null;
  foodCount: number;
  treatCount: number;
  hasItems: boolean;
  onPress: () => void;
}

export function PantryNavRow({
  petName,
  photoUrl,
  foodCount,
  treatCount,
  hasItems,
  onPress,
}: PantryNavRowProps) {
  return (
    <TouchableOpacity
      style={styles.pantryRow}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <View style={styles.pantryRowAvatar}>
        {photoUrl ? (
          <Image source={{ uri: photoUrl }} style={styles.pantryRowPhoto} />
        ) : (
          <Ionicons name="paw-outline" size={12} color={Colors.accent} />
        )}
      </View>
      <Text style={styles.pantryRowTitle} numberOfLines={1}>
        {petName}&apos;s Pantry
      </Text>
      {hasItems ? (
        <Text style={styles.pantryRowSubtitle}>
          {foodCount} food{foodCount !== 1 ? 's' : ''} ·{' '}
          {treatCount} treat{treatCount !== 1 ? 's' : ''}
        </Text>
      ) : (
        <Text style={styles.pantryRowSubtitle}>Start tracking</Text>
      )}
      <Ionicons name="chevron-forward" size={16} color={Colors.textTertiary} />
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  pantryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: Colors.cardSurface,
    borderRadius: 16,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.hairlineBorder,
    marginBottom: Spacing.md,
  },
  pantryRowAvatar: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#00B4D815',
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  pantryRowPhoto: {
    width: 24,
    height: 24,
    borderRadius: 12,
  },
  pantryRowTitle: {
    fontSize: FontSizes.sm,
    fontWeight: '600',
    color: Colors.textPrimary,
  },
  pantryRowSubtitle: {
    flex: 1,
    fontSize: FontSizes.sm,
    color: Colors.textSecondary,
    textAlign: 'right',
  },
});
