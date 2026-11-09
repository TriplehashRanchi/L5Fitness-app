import { Tabs, TabList, TabSlot, TabTrigger, type TabTriggerSlotProps } from 'expo-router/ui';
import { Pressable, Text, View } from 'react-native';

/** Web: a floating top bar instead of the native bottom tab bar. */
export default function AppTabs() {
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
              <Text className="text-xs font-black tracking-[1px] text-white">FITNESS</Text>
            </View>
            <TabTrigger name="index" href="/" asChild>
              <TabButton>Home</TabButton>
            </TabTrigger>
            <TabTrigger name="logs" href="/logs" asChild>
              <TabButton>Logs</TabButton>
            </TabTrigger>
            <TabTrigger name="diet" href="/diet" asChild>
              <TabButton>Diet</TabButton>
            </TabTrigger>
            <TabTrigger name="profile" href="/profile" asChild>
              <TabButton>Profile</TabButton>
            </TabTrigger>
          </View>
        </View>
      </TabList>
    </Tabs>
  );
}

function TabButton({ children, isFocused, onPress, onLongPress }: TabTriggerSlotProps) {
  return (
    <Pressable
      onPress={onPress}
      onLongPress={onLongPress}
      className={`rounded-xl px-3 py-2 active:opacity-70 ${isFocused ? 'bg-brand/10' : ''}`}>
      <Text className={`text-sm font-semibold ${isFocused ? 'text-brand' : 'text-muted'}`}>
        {children}
      </Text>
    </Pressable>
  );
}
