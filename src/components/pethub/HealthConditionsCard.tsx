// PetHub — Health Conditions card sub-component
// Extracted from PetHubScreen.tsx. Props only — no local state, no hooks.

import React from 'react';
import { View, Text, Image, TouchableOpacity, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../utils/constants';
import { styles } from '../../screens/pethub/PetHubStyles';
import { getConditionsForSpecies } from '../../data/conditions';
import { CONDITION_ICONS } from '../../constants/iconMaps';
import { CONDITION_SVG_ICONS } from '../icons/conditionSvgIcons';
import type { Pet, PetCondition, PetAllergen } from '../../types/pet';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { MeStackParamList } from '../../types/navigation';

type NavProp = NativeStackNavigationProp<MeStackParamList, 'MeMain'>;

interface Props {
  pet: Pet;
  conditions: PetCondition[];
  allergens: PetAllergen[];
  healthLoading: boolean;
  navigation: NavProp;
}

export function HealthConditionsCard({ pet, conditions, allergens, healthLoading, navigation }: Props) {
  const conditionDefs = getConditionsForSpecies(pet.species);
  const conditionItems = conditions.map((c) => {
    const def = conditionDefs.find((d) => d.tag === c.condition_tag);
    return {
      tag: c.condition_tag,
      label: def?.label ?? c.condition_tag,
      ionicon: (def?.icon ?? 'ellipsis-horizontal-circle-outline') as string,
    };
  });

  return (
    <View style={styles.healthRecordCard}>
      <View style={styles.healthRecordHeader}>
        <Text style={styles.healthRecordTitle}>Health Conditions</Text>
        {pet.health_reviewed_at != null && (
          <TouchableOpacity
            style={styles.headerSeeAll}
            activeOpacity={0.7}
            onPress={() =>
              navigation.navigate('HealthConditions', {
                petId: pet.id,
                fromCreate: false,
              })
            }
          >
            <Text style={styles.seeAllLinkText}>See All</Text>
            <Ionicons name="chevron-forward" size={14} color={Colors.accent} />
          </TouchableOpacity>
        )}
      </View>

      {healthLoading ? (
        <ActivityIndicator
          color={Colors.accent}
          size="small"
          style={styles.loadingSpinner}
        />
      ) : pet.health_reviewed_at == null ? (
        <TouchableOpacity
          style={styles.addRecordLink}
          activeOpacity={0.7}
          onPress={() =>
            navigation.navigate('HealthConditions', {
              petId: pet.id,
              fromCreate: false,
            })
          }
        >
          <Ionicons name="add-circle-outline" size={16} color={Colors.accent} />
          <Text style={styles.addRecordLinkText}>Set up health conditions</Text>
        </TouchableOpacity>
      ) : conditions.length === 0 ? (
        <View style={styles.healthyBadge}>
          <Ionicons
            name="shield-checkmark-outline"
            size={16}
            color={Colors.severityGreen}
          />
          <Text style={styles.healthyText}>No known conditions</Text>
        </View>
      ) : (
        <View>
          <View style={styles.conditionChips}>
            {conditionItems.slice(0, 4).map(({ tag, label, ionicon }) => {
              // Priority: SVG component > PNG asset > Ionicon fallback.
              // SVG wins when present because vector paths stay crisp at
              // any size, unlike the V1 thin-stroke PNGs.
              const SvgIcon = CONDITION_SVG_ICONS[tag];
              const customIcon = CONDITION_ICONS[tag];
              return (
                <View key={tag} style={styles.conditionChip}>
                  {SvgIcon ? (
                    <SvgIcon size={16} color={Colors.severityAmber} />
                  ) : customIcon ? (
                    <Image source={customIcon} style={styles.conditionChipIcon} />
                  ) : (
                    <Ionicons
                      name={ionicon as any}
                      size={16}
                      color={Colors.severityAmber}
                    />
                  )}
                  <Text style={styles.conditionChipText}>{label}</Text>
                </View>
              );
            })}
            {conditionItems.length > 4 && (
              <View style={styles.conditionChipOverflow}>
                <Text style={styles.conditionChipOverflowText}>
                  +{conditionItems.length - 4} more
                </Text>
              </View>
            )}
          </View>
          {allergens.length > 0 && (
            <Text style={styles.allergenCount}>
              {allergens.length} food allergen{allergens.length !== 1 ? 's' : ''} tracked
            </Text>
          )}
        </View>
      )}
    </View>
  );
}
