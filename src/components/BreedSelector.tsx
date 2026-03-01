// Kiba — Breed Selector (D-102)
// Reusable modal breed picker. Alphabetical with search, pinned entries at bottom.
// Consumed by CreatePetScreen and EditPetScreen.

import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  Modal,
  StyleSheet,
  SafeAreaView,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, FontSizes, Spacing } from '../utils/constants';
import { chipToggle } from '../utils/haptics';
import { DOG_BREEDS, CAT_BREEDS } from '../data/breeds';

const PINNED = ['Mixed Breed', 'Unknown / Other'];

interface BreedSelectorProps {
  species: 'dog' | 'cat';
  value: string | null;
  onChange: (breed: string) => void;
  visible: boolean;
  onClose: () => void;
}

export default function BreedSelector({
  species,
  value,
  onChange,
  visible,
  onClose,
}: BreedSelectorProps) {
  const [query, setQuery] = useState('');

  const breedList = species === 'dog' ? DOG_BREEDS : CAT_BREEDS;

  const displayList = useMemo(() => {
    const alphabetical = breedList.filter((b) => !PINNED.includes(b));
    const filtered = query
      ? alphabetical.filter((b) =>
          b.toLowerCase().includes(query.toLowerCase()),
        )
      : alphabetical;
    return [...filtered, ...PINNED];
  }, [breedList, query]);

  function handleSelect(breed: string) {
    chipToggle();
    onChange(breed);
    setQuery('');
    onClose();
  }

  function handleClose() {
    setQuery('');
    onClose();
  }

  function renderItem({ item }: { item: string }) {
    const isSelected = item === value;
    const isPinned = PINNED.includes(item);

    return (
      <TouchableOpacity
        style={[
          styles.breedRow,
          isSelected && styles.breedRowSelected,
          isPinned && styles.breedRowPinned,
        ]}
        activeOpacity={0.6}
        onPress={() => handleSelect(item)}
      >
        <Text
          style={[styles.breedText, isSelected && styles.breedTextSelected]}
        >
          {item}
        </Text>
        {isSelected && (
          <Ionicons name="checkmark" size={20} color={Colors.accent} />
        )}
      </TouchableOpacity>
    );
  }

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={handleClose}
    >
      <SafeAreaView style={styles.container}>
        <KeyboardAvoidingView
          style={styles.flex}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <View style={styles.header}>
            <Text style={styles.title}>Select Breed</Text>
            <TouchableOpacity
              onPress={handleClose}
              hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            >
              <Ionicons name="close" size={24} color={Colors.textPrimary} />
            </TouchableOpacity>
          </View>

          <View style={styles.searchContainer}>
            <Ionicons
              name="search"
              size={18}
              color={Colors.textTertiary}
              style={styles.searchIcon}
            />
            <TextInput
              style={styles.searchInput}
              placeholder="Search breeds..."
              placeholderTextColor={Colors.textTertiary}
              value={query}
              onChangeText={setQuery}
              autoCapitalize="words"
              autoCorrect={false}
              returnKeyType="search"
            />
            {query.length > 0 && (
              <TouchableOpacity onPress={() => setQuery('')}>
                <Ionicons
                  name="close-circle"
                  size={18}
                  color={Colors.textTertiary}
                />
              </TouchableOpacity>
            )}
          </View>

          <FlatList
            data={displayList}
            keyExtractor={(item) => item}
            renderItem={renderItem}
            contentContainerStyle={styles.list}
            keyboardShouldPersistTaps="handled"
          />
        </KeyboardAvoidingView>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
  },
  title: {
    fontSize: FontSizes.xl,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.card,
    borderRadius: 12,
    marginHorizontal: Spacing.lg,
    marginBottom: Spacing.md,
    paddingHorizontal: Spacing.md,
    height: 44,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
  },
  searchIcon: {
    marginRight: Spacing.sm,
  },
  searchInput: {
    flex: 1,
    fontSize: FontSizes.md,
    color: Colors.textPrimary,
    height: 44,
  },
  list: {
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.xl,
  },
  breedRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: Spacing.md,
    borderRadius: 8,
    marginBottom: 2,
  },
  breedRowSelected: {
    backgroundColor: '#00B4D815',
  },
  breedRowPinned: {
    borderTopWidth: 1,
    borderTopColor: Colors.cardBorder,
    marginTop: Spacing.sm,
  },
  breedText: {
    fontSize: FontSizes.md,
    color: Colors.textPrimary,
  },
  breedTextSelected: {
    color: Colors.accent,
    fontWeight: '600',
  },
});
