import {
  Bell,
  BookOpen,
  CalendarClock,
  CalendarOff,
  Check,
  ChevronLeft,
  ChevronRight,
  ClipboardCheck,
  GraduationCap,
  LayoutDashboard,
  LogOut,
  Megaphone,
  Menu,
  MessageSquare,
  Pencil,
  Plus,
  Search,
  Trash2,
  Users,
  X,
} from 'lucide-react';
import { useEffect, useState, type FormEvent } from 'react';
import { useAuth } from './auth/AuthContext';
import api from './api/client';
import MessagesChat from './components/MessagesChat';
import NotificationBell from './components/NotificationBell';
import {
  apiErrorMessage,
  formatLeaveApplied,
  formatLeaveDates,
  leaveFullName,
  leaveRoll,
  leaveStatusLabel,
  type ApiLeave,
} from './lib/leave';
import { mediaUrl } from './lib/media';
import { startPortalNotifications } from './lib/notifications';
import { teachingSubjectLabel } from './lib/subjects';
import {
  isStaffClassTeacher,
  staffAssignedClasses,
  staffClassTeacherClass,
} from './lib/staffClasses';
import {
  emitUnreadChanged,
  formatUnreadBadge,
  markAnnouncementsRead,
  type UnreadCounts,
} from './lib/unread';
import {
  Avatar,
  Badge,
  Card,
  IconButton,
  Modal,
  PersonCell,
  PostMedia,
  PrimaryButton,
  SectionHeader,
  StatCard,
  TableShell,
  cn,
  type BadgeTone,
} from './ui';

type PageId =
  | 'dashboard'
  | 'students'
  | 'attendance'
  | 'grades'
  | 'assignments'
  | 'timetable'
  | 'leave'
  | 'messages'
  | 'announcements';

type Mark = 'P' | 'A' | 'L';

const TEACHER = { name: 'Kavya Menon', role: 'English Teacher', department: 'English Department' };

const PAGE_LABELS: Record<PageId, string> = {
  dashboard: 'Dashboard',
  students: 'My Students',
  attendance: 'Attendance',
  grades: 'Grades',
  assignments: 'Assignments',
  timetable: 'Timetable',
  leave: 'Leave',
  messages: 'Messages',
  announcements: 'Announcements',
};

const NAV_ITEMS: { id: PageId; label: string; icon: typeof LayoutDashboard }[] = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { id: 'students', label: 'My Students', icon: Users },
  { id: 'attendance', label: 'Attendance', icon: ClipboardCheck },
  { id: 'grades', label: 'Grades', icon: GraduationCap },
  { id: 'assignments', label: 'Assignments', icon: BookOpen },
  { id: 'timetable', label: 'Timetable', icon: CalendarClock },
  { id: 'leave', label: 'Leave', icon: CalendarOff },
  { id: 'messages', label: 'Messages', icon: MessageSquare },
  { id: 'announcements', label: 'Announcements', icon: Megaphone },
];

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
  if (audience === 'ALL') return 'blue';
  if (audience === 'STAFF' || audience === 'ADMIN') return 'slate';
  if (audience === 'STUDENT') return 'green';
  return 'amber';
}

const MARK_OPTIONS: { id: Mark; label: string; active: string; hover: string }[] = [
  { id: 'P', label: 'P', active: 'border-green-600 bg-green-50 text-green-700', hover: 'hover:border-green-300 hover:text-green-700' },
  { id: 'A', label: 'A', active: 'border-red-600 bg-red-50 text-red-700', hover: 'hover:border-red-300 hover:text-red-700' },
  { id: 'L', label: 'L', active: 'border-amber-500 bg-amber-50 text-amber-800', hover: 'hover:border-amber-300 hover:text-amber-800' },
];

function markTone(mark: Mark): BadgeTone {
  if (mark === 'P') return 'green';
  if (mark === 'A') return 'red';
  return 'amber';
}

function markLabel(mark: Mark) {
  if (mark === 'P') return 'Present';
  if (mark === 'A') return 'Absent';
  return 'Late';
}

function leaveTone(status: string): BadgeTone {
  if (status === 'Approved' || status === 'APPROVED') return 'green';
  if (status === 'Rejected' || status === 'REJECTED') return 'red';
  return 'amber';
}

