import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SymbolView } from 'expo-symbols';
import type { ReactNode } from 'react';
import { Pressable, RefreshControl, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { DisplayText } from '@/components/display-text';
import { goBack } from '@/lib/navigation';
import { useLanguage, useT } from '@/providers/language-provider';

const BRAND = '#3ddc68';
const MUTED = '#8fa396';
const HAIRLINE = 'rgba(255,255,255,0.07)';
const COMPACT_TEXT = { maxFontSizeMultiplier: 1.3 } as const;

/** A full page in the app's plain style: a back button and a title, then content that scrolls (and pulls down to refresh). */
export function Screen({
  title,
  intro,
  children,
  refreshing,
  onRefresh,
  error,
  footer,
}: {
  title: string;
  intro?: string;
  children: ReactNode;
  refreshing?: boolean;
  onRefresh?: () => void;
  error?: string | null;
  /** Fixed at the bottom, over the content (for a main button). */
  footer?: ReactNode;
}) {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { t, language } = useLanguage();
  return (
    <View className="flex-1" style={{ backgroundColor: '#000000' }}>
      <StatusBar style="light" />
      <ScrollView
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        refreshControl={onRefresh ? <RefreshControl refreshing={!!refreshing} onRefresh={onRefresh} tintColor={BRAND} colors={[BRAND]} /> : undefined}
        contentContainerStyle={{ paddingTop: insets.top + 12, paddingBottom: insets.bottom + (footer ? 110 : 40), width: '100%', maxWidth: 840, alignSelf: 'center' }}>
        <View className="flex-row items-center gap-3 px-5 pb-2">
          <Pressable onPress={() => goBack(router)} hitSlop={10} accessibilityRole="button" accessibilityLabel={t('common.back')} className="h-11 w-11 items-center justify-center rounded-full border border-white/10 active:opacity-70">
            <SymbolView name={{ ios: 'chevron.left', android: 'arrow_back', web: 'arrow_back' }} tintColor="white" size={16} />
          </Pressable>
          <DisplayText
            className="flex-1 text-[30px] font-bold tracking-tight text-white"
            numberOfLines={language === 'en' ? 1 : 2}
            adjustsFontSizeToFit={language !== 'en'}>
            {title}
          </DisplayText>
        </View>
        {intro ? (
          <Text {...COMPACT_TEXT} className="px-5 text-sm leading-5 text-muted">
            {intro}
          </Text>
        ) : null}
        {error ? (
          <View accessibilityRole="alert" className="mx-5 mt-4 rounded-2xl border border-accent/40 bg-accent/10 px-4 py-3">
            <Text className="text-sm text-white">{error}</Text>
          </View>
        ) : null}
        {children}
      </ScrollView>
      {footer ? (
        <View className="absolute bottom-0 left-0 right-0 px-5" style={{ paddingBottom: insets.bottom + 16, paddingTop: 12, backgroundColor: 'rgba(0,0,0,0.92)' }}>
          {footer}
        </View>
      ) : null}
    </View>
  );
}

/** A titled part of a page: a small heading, the content on the page itself, and a thin line above. */
export function Block({ title, status, children }: { title?: string; status?: string | null; children: ReactNode }) {
  const { language } = useLanguage();
  return (
    <View className="px-5" style={{ paddingTop: 22, paddingBottom: 22, borderTopWidth: 1, borderTopColor: HAIRLINE, marginTop: 14 }}>
      {title ? (
        <View className="flex-row items-center" style={{ marginBottom: 14 }}>
          <Text {...COMPACT_TEXT} accessibilityRole="header" className="flex-1 font-bold uppercase text-muted" style={{ fontSize: 12, letterSpacing: language === 'en' ? 1.4 : 0 }}>
            {title}
          </Text>
          {status ? (
            <Text {...COMPACT_TEXT} className="font-bold text-white" style={{ fontSize: 13, flexShrink: 1, maxWidth: '60%', textAlign: 'right', marginLeft: 8 }}>
              {status}
            </Text>
          ) : null}
        </View>
      ) : null}
      {children}
    </View>
  );
}

/** The app's main green button. */
export function PrimaryButton({ label, onPress, busy, disabled }: { label: string; onPress: () => void; busy?: boolean; disabled?: boolean }) {
  const t = useT();
  return (
    <Pressable
      onPress={onPress}
      disabled={busy || disabled}
      accessibilityRole="button"
      accessibilityState={{ disabled: !!(busy || disabled) }}
      className="h-14 items-center justify-center rounded-full active:opacity-80"
      style={{ backgroundColor: disabled ? 'rgba(255,255,255,0.1)' : BRAND }}>
      <Text {...COMPACT_TEXT} className="px-4 text-center text-base font-black" style={{ color: disabled ? MUTED : '#050a07' }} numberOfLines={2} adjustsFontSizeToFit>
        {busy ? t('prof.screen.wait') : label}
      </Text>
    </Pressable>
  );
}

/** A quieter outlined button. */
export function GhostButton({ label, onPress, busy, danger }: { label: string; onPress: () => void; busy?: boolean; danger?: boolean }) {
  return (
    <Pressable
      onPress={onPress}
      disabled={busy}
      accessibilityRole="button"
      className="items-center justify-center rounded-full border active:opacity-70"
      style={{ minHeight: 46, paddingHorizontal: 20, borderColor: danger ? 'rgba(255,90,79,0.5)' : 'rgba(255,255,255,0.15)', backgroundColor: 'rgba(255,255,255,0.05)' }}>
      <Text {...COMPACT_TEXT} className="text-center font-bold" style={{ fontSize: 14, color: danger ? '#ff5a4f' : '#ffffff' }}>
        {label}
      </Text>
    </Pressable>
  );
}
