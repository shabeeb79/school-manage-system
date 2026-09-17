import {
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
  X,
} from 'lucide-react';
import { useEffect, useMemo, useState, type FormEvent, type ReactNode } from 'react';
import { useAuth } from './auth/AuthContext';
import api from './api/client';
import MessagesChat from './components/MessagesChat';
import NotificationBell from './components/NotificationBell';
import {
  apiErrorMessage,
  formatLeaveApplied,
  formatLeaveDates,
  leaveStatusLabel,
  type ApiLeave,
} from './lib/leave';
import { MAX_ASSIGNMENT_MEDIA_BYTES, mediaUrl } from './lib/media';
import { startPortalNotifications } from './lib/notifications';
import { teachingSubjectLabel } from './lib/subjects';
import {
  emitUnreadChanged,
  formatUnreadBadge,
  markAnnouncementsRead,
  markAssignmentRead,
  type UnreadCounts,
} from './lib/unread';
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
  isUnread?: boolean;
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
  onOpenAssignments,
}: {
  firstName: string;
  className: string;
  onOpenAssignments?: () => void;
}) {
  const [attendancePct, setAttendancePct] = useState<string>('—');
  const [attendanceSub, setAttendanceSub] = useState('Loading attendance...');
  const [upcoming, setUpcoming] = useState<
    Array<{ id: string; title: string; subject: string; dueDate: string; status?: string }>
  >([]);
  const [assignmentsDueCount, setAssignmentsDueCount] = useState<string>('—');
  const [assignmentsLoading, setAssignmentsLoading] = useState(true);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const { data } = await api.get('/attendance');
        if (!active) return;
        const records = data as Array<{ status: string }>;
        const total = records.length;
        const present = records.filter((r) => r.status === 'PRESENT').length;
        if (!total) {
          setAttendancePct('—');
          setAttendanceSub('Waiting for your class teacher to mark attendance');
          return;
        }
        const pct = Math.round((present / total) * 1000) / 10;
        setAttendancePct(`${pct}%`);
        setAttendanceSub(`${present} of ${total} days present`);
      } catch {
        if (active) {
          setAttendancePct('—');
          setAttendanceSub('Could not load attendance');
        }
      }
    })().catch(console.error);
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    let active = true;
    (async () => {
      setAssignmentsLoading(true);
      try {
        const { data } = await api.get('/assignments');
        if (!active) return;
        const list = (data as Array<{
          id: string;
          title: string;
          subject: string;
          dueDate: string;
          submissions?: Array<{ status: string }>;
        }>).slice();

        const open = list.filter((item) => {
          const status = item.submissions?.[0]?.status;
          return status !== 'APPROVED';
        });

        open.sort(
          (a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime(),
        );

        setAssignmentsDueCount(String(open.length));
        setUpcoming(
          open.slice(0, 3).map((item) => {
            const status = item.submissions?.[0]?.status;
            return {
              id: item.id,
              title: item.title,
              subject: item.subject,
              dueDate: item.dueDate,
              status,
            };
          }),
        );
      } catch {
        if (active) {
          setAssignmentsDueCount('—');
          setUpcoming([]);
        }
      } finally {
        if (active) setAssignmentsLoading(false);
      }
    })().catch(console.error);
    return () => {
      active = false;
    };
  }, []);

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
            <p className="mt-4 text-4xl font-bold tracking-tight md:text-5xl">{attendancePct}</p>
            <p className="mt-2 text-sm text-indigo-100">{attendanceSub}</p>
          </div>
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
            <p className="mt-3 text-2xl font-bold text-gray-900 md:text-3xl">
              {assignmentsDueCount}
            </p>
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
        <div className="flex items-center justify-between gap-3">
          <h2 className="font-semibold text-gray-900">Upcoming assignments</h2>
          {onOpenAssignments && (
            <button
              type="button"
              onClick={onOpenAssignments}
              className="text-sm font-medium text-indigo-600 hover:text-indigo-700"
            >
              View all
            </button>
          )}
        </div>
        {assignmentsLoading && (
          <p className="mt-4 text-sm text-gray-500">Loading assignments...</p>
        )}
        {!assignmentsLoading && upcoming.length === 0 && (
          <p className="mt-4 text-sm text-gray-500">No open assignments for your class right now.</p>
        )}
        {!assignmentsLoading && upcoming.length > 0 && (
          <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-3">
            {upcoming.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={onOpenAssignments}
                className="rounded-2xl bg-violet-50/40 p-4 text-left transition-colors hover:bg-violet-50"
              >
                <div className="flex flex-wrap items-center gap-2">
                  <Badge tone="amber">Due {formatStudentDue(item.dueDate)}</Badge>
                  <Badge tone={submissionTone(item.status)}>
                    {submissionLabel(item.status)}
                  </Badge>
                </div>
                <p className="mt-3 text-sm font-semibold text-gray-900">{item.title}</p>
                <p className="mt-1 text-xs text-gray-400">{item.subject}</p>
              </button>
            ))}
          </div>
        )}
      </Card>
    </>
  );
}

