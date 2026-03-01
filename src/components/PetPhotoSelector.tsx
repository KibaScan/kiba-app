// Kiba — Reusable Pet Photo Selector
// Circular photo frame with species silhouette default.
// Tap opens ImagePicker. Upload to Supabase Storage happens at save time in petService.

import React from 'react';
import { View, TouchableOpacity, Image, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { Colors, Spacing } from '../utils/constants';

interface PetPhotoSelectorProps {
  photoUrl: string | null;
  species: 'dog' | 'cat';
  onPhotoSelected: (uri: string) => void;
}

export default function PetPhotoSelector({
  photoUrl,
  species,
  onPhotoSelected,
}: PetPhotoSelectorProps) {
  async function handlePress() {
    const result = await ImagePicker.launchImageLibraryAsync({
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.7,
      mediaTypes: ['images'],
    });
    if (!result.canceled && result.assets[0]) {
      onPhotoSelected(result.assets[0].uri);
    }
  }

  return (
    <TouchableOpacity
      style={styles.container}
      onPress={handlePress}
      activeOpacity={0.7}
    >
      {photoUrl ? (
        <Image source={{ uri: photoUrl }} style={styles.photo} />
      ) : (
        <View style={styles.placeholder}>
          <Ionicons name="paw-outline" size={40} color={Colors.accent} />
        </View>
      )}
      <View style={styles.editBadge}>
        <Ionicons name="camera" size={14} color={Colors.textPrimary} />
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    alignSelf: 'center',
    marginBottom: Spacing.md,
  },
  photo: {
    width: 96,
    height: 96,
    borderRadius: 48,
  },
  placeholder: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: '#00B4D815',
    justifyContent: 'center',
    alignItems: 'center',
  },
  editBadge: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: Colors.accent,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
