import { StatusBar } from 'expo-status-bar';
import { SymbolView } from 'expo-symbols';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Platform, Pressable, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Avatar } from '@/components/avatar';
import { ChatThread } from '@/components/chat/chat-thread';
import { ClientsList } from '@/components/clients-list';
import { CompleteProfileButton } from '@/components/complete-profile-button';
import { DisplayText } from '@/components/display-text';
import { BottomTabInset } from '@/constants/theme';
import { getMyChat, sendMyMessage, type MyChat } from '@/lib/chat-api';
import { messageFrom } from '@/lib/http';
import { useProfile } from '@/providers/profile-provider';

const BRAND = '#3ddc68';
const WEB_TOP_BAR = 72;
const COMPACT_TEXT = { maxFontSizeMultiplier: 1.3 } as const;
const MEMBER = { side: 'member' } as const;

export default function DietScreen() {
  const { role } = useProfile();
  // A member chats with their dietitian here. Dietitians and the admin get their client list.
  return role === 'member' ? <DietitianChat /> : <ClientsList />;
}

/**
 * The member's chat with their dietitian. (Their meals are on Home and in Activity.)
 * Until a dietitian is assigned there is nobody to write to, so the screen says what is missing instead.
 */
function DietitianChat() {
  const insets = useSafeAreaInsets();
  const isWeb = Platform.OS === 'web';
  const [info, setInfo] = useState<Pick<MyChat, 'coaching' | 'dietitian'> | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (after?: string) => {
    try {
      const page = await getMyChat(after);
      setInfo({ coaching: page.coaching, dietitian: page.dietitian });
      setError(null);
      return page;
    } catch (e) {
      setError(messageFrom(e));
      throw e;
    }
  }, []);

  const name = info?.dietitian?.name ?? 'Your dietitian';
  const waiting = info && !info.dietitian;
  const top = insets.top + (isWeb ? WEB_TOP_BAR : 8);
  const bottom = isWeb ? insets.bottom : insets.bottom + BottomTabInset;

  return (
    <View className="flex-1" style={{ backgroundColor: '#000000' }}>
      <StatusBar style="light" />
      {waiting ? (
        <View className="flex-1 items-center justify-center px-8" style={{ paddingTop: top, paddingBottom: bottom }}>
          <View className="items-center justify-center" style={{ width: 80, height: 80, borderRadius: 40, backgroundColor: 'rgba(61,220,104,0.12)' }}>
            <SymbolView name={{ ios: 'bubble.left.and.bubble.right.fill', android: 'forum', web: 'forum' }} tintColor={BRAND} size={34} />
          </View>
          <DisplayText {...COMPACT_TEXT} className="mt-5 text-center text-[26px] leading-8 tracking-tight text-white">
            Chat with your dietitian
          </DisplayText>
          <Text {...COMPACT_TEXT} className="mt-2 text-center text-[15px] leading-6 text-muted">
            {info.coaching.status === 'not_shared'
              ? 'Complete your fitness profile and turn on sharing. A dietitian will then be assigned to you, and you can chat with them here.'
              : 'A dietitian will be assigned to you soon. You can chat with them here as soon as they are.'}
          </Text>
          <CompleteProfileButton coaching={info.coaching} />
          <Pressable onPress={() => void load().catch(() => {})} accessibilityRole="button" className="mt-3 min-h-11 justify-center active:opacity-60">
            <Text {...COMPACT_TEXT} className="text-sm font-bold text-brand">
              Check again
            </Text>
          </Pressable>
        </View>
      ) : (
        <ChatThread
          thread={MEMBER}
          peer={info?.dietitian ?? null}
          load={load}
          send={sendMyMessage}
          bottomInset={bottom}
          emptyTitle={`Say hello to ${name}`}
          emptyText="Ask about your meals, your plan or anything you are unsure of. They will get a notification."
          header={
            <View className="flex-row items-center px-5" style={{ gap: 12, paddingTop: top, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.07)' }}>
              {info ? <Avatar name={name} image={info.dietitian?.image ?? null} size={44} /> : <ActivityIndicator color={BRAND} />}
              <View className="flex-1">
                <DisplayText {...COMPACT_TEXT} accessibilityRole="header" numberOfLines={1} className="text-[22px] leading-7 tracking-tight text-white">
                  {name}
                </DisplayText>
                <Text {...COMPACT_TEXT} numberOfLines={1} className="text-xs text-muted">
                  {error && !info ? error : 'Your dietitian'}
                </Text>
              </View>
            </View>
          }
        />
      )}
    </View>
  );
}
