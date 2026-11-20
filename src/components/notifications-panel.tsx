import { useRouter, type Href } from "expo-router";
import { SymbolView } from "expo-symbols";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  Text,
  useWindowDimensions,
  View,
} from "react-native";
import Animated, {
  FadeIn,
  FadeInUp,
  LinearTransition,
  useReducedMotion,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { DisplayText } from "@/components/display-text";
import { messageFrom } from "@/lib/http";
import {
  getInbox,
  markRead,
  type AppNotification,
  type Screen,
} from "@/lib/notifications-api";
import { useNotifications } from "@/providers/notifications-provider";

const BRAND = "#3ddc68";
const INK = "#050a07";
const MUTED = "#8fa396";
const PANEL = "#0d1f14";
const COMPACT_TEXT = { maxFontSizeMultiplier: 1.3 } as const;
const PAGE = 30;

/** Where a message can take the member, and the words on its button. Inbox and Home messages stay here. */
const GO: Partial<Record<Screen, { href: Href; label: string }>> = {
  diet: { href: "/diet" as Href, label: "Open chat" },
  logs: { href: "/logs" as Href, label: "Open logs" },
};

/** "5m", "3h", "Yesterday", or the date. */
function ago(iso: string) {
  const minutes = Math.max(
    0,
    Math.round((Date.now() - new Date(iso).getTime()) / 60_000),
  );
  if (minutes < 1) return "Now";
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.round(hours / 24);
  if (days === 1) return "Yesterday";
  if (days < 7) return `${days}d`;
  return new Date(iso).toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
  });
}

function Row({
  n,
  open,
  onPress,
  onGo,
}: {
  n: AppNotification;
  open: boolean;
  onPress: () => void;
  onGo: (href: Href) => void;
}) {
  const admin = n.fromRole === "admin";
  const go = GO[n.screen];
  return (
    <Animated.View layout={LinearTransition.duration(180)}>
      <Pressable
        onPress={onPress}
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        accessibilityLabel={`${n.read ? "" : "Unread. "}${admin ? "L5 Fitness" : n.from}. ${n.title}. ${n.body}`}
        className="flex-row active:opacity-80"
        style={{
          gap: 12,
          padding: 12,
          borderRadius: 20,
          marginBottom: 6,
          backgroundColor: open
            ? "rgba(255,255,255,0.06)"
            : n.read
              ? "transparent"
              : "rgba(61,220,104,0.08)",
        }}
      >
        <View
          className="items-center justify-center"
          style={{
            width: 40,
            height: 40,
            borderRadius: 20,
            backgroundColor: n.read
              ? "rgba(255,255,255,0.06)"
              : "rgba(61,220,104,0.18)",
          }}
        >
          <SymbolView
            name={
              admin
                ? {
                    ios: "megaphone.fill",
                    android: "campaign",
                    web: "campaign",
                  }
                : {
                    ios: "fork.knife",
                    android: "restaurant",
                    web: "restaurant",
                  }
            }
            tintColor={n.read ? MUTED : BRAND}
            size={17}
          />
        </View>
        <View className="flex-1">
          <View className="flex-row items-center" style={{ gap: 8 }}>
            <Text {...COMPACT_TEXT} className="flex-1 font-semibold text-muted" style={{ fontSize: 12 }} numberOfLines={1}>
              {admin ? "L5 Fitness" : n.from}
            </Text>
            <Text {...COMPACT_TEXT} className="text-muted" style={{ fontSize: 12 }}>
              {ago(n.createdAt)}
            </Text>
            {!n.read ? (
              <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: BRAND }} />
            ) : null}
          </View>
          <Text
            {...COMPACT_TEXT}
            className={n.read ? "font-semibold text-white" : "font-bold text-white"}
            style={{ fontSize: 15, lineHeight: 20, marginTop: 2 }}
            numberOfLines={open ? undefined : 1}
          >
            {n.title}
          </Text>
          <Text
            {...COMPACT_TEXT}
            selectable={open}
            className="text-muted"
            style={{ fontSize: 13, lineHeight: 19, marginTop: 2 }}
            numberOfLines={open ? undefined : 2}
          >
            {n.body}
          </Text>
          {open && go ? (
            <Pressable
              onPress={() => onGo(go.href)}
              accessibilityRole="button"
              accessibilityLabel={go.label}
              className="flex-row items-center self-start rounded-full bg-brand active:opacity-80"
              style={{
                gap: 6,
                minHeight: 36,
                paddingHorizontal: 14,
                marginTop: 10,
              }}
            >
              <Text
                {...COMPACT_TEXT}
                className="font-black text-ink"
                style={{ fontSize: 13 }}
              >
                {go.label}
              </Text>
              <SymbolView
                name={{
                  ios: "arrow.right",
                  android: "arrow_forward",
                  web: "arrow_forward",
                }}
                tintColor={INK}
                size={11}
              />
            </Pressable>
          ) : null}
        </View>
      </Pressable>
    </Animated.View>
  );
}

