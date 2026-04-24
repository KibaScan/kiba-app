// Overflow menu for ResultScreen header. Bookmark lives in its own header icon
// (visible state); this sheet hosts the secondary actions: Share + (optional)
// Flag this score + (optional) Contact brand + Report issue. The "Contact
// {brand}" item only renders when the parent has decided the brand has a
// published vendor row — visibility logic lives in ResultScreen so this stays
// a dumb presenter. The "Flag this score" item appears whenever the parent
// supplies onFlagScore (universally available for in-app scans, per D-072).

import React from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Spacing } from '../../utils/constants';

interface Props {
  visible: boolean;
  onClose: () => void;
  onShare: () => void;
  onReportIssue: () => void;
  onContactBrand?: () => void;
  brandName?: string;
  onFlagScore?: () => void;
}

export function ResultHeaderMenu({
  visible,
  onClose,
  onShare,
  onReportIssue,
  onContactBrand,
  brandName,
  onFlagScore,
}: Props) {
  const insets = useSafeAreaInsets();
  const handle = (fn: () => void) => () => {
    fn();
    onClose();
  };

  const showContact = Boolean(onContactBrand && brandName);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <Pressable
        style={styles.backdrop}
        onPress={onClose}
        accessibilityRole="button"
        accessibilityLabel="Close menu"
      >
        <Pressable
          style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, Spacing.md) + Spacing.md }]}
          onPress={(e) => e.stopPropagation()}
        >
          <MenuItem
            icon="share-outline"
            label="Share"
            onPress={handle(onShare)}
          />
          {onFlagScore && (
            <>
              <View style={styles.divider} />
              <MenuItem
                icon="alert-circle-outline"
                label="Flag this score"
                onPress={handle(onFlagScore)}
              />
            </>
          )}
          {showContact && (
            <>
              <View style={styles.divider} />
              <MenuItem
                icon="mail-outline"
                label={`Contact ${brandName}`}
                onPress={handle(onContactBrand!)}
              />
            </>
          )}
          <View style={styles.divider} />
          <MenuItem
            icon="flag-outline"
            label="Report issue"
            onPress={handle(onReportIssue)}
          />
        </Pressable>
      </Pressable>
    </Modal>
  );
}

function MenuItem({
  icon,
  label,
  onPress,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      style={({ pressed }) => [styles.item, pressed && styles.itemPressed]}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
    >
      <Ionicons name={icon} size={22} color={Colors.accent} />
      <Text style={styles.itemLabel}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: Colors.cardSurface,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    paddingVertical: Spacing.sm,
  },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
  },
  itemPressed: {
    backgroundColor: Colors.pressOverlay,
  },
  itemLabel: {
    color: Colors.textPrimary,
    fontSize: 17,
    fontWeight: '500',
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: Colors.hairlineBorder,
    marginHorizontal: Spacing.lg,
  },
});
