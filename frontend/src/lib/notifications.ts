import { subscribeMessageEvents } from './messages';
import {
  fetchUnreadCounts,
  type UnreadCounts,
} from './unread';

export type NotificationItem = {
  id: string;
  kind: 'message' | 'announcement' | 'assignment';
  title: string;
  body: string;
  at: number;
};

const recentKey = 'school:recent-notifications';

function readRecent(): NotificationItem[] {
  try {
    const raw = sessionStorage.getItem(recentKey);
    if (!raw) return [];
    return JSON.parse(raw) as NotificationItem[];
  } catch {
    return [];
  }
}

function writeRecent(items: NotificationItem[]) {
  try {
    sessionStorage.setItem(recentKey, JSON.stringify(items.slice(0, 20)));
  } catch {
    /* ignore */
  }
}

export function pushLocalNotification(item: Omit<NotificationItem, 'id' | 'at'>) {
  const next: NotificationItem = {
    ...item,
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    at: Date.now(),
  };
  const list = [next, ...readRecent()].slice(0, 20);
  writeRecent(list);
  window.dispatchEvent(new CustomEvent('school:notification', { detail: next }));
  return next;
}

export function getRecentNotifications() {
  return readRecent();
}

export function clearRecentNotifications() {
  writeRecent([]);
  window.dispatchEvent(new Event('school:notifications-cleared'));
}

export function subscribeLocalNotifications(handler: (item: NotificationItem) => void) {
  const onNotify = (event: Event) => {
    handler((event as CustomEvent<NotificationItem>).detail);
  };
  window.addEventListener('school:notification', onNotify);
  return () => window.removeEventListener('school:notification', onNotify);
}

export async function ensureNotificationPermission() {
  if (typeof window === 'undefined' || !('Notification' in window)) {
    return 'denied' as NotificationPermission;
  }
  if (Notification.permission === 'granted' || Notification.permission === 'denied') {
    return Notification.permission;
  }
  try {
    return await Notification.requestPermission();
  } catch {
    return 'denied' as NotificationPermission;
  }
}

export function showBrowserNotification(title: string, body: string, tag?: string) {
  if (typeof window === 'undefined' || !('Notification' in window)) return;
  if (Notification.permission !== 'granted') return;
  try {
    const n = new Notification(title, {
      body,
      tag,
      silent: false,
    });
    n.onclick = () => {
      window.focus();
      n.close();
    };
  } catch {
    /* ignore */
  }
}

type PortalNotifyOptions = {
  includeAssignments?: boolean;
  onCounts: (counts: UnreadCounts) => void;
};

/**
 * Poll unread counts + listen for message SSE; fire local + browser
 * notifications when announcements or messages increase.
 */
export function startPortalNotifications(options: PortalNotifyOptions) {
  const includeAssignments = options.includeAssignments ?? false;
  let prev: UnreadCounts | null = null;
  let disposed = false;
  let refreshing = false;
  let queued = false;

  const refresh = async () => {
    if (disposed) return;
    if (refreshing) {
      queued = true;
      return;
    }
    refreshing = true;
    try {
      const counts = await fetchUnreadCounts({ includeAssignments }).catch(
        () =>
          ({
            announcements: 0,
            assignments: 0,
            messages: 0,
          }) satisfies UnreadCounts,
      );
      if (disposed) return;
      options.onCounts(counts);

      if (prev) {
        const msgDelta = counts.messages - prev.messages;
        const annDelta = counts.announcements - prev.announcements;
        const asgDelta = counts.assignments - prev.assignments;

        if (msgDelta > 0) {
          const body =
            msgDelta === 1
              ? 'You have a new message'
              : `You have ${msgDelta} new messages`;
          pushLocalNotification({ kind: 'message', title: 'New message', body });
          showBrowserNotification('New message', body, 'school-message');
        }

        if (annDelta > 0) {
          const body =
            annDelta === 1
              ? 'A new announcement was posted'
              : `${annDelta} new announcements`;
          pushLocalNotification({
            kind: 'announcement',
            title: 'New announcement',
            body,
          });
          showBrowserNotification('New announcement', body, 'school-announcement');
        }

        if (asgDelta > 0) {
          const body =
            asgDelta === 1
              ? 'A new assignment was posted'
              : `${asgDelta} new assignments`;
          pushLocalNotification({
            kind: 'assignment',
            title: 'New assignment',
            body,
          });
          showBrowserNotification('New assignment', body, 'school-assignment');
        }
      }

      prev = counts;
    } finally {
      refreshing = false;
      if (queued && !disposed) {
        queued = false;
        void refresh();
      }
    }
  };

  void ensureNotificationPermission();
  void refresh();

  const pollId = window.setInterval(() => {
    void refresh();
  }, 15000);

  const unsubUnread = (() => {
    const handler = () => {
      void refresh();
    };
    window.addEventListener('school:unread-changed', handler);
    return () => window.removeEventListener('school:unread-changed', handler);
  })();

  const unsubSse = subscribeMessageEvents((event) => {
    if (
      event.type === 'message.created' ||
      event.type === 'messages.refresh' ||
      event.type === 'message.read'
    ) {
      void refresh();
    }
  });

  return () => {
    disposed = true;
    window.clearInterval(pollId);
    unsubUnread();
    unsubSse();
  };
}
