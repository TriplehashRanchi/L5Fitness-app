import { useRouter, type Href } from "expo-router";
import { Image } from "expo-image";
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
import { useProfile } from "@/providers/profile-provider";

const BRAND = "#3ddc68";
/** The second line of a notification: lighter than the usual muted green-grey, so it is easy to read. */
const SUBTLE = "#c9d3cc";
const PANEL = "#0d1f14";
const COMPACT_TEXT = { maxFontSizeMultiplier: 1.3 } as const;
const PAGE = 30;

/**
 * Where tapping a message takes the person, straight away: a chat message opens the chat, a logs message
 * opens the logs. Inbox and Home messages have nowhere else to go, so a tap opens them in place to read.
 */
const GO: Partial<Record<Screen, Href>> = {
  diet: "/diet" as Href,
  logs: "/logs" as Href,
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

/**
 * One notification in two lines, and no more:
 *   line 1  who it is from and what happened ("Priya sent a message"), with the time at the right
 *   line 2  the start of the text, ending in "…" when there is more
 * The picture says what kind it is: a message, something from the dietitian, or the gym itself (its logo).
 * The first line is white and the second a light grey, so both read easily on the dark panel.
 * An unread one has a green dot and bolder words. A message that leads nowhere opens in place when
 * tapped (`open`), and only then shows its whole text.
 */
function Row({
  n,
  open,
  last,
  onPress,
}: {
  n: AppNotification;
  open: boolean;
  /** The last row of its group: no line under it. */
  last: boolean;
  onPress: () => void;
}) {
  const admin = n.fromRole === "admin";
  const sender = admin ? "L5 Fitness" : n.from;
  // What kind of notification this is decides its picture:
  //   a chat message          → a message bubble
  //   something from the gym  → the L5 Fitness logo
  //   something from the dietitian (a plan, new targets) → the dietitian's fork and knife
  const kind = n.screen === "diet" ? "message" : admin ? "company" : "dietitian";
  return (
    <Animated.View layout={LinearTransition.duration(180)}>
      <Pressable
        onPress={onPress}
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        accessibilityLabel={`${n.read ? "" : "Unread. "}${sender}. ${n.title}. ${n.body}`}
        className="flex-row items-center active:opacity-70"
        style={{ gap: 12, paddingHorizontal: 12, paddingVertical: 13 }}
      >
        {kind === "company" ? (
          <Image
            source={require("@/assets/images/icon.png")}
            style={{ width: 40, height: 40, borderRadius: 20 }}
            contentFit="cover"
            accessible={false}
          />
        ) : (
          <View
            className="items-center justify-center"
            style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: n.read ? "rgba(255,255,255,0.08)" : "rgba(61,220,104,0.18)" }}
          >
            <SymbolView
              name={
                kind === "message"
                  ? { ios: "bubble.left.fill", android: "chat", web: "chat" }
                  : { ios: "fork.knife", android: "restaurant", web: "restaurant" }
              }
              tintColor={n.read ? "#e3ebe5" : BRAND}
              size={18}
            />
          </View>
        )}
        <View className="flex-1">
          <View className="flex-row items-center" style={{ gap: 8 }}>
            <Text
              {...COMPACT_TEXT}
              className={n.read ? "flex-1 font-semibold text-white" : "flex-1 font-bold text-white"}
              style={{ fontSize: 15, lineHeight: 20 }}
              numberOfLines={open ? undefined : 1}
            >
              {n.title}
            </Text>
            <Text {...COMPACT_TEXT} className="text-muted" style={{ fontSize: 12 }}>
              {ago(n.createdAt)}
            </Text>
            {!n.read ? (
              <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: BRAND }} />
            ) : null}
          </View>
          {n.body ? (
            <Text
              {...COMPACT_TEXT}
              selectable={open}
              ellipsizeMode="tail"
              style={{ fontSize: 13, lineHeight: 18, marginTop: 2, color: SUBTLE }}
              numberOfLines={open ? undefined : 1}
            >
              {n.body}
            </Text>
          ) : null}
        </View>
      </Pressable>
      {last ? null : <View style={{ height: 1, marginLeft: 62, marginRight: 12, backgroundColor: "rgba(255,255,255,0.06)" }} />}
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
  const { role } = useProfile();
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

  const go = (href: Href) => {
    onClose();
    router.navigate(href);
  };

  // A tap marks the message read and goes where it points (a chat message opens the chat). A message
  // that points nowhere opens right here instead, so it can be read in full.
  const press = (n: AppNotification) => {
    // For a dietitian a message from the admin is in their own chat with the admin, not in the client list.
    const href = n.screen === "diet" && n.fromRole === "admin" && role === "dietitian" ? ("/chat/admin" as Href) : GO[n.screen];
    if (href) go(href);
    else setOpenId((id) => (id === n.id ? null : n.id));
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
      style={{ fontSize: 11, letterSpacing: 1.2, marginLeft: 12, marginBottom: 2, marginTop: 10 }}
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
          {fresh.map((n, i) => (
            <Row key={n.id} n={n} open={openId === n.id} last={i === fresh.length - 1} onPress={() => press(n)} />
          ))}
          {earlier.length && fresh.length ? heading("Earlier") : null}
          {earlier.map((n, i) => (
            <Row key={n.id} n={n} open={openId === n.id} last={i === earlier.length - 1} onPress={() => press(n)} />
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
