import { useFocusEffect, useRouter } from 'expo-router';
import { GreenBackground } from '@/components/green-background';
import { StatusBar } from 'expo-status-bar';
import { SymbolView } from 'expo-symbols';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Platform, Pressable, RefreshControl, ScrollView, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { PageHeading } from '@/components/page-heading';
import { Avatar } from '@/components/avatar';
import { BottomTabInset } from '@/constants/theme';
import { fmtKg, GOAL_LABEL } from '@/lib/body';
import { messageFrom } from '@/lib/http';
import { getUnreadChats } from '@/lib/chat-api';
import { useNewChatMessages } from '@/lib/realtime';
import { listClients, type ClientSummary } from '@/lib/wellness-api';
import { useProfile } from '@/providers/profile-provider';

const BRAND = '#3ddc68';
const WEB_TOP_BAR = 72;
const COMPACT_TEXT = { maxFontSizeMultiplier: 1.3 } as const;

/** The Diet tab for a dietitian: every member who agreed to share, with a 7-day plan progress. */
export function ClientsList() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  // The admin sees this list too, but the line to the admin is for dietitians.
  const isDietitian = useProfile().role === 'dietitian';
  const [query, setQuery] = useState('');
  const [clients, setClients] = useState<ClientSummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  /** Unread chat messages from each client. */
  const [unread, setUnread] = useState<Record<string, number>>({});
  /** Unread messages from the admin. */
  const [adminUnread, setAdminUnread] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const latest = useRef(0);

  const loadUnread = useCallback(() => {
    getUnreadChats()
      .then((u) => {
        setUnread(Object.fromEntries(u.clients.map((c) => [c.memberId, c.unread])));
        setAdminUnread(u.admin ?? 0);
      })
      .catch(() => {});
  }, []);

  const load = useCallback(async (q: string) => {
    const id = ++latest.current;
    try {
      const res = await listClients(q.trim());
      if (id !== latest.current) return;
      setClients(res.clients);
      setError(null);
      // The badges are a nicety: the list still shows if they cannot be loaded.
      loadUnread();
    } catch (e) {
      if (id === latest.current) setError(messageFrom(e));
    }
  }, [loadUnread]);

  // Search as they type, after a short pause.
  useEffect(() => {
    const timer = setTimeout(() => load(query), 300);
    return () => clearTimeout(timer);
  }, [query, load]);

  useFocusEffect(
    useCallback(() => {
      load(query);
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [load])
  );

  // A client (or the admin) wrote just now: bring the unread badges up to date.
  useNewChatMessages(loadUnread);

  const isWeb = Platform.OS === 'web';

  return (
    <View className="flex-1 bg-ink">
      <GreenBackground />
      <StatusBar style="light" />
      <ScrollView
        keyboardShouldPersistTaps="handled"
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={async () => {
              setRefreshing(true);
              await load(query);
              setRefreshing(false);
            }}
            tintColor={BRAND}
            colors={[BRAND]}
          />
        }
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{
          paddingTop: insets.top + (isWeb ? WEB_TOP_BAR : 20),
          width: '100%', maxWidth: 840, alignSelf: 'center',
          paddingBottom: insets.bottom + (isWeb ? 0 : BottomTabInset) + 24,
        }}>
        <PageHeading title="Your clients" subtitle="Plans, progress and a little encouragement." />
        <View className="px-5">
          <View className="mt-5 h-14 flex-row items-center gap-3 rounded-2xl border border-white/10 bg-card px-5">
            <SymbolView name={{ ios: 'magnifyingglass', android: 'search', web: 'search' }} size={18} tintColor="#8fa396" />
            <TextInput
              value={query}
              onChangeText={setQuery}
              accessibilityLabel="Search clients"
              placeholder="Search by name or email"
              placeholderTextColor="#6f8577"
              selectionColor={BRAND}
              cursorColor={BRAND}
              autoCapitalize="none"
              autoCorrect={false}
              maxFontSizeMultiplier={1.4}
              className="h-full flex-1 text-base text-white"
            />
          </View>
        </View>

        {error ? (
          <View accessibilityRole="alert" className="mx-5 mt-4 rounded-2xl border border-accent/40 bg-accent/10 px-4 py-3">
            <Text className="text-sm text-white">{error}</Text>
          </View>
        ) : null}

        <View className="mt-5 gap-3 px-5">
          {/* The dietitian's own line to the gym's admin. */}
          {isDietitian && !query ? (
            <Pressable
              onPress={() => router.push('/chat/admin')}
              accessibilityRole="button"
              accessibilityLabel={adminUnread ? `Message the admin, ${adminUnread} unread` : 'Message the admin'}
              className="flex-row items-center gap-4 rounded-3xl border border-white/5 bg-card p-4 active:opacity-80">
              <View className="items-center justify-center" style={{ width: 52, height: 52, borderRadius: 26, backgroundColor: 'rgba(56,189,248,0.15)' }}>
                <SymbolView name={{ ios: 'checkmark.shield.fill', android: 'verified_user', web: 'verified_user' }} tintColor="#38bdf8" size={24} />
              </View>
              <View className="flex-1">
                <Text {...COMPACT_TEXT} numberOfLines={1} className="text-base font-bold text-white">
                  Admin
                </Text>
                <Text {...COMPACT_TEXT} numberOfLines={1} className="text-xs text-muted">
                  {adminUnread ? 'New message from the admin' : 'Message the gym admin'}
                </Text>
              </View>
              {adminUnread ? (
                <View className="items-center justify-center rounded-full bg-brand" style={{ minWidth: 24, height: 24, paddingHorizontal: 7 }}>
                  <Text {...COMPACT_TEXT} className="text-xs font-black text-ink">
                    {adminUnread > 99 ? '99+' : adminUnread}
                  </Text>
                </View>
              ) : null}
              <SymbolView name={{ ios: 'chevron.right', android: 'chevron_right', web: 'chevron_right' }} tintColor="#8fa396" size={14} />
            </Pressable>
          ) : null}
          {clients === null && !error ? (
            <View className="items-center py-12">
              <ActivityIndicator color={BRAND} />
            </View>
          ) : null}
          {clients?.length === 0 ? (
            <View className="items-center rounded-3xl border border-white/10 bg-card px-6 py-10">
              <Text className="text-base font-bold text-white">{query ? 'No clients match' : 'No clients yet'}</Text>
              <Text className="mt-1 text-center text-sm text-muted">
                {query ? 'Try another name or email.' : 'Your admin will assign clients to you. They will show up here.'}
              </Text>
            </View>
          ) : null}
          {clients?.map((c) => {
            const percent = c.planned7 ? Math.round((c.done7 / c.planned7) * 100) : null;
            return (
              <Pressable
                key={c.id}
                onPress={() => router.push({ pathname: '/client/[id]', params: { id: c.id } })}
                accessibilityRole="button"
                accessibilityLabel={`${c.name}, ${GOAL_LABEL[c.goal]}`}
                className="flex-row items-center gap-4 rounded-3xl border border-white/5 bg-card p-4 active:opacity-80">
                <Avatar name={c.name || c.email} image={c.image} size={52} />
                <View className="flex-1">
                  <Text {...COMPACT_TEXT} numberOfLines={1} className="text-base font-bold text-white">
                    {c.name || c.email}
                  </Text>
                  <Text {...COMPACT_TEXT} numberOfLines={1} className="text-xs text-muted">
                    {GOAL_LABEL[c.goal]} · {fmtKg(c.weightKg)} → {fmtKg(c.targetWeightKg)}
                  </Text>
                </View>
                {unread[c.id] ? (
                  <View
                    accessible
                    accessibilityLabel={`${unread[c.id]} unread ${unread[c.id] === 1 ? 'message' : 'messages'}`}
                    className="items-center justify-center rounded-full bg-brand"
                    style={{ minWidth: 24, height: 24, paddingHorizontal: 7 }}>
                    <Text {...COMPACT_TEXT} className="text-xs font-black text-ink">
                      {unread[c.id] > 99 ? '99+' : unread[c.id]}
                    </Text>
                  </View>
                ) : null}
                <View className="items-end">
                  <Text {...COMPACT_TEXT} className={`text-base font-bold ${percent == null ? 'text-muted' : percent >= 70 ? 'text-brand' : 'text-white'}`}>
                    {percent == null ? '–' : `${percent}%`}
                  </Text>
                  <Text {...COMPACT_TEXT} className="text-[10px] text-muted">
                    {percent == null ? 'no plan' : '7-day plan'}
                  </Text>
                </View>
              </Pressable>
            );
          })}
        </View>
      </ScrollView>
    </View>
  );
}
