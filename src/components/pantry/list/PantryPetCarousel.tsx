// Kiba — PantryPetCarousel
// Multi-pet switcher shown above filter chips when hasMultiplePets.
// Extracted from PantryScreen.tsx — zero behavior change.

import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Image,
  ScrollView,
  StyleSheet,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Spacing } from '../../../utils/constants';

type Pet = {
  id: string;
  name: string;
  photo_url?: string | null;
};

type Props = {
  pets: Pet[];
  activePetId: string | null;
  onSelect: (petId: string) => void;
};

export function PantryPetCarousel({ pets, activePetId, onSelect }: Props) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.carouselContent}
      style={styles.carousel}
    >
      {pets.map(pet => {
        const isActive = pet.id === activePetId;
        return (
          <TouchableOpacity
            key={pet.id}
            onPress={() => !isActive && onSelect(pet.id)}
            activeOpacity={0.7}
            style={styles.carouselItem}
          >
            <View style={[
              styles.carouselAvatar,
              isActive ? styles.carouselAvatarActive : styles.carouselAvatarInactive,
            ]}>
              {pet.photo_url ? (
                <Image
                  source={{ uri: pet.photo_url }}
                  style={[
                    styles.carouselPhoto,
                    isActive ? styles.carouselPhotoActive : styles.carouselPhotoInactive,
                  ]}
                />
              ) : (
                <Ionicons
                  name="paw-outline"
                  size={isActive ? 20 : 16}
                  color={Colors.accent}
                />
              )}
            </View>
            <Text
              style={[styles.carouselName, !isActive && styles.carouselNameInactive]}
              numberOfLines={1}
            >
              {pet.name}
            </Text>
          </TouchableOpacity>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  carousel: {
    flexGrow: 0,
    marginTop: 0,
    marginBottom: 0,
  },
  carouselContent: {
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
    gap: 10,
    alignItems: 'center',
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
    padding: 3, // Story Ring cutout — matches .agent/design.md:218-242 + PetHubStyles canonical pattern
  },
  carouselAvatarInactive: {
    width: 36,
    height: 36,
    borderRadius: 18,
    opacity: 0.5,
  },
  carouselPhoto: {
    borderRadius: 22,
  },
  carouselPhotoActive: {
    width: 40,
    height: 40,
    borderRadius: 20,
  },
  carouselPhotoInactive: {
    width: 36,
    height: 36,
    borderRadius: 18,
  },
  carouselName: {
    fontSize: 10,
    color: Colors.textPrimary,
    marginTop: 2,
    textAlign: 'center',
  },
  carouselNameInactive: {
    opacity: 0.5,
  },
});
