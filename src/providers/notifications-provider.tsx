import { router, type Href } from 'expo-router';
import { createContext, use, useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { AppState } from 'react-native';

import { getInbox, markRead, setPushEnabled as saveMute, type Screen } from '@/lib/notifications-api';
import { getNotifications, registerForPush, type PushStatus } from '@/lib/push';
import { useProfile } from '@/providers/profile-provider';
import { useAuth } from '@/providers/auth-provider';

type Value = {
  /** messages not opened yet (shown as a dot on the bell) */
  unread: number;
  status: PushStatus | 'checking';
  /** false when the person switched alerts off in our settings (the inbox still fills up) */
  alertsOn: boolean;
  refresh: () => Promise<void>;
  setAlerts: (on: boolean) => Promise<void>;
  retry: () => Promise<void>;
};

const Ctx = createContext<Value | null>(null);

// The screen a message opens. Paths are the app's own routes.
const ROUTES: Record<Screen, Href> = {
  inbox: '/notifications' as Href,
  home: '/' as Href,
  diet: '/diet' as Href,
  logs: '/logs' as Href,
};

export function NotificationsProvider({ children }: { children: ReactNode }) {
  const { session } = useAuth();
  const { status: profileStatus } = useProfile();
  const signedIn = !!session && profileStatus === 'ready';

  const [unread, setUnread] = useState(0);
  const [alertsOn, setAlertsOn] = useState(true);
  const [status, setStatus] = useState<PushStatus | 'checking'>('checking');
  const handled = useRef<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      const inbox = await getInbox();
      setUnread(inbox.unread);
      setAlertsOn(inbox.pushEnabled);
    } catch {
      // keep the last numbers; the bell is not worth an error message
    }
  }, []);

  const retry = useCallback(async () => {
    setStatus('checking');
    setStatus(await registerForPush());
  }, []);

  // Sign in → ask permission, tell the server about this phone, load the unread count.
  useEffect(() => {
    if (!signedIn) return;
    let cancelled = false;
    getInbox()
      .then((inbox) => {
        if (cancelled) return;
        setUnread(inbox.unread);
        setAlertsOn(inbox.pushEnabled);
      })
      .catch(() => {});
    registerForPush().then((result) => !cancelled && setStatus(result));
    return () => {
      cancelled = true;
    };
  }, [signedIn]);

  // Taps on a notification and a push token that the system renewed.
  useEffect(() => {
    const N = getNotifications();
    if (!N || !signedIn) return;

    const open = (response: import('expo-notifications').NotificationResponse | null) => {
      if (!response) return;
      const data = response.notification.request.content.data as { notificationId?: string; screen?: Screen } | undefined;
      const key = response.notification.request.identifier;
      if (handled.current === key) return;
      handled.current = key;
      if (data?.notificationId) markRead([data.notificationId]).then(refresh).catch(() => {});
      router.navigate(ROUTES[data?.screen && data.screen in ROUTES ? data.screen : 'inbox']);
      N.clearLastNotificationResponseAsync().catch(() => {});
    };

    // The app was closed and a tap opened it.
    N.getLastNotificationResponseAsync().then(open).catch(() => {});
    const tap = N.addNotificationResponseReceivedListener(open);
    const arrived = N.addNotificationReceivedListener(() => refresh());
    const renewed = N.addPushTokenListener(() => registerForPush().then(setStatus));
    return () => {
      tap.remove();
      arrived.remove();
      renewed.remove();
    };
  }, [signedIn, refresh]);

  // Coming back to the app: the person may have changed the permission in the phone's settings.
  useEffect(() => {
    if (!signedIn) return;
    const sub = AppState.addEventListener('change', (state) => {
      if (state !== 'active') return;
      refresh();
      registerForPush().then(setStatus);
    });
    return () => sub.remove();
  }, [signedIn, refresh]);

  const setAlerts = useCallback(async (on: boolean) => {
    setAlertsOn(on);
    try {
      await saveMute(on);
    } catch (e) {
      setAlertsOn(!on);
      throw e;
    }
  }, []);

  // Nobody signed in: show nothing (the numbers of the last person are never exposed).
  const value = useMemo(
    () => ({ unread: signedIn ? unread : 0, status: signedIn ? status : ('checking' as const), alertsOn, refresh, setAlerts, retry }),
    [signedIn, unread, status, alertsOn, refresh, setAlerts, retry]
  );
  return <Ctx value={value}>{children}</Ctx>;
}

export function useNotifications() {
  const ctx = use(Ctx);
  if (!ctx) throw new Error('useNotifications must be used inside <NotificationsProvider>');
  return ctx;
}
