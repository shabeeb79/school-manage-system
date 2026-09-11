import {
  Bell,
  BookOpen,
  CalendarOff,
  ChevronLeft,
  ClipboardCheck,
  Flame,
  GraduationCap,
  LayoutDashboard,
  LogOut,
  Megaphone,
  MessageSquare,
  Paperclip,
  Plus,
  Search,
  Send,
  TrendingUp,
  X,
} from 'lucide-react';
import { useEffect, useState, type FormEvent, type ReactNode } from 'react';
import { useAuth } from './auth/AuthContext';
import api from './api/client';
import {
  apiErrorMessage,
  formatLeaveApplied,
  formatLeaveDates,
  leaveStatusLabel,
  type ApiLeave,
} from './lib/leave';
import { MAX_ASSIGNMENT_MEDIA_BYTES, mediaUrl } from './lib/media';
import { IconButton, Modal, PostMedia } from './ui';

type PageId =
  | 'dashboard'
  | 'announcements'
  | 'attendance'
  | 'grades'
  | 'assignments'
  | 'leave'
  | 'messages';

type BadgeTone = 'slate' | 'violet' | 'green' | 'red' | 'amber';

const STUDENT = {
  firstName: 'Rahul',
  name: 'Rahul Varma',
  className: 'Grade 9 - A',
  term: 'Term 2, 2026',
};

const PAGE_LABELS: Record<PageId, string> = {
  dashboard: 'Dashboard',
  announcements: 'Announcements',
  attendance: 'Attendance',
  grades: 'Grade Card',
  assignments: 'Assignments',
  leave: 'Leave',
  messages: 'Messages',
};

const NAV_ITEMS: { id: PageId; label: string; short: string; icon: typeof LayoutDashboard }[] = [
  { id: 'dashboard', label: 'Dashboard', short: 'Home', icon: LayoutDashboard },
  { id: 'announcements', label: 'Announcements', short: 'News', icon: Megaphone },
  { id: 'attendance', label: 'Attendance', short: 'Attend', icon: ClipboardCheck },
  { id: 'grades', label: 'Grade Card', short: 'Grades', icon: GraduationCap },
  { id: 'assignments', label: 'Assignments', short: 'Tasks', icon: BookOpen },
  { id: 'leave', label: 'Leave', short: 'Leave', icon: CalendarOff },
  { id: 'messages', label: 'Messages', short: 'Chat', icon: MessageSquare },
];

const AVATAR_COLORS = ['bg-indigo-600', 'bg-fuchsia-600', 'bg-violet-600', 'bg-purple-600'];

function cn(...parts: Array<string | false | undefined>) {
  return parts.filter(Boolean).join(' ');
}

function initials(name: string) {
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join('')
    .toUpperCase();
}

function avatarColor(name: string) {
  let hash = 0;
  for (let i = 0; i < name.length; i += 1) hash += name.charCodeAt(i);
  return AVATAR_COLORS[hash % AVATAR_COLORS.length];
}

function Badge({ children, tone = 'slate' }: { children: ReactNode; tone?: BadgeTone }) {
  const tones: Record<BadgeTone, string> = {
    slate: 'bg-slate-100 text-slate-700',
    violet: 'bg-violet-50 text-violet-700',
    green: 'bg-emerald-50 text-emerald-700',
    red: 'bg-rose-50 text-rose-700',
    amber: 'bg-amber-50 text-amber-800',
  };
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold',
        tones[tone],
      )}
    >
      {children}
    </span>
  );
}

function Avatar({ name, size = 'md' }: { name: string; size?: 'sm' | 'md' | 'lg' }) {
  const sizes = {
    sm: 'h-8 w-8 text-[11px]',
    md: 'h-9 w-9 text-xs',
    lg: 'h-10 w-10 text-sm',
  };
  return (
    <span
      className={cn(
        'inline-flex shrink-0 items-center justify-center rounded-full font-semibold text-white',
        sizes[size],
        avatarColor(name),
      )}
      aria-hidden
    >
      {initials(name)}
    </span>
  );
}

function Card({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div
      className={cn(
        'rounded-2xl border border-violet-100 bg-white shadow-sm shadow-violet-100/50',
        className,
      )}
    >
      {children}
    </div>
  );
}

