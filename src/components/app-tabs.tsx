import { Tabs } from 'expo-router/js-tabs';

import { FloatingTabBar } from '@/components/floating-tab-bar';
import { useT } from '@/providers/language-provider';

const INK = '#050a07';

/** Native: a floating pill tab bar (JS tabs with a custom bar). Same four routes as before. */
export default function AppTabs() {
  const t = useT();
  return (
    <Tabs
      tabBar={(props) => <FloatingTabBar {...props} />}
      screenOptions={{ headerShown: false, sceneStyle: { backgroundColor: INK } }}>
      <Tabs.Screen name="index" /* i18n-ignore: route name */ options={{ title: t('tabs.home') }} />
      <Tabs.Screen name="logs" /* i18n-ignore: route name */ options={{ title: t('tabs.activity') }} />
      <Tabs.Screen name="diet" /* i18n-ignore: route name */ options={{ title: t('tabs.diet') }} />
      <Tabs.Screen name="profile" /* i18n-ignore: route name */ options={{ title: t('tabs.profile') }} />
    </Tabs>
  );
}
