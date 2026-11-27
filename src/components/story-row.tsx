import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { useCallback, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';

import { DisplayText } from '@/components/display-text';
import { storyColor, StoryViewer } from '@/components/story-viewer';
import { cheerStory, getStories, type Story } from '@/lib/story-api';
import { useT } from '@/providers/language-provider';

const BRAND = '#3ddc68';
const SEEN_RING = 'rgba(255,255,255,0.22)';
/** A cover is a little taller than wide, like a book. The ring stands just off it. */
const COVER = { width: 100, height: 132 } as const;
const RING = { borderWidth: 2.5, borderRadius: 26, padding: 3 } as const;

/** Where this phone remembers which stories its user has opened. */
const seenStore = (viewerId: string) => `l5.storySeen.${viewerId}`;

/** One story in the row: its name and first words on a coloured cover. A green ring until it has been opened. */
function Cover({ story, index, seen, onPress }: { story: Story; index: number; seen: boolean; onPress: () => void }) {
  const color = storyColor(index);
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={`${story.name}. ${story.text}`} className="active:opacity-80" style={{ ...RING, borderColor: seen ? SEEN_RING : BRAND }}>
      <View style={{ ...COVER, borderRadius: 20, overflow: 'hidden', padding: 10, backgroundColor: color.bg }}>
        <Text maxFontSizeMultiplier={1} numberOfLines={2} style={{ fontSize: 14, lineHeight: 17, fontWeight: '900', color: color.fg }}>
          {story.name}
        </Text>
        <Text maxFontSizeMultiplier={1} numberOfLines={4} style={{ fontSize: 10.5, lineHeight: 14, fontWeight: '600', color: color.fg, marginTop: 6 }}>
          {story.text}
        </Text>
        {story.hasVideo ? (
          <View className="items-center justify-center rounded-full" style={{ position: 'absolute', left: 8, bottom: 8, width: 30, height: 30, backgroundColor: 'rgba(0,0,0,0.75)' }}>
            <SymbolView name={{ ios: 'play.fill', android: 'play_arrow', web: 'play_arrow' }} tintColor="#ffffff" size={15} />
          </View>
        ) : null}
        {/* A large quote mark in the corner, as the cover's picture. */}
        <DisplayText maxFontSizeMultiplier={1} accessibilityElementsHidden importantForAccessibility="no" style={{ position: 'absolute', right: 8, bottom: -26, fontSize: 70, lineHeight: 70, color: color.soft }}>
          ”
        </DisplayText>
      </View>
    </Pressable>
  );
}

/**
 * Home's member stories: a row of covers that open full screen, like a status, where they can be cheered. Nothing
 * shows when there are none or they cannot be loaded.
 */
export function StoryRow({ viewerId, refreshKey }: { viewerId: string; refreshKey?: string }) {
  const t = useT();
  const [stories, setStories] = useState<Story[]>([]);
  const [seen, setSeen] = useState<string[]>([]);
  /** Which story is open full screen; null while the viewer is closed. */
  const [open, setOpen] = useState<number | null>(null);

  useFocusEffect(
    useCallback(() => {
      let live = true;
      Promise.all([getStories(), AsyncStorage.getItem(seenStore(viewerId)).catch(() => null)])
        .then(([s, saved]) => {
          if (!live) return;
          try {
            setSeen(saved ? (JSON.parse(saved) as string[]) : []);
          } catch {
            setSeen([]);
          }
          setStories(s.stories);
        })
        .catch(() => {});
      return () => {
        live = false;
        setOpen(null);
      };
      // A new key (pull to refresh) loads it again.
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [refreshKey, viewerId])
  );

  if (!stories.length) return null;

  /** Opens a story, or moves to it, and remembers it was seen. Only stories still shown are remembered. */
  const show = (index: number) => {
    setOpen(index);
    const id = stories[index]?.id;
    if (!id || seen.includes(id)) return;
    const next = [...seen.filter((x) => stories.some((s) => s.id === x)), id];
    setSeen(next);
    AsyncStorage.setItem(seenStore(viewerId), JSON.stringify(next)).catch(() => {});
  };

  // The heart moves at once and is then confirmed by the server's count.
  const cheer = async (story: Story) => {
    const on = !story.cheered;
    const set = (cheered: boolean, cheers: number) => setStories((all) => all.map((x) => (x.id === story.id ? { ...x, cheered, cheers } : x)));
    set(on, story.cheers + (on ? 1 : -1));
    try {
      const r = await cheerStory(story.id, on);
      set(r.cheered, r.cheers);
    } catch {
      set(story.cheered, story.cheers);
    }
  };

  return (
    // It drops into place as it arrives.
    <Animated.View entering={FadeInDown.duration(500)} style={{ marginBottom: 20 }}>
      <View style={{ paddingHorizontal: 20, marginBottom: 10 }}>
        <Text maxFontSizeMultiplier={1.3} accessibilityRole="header" className="font-black text-white" style={{ fontSize: 20 }}>
          {t('story.rowTitle')}
        </Text>
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 17, gap: 8 }}>
        {stories.map((story, i) => (
          <Cover key={story.id} story={story} index={i} seen={seen.includes(story.id)} onPress={() => show(i)} />
        ))}
      </ScrollView>
      {open !== null ? <StoryViewer stories={stories} index={open} onIndex={show} onClose={() => setOpen(null)} onCheer={(s) => void cheer(s)} /> : null}
    </Animated.View>
  );
}
