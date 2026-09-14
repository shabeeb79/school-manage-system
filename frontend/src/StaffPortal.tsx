import {
  Bell,
  BookOpen,
  CalendarOff,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ClipboardCheck,
  GraduationCap,
  LayoutDashboard,
  LogOut,
  MapPin,
  Megaphone,
  Menu,
  MessageSquare,
  Paperclip,
  Pencil,
  Plus,
  Search,
  Send,
  Users,
  X,
} from 'lucide-react';
import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { useAuth } from './auth/AuthContext';
import api from './api/client';
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
import { teachingSubjectLabel } from './lib/subjects';
import {
  Avatar,
  Badge,
  Card,
  IconButton,
  Modal,
  OverflowMenu,
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
  { id: 'leave', label: 'Leave', icon: CalendarOff },
  { id: 'messages', label: 'Messages', icon: MessageSquare },
  { id: 'announcements', label: 'Announcements', icon: Megaphone },
];

const SCHEDULE = [
  { id: 'p1', time: '08:30 – 09:15', subject: 'English', section: 'Grade 9 - A', room: 'Room 14', current: false },
  { id: 'p2', time: '09:20 – 10:05', subject: 'English', section: 'Grade 8 - B', room: 'Room 11', current: false },
  { id: 'p3', time: '11:00 – 11:45', subject: 'English', section: 'Grade 9 - A', room: 'Room 14', current: true },
  { id: 'p4', time: '13:10 – 13:55', subject: 'English', section: 'Grade 10 - A', room: 'Room 05', current: false },
];

const NEEDS_GRADING = [
  { title: 'Macbeth scene analysis', className: 'Grade 10 - A', done: 31, total: 40 },
  { title: 'Letter to the editor', className: 'Grade 9 - A', done: 28, total: 36 },
  { title: 'Unseen passage worksheet', className: 'Grade 9 - A', done: 12, total: 36 },
  { title: 'Poetry comprehension', className: 'Grade 8 - B', done: 18, total: 34 },
];

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
  if (audience === 'ALL') return 'blue';
  if (audience === 'STAFF' || audience === 'ADMIN') return 'slate';
  if (audience === 'STUDENT') return 'green';
  return 'amber';
}

type ChatMessage = { id: string; from: 'in' | 'out'; text: string; time: string };
type Thread = {
  id: string;
  name: string;
  context: string;
  preview: string;
  time: string;
  unread: boolean;
  messages: ChatMessage[];
};

