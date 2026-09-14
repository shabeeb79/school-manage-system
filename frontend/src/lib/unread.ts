import api from '../api/client';

export type UnreadCounts = {
  announcements: number;
  assignments: number;
  messages: number;
};

export async function fetchAnnouncementUnreadCount() {
  const { data } = await api.get<{ count: number }>('/posts/feed/unread-count');
  return data.count ?? 0;
}

export async function markAnnouncementsRead() {
  await api.patch('/posts/feed/read');
}

export async function fetchAssignmentUnreadCount() {
  const { data } = await api.get<{ count: number }>('/assignments/unread-count');
  return data.count ?? 0;
}

export async function markAssignmentRead(assignmentId: string) {
  await api.patch(`/assignments/${assignmentId}/read`);
}

export async function markAssignmentsReadAll() {
  await api.patch('/assignments/read-all');
}

export async function fetchMessageUnreadCount() {
  const { data } = await api.get<{ count: number }>('/messages/unread-count');
  return data.count ?? 0;
}

export function totalConversationUnread(conversations: { unreadCount: number }[]) {
  return conversations.reduce((sum, thread) => sum + (thread.unreadCount || 0), 0);
}

export async function fetchUnreadCounts(options?: {
  includeAssignments?: boolean;
}): Promise<UnreadCounts> {
  const includeAssignments = options?.includeAssignments ?? true;
  const [announcements, assignments, messages] = await Promise.all([
    fetchAnnouncementUnreadCount().catch(() => 0),
    includeAssignments ? fetchAssignmentUnreadCount().catch(() => 0) : Promise.resolve(0),
    fetchMessageUnreadCount().catch(() => 0),
  ]);
  return { announcements, assignments, messages };
}

export function formatUnreadBadge(count: number) {
  if (count <= 0) return null;
  return count > 99 ? '99+' : String(count);
}

export function emitUnreadChanged() {
  window.dispatchEvent(new Event('school:unread-changed'));
}

export function subscribeUnreadChanged(handler: () => void) {
  window.addEventListener('school:unread-changed', handler);
  return () => window.removeEventListener('school:unread-changed', handler);
}