/** The list itself. Mounted only while the panel is open, so it loads fresh every time. */
function Inbox({
  maxHeight,
  onClose,
}: {
  maxHeight: number;
  onClose: () => void;
}) {
  const router = useRouter();
  const { refresh, unread } = useNotifications();
  const [items, setItems] = useState<AppNotification[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [more, setMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    getInbox()
      .then((inbox) => {
        if (cancelled) return;
        setItems(inbox.notifications);
        setMore(inbox.notifications.length === PAGE);
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
      setMore(page.notifications.length === PAGE);
    } catch (e) {
      setError(messageFrom(e));
    } finally {
      setLoadingMore(false);
    }
  };

  // A tap opens the message right here and marks it read.
  const press = (n: AppNotification) => {
    setOpenId((id) => (id === n.id ? null : n.id));
    if (!n.read) {
      setItems(
        (list) =>
          list?.map((x) => (x.id === n.id ? { ...x, read: true } : x)) ?? null,
      );
      markRead([n.id])
        .then(refresh)
        .catch(() => {});
    }
  };

  const readAll = async () => {
    setItems((list) => list?.map((x) => ({ ...x, read: true })) ?? null);
    try {
      await markRead();
      await refresh();
    } catch (e) {
      setError(messageFrom(e));
    }
  };

  const go = (href: Href) => {
    onClose();
    router.navigate(href);
  };

  // What was unread when the panel opened stays under "New" until it is closed.
  const [newIds, setNewIds] = useState<Set<string> | null>(null);
  if (items && !newIds) setNewIds(new Set(items.filter((n) => !n.read).map((n) => n.id)));
  const fresh = items?.filter((n) => newIds?.has(n.id)) ?? [];
  const earlier = items?.filter((n) => !newIds?.has(n.id)) ?? [];

  const heading = (text: string) => (
    <Text
      {...COMPACT_TEXT}
      accessibilityRole="header"
      className="font-bold uppercase text-muted"
      style={{ fontSize: 11, letterSpacing: 1, marginLeft: 12, marginBottom: 6, marginTop: 4 }}
    >
      {text}
    </Text>
  );

  return (
    <>
      <View
        className="flex-row items-center"
        style={{
          gap: 10,
          paddingHorizontal: 18,
          paddingTop: 16,
          paddingBottom: 12,
        }}
      >
        <DisplayText
          {...COMPACT_TEXT}
          accessibilityRole="header"
          className="text-white"
          style={{ fontSize: 22, lineHeight: 28 }}
        >
          Notifications
        </DisplayText>
        {unread > 0 ? (
          <View
            className="items-center justify-center rounded-full bg-brand"
            style={{ minWidth: 22, height: 22, paddingHorizontal: 6 }}
          >
            <Text
              {...COMPACT_TEXT}
              className="font-black text-ink"
              style={{ fontSize: 12 }}
            >
              {unread > 99 ? "99+" : unread}
            </Text>
          </View>
        ) : null}
        <View className="flex-1" />
        {unread > 0 ? (
          <Pressable
            onPress={readAll}
            hitSlop={10}
            accessibilityRole="button"
            accessibilityLabel="Mark all as read"
            className="justify-center active:opacity-60"
            style={{ minHeight: 36 }}
          >
            <Text {...COMPACT_TEXT} className="font-bold text-brand" style={{ fontSize: 13 }}>
              Mark all read
            </Text>
          </Pressable>
        ) : null}
        <Pressable
          onPress={onClose}
          hitSlop={10}
          accessibilityRole="button"
          accessibilityLabel="Close notifications"
          className="items-center justify-center rounded-full active:opacity-60"
          style={{
            width: 34,
            height: 34,
            backgroundColor: "rgba(255,255,255,0.08)",
          }}
        >
          <SymbolView
            name={{ ios: "xmark", android: "close", web: "close" }}
            tintColor="white"
            size={12}
          />
        </Pressable>
      </View>

      {error ? (
        <Text
          {...COMPACT_TEXT}
          accessibilityRole="alert"
          className="text-white"
          style={{
            fontSize: 13,
            marginHorizontal: 18,
            marginBottom: 10,
            padding: 12,
            borderRadius: 14,
            backgroundColor: "rgba(255,107,53,0.14)",
          }}
        >
          {error}
        </Text>
      ) : null}

      {items === null && !error ? (
        <View
          style={{ paddingHorizontal: 8, paddingBottom: 14 }}
          accessibilityLabel="Loading notifications"
          accessibilityRole="progressbar"
        >
          {[0, 1, 2].map((i) => (
            <View
              key={i}
              className="flex-row items-center"
              style={{ gap: 12, padding: 12 }}
            >
              <View
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: 20,
                  backgroundColor: "rgba(255,255,255,0.06)",
                }}
              />
              <View className="flex-1" style={{ gap: 8 }}>
                <View
                  style={{
                    height: 12,
                    width: "55%",
                    borderRadius: 6,
                    backgroundColor: "rgba(255,255,255,0.08)",
                  }}
                />
                <View
                  style={{
                    height: 10,
                    width: "85%",
                    borderRadius: 5,
                    backgroundColor: "rgba(255,255,255,0.05)",
                  }}
                />
              </View>
            </View>
          ))}
        </View>
      ) : items && items.length === 0 ? (
        <View
          className="items-center"
          style={{ paddingHorizontal: 24, paddingTop: 18, paddingBottom: 34 }}
        >
          <View
            className="items-center justify-center"
            style={{
              width: 64,
              height: 64,
              borderRadius: 32,
              backgroundColor: "rgba(61,220,104,0.12)",
            }}
          >
            <SymbolView
              name={{
                ios: "bell.slash",
                android: "notifications_off",
                web: "notifications_off",
              }}
              tintColor={BRAND}
              size={26}
            />
          </View>
          <Text
            {...COMPACT_TEXT}
            className="font-bold text-white"
            style={{ fontSize: 16, marginTop: 14 }}
          >
            You are all caught up
          </Text>
          <Text
            {...COMPACT_TEXT}
            className="text-center text-muted"
            style={{ fontSize: 13, lineHeight: 19, marginTop: 4 }}
          >
            Messages from your gym and your dietitian will appear here.
          </Text>
        </View>
      ) : (
        <ScrollView
          style={{ maxHeight }}
          contentContainerStyle={{ paddingHorizontal: 8, paddingBottom: 12 }}
          showsVerticalScrollIndicator={false}
        >
          {fresh.length ? heading("New") : null}
          {fresh.map((n) => (
            <Row key={n.id} n={n} open={openId === n.id} onPress={() => press(n)} onGo={go} />
          ))}
          {earlier.length && fresh.length ? heading("Earlier") : null}
          {earlier.map((n) => (
            <Row key={n.id} n={n} open={openId === n.id} onPress={() => press(n)} onGo={go} />
          ))}
          {more ? (
            <Pressable
              onPress={loadOlder}
              disabled={loadingMore}
              accessibilityRole="button"
              className="items-center justify-center active:opacity-60"
              style={{ minHeight: 44 }}
            >
              {loadingMore ? (
                <ActivityIndicator color={BRAND} />
              ) : (
                <Text
                  {...COMPACT_TEXT}
                  className="font-bold text-brand"
                  style={{ fontSize: 13 }}
                >
                  Show older
                </Text>
              )}
            </Pressable>
          ) : null}
        </ScrollView>
      )}
    </>
  );
}

