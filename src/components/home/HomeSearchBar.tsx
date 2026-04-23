import React from 'react';
import {
  View,
  TextInput,
  TouchableOpacity,
  Text,
  ActivityIndicator,
  StyleSheet,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, FontSizes, Spacing } from '../../utils/constants';

interface HomeSearchBarProps {
  canSearch: boolean;
  searchQuery: string;
  searchLoading: boolean;
  onChangeText: (text: string) => void;
  onFocus: () => void;
  onClear: () => void;
  onFacadePress: () => void;
}

export function HomeSearchBar({
  canSearch,
  searchQuery,
  searchLoading,
  onChangeText,
  onFocus,
  onClear,
  onFacadePress,
}: HomeSearchBarProps) {
  return (
    <View style={styles.searchBarContainer}>
      {canSearch ? (
        <View style={styles.searchBar}>
          <Ionicons name="search-outline" size={18} color={Colors.textTertiary} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search pet food products..."
            placeholderTextColor={Colors.textTertiary}
            value={searchQuery}
            onChangeText={onChangeText}
            onFocus={onFocus}
            returnKeyType="search"
            autoCorrect={false}
          />
          {searchLoading && <ActivityIndicator size="small" color={Colors.accent} />}
          {searchQuery.length > 0 && !searchLoading && (
            <TouchableOpacity onPress={onClear} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Ionicons name="close-circle" size={16} color={Colors.textTertiary} />
            </TouchableOpacity>
          )}
        </View>
      ) : (
        <TouchableOpacity
          style={styles.searchBar}
          onPress={onFacadePress}
          activeOpacity={0.7}
        >
          <Ionicons name="search-outline" size={18} color={Colors.textTertiary} />
          <Text style={styles.searchPlaceholder}>Search pet food products...</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  searchBarContainer: {
    marginBottom: Spacing.md,
  },
  searchBar: {
    height: 44,
    backgroundColor: Colors.cardSurface,
    borderRadius: 12,
    paddingHorizontal: Spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: FontSizes.md,
    color: Colors.textPrimary,
    padding: 0,
  },
  searchPlaceholder: {
    flex: 1,
    fontSize: FontSizes.md,
    color: Colors.textTertiary,
  },
});
