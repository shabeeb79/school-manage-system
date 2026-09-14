import { Bell, Megaphone, MessageSquare, ClipboardList } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { cn } from '../ui';
import { formatUnreadBadge } from '../lib/unread';
import {
  clearRecentNotifications,
  getRecentNotifications,
  subscribeLocalNotifications,
  type NotificationItem,
} from '../lib/notifications';

type Props = {
  totalUnread: number;
  announcements?: number;
  messages?: number;
  assignments?: number;
  onOpenAnnouncements?: () => void;
  onOpenMessages?: () => void;
  onOpenAssignments?: () => void;
  tone?: 'admin' | 'staff' | 'student';
};

function kindIcon(kind: NotificationItem['kind']) {
  if (kind === 'announcement') return Megaphone;
  if (kind === 'assignment') return ClipboardList;
  return MessageSquare;
}

function timeAgo(at: number) {
  const sec = Math.max(0, Math.floor((Date.now() - at) / 1000));
  if (sec < 60) return 'Just now';
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  return `${Math.floor(hr / 24)}d ago`;
}

export default function NotificationBell({
  totalUnread,
  announcements = 0,
  messages = 0,
  assignments = 0,
  onOpenAnnouncements,
  onOpenMessages,
  onOpenAssignments,
  tone = 'admin',
}: Props) {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<NotificationItem[]>(() => getRecentNotifications());
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    return subscribeLocalNotifications((item) => {
      setItems((prev) => [item, ...prev].slice(0, 20));
    });
  }, []);

  useEffect(() => {
    if (!open) return;
    const onDoc = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [open]);

  const badge = formatUnreadBadge(totalUnread);
  const student = tone === 'student';

  const go = (kind: NotificationItem['kind']) => {
    setOpen(false);
    if (kind === 'announcement') onOpenAnnouncements?.();
    else if (kind === 'assignment') onOpenAssignments?.();
    else onOpenMessages?.();
  };

  return (
    <div className="relative" ref={rootRef}>
      <button
        type="button"
        aria-label="Notifications"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className={cn(
          'relative inline-flex h-10 w-10 items-center justify-center text-gray-400 hover:text-gray-700',
          student
            ? 'rounded-full hover:bg-violet-50'
            : 'rounded-lg hover:bg-gray-50',
        )}
      >
        <Bell className="h-4 w-4" />
        {badge && (
          <span
            className={cn(
              'absolute right-1 top-1 inline-flex min-w-[1.05rem] items-center justify-center rounded-full px-1 py-0.5 text-[10px] font-semibold leading-none text-white',
              student ? 'bg-fuchsia-500' : 'bg-red-500',
            )}
          >
            {badge}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 z-50 mt-2 w-[min(100vw-2rem,22rem)] overflow-hidden rounded-xl border border-gray-200 bg-white shadow-lg">
          <div className="flex items-center justify-between border-b border-gray-100 px-3 py-2.5">
            <p className="text-sm font-semibold text-gray-900">Notifications</p>
            {items.length > 0 && (
              <button
                type="button"
                className="text-xs text-gray-500 hover:text-gray-800"
                onClick={() => {
                  clearRecentNotifications();
                  setItems([]);
                }}
              >
                Clear
              </button>
            )}
          </div>

          <div className="space-y-1 border-b border-gray-100 px-3 py-2">
            {announcements > 0 && (
              <button
                type="button"
                onClick={() => go('announcement')}
                className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-sm hover:bg-gray-50"
              >
                <Megaphone className="h-4 w-4 text-amber-600" />
                <span className="flex-1 text-gray-700">
                  {announcements} unread announcement{announcements === 1 ? '' : 's'}
                </span>
              </button>
            )}
            {messages > 0 && (
              <button
                type="button"
                onClick={() => go('message')}
                className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-sm hover:bg-gray-50"
              >
                <MessageSquare className="h-4 w-4 text-blue-600" />
                <span className="flex-1 text-gray-700">
                  {messages} unread message{messages === 1 ? '' : 's'}
                </span>
              </button>
            )}
            {assignments > 0 && (
              <button
                type="button"
                onClick={() => go('assignment')}
                className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-sm hover:bg-gray-50"
              >
                <ClipboardList className="h-4 w-4 text-violet-600" />
                <span className="flex-1 text-gray-700">
                  {assignments} unread assignment{assignments === 1 ? '' : 's'}
                </span>
              </button>
            )}
            {announcements <= 0 && messages <= 0 && assignments <= 0 && items.length === 0 && (
              <p className="px-2 py-3 text-center text-sm text-gray-400">You&apos;re all caught up</p>
            )}
          </div>

          {items.length > 0 && (
            <ul className="max-h-64 overflow-y-auto py-1">
              {items.map((item) => {
                const Icon = kindIcon(item.kind);
                return (
                  <li key={item.id}>
                    <button
                      type="button"
                      onClick={() => go(item.kind)}
                      className="flex w-full items-start gap-2 px-3 py-2.5 text-left hover:bg-gray-50"
                    >
                      <Icon className="mt-0.5 h-4 w-4 shrink-0 text-gray-400" />
                      <span className="min-w-0 flex-1">
                        <span className="block text-sm font-medium text-gray-900">{item.title}</span>
                        <span className="block truncate text-xs text-gray-500">{item.body}</span>
                        <span className="mt-0.5 block text-[11px] text-gray-400">
                          {timeAgo(item.at)}
                        </span>
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
