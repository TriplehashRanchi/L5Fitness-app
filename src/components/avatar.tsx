import { Image } from 'expo-image';
import { useState } from 'react';
import { Text, View } from 'react-native';

import { useT } from '@/providers/language-provider';

/** "Gautam Pandit" → "GP". Falls back to "L5" when there is no name. */
function initialsOf(name: string) {
  return (
    name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((word) => word[0]?.toUpperCase())
      .join('') || 'L5'
  );
}

/**
 * The member's profile picture (for example from their Google account), or their initials when
 * they have none or it cannot be loaded (offline, removed, blocked).
 */
export function Avatar({ name, image, size = 48 }: { name: string; image?: string | null; size?: number }) {
  // Remember which address failed, so a new picture URL gets a fresh try.
  const [failed, setFailed] = useState<string | null>(null);
  const showImage = !!image && failed !== image;
  const t = useT();

  return (
    <View
      className="items-center justify-center overflow-hidden rounded-full bg-brand"
      style={{ width: size, height: size }}>
      {showImage ? (
        <Image
          source={{ uri: image }}
          style={{ width: size, height: size }}
          contentFit="cover"
          transition={150}
          cachePolicy="disk"
          onError={() => setFailed(image)}
          accessibilityIgnoresInvertColors
          accessibilityLabel={t('prof.avatar.label', { name })}
        />
      ) : (
        // Sized to the circle, so the letters also fit a small picture (next to a chat message).
        <Text maxFontSizeMultiplier={1.3} className="font-black text-ink" style={{ fontSize: Math.max(11, Math.min(18, size * 0.38)) }}>
          {initialsOf(name)}
        </Text>
      )}
    </View>
  );
}
