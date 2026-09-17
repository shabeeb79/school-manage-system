import {
  Check,
  CheckCheck,
  ChevronLeft,
  Image as ImageIcon,
  Mic,
  Pause,
  Play,
  Plus,
  Send,
  Trash2,
  X,
} from 'lucide-react';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import { useAuth } from '../auth/AuthContext';
import { apiErrorMessage } from '../lib/leave';
import { mediaUrl } from '../lib/media';
import {
  fetchContacts,
  fetchConversations,
  fetchThread,
  formatMessageTime,
  markThreadRead,
  MAX_MESSAGE_PHOTO_BYTES,
  peerName,
  sendMediaMessage,
  sendTextMessage,
  subscribeMessageEvents,
  type ApiMessage,
  type ConversationSummary,
  type MessagePeer,
} from '../lib/messages';
import { Avatar, Card, IconButton, PrimaryButton, SectionHeader, cn } from '../ui';

type Variant = 'student' | 'staff';

function formatRecordTime(totalSecs: number) {
  const mins = Math.floor(totalSecs / 60);
  const secs = totalSecs % 60;
  return `${mins}:${String(secs).padStart(2, '0')}`;
}

function RecordingWaveform() {
  const bars = [4, 10, 6, 14, 8, 12, 5, 11, 7, 13, 6, 9];
  return (
    <div className="flex h-8 flex-1 items-center gap-[3px]" aria-hidden>
      {bars.map((h, i) => (
        <span
          key={i}
          className="w-[3px] rounded-full bg-rose-500/90"
          style={{
            height: `${h}px`,
            animation: `msg-wave 0.9s ease-in-out ${i * 0.07}s infinite alternate`,
          }}
        />
      ))}
      <style>{`
        @keyframes msg-wave {
          from { transform: scaleY(0.45); opacity: 0.55; }
          to { transform: scaleY(1); opacity: 1; }
        }
      `}</style>
    </div>
  );
}

const tones = {
  student: {
    activeThread: 'bg-violet-50 hover:bg-violet-50',
    hoverThread: 'hover:bg-violet-50/60',
    border: 'border-violet-100',
    chatBg: 'bg-violet-50/30',
    bubbleOut: 'rounded-2xl rounded-br-md bg-indigo-600 text-white',
    bubbleIn: 'rounded-2xl rounded-bl-md border border-violet-100 bg-white text-gray-900',
    tickUnread: 'text-indigo-200',
    tickRead: 'text-sky-300',
    voicePlayMine: 'bg-white text-indigo-600',
    voicePlayTheirs: 'bg-indigo-600 text-white',
    voiceWaveMine: 'bg-white/35',
    voiceWaveMineActive: 'bg-white',
    voiceWaveTheirs: 'bg-indigo-200',
    voiceWaveTheirsActive: 'bg-indigo-600',
    voiceMetaMine: 'text-white/80',
    voiceMetaTheirs: 'text-gray-500',
    input:
      'rounded-full border border-violet-100 focus:border-indigo-600 focus:ring-indigo-600',
  },
  staff: {
    activeThread: 'bg-blue-50 hover:bg-blue-50',
    hoverThread: 'hover:bg-gray-50',
    border: 'border-gray-200',
    chatBg: 'bg-gray-50',
    bubbleOut: 'rounded-2xl rounded-br-md bg-blue-600 text-white',
    bubbleIn: 'rounded-2xl rounded-bl-md border border-gray-200 bg-white text-gray-900',
    tickUnread: 'text-blue-200',
    tickRead: 'text-sky-300',
    voicePlayMine: 'bg-white text-blue-600',
    voicePlayTheirs: 'bg-blue-600 text-white',
    voiceWaveMine: 'bg-white/35',
    voiceWaveMineActive: 'bg-white',
    voiceWaveTheirs: 'bg-blue-200',
    voiceWaveTheirsActive: 'bg-blue-600',
    voiceMetaMine: 'text-white/80',
    voiceMetaTheirs: 'text-gray-500',
    input:
      'rounded-full border border-gray-200 focus:border-blue-600 focus:ring-blue-600',
  },
} as const;

function ReadTicks({
  message,
  mine,
  variant,
}: {
  message: ApiMessage;
  mine: boolean;
  variant: Variant;
}) {
  if (!mine) return null;
  const tone = tones[variant];
  if (message.isRead) {
    return <CheckCheck className={cn('h-3.5 w-3.5', tone.tickRead)} aria-label="Read" />;
  }
  return <Check className={cn('h-3.5 w-3.5', tone.tickUnread)} aria-label="Sent" />;
}