const INITIAL_THREADS: Thread[] = [
  {
    id: 't1',
    name: 'Meera Krishnan',
    context: 'Parent · Rahul Varma · Grade 9 - A',
    preview: 'Thank you, I’ll remind him tonight.',
    time: '10:41 AM',
    unread: true,
    messages: [
      {
        id: 'm1',
        from: 'in',
        text: 'Good morning. Rahul mentioned he is unsure about the letter format for Monday’s assignment.',
        time: '10:12 AM',
      },
      {
        id: 'm2',
        from: 'out',
        text: 'He can follow the sample on page 42. I’ll also recap the format in class today.',
        time: '10:28 AM',
      },
      { id: 'm3', from: 'in', text: 'Thank you, I’ll remind him tonight.', time: '10:41 AM' },
    ],
  },
  {
    id: 't2',
    name: 'Divya Menon',
    context: 'Administrator',
    preview: 'Please share Grade 9 PTM talking points by Thursday.',
    time: '9:05 AM',
    unread: true,
    messages: [
      {
        id: 'm4',
        from: 'in',
        text: 'Please share Grade 9 PTM talking points by Thursday. Keep it to two slides.',
        time: '9:05 AM',
      },
    ],
  },
  {
    id: 't3',
    name: 'Suresh Pillai',
    context: 'Science · Grade 9 - A',
    preview: 'Can we swap the Thursday lab with your English slot?',
    time: 'Yesterday',
    unread: false,
    messages: [
      {
        id: 'm5',
        from: 'in',
        text: 'Can we swap the Thursday lab with your English slot? The chemicals only arrive in the morning.',
        time: 'Yesterday',
      },
      { id: 'm6', from: 'out', text: 'Yes — I’ll take 9-A in the afternoon period.', time: 'Yesterday' },
    ],
  },
  {
    id: 't4',
    name: 'Aisha Ali',
    context: 'Parent · Farhan Ali · Grade 8 - B',
    preview: 'Farhan has extra reading support this week.',
    time: 'Mon',
    unread: false,
    messages: [
      {
        id: 'm7',
        from: 'out',
        text: 'Farhan has extra reading support this week. A short passage each evening will help.',
        time: 'Mon',
      },
      { id: 'm8', from: 'in', text: 'We’ll do that. Thank you, Kavya.', time: 'Mon' },
    ],
  },
];

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
}: {
  teacherName: string;
  onViewAssignments: () => void;
}) {
  const [attendanceValue, setAttendanceValue] = useState('—');
  const [attendanceSub, setAttendanceSub] = useState('Loading today...');
  const [studentCount, setStudentCount] = useState('—');

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const today = todayInputValue();
        const [studentsRes, attendanceRes] = await Promise.all([
          api.get('/users/my-students'),
          api.get('/attendance', { params: { date: today } }),
        ]);
        if (!active) return;
        const students = studentsRes.data as unknown[];
        const records = attendanceRes.data as Array<{ status: string }>;
        setStudentCount(String(students.length));
        if (!students.length) {
          setAttendanceValue('0 / 0');
          setAttendanceSub('No students in class');
          return;
        }
        setAttendanceValue(`${records.length} / ${students.length}`);
        setAttendanceSub(
          records.length === students.length
            ? 'Today complete'
            : 'Mark remaining students today',
        );
      } catch {
        if (active) {
          setAttendanceValue('—');
          setAttendanceSub('Could not load attendance');
        }
      }
    })().catch(console.error);
    return () => {
      active = false;
    };
  }, []);

  return (
    <>
      <SectionHeader
        title={`Good morning, ${teacherName}`}
        subtitle={`${TEACHER.department} · ${formatDayLabel(todayInputValue())}`}
      />
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4 lg:gap-4">
        <StatCard label="Classes today" value="4" subtext="3 remaining after this period" icon={<BookOpen className="h-4 w-4" />} />
        <StatCard label="Total students" value={studentCount} subtext="In your assigned class" icon={<Users className="h-4 w-4" />} />
        <StatCard label="Pending grading" value="18" subtext="4 assignments open" icon={<GraduationCap className="h-4 w-4" />} />
        <StatCard label="Attendance marked" value={attendanceValue} subtext={attendanceSub} icon={<ClipboardCheck className="h-4 w-4" />} />
      </div>
      <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card className="p-4 md:p-5 lg:col-span-2">
          <h2 className="font-semibold text-gray-900">Today's schedule</h2>
          <ul className="mt-4 space-y-2">
            {SCHEDULE.map((slot) => (
              <li
                key={slot.id}
                className={cn(
                  'flex flex-col gap-2 rounded-xl px-3 py-3 sm:flex-row sm:items-center sm:justify-between',
                  slot.current ? 'bg-blue-50' : 'hover:bg-gray-50',
                )}
              >
                <div className="min-w-0">
                  <p className="text-xs font-medium text-gray-400">{slot.time}</p>
                  <p className="mt-1 text-sm font-medium text-gray-900">
                    {slot.subject} · {slot.section}
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="inline-flex items-center gap-1 text-sm text-gray-500">
                    <MapPin className="h-3.5 w-3.5 text-gray-400" />
                    {slot.room}
                  </span>
                  {slot.current && <Badge tone="blue">Now</Badge>}
                </div>
              </li>
            ))}
          </ul>
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
          <ul className="mt-4 space-y-4">
            {NEEDS_GRADING.map((item) => (
              <li key={item.title}>
                <p className="text-sm font-medium text-gray-900">{item.title}</p>
                <p className="mt-0.5 text-xs text-gray-400">{item.className}</p>
                <p className="mt-1 text-sm text-gray-500">
                  {item.done} / {item.total} submitted
                </p>
              </li>
            ))}
          </ul>
        </Card>
      </div>
    </>
  );
}

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
};

function studentFullName(student: ApiStudent) {
  return `${student.user?.firstName ?? ''} ${student.user?.lastName ?? ''}`.trim() || 'Student';
}