function TableShell({ columns, children }: { columns: string[]; children: ReactNode }) {
  return (
    <div className="-mx-4 overflow-x-auto px-4 md:mx-0 md:px-0">
      <div className="overflow-hidden rounded-2xl border border-violet-100 bg-white shadow-sm shadow-violet-100/50">
        <table className="w-full min-w-[560px] text-left text-sm">
          <thead>
            <tr className="border-b border-violet-100 bg-violet-50/50">
              {columns.map((column) => (
                <th key={column} className="whitespace-nowrap px-4 py-3 font-medium text-gray-500">
                  {column}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-violet-50">{children}</tbody>
        </table>
      </div>
    </div>
  );
}

function PrimaryButton({
  children,
  icon,
  onClick,
  type = 'button',
  className,
}: {
  children: ReactNode;
  icon?: ReactNode;
  onClick?: () => void;
  type?: 'button' | 'submit';
  className?: string;
}) {
  return (
    <button
      type={type}
      onClick={onClick}
      className={cn(
        'inline-flex h-10 shrink-0 items-center justify-center gap-2 rounded-full bg-indigo-600 px-5 text-sm font-medium text-white hover:bg-indigo-700 active:bg-indigo-800',
        className,
      )}
    >
      {icon}
      {children}
    </button>
  );
}

function SectionHeader({
  title,
  subtitle,
  action,
}: {
  title: string;
  subtitle?: string;
  action?: ReactNode;
}) {
  return (
    <div className="mb-5 flex flex-col gap-3 sm:mb-6 sm:flex-row sm:items-start sm:justify-between">
      <div>
        <h1 className="text-[24px] font-bold text-gray-900">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-gray-500">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}

function PlainStat({ label, value, valueClass }: { label: string; value: string; valueClass?: string }) {
  return (
    <Card className="p-4 md:p-5">
      <p className="text-xs text-gray-400">{label}</p>
      <p className={cn('mt-2 text-2xl font-bold tracking-tight text-gray-900', valueClass)}>{value}</p>
    </Card>
  );
}

type FeedPost = {
  id: string;
  title: string;
  content: string;
  audience: string;
  createdAt: string;
  fileUrl?: string | null;
  mediaType?: string | null;
  author?: { firstName?: string; lastName?: string } | null;
  targetClass?: { name?: string } | null;
};

function formatAnnouncementDate(value?: string) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleDateString(undefined, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

function announcementTone(audience: string): BadgeTone {
  if (audience === 'ALL') return 'violet';
  if (audience === 'STUDENT') return 'green';
  if (audience === 'CLASS') return 'amber';
  return 'slate';
}

const ATTENDANCE_MONTHS = [
  { month: 'April 2026', present: 20, total: 21, pct: 95 },
  { month: 'May 2026', present: 18, total: 20, pct: 90 },
  { month: 'June 2026', present: 21, total: 22, pct: 95 },
  { month: 'July 2026', present: 19, total: 22, pct: 86 },
  { month: 'August 2026', present: 20, total: 21, pct: 95 },
];

const GRADE_ROWS = [
  { subject: 'Mathematics', mid: 42, term: 88, grade: 'A' },
  { subject: 'English', mid: 45, term: 91, grade: 'A+' },
  { subject: 'Science', mid: 39, term: 82, grade: 'A' },
  { subject: 'Social Studies', mid: 41, term: 85, grade: 'A' },
  { subject: 'Malayalam', mid: 38, term: 79, grade: 'B+' },
];

const UPCOMING = [
  { title: 'Climate change essay', subject: 'Social Studies', due: '16 Sep' },
  { title: 'Quadratic equations worksheet', subject: 'Mathematics', due: '14 Sep' },
  { title: 'Lab report — acids & bases', subject: 'Science', due: '20 Sep' },
];

type ChatMessage = { id: string; from: 'in' | 'out'; text: string; time: string };
type Thread = {
  id: string;
  name: string;
  subject: string;
  preview: string;
  time: string;
  unread: boolean;
  messages: ChatMessage[];
};

const INITIAL_THREADS: Thread[] = [
  {
    id: 't1',
    name: 'Kavya Menon',
    subject: 'English',
    preview: 'Submit the essay draft by Monday.',
    time: '10:20 AM',
    unread: true,
    messages: [
      {
        id: 'm1',
        from: 'in',
        text: 'Rahul, remember the Macbeth scene notes from last class — use them for Monday’s draft.',
        time: '10:05 AM',
      },
      { id: 'm2', from: 'out', text: 'Yes ma’am, I’ll finish the draft tonight.', time: '10:12 AM' },
      { id: 'm3', from: 'in', text: 'Submit the essay draft by Monday.', time: '10:20 AM' },
    ],
  },
  {
    id: 't2',
    name: 'Suresh Pillai',
    subject: 'Mathematics',
    preview: 'Worksheet solutions uploaded on the portal.',
    time: 'Yesterday',
    unread: true,
    messages: [
      {
        id: 'm4',
        from: 'in',
        text: 'Worksheet solutions uploaded on the portal. Check questions 7–12 carefully.',
        time: 'Yesterday',
      },
    ],
  },
  {
    id: 't3',
    name: 'Fathima Beevi',
    subject: 'Science',
    preview: 'Bring your lab notebook on Thursday.',
    time: 'Mon',
    unread: false,
    messages: [
      { id: 'm5', from: 'in', text: 'Bring your lab notebook on Thursday for the acids & bases practical.', time: 'Mon' },
      { id: 'm6', from: 'out', text: 'Noted, thank you.', time: 'Mon' },
    ],
  },
];

function gradeTone(grade: string): BadgeTone {
  if (grade.startsWith('A')) return 'green';
  if (grade.startsWith('B')) return 'violet';
  if (grade.startsWith('C')) return 'amber';
  return 'red';
}

function submissionTone(status?: string): BadgeTone {
  if (status === 'APPROVED') return 'green';
  if (status === 'REJECTED') return 'red';
  if (status === 'SUBMITTED' || status === 'PENDING') return 'violet';
  return 'amber';
}

function submissionLabel(status?: string) {
  if (status === 'APPROVED') return 'Approved';
  if (status === 'REJECTED') return 'Rejected';
  if (status === 'SUBMITTED' || status === 'PENDING') return 'Submitted';
  return 'Pending';
}

function submissionBadgeText(submission?: {
  status?: string;
  score?: number | string | null;
}) {
  if (!submission?.status) return 'Pending';
  if (submission.status === 'APPROVED' && submission.score != null) {
    return `Approved · ${submission.score}`;
  }
  return submissionLabel(submission.status);
}

function leaveTone(status: string): BadgeTone {
  if (status === 'Approved' || status === 'APPROVED') return 'green';
  if (status === 'Rejected' || status === 'REJECTED') return 'red';
  return 'amber';
}

function DashboardPage({
  firstName,
  className,
}: {
  firstName: string;
  className: string;
}) {
  return (
    <>
      <div className="mb-6">
        <h1 className="text-[24px] font-bold text-gray-900">Hi {firstName} 👋</h1>
        <p className="mt-1 text-sm text-gray-500">
          {className} · {STUDENT.term}
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-4 md:grid-rows-2 md:min-h-[340px]">
        <div className="flex flex-col justify-between rounded-2xl bg-gradient-to-br from-indigo-600 to-violet-600 p-5 text-white md:col-span-2 md:row-span-2 md:p-6">
          <div>
            <div className="flex items-center gap-2 text-indigo-100">
              <span className="text-xs font-medium">This term's attendance</span>
              <Flame className="h-4 w-4 text-amber-300" />
            </div>
            <p className="mt-4 text-4xl font-bold tracking-tight md:text-5xl">92.2%</p>
            <p className="mt-2 text-sm text-indigo-100">59 of 64 school days present</p>
          </div>
          <p className="mt-6 inline-flex items-center gap-1.5 text-sm font-medium text-emerald-200">
            <TrendingUp className="h-4 w-4" />
            Up 1.2% from last term
          </p>
        </div>

        <div className="grid grid-cols-2 gap-4 md:col-span-2 md:row-span-2 md:contents">
          <Card className="p-4 md:p-5">
            <div className="flex items-center justify-between">
              <p className="text-xs text-gray-400">Overall average</p>
              <GraduationCap className="h-4 w-4 text-violet-400" />
            </div>
            <p className="mt-3 text-2xl font-bold text-gray-900 md:text-3xl">85%</p>
          </Card>
          <Card className="p-4 md:p-5">
            <div className="flex items-center justify-between">
              <p className="text-xs text-gray-400">Assignments due</p>
              <BookOpen className="h-4 w-4 text-violet-400" />
            </div>
            <p className="mt-3 text-2xl font-bold text-gray-900 md:text-3xl">2</p>
          </Card>
          <Card className="p-4 md:p-5">
            <div className="flex items-center justify-between">
              <p className="text-xs text-gray-400">Class rank</p>
              <ClipboardCheck className="h-4 w-4 text-violet-400" />
            </div>
            <p className="mt-3 text-2xl font-bold text-gray-900 md:text-3xl">7 / 36</p>
          </Card>
          <Card className="p-4 md:p-5">
            <div className="flex items-center justify-between">
              <p className="text-xs text-gray-400">Leave balance</p>
              <CalendarOff className="h-4 w-4 text-violet-400" />
            </div>
            <p className="mt-3 text-2xl font-bold text-gray-900 md:text-3xl">8 days</p>
          </Card>
        </div>
      </div>

      <Card className="mt-4 p-4 md:mt-5 md:p-5">
        <h2 className="font-semibold text-gray-900">Upcoming assignments</h2>
        <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-3">
          {UPCOMING.map((item) => (
            <div key={item.title} className="rounded-2xl bg-violet-50/40 p-4">
              <Badge tone="amber">Due {item.due}</Badge>
              <p className="mt-3 text-sm font-semibold text-gray-900">{item.title}</p>
              <p className="mt-1 text-xs text-gray-400">{item.subject}</p>
            </div>
          ))}
        </div>
      </Card>
    </>
  );
}

function AnnouncementsPage() {
  const { user } = useAuth();
  const [posts, setPosts] = useState<FeedPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const className =
    user?.studentProfile?.schoolClass?.name || STUDENT.className;

  useEffect(() => {
    let active = true;
    (async () => {
      setError('');
      try {
        const { data } = await api.get('/posts/feed');
        if (active) setPosts(data);
      } catch {
        if (active) setError('Could not load announcements.');
      } finally {
        if (active) setLoading(false);
      }
    })().catch(console.error);
    return () => {
      active = false;
    };
  }, []);

  return (
    <>
      <SectionHeader
        title="Announcements"
        subtitle={`School notices for ${className}`}
      />
      {loading && <p className="text-sm text-gray-500">Loading announcements...</p>}
      {error && <p className="mb-4 text-sm text-red-600">{error}</p>}
      {!loading && !error && (
        <div className="space-y-3">
          {posts.map((item) => {
            const author = `${item.author?.firstName ?? ''} ${item.author?.lastName ?? ''}`.trim();
            const mediaSrc = mediaUrl(item.fileUrl);
            return (
              <Card key={item.id} className="p-4 md:p-5">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge tone={announcementTone(item.audience)}>
                    {author || 'Announcement'}
                  </Badge>
                  <span className="text-xs text-gray-400">
                    {formatAnnouncementDate(item.createdAt)}
                  </span>
                </div>
                <h2 className="mt-2 font-semibold text-gray-900">{item.title}</h2>
                {item.content && (
                  <p className="mt-1 whitespace-pre-wrap text-sm text-gray-600">{item.content}</p>
                )}
                <PostMedia src={mediaSrc} mediaType={item.mediaType} />
              </Card>
            );
          })}
          {!posts.length && (
            <Card className="p-6 text-center">
              <p className="text-sm text-gray-500">No announcements for you yet.</p>
            </Card>
          )}
        </div>
      )}
    </>
  );
}

function AttendancePage() {
  return (
    <>
      <SectionHeader title="Attendance" subtitle="Your presence record for Term 2" />
      <div className="mb-5 grid grid-cols-1 gap-3 sm:grid-cols-3">
        <PlainStat label="Overall attendance" value="92.2%" />
        <PlainStat label="Days present" value="59" />
        <PlainStat label="Days absent" value="5" />
      </div>

      <div className="space-y-3 md:hidden">
        {ATTENDANCE_MONTHS.map((row) => (
          <Card key={row.month} className="p-4">
            <p className="font-semibold text-gray-900">{row.month}</p>
            <dl className="mt-3 space-y-2 text-sm">
              <div className="flex justify-between gap-3">
                <dt className="text-gray-400">Present</dt>
                <dd className="text-gray-700">{row.present}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-gray-400">Total days</dt>
                <dd className="text-gray-700">{row.total}</dd>
              </div>
              <div className="flex items-center justify-between gap-3">
                <dt className="text-gray-400">Percentage</dt>
                <dd>
                  <Badge tone={row.pct >= 90 ? 'green' : 'amber'}>{row.pct}%</Badge>
                </dd>
              </div>
            </dl>
          </Card>
        ))}
      </div>

      <div className="hidden md:block">
        <TableShell columns={['Month', 'Present', 'Total days', 'Percentage']}>
          {ATTENDANCE_MONTHS.map((row) => (
            <tr key={row.month} className="hover:bg-violet-50/40">
              <td className="px-4 py-3 font-medium text-gray-900">{row.month}</td>
              <td className="px-4 py-3 text-gray-500">{row.present}</td>
              <td className="px-4 py-3 text-gray-500">{row.total}</td>
              <td className="px-4 py-3">
                <Badge tone={row.pct >= 90 ? 'green' : 'amber'}>{row.pct}%</Badge>
              </td>
            </tr>
          ))}
        </TableShell>
      </div>
    </>
  );
}

function GradesPage() {
  return (
    <>
      <SectionHeader title="Grade Card" subtitle="Term 2 assessment summary" />
      <div className="mb-5 grid grid-cols-1 gap-3 sm:grid-cols-3">
        <PlainStat label="Overall average" value="85%" />
        <PlainStat label="Class rank" value="7 / 36" />
        <PlainStat label="Overall grade" value="A" valueClass="text-emerald-600" />
      </div>

      <div className="space-y-3 md:hidden">
        {GRADE_ROWS.map((row) => (
          <Card key={row.subject} className="p-4">
            <div className="flex items-start justify-between gap-2">
              <p className="font-semibold text-gray-900">{row.subject}</p>
              <Badge tone={gradeTone(row.grade)}>{row.grade}</Badge>
            </div>
            <dl className="mt-3 space-y-2 text-sm">
              <div className="flex justify-between gap-3">
                <dt className="text-gray-400">Mid-term</dt>
                <dd className="text-gray-700">{row.mid}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-gray-400">Term score</dt>
                <dd className="font-medium text-gray-900">{row.term}</dd>
              </div>
            </dl>
          </Card>
        ))}
      </div>

      <div className="hidden md:block">
        <TableShell columns={['Subject', 'Mid-term', 'Term score', 'Grade']}>
          {GRADE_ROWS.map((row) => (
            <tr key={row.subject} className="hover:bg-violet-50/40">
              <td className="px-4 py-3 font-medium text-gray-900">{row.subject}</td>
              <td className="px-4 py-3 text-gray-500">{row.mid}</td>
              <td className="px-4 py-3 text-gray-500">{row.term}</td>
              <td className="px-4 py-3">
                <Badge tone={gradeTone(row.grade)}>{row.grade}</Badge>
              </td>
            </tr>
          ))}
        </TableShell>
      </div>
    </>
  );
}

type StudentAssignment = {
  id: string;
  title: string;
  description: string;
  subject: string;
  dueDate: string;
  maxScore: number | string;
  submissions?: Array<{
    id: string;
    content: string;
    fileUrl?: string | null;
    mediaType?: string | null;
    status: 'PENDING' | 'SUBMITTED' | 'APPROVED' | 'REJECTED';
    score?: number | string | null;
    feedback?: string | null;
    attemptCount?: number;
    submittedAt: string;
  }>;
};

function formatStudentDue(date: string) {
  try {
    return new Date(date).toLocaleDateString(undefined, {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  } catch {
    return date;
  }
}

const MAX_SUBMISSION_ATTEMPTS = 3;

function AssignmentsPage() {
  const [assignments, setAssignments] = useState<StudentAssignment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [uploadError, setUploadError] = useState('');

  const load = async () => {
    setError('');
    try {
      const { data } = await api.get('/assignments');
      setAssignments(data);
    } catch {
      setError('Could not load assignments.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load().catch(console.error);
  }, []);

  const selected = assignments.find((item) => item.id === selectedId) ?? null;
  const submission = selected?.submissions?.[0];
  const attempts = submission?.attemptCount ?? 0;
  const blocked = attempts >= MAX_SUBMISSION_ATTEMPTS;

  const onFileChange = (next: File | null) => {
    setUploadError('');
    if (!next) {
      setFile(null);
      return;
    }
    if (!next.type.startsWith('image/') && !next.type.startsWith('video/')) {
      setUploadError('Only photo or video files are allowed.');
      setFile(null);
      return;
    }
    if (next.size > MAX_ASSIGNMENT_MEDIA_BYTES) {
      setUploadError('File must be less than 2MB.');
      setFile(null);
      return;
    }
    setFile(next);
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!selected || blocked) return;
    if (!file) {
      setUploadError('Choose a photo or video under 2MB.');
      return;
    }
    setBusy(true);
    setUploadError('');
    try {
      const body = new FormData();
      body.append('file', file);
      if (note.trim()) body.append('content', note.trim());
      await api.post(`/assignments/${selected.id}/submit-file`, body);
      setFile(null);
      setNote('');
      await load();
    } catch (err: unknown) {
      const message =
        (err as { response?: { data?: { message?: string | string[] } } })?.response?.data
          ?.message;
      setUploadError(
        Array.isArray(message)
          ? message.join(', ')
          : typeof message === 'string'
            ? message
            : 'Upload failed. Use a photo or video under 2MB.',
      );
    } finally {
      setBusy(false);
    }
  };

  if (selected) {
    return (
      <>
        <button
          type="button"
          onClick={() => {
            setSelectedId(null);
            setFile(null);
            setNote('');
            setUploadError('');
          }}
          className="mb-4 inline-flex items-center gap-1 text-sm font-medium text-indigo-700 hover:text-indigo-800"
        >
          <ChevronLeft className="h-4 w-4" />
          Back to assignments
        </button>
        <SectionHeader
          title={selected.title}
          subtitle={`${selected.subject} · Due ${formatStudentDue(selected.dueDate)}`}
        />
        <p className="mb-4 text-sm text-gray-500">{selected.description}</p>

        <Card className="mb-4 p-4 md:p-5">
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone={submissionTone(submission?.status)}>
              {submissionBadgeText(submission)}
            </Badge>
            {submission && (
              <span className="text-xs text-gray-400">
                Attempt {attempts} of {MAX_SUBMISSION_ATTEMPTS}
                {submission.status !== 'REJECTED'
                  ? ` · Uploaded ${formatStudentDue(submission.submittedAt)}`
                  : ''}
              </span>
            )}
          </div>

          {submission?.status === 'REJECTED' ? (
            <p className="mt-3 rounded-2xl border border-rose-100 bg-rose-50/60 p-4 text-sm text-rose-800">
              Your previous file was removed after rejection.
              {submission.feedback ? ` Teacher remark: ${submission.feedback}` : ''}
            </p>
          ) : submission?.fileUrl ? (
            <div className="mt-3 overflow-hidden rounded-2xl border border-violet-100 bg-violet-50/30">
              {submission.mediaType === 'VIDEO' ||
              submission.fileUrl.match(/\.(mp4|webm|mov)$/i) ? (
                <video
                  controls
                  className="max-h-72 w-full bg-black"
                  src={mediaUrl(submission.fileUrl)}
                />
              ) : (
                <img
                  alt="Your submission"
                  className="max-h-72 w-full object-contain"
                  src={mediaUrl(submission.fileUrl)}
                />
              )}
            </div>
          ) : (
            <p className="mt-3 text-sm text-gray-500">No file submitted yet.</p>
          )}
        </Card>

        {attempts >= MAX_SUBMISSION_ATTEMPTS && submission?.status !== 'APPROVED' ? (
          <Card className="p-4 md:p-5">
            <h2 className="font-semibold text-rose-700">Submission blocked</h2>
            <p className="mt-2 text-sm text-gray-600">
              You have used all 3 submission attempts for this assignment. Please contact your
              teacher if you need help.
            </p>
          </Card>
        ) : submission?.status === 'APPROVED' ? (
          <Card className="p-4 md:p-5">
            <h2 className="font-semibold text-emerald-700">Approved</h2>
            <p className="mt-2 text-sm text-gray-600">
              This assignment is approved. No further uploads are needed.
            </p>
          </Card>
        ) : submission?.status === 'SUBMITTED' || submission?.status === 'PENDING' ? (
          <Card className="p-4 md:p-5">
            <h2 className="font-semibold text-gray-900">Waiting for review</h2>
            <p className="mt-2 text-sm text-gray-600">
              Your file is submitted. You can upload again only after the teacher rejects it
              ({MAX_SUBMISSION_ATTEMPTS - attempts} attempt
              {MAX_SUBMISSION_ATTEMPTS - attempts === 1 ? '' : 's'} left).
            </p>
          </Card>
        ) : (
          <Card className="p-4 md:p-5">
            <h2 className="font-semibold text-gray-900">
              {submission?.status === 'REJECTED' ? 'Resubmit assignment' : 'Upload assignment'}
            </h2>
            <p className="mt-1 text-sm text-gray-500">
              Upload a photo or video under 2MB. You have{' '}
              {MAX_SUBMISSION_ATTEMPTS - attempts} attempt
              {MAX_SUBMISSION_ATTEMPTS - attempts === 1 ? '' : 's'} remaining.
            </p>
            <form onSubmit={submit} className="mt-4 space-y-3">
              <label className="block text-sm text-gray-700">
                Photo or video
                <input
                  type="file"
                  accept="image/*,video/*"
                  onChange={(event) => onFileChange(event.target.files?.[0] ?? null)}
                  className="mt-1.5 block w-full text-sm text-gray-600 file:mr-3 file:rounded-full file:border-0 file:bg-indigo-50 file:px-4 file:py-2 file:text-sm file:font-medium file:text-indigo-700"
                />
              </label>
              {file && (
                <p className="text-xs text-gray-400">
                  Selected: {file.name} ({(file.size / 1024 / 1024).toFixed(2)} MB)
                </p>
              )}
              <label className="block text-sm text-gray-700">
                Note (optional)
                <textarea
                  value={note}
                  onChange={(event) => setNote(event.target.value)}
                  rows={3}
                  className="mt-1.5 w-full rounded-2xl border border-violet-100 px-3 py-2 text-sm focus:border-indigo-600 focus:outline-none focus:ring-1 focus:ring-indigo-600"
                />
              </label>
              {uploadError && <p className="text-sm text-rose-600">{uploadError}</p>}
              <PrimaryButton type="submit" icon={<Paperclip className="h-4 w-4" />}>
                {busy ? 'Uploading...' : 'Submit assignment'}
              </PrimaryButton>
            </form>
          </Card>
        )}
      </>
    );
  }

  return (
    <>
      <SectionHeader title="Assignments" subtitle="Upload photo or video submissions under 2MB" />
      {loading && <p className="text-sm text-gray-500">Loading assignments...</p>}
      {error && <p className="mb-4 text-sm text-rose-600">{error}</p>}
      <div className="space-y-3">
        {assignments.map((item) => {
          const current = item.submissions?.[0];
          const used = current?.attemptCount ?? 0;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => setSelectedId(item.id)}
              className="flex w-full items-start gap-3 rounded-2xl border border-violet-100 bg-white p-4 text-left shadow-sm shadow-violet-100/50 hover:border-indigo-200 hover:bg-violet-50/40 md:p-5"
            >
              <div className="min-w-0 flex-1">
                <p className="font-semibold text-gray-900">{item.title}</p>
                <p className="mt-1 text-sm text-gray-500">
                  {item.subject} · Due {formatStudentDue(item.dueDate)}
                  {used > 0 ? ` · Attempt ${used}/${MAX_SUBMISSION_ATTEMPTS}` : ''}
                </p>
              </div>
              <Badge
                tone={
                  used >= MAX_SUBMISSION_ATTEMPTS && current?.status !== 'APPROVED'
                    ? 'red'
                    : submissionTone(current?.status)
                }
              >
                {used >= MAX_SUBMISSION_ATTEMPTS && current?.status !== 'APPROVED'
                  ? 'Blocked'
                  : submissionBadgeText(current)}
              </Badge>
            </button>
          );
        })}
        {!loading && !assignments.length && (
          <Card className="p-6 text-center text-sm text-gray-500">
            No assignments for your class yet.
          </Card>
        )}
      </div>
    </>
  );
}

function LeavePage() {
  const [items, setItems] = useState<ApiLeave[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState('');
  const [form, setForm] = useState({ reason: '', startDate: '', endDate: '' });

  const load = async () => {
    setError('');
    try {
      const { data } = await api.get('/leave');
      setItems(data);
    } catch {
      setError('Could not load leave requests.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load().catch(console.error);
  }, []);

  const openModal = () => {
    setForm({ reason: '', startDate: '', endDate: '' });
    setFormError('');
    setModalOpen(true);
  };

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setFormError('');
    try {
      await api.post('/leave', {
        reason: form.reason.trim(),
        startDate: form.startDate,
        endDate: form.endDate,
      });
      setModalOpen(false);
      await load();
    } catch (err: unknown) {
      setFormError(apiErrorMessage(err, 'Could not submit leave request'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <SectionHeader
        title="Leave"
        subtitle="Your leave requests are reviewed by your class teacher"
        action={
          <PrimaryButton className="w-full sm:w-auto" icon={<Plus className="h-4 w-4" />} onClick={openModal}>
            Apply for leave
          </PrimaryButton>
        }
      />

      {loading && <p className="text-sm text-gray-500">Loading leave requests...</p>}
      {error && <p className="mb-4 text-sm text-red-600">{error}</p>}

      {!loading && !error && (
        <>
          <div className="space-y-3 md:hidden">
            {items.map((row) => (
              <Card key={row.id} className="p-4">
                <div className="flex items-start justify-between gap-2">
                  <p className="font-semibold text-gray-900">
                    {formatLeaveDates(row.startDate, row.endDate)}
                  </p>
                  <Badge tone={leaveTone(row.status)}>{leaveStatusLabel(row.status)}</Badge>
                </div>
                <dl className="mt-3 space-y-2 text-sm">
                  <div className="flex justify-between gap-3">
                    <dt className="text-gray-400">Reason</dt>
                    <dd className="text-right text-gray-700">{row.reason}</dd>
                  </div>
                  <div className="flex justify-between gap-3">
                    <dt className="text-gray-400">Applied on</dt>
                    <dd className="text-gray-700">{formatLeaveApplied(row.createdAt)}</dd>
                  </div>
                </dl>
              </Card>
            ))}
          </div>

          <div className="hidden md:block">
            <TableShell columns={['Dates', 'Reason', 'Applied on', 'Status']}>
              {items.map((row) => (
                <tr key={row.id} className="hover:bg-violet-50/40">
                  <td className="px-4 py-3 font-medium text-gray-900">
                    {formatLeaveDates(row.startDate, row.endDate)}
                  </td>
                  <td className="px-4 py-3 text-gray-500">{row.reason}</td>
                  <td className="px-4 py-3 text-gray-500">{formatLeaveApplied(row.createdAt)}</td>
                  <td className="px-4 py-3">
                    <Badge tone={leaveTone(row.status)}>{leaveStatusLabel(row.status)}</Badge>
                  </td>
                </tr>
              ))}
            </TableShell>
          </div>

          {!items.length && (
            <Card className="mt-3 p-6 text-center">
              <p className="text-sm text-gray-500">No leave requests yet.</p>
            </Card>
          )}
        </>
      )}

      {modalOpen && (
        <Modal onClose={() => !busy && setModalOpen(false)} size="md">
          <div className="mb-3 flex items-start justify-between gap-3 sm:mb-4">
            <div>
              <h2 className="text-base font-semibold text-gray-900 sm:text-lg">Apply for leave</h2>
              <p className="mt-1 hidden text-sm text-gray-500 sm:block">
                Your class teacher will approve or reject this request.
              </p>
            </div>
            <IconButton label="Close" onClick={() => !busy && setModalOpen(false)} className="shrink-0">
              <X className="h-4 w-4" />
            </IconButton>
          </div>
          <form onSubmit={onSubmit} className="space-y-2 sm:space-y-3">
            <label className="block text-sm text-gray-700">
              Reason
              <textarea
                required
                rows={3}
                value={form.reason}
                onChange={(event) => setForm({ ...form, reason: event.target.value })}
                className="mt-1.5 w-full resize-none rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-indigo-600 focus:outline-none focus:ring-1 focus:ring-indigo-600"
              />
            </label>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 sm:gap-3">
              <label className="block text-sm text-gray-700">
                Start date
                <input
                  required
                  type="date"
                  value={form.startDate}
                  onChange={(event) => setForm({ ...form, startDate: event.target.value })}
                  className="mt-1.5 h-10 w-full rounded-lg border border-gray-200 px-3 text-sm focus:border-indigo-600 focus:outline-none focus:ring-1 focus:ring-indigo-600"
                />
              </label>
              <label className="block text-sm text-gray-700">
                End date
                <input
                  required
                  type="date"
                  value={form.endDate}
                  onChange={(event) => setForm({ ...form, endDate: event.target.value })}
                  className="mt-1.5 h-10 w-full rounded-lg border border-gray-200 px-3 text-sm focus:border-indigo-600 focus:outline-none focus:ring-1 focus:ring-indigo-600"
                />
              </label>
            </div>
            {formError && <p className="text-sm text-red-600">{formError}</p>}
            <div className="flex flex-col-reverse gap-2 pt-1 sm:flex-row sm:justify-end sm:pt-2">
              <button
                type="button"
                onClick={() => !busy && setModalOpen(false)}
                className="inline-flex h-11 w-full items-center justify-center rounded-lg border border-gray-200 px-4 text-sm font-medium text-gray-700 hover:bg-gray-50 sm:h-10 sm:w-auto"
              >
                Cancel
              </button>
              <PrimaryButton type="submit" className="w-full sm:w-auto">
                {busy ? 'Submitting...' : 'Submit request'}
              </PrimaryButton>
            </div>
          </form>
        </Modal>
      )}
    </>
  );
}

function MessagesPage() {
  const [threads, setThreads] = useState(INITIAL_THREADS);
  const [activeId, setActiveId] = useState(INITIAL_THREADS[0].id);
  const [mobileShowChat, setMobileShowChat] = useState(false);
  const [draft, setDraft] = useState('');
  const [threadQuery, setThreadQuery] = useState('');

  const active = threads.find((thread) => thread.id === activeId) ?? threads[0];
  const visibleThreads = threads.filter((thread) =>
    thread.name.toLowerCase().includes(threadQuery.toLowerCase()),
  );

  const openThread = (id: string) => {
    setActiveId(id);
    setMobileShowChat(true);
    setThreads((current) =>
      current.map((thread) => (thread.id === id ? { ...thread, unread: false } : thread)),
    );
  };

  const sendMessage = () => {
    const text = draft.trim();
    if (!text) return;
    const message: ChatMessage = { id: `out-${Date.now()}`, from: 'out', text, time: 'Just now' };
    setThreads((current) =>
      current.map((thread) =>
        thread.id === active.id
          ? {
              ...thread,
              preview: text,
              time: 'Just now',
              unread: false,
              messages: [...thread.messages, message],
            }
          : thread,
      ),
    );
    setDraft('');
  };

  return (
    <>
      <SectionHeader title="Messages" subtitle="Chat with your teachers" />
      <Card className="flex h-[calc(100dvh-12rem)] overflow-hidden md:h-[480px]">
        <div
          className={cn(
            'w-full shrink-0 flex-col border-violet-100 md:flex md:w-72 md:border-r',
            mobileShowChat ? 'hidden md:flex' : 'flex',
          )}
        >
          <div className="border-b border-violet-100 p-3">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
              <input
                value={threadQuery}
                onChange={(event) => setThreadQuery(event.target.value)}
                placeholder="Search teachers"
                className="h-10 w-full rounded-full border border-violet-100 bg-violet-50/50 py-2 pl-9 pr-4 text-sm placeholder:text-gray-400 focus:border-indigo-600 focus:bg-white focus:outline-none focus:ring-1 focus:ring-indigo-600"
              />
            </div>
          </div>
          <ul className="flex-1 overflow-y-auto">
            {visibleThreads.map((thread) => (
              <li key={thread.id}>
                <button
                  type="button"
                  onClick={() => openThread(thread.id)}
                  className={cn(
                    'flex w-full items-start gap-3 px-3 py-3 text-left hover:bg-violet-50/60',
                    thread.id === active.id && 'bg-violet-50 hover:bg-violet-50',
                  )}
                >
                  <Avatar name={thread.name} />
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center justify-between gap-2">
                      <span
                        className={cn(
                          'truncate text-sm',
                          thread.unread ? 'font-bold text-gray-900' : 'font-medium text-gray-900',
                        )}
                      >
                        {thread.name}
                      </span>
                      <span className="shrink-0 text-xs text-gray-400">{thread.time}</span>
                    </span>
                    <span className="mt-0.5 block truncate text-xs text-violet-500">{thread.subject}</span>
                    <span
                      className={cn(
                        'mt-0.5 block truncate text-xs',
                        thread.unread ? 'font-semibold text-gray-700' : 'text-gray-400',
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
          <div className="flex items-center gap-2 border-b border-violet-100 px-3 py-3 md:px-4">
            <IconButton
              label="Back to conversations"
              onClick={() => setMobileShowChat(false)}
              className="md:hidden"
            >
              <ChevronLeft className="h-5 w-5" />
            </IconButton>
            <Avatar name={active.name} />
            <div className="min-w-0">
              <p className="truncate font-semibold text-gray-900">{active.name}</p>
              <p className="truncate text-xs text-gray-400">{active.subject}</p>
            </div>
          </div>
          <div className="flex-1 space-y-3 overflow-y-auto bg-violet-50/30 px-3 py-4 md:px-4">
            {active.messages.map((message) => (
              <div
                key={message.id}
                className={cn('flex', message.from === 'out' ? 'justify-end' : 'justify-start')}
              >
                <div
                  className={cn(
                    'max-w-[80%] rounded-2xl px-3 py-2 text-sm',
                    message.from === 'out'
                      ? 'bg-indigo-600 text-white'
                      : 'border border-violet-100 bg-white text-gray-900',
                  )}
                >
                  <p>{message.text}</p>
                  <p
                    className={cn(
                      'mt-1 text-[11px]',
                      message.from === 'out' ? 'text-indigo-100' : 'text-gray-400',
                    )}
                  >
                    {message.time}
                  </p>
                </div>
              </div>
            ))}
          </div>
          <form
            className="flex items-center gap-2 border-t border-violet-100 p-3"
            onSubmit={(event) => {
              event.preventDefault();
              sendMessage();
            }}
          >
            <IconButton label="Attach file">
              <Paperclip className="h-4 w-4" />
            </IconButton>
            <input
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              placeholder="Write a message"
              className="h-10 min-w-0 flex-1 rounded-full border border-violet-100 bg-white px-4 text-sm placeholder:text-gray-400 focus:border-indigo-600 focus:outline-none focus:ring-1 focus:ring-indigo-600"
            />
            <PrimaryButton type="submit" icon={<Send className="h-4 w-4" />}>
              Send
            </PrimaryButton>
          </form>
        </div>
      </Card>
    </>
  );
}

const PAGES = {
  announcements: AnnouncementsPage,
  attendance: AttendancePage,
  grades: GradesPage,
  assignments: AssignmentsPage,
  leave: LeavePage,
  messages: MessagesPage,
};

function StudentPage({ page }: { page: Exclude<PageId, 'dashboard'> }) {
  const Page = PAGES[page];
  return <Page />;
}

export default function StudentPortal() {
  const { user, logout } = useAuth();
  const [page, setPage] = useState<PageId>('dashboard');

  const firstName = user?.firstName ?? STUDENT.firstName;
  const displayName = user ? `${user.firstName} ${user.lastName}` : STUDENT.name;
  const classLabel = user?.studentProfile?.schoolClass?.name ?? STUDENT.className;

  return (
    <div className="min-h-dvh bg-gradient-to-b from-violet-50/60 to-white font-sans text-gray-900">
      <header className="sticky top-0 z-10 border-b border-violet-100 bg-white/80 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-3 px-4 md:px-6">
          <div className="flex min-w-0 items-center gap-3">
            <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-600 to-fuchsia-600 text-sm font-bold text-white">
              G
            </span>
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-gray-900">Greenfield</p>
              <p className="truncate text-xs text-gray-400 md:hidden">{classLabel}</p>
            </div>
          </div>

          <nav className="hidden items-center gap-1 md:flex">
            {NAV_ITEMS.map((item) => {
              const active = page === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setPage(item.id)}
                  className={cn(
                    'rounded-full px-3 py-2 text-sm transition-colors',
                    active
                      ? 'bg-indigo-50 font-medium text-indigo-700'
                      : 'text-gray-500 hover:bg-violet-50 hover:text-gray-700',
                  )}
                >
                  {item.label}
                </button>
              );
            })}
          </nav>

          <div className="flex items-center gap-1 md:gap-2">
            <button
              type="button"
              aria-label="Notifications"
              className="relative inline-flex h-10 w-10 items-center justify-center rounded-full text-gray-400 hover:bg-violet-50 hover:text-gray-700"
            >
              <Bell className="h-4 w-4" />
              <span className="absolute right-2.5 top-2.5 h-2 w-2 rounded-full bg-fuchsia-500" />
            </button>
            <Avatar name={displayName} size="sm" />
            <IconButton label="Sign out" onClick={logout}>
              <LogOut className="h-4 w-4" />
            </IconButton>
          </div>
        </div>

        <div className="md:hidden">
          <div className="flex gap-2 overflow-x-auto px-4 pb-3 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {NAV_ITEMS.map((item) => {
              const Icon = item.icon;
              const active = page === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setPage(item.id)}
                  className={cn(
                    'inline-flex h-10 shrink-0 items-center gap-1.5 rounded-full px-3 text-xs font-medium whitespace-nowrap',
                    active ? 'bg-indigo-600 text-white' : 'bg-violet-50 text-gray-500',
                  )}
                >
                  <Icon className="h-3.5 w-3.5" />
                  {item.short}
                </button>
              );
            })}
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-6 md:px-6 md:py-8">
        {page === 'dashboard' ? (
          <DashboardPage firstName={firstName} className={classLabel} />
        ) : (
          <StudentPage page={page} />
        )}
      </main>
    </div>
  );
}
