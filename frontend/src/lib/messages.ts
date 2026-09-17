import api from '../api/client';
import { apiOrigin } from './media';

export type MessageKind = 'TEXT' | 'VOICE' | 'PHOTO';

export type MessagePeer = {
  id: string;
  firstName: string;
  lastName: string;
  role: string;
};

export type ApiMessage = {
  id: string;
  senderId: string;
  receiverId: string;
  subject: string;
  body: string;
  kind: MessageKind;
  mediaUrl?: string | null;
  mediaMime?: string | null;
  isRead: boolean;
  readAt?: string | null;
  createdAt: string;
  sender?: MessagePeer;
  receiver?: MessagePeer;
};

export type ConversationSummary = {
  peerId: string;
  peer: MessagePeer;
  preview: string;
  lastMessageAt: string;
  unreadCount: number;
  lastMessage: ApiMessage;
};

export type MessageRealtimeEvent = {
  type: 'message.created' | 'message.read' | 'messages.refresh' | 'heartbeat';
  peerId?: string | null;
  messageId?: string | null;
  at?: string;
};

export const MAX_MESSAGE_PHOTO_BYTES = 1024 * 1024;

export function peerName(peer?: MessagePeer | null) {
  if (!peer) return 'Unknown';
  return `${peer.firstName} ${peer.lastName}`.trim() || 'Unknown';
}

export function formatMessageTime(iso: string) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  const now = new Date();
  const sameDay =
    date.getFullYear() === now.getFullYear() &&
    date.getMonth() === now.getMonth() &&
    date.getDate() === now.getDate();
  if (sameDay) {
    return date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  }
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  const isYesterday =
    date.getFullYear() === yesterday.getFullYear() &&
    date.getMonth() === yesterday.getMonth() &&
    date.getDate() === yesterday.getDate();
  if (isYesterday) return 'Yesterday';
  return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
}

export async function fetchConversations() {
  const { data } = await api.get<ConversationSummary[]>('/messages/conversations');
  return data;
}

export async function fetchContacts() {
  const { data } = await api.get<MessagePeer[]>('/messages/contacts');
  return data;
}

export async function fetchThread(peerId: string) {
  const { data } = await api.get<{ peer: MessagePeer; messages: ApiMessage[] }>(
    `/messages/with/${peerId}`,
  );
  return data;
}

export async function markThreadRead(peerId: string) {
  const { data } = await api.patch<{ marked: number; peerId: string }>(
    `/messages/with/${peerId}/read`,
  );
  return data;
}

export async function sendTextMessage(receiverId: string, body: string) {
  const { data } = await api.post<ApiMessage>('/messages', { receiverId, body });
  return data;
}

export async function sendMediaMessage(
  receiverId: string,
  kind: 'VOICE' | 'PHOTO',
  file: Blob,
  filename: string,
  caption?: string,
) {
  const form = new FormData();
  form.append('receiverId', receiverId);
  form.append('kind', kind);
  if (caption?.trim()) form.append('body', caption.trim());
  form.append('file', file, filename);
  const { data } = await api.post<ApiMessage>('/messages/media', form);
  return data;
}

/** Webhook-style SSE stream; on event the UI should poll/refresh. */
export function subscribeMessageEvents(
  onEvent: (event: MessageRealtimeEvent) => void,
  onStatus?: (connected: boolean) => void,
) {
  const token = localStorage.getItem('token');
  if (!token) {
    onStatus?.(false);
    return () => undefined;
  }

  const base = (api.defaults.baseURL || `${apiOrigin()}/api`).replace(/\/$/, '');
  const url = `${base}/messages/events?token=${encodeURIComponent(token)}`;
  const source = new EventSource(url);
  let opened = false;

  const handle = (type: MessageRealtimeEvent['type']) => (raw: Event) => {
    const messageEvent = raw as MessageEvent<string>;
    let parsed: MessageRealtimeEvent = { type };
    try {
      const data = JSON.parse(messageEvent.data) as MessageRealtimeEvent;
      parsed = {
        ...data,
        type: (data.type as MessageRealtimeEvent['type']) || type,
      };
    } catch {
      parsed = { type };
    }
    if (parsed.type === 'heartbeat') return;
    onEvent(parsed);
  };

  source.onopen = () => {
    opened = true;
    onStatus?.(true);
  };
  source.onerror = () => {
    onStatus?.(false);
  };

  source.addEventListener('message.created', handle('message.created'));
  source.addEventListener('message.read', handle('message.read'));
  source.addEventListener('messages.refresh', handle('messages.refresh'));
  source.addEventListener('heartbeat', handle('heartbeat'));
  source.onmessage = handle('messages.refresh');

  return () => {
    source.close();
    if (opened) onStatus?.(false);
  };
}
