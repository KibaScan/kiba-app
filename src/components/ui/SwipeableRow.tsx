// Kiba — SwipeableRow
// Reusable swipe-to-reveal wrapper for list rows.
// Swipe left → Delete action. Swipe right → Edit action (optional).
// Used on: health records, medications, appointments. Future: pantry items.

import React, { useRef, useCallback } from 'react';
import { View, Text, StyleSheet, Alert, Animated } from 'react-native';
import { Swipeable, RectButton } from 'react-native-gesture-handler';
import { Colors, FontSizes, Spacing } from '../../utils/constants';
import { deleteConfirm } from '../../utils/haptics';

interface Props {
  children: React.ReactNode;
  /** Called after user confirms deletion. Parent should perform the actual delete + state update. */
  onDelete?: () => void;
  /** Called when user taps the Edit action. */
  onEdit?: () => void;
  /** Confirmation message for delete alert. If omitted, deletes without confirmation. */
  deleteConfirmMessage?: string;
  /** Label for the delete button. Default: "Delete" */
  deleteLabel?: string;
  /** Label for the edit button. Default: "Edit" */
  editLabel?: string;
}

export default function SwipeableRow({
  children,
  onDelete,
  onEdit,
  deleteConfirmMessage,
  deleteLabel = 'Delete',
  editLabel = 'Edit',
}: Props) {
  const swipeableRef = useRef<Swipeable>(null);

  const close = useCallback(() => {
    swipeableRef.current?.close();
  }, []);

  const handleDelete = useCallback(() => {
    if (!onDelete) return;
    if (deleteConfirmMessage) {
      Alert.alert('Confirm Delete', deleteConfirmMessage, [
        { text: 'Cancel', style: 'cancel', onPress: close },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            deleteConfirm();
            close();
            onDelete();
          },
        },
      ]);
    } else {
      deleteConfirm();
      close();
      onDelete();
    }
  }, [onDelete, deleteConfirmMessage, close]);

  const handleEdit = useCallback(() => {
    close();
    onEdit?.();
  }, [onEdit, close]);

  const renderRightActions = useCallback(
    (_progress: Animated.AnimatedInterpolation<number>, dragX: Animated.AnimatedInterpolation<number>) => {
      if (!onDelete) return null;
      const translateX = dragX.interpolate({
        inputRange: [-80, 0],
        outputRange: [0, 80],
        extrapolate: 'clamp',
      });
      return (
        <Animated.View style={[styles.rightAction, { transform: [{ translateX }] }]}>
          <RectButton style={styles.deleteButton} onPress={handleDelete}>
            <Text style={styles.deleteText}>{deleteLabel}</Text>
          </RectButton>
        </Animated.View>
      );
    },
    [onDelete, handleDelete, deleteLabel],
  );

  const renderLeftActions = useCallback(
    (_progress: Animated.AnimatedInterpolation<number>, dragX: Animated.AnimatedInterpolation<number>) => {
      if (!onEdit) return null;
      const translateX = dragX.interpolate({
        inputRange: [0, 80],
        outputRange: [-80, 0],
        extrapolate: 'clamp',
      });
      return (
        <Animated.View style={[styles.leftAction, { transform: [{ translateX }] }]}>
          <RectButton style={styles.editButton} onPress={handleEdit}>
            <Text style={styles.editText}>{editLabel}</Text>
          </RectButton>
        </Animated.View>
      );
    },
    [onEdit, handleEdit, editLabel],
  );

  // If no swipe actions, render children directly
  if (!onDelete && !onEdit) {
    return <>{children}</>;
  }

  return (
    <Swipeable
      ref={swipeableRef}
      friction={2}
      overshootLeft={false}
      overshootRight={false}
      renderRightActions={onDelete ? renderRightActions : undefined}
      renderLeftActions={onEdit ? renderLeftActions : undefined}
    >
      {children}
    </Swipeable>
  );
}

const ACTION_WIDTH = 80;

const styles = StyleSheet.create({
  rightAction: {
    width: ACTION_WIDTH,
    justifyContent: 'center',
    alignItems: 'center',
  },
  deleteButton: {
    flex: 1,
    width: ACTION_WIDTH,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: Colors.severityRed,
    borderRadius: 8,
  },
  deleteText: {
    fontSize: FontSizes.sm,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  leftAction: {
    width: ACTION_WIDTH,
    justifyContent: 'center',
    alignItems: 'center',
  },
  editButton: {
    flex: 1,
    width: ACTION_WIDTH,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: Colors.accent,
    borderRadius: 8,
  },
  editText: {
    fontSize: FontSizes.sm,
    fontWeight: '600',
    color: '#FFFFFF',
  },
});
