import { Tabs, TabList, TabSlot, TabTrigger, type TabTriggerSlotProps } from 'expo-router/ui';
import { Pressable, Text, View } from 'react-native';

import { useLanguage, useT } from '@/providers/language-provider';
import { useProfile } from '@/providers/profile-provider';

/** Web: a floating top bar instead of the native bottom tab bar. */
export default function AppTabs() {
  const { role } = useProfile();
  const t = useT();
  return (
    <Tabs>
      <TabSlot style={{ height: '100%' }} />
      <TabList asChild>
        <View className="absolute left-0 right-0 top-0 items-center p-3">
          <View className="w-full max-w-[840px] flex-row items-center gap-1 rounded-2xl border border-white/10 bg-card px-3 py-2">
            <View className="mr-auto flex-row items-center gap-2">
              <View className="h-7 w-7 items-center justify-center rounded-lg bg-brand">
                <Text className="text-xs font-black text-ink">L5</Text>
              </View>
              {/* i18n-ignore: part of the brand name */}
              <Text className="text-xs font-black tracking-[1px] text-white">FITNESS</Text>
            </View>
            <TabTrigger name="index" /* i18n-ignore: route name */ href="/" asChild>
              <TabButton>{t('tabs.home')}</TabButton>
            </TabTrigger>
            <TabTrigger name="logs" /* i18n-ignore: route name */ href="/logs" asChild>
              <TabButton>{t('tabs.activity')}</TabButton>
            </TabTrigger>
            <TabTrigger name="diet" /* i18n-ignore: route name */ href="/diet" asChild>
              <TabButton>{role === 'member' ? t('tabs.chat') : t('tabs.clients')}</TabButton>
            </TabTrigger>
            <TabTrigger name="profile" /* i18n-ignore: route name */ href="/profile" asChild>
              <TabButton>{t('tabs.profile')}</TabButton>
            </TabTrigger>
          </View>
        </View>
      </TabList>
    </Tabs>
  );
}

function TabButton({ children, isFocused, onPress, onLongPress }: TabTriggerSlotProps) {
  // Longer words in the other languages may take two lines.
  const longer = useLanguage().language !== 'en';
  return (
    <Pressable
      onPress={onPress}
      onLongPress={onLongPress}
      accessibilityRole="tab"
      accessibilityState={{ selected: !!isFocused }}
      className={`rounded-xl px-3 py-2 active:opacity-70 ${longer ? 'shrink' : ''} ${isFocused ? 'bg-brand/10' : ''}`}>
      <Text className={`text-sm font-semibold ${longer ? 'text-center' : ''} ${isFocused ? 'text-brand' : 'text-muted'}`}>
        {children}
      </Text>
    </Pressable>
  );
}