function AnnouncementsPage() {
  const { user } = useAuth();
  const [posts, setPosts] = useState<FeedPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const className = (() => {
    const schoolClass = user?.studentProfile?.schoolClass;
    if (!schoolClass?.name) return STUDENT.className;
    const section = schoolClass.section?.trim();
    return section ? `${schoolClass.name} - ${section}` : schoolClass.name;
  })();

  useEffect(() => {
    let active = true;
    (async () => {
      setError('');
      try {
        const { data } = await api.get('/posts/feed');
        if (active) setPosts(data);
        await markAnnouncementsRead();
        emitUnreadChanged();
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
                  {item.isUnread && <Badge tone="red">New</Badge>}
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

function attendanceStatusLabel(status: string) {
  if (status === 'PRESENT') return 'Present';
  if (status === 'ABSENT') return 'Absent';
  if (status === 'LATE') return 'Late';
  if (status === 'EXCUSED') return 'Excused';
  return status;
}

function attendanceStatusTone(status: string): BadgeTone {
  if (status === 'PRESENT') return 'green';
  if (status === 'ABSENT') return 'red';
  if (status === 'LATE' || status === 'EXCUSED') return 'amber';
  return 'slate';
}

function formatAttendanceDay(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value).slice(0, 10);
  return date.toLocaleDateString(undefined, {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  });
}

function AttendancePage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [records, setRecords] = useState<
    Array<{ id: string; date: string; status: string }>
  >([]);

  useEffect(() => {
    let active = true;
    (async () => {
      setError('');
      try {
        const { data } = await api.get('/attendance');
        if (active) setRecords(data);
      } catch (err) {
        if (active) setError(apiErrorMessage(err, 'Could not load attendance.'));
      } finally {
        if (active) setLoading(false);
      }
    })().catch(console.error);
    return () => {
      active = false;
    };
  }, []);

  const present = records.filter((r) => r.status === 'PRESENT').length;
  const absent = records.filter((r) => r.status === 'ABSENT').length;
  const late = records.filter((r) => r.status === 'LATE' || r.status === 'EXCUSED').length;
  const total = records.length;
  const overallPct = total ? Math.round((present / total) * 1000) / 10 : 0;

  const months = useMemo(() => {
    const map = new Map<string, { present: number; total: number; sortKey: string }>();
    for (const row of records) {
      const date = new Date(row.date);
      if (Number.isNaN(date.getTime())) continue;
      const sortKey = `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`;
      const label = date.toLocaleDateString(undefined, {
        month: 'long',
        year: 'numeric',
        timeZone: 'UTC',
      });
      const current = map.get(label) ?? { present: 0, total: 0, sortKey };
      current.total += 1;
      if (row.status === 'PRESENT') current.present += 1;
      map.set(label, current);
    }
    return [...map.entries()]
      .map(([month, data]) => ({
        month,
        present: data.present,
        total: data.total,
        pct: data.total ? Math.round((data.present / data.total) * 100) : 0,
        sortKey: data.sortKey,
      }))
      .sort((a, b) => b.sortKey.localeCompare(a.sortKey));
  }, [records]);

  const recentDays = useMemo(
    () =>
      [...records].sort(
        (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime(),
      ),
    [records],
  );

  return (
    <>
      <SectionHeader
        title="Attendance"
        subtitle="Updated each day when your teacher marks the register"
      />

      {loading && <p className="text-sm text-gray-500">Loading attendance...</p>}
      {error && <p className="mb-4 text-sm text-red-600">{error}</p>}

      {!loading && !error && (
        <>
          <div className="mb-5 grid grid-cols-1 gap-3 sm:grid-cols-3">
            <PlainStat
              label="Overall attendance"
              value={total ? `${overallPct}%` : '—'}
            />
            <PlainStat label="Days present" value={String(present)} />
            <PlainStat label="Days absent / late" value={String(absent + late)} />
          </div>

          {recentDays.length ? (
            <>
              <h2 className="mb-3 text-sm font-semibold text-gray-900">Daily record</h2>
              <div className="mb-6 space-y-3 md:hidden">
                {recentDays.map((row) => (
                  <Card key={row.id} className="p-4">
                    <div className="flex items-center justify-between gap-2">
                      <p className="font-medium text-gray-900">{formatAttendanceDay(row.date)}</p>
                      <Badge tone={attendanceStatusTone(row.status)}>
                        {attendanceStatusLabel(row.status)}
                      </Badge>
                    </div>
                  </Card>
                ))}
              </div>
              <div className="mb-6 hidden md:block">
                <TableShell columns={['Date', 'Status']}>
                  {recentDays.map((row) => (
                    <tr key={row.id} className="hover:bg-violet-50/40">
                      <td className="px-4 py-3 text-gray-700">{formatAttendanceDay(row.date)}</td>
                      <td className="px-4 py-3">
                        <Badge tone={attendanceStatusTone(row.status)}>
                          {attendanceStatusLabel(row.status)}
                        </Badge>
                      </td>
                    </tr>
                  ))}
                </TableShell>
              </div>

              {months.length > 0 && (
                <>
                  <h2 className="mb-3 text-sm font-semibold text-gray-900">Monthly summary</h2>
                  <div className="hidden md:block">
                    <TableShell columns={['Month', 'Present', 'Total days', 'Percentage']}>
                      {months.map((row) => (
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
              )}
            </>
          ) : (
            <Card className="p-6 text-center">
              <p className="text-sm text-gray-500">
                No attendance records yet. They appear after your teacher marks attendance.
              </p>
            </Card>
          )}
        </>
      )}
    </>
  );
}

function GradesPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [card, setCard] = useState<{
    complete: boolean;
    pending: boolean;
    subjectsMarked: number;
    subjectsExpected: number;
    subjects: Array<{
      subject: string;
      status: 'ready' | 'pending';
      score: number | null;
      maxScore: number;
      gradeLetter: string | null;
    }>;
    totalScore: number | null;
    totalMax: number | null;
    percentage: number | null;
    overallLetter: string | null;
    examName?: string;
  } | null>(null);

  useEffect(() => {
    let active = true;
    (async () => {
      setError('');
      try {
        const { data } = await api.get('/grades/my-card');
        if (active) setCard(data);
      } catch (err) {
        if (active) setError(apiErrorMessage(err, 'Could not load grade card.'));
      } finally {
        if (active) setLoading(false);
      }
    })().catch(console.error);
    return () => {
      active = false;
    };
  }, []);

  const pending = !card || card.pending || !card.complete;

  return (
    <>
      <SectionHeader
        title="Grade Card"
        subtitle={card?.examName ?? 'Term assessment summary'}
      />

      {loading && <p className="text-sm text-gray-500">Loading grade card...</p>}
      {error && <p className="mb-4 text-sm text-red-600">{error}</p>}

      {!loading && !error && card && (
        <>
          <div className="mb-5 grid grid-cols-1 gap-3 sm:grid-cols-3">
            <PlainStat
              label="Overall average"
              value={
                pending || card.percentage == null ? 'Pending' : `${card.percentage}%`
              }
            />
            <PlainStat
              label="Total score"
              value={
                pending || card.totalScore == null || card.totalMax == null
                  ? 'Pending'
                  : `${card.totalScore} / ${card.totalMax}`
              }
            />
            <PlainStat
              label="Overall grade"
              value={pending || !card.overallLetter ? 'Pending' : card.overallLetter}
              valueClass={
                pending || !card.overallLetter ? 'text-amber-600' : 'text-emerald-600'
              }
            />
          </div>

          {pending && (
            <Card className="mb-4 border border-amber-200 bg-amber-50 p-4">
              <p className="text-sm font-medium text-amber-800">Marks pending</p>
              <p className="mt-1 text-sm text-amber-700">
                Your grade card will appear after all {card.subjectsExpected || 10} subjects are
                marked ({card.subjectsMarked}/{card.subjectsExpected || 10} done).
              </p>
            </Card>
          )}

          {!card.subjectsExpected ? (
            <Card className="p-6 text-center">
              <p className="text-sm text-gray-500">
                No subjects are configured for your grade card yet.
              </p>
            </Card>
          ) : (
            <>
              <div className="space-y-3 md:hidden">
                {card.subjects.map((row) => (
                  <Card key={row.subject} className="p-4">
                    <div className="flex items-start justify-between gap-2">
                      <p className="font-semibold text-gray-900">
                        {teachingSubjectLabel(row.subject)}
                      </p>
                      {pending || row.status === 'pending' ? (
                        <Badge tone="amber">Pending</Badge>
                      ) : (
                        <Badge tone={gradeTone(row.gradeLetter || '—')}>
                          {row.gradeLetter || '—'}
                        </Badge>
                      )}
                    </div>
                    <dl className="mt-3 space-y-2 text-sm">
                      <div className="flex justify-between gap-3">
                        <dt className="text-gray-400">Score</dt>
                        <dd className="font-medium text-gray-900">
                          {pending || row.status === 'pending' || row.score == null
                            ? 'Pending'
                            : `${row.score} / ${row.maxScore}`}
                        </dd>
                      </div>
                    </dl>
                  </Card>
                ))}
              </div>

              <div className="hidden md:block">
                <TableShell columns={['Subject', 'Score', 'Grade']}>
                  {card.subjects.map((row) => (
                    <tr key={row.subject} className="hover:bg-violet-50/40">
                      <td className="px-4 py-3 font-medium text-gray-900">
                        {teachingSubjectLabel(row.subject)}
                      </td>
                      <td className="px-4 py-3 text-gray-500">
                        {pending || row.status === 'pending' || row.score == null
                          ? 'Pending'
                          : `${row.score} / ${row.maxScore}`}
                      </td>
                      <td className="px-4 py-3">
                        {pending || row.status === 'pending' ? (
                          <Badge tone="amber">Pending</Badge>
                        ) : (
                          <Badge tone={gradeTone(row.gradeLetter || '—')}>
                            {row.gradeLetter || '—'}
                          </Badge>
                        )}
                      </td>
                    </tr>
                  ))}
                </TableShell>
              </div>
            </>
          )}
        </>
      )}
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
  isUnread?: boolean;
  createdBy?: {
    id: string;
    firstName?: string;
    lastName?: string;
    role?: string;
  } | null;
  schoolClass?: { id: string; name: string; section?: string | null } | null;
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

function teacherName(assignment: StudentAssignment) {
  const teacher = assignment.createdBy;
  if (!teacher) return 'Teacher';
  const name = `${teacher.firstName ?? ''} ${teacher.lastName ?? ''}`.trim();
  return name || 'Teacher';
}

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

  useEffect(() => {
    if (!selectedId) return;
    let active = true;
    (async () => {
      try {
        await markAssignmentRead(selectedId);
        if (!active) return;
        setAssignments((prev) =>
          prev.map((item) =>
            item.id === selectedId ? { ...item, isUnread: false } : item,
          ),
        );
        emitUnreadChanged();
      } catch {
        /* ignore mark failures */
      }
    })().catch(console.error);
    return () => {
      active = false;
    };
  }, [selectedId]);

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
          subtitle={`${selected.subject} · By ${teacherName(selected)} · Due ${formatStudentDue(selected.dueDate)}`}
        />
        <p className="mb-4 text-sm text-gray-500">{selected.description}</p>
        <p className="mb-4 text-xs text-gray-400">
          Published by {teacherName(selected)} · only students in your class can submit
        </p>

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
                  loading="lazy"
                  decoding="async"
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
      <SectionHeader
        title="Assignments"
        subtitle="Assignments published by your teachers for your class"
      />
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
                <div className="flex flex-wrap items-center gap-2">
                  <p className="font-semibold text-gray-900">{item.title}</p>
                  {item.isUnread && <Badge tone="red">New</Badge>}
                </div>
                <p className="mt-1 text-sm text-gray-500">
                  {item.subject} · By {teacherName(item)} · Due {formatStudentDue(item.dueDate)}
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
            No teacher assignments for your class yet.
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

function MessagesPage({
  onUnreadChange,
}: {
  onUnreadChange?: (count: number) => void;
}) {
  return (
    <MessagesChat
      subtitle="Chat with your teachers"
      variant="student"
      onUnreadChange={onUnreadChange}
    />
  );
}

const PAGES = {
  announcements: AnnouncementsPage,
  attendance: AttendancePage,
  grades: GradesPage,
  assignments: AssignmentsPage,
  leave: LeavePage,
};

function StudentPage({
  page,
  onMessageUnreadChange,
}: {
  page: Exclude<PageId, 'dashboard'>;
  onMessageUnreadChange?: (count: number) => void;
}) {
  if (page === 'messages') {
    return <MessagesPage onUnreadChange={onMessageUnreadChange} />;
  }
  const Page = PAGES[page];
  return <Page />;
}

function NavCount({ count }: { count: number }) {
  const label = formatUnreadBadge(count);
  if (!label) return null;
  return (
    <span className="ml-1.5 inline-flex min-w-[1.15rem] items-center justify-center rounded-full bg-rose-500 px-1 py-0.5 text-[10px] font-semibold leading-none text-white">
      {label}
    </span>
  );
}

export default function StudentPortal() {
  const { user, logout } = useAuth();
  const [page, setPage] = useState<PageId>('dashboard');
  const [unread, setUnread] = useState<UnreadCounts>({
    announcements: 0,
    assignments: 0,
    messages: 0,
  });

  const firstName = user?.firstName ?? STUDENT.firstName;
  const displayName = user ? `${user.firstName} ${user.lastName}` : STUDENT.name;
  const classLabel = (() => {
    const schoolClass = user?.studentProfile?.schoolClass;
    if (!schoolClass?.name) return STUDENT.className;
    const section = schoolClass.section?.trim();
    return section ? `${schoolClass.name} - ${section}` : schoolClass.name;
  })();

  useEffect(() => {
    return startPortalNotifications({
      includeAssignments: true,
      onCounts: setUnread,
    });
  }, []);

  const unreadFor = (id: PageId) => {
    if (id === 'announcements') return unread.announcements;
    if (id === 'assignments') return unread.assignments;
    if (id === 'messages') return unread.messages;
    return 0;
  };

  const totalUnread =
    unread.announcements + unread.assignments + unread.messages;

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
                    'inline-flex items-center rounded-full px-3 py-2 text-sm transition-colors',
                    active
                      ? 'bg-indigo-50 font-medium text-indigo-700'
                      : 'text-gray-500 hover:bg-violet-50 hover:text-gray-700',
                  )}
                >
                  {item.label}
                  <NavCount count={unreadFor(item.id)} />
                </button>
              );
            })}
          </nav>

          <div className="flex items-center gap-1 md:gap-2">
            <NotificationBell
              tone="student"
              totalUnread={totalUnread}
              announcements={unread.announcements}
              messages={unread.messages}
              assignments={unread.assignments}
              onOpenAnnouncements={() => setPage('announcements')}
              onOpenMessages={() => setPage('messages')}
              onOpenAssignments={() => setPage('assignments')}
            />
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
              const count = unreadFor(item.id);
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setPage(item.id)}
                  className={cn(
                    'relative inline-flex h-10 shrink-0 items-center gap-1.5 rounded-full px-3 text-xs font-medium whitespace-nowrap',
                    active ? 'bg-indigo-600 text-white' : 'bg-violet-50 text-gray-500',
                  )}
                >
                  <Icon className="h-3.5 w-3.5" />
                  {item.short}
                  {count > 0 && (
                    <span
                      className={cn(
                        'inline-flex min-w-[1.1rem] items-center justify-center rounded-full px-1 py-0.5 text-[10px] font-semibold leading-none',
                        active ? 'bg-white text-indigo-700' : 'bg-rose-500 text-white',
                      )}
                    >
                      {formatUnreadBadge(count)}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-6 md:px-6 md:py-8">
        {page === 'dashboard' ? (
          <DashboardPage
            firstName={firstName}
            className={classLabel}
            onOpenAssignments={() => setPage('assignments')}
          />
        ) : (
          <StudentPage
            page={page}
            onMessageUnreadChange={(count) =>
              setUnread((prev) => ({ ...prev, messages: count }))
            }
          />
        )}
      </main>
    </div>
  );
}