/**
 * The only place notifications are read: a panel over whatever screen is showing (there is no notifications page).
 * Rendered once, in the root layout. Opened from Home's bell it hangs from the bell with a small pointer;
 * opened from Settings or a push notification it sits in the same spot without the pointer.
 */
export function NotificationsPanel() {
  const { inbox, closeInbox: onClose } = useNotifications();
  const visible = inbox.open;
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();
  const reduced = useReducedMotion();
  const SIDE = 14;
  // Home's header: the bell ends 65 below the header's top (12 padding, centred in the 60-tall name block);
  // on web the tab bar (72) sits above it. Bell centre from the right: 20 edge + 48 avatar + 10 gap + 23.
  const top = insets.top + (Platform.OS === "web" ? 72 : 8) + 78;
  const caretRight = insets.right + 20 + 48 + 10 + 23;
  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      statusBarTranslucent
      onRequestClose={onClose}
    >
      <Animated.View
        entering={reduced ? undefined : FadeIn.duration(160)}
        style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.62)" }}
      >
        <Pressable
          onPress={onClose}
          accessibilityLabel="Close notifications"
          accessibilityRole="button"
          style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0 }}
        />
        <Animated.View
          entering={reduced ? undefined : FadeInUp.duration(220)}
          accessibilityViewIsModal
          style={{
            position: "absolute",
            top,
            right: SIDE,
            left: SIDE,
            maxWidth: 440,
            alignSelf: "flex-end",
            marginLeft: "auto",
          }}
        >
          {/* The little pointer up to the bell. */}
          {inbox.anchored ? (
            <View
              style={{
                position: "absolute",
                top: -7,
                right: caretRight - SIDE - 8,
                width: 16,
                height: 16,
                borderRadius: 3,
                backgroundColor: PANEL,
                borderLeftWidth: 1,
                borderTopWidth: 1,
                borderColor: "rgba(61,220,104,0.28)",
                transform: [{ rotate: "45deg" }],
              }}
            />
          ) : null}
          <View
            style={{
              borderRadius: 28,
              backgroundColor: PANEL,
              borderWidth: 1,
              borderColor: "rgba(61,220,104,0.28)",
              boxShadow: "0 18px 50px 0 rgba(0,0,0,0.6)",
              overflow: "hidden",
            }}
          >
            {visible ? (
              <Inbox
                maxHeight={Math.max(220, height - top - 190)}
                onClose={onClose}
              />
            ) : null}
          </View>
        </Animated.View>
      </Animated.View>
    </Modal>
  );
}
