import { NativeTabs } from 'expo-router/native-tabs';

const INK = '#0b0b0d';
const BRAND = '#c6f432';
const MUTED = '#9ba2ac';

export default function AppTabs() {
  return (
    <NativeTabs
      backgroundColor={INK}
      tintColor={BRAND}
      iconColor={{ default: MUTED, selected: BRAND }}
      indicatorColor="#20252b"
      rippleColor="rgba(198,244,50,0.12)"
      labelStyle={{ default: { color: MUTED }, selected: { color: '#ffffff' } }}>
      <NativeTabs.Trigger name="index">
        <NativeTabs.Trigger.Label>Home</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf={{ default: 'house', selected: 'house.fill' }} md="home" />
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="logs">
        <NativeTabs.Trigger.Label>Logs</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf={{ default: 'list.bullet.clipboard', selected: 'list.bullet.clipboard.fill' }} md="assignment" />
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="diet">
        <NativeTabs.Trigger.Label>Diet</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf={{ default: 'fork.knife', selected: 'fork.knife' }} md="restaurant_menu" />
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="profile">
        <NativeTabs.Trigger.Label>Profile</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf={{ default: 'person', selected: 'person.fill' }} md="person" />
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}