const VOICE_BARS = [3, 8, 5, 12, 7, 14, 6, 11, 9, 13, 4, 10, 8, 15, 6, 12, 5, 9, 11, 7, 13, 4, 8, 10];

function VoiceNotePlayer({
  src,
  mime,
  mine,
  variant,
}: {
  src: string;
  mime?: string | null;
  mine: boolean;
  variant: Variant;
}) {
  const tone = tones[variant];
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [playing, setPlaying] = useState(false);
  const [duration, setDuration] = useState(0);
  const [current, setCurrent] = useState(0);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const onLoaded = () => {
      if (Number.isFinite(audio.duration)) setDuration(audio.duration);
    };
    const onTime = () => setCurrent(audio.currentTime);
    const onEnded = () => {
      setPlaying(false);
      setCurrent(0);
    };

    audio.addEventListener('loadedmetadata', onLoaded);
    audio.addEventListener('durationchange', onLoaded);
    audio.addEventListener('timeupdate', onTime);
    audio.addEventListener('ended', onEnded);
    return () => {
      audio.removeEventListener('loadedmetadata', onLoaded);
      audio.removeEventListener('durationchange', onLoaded);
      audio.removeEventListener('timeupdate', onTime);
      audio.removeEventListener('ended', onEnded);
    };
  }, [src]);

  const toggle = async () => {
    const audio = audioRef.current;
    if (!audio) return;
    if (playing) {
      audio.pause();
      setPlaying(false);
      return;
    }
    try {
      await audio.play();
      setPlaying(true);
    } catch {
      setPlaying(false);
    }
  };

  const progress = duration > 0 ? Math.min(1, current / duration) : 0;
  const displaySecs = playing || current > 0 ? current : duration;
  const activeCount = Math.round(progress * VOICE_BARS.length);

  return (
    <div className="flex w-[220px] items-center gap-2.5 sm:w-[240px]">
      <audio ref={audioRef} preload="metadata" src={src} className="hidden">
        {mime ? <source src={src} type={mime} /> : null}
      </audio>
      <button
        type="button"
        onClick={() => {
          void toggle();
        }}
        aria-label={playing ? 'Pause voice message' : 'Play voice message'}
        className={cn(
          'inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full shadow-sm',
          mine ? tone.voicePlayMine : tone.voicePlayTheirs,
        )}
      >
        {playing ? (
          <Pause className="h-4 w-4 fill-current" />
        ) : (
          <Play className="h-4 w-4 translate-x-px fill-current" />
        )}
      </button>
      <div className="min-w-0 flex-1">
        <div className="flex h-8 items-center gap-[2px]">
          {VOICE_BARS.map((h, i) => (
            <span
              key={i}
              className={cn(
                'w-[2.5px] rounded-full transition-colors',
                i < activeCount
                  ? mine
                    ? tone.voiceWaveMineActive
                    : tone.voiceWaveTheirsActive
                  : mine
                    ? tone.voiceWaveMine
                    : tone.voiceWaveTheirs,
              )}
              style={{ height: `${h}px` }}
            />
          ))}
        </div>
        <p
          className={cn(
            'mt-0.5 tabular-nums text-[11px]',
            mine ? tone.voiceMetaMine : tone.voiceMetaTheirs,
          )}
        >
          {formatRecordTime(Math.floor(displaySecs || 0))}
        </p>
      </div>
      <Mic
        className={cn(
          'h-4 w-4 shrink-0 opacity-70',
          mine ? 'text-white' : variant === 'student' ? 'text-indigo-500' : 'text-blue-500',
        )}
      />
    </div>
  );
}

