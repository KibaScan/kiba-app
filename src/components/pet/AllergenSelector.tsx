// Kiba — Allergen "Other" Selector (D-097)
// Modal searchable dropdown for extended protein allergens.
// Hardcoded list — NOT free text (D-097 safety: free text bypasses D-098 cross-reactivity).
// Pattern matches BreedSelector.

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
import { Colors, FontSizes, Spacing } from '../../utils/constants';
import { chipToggle } from '../../utils/haptics';
import { OTHER_ALLERGENS } from '../../data/conditions';

interface AllergenSelectorProps {
  selectedNames: string[];
  onSelect: (name: string) => void;
  visible: boolean;
  onClose: () => void;
}

export default function AllergenSelector({
  selectedNames,
  onSelect,
  visible,
  onClose,
}: AllergenSelectorProps) {
  const [query, setQuery] = useState('');

  const displayList = useMemo(() => {
    if (!query) return OTHER_ALLERGENS;
    return OTHER_ALLERGENS.filter((a) =>
      a.label.toLowerCase().includes(query.toLowerCase()),
    );
  }, [query]);

  function handleSelect(name: string) {
    chipToggle();
    onSelect(name);
    setQuery('');
    onClose();
  }

  function handleClose() {
    setQuery('');
    onClose();
  }

  function renderItem({ item }: { item: (typeof OTHER_ALLERGENS)[number] }) {
    const isSelected = selectedNames.includes(item.name);

    return (
      <TouchableOpacity
        style={[styles.row, isSelected && styles.rowSelected]}
        activeOpacity={0.6}
        onPress={() => handleSelect(item.name)}
      >
        <Text style={[styles.rowText, isSelected && styles.rowTextSelected]}>
          {item.label}
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
            <Text style={styles.title}>Other Allergens</Text>
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
              placeholder="Search proteins..."
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
            keyExtractor={(item) => item.name}
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
    backgroundColor: Colors.cardSurface,
    borderRadius: 12,
    marginHorizontal: Spacing.lg,
    marginBottom: Spacing.md,
    paddingHorizontal: Spacing.md,
    height: 44,
    borderWidth: 1,
    borderColor: Colors.hairlineBorder,
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
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: Spacing.md,
    borderRadius: 8,
    marginBottom: 2,
  },
  rowSelected: {
    backgroundColor: '#00B4D815',
  },
  rowText: {
    fontSize: FontSizes.md,
    color: Colors.textPrimary,
  },
  rowTextSelected: {
    color: Colors.accent,
    fontWeight: '600',
  },
});