function AttendanceButtons({
  value,
  onChange,
  fullWidth,
}: {
  value: Mark;
  onChange: (mark: Mark) => void;
  fullWidth?: boolean;
}) {
  return (
    <div className={cn('flex gap-2', fullWidth && 'w-full')}>
      {MARK_OPTIONS.map((option) => (
        <button
          key={option.id}
          type="button"
          aria-label={markLabel(option.id)}
          onClick={() => onChange(option.id)}
          className={cn(
            'inline-flex h-10 items-center justify-center rounded-lg border text-sm font-semibold',
            fullWidth ? 'flex-1' : 'w-10',
            value === option.id ? option.active : cn('border-gray-200 text-gray-500', option.hover),
          )}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

function DashboardPage({
  teacherName,
  onViewAssignments,
  onViewTimetable,
}: {
  teacherName: string;
  onViewAssignments: () => void;
  onViewTimetable?: () => void;
}) {
  const { user } = useAuth();
  const subjectLabel = teachingSubjectLabel(user?.staffProfile?.subject);
  const departmentLabel =
    subjectLabel || user?.staffProfile?.department || 'Staff';

  const [attendanceValue, setAttendanceValue] = useState('—');
  const [attendanceSub, setAttendanceSub] = useState('Loading today...');
  const [studentCount, setStudentCount] = useState('—');
  const [pendingGrading, setPendingGrading] = useState('—');
  const [openAssignments, setOpenAssignments] = useState('—');
  const [needsGrading, setNeedsGrading] = useState<
    Array<{ id: string; title: string; className: string; done: number; total: number; pending: number }>
  >([]);
  const [listsLoading, setListsLoading] = useState(true);
  const [nextClass, setNextClass] = useState<NextClassInfo | null>(null);
  const [todayClasses, setTodayClasses] = useState<
    Array<{
      id: string;
      startTime: string;
      endTime: string;
      classLabel: string;
      startMin: number;
      endMin: number;
    }>
  >([]);
  const [timetableLoading, setTimetableLoading] = useState(true);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const today = todayInputValue();
        const [rosterRes, classRes, attendanceRes, assignmentsRes, timetableRes] =
          await Promise.all([
            api.get('/users/my-students'),
            api.get('/users/my-class-students'),
            api.get('/attendance', { params: { date: today } }),
            api.get('/assignments'),
            api.get('/timetable/mine').catch(() => ({ data: { periods: [] } })),
          ]);
        if (!active) return;

        const roster = rosterRes.data as unknown[];
        const classStudents = classRes.data as unknown[];
        const records = attendanceRes.data as Array<{ status: string }>;
        setStudentCount(String(roster.length));

        if (!classStudents.length) {
          setAttendanceValue('—');
          setAttendanceSub('Class teacher attendance only');
        } else {
          setAttendanceValue(`${records.length} / ${classStudents.length}`);
          setAttendanceSub(
            records.length === classStudents.length
              ? 'Today complete'
              : 'Mark remaining students today',
          );
        }

        const assignments = assignmentsRes.data as Array<{
          id: string;
          title: string;
          schoolClass?: { name?: string; section?: string | null } | null;
          submissions?: Array<{ status: string }>;
          _count?: { submissions?: number };
        }>;

        let pendingCount = 0;
        const gradingRows = assignments.map((item) => {
          const submissions = item.submissions ?? [];
          const pending = submissions.filter(
            (s) => s.status === 'SUBMITTED' || s.status === 'PENDING',
          ).length;
          pendingCount += pending;
          const done = submissions.filter(
            (s) =>
              s.status === 'SUBMITTED' ||
              s.status === 'PENDING' ||
              s.status === 'APPROVED' ||
              s.status === 'REJECTED',
          ).length;
          return {
            id: item.id,
            title: item.title,
            className: formatClassLabel(item.schoolClass),
            done,
            total: Math.max(done, item._count?.submissions ?? submissions.length),
            pending,
          };
        });

        const needsReview = gradingRows
          .filter((row) => row.pending > 0)
          .sort((a, b) => b.pending - a.pending);

        setPendingGrading(String(pendingCount));
        setOpenAssignments(String(assignments.length));
        setNeedsGrading(needsReview.slice(0, 4));

        const periods = (timetableRes.data?.periods ?? []) as TimetablePeriodRow[];
        setNextClass(findNextClass(periods));
        setTodayClasses(todaysSchedule(periods));
      } catch {
        if (active) {
          setAttendanceValue('—');
          setAttendanceSub('Could not load attendance');
          setPendingGrading('—');
          setOpenAssignments('—');
          setNeedsGrading([]);
          setNextClass(null);
          setTodayClasses([]);
        }
      } finally {
        if (active) {
          setListsLoading(false);
          setTimetableLoading(false);
        }
      }
    })().catch(console.error);
    return () => {
      active = false;
    };
  }, []);

  const nextClassValue = nextClass
    ? `${formatClockLabel(nextClass.startTime)} – ${formatClockLabel(nextClass.endTime)}`
    : '—';
  const nextClassSub = nextClass
    ? `${nextClass.classLabel}${nextClass.status === 'now' ? ' · in progress' : ' · up next'}`
    : 'No more classes today';

  const minutesNow = nowMinutes();

  return (
    <>
      <SectionHeader
        title={`Good morning, ${teacherName}`}
        subtitle={`${departmentLabel} · ${formatDayLabel(todayInputValue())}`}
      />
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4 lg:gap-4">
        <StatCard
          label="Next class"
          value={timetableLoading ? '…' : nextClassValue}
          subtext={timetableLoading ? 'Loading timetable...' : nextClassSub}
          icon={<CalendarClock className="h-4 w-4" />}
        />
        <StatCard
          label="Total students"
          value={studentCount}
          subtext="In your teaching roster"
          icon={<Users className="h-4 w-4" />}
        />
        <StatCard
          label="Pending grading"
          value={pendingGrading}
          subtext={`${openAssignments} assignment${openAssignments === '1' ? '' : 's'} open`}
          icon={<GraduationCap className="h-4 w-4" />}
        />
        <StatCard
          label="Attendance marked"
          value={attendanceValue}
          subtext={attendanceSub}
          icon={<ClipboardCheck className="h-4 w-4" />}
        />
      </div>
      <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card className="p-4 md:p-5 lg:col-span-2">
          <div className="flex items-center justify-between gap-2">
            <div>
              <h2 className="font-semibold text-gray-900">Today&apos;s classes</h2>
              <p className="mt-1 text-sm text-gray-400">
                From your timetable · {WEEK_DAY_LABELS[todayWeekDay()]}
              </p>
            </div>
            {onViewTimetable && (
              <button
                type="button"
                onClick={onViewTimetable}
                className="text-sm font-medium text-blue-600 hover:text-blue-700"
              >
                Edit timetable
              </button>
            )}
          </div>
          {timetableLoading && (
            <p className="mt-4 text-sm text-gray-500">Loading today&apos;s schedule...</p>
          )}
          {!timetableLoading && !todayClasses.length && (
            <p className="mt-4 text-sm text-gray-500">
              No classes scheduled for today. Open Timetable to assign periods.
            </p>
          )}
          {!timetableLoading && todayClasses.length > 0 && (
            <ul className="mt-4 space-y-2">
              {todayClasses.map((slot) => {
                const isNow = minutesNow >= slot.startMin && minutesNow < slot.endMin;
                const isPast = minutesNow >= slot.endMin;
                return (
                  <li
                    key={slot.id}
                    className={cn(
                      'flex flex-col gap-1 rounded-xl px-3 py-3 sm:flex-row sm:items-center sm:justify-between',
                      isNow ? 'bg-blue-50' : 'hover:bg-gray-50',
                      isPast && 'opacity-60',
                    )}
                  >
                    <div className="min-w-0">
                      <p className="text-xs font-medium text-gray-400">
                        {formatClockLabel(slot.startTime)} – {formatClockLabel(slot.endTime)}
                      </p>
                      <p className="mt-1 text-sm font-medium text-gray-900">
                        {slot.classLabel}
                        {subjectLabel ? ` · ${subjectLabel}` : ''}
                      </p>
                    </div>
                    {isNow && <Badge tone="blue">Now</Badge>}
                    {!isNow && !isPast && <Badge tone="slate">Upcoming</Badge>}
                    {isPast && <Badge tone="slate">Done</Badge>}
                  </li>
                );
              })}
            </ul>
          )}
        </Card>
        <Card className="p-4 md:p-5">
          <div className="flex items-center justify-between gap-2">
            <h2 className="font-semibold text-gray-900">Needs grading</h2>
            <button
              type="button"
              onClick={onViewAssignments}
              className="text-sm font-medium text-blue-600 hover:text-blue-700"
            >
              View all
            </button>
          </div>
          {listsLoading && (
            <p className="mt-4 text-sm text-gray-500">Loading assignments...</p>
          )}
          {!listsLoading && !needsGrading.length && (
            <p className="mt-4 text-sm text-gray-500">No submissions waiting for review.</p>
          )}
          {!listsLoading && needsGrading.length > 0 && (
            <ul className="mt-4 space-y-4">
              {needsGrading.map((item) => (
                <li key={item.id}>
                  <p className="text-sm font-medium text-gray-900">{item.title}</p>
                  <p className="mt-0.5 text-xs text-gray-400">{item.className}</p>
                  <p className="mt-1 text-sm text-gray-500">
                    {item.pending} awaiting review · {item.done} submitted
                  </p>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </>
  );
}

type ApiClass = {
  id: string;
  name: string;
  section?: string | null;
};

type ApiStudent = {
  id: string;
  userId: string;
  studentId: string;
  schoolClassId?: string | null;
  parentName?: string | null;
  parentPhone?: string | null;
  address?: string | null;
  user?: {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
    isActive: boolean;
  };
  schoolClass?: { id: string; name: string; section?: string | null } | null;
};

type StudentFormState = {
  firstName: string;
  lastName: string;
  email: string;
  password: string;
  studentId: string;
  parentName: string;
  parentPhone: string;
  address: string;
  schoolClassId: string;
};

const EMPTY_STUDENT_FORM: StudentFormState = {
  firstName: '',
  lastName: '',
  email: '',
  password: 'password123',
  studentId: '',
  parentName: '',
  parentPhone: '',
  address: '',
  schoolClassId: '',
};

function studentFullName(student: ApiStudent) {
  return `${student.user?.firstName ?? ''} ${student.user?.lastName ?? ''}`.trim() || 'Student';
}

function formatClassLabel(schoolClass?: { name?: string; section?: string | null } | null) {
  if (!schoolClass?.name) return '—';
  const section = schoolClass.section?.trim();
  return section ? `${schoolClass.name}-${section}` : schoolClass.name;
}

const WEEK_DAYS = [
  'MONDAY',
  'TUESDAY',
  'WEDNESDAY',
  'THURSDAY',
  'FRIDAY',
  'SATURDAY',
  'SUNDAY',
] as const;

type WeekDay = (typeof WEEK_DAYS)[number];

const WEEK_DAY_LABELS: Record<WeekDay, string> = {
  MONDAY: 'Mon',
  TUESDAY: 'Tue',
  WEDNESDAY: 'Wed',
  THURSDAY: 'Thu',
  FRIDAY: 'Fri',
  SATURDAY: 'Sat',
  SUNDAY: 'Sun',
};

type TimetablePeriodRow = {
  id: string;
  startTime: string;
  endTime: string;
  sortOrder: number;
  entriesByDay: Record<
    string,
    {
      id: string;
      schoolClassId: string | null;
      schoolClass: { id: string; name: string; section?: string | null } | null;
    } | null
  >;
};

function formatClockLabel(time: string) {
  const [hStr, mStr] = time.split(':');
  const h = Number(hStr);
  const m = Number(mStr);
  if (Number.isNaN(h) || Number.isNaN(m)) return time;
  const suffix = h >= 12 ? 'pm' : 'am';
  const hour12 = h % 12 || 12;
  return `${hour12}:${String(m).padStart(2, '0')} ${suffix}`;
}

function timeToMinutes(time: string) {
  const [h, m] = time.split(':').map(Number);
  if (Number.isNaN(h) || Number.isNaN(m)) return 0;
  return h * 60 + m;
}

function todayWeekDay(date = new Date()): WeekDay {
  // JS: 0 Sunday … 6 Saturday → our WeekDay enum order Mon-first
  const map: WeekDay[] = [
    'SUNDAY',
    'MONDAY',
    'TUESDAY',
    'WEDNESDAY',
    'THURSDAY',
    'FRIDAY',
    'SATURDAY',
  ];
  return map[date.getDay()];
}

function nowMinutes(date = new Date()) {
  return date.getHours() * 60 + date.getMinutes();
}

type NextClassInfo = {
  startTime: string;
  endTime: string;
  classLabel: string;
  status: 'now' | 'upcoming';
};

function findNextClass(
  periods: TimetablePeriodRow[],
  day: WeekDay = todayWeekDay(),
  minutes = nowMinutes(),
): NextClassInfo | null {
  const todays = periods
    .map((period) => {
      const entry = period.entriesByDay?.[day];
      const schoolClass = entry?.schoolClass;
      if (!schoolClass?.id) return null;
      return {
        startTime: period.startTime,
        endTime: period.endTime,
        classLabel: formatClassLabel(schoolClass),
        startMin: timeToMinutes(period.startTime),
        endMin: timeToMinutes(period.endTime),
      };
    })
    .filter((row): row is NonNullable<typeof row> => Boolean(row))
    .sort((a, b) => a.startMin - b.startMin);

  const current = todays.find((row) => minutes >= row.startMin && minutes < row.endMin);
  if (current) {
    return {
      startTime: current.startTime,
      endTime: current.endTime,
      classLabel: current.classLabel,
      status: 'now',
    };
  }

  const upcoming = todays.find((row) => row.startMin >= minutes);
  if (!upcoming) return null;
  return {
    startTime: upcoming.startTime,
    endTime: upcoming.endTime,
    classLabel: upcoming.classLabel,
    status: 'upcoming',
  };
}

function todaysSchedule(
  periods: TimetablePeriodRow[],
  day: WeekDay = todayWeekDay(),
) {
  return periods
    .map((period) => {
      const entry = period.entriesByDay?.[day];
      const schoolClass = entry?.schoolClass;
      if (!schoolClass?.id) return null;
      return {
        id: period.id,
        startTime: period.startTime,
        endTime: period.endTime,
        classLabel: formatClassLabel(schoolClass),
        startMin: timeToMinutes(period.startTime),
        endMin: timeToMinutes(period.endTime),
      };
    })
    .filter((row): row is NonNullable<typeof row> => Boolean(row))
    .sort((a, b) => a.startMin - b.startMin);
}

function StudentFormModal({
  mode,
  form,
  classes,
  busy,
  error,
  onChange,
  onClose,
  onSubmit,
}: {
  mode: 'add' | 'edit';
  form: StudentFormState;
  classes: ApiClass[];
  busy: boolean;
  error: string;
  onChange: (next: StudentFormState) => void;
  onClose: () => void;
  onSubmit: (event: FormEvent) => void;
}) {
  const field = (
    label: string,
    key: keyof StudentFormState,
    props: {
      type?: string;
      required?: boolean;
      placeholder?: string;
    } = {},
  ) => (
    <label className="block text-sm text-gray-700">
      {label}
      <input
        value={form[key]}
        onChange={(event) => onChange({ ...form, [key]: event.target.value })}
        type={props.type ?? 'text'}
        required={props.required}
        placeholder={props.placeholder}
        className="mt-1.5 h-10 w-full rounded-lg border border-gray-200 px-3 text-sm text-gray-900 placeholder:text-gray-400 focus:border-blue-600 focus:outline-none focus:ring-1 focus:ring-blue-600"
      />
    </label>
  );

  return (
    <Modal onClose={onClose} size="lg">
      <div className="mb-3 flex items-start justify-between gap-3 sm:mb-4">
        <div className="min-w-0">
          <h2 className="text-base font-semibold text-gray-900 sm:text-lg">
            {mode === 'add' ? 'Add student' : 'Edit student'}
          </h2>
          <p className="mt-1 hidden text-sm text-gray-500 sm:block">
            {mode === 'add'
              ? 'Creates a student account. Choose the class for this student.'
              : 'Update student details.'}
          </p>
        </div>
        <IconButton label="Close" onClick={onClose} className="shrink-0">
          <X className="h-4 w-4" />
        </IconButton>
      </div>
      <form onSubmit={onSubmit} className="space-y-2 sm:space-y-3">
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 sm:gap-3">
          {field('First name', 'firstName', { required: true })}
          {field('Last name', 'lastName', { required: true })}
        </div>
        {mode === 'add' && (
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 sm:gap-3">
            {field('Email', 'email', { type: 'email', required: true, placeholder: 'student@school.com' })}
            {field('Password', 'password', { type: 'password', required: true })}
            <div className="sm:col-span-2">
              {field('Student / Roll ID', 'studentId', { required: true, placeholder: '9A-12' })}
            </div>
            <label className="block text-sm text-gray-700 sm:col-span-2">
              Class
              <select
                required
                value={form.schoolClassId}
                onChange={(event) =>
                  onChange({ ...form, schoolClassId: event.target.value })
                }
                className="mt-1.5 h-10 w-full rounded-lg border border-gray-200 bg-white px-3 text-sm text-gray-900 focus:border-blue-600 focus:outline-none focus:ring-1 focus:ring-blue-600"
              >
                <option value="">Select class</option>
                {classes.map((item) => (
                  <option key={item.id} value={item.id}>
                    {formatClassLabel(item)}
                  </option>
                ))}
              </select>
            </label>
          </div>
        )}
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 sm:gap-3">
          {field('Parent name', 'parentName')}
          {field('Parent phone', 'parentPhone', { placeholder: '9876543210' })}
          <div className="sm:col-span-2">{field('Address', 'address')}</div>
        </div>
        {error && <p className="text-sm text-red-600">{error}</p>}
        <div className="flex flex-col-reverse gap-2 pt-1 sm:flex-row sm:justify-end sm:pt-2">
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-11 w-full items-center justify-center rounded-lg border border-gray-200 px-4 text-sm font-medium text-gray-700 hover:bg-gray-50 sm:h-10 sm:w-auto"
          >
            Cancel
          </button>
          <PrimaryButton
            type="submit"
            className="w-full sm:w-auto"
            icon={mode === 'add' ? <Plus className="h-4 w-4" /> : <Check className="h-4 w-4" />}
          >
            {busy ? 'Saving...' : mode === 'add' ? 'Add student' : 'Save changes'}
          </PrimaryButton>
        </div>
      </form>
    </Modal>
  );
}

function StudentsPage() {
  const { user } = useAuth();
  const [query, setQuery] = useState('');
  const [classFilter, setClassFilter] = useState('all');
  const [students, setStudents] = useState<ApiStudent[]>([]);
  const [classes, setClasses] = useState<ApiClass[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [modal, setModal] = useState<'add' | 'edit' | null>(null);
  const [editingUserId, setEditingUserId] = useState<string | null>(null);
  const [form, setForm] = useState<StudentFormState>(EMPTY_STUDENT_FORM);
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState('');

  const assignedClasses = staffAssignedClasses(user?.staffProfile);
  const assignedClassIds = assignedClasses.map((c) => c.id);
  const primaryClassId = assignedClassIds[0] ?? '';
  const assignedClassesLabel =
    assignedClasses.length > 0
      ? assignedClasses.map((c) => formatClassLabel(c)).join(', ')
      : '—';

  const load = async () => {
    setLoadError('');
    try {
      const studentsRes = await api.get('/users/my-students');
      setStudents(studentsRes.data);
      setClasses(
        assignedClasses.map((c) => ({
          id: c.id,
          name: c.name,
          section: c.section ?? '',
        })),
      );
    } catch {
      setLoadError('Could not load students. Check that you are signed in as staff.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load().catch(console.error);
  }, [assignedClassIds.join(',')]);

  const filtered = students.filter((student) => {
    if (classFilter !== 'all' && student.schoolClassId !== classFilter) {
      return false;
    }
    const name = studentFullName(student).toLowerCase();
    const roll = (student.studentId || '').toLowerCase();
    const email = (student.user?.email || '').toLowerCase();
    const classLabel = formatClassLabel(student.schoolClass).toLowerCase();
    const q = query.toLowerCase();
    return (
      !q ||
      name.includes(q) ||
      roll.includes(q) ||
      email.includes(q) ||
      classLabel.includes(q)
    );
  });

  const openAdd = () => {
    setModal('add');
    setEditingUserId(null);
    setForm({
      ...EMPTY_STUDENT_FORM,
      schoolClassId: primaryClassId || '',
    });
    setFormError('');
  };

  const openEdit = (student: ApiStudent) => {
    setModal('edit');
    setEditingUserId(student.userId);
    setForm({
      firstName: student.user?.firstName ?? '',
      lastName: student.user?.lastName ?? '',
      email: student.user?.email ?? '',
      password: '',
      studentId: student.studentId ?? '',
      parentName: student.parentName ?? '',
      parentPhone: student.parentPhone ?? '',
      address: student.address ?? '',
      schoolClassId: student.schoolClassId ?? '',
    });
    setFormError('');
  };

  const closeModal = () => {
    if (busy) return;
    setModal(null);
    setEditingUserId(null);
    setFormError('');
  };

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setFormError('');
    try {
      if (modal === 'add') {
        if (!form.schoolClassId) {
          setFormError('Please select a class');
          setBusy(false);
          return;
        }
        await api.post('/users/students', {
          firstName: form.firstName,
          lastName: form.lastName,
          email: form.email,
          password: form.password,
          studentId: form.studentId,
          schoolClassId: form.schoolClassId,
          parentName: form.parentName || undefined,
          parentPhone: form.parentPhone || undefined,
          address: form.address || undefined,
        });
      } else if (modal === 'edit' && editingUserId) {
        await api.patch(`/users/students/${editingUserId}`, {
          firstName: form.firstName,
          lastName: form.lastName,
          parentName: form.parentName || undefined,
          parentPhone: form.parentPhone || undefined,
          address: form.address || undefined,
        });
      }
      setModal(null);
      setEditingUserId(null);
      await load();
    } catch (err: unknown) {
      const message =
        (err as { response?: { data?: { message?: string | string[] } } })?.response?.data?.message;
      setFormError(
        Array.isArray(message)
          ? message.join(', ')
          : typeof message === 'string'
            ? message
            : 'Could not save student',
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <SectionHeader
        title="My Students"
        subtitle={
          assignedClassesLabel !== '—'
            ? `Students in your assigned classes · ${assignedClassesLabel}`
            : 'No classes assigned yet — ask admin to assign classes'
        }
        action={
          <PrimaryButton
            icon={<Plus className="h-4 w-4" />}
            onClick={openAdd}
            disabled={!assignedClassIds.length}
          >
            Add student
          </PrimaryButton>
        }
      />

      <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center">
        <div className="relative min-w-0 flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search by name, roll no., or email"
            className="h-10 w-full rounded-lg border border-gray-200 bg-white py-2 pl-9 pr-3 text-sm text-gray-900 placeholder:text-gray-400 focus:border-blue-600 focus:outline-none focus:ring-1 focus:ring-blue-600"
          />
        </div>
        <select
          value={classFilter}
          onChange={(event) => setClassFilter(event.target.value)}
          aria-label="Filter by class"
          className="h-10 w-full rounded-lg border border-gray-200 bg-white px-3 text-sm text-gray-900 focus:border-blue-600 focus:outline-none focus:ring-1 focus:ring-blue-600 sm:w-44"
        >
          <option value="all">All assigned</option>
          {assignedClasses.map((item) => (
            <option key={item.id} value={item.id}>
              {formatClassLabel(item)}
            </option>
          ))}
        </select>
      </div>

      {loading && <p className="text-sm text-gray-500">Loading students...</p>}
      {loadError && <p className="mb-4 text-sm text-red-600">{loadError}</p>}

      {!loading && !loadError && (
        <>
          <div className="space-y-3 md:hidden">
            {filtered.map((student) => (
              <Card key={student.id} className="p-4">
                <div className="flex items-start justify-between gap-2">
                  <PersonCell
                    name={studentFullName(student)}
                    sub={student.user?.email}
                  />
                  <IconButton label={`Edit ${studentFullName(student)}`} onClick={() => openEdit(student)}>
                    <Pencil className="h-4 w-4" />
                  </IconButton>
                </div>
                <dl className="mt-3 space-y-2 text-sm">
                  <div className="flex justify-between gap-3">
                    <dt className="text-gray-400">Roll / ID</dt>
                    <dd className="text-gray-700">{student.studentId}</dd>
                  </div>
                  <div className="flex justify-between gap-3">
                    <dt className="text-gray-400">Class</dt>
                    <dd className="text-gray-700">{formatClassLabel(student.schoolClass)}</dd>
                  </div>
                  <div className="flex justify-between gap-3">
                    <dt className="text-gray-400">Parent</dt>
                    <dd className="text-right text-gray-700">{student.parentName || '—'}</dd>
                  </div>
                  <div className="flex justify-between gap-3">
                    <dt className="text-gray-400">Phone</dt>
                    <dd className="text-gray-700">{student.parentPhone || '—'}</dd>
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <dt className="text-gray-400">Status</dt>
                    <dd>
                      <Badge tone={student.user?.isActive === false ? 'amber' : 'green'}>
                        {student.user?.isActive === false ? 'Inactive' : 'Active'}
                      </Badge>
                    </dd>
                  </div>
                </dl>
              </Card>
            ))}
          </div>

          <div className="hidden md:block">
            <TableShell columns={['Student', 'Roll / ID', 'Class', 'Parent', 'Phone', 'Status', '']}>
              {filtered.map((student) => (
                <tr key={student.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <PersonCell name={studentFullName(student)} sub={student.user?.email} />
                  </td>
                  <td className="px-4 py-3 text-gray-500">{student.studentId}</td>
                  <td className="px-4 py-3 text-gray-500">{formatClassLabel(student.schoolClass)}</td>
                  <td className="px-4 py-3 text-gray-500">{student.parentName || '—'}</td>
                  <td className="px-4 py-3 text-gray-500">{student.parentPhone || '—'}</td>
                  <td className="px-4 py-3">
                    <Badge tone={student.user?.isActive === false ? 'amber' : 'green'}>
                      {student.user?.isActive === false ? 'Inactive' : 'Active'}
                    </Badge>
                  </td>
                  <td className="px-2 py-3 text-right">
                    <IconButton label={`Edit ${studentFullName(student)}`} onClick={() => openEdit(student)}>
                      <Pencil className="h-4 w-4" />
                    </IconButton>
                  </td>
                </tr>
              ))}
            </TableShell>
          </div>

          {!filtered.length && (
            <Card className="mt-3 p-6 text-center">
              <p className="text-sm text-gray-500">
                {students.length
                  ? 'No students match your search.'
                  : 'No students in your assigned class yet. Use Add student to create one.'}
              </p>
            </Card>
          )}
        </>
      )}

      {modal && (
        <StudentFormModal
          mode={modal}
          form={form}
          classes={classes}
          busy={busy}
          error={formError}
          onChange={setForm}
          onClose={closeModal}
          onSubmit={onSubmit}
        />
      )}
    </>
  );
}

function statusToMark(status?: string): Mark {
  if (status === 'ABSENT') return 'A';
  if (status === 'LATE' || status === 'EXCUSED') return 'L';
  return 'P';
}

function markToStatus(mark: Mark) {
  if (mark === 'A') return 'ABSENT';
  if (mark === 'L') return 'LATE';
  return 'PRESENT';
}

function todayInputValue() {
  return new Date().toISOString().slice(0, 10);
}

function formatDayLabel(value: string) {
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString(undefined, {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

function studentUserId(student: ApiStudent) {
  return student.userId || student.user?.id || '';
}

function AttendancePage() {
  const { user } = useAuth();
  const classTeacher = staffClassTeacherClass(user?.staffProfile);
  const assignedClassId = classTeacher?.id;
  const [date, setDate] = useState(todayInputValue);
  const [students, setStudents] = useState<ApiStudent[]>([]);
  const [marks, setMarks] = useState<Record<string, Mark>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);
  const [savedCount, setSavedCount] = useState(0);

  const classLabel = formatClassLabel(
    classTeacher ?? students[0]?.schoolClass ?? null,
  );

  const load = async () => {
    setError('');
    try {
      if (!assignedClassId) {
        setStudents([]);
        setMarks({});
        return;
      }
      const [studentsRes, attendanceRes] = await Promise.all([
        api.get('/users/my-class-students'),
        api.get('/attendance', {
          params: { date, schoolClassId: assignedClassId },
        }),
      ]);
      const list = (studentsRes.data as ApiStudent[]).filter((student) =>
        Boolean(studentUserId(student)),
      );
      setStudents(list);
      const byStudent = new Map(
        (attendanceRes.data as Array<{ studentId: string; status: string }>).map((row) => [
          row.studentId,
          row.status,
        ]),
      );
      const next: Record<string, Mark> = {};
      for (const student of list) {
        const id = studentUserId(student);
        next[id] = statusToMark(byStudent.get(id));
      }
      setMarks(next);
    } catch (err) {
      setError(apiErrorMessage(err, 'Could not load attendance.'));
      setStudents([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    setLoading(true);
    setSaved(false);
    load().catch(console.error);
  }, [date, assignedClassId]);

  const setMark = (userId: string, mark: Mark) => {
    setSaved(false);
    setMarks((current) => ({ ...current, [userId]: mark }));
  };

  const save = async () => {
    if (!students.length || !assignedClassId) return;
    setSaving(true);
    setError('');
    setSaved(false);
    try {
      const entries = students
        .map((student) => {
          const id = studentUserId(student);
          if (!id) return null;
          return {
            studentId: id,
            status: markToStatus(marks[id] ?? 'P'),
          };
        })
        .filter(Boolean);
      if (!entries.length) {
        setError('No valid students to mark.');
        return;
      }
      await api.post('/attendance', {
        date,
        schoolClassId: assignedClassId,
        entries,
      });
      setSavedCount(entries.length);
      setSaved(true);
      await load();
    } catch (err) {
      setError(apiErrorMessage(err, 'Could not save attendance.'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <SectionHeader
        title="Attendance"
        subtitle={
          assignedClassId
            ? `${classLabel} · ${formatDayLabel(date)}`
            : 'Only class teachers can mark attendance'
        }
        action={
          assignedClassId ? (
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              <label className="block">
                <span className="sr-only">Date</span>
                <input
                  type="date"
                  value={date}
                  onChange={(event) => setDate(event.target.value)}
                  className="h-10 rounded-lg border border-gray-200 bg-white px-3 text-sm text-gray-700 focus:border-blue-600 focus:outline-none focus:ring-1 focus:ring-blue-600"
                />
              </label>
              <PrimaryButton
                icon={<Check className="h-4 w-4" />}
                disabled={saving || loading || !students.length}
                onClick={() => {
                  void save();
                }}
              >
                {saving ? 'Saving...' : 'Save attendance'}
              </PrimaryButton>
            </div>
          ) : undefined
        }
      />

      {loading && <p className="text-sm text-gray-500">Loading attendance...</p>}
      {error && <p className="mb-4 text-sm text-red-600">{error}</p>}
      {saved && !error && (
        <p className="mb-4 text-sm font-medium text-green-700">
          Attendance saved for {savedCount} student{savedCount === 1 ? '' : 's'} in {classLabel}.
          Students will see this on their dashboard and Attendance page.
        </p>
      )}

      {!loading && !assignedClassId && (
        <Card className="p-6 text-center">
          <p className="text-sm text-gray-500">
            You are not assigned as a class teacher, so there is no attendance roster.
          </p>
        </Card>
      )}

      {!loading && !error && assignedClassId && (
        <>
          <div className="space-y-3 md:hidden">
            {students.map((student) => {
              const id = studentUserId(student);
              const name = studentFullName(student);
              const mark = marks[id] ?? 'P';
              return (
                <Card key={id} className="p-4">
                  <PersonCell name={name} sub={`Roll ${student.studentId}`} />
                  <div className="mt-3 flex items-center justify-between gap-2">
                    <Badge tone={markTone(mark)}>{markLabel(mark)}</Badge>
                  </div>
                  <div className="mt-3">
                    <AttendanceButtons
                      value={mark}
                      onChange={(next) => setMark(id, next)}
                      fullWidth
                    />
                  </div>
                </Card>
              );
            })}
          </div>

          <div className="hidden md:block">
            <TableShell columns={['Roll no.', 'Student', 'Status', 'Mark']}>
              {students.map((student) => {
                const id = studentUserId(student);
                const name = studentFullName(student);
                const mark = marks[id] ?? 'P';
                return (
                  <tr key={id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-gray-500">{student.studentId}</td>
                    <td className="px-4 py-3">
                      <PersonCell name={name} />
                    </td>
                    <td className="px-4 py-3">
                      <Badge tone={markTone(mark)}>{markLabel(mark)}</Badge>
                    </td>
                    <td className="px-4 py-3">
                      <AttendanceButtons
                        value={mark}
                        onChange={(next) => setMark(id, next)}
                      />
                    </td>
                  </tr>
                );
              })}
            </TableShell>
          </div>

          {!students.length && (
            <Card className="mt-3 p-6 text-center">
              <p className="text-sm text-gray-500">
                No students in your assigned class yet.
              </p>
            </Card>
          )}
        </>
      )}
    </>
  );
}

function GradesPage() {
  const { user } = useAuth();
  const profileClasses = staffAssignedClasses(user?.staffProfile);
  const profileClassIds = profileClasses.map((c) => c.id);
  const [selectedClassId, setSelectedClassId] = useState(profileClassIds[0] ?? '');
  const [data, setData] = useState<{
    subject: string;
    examName: string;
    maxScore: number;
    expectedSubjects: string[];
    assignedClasses?: Array<{ id: string; name: string; section?: string | null; label: string }>;
    schoolClass: { id: string; name: string; section?: string | null; label: string } | null;
    students: Array<{
      userId: string;
      studentId: string;
      firstName: string;
      lastName: string;
      myMark: { id: string; score: number; maxScore: number; gradeLetter?: string | null } | null;
      complete: boolean;
      totalScore: number | null;
      totalMax: number | null;
    }>;
  } | null>(null);
  const [scores, setScores] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [savingId, setSavingId] = useState<string | null>(null);
  const [saveError, setSaveError] = useState('');

  useEffect(() => {
    if (!selectedClassId && profileClassIds[0]) {
      setSelectedClassId(profileClassIds[0]);
    } else if (selectedClassId && profileClassIds.length && !profileClassIds.includes(selectedClassId)) {
      setSelectedClassId(profileClassIds[0] ?? '');
    }
  }, [profileClassIds.join(','), selectedClassId]);

  const load = async (classId?: string) => {
    setError('');
    try {
      const params =
        classId || selectedClassId
          ? { schoolClassId: classId || selectedClassId }
          : undefined;
      const { data: payload } = await api.get('/grades/my-class', { params });
      setData(payload);

      const apiClasses = (payload.assignedClasses ?? []) as Array<{ id: string }>;
      if (!selectedClassId && apiClasses[0]?.id) {
        setSelectedClassId(apiClasses[0].id);
      } else if (
        selectedClassId &&
        apiClasses.length &&
        !apiClasses.some((c) => c.id === selectedClassId) &&
        apiClasses[0]?.id
      ) {
        setSelectedClassId(apiClasses[0].id);
      }

      const next: Record<string, string> = {};
      for (const student of payload.students as Array<{
        userId: string;
        myMark: { score: number } | null;
      }>) {
        next[student.userId] =
          student.myMark != null ? String(student.myMark.score) : '';
      }
      setScores(next);
    } catch (err) {
      setError(
        apiErrorMessage(
          err,
          'Could not load class grades. Ask admin to assign a class and subject to this teacher.',
        ),
      );
      setData(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    setLoading(true);
    load(selectedClassId || undefined).catch(console.error);
  }, [selectedClassId]);

  const subjectLabel = teachingSubjectLabel(data?.subject ?? user?.staffProfile?.subject);
  const classLabel = data?.schoolClass?.label ?? 'Your class';
  const classOptions = data?.assignedClasses?.length
    ? data.assignedClasses
    : profileClasses.map((c) => ({
        id: c.id,
        name: c.name,
        section: c.section,
        label: formatClassLabel(c),
      }));

  const saveMark = async (studentUserId: string) => {
    const raw = scores[studentUserId]?.trim();
    if (raw === '' || raw == null) {
      setSaveError('Enter a score before saving.');
      return;
    }
    const score = Number(raw);
    if (Number.isNaN(score) || score < 0) {
      setSaveError('Score must be a valid number.');
      return;
    }
    setSavingId(studentUserId);
    setSaveError('');
    try {
      await api.put('/grades/my-mark', {
        studentId: studentUserId,
        score,
        maxScore: data?.maxScore ?? 100,
      });
      await load(selectedClassId || undefined);
    } catch (err) {
      setSaveError(apiErrorMessage(err, 'Could not save mark'));
    } finally {
      setSavingId(null);
    }
  };

  return (
    <>
      <SectionHeader
        title="Grades"
        subtitle={
          classOptions.length
            ? `Enter ${subjectLabel} marks for students in your assigned classes`
            : 'Ask admin to assign teaching classes and a subject first'
        }
      />

      <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-gray-500">
          {data
            ? `${classLabel} · ${subjectLabel} / ${data.maxScore}`
            : 'Select a class to enter marks'}
        </p>
        <select
          value={selectedClassId}
          onChange={(event) => setSelectedClassId(event.target.value)}
          aria-label="Filter by class"
          disabled={!classOptions.length}
          className="h-10 w-full rounded-lg border border-gray-200 bg-white px-3 text-sm text-gray-900 focus:border-blue-600 focus:outline-none focus:ring-1 focus:ring-blue-600 disabled:cursor-not-allowed disabled:bg-gray-50 sm:w-56"
        >
          {!classOptions.length && <option value="">No classes assigned</option>}
          {classOptions.map((item) => (
            <option key={item.id} value={item.id}>
              {item.label || formatClassLabel(item)}
            </option>
          ))}
        </select>
      </div>

      {loading && <p className="text-sm text-gray-500">Loading students...</p>}
      {error && <p className="mb-4 text-sm text-red-600">{error}</p>}
      {saveError && <p className="mb-4 text-sm text-red-600">{saveError}</p>}

      {!loading && !error && data && (
        <>
          <p className="mb-4 text-sm text-gray-500">
            Enter {subjectLabel} scores out of {data.maxScore}. Grade cards and toppers unlock
            only after all {data.expectedSubjects.length || 10} subjects are marked for every
            student.
          </p>

          <div className="space-y-3 md:hidden">
            {data.students.map((student) => {
              const name = `${student.firstName} ${student.lastName}`.trim();
              return (
                <Card key={student.userId} className="p-4">
                  <PersonCell name={name} sub={`Roll ${student.studentId}`} />
                  <label className="mt-3 block text-sm text-gray-700">
                    {subjectLabel} score
                    <input
                      type="number"
                      min={0}
                      max={data.maxScore}
                      step="0.01"
                      value={scores[student.userId] ?? ''}
                      onChange={(event) =>
                        setScores((prev) => ({
                          ...prev,
                          [student.userId]: event.target.value,
                        }))
                      }
                      className="mt-1.5 h-10 w-full rounded-lg border border-gray-200 px-3 text-sm text-gray-900 focus:border-blue-600 focus:outline-none focus:ring-1 focus:ring-blue-600"
                    />
                  </label>
                  <div className="mt-3 flex items-center justify-between gap-2">
                    <p className="text-sm text-gray-500">
                      {student.complete && student.totalScore != null
                        ? `Total ${student.totalScore}/${student.totalMax}`
                        : 'Total pending'}
                    </p>
                    <PrimaryButton
                      disabled={savingId === student.userId}
                      onClick={() => {
                        void saveMark(student.userId);
                      }}
                    >
                      {savingId === student.userId ? 'Saving...' : 'Save'}
                    </PrimaryButton>
                  </div>
                </Card>
              );
            })}
          </div>

          <div className="hidden md:block">
            <TableShell
              columns={['Student', 'Roll', `${subjectLabel} / ${data.maxScore}`, 'Total', '']}
            >
              {data.students.map((student) => {
                const name = `${student.firstName} ${student.lastName}`.trim();
                return (
                  <tr key={student.userId} className="hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <PersonCell name={name} />
                    </td>
                    <td className="px-4 py-3 text-gray-500">{student.studentId}</td>
                    <td className="px-4 py-3">
                      <input
                        type="number"
                        min={0}
                        max={data.maxScore}
                        step="0.01"
                        value={scores[student.userId] ?? ''}
                        onChange={(event) =>
                          setScores((prev) => ({
                            ...prev,
                            [student.userId]: event.target.value,
                          }))
                        }
                        className="h-10 w-28 rounded-lg border border-gray-200 px-3 text-sm text-gray-900 focus:border-blue-600 focus:outline-none focus:ring-1 focus:ring-blue-600"
                      />
                    </td>
                    <td className="px-4 py-3 text-gray-500">
                      {student.complete && student.totalScore != null
                        ? `${student.totalScore} / ${student.totalMax}`
                        : 'Pending'}
                    </td>
                    <td className="px-2 py-3 text-right">
                      <PrimaryButton
                        disabled={savingId === student.userId}
                        onClick={() => {
                          void saveMark(student.userId);
                        }}
                      >
                        {savingId === student.userId ? 'Saving...' : 'Save'}
                      </PrimaryButton>
                    </td>
                  </tr>
                );
              })}
            </TableShell>
          </div>

          {!data.students.length && (
            <Card className="mt-3 p-6 text-center">
              <p className="text-sm text-gray-500">
                No students in {classLabel} yet. Add students to this class first.
              </p>
            </Card>
          )}
        </>
      )}
    </>
  );
}

type AssignmentSubmission = {
  id: string;
  studentId: string;
  content: string;
  fileUrl?: string | null;
  mediaType?: string | null;
  score?: number | string | null;
  feedback?: string | null;
  status: 'PENDING' | 'SUBMITTED' | 'APPROVED' | 'REJECTED';
  attemptCount?: number;
  submittedAt: string;
  student?: { id: string; firstName: string; lastName: string; email: string };
};

type StaffAssignment = {
  id: string;
  title: string;
  description: string;
  subject: string;
  dueDate: string;
  maxScore: number | string;
  schoolClassId?: string;
  schoolClass?: { id: string; name: string; section?: string | null } | null;
  submissions?: AssignmentSubmission[];
  _count?: { submissions: number };
};

function submissionStatusTone(status: string): BadgeTone {
  if (status === 'APPROVED') return 'green';
  if (status === 'REJECTED') return 'red';
  if (status === 'SUBMITTED' || status === 'PENDING') return 'blue';
  return 'amber';
}

function staffSubmissionLabel(status: string) {
  if (status === 'APPROVED') return 'Approved';
  if (status === 'REJECTED') return 'Rejected';
  if (status === 'SUBMITTED' || status === 'PENDING') return 'Pending';
  return status;
}

function formatDue(date: string) {
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

function AssignmentsPage() {
  const { user } = useAuth();
  const assignedClasses = staffAssignedClasses(user?.staffProfile);
  const primaryClassId = assignedClasses[0]?.id ?? '';
  const [assignments, setAssignments] = useState<StaffAssignment[]>([]);
  const [allStudents, setAllStudents] = useState<ApiStudent[]>([]);
  const [classes, setClasses] = useState<ApiClass[]>([]);
  const [classFilter, setClassFilter] = useState('all');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selectedStudentId, setSelectedStudentId] = useState<string | null>(null);
  const [tab, setTab] = useState<'pending' | 'submitted' | 'rejected' | 'missing'>(
    'pending',
  );
  const [remark, setRemark] = useState('');
  const [score, setScore] = useState('');
  const [reviewBusy, setReviewBusy] = useState(false);
  const [reviewError, setReviewError] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [createBusy, setCreateBusy] = useState(false);
  const [createError, setCreateError] = useState('');
  const defaultSubject = teachingSubjectLabel(user?.staffProfile?.subject) || 'Subject';
  const [createForm, setCreateForm] = useState({
    title: '',
    description: '',
    subject: defaultSubject,
    dueDate: '',
    maxScore: '100',
    schoolClassId: primaryClassId,
  });

  const load = async () => {
    setError('');
    try {
      const [assignmentsRes, studentsRes] = await Promise.all([
        api.get('/assignments'),
        api.get('/users/my-students'),
      ]);
      setAssignments(assignmentsRes.data);
      setAllStudents(studentsRes.data);
      setClasses(
        assignedClasses.map((c) => ({
          id: c.id,
          name: c.name,
          section: c.section ?? '',
        })),
      );
    } catch {
      setError('Could not load assignments.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load().catch(console.error);
  }, [assignedClasses.map((c) => c.id).join(',')]);

  const filteredAssignments =
    classFilter === 'all'
      ? assignments
      : assignments.filter(
          (item) =>
            (item.schoolClassId || item.schoolClass?.id) === classFilter,
        );

  const selected = assignments.find((item) => item.id === selectedId) ?? null;
  const assignmentClassId =
    selected?.schoolClassId || selected?.schoolClass?.id || '';
  const classStudents = allStudents.filter(
    (student) => student.schoolClassId === assignmentClassId,
  );
  const submissions = selected?.submissions ?? [];
  const submittedIds = new Set(submissions.map((item) => item.studentId));
  const pendingList = submissions.filter(
    (item) => item.status === 'SUBMITTED' || item.status === 'PENDING',
  );
  const submittedList = submissions.filter((item) => item.status === 'APPROVED');
  const rejectedList = submissions.filter((item) => item.status === 'REJECTED');
  const missing = classStudents.filter((student) => !submittedIds.has(student.userId));
  const activeSubmission =
    submissions.find((item) => item.studentId === selectedStudentId) ?? null;
  const activeMissing = missing.find((student) => student.userId === selectedStudentId) ?? null;

  const openAssignment = (id: string) => {
    setSelectedId(id);
    setSelectedStudentId(null);
    setTab('pending');
    setRemark('');
    setScore('');
    setReviewError('');
  };

  const openCreate = () => {
    setCreateError('');
    setCreateForm({
      title: '',
      description: '',
      subject: defaultSubject,
      dueDate: '',
      maxScore: '100',
      schoolClassId: primaryClassId,
    });
    setShowCreate(true);
  };

  const review = async (status: 'APPROVED' | 'REJECTED') => {
    if (!activeSubmission) return;
    if (status === 'REJECTED' && !remark.trim()) {
      setReviewError('Add a remark message before rejecting.');
      return;
    }
    setReviewBusy(true);
    setReviewError('');
    try {
      await api.patch(`/assignments/submissions/${activeSubmission.id}/review`, {
        status,
        feedback: status === 'REJECTED' ? remark.trim() : undefined,
        score: status === 'APPROVED' && score ? Number(score) : undefined,
      });
      setRemark('');
      setScore('');
      await load();
      // Keep viewing this student so staff sees the Approved/Rejected result
    } catch (err: unknown) {
      const message =
        (err as { response?: { data?: { message?: string | string[] } } })?.response?.data?.message;
      setReviewError(
        Array.isArray(message)
          ? message.join(', ')
          : typeof message === 'string'
            ? message
            : 'Could not update submission',
      );
    } finally {
      setReviewBusy(false);
    }
  };

  const createAssignment = async (event: FormEvent) => {
    event.preventDefault();
    if (!createForm.schoolClassId) {
      setCreateError('Please select a class');
      return;
    }
    setCreateBusy(true);
    setCreateError('');
    try {
      await api.post('/assignments', {
        title: createForm.title,
        description: createForm.description,
        subject: createForm.subject,
        dueDate: createForm.dueDate,
        schoolClassId: createForm.schoolClassId,
        maxScore: Number(createForm.maxScore) || 100,
      });
      setShowCreate(false);
      setCreateForm({
        title: '',
        description: '',
        subject: defaultSubject,
        dueDate: '',
        maxScore: '100',
        schoolClassId: primaryClassId,
      });
      await load();
    } catch (err: unknown) {
      const message =
        (err as { response?: { data?: { message?: string | string[] } } })?.response?.data?.message;
      setCreateError(
        Array.isArray(message)
          ? message.join(', ')
          : typeof message === 'string'
            ? message
            : 'Could not create assignment',
      );
    } finally {
      setCreateBusy(false);
    }
  };

  if (selected && activeSubmission) {
    const name = `${activeSubmission.student?.firstName ?? ''} ${activeSubmission.student?.lastName ?? ''}`.trim();
    return (
      <>
        <button
          type="button"
          onClick={() => setSelectedStudentId(null)}
          className="mb-4 inline-flex items-center gap-1 text-sm font-medium text-blue-700 hover:text-blue-800"
        >
          <ChevronLeft className="h-4 w-4" />
          Back to student list
        </button>
        <SectionHeader
          title={name || 'Submission'}
          subtitle={`${selected.title} · ${selected.subject}`}
        />
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <Card className="p-4 md:p-5">
            <p className="text-xs text-gray-400">Submitted media</p>
            <div className="mt-3 overflow-hidden rounded-xl border border-gray-200 bg-gray-50">
              {activeSubmission.fileUrl ? (
                activeSubmission.mediaType === 'VIDEO' ||
                activeSubmission.fileUrl.match(/\.(mp4|webm|mov)$/i) ? (
                  <video
                    controls
                    className="max-h-80 w-full bg-black"
                    src={mediaUrl(activeSubmission.fileUrl)}
                  />
                ) : (
                  <img
                    alt="Assignment submission"
                    loading="lazy"
                    decoding="async"
                    className="max-h-80 w-full object-contain"
                    src={mediaUrl(activeSubmission.fileUrl)}
                  />
                )
              ) : (
                <p className="p-6 text-sm text-gray-500">No photo or video attached.</p>
              )}
            </div>
            <p className="mt-3 text-sm text-gray-700">{activeSubmission.content}</p>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <Badge tone={submissionStatusTone(activeSubmission.status)}>
                {staffSubmissionLabel(activeSubmission.status)}
              </Badge>
              <span className="text-xs text-gray-400">
                {formatDue(activeSubmission.submittedAt)}
              </span>
            </div>
            {activeSubmission.status === 'REJECTED' && activeSubmission.feedback && (
              <p className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900">
                Remark: {activeSubmission.feedback}
              </p>
            )}
          </Card>
          <Card className="p-4 md:p-5">
            {activeSubmission.status === 'SUBMITTED' ||
            activeSubmission.status === 'PENDING' ? (
              <>
                <h2 className="font-semibold text-gray-900">Review</h2>
                <p className="mt-1 text-sm text-gray-500">
                  Approve the work, or reject it with a remark the student can see.
                </p>
                <label className="mt-4 block text-sm text-gray-700">
                  Score (optional on approve)
                  <input
                    value={score}
                    onChange={(event) => setScore(event.target.value)}
                    type="number"
                    min={0}
                    max={Number(selected.maxScore) || 100}
                    className="mt-1.5 h-10 w-full rounded-lg border border-gray-200 px-3 text-sm focus:border-blue-600 focus:outline-none focus:ring-1 focus:ring-blue-600"
                  />
                </label>
                <label className="mt-3 block text-sm text-gray-700">
                  Remark message (required to reject)
                  <textarea
                    value={remark}
                    onChange={(event) => setRemark(event.target.value)}
                    rows={4}
                    placeholder="Explain what the student should fix"
                    className="mt-1.5 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-blue-600 focus:outline-none focus:ring-1 focus:ring-blue-600"
                  />
                </label>
                {reviewError && <p className="mt-2 text-sm text-red-600">{reviewError}</p>}
                <div className="mt-4 flex flex-col gap-2 sm:flex-row">
                  <PrimaryButton
                    icon={<Check className="h-4 w-4" />}
                    onClick={() => review('APPROVED')}
                  >
                    {reviewBusy ? 'Saving...' : 'Approve'}
                  </PrimaryButton>
                  <button
                    type="button"
                    disabled={reviewBusy}
                    onClick={() => review('REJECTED')}
                    className="inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-red-200 bg-red-50 px-4 text-sm font-medium text-red-700 hover:bg-red-100 disabled:opacity-60"
                  >
                    <X className="h-4 w-4" />
                    Reject
                  </button>
                </div>
              </>
            ) : activeSubmission.status === 'APPROVED' ? (
              <>
                <h2 className="font-semibold text-green-700">Approved</h2>
                <p className="mt-2 text-sm text-gray-500">
                  This submission is already approved. No further action is needed.
                </p>
                {activeSubmission.score != null && (
                  <p className="mt-3 text-sm font-medium text-gray-900">
                    Score: {activeSubmission.score}
                  </p>
                )}
              </>
            ) : (
              <>
                <h2 className="font-semibold text-red-700">Rejected</h2>
                <p className="mt-2 text-sm text-gray-500">
                  This submission was rejected. The student can resubmit if they still have attempts
                  left.
                </p>
                {activeSubmission.feedback && (
                  <p className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900">
                    Remark: {activeSubmission.feedback}
                  </p>
                )}
              </>
            )}
          </Card>
        </div>
      </>
    );
  }

  if (selected && activeMissing) {
    return (
      <>
        <button
          type="button"
          onClick={() => setSelectedStudentId(null)}
          className="mb-4 inline-flex items-center gap-1 text-sm font-medium text-blue-700 hover:text-blue-800"
        >
          <ChevronLeft className="h-4 w-4" />
          Back to student list
        </button>
        <SectionHeader
          title={studentFullName(activeMissing)}
          subtitle={`${selected.title} · Not submitted`}
        />
        <Card className="p-5">
          <p className="text-sm text-gray-500">
            This student has not uploaded a photo or video for this assignment yet.
          </p>
          <dl className="mt-4 space-y-2 text-sm">
            <div className="flex justify-between gap-3">
              <dt className="text-gray-400">Email</dt>
              <dd className="text-gray-700">{activeMissing.user?.email}</dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-gray-400">Roll / ID</dt>
              <dd className="text-gray-700">{activeMissing.studentId}</dd>
            </div>
          </dl>
        </Card>
      </>
    );
  }

  if (selected) {
    return (
      <>
        <button
          type="button"
          onClick={() => setSelectedId(null)}
          className="mb-4 inline-flex items-center gap-1 text-sm font-medium text-blue-700 hover:text-blue-800"
        >
          <ChevronLeft className="h-4 w-4" />
          Back to assignments
        </button>
        <SectionHeader
          title={selected.title}
          subtitle={`${selected.subject} · ${formatClassLabel(selected.schoolClass)} · Due ${formatDue(selected.dueDate)}`}
        />
        <p className="mb-4 text-sm text-gray-500">{selected.description}</p>
        <div className="mb-4 flex gap-2 overflow-x-auto pb-1">
          {(
            [
              { id: 'pending' as const, label: 'Pending', count: pendingList.length },
              { id: 'submitted' as const, label: 'Submitted', count: submittedList.length },
              { id: 'rejected' as const, label: 'Rejected', count: rejectedList.length },
              { id: 'missing' as const, label: 'Not submitted', count: missing.length },
            ] as const
          ).map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setTab(item.id)}
              className={cn(
                'shrink-0 rounded-lg px-3 py-2 text-sm font-medium',
                tab === item.id ? 'bg-blue-50 text-blue-700' : 'text-gray-500 hover:bg-gray-50',
              )}
            >
              {item.label} ({item.count})
            </button>
          ))}
        </div>

        {tab === 'missing' ? (
          <div className="space-y-2">
            {missing.map((student) => (
              <button
                key={student.id}
                type="button"
                onClick={() => setSelectedStudentId(student.userId)}
                className="flex w-full items-center gap-3 rounded-xl border border-gray-200 bg-white p-4 text-left shadow-sm hover:border-blue-200 hover:bg-blue-50/40"
              >
                <Avatar name={studentFullName(student)} />
                <span className="min-w-0 flex-1">
                  <span className="block font-medium text-gray-900">{studentFullName(student)}</span>
                  <span className="block truncate text-xs text-gray-400">{student.user?.email}</span>
                </span>
                <Badge tone="amber">Not submitted</Badge>
                <ChevronRight className="h-4 w-4 text-gray-400" />
              </button>
            ))}
            {!missing.length && (
              <Card className="p-6 text-center text-sm text-gray-500">
                Everyone in your class has submitted.
              </Card>
            )}
          </div>
        ) : (
          <div className="space-y-2">
            {(tab === 'pending'
              ? pendingList
              : tab === 'submitted'
                ? submittedList
                : rejectedList
            ).map((item) => {
              const name = `${item.student?.firstName ?? ''} ${item.student?.lastName ?? ''}`.trim();
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setSelectedStudentId(item.studentId)}
                  className="flex w-full items-center gap-3 rounded-xl border border-gray-200 bg-white p-4 text-left shadow-sm hover:border-blue-200 hover:bg-blue-50/40"
                >
                  <Avatar name={name || 'Student'} />
                  <span className="min-w-0 flex-1">
                    <span className="block font-medium text-gray-900">{name || 'Student'}</span>
                    <span className="block truncate text-xs text-gray-400">
                      {item.fileUrl
                        ? `${item.mediaType || 'File'} · ${formatDue(item.submittedAt)}`
                        : `No file · ${formatDue(item.submittedAt)}`}
                    </span>
                  </span>
                  <Badge tone={submissionStatusTone(item.status)}>
                    {staffSubmissionLabel(item.status)}
                  </Badge>
                  <ChevronRight className="h-4 w-4 text-gray-400" />
                </button>
              );
            })}
            {(tab === 'pending'
              ? pendingList
              : tab === 'submitted'
                ? submittedList
                : rejectedList
            ).length === 0 && (
              <Card className="p-6 text-center text-sm text-gray-500">
                {tab === 'pending' && 'No pending submissions waiting for review.'}
                {tab === 'submitted' && 'No approved submissions yet.'}
                {tab === 'rejected' && 'No rejected submissions.'}
              </Card>
            )}
          </div>
        )}
      </>
    );
  }

  return (
    <>
      <SectionHeader
        title="Assignments"
        subtitle="Create assignments for your assigned classes — only that class’s students can see them"
        action={
          <PrimaryButton
            icon={<Plus className="h-4 w-4" />}
            onClick={openCreate}
            disabled={!assignedClasses.length}
          >
            New assignment
          </PrimaryButton>
        }
      />
      {loading && <p className="text-sm text-gray-500">Loading assignments...</p>}
      {error && <p className="mb-4 text-sm text-red-600">{error}</p>}

      {!loading && assignedClasses.length > 1 && (
        <div className="mb-4">
          <select
            value={classFilter}
            onChange={(event) => setClassFilter(event.target.value)}
            aria-label="Filter assignments by class"
            className="h-10 w-full rounded-lg border border-gray-200 bg-white px-3 text-sm text-gray-900 focus:border-blue-600 focus:outline-none focus:ring-1 focus:ring-blue-600 sm:w-56"
          >
            <option value="all">All assigned classes</option>
            {assignedClasses.map((item) => (
              <option key={item.id} value={item.id}>
                {formatClassLabel(item)}
              </option>
            ))}
          </select>
        </div>
      )}

      <div className="space-y-3">
        {filteredAssignments.map((item) => {
          const classId = item.schoolClassId || item.schoolClass?.id;
          const totalForClass = allStudents.filter((s) => s.schoolClassId === classId).length;
          const done = item._count?.submissions ?? item.submissions?.length ?? 0;
          const total = totalForClass || done;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => openAssignment(item.id)}
              className="flex w-full items-start gap-3 rounded-xl border border-gray-200 bg-white p-4 text-left shadow-sm hover:border-blue-200 hover:bg-blue-50/40 md:p-5"
            >
              <div className="min-w-0 flex-1">
                <h2 className="font-semibold text-gray-900">{item.title}</h2>
                <p className="mt-1 text-sm text-gray-500">
                  {item.subject} · {formatClassLabel(item.schoolClass)} · Due {formatDue(item.dueDate)}
                </p>
              </div>
              <Badge tone={done >= total && total > 0 ? 'green' : 'blue'}>
                {done} / {total || '—'}
              </Badge>
              <ChevronRight className="mt-1 h-4 w-4 shrink-0 text-gray-400" />
            </button>
          );
        })}
        {!loading && !filteredAssignments.length && (
          <Card className="p-6 text-center text-sm text-gray-500">
            {assignments.length
              ? 'No assignments for this class filter.'
              : 'No assignments yet. Create one and choose the target class.'}
          </Card>
        )}
      </div>

      {showCreate && (
        <Modal onClose={() => setShowCreate(false)} size="md">
          <div className="mb-3 flex items-start justify-between sm:mb-4">
            <div>
              <h2 className="text-base font-semibold text-gray-900 sm:text-lg">New assignment</h2>
              <p className="mt-1 text-sm text-gray-500">
                Select a class. Only students in that class will see this assignment.
              </p>
            </div>
            <IconButton label="Close" onClick={() => setShowCreate(false)} className="shrink-0">
              <X className="h-4 w-4" />
            </IconButton>
          </div>
          <form onSubmit={createAssignment} className="space-y-2 sm:space-y-3">
            <label className="block text-sm text-gray-700">
              Class
              <select
                required
                value={createForm.schoolClassId}
                onChange={(e) =>
                  setCreateForm({ ...createForm, schoolClassId: e.target.value })
                }
                className="mt-1.5 h-10 w-full rounded-lg border border-gray-200 bg-white px-3 text-sm focus:border-blue-600 focus:outline-none focus:ring-1 focus:ring-blue-600"
              >
                <option value="">Select class</option>
                {classes.map((item) => (
                  <option key={item.id} value={item.id}>
                    {formatClassLabel(item)}
                  </option>
                ))}
              </select>
            </label>
            <label className="block text-sm text-gray-700">
              Title
              <input
                required
                value={createForm.title}
                onChange={(e) => setCreateForm({ ...createForm, title: e.target.value })}
                className="mt-1.5 h-10 w-full rounded-lg border border-gray-200 px-3 text-sm focus:border-blue-600 focus:outline-none focus:ring-1 focus:ring-blue-600"
              />
            </label>
            <label className="block text-sm text-gray-700">
              Description
              <textarea
                required
                rows={3}
                value={createForm.description}
                onChange={(e) => setCreateForm({ ...createForm, description: e.target.value })}
                className="mt-1.5 w-full resize-none rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-blue-600 focus:outline-none focus:ring-1 focus:ring-blue-600"
              />
            </label>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 sm:gap-3">
              <label className="block text-sm text-gray-700">
                Subject
                <input
                  required
                  value={createForm.subject}
                  onChange={(e) => setCreateForm({ ...createForm, subject: e.target.value })}
                  className="mt-1.5 h-10 w-full rounded-lg border border-gray-200 px-3 text-sm focus:border-blue-600 focus:outline-none focus:ring-1 focus:ring-blue-600"
                />
              </label>
              <label className="block text-sm text-gray-700">
                Due date
                <input
                  required
                  type="date"
                  value={createForm.dueDate}
                  onChange={(e) => setCreateForm({ ...createForm, dueDate: e.target.value })}
                  className="mt-1.5 h-10 w-full rounded-lg border border-gray-200 px-3 text-sm focus:border-blue-600 focus:outline-none focus:ring-1 focus:ring-blue-600"
                />
              </label>
            </div>
            {createError && <p className="text-sm text-red-600">{createError}</p>}
            <div className="flex flex-col-reverse gap-2 pt-1 sm:flex-row sm:justify-end sm:pt-2">
              <button
                type="button"
                onClick={() => setShowCreate(false)}
                className="inline-flex h-11 w-full items-center justify-center rounded-lg border border-gray-200 px-4 text-sm font-medium text-gray-700 hover:bg-gray-50 sm:h-10 sm:w-auto"
              >
                Cancel
              </button>
              <PrimaryButton type="submit" className="w-full sm:w-auto">
                {createBusy ? 'Creating...' : 'Create'}
              </PrimaryButton>
            </div>
          </form>
        </Modal>
      )}
    </>
  );
}

function LeavePage() {
  const { user } = useAuth();
  const [items, setItems] = useState<ApiLeave[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [reviewBusyId, setReviewBusyId] = useState<string | null>(null);
  const [formError, setFormError] = useState('');
  const [form, setForm] = useState({ reason: '', startDate: '', endDate: '' });

  const isClassTeacher = isStaffClassTeacher(user?.staffProfile);
  const classTeacher = staffClassTeacherClass(user?.staffProfile);
  const classLabel = formatClassLabel(classTeacher);

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

  const myLeave = items.filter((item) => item.requesterId === user?.id);
  const studentLeave = isClassTeacher
    ? items.filter((item) => item.requester?.role === 'STUDENT')
    : [];
  const pendingStudents = studentLeave.filter((item) => item.status === 'PENDING').length;

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

  const review = async (id: string, status: 'APPROVED' | 'REJECTED') => {
    setReviewBusyId(id);
    setError('');
    try {
      await api.patch(`/leave/${id}/review`, { status });
      await load();
    } catch (err: unknown) {
      setError(apiErrorMessage(err, 'Could not update leave request'));
    } finally {
      setReviewBusyId(null);
    }
  };

  return (
    <>
      <SectionHeader
        title="Leave"
        subtitle={
          isClassTeacher
            ? `Apply for your leave and review student requests from ${classLabel !== '—' ? classLabel : 'your class'}`
            : 'Apply for your leave. Student leave is visible only to the class teacher.'
        }
        action={
          <PrimaryButton icon={<Plus className="h-4 w-4" />} onClick={openModal}>
            Apply for leave
          </PrimaryButton>
        }
      />

      <div className="mb-5 grid grid-cols-1 gap-3 sm:grid-cols-3 lg:gap-4">
        <StatCard
          label="My requests"
          value={String(myLeave.length)}
          subtext={`${myLeave.filter((item) => item.status === 'PENDING').length} pending`}
          icon={<CalendarOff className="h-4 w-4" />}
        />
        <StatCard
          label="Student requests"
          value={String(studentLeave.length)}
          subtext={`${pendingStudents} awaiting review`}
          icon={<Users className="h-4 w-4" />}
        />
        <StatCard
          label="Pending reviews"
          value={String(pendingStudents)}
          subtext="Class students only"
          icon={<Bell className="h-4 w-4" />}
        />
      </div>

      {loading && <p className="text-sm text-gray-500">Loading leave requests...</p>}
      {error && <p className="mb-4 text-sm text-red-600">{error}</p>}

      {!loading && (
        <>
          <h2 className="mb-3 text-base font-semibold text-gray-900">Student leave requests</h2>
          {!isClassTeacher ? (
            <Card className="mb-8 p-6 text-center">
              <p className="text-sm text-gray-500">
                Only class teachers can review student leave for their assigned class.
              </p>
            </Card>
          ) : (
            <>
              <div className="mb-8 space-y-3 md:hidden">
                {studentLeave.map((row) => (
                  <Card key={row.id} className="p-4">
                    <div className="flex items-start justify-between gap-2">
                      <PersonCell
                        name={leaveFullName(row)}
                        sub={`Roll ${leaveRoll(row)}`}
                      />
                      <Badge tone={leaveTone(row.status)}>{leaveStatusLabel(row.status)}</Badge>
                    </div>
                    <dl className="mt-3 space-y-2 text-sm">
                      <div className="flex justify-between gap-3">
                        <dt className="text-gray-400">Dates</dt>
                        <dd className="text-gray-700">{formatLeaveDates(row.startDate, row.endDate)}</dd>
                      </div>
                      <div className="flex justify-between gap-3">
                        <dt className="text-gray-400">Reason</dt>
                        <dd className="text-right text-gray-700">{row.reason}</dd>
                      </div>
                    </dl>
                    {row.status === 'PENDING' && (
                      <div className="mt-3 flex gap-2">
                        <PrimaryButton
                          className="flex-1"
                          onClick={() => review(row.id, 'APPROVED')}
                        >
                          {reviewBusyId === row.id ? 'Saving...' : 'Approve'}
                        </PrimaryButton>
                        <button
                          type="button"
                          onClick={() => review(row.id, 'REJECTED')}
                          className="inline-flex h-10 flex-1 items-center justify-center rounded-lg border border-red-200 px-4 text-sm font-medium text-red-600 hover:bg-red-50"
                        >
                          Reject
                        </button>
                      </div>
                    )}
                  </Card>
                ))}
                {!studentLeave.length && (
                  <Card className="p-6 text-center">
                    <p className="text-sm text-gray-500">No student leave requests for your class.</p>
                  </Card>
                )}
              </div>

              <div className="mb-8 hidden md:block">
                <TableShell columns={['Student', 'Roll no.', 'Dates', 'Reason', 'Status', '']}>
                  {studentLeave.map((row) => (
                    <tr key={row.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3">
                        <PersonCell name={leaveFullName(row)} />
                      </td>
                      <td className="px-4 py-3 text-gray-500">{leaveRoll(row)}</td>
                      <td className="px-4 py-3 text-gray-500">
                        {formatLeaveDates(row.startDate, row.endDate)}
                      </td>
                      <td className="px-4 py-3 text-gray-500">{row.reason}</td>
                      <td className="px-4 py-3">
                        <Badge tone={leaveTone(row.status)}>{leaveStatusLabel(row.status)}</Badge>
                      </td>
                      <td className="px-2 py-3 text-right">
                        {row.status === 'PENDING' ? (
                          <div className="flex items-center justify-end gap-1">
                            <IconButton
                              label={`Approve leave for ${leaveFullName(row)}`}
                              onClick={() => review(row.id, 'APPROVED')}
                              className="text-green-600 hover:bg-green-50 hover:text-green-700"
                            >
                              <Check className="h-4 w-4" />
                            </IconButton>
                            <IconButton
                              label={`Reject leave for ${leaveFullName(row)}`}
                              onClick={() => review(row.id, 'REJECTED')}
                              className="text-red-600 hover:bg-red-50 hover:text-red-700"
                            >
                              <X className="h-4 w-4" />
                            </IconButton>
                          </div>
                        ) : null}
                      </td>
                    </tr>
                  ))}
                </TableShell>
                {!studentLeave.length && (
                  <Card className="mt-3 p-6 text-center">
                    <p className="text-sm text-gray-500">No student leave requests for your class.</p>
                  </Card>
                )}
              </div>
            </>
          )}

          <h2 className="mb-3 text-base font-semibold text-gray-900">My leave</h2>
          <div className="space-y-3 md:hidden">
            {myLeave.map((row) => (
              <Card key={row.id} className="p-4">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="font-medium text-gray-900">
                      {formatLeaveDates(row.startDate, row.endDate)}
                    </p>
                    <p className="mt-1 text-sm text-gray-500">{row.reason}</p>
                  </div>
                  <Badge tone={leaveTone(row.status)}>{leaveStatusLabel(row.status)}</Badge>
                </div>
                <dl className="mt-3 space-y-2 text-sm">
                  <div className="flex justify-between gap-3">
                    <dt className="text-gray-400">Applied on</dt>
                    <dd className="text-gray-700">{formatLeaveApplied(row.createdAt)}</dd>
                  </div>
                </dl>
              </Card>
            ))}
            {!myLeave.length && (
              <Card className="p-6 text-center">
                <p className="text-sm text-gray-500">You have not applied for leave yet.</p>
              </Card>
            )}
          </div>

          <div className="hidden md:block">
            <TableShell columns={['Dates', 'Reason', 'Applied on', 'Status']}>
              {myLeave.map((row) => (
                <tr key={row.id} className="hover:bg-gray-50">
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
            {!myLeave.length && (
              <Card className="mt-3 p-6 text-center">
                <p className="text-sm text-gray-500">You have not applied for leave yet.</p>
              </Card>
            )}
          </div>
        </>
      )}

      {modalOpen && (
        <Modal onClose={() => !busy && setModalOpen(false)} size="md">
          <div className="mb-3 flex items-start justify-between gap-3 sm:mb-4">
            <div>
              <h2 className="text-base font-semibold text-gray-900 sm:text-lg">Apply for leave</h2>
              <p className="mt-1 hidden text-sm text-gray-500 sm:block">
                Admin will review your leave request.
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
                className="mt-1.5 w-full resize-none rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-blue-600 focus:outline-none focus:ring-1 focus:ring-blue-600"
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
                  className="mt-1.5 h-10 w-full rounded-lg border border-gray-200 px-3 text-sm focus:border-blue-600 focus:outline-none focus:ring-1 focus:ring-blue-600"
                />
              </label>
              <label className="block text-sm text-gray-700">
                End date
                <input
                  required
                  type="date"
                  value={form.endDate}
                  onChange={(event) => setForm({ ...form, endDate: event.target.value })}
                  className="mt-1.5 h-10 w-full rounded-lg border border-gray-200 px-3 text-sm focus:border-blue-600 focus:outline-none focus:ring-1 focus:ring-blue-600"
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

function TimetablePage() {
  const { user } = useAuth();
  const assignedClasses = staffAssignedClasses(user?.staffProfile);
  const [periods, setPeriods] = useState<TimetablePeriodRow[]>([]);
  const [draft, setDraft] = useState<Record<string, string>>({});
  const [saved, setSaved] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [saveMessage, setSaveMessage] = useState('');
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [newStart, setNewStart] = useState('16:00');
  const [newEnd, setNewEnd] = useState('17:00');
  const [formError, setFormError] = useState('');

  const buildDraft = (rows: TimetablePeriodRow[]) => {
    const next: Record<string, string> = {};
    for (const period of rows) {
      for (const day of WEEK_DAYS) {
        next[`${period.id}:${day}`] = period.entriesByDay?.[day]?.schoolClassId ?? '';
      }
    }
    return next;
  };

  const load = async () => {
    setError('');
    try {
      const { data } = await api.get('/timetable/mine');
      const rows = (data.periods ?? []) as TimetablePeriodRow[];
      setPeriods(rows);
      const snapshot = buildDraft(rows);
      setDraft(snapshot);
      setSaved(snapshot);
      setSaveMessage('');
    } catch (err) {
      setError(apiErrorMessage(err, 'Could not load timetable.'));
      setPeriods([]);
      setDraft({});
      setSaved({});
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load().catch(console.error);
  }, []);

  const dirtyKeys = Object.keys(draft).filter((key) => (draft[key] ?? '') !== (saved[key] ?? ''));
  const isDirty = dirtyKeys.length > 0;

  const setCell = (periodId: string, day: WeekDay, schoolClassId: string) => {
    const key = `${periodId}:${day}`;
    setDraft((prev) => ({ ...prev, [key]: schoolClassId }));
    setSaveMessage('');
    setError('');
  };

  const saveTimetable = async () => {
    if (!isDirty) return;
    setSaving(true);
    setError('');
    setSaveMessage('');
    try {
      await Promise.all(
        dirtyKeys.map((key) => {
          const [periodId, dayOfWeek] = key.split(':');
          return api.put('/timetable/entries', {
            periodId,
            dayOfWeek,
            schoolClassId: draft[key] || null,
          });
        }),
      );
      await load();
      setSaveMessage('Timetable saved.');
    } catch (err) {
      setError(apiErrorMessage(err, 'Could not save timetable.'));
    } finally {
      setSaving(false);
    }
  };

  const discardChanges = () => {
    setDraft({ ...saved });
    setSaveMessage('');
    setError('');
  };

  const addPeriod = async (event: FormEvent) => {
    event.preventDefault();
    if (isDirty) {
      setFormError('Save or discard your class changes before adding a period.');
      return;
    }
    setFormError('');
    setBusyKey('add');
    try {
      await api.post('/timetable/periods', {
        startTime: newStart,
        endTime: newEnd,
      });
      setAddOpen(false);
      await load();
    } catch (err) {
      setFormError(apiErrorMessage(err, 'Could not add period.'));
    } finally {
      setBusyKey(null);
    }
  };

  const removePeriod = async (periodId: string) => {
    if (isDirty) {
      setError('Save or discard your class changes before removing a period.');
      return;
    }
    setBusyKey(`del:${periodId}`);
    setError('');
    try {
      await api.delete(`/timetable/periods/${periodId}`);
      await load();
    } catch (err) {
      setError(apiErrorMessage(err, 'Could not remove period.'));
    } finally {
      setBusyKey(null);
    }
  };

  return (
    <>
      <SectionHeader
        title="Timetable"
        subtitle="Assign classes for each day, then save your changes"
        action={
          <div className="flex flex-wrap items-center gap-2">
            {isDirty && (
              <button
                type="button"
                onClick={discardChanges}
                disabled={saving}
                className="inline-flex h-10 items-center justify-center rounded-lg border border-gray-200 px-3 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
              >
                Discard
              </button>
            )}
            <PrimaryButton
              onClick={() => {
                void saveTimetable();
              }}
              disabled={!isDirty || saving || loading}
            >
              {saving ? 'Saving...' : 'Save timetable'}
            </PrimaryButton>
            <button
              type="button"
              onClick={() => {
                setFormError('');
                setAddOpen(true);
              }}
              className="inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-gray-200 bg-white px-3 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              <Plus className="h-4 w-4" />
              Add period
            </button>
          </div>
        }
      />

      {!assignedClasses.length && (
        <Card className="mb-4 border border-amber-200 bg-amber-50 p-4">
          <p className="text-sm text-amber-800">
            Ask admin to assign teaching classes first — then you can place them in this grid.
          </p>
        </Card>
      )}

      {loading && <p className="text-sm text-gray-500">Loading timetable...</p>}
      {error && <p className="mb-4 text-sm text-red-600">{error}</p>}
      {saveMessage && <p className="mb-4 text-sm text-emerald-700">{saveMessage}</p>}
      {isDirty && !saving && (
        <p className="mb-3 text-sm text-amber-700">You have unsaved changes.</p>
      )}

      {!loading && (
        <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white">
          <table className="min-w-[720px] w-full border-collapse text-sm">
            <thead>
              <tr className="bg-gray-50 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
                <th className="sticky left-0 z-10 bg-gray-50 px-3 py-3">Time</th>
                {WEEK_DAYS.map((day) => (
                  <th key={day} className="px-2 py-3 text-center">
                    {WEEK_DAY_LABELS[day]}
                  </th>
                ))}
                <th className="px-2 py-3 text-right"> </th>
              </tr>
            </thead>
            <tbody>
              {periods.map((period) => (
                <tr key={period.id} className="border-t border-gray-100">
                  <td className="sticky left-0 z-10 bg-white px-3 py-2 font-medium text-gray-900 whitespace-nowrap">
                    {formatClockLabel(period.startTime)} – {formatClockLabel(period.endTime)}
                  </td>
                  {WEEK_DAYS.map((day) => {
                    const key = `${period.id}:${day}`;
                    const value = draft[key] ?? '';
                    const changed = value !== (saved[key] ?? '');
                    return (
                      <td key={day} className="px-1.5 py-2">
                        <select
                          value={value}
                          disabled={saving || !assignedClasses.length}
                          onChange={(event) => {
                            setCell(period.id, day, event.target.value);
                          }}
                          className={cn(
                            'h-9 w-full min-w-[5.5rem] rounded-lg border bg-white px-2 text-xs text-gray-800 focus:border-blue-600 focus:outline-none focus:ring-1 focus:ring-blue-600 disabled:bg-gray-50',
                            changed ? 'border-amber-400' : 'border-gray-200',
                          )}
                        >
                          <option value="">—</option>
                          {assignedClasses.map((item) => (
                            <option key={item.id} value={item.id}>
                              {formatClassLabel(item)}
                            </option>
                          ))}
                        </select>
                      </td>
                    );
                  })}
                  <td className="px-2 py-2 text-right">
                    <IconButton
                      label="Remove period"
                      onClick={() => {
                        if (saving || busyKey) return;
                        void removePeriod(period.id);
                      }}
                    >
                      <Trash2 className="h-4 w-4" />
                    </IconButton>
                  </td>
                </tr>
              ))}
              {!periods.length && (
                <tr>
                  <td colSpan={9} className="px-4 py-8 text-center text-sm text-gray-500">
                    No periods yet. Add a time slot to start building your week.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {!loading && periods.length > 0 && (
        <div className="mt-4 flex flex-wrap items-center justify-end gap-2">
          {isDirty && (
            <button
              type="button"
              onClick={discardChanges}
              disabled={saving}
              className="inline-flex h-10 items-center justify-center rounded-lg border border-gray-200 px-4 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
            >
              Discard
            </button>
          )}
          <PrimaryButton
            onClick={() => {
              void saveTimetable();
            }}
            disabled={!isDirty || saving}
          >
            {saving ? 'Saving...' : 'Save timetable'}
          </PrimaryButton>
        </div>
      )}

      {addOpen && (
        <Modal onClose={() => !busyKey && setAddOpen(false)}>
          <h2 className="text-lg font-semibold text-gray-900">Add timetable period</h2>
          <form onSubmit={addPeriod} className="mt-4 space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <label className="block text-sm text-gray-700">
                Start time
                <input
                  type="time"
                  required
                  value={newStart}
                  onChange={(event) => setNewStart(event.target.value)}
                  className="mt-1.5 h-10 w-full rounded-lg border border-gray-200 px-3 text-sm focus:border-blue-600 focus:outline-none focus:ring-1 focus:ring-blue-600"
                />
              </label>
              <label className="block text-sm text-gray-700">
                End time
                <input
                  type="time"
                  required
                  value={newEnd}
                  onChange={(event) => setNewEnd(event.target.value)}
                  className="mt-1.5 h-10 w-full rounded-lg border border-gray-200 px-3 text-sm focus:border-blue-600 focus:outline-none focus:ring-1 focus:ring-blue-600"
                />
              </label>
            </div>
            {formError && <p className="text-sm text-red-600">{formError}</p>}
            <div className="flex justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={() => !busyKey && setAddOpen(false)}
                className="inline-flex h-10 items-center justify-center rounded-lg border border-gray-200 px-4 text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                Cancel
              </button>
              <PrimaryButton type="submit" disabled={busyKey === 'add'}>
                {busyKey === 'add' ? 'Adding...' : 'Add period'}
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
      subtitle="Parents, staff, and school office"
      variant="staff"
      onUnreadChange={onUnreadChange}
    />
  );
}

function AnnouncementsPage() {
  const [posts, setPosts] = useState<FeedPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

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
      <SectionHeader title="Announcements" subtitle="School notices and staff updates" />
      {loading && <p className="text-sm text-gray-500">Loading announcements...</p>}
      {error && <p className="mb-4 text-sm text-red-600">{error}</p>}
      {!loading && !error && (
        <div className="space-y-3">
          {posts.map((item) => {
            const author = `${item.author?.firstName ?? ''} ${item.author?.lastName ?? ''}`.trim();
            const mediaSrc = mediaUrl(item.fileUrl);
            return (
              <Card key={item.id} className="p-4 md:p-5">
                <div className="min-w-0">
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
                </div>
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

const PAGES = {
  dashboard: DashboardPage,
  students: StudentsPage,
  attendance: AttendancePage,
  grades: GradesPage,
  assignments: AssignmentsPage,
  timetable: TimetablePage,
  leave: LeavePage,
  announcements: AnnouncementsPage,
};

function StaffPage({
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
    <span className="ml-auto inline-flex min-w-[1.15rem] items-center justify-center rounded-full bg-rose-500 px-1.5 py-0.5 text-[10px] font-semibold leading-none text-white">
      {label}
    </span>
  );
}

export default function StaffPortal() {
  const { user, logout } = useAuth();
  const [page, setPage] = useState<PageId>('dashboard');
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [unread, setUnread] = useState<UnreadCounts>({
    announcements: 0,
    assignments: 0,
    messages: 0,
  });

  const displayName = user ? `${user.firstName} ${user.lastName}` : TEACHER.name;
  const displayRole =
    user?.staffProfile?.subject
      ? `${user.staffProfile.subject} Teacher`
      : user?.role === 'STAFF'
        ? 'Staff'
        : TEACHER.role;
  const isClassTeacher = isStaffClassTeacher(user?.staffProfile);
  const navItems = NAV_ITEMS.filter(
    (item) => item.id !== 'attendance' || isClassTeacher,
  );

  const goTo = (id: PageId) => {
    setPage(id);
    setDrawerOpen(false);
  };

  useEffect(() => {
    if (page === 'attendance' && !isClassTeacher) {
      setPage('dashboard');
    }
  }, [page, isClassTeacher]);

  useEffect(() => {
    return startPortalNotifications({
      includeAssignments: false,
      onCounts: setUnread,
    });
  }, []);

  const unreadFor = (id: PageId) => {
    if (id === 'announcements') return unread.announcements;
    if (id === 'messages') return unread.messages;
    return 0;
  };

  const totalUnread = unread.announcements + unread.messages;

  return (
    <div className="flex h-dvh overflow-hidden bg-gray-50 font-sans text-gray-900">
      {drawerOpen && (
        <button
          type="button"
          aria-label="Close menu"
          className="fixed inset-0 z-30 bg-black/40 md:hidden"
          onClick={() => setDrawerOpen(false)}
        />
      )}

      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-40 flex w-64 flex-col border-r border-gray-200 bg-white transition-transform duration-200 ease-out md:static md:w-60 md:translate-x-0',
          drawerOpen ? 'translate-x-0' : '-translate-x-full',
        )}
      >
        <div className="flex h-16 items-center gap-3 border-b border-gray-200 px-4">
          <span className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-blue-600 text-sm font-bold text-white">
            G
          </span>
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-gray-900">Greenfield</p>
            <p className="text-xs text-gray-400">Staff Portal</p>
          </div>
        </div>
        <nav className="flex-1 space-y-0.5 overflow-y-auto px-3 py-3">
          {navItems.map((item) => {
            const Icon = item.icon;
            const active = page === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => goTo(item.id)}
                className={cn(
                  'flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-colors',
                  active
                    ? 'bg-blue-50 font-medium text-blue-700'
                    : 'text-gray-500 hover:bg-gray-50 hover:text-gray-700',
                )}
              >
                <Icon className="h-[18px] w-[18px] shrink-0" />
                <span className="min-w-0 flex-1 text-left">{item.label}</span>
                <NavCount count={unreadFor(item.id)} />
              </button>
            );
          })}
        </nav>
        <div className="border-t border-gray-200 px-3 py-3">
          <div className="flex items-center gap-3">
            <Avatar name={displayName} />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-gray-900">{displayName}</p>
              <p className="truncate text-xs text-gray-400">{displayRole}</p>
            </div>
            <IconButton label="Sign out" onClick={logout}>
              <LogOut className="h-4 w-4" />
            </IconButton>
          </div>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-16 shrink-0 items-center justify-between gap-2 border-b border-gray-200 bg-white px-3 md:gap-4 md:px-8">
          <div className="flex min-w-0 items-center gap-1 md:gap-0">
            <IconButton label="Open menu" onClick={() => setDrawerOpen(true)} className="md:hidden">
              <Menu className="h-5 w-5" />
            </IconButton>
            <p className="truncate text-sm font-medium text-gray-900 md:hidden">{PAGE_LABELS[page]}</p>
            <p className="hidden text-sm text-gray-400 md:block">
              Staff / <span className="text-gray-900">{PAGE_LABELS[page]}</span>
            </p>
          </div>
          <div className="flex items-center gap-2 md:gap-4">
            <NotificationBell
              tone="staff"
              totalUnread={totalUnread}
              announcements={unread.announcements}
              messages={unread.messages}
              onOpenAnnouncements={() => goTo('announcements')}
              onOpenMessages={() => goTo('messages')}
            />
            <Avatar name={displayName} size="sm" />
          </div>
        </header>

        <main className="flex-1 overflow-y-auto px-4 py-5 md:px-8 md:py-7">
          {page === 'dashboard' ? (
            <DashboardPage
              teacherName={displayName}
              onViewAssignments={() => goTo('assignments')}
              onViewTimetable={() => goTo('timetable')}
            />
          ) : (
            <StaffPage
              page={page}
              onMessageUnreadChange={(count) =>
                setUnread((prev) => ({ ...prev, messages: count }))
              }
            />
          )}
        </main>
      </div>
    </div>
  );
}
