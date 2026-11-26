import type { BottomTabBarProps } from 'expo-router/js-tabs';
import { Pressable, View } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';

import { blobPath } from '@/lib/blob-path';
import { useT } from '@/providers/language-provider';
import { useProfile } from '@/providers/profile-provider';

const BRAND = '#3ddc68';
const INK = '#050a07';
const PILL_BG = '#ffffff';
const BUTTON_BG = '#e9ebea';
const ICON = '#1c241f';

const ICON_SIZE = 24;
const STROKE = 1.7;

/** Thin outline icons, all drawn in the same 24x24 box with the same stroke weight. */
const ICONS: Record<string, (color: string) => React.ReactNode> = {
  index: (c) => (
    <>
      <Path d="M12 3.5 L19.5 9 V18.5 A1.5 1.5 0 0 1 18 20 H6 A1.5 1.5 0 0 1 4.5 18.5 V9 Z" stroke={c} />
      <Path d="M12 15 V16.5" stroke={c} />
    </>
  ),
  logs: (c) => <Path d="M8 18 V11 M12 18 V6 M16 18 V13" stroke={c} strokeWidth={2.4} />,
  diet: (c) => (
    <>
      <Path d="M6.5 3.5 V8 A2 2 0 0 0 10.5 8 V3.5 M8.5 10 V20.5" stroke={c} />
      <Path d="M17 20.5 V3.5 C14.5 5 13.5 8 13.5 11 H17" stroke={c} />
    </>
  ),
  // A member's Diet tab is their chat with the dietitian.
  chat: (c) => (
    <>
      <Path d="M5 5.5 H19 A1.5 1.5 0 0 1 20.5 7 V15 A1.5 1.5 0 0 1 19 16.5 H11 L7 20 V16.5 H5 A1.5 1.5 0 0 1 3.5 15 V7 A1.5 1.5 0 0 1 5 5.5 Z" stroke={c} />
      <Path d="M8 9.5 H16 M8 12.5 H13" stroke={c} />
    </>
  ),
  profile: (c) => (
    <>
      <Circle cx={12} cy={8} r={3.5} stroke={c} />
      <Path d="M5.5 20 C6 16.5 8.5 14.8 12 14.8 C15.5 14.8 18 16.5 18.5 20 Z" stroke={c} />
    </>
  ),
};

const LABEL_KEYS = { index: 'tabs.home', logs: 'tabs.activity', diet: 'tabs.diet', profile: 'tabs.profile' } as const;

const R = 36; // radius of each lobe, so the pill is 72px tall
const STEP = 74; // distance between circle centres
const WAIST = 11; // how far the white edges pinch in between circles
const BUTTON = 60;

/** Floating white blob pill: four grey bead circles with thin outline icons. The active one is brand green. */
export function FloatingTabBar({ state, emitter, navigateToTab, insets }: BottomTabBarProps) {
  const { role } = useProfile();
  const t = useT();
  const chatTab = role === 'member';
  const routes = state.routes.filter((r) => r.name in LABEL_KEYS);
  const n = routes.length;
  const width = R * 2 + (n - 1) * STEP;
  return (
    <View
      pointerEvents="box-none"
      style={{ position: 'absolute', left: 0, right: 0, bottom: Math.max(insets.bottom, 12), alignItems: 'center' }}>
      <View accessibilityRole="tablist" style={{ width, height: R * 2 }}>
        <Svg width={width} height={R * 2} style={{ position: 'absolute' }} pointerEvents="none">
          <Path d={blobPath(n, R, STEP, WAIST)} fill={PILL_BG} />
        </Svg>
        {routes.map((route, i) => {
          const focused = state.routes[state.index]?.key === route.key;
          const onPress = () => {
            const event = emitter.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
            if (!focused && !event.defaultPrevented) navigateToTab(route.key);
          };
          return (
            <Pressable
              key={route.key}
              onPress={onPress}
              onLongPress={() => emitter.emit({ type: 'tabLongPress', target: route.key })}
              accessibilityRole="tab"
              accessibilityLabel={route.name === 'diet' ? (chatTab ? t('tabs.chat') : t('tabs.clients')) : t(LABEL_KEYS[route.name as keyof typeof LABEL_KEYS])}
              accessibilityState={{ selected: focused }}
              style={({ pressed }) => ({
                position: 'absolute',
                left: R + i * STEP - BUTTON / 2,
                top: R - BUTTON / 2,
                width: BUTTON,
                height: BUTTON,
                borderRadius: BUTTON / 2,
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: focused ? BRAND : BUTTON_BG,
                opacity: pressed ? 0.8 : 1,
              })}>
              <Svg
                width={ICON_SIZE}
                height={ICON_SIZE}
                viewBox="0 0 24 24"
                fill="none"
                strokeWidth={STROKE}
                strokeLinecap="round"
                strokeLinejoin="round">
                {ICONS[route.name === 'diet' && chatTab ? 'chat' : route.name](focused ? INK : ICON)}
              </Svg>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}
