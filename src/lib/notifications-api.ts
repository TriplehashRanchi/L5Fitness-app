/** The notification calls to L5Fitness-api. */
import { api } from '@/lib/http';

export type Screen = 'inbox' | 'home' | 'diet' | 'logs';

export type AppNotification = {
  id: string;
  title: string;
  body: string;
  screen: Screen;
  /** who sent it, e.g. "Admin" or the dietitian's name */
  from: string;
  fromRole: 'admin' | 'dietitian';
  createdAt: string;
  read: boolean;
};

export type Inbox = { notifications: AppNotification[]; unread: number; pushEnabled: boolean };

export const getInbox = (before?: string) =>
  api<Inbox>(`/notifications${before ? `?before=${encodeURIComponent(before)}` : ''}`);

/** No ids = mark everything as read. */
export const markRead = (ids?: string[]) =>
  api<void>('/notifications/read', { method: 'POST', body: ids ? { ids } : {} });

export const setPushEnabled = (pushEnabled: boolean) =>
  api<{ pushEnabled: boolean }>('/me/notification-settings', { method: 'PUT', body: { pushEnabled } });

export const registerToken = (token: string, platform: 'ios' | 'android', deviceName?: string | null) =>
  api<void>('/me/push-token', { method: 'POST', body: { token, platform, deviceName: deviceName ?? undefined } });

export const unregisterToken = (token: string) =>
  api<void>('/me/push-token/remove', { method: 'POST', body: { token } });
