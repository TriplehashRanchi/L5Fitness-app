import { NativeTabs } from 'expo-router/native-tabs';

const INK = '#0b0b0d';
const BRAND = '#c6f432';
const MUTED = '#8b8b94';

export default function AppTabs() {
  return (
    <NativeTabs
      backgroundColor={INK}
      tintColor={BRAND}
      iconColor={{ default: MUTED, selected: BRAND }}
      indicatorColor="#222228"
      rippleColor="rgba(198,244,50,0.12)"
      labelStyle={{ default: { color: MUTED }, selected: { color: '#ffffff' } }}>
      <NativeTabs.Trigger name="index">
        <NativeTabs.Trigger.Label>Home</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf={{ default: 'house', selected: 'house.fill' }} md="home" />
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="explore">
        <NativeTabs.Trigger.Label>Explore</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon
          sf={{ default: 'safari', selected: 'safari.fill' }}
          md="explore"
        />
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}