function MessageBubble({
  message,
  mine,
  variant,
}: {
  message: ApiMessage;
  mine: boolean;
  variant: Variant;
}) {
  const tone = tones[variant];
  const src = mediaUrl(message.mediaUrl);
  const isPhoto = message.kind === 'PHOTO' && Boolean(src);
  const isVoice = message.kind === 'VOICE' && Boolean(src);
  const caption = message.body?.trim()
    ? message.body
    : message.kind === 'TEXT'
      ? message.subject
      : '';

  return (
    <div className={cn('flex', mine ? 'justify-end' : 'justify-start')}>
      <div
        className={cn(
          'max-w-[85%] text-sm shadow-sm',
          mine ? tone.bubbleOut : tone.bubbleIn,
          isPhoto ? 'overflow-hidden p-1' : 'px-3 py-2',
        )}
      >
        {isPhoto && src && (
          <a href={src} target="_blank" rel="noreferrer" className="block">
            <img
              src={src}
              alt={caption || 'Photo'}
              loading="lazy"
              decoding="async"
              className={cn(
                'max-h-64 w-full object-cover',
                caption ? 'rounded-xl' : 'rounded-[0.85rem]',
              )}
            />
          </a>
        )}

        {isVoice && src && (
          <VoiceNotePlayer
            src={src}
            mime={message.mediaMime}
            mine={mine}
            variant={variant}
          />
        )}

        {caption ? (
          <p
            className={cn(
              'whitespace-pre-wrap',
              isPhoto && 'mt-1.5 px-1.5',
              isVoice && 'mt-1.5',
            )}
          >
            {caption}
          </p>
        ) : null}

        <p
          className={cn(
            'mt-1 flex items-center justify-end gap-1 text-[11px]',
            isPhoto && 'px-1.5',
            mine ? 'text-white/80' : 'text-gray-400',
          )}
        >
          <span>{formatMessageTime(message.createdAt)}</span>
          <ReadTicks message={message} mine={mine} variant={variant} />
        </p>
      </div>
    </div>
  );
}

