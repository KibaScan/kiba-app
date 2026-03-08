// Kiba — Share Card Capture + Share Utility
// Captures a React Native View as PNG and opens native share sheet.
// Fallback: text-only share if view capture fails.

import { Share, Platform } from 'react-native';
import type { RefObject } from 'react';
import type { View } from 'react-native';
import { captureRef } from 'react-native-view-shot';
import * as Sharing from 'expo-sharing';

export async function captureAndShare(
  viewRef: RefObject<View | null>,
  petName: string,
  score: number,
): Promise<void> {
  try {
    if (!viewRef.current) throw new Error('View ref not ready');

    const uri = await captureRef(viewRef, {
      format: 'png',
      quality: 1,
      result: 'tmpfile',
      // 2x for Retina
      ...(Platform.OS !== 'web' ? { pixelRatio: 2 } : {}),
    });

    const isAvailable = await Sharing.isAvailableAsync();
    if (isAvailable) {
      await Sharing.shareAsync(uri, {
        mimeType: 'image/png',
        UTI: 'public.png',
      });
    } else {
      await shareTextFallback(petName, score);
    }
  } catch {
    await shareTextFallback(petName, score);
  }
}

async function shareTextFallback(petName: string, score: number): Promise<void> {
  const message = score > 0
    ? `${petName}'s food scored ${score}% on Kiba — scan yours at kibascan.com`
    : `Check out ${petName} on Kiba — scan your pet's food at kibascan.com`;
  await Share.share({ message });
}