function StudentFormModal({
  mode,
  form,
  busy,
  error,
  onChange,
  onClose,
  onSubmit,
}: {
  mode: 'add' | 'edit';
  form: StudentFormState;
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
              ? 'Creates a student account in your assigned class.'
              : 'Update student details for your class.'}
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
  const [query, setQuery] = useState('');
  const [students, setStudents] = useState<ApiStudent[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [modal, setModal] = useState<'add' | 'edit' | null>(null);
  const [editingUserId, setEditingUserId] = useState<string | null>(null);
  const [form, setForm] = useState<StudentFormState>(EMPTY_STUDENT_FORM);
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState('');

  const load = async () => {
    setLoadError('');
    try {
      const { data } = await api.get('/users/my-students');
      setStudents(data);
    } catch {
      setLoadError('Could not load students. Check that you are signed in as staff.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load().catch(console.error);
  }, []);

  const filtered = students.filter((student) => {
    const name = studentFullName(student).toLowerCase();
    const roll = (student.studentId || '').toLowerCase();
    const email = (student.user?.email || '').toLowerCase();
    const q = query.toLowerCase();
    return !q || name.includes(q) || roll.includes(q) || email.includes(q);
  });

  const className = students[0]?.schoolClass?.name;

  const openAdd = () => {
    setModal('add');
    setEditingUserId(null);
    setForm(EMPTY_STUDENT_FORM);
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
        await api.post('/users/students', {
          firstName: form.firstName,
          lastName: form.lastName,
          email: form.email,
          password: form.password,
          studentId: form.studentId,
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
          className
            ? `Students in your assigned class · ${className}`
            : 'Students in your assigned class'
        }
        action={
          <PrimaryButton icon={<Plus className="h-4 w-4" />} onClick={openAdd}>
            Add student
          </PrimaryButton>
        }
      />

      <div className="mb-4">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search by name, roll no., or email"
            className="h-10 w-full rounded-lg border border-gray-200 bg-white py-2 pl-9 pr-3 text-sm text-gray-900 placeholder:text-gray-400 focus:border-blue-600 focus:outline-none focus:ring-1 focus:ring-blue-600"
          />
        </div>
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
                    <dd className="text-gray-700">{student.schoolClass?.name ?? '—'}</dd>
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
                  <td className="px-4 py-3 text-gray-500">{student.schoolClass?.name ?? '—'}</td>
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
  const [date, setDate] = useState(todayInputValue);
  const [students, setStudents] = useState<ApiStudent[]>([]);
  const [marks, setMarks] = useState<Record<string, Mark>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);
  const [savedCount, setSavedCount] = useState(0);

  const classLabel = (() => {
    const schoolClass = students[0]?.schoolClass;
    if (!schoolClass?.name) return 'Your class';
    const section = schoolClass.section?.trim();
    return section ? `${schoolClass.name} - ${section}` : schoolClass.name;
  })();

  const load = async () => {
    setError('');
    try {
      const [studentsRes, attendanceRes] = await Promise.all([
        api.get('/users/my-students'),
        api.get('/attendance', { params: { date } }),
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
  }, [date]);

  const setMark = (userId: string, mark: Mark) => {
    setSaved(false);
    setMarks((current) => ({ ...current, [userId]: mark }));
  };

  const save = async () => {
    if (!students.length) return;
    setSaving(true);
    setError('');
    setSaved(false);
    try {
      const schoolClassId =
        user?.staffProfile?.assignedClassId ||
        students[0]?.schoolClassId ||
        students[0]?.schoolClass?.id ||
        undefined;
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
        schoolClassId,
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
        subtitle={`${classLabel} · ${formatDayLabel(date)}`}
        action={
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

      {!loading && !error && (
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
  const [data, setData] = useState<{
    subject: string;
    examName: string;
    maxScore: number;
    expectedSubjects: string[];
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

  const load = async () => {
    setError('');
    try {
      const { data: payload } = await api.get('/grades/my-class');
      setData(payload);
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
          'Could not load class grades. Assign a class and subject to this teacher.',
        ),
      );
      setData(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load().catch(console.error);
  }, []);

  const subjectLabel = teachingSubjectLabel(data?.subject ?? user?.staffProfile?.subject);
  const classLabel = data?.schoolClass?.label ?? 'Your class';

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
      await load();
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
        subtitle={`${subjectLabel} marks · ${classLabel}`}
      />

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
              <p className="text-sm text-gray-500">No students in your assigned class yet.</p>
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
  schoolClass?: { id: string; name: string } | null;
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
  const [assignments, setAssignments] = useState<StaffAssignment[]>([]);
  const [classStudents, setClassStudents] = useState<ApiStudent[]>([]);
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
  const [createForm, setCreateForm] = useState({
    title: '',
    description: '',
    subject: 'English',
    dueDate: '',
    maxScore: '100',
  });

  const load = async () => {
    setError('');
    try {
      const [assignmentsRes, studentsRes] = await Promise.all([
        api.get('/assignments'),
        api.get('/users/my-students'),
      ]);
      setAssignments(assignmentsRes.data);
      setClassStudents(studentsRes.data);
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
    const schoolClassId = user?.staffProfile?.assignedClassId;
    if (!schoolClassId) {
      setCreateError('No assigned class found for your staff account.');
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
        schoolClassId,
        maxScore: Number(createForm.maxScore) || 100,
      });
      setShowCreate(false);
      setCreateForm({
        title: '',
        description: '',
        subject: 'English',
        dueDate: '',
        maxScore: '100',
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
          subtitle={`${selected.subject} · Due ${formatDue(selected.dueDate)} · ${selected.schoolClass?.name ?? 'Class'}`}
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
        subtitle="Review photo and video submissions from your class"
        action={
          <PrimaryButton icon={<Plus className="h-4 w-4" />} onClick={() => setShowCreate(true)}>
            New assignment
          </PrimaryButton>
        }
      />
      {loading && <p className="text-sm text-gray-500">Loading assignments...</p>}
      {error && <p className="mb-4 text-sm text-red-600">{error}</p>}

      <div className="space-y-3">
        {assignments.map((item) => {
          const done = item._count?.submissions ?? item.submissions?.length ?? 0;
          const total = classStudents.length || done;
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
                  {item.subject} · {item.schoolClass?.name ?? 'Class'} · Due {formatDue(item.dueDate)}
                </p>
              </div>
              <Badge tone={done >= total && total > 0 ? 'green' : 'blue'}>
                {done} / {total || '—'}
              </Badge>
              <ChevronRight className="mt-1 h-4 w-4 shrink-0 text-gray-400" />
            </button>
          );
        })}
        {!loading && !assignments.length && (
          <Card className="p-6 text-center text-sm text-gray-500">
            No assignments yet. Create one for your assigned class.
          </Card>
        )}
      </div>

      {showCreate && (
        <Modal onClose={() => setShowCreate(false)} size="md">
          <div className="mb-3 flex items-start justify-between sm:mb-4">
            <h2 className="text-base font-semibold text-gray-900 sm:text-lg">New assignment</h2>
            <IconButton label="Close" onClick={() => setShowCreate(false)} className="shrink-0">
              <X className="h-4 w-4" />
            </IconButton>
          </div>
          <form onSubmit={createAssignment} className="space-y-2 sm:space-y-3">
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
  const studentLeave = items.filter((item) => item.requester?.role === 'STUDENT');
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
        subtitle="Apply for your leave and review student requests from your class"
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
          ? { ...thread, preview: text, time: 'Just now', unread: false, messages: [...thread.messages, message] }
          : thread,
      ),
    );
    setDraft('');
  };

  return (
    <>
      <SectionHeader title="Messages" subtitle="Parents, staff, and school office" />
      <Card className="flex h-[calc(100dvh-11.5rem)] overflow-hidden md:h-[480px]">
        <div
          className={cn(
            'w-full shrink-0 flex-col border-gray-200 md:flex md:w-72 md:border-r',
            mobileShowChat ? 'hidden md:flex' : 'flex',
          )}
        >
          <div className="border-b border-gray-200 p-3">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
              <input
                value={threadQuery}
                onChange={(event) => setThreadQuery(event.target.value)}
                placeholder="Search conversations"
                className="h-10 w-full rounded-lg border border-gray-200 bg-gray-50 py-2 pl-9 pr-3 text-sm placeholder:text-gray-400 focus:border-blue-600 focus:bg-white focus:outline-none focus:ring-1 focus:ring-blue-600"
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
                    'flex w-full items-start gap-3 px-3 py-3 text-left hover:bg-gray-50',
                    thread.id === active.id && 'bg-blue-50 hover:bg-blue-50',
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
          <div className="flex items-center gap-2 border-b border-gray-200 px-3 py-3 md:px-4">
            <IconButton label="Back to conversations" onClick={() => setMobileShowChat(false)} className="md:hidden">
              <ChevronLeft className="h-5 w-5" />
            </IconButton>
            <Avatar name={active.name} />
            <div className="min-w-0">
              <p className="truncate font-semibold text-gray-900">{active.name}</p>
              <p className="truncate text-xs text-gray-400">{active.context}</p>
            </div>
          </div>
          <div className="flex-1 space-y-3 overflow-y-auto bg-gray-50 px-3 py-4 md:px-4">
            {active.messages.map((message) => (
              <div key={message.id} className={cn('flex', message.from === 'out' ? 'justify-end' : 'justify-start')}>
                <div
                  className={cn(
                    'max-w-[80%] px-3 py-2 text-sm',
                    message.from === 'out'
                      ? 'rounded-2xl rounded-br-md bg-blue-600 text-white'
                      : 'rounded-2xl rounded-bl-md border border-gray-200 bg-white text-gray-900',
                  )}
                >
                  <p>{message.text}</p>
                  <p className={cn('mt-1 text-[11px]', message.from === 'out' ? 'text-blue-100' : 'text-gray-400')}>
                    {message.time}
                  </p>
                </div>
              </div>
            ))}
          </div>
          <form
            className="flex items-center gap-1 border-t border-gray-200 p-2 md:gap-2 md:p-3"
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
              className="h-10 min-w-0 flex-1 rounded-lg border border-gray-200 bg-white px-3 text-sm placeholder:text-gray-400 focus:border-blue-600 focus:outline-none focus:ring-1 focus:ring-blue-600"
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
  leave: LeavePage,
  messages: MessagesPage,
  announcements: AnnouncementsPage,
};

function StaffPage({ page }: { page: Exclude<PageId, 'dashboard'> }) {
  const Page = PAGES[page];
  return <Page />;
}

export default function StaffPortal() {
  const { user, logout } = useAuth();
  const [page, setPage] = useState<PageId>('dashboard');
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [searchExpanded, setSearchExpanded] = useState(false);

  const displayName = user ? `${user.firstName} ${user.lastName}` : TEACHER.name;
  const displayRole =
    user?.staffProfile?.subject
      ? `${user.staffProfile.subject} Teacher`
      : user?.role === 'STAFF'
        ? 'Staff'
        : TEACHER.role;

  const goTo = (id: PageId) => {
    setPage(id);
    setDrawerOpen(false);
    setSearchExpanded(false);
  };

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
          {NAV_ITEMS.map((item) => {
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
                {item.label}
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
          {searchExpanded ? (
            <div className="flex w-full items-center gap-2 md:hidden">
              <div className="relative flex-1">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                <input
                  autoFocus
                  placeholder="Search students, classes"
                  className="h-10 w-full rounded-lg border border-gray-200 bg-gray-50 py-2 pl-9 pr-3 text-sm placeholder:text-gray-400 focus:border-blue-600 focus:bg-white focus:outline-none focus:ring-1 focus:ring-blue-600"
                />
              </div>
              <IconButton label="Close search" onClick={() => setSearchExpanded(false)}>
                <X className="h-4 w-4" />
              </IconButton>
            </div>
          ) : (
            <>
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
                <IconButton label="Search" onClick={() => setSearchExpanded(true)} className="md:hidden">
                  <Search className="h-4 w-4" />
                </IconButton>
                <div className="relative hidden md:block">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                  <input
                    placeholder="Search students, classes"
                    className="h-9 w-64 rounded-lg border border-gray-200 bg-gray-50 py-2 pl-9 pr-3 text-sm placeholder:text-gray-400 focus:border-blue-600 focus:bg-white focus:outline-none focus:ring-1 focus:ring-blue-600"
                  />
                </div>
                <button
                  type="button"
                  aria-label="Notifications"
                  className="relative inline-flex h-10 w-10 items-center justify-center rounded-lg text-gray-400 hover:bg-gray-50 hover:text-gray-700"
                >
                  <Bell className="h-4 w-4" />
                  <span className="absolute right-2.5 top-2.5 h-2 w-2 rounded-full bg-red-500" />
                </button>
                <Avatar name={displayName} size="sm" />
              </div>
            </>
          )}
        </header>

        <main className="flex-1 overflow-y-auto px-4 py-5 md:px-8 md:py-7">
          {page === 'dashboard' ? (
            <DashboardPage teacherName={displayName} onViewAssignments={() => goTo('assignments')} />
          ) : (
            <StaffPage page={page} />
          )}
        </main>
      </div>
    </div>
  );
}
