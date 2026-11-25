import { useLocalSearchParams, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SymbolView } from 'expo-symbols';
import { useCallback, useMemo } from 'react';
import { Pressable, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Avatar } from '@/components/avatar';
import { ChatThread, statusLine } from '@/components/chat/chat-thread';
import { getClientChat, sendClientMessage, type ChatWindow } from '@/lib/chat-api';

const COMPACT_TEXT = { maxFontSizeMultiplier: 1.3 } as const;

/** A dietitian's chat with one client. Opened from the client's screen. */
export default function ClientChatScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { id, name, image } = useLocalSearchParams<{ id: string; name?: string; image?: string }>();
  const load = useCallback((window?: ChatWindow) => getClientChat(id, window), [id]);
  const send = useCallback((body: string, clientId: string) => sendClientMessage(id, body, clientId), [id]);
  const title = name || 'Client';
  const peer = useMemo(() => ({ name: title, image: image || null }), [title, image]);

  return (
    <View className="flex-1" style={{ backgroundColor: '#000000' }}>
      <StatusBar style="light" />
      <ChatThread
        role="dietitian"
        peer={peer}
        load={load}
        send={send}
        bottomInset={insets.bottom}
        emptyTitle="No messages yet"
        emptyText={`Say hello to ${title}. They will get a notification.`}
        header={(status) => (
          <View className="flex-row items-center px-4" style={{ gap: 12, paddingTop: insets.top + 8, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.07)' }}>
            <Pressable onPress={() => router.back()} hitSlop={10} accessibilityRole="button" accessibilityLabel="Back" className="h-11 w-11 items-center justify-center active:opacity-60">
              <SymbolView name={{ ios: 'chevron.left', android: 'arrow_back', web: 'arrow_back' }} tintColor="white" size={18} />
            </Pressable>
            <View>
              <Avatar name={title} image={image || null} size={40} />
              {status.online ? <View style={{ position: 'absolute', right: 0, bottom: 0, width: 12, height: 12, borderRadius: 6, backgroundColor: '#3ddc68', borderWidth: 2, borderColor: '#000000' }} /> : null}
            </View>
            <View className="flex-1">
              <Text {...COMPACT_TEXT} accessibilityRole="header" numberOfLines={1} className="text-lg font-bold text-white">
                {title}
              </Text>
              <Text {...COMPACT_TEXT} accessibilityLiveRegion="polite" className={`text-xs ${status.online || status.typing ? 'font-bold text-brand' : 'text-muted'}`}>
                {statusLine(status, 'Your client')}
              </Text>
            </View>
          </View>
        )}
      />
    </View>
  );
}
