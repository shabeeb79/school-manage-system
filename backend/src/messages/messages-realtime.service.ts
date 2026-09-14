import { Injectable, MessageEvent, OnModuleDestroy } from '@nestjs/common';
import { Observable, Subject, filter, map, merge, interval } from 'rxjs';

export type MessageWebhookEventType =
  | 'message.created'
  | 'message.read'
  | 'messages.refresh';

export type MessageWebhookPayload = {
  type: MessageWebhookEventType;
  userIds: string[];
  peerId?: string;
  messageId?: string;
  at?: string;
};

@Injectable()
export class MessagesRealtimeService implements OnModuleDestroy {
  private readonly bus = new Subject<MessageWebhookPayload>();

  publish(event: MessageWebhookPayload) {
    const payload: MessageWebhookPayload = {
      ...event,
      at: event.at ?? new Date().toISOString(),
      userIds: Array.from(new Set(event.userIds.filter(Boolean))),
    };
    if (!payload.userIds.length) return;
    this.bus.next(payload);
  }

  /** Notify specific users (used by internal sends and external webhook POST). */
  notifyWebhook(body: {
    type?: MessageWebhookEventType;
    userIds?: string[];
    peerId?: string;
    messageId?: string;
  }) {
    const userIds = body.userIds ?? [];
    this.publish({
      type: body.type ?? 'messages.refresh',
      userIds,
      peerId: body.peerId,
      messageId: body.messageId,
    });
    return { ok: true, notified: userIds.length };
  }

  streamFor(userId: string): Observable<MessageEvent> {
    const heartbeat$ = interval(25000).pipe(
      map(
        () =>
          ({
            type: 'heartbeat',
            data: { at: new Date().toISOString() },
          }) as MessageEvent,
      ),
    );

    const events$ = this.bus.pipe(
      filter((event) => event.userIds.includes(userId)),
      map(
        (event) =>
          ({
            type: event.type,
            data: {
              type: event.type,
              peerId: event.peerId ?? null,
              messageId: event.messageId ?? null,
              at: event.at,
            },
          }) as MessageEvent,
      ),
    );

    return merge(heartbeat$, events$);
  }

  onModuleDestroy() {
    this.bus.complete();
  }
}
