import { SymbolView } from 'expo-symbols';
import { useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, Animated as RNAnimated, Easing, Modal, Pressable, ScrollView, Text, View } from 'react-native';
import Animated, { useAnimatedStyle, useReducedMotion, useSharedValue, withSequence, withSpring, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { DisplayText } from '@/components/display-text';
import { StoryVideo } from '@/components/story-video';
import { type Story } from '@/lib/story-api';
import { useT } from '@/providers/language-provider';

const BRAND = '#3ddc68';
const INK = '#050a07';
const COMPACT_TEXT = { maxFontSizeMultiplier: 1.3 } as const;

/** The colours a story is dressed in, on its Home cover and full screen. `soft` is the text colour, faded. */
export const STORY_COLORS = [
  { bg: '#F4EBDD', fg: '#1c1710', soft: 'rgba(28,23,16,0.2)' },
  { bg: '#3ddc68', fg: '#050a07', soft: 'rgba(5,10,7,0.2)' },
  { bg: '#FFD6E3', fg: '#6d0a33', soft: 'rgba(109,10,51,0.2)' },
  { bg: '#2456E6', fg: '#ffffff', soft: 'rgba(255,255,255,0.3)' },
  { bg: '#FF9466', fg: '#2e1005', soft: 'rgba(46,16,5,0.2)' },
  { bg: '#CDBEFF', fg: '#1f1250', soft: 'rgba(31,18,80,0.2)' },
] as const;

export const storyColor = (index: number) => STORY_COLORS[index % STORY_COLORS.length];

/** A video is watched on black. */
const VIDEO_COLOR = { bg: '#000000', fg: '#ffffff', soft: 'rgba(255,255,255,0.25)' } as const;

/** Long enough to read: by the length of the words, between 6 and 15 seconds. */
const readingMs = (text: string) => Math.min(15_000, Math.max(6_000, text.length * 70));

/** A heart and the number of cheers. It jumps when pressed. */
function CheerButton({ cheers, cheered, onPress }: { cheers: number; cheered: boolean; onPress: () => void }) {
  const t = useT();
  const reduced = useReducedMotion();
  const size = useSharedValue(1);
  const bounce = useAnimatedStyle(() => ({ transform: [{ scale: size.get() }] }));
  return (
    <Pressable
      onPress={() => {
        if (!reduced && !cheered) size.set(withSequence(withTiming(1.18, { duration: 120 }), withSpring(1)));
        onPress();
      }}
      hitSlop={6}
      accessibilityRole="button"
      accessibilityLabel={`${t(cheered ? 'story.cheered' : 'story.cheer')}. ${t('story.cheers', { n: cheers })}`}
      accessibilityState={{ selected: cheered }}
      className="active:opacity-70">
      <Animated.View style={[bounce, { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, minHeight: 50, minWidth: 150, paddingHorizontal: 24, borderRadius: 25, backgroundColor: cheered ? '#ffffff' : '#101010' }]}>
        <SymbolView name={cheered ? { ios: 'heart.fill', android: 'favorite', web: 'favorite' } : { ios: 'heart', android: 'favorite', web: 'favorite' }} tintColor={cheered ? INK : BRAND} size={18} />
        <Text {...COMPACT_TEXT} style={{ fontSize: 15, fontWeight: '800', color: cheered ? INK : '#ffffff' }}>
          {cheers > 0 ? `${t(cheered ? 'story.cheered' : 'story.cheer')} · ${cheers}` : t('story.cheer')}
        </Text>
      </Animated.View>
    </Pressable>
  );
}

/**
 * Stories full screen, one after another, like a status: a bar for each at the top, a tap on the right goes on and on
 * the left goes back, holding pauses, and the cross closes. A video story's bar follows its video. It does not move
 * on by itself when the phone asks for less motion or a screen reader is reading.
 */
export function StoryViewer({
  stories,
  index,
  onIndex,
  onClose,
  onCheer,
}: {
  stories: Story[];
  index: number;
  onIndex: (index: number) => void;
  onClose: () => void;
  onCheer: (story: Story) => void;
}) {
  const t = useT();
  const insets = useSafeAreaInsets();
  const reduced = useReducedMotion();
  const [reader, setReader] = useState(false);
  const [held, setHeld] = useState(false);
  const [progress] = useState(() => new RNAnimated.Value(0));
  /** How far the current bar has got, so letting go carries on from there. */
  const at = useRef(0);
  const story = stories[index];
  const auto = !reduced && !reader;
  const isVideo = !!story?.hasVideo;
  /** Words move on after a reading time; a video's bar follows the video. */
  const timed = auto && !isVideo;
  const filling = isVideo || auto;

  useEffect(() => {
    AccessibilityInfo.isScreenReaderEnabled().then(setReader).catch(() => {});
  }, []);

  // A new story starts its bar from the beginning. This comes before the effect that runs it.
  useEffect(() => {
    at.current = 0;
    progress.setValue(0);
  }, [story?.id, progress]);

  const next = () => (index + 1 < stories.length ? onIndex(index + 1) : onClose());
  const previous = () => {
    if (index > 0) return onIndex(index - 1);
    at.current = 0;
    progress.setValue(0);
  };

  useEffect(() => {
    if (!story || !timed || held) return;
    const run = RNAnimated.timing(progress, { toValue: 1, duration: readingMs(story.text) * (1 - at.current), easing: Easing.linear, useNativeDriver: false });
    run.start(({ finished }) => {
      if (finished) next();
    });
    return () => {
      progress.stopAnimation((value) => {
        at.current = value;
      });
    };
    // Restarted only for another story, a hold, or a change of setting; a cheer must not restart the bar.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [story?.id, timed, held]);

  if (!story) return null;
  const color = isVideo ? VIDEO_COLOR : storyColor(index);
  const hold = { onLongPress: () => setHeld(true), onPressOut: () => setHeld(false), delayLongPress: 200, accessibilityRole: 'button' as const };

  const zones = (
    <>
      <Pressable {...hold} onPress={previous} accessibilityLabel={t('story.previous')} style={{ flex: 1 }} />
      <Pressable {...hold} onPress={next} accessibilityLabel={t('story.next')} style={{ flex: 2 }} />
    </>
  );

  return (
    <Modal visible statusBarTranslucent navigationBarTranslucent animationType="fade" onRequestClose={onClose}>
      <View accessibilityViewIsModal className="flex-1" style={{ backgroundColor: color.bg, paddingTop: insets.top + 10, paddingBottom: insets.bottom + 18 }}>
        <View className="flex-row" style={{ gap: 4, paddingHorizontal: 14 }}>
          {stories.map((s, i) => (
            <View key={s.id} style={{ flex: 1, height: 3, borderRadius: 2, overflow: 'hidden', backgroundColor: color.soft }}>
              {i <= index ? (
                <RNAnimated.View style={{ height: 3, backgroundColor: color.fg, width: i < index || !filling ? '100%' : progress.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] }) }} />
              ) : null}
            </View>
          ))}
        </View>

        <View className="flex-row items-center" style={{ gap: 10, paddingHorizontal: 16, marginTop: 14 }}>
          <View className="items-center justify-center rounded-full" style={{ width: 42, height: 42, backgroundColor: color.fg }}>
            <Text maxFontSizeMultiplier={1} style={{ fontSize: 18, fontWeight: '900', color: color.bg }}>
              {[...story.name.trim()][0]?.toUpperCase() ?? ''}
            </Text>
          </View>
          <View className="flex-1">
            <Text {...COMPACT_TEXT} numberOfLines={1} style={{ fontSize: 15, fontWeight: '800', color: color.fg }}>
              {story.name}
            </Text>
            {story.programmeDay ? (
              <Text {...COMPACT_TEXT} style={{ fontSize: 12, color: color.fg }}>
                {t('story.day', { n: story.programmeDay })}
              </Text>
            ) : null}
          </View>
          <Pressable onPress={onClose} hitSlop={8} accessibilityRole="button" accessibilityLabel={t('common.close')} className="items-center justify-center rounded-full active:opacity-70" style={{ width: 38, height: 38, backgroundColor: color.soft }}>
            <SymbolView name={{ ios: 'xmark', android: 'close', web: 'close' }} tintColor={color.fg} size={18} />
          </Pressable>
        </View>

        {isVideo ? (
          <View className="flex-1" style={{ marginTop: 14, marginBottom: 14 }}>
            <StoryVideo
              key={story.id}
              id={story.id}
              paused={held}
              onProgress={(fraction) => progress.setValue(fraction)}
              onEnd={() => {
                if (auto) next();
              }}>
              {zones}
            </StoryVideo>
            <Text {...COMPACT_TEXT} numberOfLines={4} className="text-center font-semibold" style={{ fontSize: 15, lineHeight: 22, color: color.fg, paddingHorizontal: 24, marginTop: 12 }}>
              {story.text}
            </Text>
          </View>
        ) : (
          <View className="flex-1">
            <ScrollView key={story.id} contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', paddingHorizontal: 28, paddingVertical: 24 }}>
              <DisplayText maxFontSizeMultiplier={1} accessibilityElementsHidden importantForAccessibility="no" style={{ fontSize: 80, lineHeight: 80, height: 48, color: color.fg }}>
                “
              </DisplayText>
              <Text {...COMPACT_TEXT} style={{ fontSize: story.text.length > 160 ? 23 : 29, lineHeight: story.text.length > 160 ? 34 : 41, fontWeight: '800', color: color.fg }}>
                {story.text}
              </Text>
            </ScrollView>
            {/* Over the words: left goes back, right goes on, holding pauses. */}
            <View className="absolute inset-0 flex-row">{zones}</View>
          </View>
        )}

        <View className="items-center" style={{ minHeight: 50, paddingHorizontal: 20 }}>
          <CheerButton key={story.id} cheers={story.cheers} cheered={story.cheered} onPress={() => onCheer(story)} />
        </View>
      </View>
    </Modal>
  );
}
