import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SymbolView } from 'expo-symbols';
import { Pressable, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ChatThread, statusLine } from '@/components/chat/chat-thread';
import { getAdminChat, sendAdminMessage } from '@/lib/chat-api';

const COMPACT_TEXT = { maxFontSizeMultiplier: 1.3 } as const;
const SKY = '#38bdf8';
const ADMIN = { name: 'Admin', image: null } as const;

/** A dietitian's chat with the gym's admin. Opened from the top of their client list. */
export default function AdminChatScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();

  return (
    <View className="flex-1" style={{ backgroundColor: '#000000' }}>
      <StatusBar style="light" />
      <ChatThread
        role="dietitian"
        peer={ADMIN}
        load={getAdminChat}
        send={sendAdminMessage}
        bottomInset={insets.bottom}
        emptyTitle="No messages yet"
        emptyText="Write to the admin about your clients, your schedule or anything you need."
        header={(status) => (
          <View className="flex-row items-center px-4" style={{ gap: 12, paddingTop: insets.top + 8, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.07)' }}>
            <Pressable onPress={() => router.back()} hitSlop={10} accessibilityRole="button" accessibilityLabel="Back" className="h-11 w-11 items-center justify-center active:opacity-60">
              <SymbolView name={{ ios: 'chevron.left', android: 'arrow_back', web: 'arrow_back' }} tintColor="white" size={18} />
            </Pressable>
            <View className="items-center justify-center" style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(56,189,248,0.15)' }}>
              <SymbolView name={{ ios: 'checkmark.shield.fill', android: 'verified_user', web: 'verified_user' }} tintColor={SKY} size={20} />
              {status.online ? <View style={{ position: 'absolute', right: 0, bottom: 0, width: 12, height: 12, borderRadius: 6, backgroundColor: '#3ddc68', borderWidth: 2, borderColor: '#000000' }} /> : null}
            </View>
            <View className="flex-1">
              <Text {...COMPACT_TEXT} accessibilityRole="header" numberOfLines={1} className="text-lg font-bold text-white">
                Admin
              </Text>
              <Text {...COMPACT_TEXT} accessibilityLiveRegion="polite" className={`text-xs ${status.online || status.typing ? 'font-bold text-brand' : 'text-muted'}`}>
                {statusLine(status, 'Gym management')}
              </Text>
            </View>
          </View>
        )}
      />
    </View>
  );
}