export default function MessagesChat({
  subtitle,
  variant = 'staff',
  onUnreadChange,
}: {
  subtitle: string;
  variant?: Variant;
  onUnreadChange?: (count: number) => void;
}) {
  const { user } = useAuth();
  const tone = tones[variant];
  const meId = user?.id ?? '';

  const [conversations, setConversations] = useState<ConversationSummary[]>([]);
  const [contacts, setContacts] = useState<MessagePeer[]>([]);
  const [activePeerId, setActivePeerId] = useState<string | null>(null);
  const [peer, setPeer] = useState<MessagePeer | null>(null);
  const [messages, setMessages] = useState<ApiMessage[]>([]);
  const [draft, setDraft] = useState('');
  const [mobileShowChat, setMobileShowChat] = useState(false);
  const [composeOpen, setComposeOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [recording, setRecording] = useState(false);
  const [recordSecs, setRecordSecs] = useState(0);

  const photoInputRef = useRef<HTMLInputElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const recordTimerRef = useRef<number | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const activePeerIdRef = useRef<string | null>(null);
  const webhookConnectedRef = useRef(false);
  const onUnreadChangeRef = useRef(onUnreadChange);
  onUnreadChangeRef.current = onUnreadChange;

  const loadConversations = async () => {
    const [convos, people] = await Promise.all([fetchConversations(), fetchContacts()]);
    setConversations(convos);
    setContacts(people);
    const total = convos.reduce((sum, thread) => sum + (thread.unreadCount || 0), 0);
    onUnreadChangeRef.current?.(total);
  };

  const refreshFromWebhook = async (peerId?: string | null) => {
    try {
      await loadConversations();
      const openPeer = peerId || activePeerIdRef.current;
      if (!openPeer) return;
      if (peerId && activePeerIdRef.current && peerId !== activePeerIdRef.current) {
        // Event for another thread — list already refreshed.
        return;
      }
      if (activePeerIdRef.current === openPeer) {
        const data = await fetchThread(openPeer);
        setPeer(data.peer);
        setMessages(data.messages);
      }
    } catch {
      /* ignore transient refresh errors */
    }
  };

  const openThread = async (peerId: string) => {
    setActivePeerId(peerId);
    activePeerIdRef.current = peerId;
    setMobileShowChat(true);
    setComposeOpen(false);
    setError('');
    try {
      await markThreadRead(peerId);
      const data = await fetchThread(peerId);
      setPeer(data.peer);
      setMessages(data.messages);
      await loadConversations();
    } catch (err) {
      setError(apiErrorMessage(err, 'Could not open conversation.'));
    }
  };

  useEffect(() => {
    let active = true;
    (async () => {
      setLoading(true);
      setError('');
      try {
        await loadConversations();
      } catch (err) {
        if (active) setError(apiErrorMessage(err, 'Could not load messages.'));
      } finally {
        if (active) setLoading(false);
      }
    })().catch(console.error);
    return () => {
      active = false;
    };
  }, []);

  // Webhook (SSE) push → poll/refresh; polling is fallback when stream is down.
  useEffect(() => {
    const unsubscribe = subscribeMessageEvents(
      (event) => {
        void refreshFromWebhook(event.peerId);
      },
      (connected) => {
        webhookConnectedRef.current = connected;
      },
    );

    const pollId = window.setInterval(() => {
      const intervalPeer = activePeerIdRef.current;
      // Fast poll only when webhook stream is disconnected.
      if (webhookConnectedRef.current) return;
      void refreshFromWebhook(intervalPeer);
    }, 5000);

    const slowPollId = window.setInterval(() => {
      // Safety net even while webhook is connected.
      if (!webhookConnectedRef.current) return;
      void refreshFromWebhook(activePeerIdRef.current);
    }, 30000);

    return () => {
      unsubscribe();
      window.clearInterval(pollId);
      window.clearInterval(slowPollId);
    };
  }, []);

  useEffect(() => {
    activePeerIdRef.current = activePeerId;
  }, [activePeerId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length, activePeerId]);

  useEffect(() => {
    return () => {
      if (recordTimerRef.current) window.clearInterval(recordTimerRef.current);
      streamRef.current?.getTracks().forEach((t) => t.stop());
      if (photoPreview) URL.revokeObjectURL(photoPreview);
    };
  }, [photoPreview]);

  const contactOptions = contacts.filter(
    (c) => !conversations.some((convo) => convo.peerId === c.id),
  );

  const clearPhoto = () => {
    if (photoPreview) URL.revokeObjectURL(photoPreview);
    setPhotoPreview(null);
    setPhotoFile(null);
    if (photoInputRef.current) photoInputRef.current.value = '';
  };

  const onPickPhoto = (file: File | undefined) => {
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setError('Only photo images are allowed.');
      return;
    }
    if (file.size > MAX_MESSAGE_PHOTO_BYTES) {
      setError('Photo must be 1MB or smaller.');
      return;
    }
    setError('');
    if (photoPreview) URL.revokeObjectURL(photoPreview);
    setPhotoFile(file);
    setPhotoPreview(URL.createObjectURL(file));
  };

  const stopRecordingTracks = () => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    if (recordTimerRef.current) {
      window.clearInterval(recordTimerRef.current);
      recordTimerRef.current = null;
    }
    setRecording(false);
    setRecordSecs(0);
  };

  const startRecording = async () => {
    if (!activePeerId || sending) return;
    setError('');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const mime = MediaRecorder.isTypeSupported('audio/webm')
        ? 'audio/webm'
        : MediaRecorder.isTypeSupported('audio/mp4')
          ? 'audio/mp4'
          : '';
      const recorder = mime
        ? new MediaRecorder(stream, { mimeType: mime })
        : new MediaRecorder(stream);
      chunksRef.current = [];
      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) chunksRef.current.push(event.data);
      };
      recorder.onstop = async () => {
        const blob = new Blob(chunksRef.current, {
          type: recorder.mimeType || 'audio/webm',
        });
        stopRecordingTracks();
        if (!activePeerId || blob.size === 0) return;
        setSending(true);
        try {
          const ext = blob.type.includes('mp4') ? 'm4a' : 'webm';
          await sendMediaMessage(activePeerId, 'VOICE', blob, `voice.${ext}`);
          const data = await fetchThread(activePeerId);
          setMessages(data.messages);
          await loadConversations();
        } catch (err) {
          setError(apiErrorMessage(err, 'Could not send voice message.'));
        } finally {
          setSending(false);
        }
      };
      mediaRecorderRef.current = recorder;
      recorder.start();
      setRecording(true);
      setRecordSecs(0);
      recordTimerRef.current = window.setInterval(() => {
        setRecordSecs((s) => s + 1);
      }, 1000);
    } catch {
      setError('Microphone access is required for voice messages.');
      stopRecordingTracks();
    }
  };

  const stopRecording = () => {
    const recorder = mediaRecorderRef.current;
    if (recorder && recorder.state !== 'inactive') {
      recorder.stop();
    } else {
      stopRecordingTracks();
    }
  };

  const cancelRecording = () => {
    const recorder = mediaRecorderRef.current;
    if (recorder) {
      recorder.ondataavailable = null;
      recorder.onstop = () => {
        stopRecordingTracks();
      };
      if (recorder.state !== 'inactive') recorder.stop();
      else stopRecordingTracks();
    } else {
      stopRecordingTracks();
    }
    chunksRef.current = [];
  };

  const send = async (event?: FormEvent) => {
    event?.preventDefault();
    if (!activePeerId || sending) return;
    const text = draft.trim();
    if (!text && !photoFile) return;

    setSending(true);
    setError('');
    try {
      if (photoFile) {
        await sendMediaMessage(activePeerId, 'PHOTO', photoFile, photoFile.name, text);
        clearPhoto();
        setDraft('');
      } else {
        await sendTextMessage(activePeerId, text);
        setDraft('');
      }
      const data = await fetchThread(activePeerId);
      setMessages(data.messages);
      await loadConversations();
    } catch (err) {
      setError(apiErrorMessage(err, 'Could not send message.'));
    } finally {
      setSending(false);
    }
  };

  return (
    <>
      <SectionHeader title="Messages" subtitle={subtitle} />
      <Card className="flex h-[calc(100dvh-12rem)] overflow-hidden md:h-[520px]">
        <div
          className={cn(
            'w-full shrink-0 flex-col md:flex md:w-72 md:border-r',
            tone.border,
            mobileShowChat ? 'hidden md:flex' : 'flex',
          )}
        >
          <div className={cn('border-b p-3', tone.border)}>
            <div className="flex items-center justify-between gap-2">
              <p className="text-sm font-semibold text-gray-900">Chats</p>
              <button
                type="button"
                aria-label="New conversation"
                onClick={() => setComposeOpen((v) => !v)}
                className="inline-flex h-8 w-8 items-center justify-center rounded-md text-gray-500 hover:bg-gray-50 hover:text-gray-800"
              >
                <Plus className="h-4 w-4" />
              </button>
            </div>
            {composeOpen && (
              <div className="mt-2 max-h-40 overflow-y-auto rounded-lg border border-gray-200 bg-white p-1">
                {contactOptions.length === 0 && (
                  <p className="px-2 py-2 text-xs text-gray-400">No new contacts</p>
                )}
                {contactOptions.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => openThread(c.id)}
                    className="flex w-full items-center gap-2 rounded-md px-2 py-2 text-left text-sm hover:bg-gray-50"
                  >
                    <Avatar name={peerName(c)} size="sm" />
                    <span className="min-w-0">
                      <span className="block truncate font-medium text-gray-900">
                        {peerName(c)}
                      </span>
                      <span className="block text-xs text-gray-400">{c.role}</span>
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>
          <ul className="flex-1 overflow-y-auto">
            {loading && (
              <li className="px-3 py-4 text-sm text-gray-400">Loading...</li>
            )}
            {!loading && conversations.length === 0 && (
              <li className="px-3 py-4 text-sm text-gray-400">
                No conversations yet. Tap + to start one.
              </li>
            )}
            {conversations.map((thread) => (
              <li key={thread.peerId}>
                <button
                  type="button"
                  onClick={() => openThread(thread.peerId)}
                  className={cn(
                    'flex w-full items-start gap-3 px-3 py-3 text-left',
                    tone.hoverThread,
                    thread.peerId === activePeerId && tone.activeThread,
                  )}
                >
                  <span className="relative shrink-0">
                    <Avatar name={peerName(thread.peer)} />
                    {thread.unreadCount > 0 && (
                      <span className="absolute -right-1 -top-1 h-2.5 w-2.5 rounded-full bg-rose-500 ring-2 ring-white" />
                    )}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center justify-between gap-2">
                      <span
                        className={cn(
                          'truncate text-sm',
                          thread.unreadCount
                            ? 'font-bold text-gray-900'
                            : 'font-medium text-gray-900',
                        )}
                      >
                        {peerName(thread.peer)}
                      </span>
                      <span className="flex shrink-0 items-center gap-1.5">
                        <span className="text-xs text-gray-400">
                          {formatMessageTime(thread.lastMessageAt)}
                        </span>
                        {thread.unreadCount > 0 && (
                          <span className="inline-flex min-w-[1.25rem] items-center justify-center rounded-full bg-rose-500 px-1.5 py-0.5 text-[10px] font-semibold leading-none text-white">
                            {thread.unreadCount > 99 ? '99+' : thread.unreadCount}
                          </span>
                        )}
                      </span>
                    </span>
                    <span
                      className={cn(
                        'mt-0.5 block truncate text-xs',
                        thread.unreadCount
                          ? 'font-semibold text-gray-700'
                          : 'text-gray-400',
                      )}
                    >
                      {thread.preview}
                    </span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </div>

        <div className={cn('min-w-0 flex-1 flex-col', mobileShowChat ? 'flex' : 'hidden md:flex')}>
          {!activePeerId || !peer ? (
            <div className="flex flex-1 items-center justify-center p-6 text-sm text-gray-400">
              Select a conversation or start a new one.
            </div>
          ) : (
            <>
              <div className={cn('flex items-center gap-2 border-b px-3 py-3 md:px-4', tone.border)}>
                <IconButton
                  label="Back to conversations"
                  onClick={() => setMobileShowChat(false)}
                  className="md:hidden"
                >
                  <ChevronLeft className="h-5 w-5" />
                </IconButton>
                <Avatar name={peerName(peer)} />
                <div className="min-w-0">
                  <p className="truncate font-semibold text-gray-900">{peerName(peer)}</p>
                  <p className="truncate text-xs text-gray-400">{peer.role}</p>
                </div>
              </div>

              <div className={cn('flex-1 space-y-3 overflow-y-auto px-3 py-4 md:px-4', tone.chatBg)}>
                {messages.map((message) => (
                  <MessageBubble
                    key={message.id}
                    message={message}
                    mine={message.senderId === meId}
                    variant={variant}
                  />
                ))}
                <div ref={bottomRef} />
              </div>

              {error && <p className="px-3 text-sm text-red-600 md:px-4">{error}</p>}

              {photoPreview && (
                <div className={cn('flex items-center gap-2 border-t px-3 py-2', tone.border)}>
                  <img
                    src={photoPreview}
                    alt="Selected"
                    className="h-14 w-14 rounded-md object-cover"
                  />
                  <p className="flex-1 text-xs text-gray-500">Photo ready (max 1MB)</p>
                  <IconButton label="Remove photo" onClick={clearPhoto}>
                    <X className="h-4 w-4" />
                  </IconButton>
                </div>
              )}

              <form
                className={cn('border-t p-2 md:p-3', tone.border)}
                onSubmit={send}
              >
                <input
                  ref={photoInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(event) => onPickPhoto(event.target.files?.[0])}
                />

                {recording ? (
                  <div className="flex items-center gap-2 md:gap-3">
                    <button
                      type="button"
                      onClick={cancelRecording}
                      aria-label="Delete recording"
                      className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-rose-600 transition hover:bg-rose-50"
                    >
                      <Trash2 className="h-5 w-5" />
                    </button>

                    <div
                      className={cn(
                        'flex min-w-0 flex-1 items-center gap-2 rounded-full px-3 py-2',
                        variant === 'student' ? 'bg-rose-50' : 'bg-rose-50',
                      )}
                    >
                      <span className="relative flex h-2.5 w-2.5 shrink-0">
                        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-rose-500 opacity-60" />
                        <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-rose-600" />
                      </span>
                      <span className="shrink-0 tabular-nums text-sm font-semibold text-rose-700">
                        {formatRecordTime(recordSecs)}
                      </span>
                      <RecordingWaveform />
                    </div>

                    <button
                      type="button"
                      onClick={stopRecording}
                      aria-label="Send voice message"
                      className={cn(
                        'inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-white shadow-sm transition hover:opacity-90',
                        variant === 'student' ? 'bg-indigo-600' : 'bg-blue-600',
                      )}
                    >
                      <Send className="h-5 w-5 translate-x-px" />
                    </button>
                  </div>
                ) : (
                  <div className="flex items-center gap-1 md:gap-2">
                    <IconButton
                      label="Attach photo"
                      onClick={() => photoInputRef.current?.click()}
                    >
                      <ImageIcon className="h-4 w-4" />
                    </IconButton>
                    <input
                      value={draft}
                      onChange={(event) => setDraft(event.target.value)}
                      placeholder="Write a message"
                      disabled={sending}
                      className={cn(
                        'h-10 min-w-0 flex-1 bg-white px-3 text-sm placeholder:text-gray-400 focus:outline-none focus:ring-1',
                        tone.input,
                      )}
                    />
                    <IconButton
                      label="Record voice message"
                      onClick={() => startRecording().catch(console.error)}
                      className={sending ? 'pointer-events-none opacity-40' : undefined}
                    >
                      <Mic className="h-4 w-4" />
                    </IconButton>
                    <PrimaryButton
                      type="submit"
                      disabled={sending || (!draft.trim() && !photoFile)}
                      icon={<Send className="h-4 w-4" />}
                    >
                      Send
                    </PrimaryButton>
                  </div>
                )}
              </form>
            </>
          )}
        </div>
      </Card>
    </>
  );
}
