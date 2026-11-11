import { useRouter, type Href } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SymbolView } from 'expo-symbols';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { getInbox, markRead, type AppNotification, type Screen } from '@/lib/notifications-api';
import { messageFrom } from '@/lib/http';
import { useNotifications } from '@/providers/notifications-provider';

const BRAND = '#c6f432';
const MUTED = '#9ba2ac';

const ROUTES: Record<Screen, Href> = {
  inbox: '/notifications' as Href,
  home: '/' as Href,
  diet: '/diet' as Href,
  logs: '/logs' as Href,
};

/** "5m ago", "3h ago", "Yesterday", or the date. */
function ago(iso: string) {
  const minutes = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60_000));
  if (minutes < 1) return 'Just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  if (days === 1) return 'Yesterday';
  if (days < 7) return `${days}d ago`;
  return new Date(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
}

export default function NotificationsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { refresh, unread } = useNotifications();

  const [items, setItems] = useState<AppNotification[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [more, setMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);

  const load = useCallback(async () => {
    try {
      const inbox = await getInbox();
      setItems(inbox.notifications);
      setMore(inbox.notifications.length === 30);
      setError(null);
    } catch (e) {
      setError(messageFrom(e));
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    getInbox()
      .then((inbox) => {
        if (cancelled) return;
        setItems(inbox.notifications);
        setMore(inbox.notifications.length === 30);
      })
      .catch((e) => !cancelled && setError(messageFrom(e)));
    return () => {
      cancelled = true;
    };
  }, []);

  const loadOlder = async () => {
    if (!items?.length || loadingMore) return;
    setLoadingMore(true);
    try {
      const page = await getInbox(items[items.length - 1].createdAt);
      setItems([...items, ...page.notifications]);
      setMore(page.notifications.length === 30);
    } catch (e) {
      setError(messageFrom(e));
    } finally {
      setLoadingMore(false);
    }
  };

  const open = async (n: AppNotification) => {
    if (!n.read) {
      setItems((list) => list?.map((x) => (x.id === n.id ? { ...x, read: true } : x)) ?? null);
      markRead([n.id]).then(refresh).catch(() => {});
    }
    if (n.screen !== 'inbox') router.navigate(ROUTES[n.screen]);
  };

  const readAll = async () => {
    setItems((list) => list?.map((x) => ({ ...x, read: true })) ?? null);
    try {
      await markRead();
      await refresh();
    } catch (e) {
      setError(messageFrom(e));
      load();
    }
  };

  return (
    <View className="flex-1 bg-ink">
      <StatusBar style="light" />
      <ScrollView
        contentContainerStyle={{ paddingTop: insets.top + 16, paddingBottom: insets.bottom + 40, width: '100%', maxWidth: 840, alignSelf: 'center' }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            tintColor={BRAND}
            onRefresh={async () => {
              setRefreshing(true);
              await Promise.all([load(), refresh()]);
              setRefreshing(false);
            }}
          />
        }
        showsVerticalScrollIndicator={false}>
        <View className="flex-row items-center gap-3 px-5 pb-2">
          <Pressable
            onPress={() => router.back()}
            hitSlop={10}
            accessibilityRole="button"
            accessibilityLabel="Back"
            className="h-10 w-10 items-center justify-center rounded-full bg-card active:opacity-70">
            <SymbolView name={{ ios: 'chevron.left', android: 'arrow_back', web: 'arrow_back' }} tintColor="white" size={16} />
          </Pressable>
          <Text className="flex-1 text-[30px] font-bold tracking-tight text-white">Notifications</Text>
          {unread > 0 ? (
            <Pressable onPress={readAll} hitSlop={10} accessibilityRole="button" className="active:opacity-60">
              <Text className="text-sm font-semibold text-brand">Mark all read</Text>
            </Pressable>
          ) : null}
        </View>

        {error ? (
          <View accessibilityRole="alert" className="mx-5 mt-4 rounded-2xl border border-accent/40 bg-accent/10 px-4 py-3">
            <Text className="text-sm text-white">{error}</Text>
          </View>
        ) : null}

        {items === null && !error ? (
          <View className="items-center py-16">
            <ActivityIndicator color={BRAND} />
          </View>
        ) : items && items.length === 0 ? (
          <View className="mx-5 mt-8 items-center rounded-3xl border border-dashed border-white/15 px-6 py-14">
            <SymbolView name={{ ios: 'bell', android: 'notifications', web: 'notifications' }} tintColor={MUTED} size={34} />
            <Text className="mt-4 text-base font-bold text-white">You are all caught up</Text>
            <Text className="mt-1 text-center text-sm leading-5 text-muted">
              Messages from your gym and your dietitian will appear here.
            </Text>
          </View>
        ) : (
          <View className="mt-4 gap-3 px-5">
            {items?.map((n) => (
              <Pressable
                key={n.id}
                onPress={() => open(n)}
                accessibilityRole="button"
                accessibilityLabel={`${n.read ? '' : 'Unread. '}${n.title}. ${n.body}`}
                className={`rounded-3xl border p-5 active:opacity-80 ${n.read ? 'border-white/5 bg-card' : 'border-brand/30 bg-brand/5'}`}>
                <View className="flex-row items-center gap-2">
                  {!n.read ? <View className="h-2 w-2 rounded-full bg-brand" /> : null}
                  <Text className="flex-1 text-xs font-semibold uppercase tracking-[1px] text-muted" numberOfLines={1}>
                    {n.fromRole === 'admin' ? 'L5 Fitness' : n.from}
                  </Text>
                  <Text className="text-xs text-muted">{ago(n.createdAt)}</Text>
                </View>
                <Text className="mt-2 text-base font-bold text-white">{n.title}</Text>
                <Text className="mt-1 text-sm leading-5 text-zinc-300">{n.body}</Text>
              </Pressable>
            ))}
            {more ? (
              <Pressable onPress={loadOlder} disabled={loadingMore} accessibilityRole="button" className="items-center py-4 active:opacity-60">
                {loadingMore ? <ActivityIndicator color={BRAND} /> : <Text className="text-sm font-semibold text-brand">Show older</Text>}
              </Pressable>
            ) : null}
          </View>
        )}
      </ScrollView>
    </View>
  );
}
