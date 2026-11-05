import { Tabs, TabList, TabSlot, TabTrigger, type TabTriggerSlotProps } from 'expo-router/ui';
import { Pressable, Text, View } from 'react-native';

/** Web: a floating top bar instead of the native bottom tab bar. */
export default function AppTabs() {
  return (
    <Tabs>
      <TabSlot style={{ height: '100%' }} />
      <TabList asChild>
        <View className="absolute left-0 right-0 top-0 items-center p-3">
          <View className="w-full max-w-[800px] flex-row items-center gap-2 rounded-full border border-white/10 bg-card/90 px-4 py-2">
            <View className="mr-auto flex-row items-center gap-2">
              <View className="h-7 w-7 items-center justify-center rounded-lg bg-brand">
                <Text className="text-xs font-black text-ink">L5</Text>
              </View>
              <Text className="text-xs font-black tracking-[3px] text-white">FITNESS</Text>
            </View>
            <TabTrigger name="index" href="/" asChild>
              <TabButton>Home</TabButton>
            </TabTrigger>
            <TabTrigger name="explore" href="/explore" asChild>
              <TabButton>Explore</TabButton>
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
      className={`rounded-full px-4 py-1.5 active:opacity-70 ${isFocused ? 'bg-brand' : ''}`}>
      <Text className={`text-sm font-semibold ${isFocused ? 'text-ink' : 'text-muted'}`}>
        {children}
      </Text>
    </Pressable>
  );
}
