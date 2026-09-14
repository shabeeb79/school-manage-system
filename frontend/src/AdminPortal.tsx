import {
  Bell,
  CalendarOff,
  Check,
  ChevronDown,
  ChevronLeft,
  ClipboardCheck,
  GraduationCap,
  Image,
  LayoutDashboard,
  Megaphone,
  Menu,
  MessageSquare,
  LogOut,
  Paperclip,
  Pencil,
  Plus,
  School,
  Search,
  Send,
  Trash2,
  Users,
  Video,
  X,
} from 'lucide-react';
import { useEffect, useMemo, useState, type FormEvent, type ReactNode } from 'react';
import { useAuth } from './auth/AuthContext';
import api from './api/client';
import {
  apiErrorMessage,
  formatLeaveDates,
  leaveClassName,
  leaveFullName,
  leaveRoll,
  leaveStatusLabel,
  type ApiLeave,
} from './lib/leave';
import {
  TEACHING_SUBJECTS,
  TEACHING_SUBJECT_LABELS,
  type TeachingSubject,
} from './lib/subjects';
import { MAX_MEDIA_BYTES, mediaUrl } from './lib/media';
import {
  Avatar,
  Badge,
  Card,
  ConfirmModal,
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
  | 'posts'
  | 'users'
  | 'classes'
  | 'attendance'
  | 'grades'
  | 'leave'
  | 'messages';

const PAGE_LABELS: Record<PageId, string> = {
  dashboard: 'Dashboard',
  posts: 'Posts',
  users: 'Users',
  classes: 'Classes',
  attendance: 'Attendance',
  grades: 'Grades',
  leave: 'Leave',
  messages: 'Messages',
};

const NAV_ITEMS: { id: PageId; label: string; icon: typeof LayoutDashboard }[] = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { id: 'posts', label: 'Posts', icon: Megaphone },
  { id: 'users', label: 'Users', icon: Users },
  { id: 'classes', label: 'Classes', icon: School },
  { id: 'attendance', label: 'Attendance', icon: ClipboardCheck },
  { id: 'grades', label: 'Grades', icon: GraduationCap },
  { id: 'leave', label: 'Leave', icon: CalendarOff },
  { id: 'messages', label: 'Messages', icon: MessageSquare },
];

function roleTone(role: string): BadgeTone {
  if (role === 'Admin' || role === 'ADMIN') return 'blue';
  if (role === 'Teacher' || role === 'STAFF') return 'slate';
  if (role === 'Student' || role === 'STUDENT') return 'green';
  return 'amber';
}

function displayRole(role: string) {
  if (role === 'ADMIN') return 'Admin';
  if (role === 'STAFF') return 'Teacher';
  if (role === 'STUDENT') return 'Student';
  return role;
}

type SchoolClassOption = { id: string; name: string; section?: string | null };

function formatClassLabel(name: string, section?: string | null) {
  const sec = section?.trim();
  return sec ? `${name} - ${sec}` : name;
}

type ApiUser = {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: 'ADMIN' | 'STAFF' | 'STUDENT';
  isActive: boolean;
  createdAt?: string;
  studentProfile?: {
    studentId: string;
    enrollmentDate?: string | null;
    schoolClassId?: string | null;
    schoolClass?: { id: string; name: string; section?: string | null } | null;
  } | null;
  staffProfile?: {
    employeeId: string;
    subject?: string | null;
    assignedClassId?: string | null;
    assignedClass?: { id: string; name: string; section?: string | null } | null;
  } | null;
};

type UserFormRole = 'ADMIN' | 'STAFF' | 'STUDENT';

type UserFormState = {
  role: UserFormRole;
  firstName: string;
  lastName: string;
  email: string;
  password: string;
  studentId: string;
  schoolClassId: string;
  enrollmentDate: string;
  teacherName: string;
  employeeId: string;
  subject: string;
  assignedClassId: string;
};

const EMPTY_USER_FORM: UserFormState = {
  role: 'STUDENT',
  firstName: '',
  lastName: '',
  email: '',
  password: '',
  studentId: '',
  schoolClassId: '',
  enrollmentDate: '',
  teacherName: '',
  employeeId: '',
  subject: '',
  assignedClassId: '',
};

function toDateInput(value?: string | null) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toISOString().slice(0, 10);
}

function splitTeacherName(fullName: string) {
  const parts = fullName.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return { firstName: '', lastName: '' };
  if (parts.length === 1) return { firstName: parts[0], lastName: '' };
  return { firstName: parts[0], lastName: parts.slice(1).join(' ') };
}

const ACTIVITY = [
  { name: 'Kavya Menon', action: 'marked attendance for Grade 8 - A', time: '12 min ago' },
  { name: 'Suresh Pillai', action: 'published “Science practical schedule”', time: '1 hr ago' },
  { name: 'Fathima Beevi', action: 'entered English grades for Grade 10 - A', time: '2 hr ago' },
  { name: 'Rahul Varma', action: 'submitted Climate change essay', time: '3 hr ago' },
  { name: 'Divya Menon', action: 'approved leave for Arjun Nair', time: '5 hr ago' },
];

type ChatMessage = { id: string; from: 'in' | 'out'; text: string; time: string };
type Thread = {
  id: string;
  name: string;
  role: string;
  preview: string;
  time: string;
  unread: boolean;
  messages: ChatMessage[];
};

const INITIAL_THREADS: Thread[] = [
  {
    id: 't1',
    name: 'Kavya Menon',
    role: 'Teacher · Grade 8 - A',
    preview: 'Perfect, thank you.',
    time: '10:24 AM',
    unread: true,
    messages: [
      {
        id: 'm1',
        from: 'in',
        text: 'Good morning. Could we move the Grade 8 PTM to Friday afternoon? Several parents have asked.',
        time: '10:02 AM',
      },
      {
        id: 'm2',
        from: 'out',
        text: 'Friday 2:30 PM should work. I’ll send a note on the feed.',
        time: '10:18 AM',
      },
      { id: 'm3', from: 'in', text: 'Perfect, thank you.', time: '10:24 AM' },
    ],
  },
  {
    id: 't2',
    name: 'Suresh Pillai',
    role: 'Teacher · Grade 9 - B',
    preview: 'Grade 9-B science lab is booked for Thursday.',
    time: '9:15 AM',
    unread: true,
    messages: [
      {
        id: 'm4',
        from: 'in',
        text: 'Grade 9-B science lab is booked for Thursday. Sharing the slot list shortly.',
        time: '9:15 AM',
      },
    ],
  },
  {
    id: 't3',
    name: 'Meera Krishnan',
    role: 'Parent · Rahul Varma',
    preview: 'Rahul will be late tomorrow — dentist visit.',
    time: 'Yesterday',
    unread: false,
    messages: [
      {
        id: 'm5',
        from: 'in',
        text: 'Rahul will be late tomorrow — dentist visit. He should reach by second period.',
        time: 'Yesterday',
      },
      { id: 'm6', from: 'out', text: 'Noted, Meera. I’ll inform Kavya.', time: 'Yesterday' },
    ],
  },
  {
    id: 't4',
    name: 'Fathima Beevi',
    role: 'Teacher · Grade 10 - A',
    preview: 'Leave request attached for 25–26 Sep.',
    time: 'Yesterday',
    unread: false,
    messages: [
      {
        id: 'm7',
        from: 'in',
        text: 'Leave request attached for 25–26 Sep. Cover period notes are with Priya.',
        time: 'Yesterday',
      },
    ],
  },
  {
    id: 't5',
    name: 'Ananya Iyer',
    role: 'Parent',
    preview: 'Could you share the Term 2 fee receipt?',
    time: 'Mon',
    unread: false,
    messages: [
      {
        id: 'm8',
        from: 'in',
        text: 'Could you share the Term 2 fee receipt? The office copy hasn’t reached us yet.',
        time: 'Mon',
      },
    ],
  },
];

function DashboardPage() {
  const [todayPct, setTodayPct] = useState('—');
  const [todaySub, setTodaySub] = useState('Loading...');
  const [weekly, setWeekly] = useState<Array<{ day: string; value: number }>>([]);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const today = todayInputValue();
        const [todayRes, usersRes] = await Promise.all([
          api.get('/attendance', { params: { date: today } }),
          api.get('/users', { params: { role: 'STUDENT' } }),
        ]);
        if (!active) return;
        const records = todayRes.data as Array<{ status: string }>;
        const studentCount = (usersRes.data as unknown[]).length;
        const present = records.filter((r) => r.status === 'PRESENT').length;
        const marked = records.length;
        if (!marked) {
          setTodayPct('—');
          setTodaySub('No attendance marked today');
        } else {
          const pct = Math.round((present / marked) * 1000) / 10;
          setTodayPct(`${pct}%`);
          setTodaySub(`${present} of ${marked} marked present${studentCount ? ` · ${studentCount} students` : ''}`);
        }

        const days: Array<{ day: string; value: number }> = [];
        for (let i = 6; i >= 0; i -= 1) {
          const d = new Date();
          d.setHours(0, 0, 0, 0);
          d.setDate(d.getDate() - i);
          const key = d.toISOString().slice(0, 10);
          const label = d.toLocaleDateString(undefined, { weekday: 'short' });
          const { data } = await api.get('/attendance', { params: { date: key } });
          if (!active) return;
          const dayRecords = data as Array<{ status: string }>;
          const dayPresent = dayRecords.filter((r) => r.status === 'PRESENT').length;
          const value = dayRecords.length
            ? Math.round((dayPresent / dayRecords.length) * 100)
            : 0;
          days.push({ day: label, value });
        }
        setWeekly(days);
      } catch {
        if (active) {
          setTodayPct('—');
          setTodaySub('Could not load attendance');
          setWeekly([]);
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
        title="Dashboard"
        subtitle="Overview for Greenfield International School · Term 2, 2026"
      />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4 lg:gap-4">
        <StatCard
          label="Total students"
          value="1,248"
          trend={{ direction: 'up', percent: '4.2%' }}
          subtext="vs last term"
          icon={<Users className="h-4 w-4" />}
        />
        <StatCard
          label="Teaching staff"
          value="86"
          trend={{ direction: 'up', percent: '2.4%' }}
          subtext="3 new this term"
          icon={<GraduationCap className="h-4 w-4" />}
        />
        <StatCard
          label="Attendance today"
          value={todayPct}
          subtext={todaySub}
          icon={<ClipboardCheck className="h-4 w-4" />}
        />
        <StatCard
          label="Pending leave"
          value="12"
          trend={{ direction: 'down', percent: '8%' }}
          subtext="Awaiting review"
          icon={<CalendarOff className="h-4 w-4" />}
        />
      </div>
      <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card className="p-4 md:p-5 lg:col-span-2">
          <h2 className="font-semibold text-gray-900">Weekly attendance</h2>
          <p className="mt-1 text-sm text-gray-400">Campus-wide, last 7 days</p>
          <div className="mt-5 flex h-36 items-end gap-2 md:h-44 md:gap-4">
            {(weekly.length ? weekly : [{ day: '—', value: 0 }]).map((item, index) => (
              <div key={`${item.day}-${index}`} className="flex h-full min-w-0 flex-1 flex-col items-center gap-2">
                <div className="flex w-full flex-1 items-end">
                  <div
                    className="w-full rounded-t-md bg-blue-600 transition-colors hover:bg-blue-700"
                    style={{ height: `${Math.max(item.value, item.value === 0 ? 2 : 0)}%` }}
                    title={`${item.day}: ${item.value}%`}
                  />
                </div>
                <span className="text-xs text-gray-400">{item.day}</span>
              </div>
            ))}
          </div>
        </Card>
        <Card className="p-4 md:p-5">
          <h2 className="font-semibold text-gray-900">Recent activity</h2>
          <ul className="mt-4 space-y-4">
            {ACTIVITY.map((item) => (
              <li key={`${item.name}-${item.time}`} className="flex gap-3">
                <Avatar name={item.name} size="sm" />
                <div className="min-w-0">
                  <p className="text-sm text-gray-900">
                    <span className="font-medium">{item.name}</span>{' '}
                    <span className="text-gray-500">{item.action}</span>
                  </p>
                  <p className="mt-0.5 text-xs text-gray-400">{item.time}</p>
                </div>
              </li>
            ))}
          </ul>
        </Card>
      </div>
    </>
  );
}

function audienceTone(audience: string): BadgeTone {
  if (audience === 'ALL') return 'blue';
  if (audience === 'STAFF' || audience === 'ADMIN') return 'slate';
  if (audience === 'STUDENT') return 'green';
  return 'amber';
}

function audienceLabel(audience: string, className?: string | null) {
  if (audience === 'ALL') return 'All';
  if (audience === 'ADMIN') return 'Admins';
  if (audience === 'STAFF') return 'Staff';
  if (audience === 'STUDENT') return 'Students';
  if (audience === 'CLASS') return className || 'Class';
  if (audience === 'CUSTOM') return 'Custom';
  return audience;
}

function formatPostDate(value?: string) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleDateString(undefined, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

type ApiPost = {
  id: string;
  title: string;
  content: string;
  audience: string;
  createdAt: string;
  fileUrl?: string | null;
  mediaType?: string | null;
  author?: { firstName?: string; lastName?: string } | null;
  targetClass?: { id: string; name: string; section?: string | null } | null;
};

type PostFormState = {
  title: string;
  content: string;
  audience: string;
};

const EMPTY_POST_FORM: PostFormState = {
  title: '',
  content: '',
  audience: 'ALL',
};

const POST_AUDIENCES = [
  { value: 'ALL', label: 'All' },
  { value: 'STAFF', label: 'Staff' },
  { value: 'STUDENT', label: 'Students' },
];

function PostFormModal({
  form,
  file,
  busy,
  error,
  onChange,
  onFileChange,
  onClose,
  onSubmit,
}: {
  form: PostFormState;
  file: File | null;
  busy: boolean;
  error: string;
  onChange: (next: PostFormState) => void;
  onFileChange: (next: File | null) => void;
  onClose: () => void;
  onSubmit: (event: FormEvent) => void;
}) {
  const inputClass =
    'mt-1.5 h-10 w-full rounded-lg border border-gray-200 px-3 text-sm text-gray-900 placeholder:text-gray-400 focus:border-blue-600 focus:outline-none focus:ring-1 focus:ring-blue-600';

  return (
    <Modal onClose={onClose} size="md">
      <div className="mb-3 flex items-start justify-between gap-3 sm:mb-4">
        <div className="min-w-0">
          <h2 className="text-base font-semibold text-gray-900 sm:text-lg">New post</h2>
          <p className="mt-1 hidden text-sm text-gray-500 sm:block">
            Publish an announcement. Optional photo or video up to 2 MB.
          </p>
        </div>
        <IconButton label="Close" onClick={onClose} className="shrink-0">
          <X className="h-4 w-4" />
        </IconButton>
      </div>

      <form onSubmit={onSubmit} className="space-y-2 sm:space-y-3">
        <label className="block text-sm text-gray-700">
          Title
          <input
            value={form.title}
            onChange={(event) => onChange({ ...form, title: event.target.value })}
            required
            className={inputClass}
          />
        </label>
        <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 sm:gap-3">
          <label className="block text-sm text-gray-700 sm:col-span-2">
            Content
            <textarea
              value={form.content}
              onChange={(event) => onChange({ ...form, content: event.target.value })}
              required
              rows={3}
              className="mt-1.5 w-full resize-none rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 focus:border-blue-600 focus:outline-none focus:ring-1 focus:ring-blue-600"
            />
          </label>
          <label className="block text-sm text-gray-700 sm:col-span-2">
            Audience
            <select
              value={form.audience}
              onChange={(event) => onChange({ ...form, audience: event.target.value })}
              className={inputClass}
            >
              {POST_AUDIENCES.map((item) => (
                <option key={item.value} value={item.value}>
                  {item.label}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="rounded-lg border border-dashed border-gray-300 p-3">
          <p className="text-sm font-medium text-gray-800">Photo or video</p>
          <p className="mt-1 text-xs text-gray-500">Images or videos only · max 2 MB</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <label className="inline-flex h-10 flex-1 cursor-pointer items-center justify-center gap-2 rounded-lg border border-gray-200 bg-white px-3 text-sm font-medium text-gray-700 hover:bg-gray-50 sm:flex-none">
              <Image className="h-4 w-4" />
              Photo
              <input
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(event) => onFileChange(event.target.files?.[0] ?? null)}
              />
            </label>
            <label className="inline-flex h-10 flex-1 cursor-pointer items-center justify-center gap-2 rounded-lg border border-gray-200 bg-white px-3 text-sm font-medium text-gray-700 hover:bg-gray-50 sm:flex-none">
              <Video className="h-4 w-4" />
              Video
              <input
                type="file"
                accept="video/*"
                className="hidden"
                onChange={(event) => onFileChange(event.target.files?.[0] ?? null)}
              />
            </label>
            {file && (
              <button
                type="button"
                onClick={() => onFileChange(null)}
                className="inline-flex h-10 items-center rounded-lg px-3 text-sm font-medium text-red-600 hover:bg-red-50"
              >
                Remove file
              </button>
            )}
          </div>
          {file && (
            <p className="mt-2 truncate text-sm text-gray-600">
              {file.name} · {(file.size / 1024).toFixed(0)} KB
            </p>
          )}
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
          <PrimaryButton type="submit" className="w-full sm:w-auto" icon={<Plus className="h-4 w-4" />}>
            {busy ? 'Publishing...' : 'Publish post'}
          </PrimaryButton>
        </div>
      </form>
    </Modal>
  );
}

function PostsPage() {
  const [posts, setPosts] = useState<ApiPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState<PostFormState>(EMPTY_POST_FORM);
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState('');
  const [pendingDelete, setPendingDelete] = useState<ApiPost | null>(null);
  const [deleting, setDeleting] = useState(false);

  const load = async () => {
    setLoadError('');
    try {
      const { data } = await api.get('/posts');
      setPosts(data);
    } catch {
      setLoadError('Could not load posts. Check that you are signed in as admin.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load().catch(console.error);
  }, []);

  const openModal = () => {
    setForm(EMPTY_POST_FORM);
    setFile(null);
    setFormError('');
    setModalOpen(true);
  };

  const closeModal = () => {
    if (busy) return;
    setModalOpen(false);
    setFormError('');
  };

  const onFileChange = (next: File | null) => {
    setFormError('');
    if (!next) {
      setFile(null);
      return;
    }
    if (!next.type.startsWith('image/') && !next.type.startsWith('video/')) {
      setFormError('Only photo or video files are allowed.');
      setFile(null);
      return;
    }
    if (next.size > MAX_MEDIA_BYTES) {
      setFormError('File must be 2 MB or smaller.');
      setFile(null);
      return;
    }
    setFile(next);
  };

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setFormError('');
    try {
      const body = new FormData();
      body.append('title', form.title.trim());
      body.append('content', form.content.trim());
      body.append('audience', form.audience);
      if (file) body.append('file', file);

      await api.post('/posts', body);
      setModalOpen(false);
      setForm(EMPTY_POST_FORM);
      setFile(null);
      await load();
    } catch (err: unknown) {
      setFormError(apiErrorMessage(err, 'Could not create post'));
    } finally {
      setBusy(false);
    }
  };

  const askDeletePost = (post: ApiPost) => {
    setPendingDelete(post);
  };

  const closeDeletePost = () => {
    if (deleting) return;
    setPendingDelete(null);
  };

  const confirmDeletePost = async () => {
    if (!pendingDelete) return;
    setDeleting(true);
    try {
      await api.delete(`/posts/${pendingDelete.id}`);
      setPendingDelete(null);
      await load();
    } catch (err: unknown) {
      setLoadError(apiErrorMessage(err, 'Could not delete post'));
      setPendingDelete(null);
    } finally {
      setDeleting(false);
    }
  };

  return (
    <>
      <SectionHeader
        title="Posts"
        subtitle="Announcements for staff, classes, and the whole school"
        action={
          <PrimaryButton icon={<Plus className="h-4 w-4" />} onClick={openModal}>
            New post
          </PrimaryButton>
        }
      />

      {loading && <p className="text-sm text-gray-500">Loading posts...</p>}
      {loadError && <p className="mb-4 text-sm text-red-600">{loadError}</p>}

      {!loading && !loadError && (
        <div className="space-y-3">
          {posts.map((post) => {
            const authorName = `${post.author?.firstName ?? ''} ${post.author?.lastName ?? ''}`.trim();
            const mediaSrc = mediaUrl(post.fileUrl);
            return (
              <Card key={post.id} className="p-4 md:p-5">
                <div className="flex items-start gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge tone={audienceTone(post.audience)}>
                        {audienceLabel(
                          post.audience,
                          post.targetClass
                            ? formatClassLabel(post.targetClass.name, post.targetClass.section)
                            : null,
                        )}
                      </Badge>
                      <span className="text-xs text-gray-400">{formatPostDate(post.createdAt)}</span>
                    </div>
                    <h2 className="mt-2 font-semibold text-gray-900">{post.title}</h2>
                    <p className="mt-1 whitespace-pre-wrap text-sm text-gray-600">{post.content}</p>
                    <PostMedia src={mediaSrc} mediaType={post.mediaType} />
                    <p className="mt-2 text-sm text-gray-500">
                      Posted by {authorName || 'Admin'}
                    </p>
                  </div>
                  <IconButton label={`Delete ${post.title}`} onClick={() => askDeletePost(post)}>
                    <Trash2 className="h-4 w-4" />
                  </IconButton>
                </div>
              </Card>
            );
          })}

          {!posts.length && (
            <Card className="p-6 text-center">
              <p className="text-sm text-gray-500">No posts yet. Use New post to publish one.</p>
            </Card>
          )}
        </div>
      )}

      {modalOpen && (
        <PostFormModal
          form={form}
          file={file}
          busy={busy}
          error={formError}
          onChange={setForm}
          onFileChange={onFileChange}
          onClose={closeModal}
          onSubmit={onSubmit}
        />
      )}

      {pendingDelete && (
        <ConfirmModal
          title="Delete post?"
          description={
            <>
              “{pendingDelete.title}” will be permanently removed. This cannot be undone.
            </>
          }
          confirmLabel="Delete post"
          busy={deleting}
          onConfirm={() => {
            void confirmDeletePost();
          }}
          onClose={closeDeletePost}
        />
      )}
    </>
  );
}

function UserFormModal({
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
  form: UserFormState;
  classes: SchoolClassOption[];
  busy: boolean;
  error: string;
  onChange: (next: UserFormState) => void;
  onClose: () => void;
  onSubmit: (event: FormEvent) => void;
}) {
  const inputClass =
    'mt-1.5 h-10 w-full rounded-lg border border-gray-200 px-3 text-sm text-gray-900 placeholder:text-gray-400 focus:border-blue-600 focus:outline-none focus:ring-1 focus:ring-blue-600';

  return (
    <Modal onClose={onClose} size="lg">
      <div className="mb-3 flex items-start justify-between gap-3 sm:mb-4">
        <div className="min-w-0">
          <h2 className="text-base font-semibold text-gray-900 sm:text-lg">
            {mode === 'add' ? 'Add user' : `Edit ${displayRole(form.role).toLowerCase()}`}
          </h2>
          <p className="mt-1 hidden text-sm text-gray-500 sm:block">
            {mode === 'add'
              ? 'Create an admin, teacher, or student account.'
              : 'Update account details for this user.'}
          </p>
        </div>
        <IconButton label="Close" onClick={onClose} className="shrink-0">
          <X className="h-4 w-4" />
        </IconButton>
      </div>

      <form onSubmit={onSubmit} className="space-y-2 sm:space-y-3">
        {mode === 'add' && (
          <label className="block text-sm text-gray-700">
            Role
            <select
              value={form.role}
              onChange={(event) =>
                onChange({ ...form, role: event.target.value as UserFormRole })
              }
              className={inputClass}
            >
              <option value="ADMIN">Admin</option>
              <option value="STAFF">Teacher</option>
              <option value="STUDENT">Student</option>
            </select>
          </label>
        )}

        {form.role === 'STAFF' ? (
          <label className="block text-sm text-gray-700">
            Teacher name
            <input
              value={form.teacherName}
              onChange={(event) => onChange({ ...form, teacherName: event.target.value })}
              required
              placeholder="Full name"
              className={inputClass}
            />
          </label>
        ) : (
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 sm:gap-3">
            <label className="block text-sm text-gray-700">
              First name
              <input
                value={form.firstName}
                onChange={(event) => onChange({ ...form, firstName: event.target.value })}
                required
                className={inputClass}
              />
            </label>
            <label className="block text-sm text-gray-700">
              Last name
              <input
                value={form.lastName}
                onChange={(event) => onChange({ ...form, lastName: event.target.value })}
                required
                className={inputClass}
              />
            </label>
          </div>
        )}

        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 sm:gap-3">
          {(mode === 'add' || form.role === 'ADMIN' || form.role === 'STAFF') && (
            <label className="block text-sm text-gray-700">
              Email
              <input
                type="email"
                value={form.email}
                onChange={(event) => onChange({ ...form, email: event.target.value })}
                required={mode === 'add' || form.role !== 'STUDENT'}
                placeholder="user@school.com"
                className={inputClass}
              />
            </label>
          )}

          {mode === 'add' && (
            <label className="block text-sm text-gray-700">
              Password
              <input
                type="password"
                value={form.password}
                onChange={(event) => onChange({ ...form, password: event.target.value })}
                required
                minLength={6}
                placeholder="At least 6 characters"
                className={inputClass}
              />
            </label>
          )}
        </div>

        {form.role === 'STUDENT' && (
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 sm:gap-3">
            <label className="block text-sm text-gray-700">
              Enrollment ID
              <input
                value={form.studentId}
                onChange={(event) => onChange({ ...form, studentId: event.target.value })}
                required
                placeholder="9A-12"
                className={inputClass}
              />
            </label>
            <label className="block text-sm text-gray-700">
              Class
              <select
                value={form.schoolClassId}
                onChange={(event) =>
                  onChange({ ...form, schoolClassId: event.target.value })
                }
                required
                className={inputClass}
              >
                <option value="">Select class</option>
                {classes.map((item) => (
                  <option key={item.id} value={item.id}>
                    {formatClassLabel(item.name, item.section)}
                  </option>
                ))}
              </select>
            </label>
            <label className="block text-sm text-gray-700">
              Enrollment date
              <input
                type="date"
                value={form.enrollmentDate}
                onChange={(event) => onChange({ ...form, enrollmentDate: event.target.value })}
                required
                className={inputClass}
              />
            </label>
          </div>
        )}

        {form.role === 'STAFF' && (
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 sm:gap-3">
            <label className="block text-sm text-gray-700">
              Teacher ID
              <input
                value={form.employeeId}
                onChange={(event) => onChange({ ...form, employeeId: event.target.value })}
                required
                placeholder="T-104"
                className={inputClass}
              />
            </label>
            <label className="block text-sm text-gray-700">
              Subject
              <select
                value={form.subject}
                onChange={(event) => onChange({ ...form, subject: event.target.value })}
                required
                className={inputClass}
              >
                <option value="">Select subject</option>
                {TEACHING_SUBJECTS.map((subject) => (
                  <option key={subject} value={subject}>
                    {TEACHING_SUBJECT_LABELS[subject]}
                  </option>
                ))}
              </select>
            </label>
            <label className="block text-sm text-gray-700 sm:col-span-2">
              Class
              <select
                value={form.assignedClassId}
                onChange={(event) => onChange({ ...form, assignedClassId: event.target.value })}
                className={inputClass}
              >
                <option value="">No class assigned</option>
                {classes.map((item) => (
                  <option key={item.id} value={item.id}>
                    {formatClassLabel(item.name, item.section)}
                  </option>
                ))}
              </select>
            </label>
          </div>
        )}

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
            {busy ? 'Saving...' : mode === 'add' ? 'Create user' : 'Save changes'}
          </PrimaryButton>
        </div>
      </form>
    </Modal>
  );
}

function UsersPage() {
  const { user: currentUser } = useAuth();
  const [query, setQuery] = useState('');
  const [role, setRole] = useState('All roles');
  const [users, setUsers] = useState<ApiUser[]>([]);
  const [classes, setClasses] = useState<SchoolClassOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [modal, setModal] = useState<'add' | 'edit' | null>(null);
  const [editingUserId, setEditingUserId] = useState<string | null>(null);
  const [form, setForm] = useState<UserFormState>(EMPTY_USER_FORM);
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState('');
  const [pendingDelete, setPendingDelete] = useState<ApiUser | null>(null);
  const [deleting, setDeleting] = useState(false);

  const load = async () => {
    setLoadError('');
    try {
      const [usersRes, classesRes] = await Promise.all([
        api.get('/users'),
        api.get('/classes'),
      ]);
      setUsers(usersRes.data);
      setClasses(classesRes.data);
    } catch {
      setLoadError('Could not load users. Check that you are signed in as admin.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load().catch(console.error);
  }, []);

  const filtered = useMemo(() => {
    return users.filter((user) => {
      const name = `${user.firstName} ${user.lastName}`.toLowerCase();
      const email = user.email.toLowerCase();
      const q = query.toLowerCase();
      const matchesQuery = !q || name.includes(q) || email.includes(q);
      const matchesRole =
        role === 'All roles' ||
        (role === 'Admin' && user.role === 'ADMIN') ||
        (role === 'Teacher' && user.role === 'STAFF') ||
        (role === 'Student' && user.role === 'STUDENT');
      return matchesQuery && matchesRole;
    });
  }, [users, query, role]);

  const openAdd = () => {
    setModal('add');
    setEditingUserId(null);
    setForm({
      ...EMPTY_USER_FORM,
      enrollmentDate: new Date().toISOString().slice(0, 10),
    });
    setFormError('');
  };

  const openEdit = (user: ApiUser) => {
    setModal('edit');
    setEditingUserId(user.id);
    const classId =
      user.studentProfile?.schoolClassId ||
      user.studentProfile?.schoolClass?.id ||
      '';
    setForm({
      role: user.role,
      firstName: user.firstName,
      lastName: user.lastName,
      email: user.email,
      password: '',
      studentId: user.studentProfile?.studentId ?? '',
      schoolClassId: classId,
      enrollmentDate: toDateInput(
        user.studentProfile?.enrollmentDate || user.createdAt || null,
      ),
      teacherName: `${user.firstName} ${user.lastName}`.trim(),
      employeeId: user.staffProfile?.employeeId ?? '',
      subject: (user.staffProfile?.subject as TeachingSubject | undefined) ?? '',
      assignedClassId:
        user.staffProfile?.assignedClassId ||
        user.staffProfile?.assignedClass?.id ||
        '',
    });
    setFormError('');
  };

  const closeModal = () => {
    if (busy) return;
    setModal(null);
    setEditingUserId(null);
    setFormError('');
  };

  const askDeleteUser = (user: ApiUser) => {
    setPendingDelete(user);
  };

  const closeDeleteUser = () => {
    if (deleting) return;
    setPendingDelete(null);
  };

  const confirmDeleteUser = async () => {
    if (!pendingDelete) return;
    setDeleting(true);
    try {
      await api.delete(`/users/${pendingDelete.id}`);
      setPendingDelete(null);
      await load();
    } catch (err) {
      setLoadError(apiErrorMessage(err, 'Could not delete user'));
      setPendingDelete(null);
    } finally {
      setDeleting(false);
    }
  };

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setFormError('');
    try {
      if (modal === 'add') {
        if (form.role === 'STUDENT') {
          await api.post('/users/students', {
            firstName: form.firstName.trim(),
            lastName: form.lastName.trim(),
            email: form.email.trim(),
            password: form.password,
            studentId: form.studentId.trim(),
            schoolClassId: form.schoolClassId || undefined,
            enrollmentDate: form.enrollmentDate || undefined,
          });
        } else if (form.role === 'STAFF') {
          const names = splitTeacherName(form.teacherName);
          await api.post('/auth/register', {
            role: 'STAFF',
            firstName: names.firstName,
            lastName: names.lastName || names.firstName,
            email: form.email.trim(),
            password: form.password,
            employeeId: form.employeeId.trim(),
            subject: form.subject.trim(),
            assignedClassId: form.assignedClassId || undefined,
          });
        } else {
          await api.post('/auth/register', {
            role: 'ADMIN',
            firstName: form.firstName.trim(),
            lastName: form.lastName.trim(),
            email: form.email.trim(),
            password: form.password,
          });
        }
      } else if (modal === 'edit' && editingUserId) {
        if (form.role === 'STUDENT') {
          await api.patch(`/users/students/${editingUserId}`, {
            firstName: form.firstName.trim(),
            lastName: form.lastName.trim(),
            studentId: form.studentId.trim(),
            schoolClassId: form.schoolClassId || undefined,
            enrollmentDate: form.enrollmentDate || undefined,
          });
        } else if (form.role === 'STAFF') {
          const names = splitTeacherName(form.teacherName);
          await api.patch(`/users/staff/${editingUserId}`, {
            firstName: names.firstName,
            lastName: names.lastName || names.firstName,
            email: form.email.trim(),
            employeeId: form.employeeId.trim(),
            subject: form.subject.trim(),
            assignedClassId: form.assignedClassId || null,
          });
        } else {
          await api.patch(`/users/admins/${editingUserId}`, {
            firstName: form.firstName.trim(),
            lastName: form.lastName.trim(),
            email: form.email.trim(),
          });
        }
      }
      setModal(null);
      setEditingUserId(null);
      await load();
    } catch (err: unknown) {
      setFormError(apiErrorMessage(err, 'Could not save user'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <SectionHeader
        title="Users"
        subtitle="Admins, teachers, and students"
        action={
          <PrimaryButton icon={<Plus className="h-4 w-4" />} onClick={openAdd}>
            Add user
          </PrimaryButton>
        }
      />
      <div className="mb-4 flex flex-col gap-2 sm:flex-row">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search by name or email"
            className="h-10 w-full rounded-lg border border-gray-200 bg-white py-2 pl-9 pr-3 text-sm text-gray-900 placeholder:text-gray-400 focus:border-blue-600 focus:outline-none focus:ring-1 focus:ring-blue-600"
          />
        </div>
        <select
          value={role}
          onChange={(event) => setRole(event.target.value)}
          className="h-10 rounded-lg border border-gray-200 bg-white px-3 text-sm text-gray-700 focus:border-blue-600 focus:outline-none focus:ring-1 focus:ring-blue-600 sm:w-44"
        >
          <option>All roles</option>
          <option>Admin</option>
          <option>Teacher</option>
          <option>Student</option>
        </select>
      </div>

      {loading && <p className="text-sm text-gray-500">Loading users...</p>}
      {loadError && <p className="mb-4 text-sm text-red-600">{loadError}</p>}

      {!loading && !loadError && (
        <>
          <div className="space-y-3 md:hidden">
            {filtered.map((user) => {
              const name = `${user.firstName} ${user.lastName}`.trim();
              const status = user.isActive ? 'Active' : 'Inactive';
              return (
                <Card key={user.id} className="p-4">
                  <div className="flex items-start justify-between gap-2">
                    <PersonCell name={name} sub={user.email} />
                    <div className="flex shrink-0 items-center gap-1">
                      <IconButton label={`Edit ${name}`} onClick={() => openEdit(user)}>
                        <Pencil className="h-4 w-4" />
                      </IconButton>
                      {currentUser?.id !== user.id && (
                        <IconButton label={`Delete ${name}`} onClick={() => askDeleteUser(user)}>
                          <Trash2 className="h-4 w-4" />
                        </IconButton>
                      )}
                    </div>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-x-4 gap-y-2 text-sm">
                    <p className="text-gray-500">
                      Role: <Badge tone={roleTone(user.role)}>{displayRole(user.role)}</Badge>
                    </p>
                    <p className="text-gray-500">
                      Status: <Badge tone={user.isActive ? 'green' : 'red'}>{status}</Badge>
                    </p>
                  </div>
                </Card>
              );
            })}
          </div>

          <div className="hidden md:block">
            <TableShell columns={['Name', 'Role', 'Email', 'Status', '']}>
              {filtered.map((user) => {
                const name = `${user.firstName} ${user.lastName}`.trim();
                const status = user.isActive ? 'Active' : 'Inactive';
                return (
                  <tr key={user.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <PersonCell name={name} />
                    </td>
                    <td className="px-4 py-3">
                      <Badge tone={roleTone(user.role)}>{displayRole(user.role)}</Badge>
                    </td>
                    <td className="px-4 py-3 text-gray-500">{user.email}</td>
                    <td className="px-4 py-3">
                      <Badge tone={user.isActive ? 'green' : 'red'}>{status}</Badge>
                    </td>
                    <td className="px-2 py-3 text-right">
                      <div className="inline-flex items-center gap-1">
                        <IconButton label={`Edit ${name}`} onClick={() => openEdit(user)}>
                          <Pencil className="h-4 w-4" />
                        </IconButton>
                        {currentUser?.id !== user.id && (
                          <IconButton label={`Delete ${name}`} onClick={() => askDeleteUser(user)}>
                            <Trash2 className="h-4 w-4" />
                          </IconButton>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </TableShell>
          </div>

          {!filtered.length && (
            <Card className="mt-3 p-6 text-center">
              <p className="text-sm text-gray-500">
                {users.length
                  ? 'No users match your search.'
                  : 'No users yet. Use Add user to create one.'}
              </p>
            </Card>
          )}
        </>
      )}

      {modal && (
        <UserFormModal
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

      {pendingDelete && (
        <ConfirmModal
          title="Delete user?"
          description={
            <>
              “{pendingDelete.firstName} {pendingDelete.lastName}” will be permanently removed.
              This cannot be undone.
            </>
          }
          confirmLabel="Delete user"
          busy={deleting}
          onConfirm={() => {
            void confirmDeleteUser();
          }}
          onClose={closeDeleteUser}
        />
      )}
    </>
  );
}

type ApiClass = {
  id: string;
  name: string;
  section: string;
  academicYear?: string | null;
  _count?: { students: number; staff: number };
  staff?: Array<{
    user: { firstName: string; lastName: string };
  }>;
};

type ClassFormState = {
  name: string;
  section: string;
  academicYear: string;
};

const EMPTY_CLASS_FORM: ClassFormState = {
  name: '',
  section: '',
  academicYear: '',
};

function classTeacherNames(item: ApiClass) {
  const names = (item.staff ?? [])
    .map((s) => `${s.user.firstName} ${s.user.lastName}`.trim())
    .filter(Boolean);
  return names.length ? names.join(', ') : 'No teacher assigned';
}

function ClassFormModal({
  mode,
  form,
  busy,
  error,
  onChange,
  onClose,
  onSubmit,
}: {
  mode: 'add' | 'edit';
  form: ClassFormState;
  busy: boolean;
  error: string;
  onChange: (next: ClassFormState) => void;
  onClose: () => void;
  onSubmit: (event: FormEvent) => void;
}) {
  const inputClass =
    'mt-1.5 h-10 w-full rounded-lg border border-gray-200 px-3 text-sm text-gray-900 placeholder:text-gray-400 focus:border-blue-600 focus:outline-none focus:ring-1 focus:ring-blue-600';

  return (
    <Modal onClose={onClose} size="md">
      <div className="mb-3 flex items-start justify-between gap-3 sm:mb-4">
        <div className="min-w-0">
          <h2 className="text-base font-semibold text-gray-900 sm:text-lg">
            {mode === 'add' ? 'Add class' : 'Edit class'}
          </h2>
          <p className="mt-1 hidden text-sm text-gray-500 sm:block">
            {mode === 'add'
              ? 'Create a class section for the current year.'
              : 'Update class and section.'}
          </p>
        </div>
        <IconButton label="Close" onClick={onClose} className="shrink-0">
          <X className="h-4 w-4" />
        </IconButton>
      </div>

      <form onSubmit={onSubmit} className="space-y-2 sm:space-y-3">
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 sm:gap-3">
          <label className="block text-sm text-gray-700">
            Class
            <input
              value={form.name}
              onChange={(event) => onChange({ ...form, name: event.target.value })}
              required
              placeholder="10"
              className={inputClass}
            />
          </label>
          <label className="block text-sm text-gray-700">
            Section
            <input
              value={form.section}
              onChange={(event) => onChange({ ...form, section: event.target.value })}
              required
              placeholder="A"
              className={inputClass}
            />
          </label>
        </div>
        <label className="block text-sm text-gray-700">
          Academic year
          <input
            value={form.academicYear}
            onChange={(event) => onChange({ ...form, academicYear: event.target.value })}
            placeholder="2025-26"
            className={inputClass}
          />
        </label>

        {error && <p className="text-sm text-red-600">{error}</p>}

        <div className="flex justify-end gap-2 pt-1">
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            className="inline-flex h-10 items-center justify-center rounded-lg border border-gray-200 bg-white px-4 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
          >
            Cancel
          </button>
          <PrimaryButton type="submit" disabled={busy}>
            {busy ? 'Saving...' : mode === 'add' ? 'Create class' : 'Save changes'}
          </PrimaryButton>
        </div>
      </form>
    </Modal>
  );
}

function ClassesPage() {
  const [items, setItems] = useState<ApiClass[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [modal, setModal] = useState<'add' | 'edit' | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<ClassFormState>(EMPTY_CLASS_FORM);
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState('');
  const [pendingDelete, setPendingDelete] = useState<ApiClass | null>(null);
  const [deleting, setDeleting] = useState(false);

  const load = async () => {
    setLoadError('');
    try {
      const { data } = await api.get('/classes');
      setItems(data);
    } catch (err) {
      setLoadError(apiErrorMessage(err, 'Could not load classes.'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load().catch(console.error);
  }, []);

  const openAdd = () => {
    setModal('add');
    setEditingId(null);
    setForm(EMPTY_CLASS_FORM);
    setFormError('');
  };

  const openEdit = (item: ApiClass) => {
    setModal('edit');
    setEditingId(item.id);
    setForm({
      name: item.name,
      section: item.section ?? '',
      academicYear: item.academicYear ?? '',
    });
    setFormError('');
  };

  const closeModal = () => {
    if (busy) return;
    setModal(null);
    setEditingId(null);
    setFormError('');
  };

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setFormError('');
    const payload = {
      name: form.name.trim(),
      section: form.section.trim(),
      academicYear: form.academicYear.trim() || undefined,
    };
    try {
      if (modal === 'add') {
        await api.post('/classes', payload);
      } else if (modal === 'edit' && editingId) {
        await api.patch(`/classes/${editingId}`, payload);
      }
      setModal(null);
      setEditingId(null);
      await load();
    } catch (err) {
      setFormError(apiErrorMessage(err, 'Could not save class'));
    } finally {
      setBusy(false);
    }
  };

  const askDeleteClass = (item: ApiClass) => {
    setPendingDelete(item);
  };

  const closeDeleteClass = () => {
    if (deleting) return;
    setPendingDelete(null);
  };

  const confirmDeleteClass = async () => {
    if (!pendingDelete) return;
    setDeleting(true);
    try {
      await api.delete(`/classes/${pendingDelete.id}`);
      setPendingDelete(null);
      await load();
    } catch (err) {
      setLoadError(apiErrorMessage(err, 'Could not delete class'));
      setPendingDelete(null);
    } finally {
      setDeleting(false);
    }
  };

  return (
    <>
      <SectionHeader
        title="Classes"
        subtitle="Sections and enrolled students"
        action={
          <PrimaryButton icon={<Plus className="h-4 w-4" />} onClick={openAdd}>
            Add class
          </PrimaryButton>
        }
      />

      {loading && <p className="text-sm text-gray-500">Loading classes...</p>}
      {loadError && <p className="mb-4 text-sm text-red-600">{loadError}</p>}

      {!loading && !loadError && (
        <>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {items.map((item) => {
              const teacher = classTeacherNames(item);
              const label = formatClassLabel(item.name, item.section);
              return (
                <Card key={item.id} className="p-4 md:p-5">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <h2 className="font-semibold text-gray-900">{label}</h2>
                      {item.academicYear && (
                        <p className="mt-1 text-sm text-gray-400">{item.academicYear}</p>
                      )}
                    </div>
                    <div className="flex shrink-0 items-center gap-1">
                      <IconButton label={`Edit ${label}`} onClick={() => openEdit(item)}>
                        <Pencil className="h-4 w-4" />
                      </IconButton>
                      <IconButton label={`Delete ${label}`} onClick={() => askDeleteClass(item)}>
                        <Trash2 className="h-4 w-4" />
                      </IconButton>
                    </div>
                  </div>
                  <div className="mt-4 flex items-center gap-3">
                    <Avatar name={teacher} size="sm" />
                    <div className="min-w-0">
                      <p className="truncate text-sm text-gray-500">{teacher}</p>
                    </div>
                  </div>
                  <div className="mt-4 border-t border-gray-200 pt-3">
                    <p className="text-sm text-gray-400">Students enrolled</p>
                    <p className="mt-1 text-lg font-semibold text-gray-900">
                      {item._count?.students ?? 0}
                    </p>
                  </div>
                </Card>
              );
            })}
          </div>

          {!items.length && (
            <Card className="mt-3 p-6 text-center">
              <p className="text-sm text-gray-500">No classes yet. Use Add class to create one.</p>
            </Card>
          )}
        </>
      )}

      {modal && (
        <ClassFormModal
          mode={modal}
          form={form}
          busy={busy}
          error={formError}
          onChange={setForm}
          onClose={closeModal}
          onSubmit={onSubmit}
        />
      )}

      {pendingDelete && (
        <ConfirmModal
          title="Delete class?"
          description={
            <>
              “{formatClassLabel(pendingDelete.name, pendingDelete.section)}” will be permanently
              removed. This cannot be undone.
            </>
          }
          confirmLabel="Delete class"
          busy={deleting}
          onConfirm={() => {
            void confirmDeleteClass();
          }}
          onClose={closeDeleteClass}
        />
      )}
    </>
  );
}

type AttendanceStatusFilter = 'ALL' | 'PRESENT' | 'ABSENT' | 'LATE';

type ApiAttendance = {
  id: string;
  date: string;
  status: 'PRESENT' | 'ABSENT' | 'LATE' | 'EXCUSED';
  remarks?: string | null;
  schoolClassId?: string | null;
  student?: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
    studentProfile?: { studentId?: string | null } | null;
  } | null;
  schoolClass?: { id: string; name: string; section?: string | null } | null;
};

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
  if (status === 'LATE') return 'amber';
  return 'slate';
}

function todayInputValue() {
  return new Date().toISOString().slice(0, 10);
}

function formatAttendanceDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString(undefined, {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

function AttendancePage() {
  const [classes, setClasses] = useState<SchoolClassOption[]>([]);
  const [records, setRecords] = useState<ApiAttendance[]>([]);
  const [date, setDate] = useState(todayInputValue);
  const [classId, setClassId] = useState('all');
  const [statusFilter, setStatusFilter] = useState<AttendanceStatusFilter>('ALL');
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');

  const load = async () => {
    setLoadError('');
    try {
      const params: Record<string, string> = { date };
      if (classId !== 'all') params.schoolClassId = classId;
      const [classesRes, attendanceRes] = await Promise.all([
        api.get('/classes'),
        api.get('/attendance', { params }),
      ]);
      setClasses(classesRes.data);
      setRecords(attendanceRes.data);
    } catch (err) {
      setLoadError(apiErrorMessage(err, 'Could not load attendance.'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    setLoading(true);
    load().catch(console.error);
  }, [date, classId]);

  const selectedClass = classes.find((item) => item.id === classId);
  const classLabel =
    classId === 'all'
      ? 'All classes'
      : selectedClass
        ? formatClassLabel(selectedClass.name, selectedClass.section)
        : 'Selected class';

  const counts = useMemo(() => {
    const present = records.filter((r) => r.status === 'PRESENT').length;
    const absent = records.filter((r) => r.status === 'ABSENT').length;
    const late = records.filter((r) => r.status === 'LATE').length;
    const markedClassIds = new Set(
      records.map((r) => r.schoolClassId || r.schoolClass?.id).filter(Boolean),
    );
    return {
      present,
      absent,
      late,
      total: records.length,
      markedSections: markedClassIds.size,
      sectionsTotal: classes.length,
    };
  }, [records, classes.length]);

  const filtered = useMemo(() => {
    if (statusFilter === 'ALL') return records;
    return records.filter((row) => row.status === statusFilter);
  }, [records, statusFilter]);

  const statusOptions: { value: AttendanceStatusFilter; label: string }[] = [
    { value: 'ALL', label: 'All' },
    { value: 'PRESENT', label: 'Present' },
    { value: 'ABSENT', label: 'Absent' },
    { value: 'LATE', label: 'Late' },
  ];

  return (
    <>
      <SectionHeader title="Attendance" subtitle="Daily register across classes" />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4 lg:gap-4">
        <StatCard
          label="Present"
          value={String(counts.present)}
          subtext={counts.total ? `${Math.round((counts.present / counts.total) * 100)}% of marked` : 'No records'}
          icon={<Check className="h-4 w-4" />}
        />
        <StatCard
          label="Absent"
          value={String(counts.absent)}
          subtext={counts.total ? `${Math.round((counts.absent / counts.total) * 100)}% of marked` : 'No records'}
          icon={<X className="h-4 w-4" />}
        />
        <StatCard
          label="Late"
          value={String(counts.late)}
          subtext={counts.total ? `${Math.round((counts.late / counts.total) * 100)}% of marked` : 'No records'}
          icon={<Bell className="h-4 w-4" />}
        />
        <StatCard
          label="Sections marked"
          value={`${counts.markedSections} / ${counts.sectionsTotal || 0}`}
          subtext={formatAttendanceDate(date)}
          icon={<ClipboardCheck className="h-4 w-4" />}
        />
      </div>

      <div className="mt-6 mb-4 flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div className="min-w-0">
          <h2 className="font-semibold text-gray-900">{classLabel}</h2>
          <p className="text-sm text-gray-400">{formatAttendanceDate(date)}</p>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
          <label className="block text-sm text-gray-700 sm:w-40">
            <span className="sr-only">Date</span>
            <input
              type="date"
              value={date}
              onChange={(event) => setDate(event.target.value)}
              className="h-10 w-full rounded-lg border border-gray-200 bg-white px-3 text-sm text-gray-700 focus:border-blue-600 focus:outline-none focus:ring-1 focus:ring-blue-600"
            />
          </label>
          <label className="relative block text-sm text-gray-700 sm:min-w-[12rem]">
            <span className="sr-only">Class</span>
            <select
              value={classId}
              onChange={(event) => setClassId(event.target.value)}
              className="h-10 w-full appearance-none rounded-lg border border-gray-200 bg-white py-2 pl-3 pr-9 text-sm font-medium text-gray-700 hover:bg-gray-50 focus:border-blue-600 focus:outline-none focus:ring-1 focus:ring-blue-600"
            >
              <option value="all">All classes</option>
              {classes.map((item) => (
                <option key={item.id} value={item.id}>
                  {formatClassLabel(item.name, item.section)}
                </option>
              ))}
            </select>
            <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          </label>
          <div className="flex flex-wrap gap-1.5">
            {statusOptions.map((option) => {
              const active = statusFilter === option.value;
              return (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => setStatusFilter(option.value)}
                  className={cn(
                    'inline-flex h-10 items-center rounded-lg border px-3 text-sm font-medium',
                    active
                      ? 'border-blue-600 bg-blue-50 text-blue-700'
                      : 'border-gray-200 bg-white text-gray-600 hover:bg-gray-50',
                  )}
                >
                  {option.label}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {loading && <p className="text-sm text-gray-500">Loading attendance...</p>}
      {loadError && <p className="mb-4 text-sm text-red-600">{loadError}</p>}

      {!loading && !loadError && (
        <>
          <div className="space-y-3 md:hidden">
            {filtered.map((row) => {
              const name = `${row.student?.firstName ?? ''} ${row.student?.lastName ?? ''}`.trim() || 'Student';
              const roll = row.student?.studentProfile?.studentId || '—';
              return (
                <Card key={row.id} className="p-4">
                  <div className="flex items-start justify-between gap-2">
                    <PersonCell name={name} sub={`Roll ${roll}`} />
                    <Badge tone={attendanceStatusTone(row.status)}>
                      {attendanceStatusLabel(row.status)}
                    </Badge>
                  </div>
                  {classId === 'all' && row.schoolClass?.name && (
                    <p className="mt-2 text-sm text-gray-400">
                      {formatClassLabel(row.schoolClass.name, row.schoolClass.section)}
                    </p>
                  )}
                </Card>
              );
            })}
          </div>

          <div className="hidden md:block">
            <TableShell
              columns={
                classId === 'all'
                  ? ['Roll no.', 'Student', 'Class', 'Status']
                  : ['Roll no.', 'Student', 'Status']
              }
            >
              {filtered.map((row) => {
                const name = `${row.student?.firstName ?? ''} ${row.student?.lastName ?? ''}`.trim() || 'Student';
                const roll = row.student?.studentProfile?.studentId || '—';
                return (
                  <tr key={row.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-gray-500">{roll}</td>
                    <td className="px-4 py-3">
                      <PersonCell name={name} />
                    </td>
                    {classId === 'all' && (
                      <td className="px-4 py-3 text-gray-500">
                        {row.schoolClass
                          ? formatClassLabel(row.schoolClass.name, row.schoolClass.section)
                          : '—'}
                      </td>
                    )}
                    <td className="px-4 py-3">
                      <Badge tone={attendanceStatusTone(row.status)}>
                        {attendanceStatusLabel(row.status)}
                      </Badge>
                    </td>
                  </tr>
                );
              })}
            </TableShell>
          </div>

          {!filtered.length && (
            <Card className="mt-3 p-6 text-center">
              <p className="text-sm text-gray-500">
                {records.length
                  ? 'No records match this status filter.'
                  : 'No attendance marked for this date and class.'}
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
  const [loadError, setLoadError] = useState('');
  const [schoolTopper, setSchoolTopper] = useState<{
    studentName: string;
    rollNo: string;
    classLabel: string;
    totalScore: number;
    totalMax: number;
    percentage: number;
  } | null>(null);
  const [schoolPending, setSchoolPending] = useState(true);
  const [classToppers, setClassToppers] = useState<
    Array<{
      classId: string;
      studentUserId: string;
      studentName: string;
      rollNo: string;
      classLabel: string;
      totalScore: number;
      totalMax: number;
      percentage: number;
      subjectsExpected: number;
      studentsComplete: number;
      studentsTotal: number;
      pending?: boolean;
    }>
  >([]);

  const load = async () => {
    setLoadError('');
    try {
      const { data } = await api.get('/grades/toppers');
      setSchoolTopper(data.schoolTopper);
      setSchoolPending(Boolean(data.schoolPending ?? !data.schoolTopper));
      setClassToppers(data.classToppers ?? []);
    } catch (err) {
      setLoadError(apiErrorMessage(err, 'Could not load grade toppers.'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load().catch(console.error);
  }, []);

  return (
    <>
      <SectionHeader
        title="Grades"
        subtitle="Complete only after all 10 subjects are marked for every student"
      />

      {loading && <p className="text-sm text-gray-500">Loading toppers...</p>}
      {loadError && <p className="mb-4 text-sm text-red-600">{loadError}</p>}

      {!loading && !loadError && (
        <>
          <Card className="mb-4 p-4 md:p-5">
            <p className="text-sm font-medium text-gray-500">School topper</p>
            {!schoolPending && schoolTopper ? (
              <div className="mt-3 flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-lg font-semibold text-gray-900">
                    {schoolTopper.studentName}
                  </p>
                  <p className="text-sm text-gray-500">
                    {schoolTopper.classLabel} · Roll {schoolTopper.rollNo}
                  </p>
                </div>
                <p className="text-base font-semibold text-blue-700">
                  {schoolTopper.totalScore}/{schoolTopper.totalMax} ({schoolTopper.percentage}%)
                </p>
              </div>
            ) : (
              <div className="mt-3">
                <Badge tone="amber">Grade is pending</Badge>
                <p className="mt-2 text-sm text-gray-500">
                  School topper appears after every class has all 10 subject marks for every
                  student.
                </p>
              </div>
            )}
          </Card>

          <div className="space-y-3 md:hidden">
            {classToppers.map((row) => (
              <Card key={row.classId} className="p-4">
                <p className="font-semibold text-gray-900">{row.classLabel}</p>
                {row.pending || !row.studentUserId ? (
                  <div className="mt-2">
                    <Badge tone="amber">Grade is pending</Badge>
                    <p className="mt-2 text-sm text-gray-500">
                      {row.studentsComplete}/{row.studentsTotal || 0} students with all{' '}
                      {row.subjectsExpected || 10} subjects marked
                    </p>
                  </div>
                ) : (
                  <div className="mt-2">
                    <PersonCell name={row.studentName} sub={`Roll ${row.rollNo}`} />
                    <p className="mt-2 text-sm text-gray-500">
                      {row.totalScore}/{row.totalMax} ({row.percentage}%)
                    </p>
                  </div>
                )}
              </Card>
            ))}
          </div>

          <div className="hidden md:block">
            <TableShell columns={['Class', 'Status', 'Topper', 'Roll', 'Total', 'Percentage']}>
              {classToppers.map((row) => (
                <tr key={row.classId} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium text-gray-900">{row.classLabel}</td>
                  <td className="px-4 py-3">
                    {row.pending || !row.studentUserId ? (
                      <Badge tone="amber">Grade is pending</Badge>
                    ) : (
                      <Badge tone="green">Complete</Badge>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {row.pending || !row.studentUserId ? (
                      <span className="text-gray-400">—</span>
                    ) : (
                      <PersonCell name={row.studentName} />
                    )}
                  </td>
                  <td className="px-4 py-3 text-gray-500">
                    {row.pending || !row.studentUserId ? '—' : row.rollNo}
                  </td>
                  <td className="px-4 py-3 text-gray-500">
                    {row.pending || !row.studentUserId
                      ? '—'
                      : `${row.totalScore} / ${row.totalMax}`}
                  </td>
                  <td className="px-4 py-3 text-gray-500">
                    {row.pending || !row.studentUserId ? '—' : `${row.percentage}%`}
                  </td>
                </tr>
              ))}
            </TableShell>
          </div>

          {!classToppers.length && (
            <Card className="mt-3 p-6 text-center">
              <p className="text-sm text-gray-500">No classes found.</p>
            </Card>
          )}
        </>
      )}
    </>
  );
}

function leaveTone(status: string): BadgeTone {
  if (status === 'Approved' || status === 'APPROVED') return 'green';
  if (status === 'Rejected' || status === 'REJECTED') return 'red';
  return 'amber';
}

function LeavePage() {
  const [items, setItems] = useState<ApiLeave[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [reviewBusyId, setReviewBusyId] = useState<string | null>(null);
  const [studentClassFilter, setStudentClassFilter] = useState('All classes');

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

  const teacherLeave = items.filter((item) => item.requester?.role === 'STAFF');
  const studentLeaveAll = items.filter((item) => item.requester?.role === 'STUDENT');

  const studentClassOptions = useMemo(() => {
    const names = new Set<string>();
    for (const item of studentLeaveAll) {
      const className = leaveClassName(item);
      if (className && className !== '—') names.add(className);
    }
    return ['All classes', ...Array.from(names).sort((a, b) => a.localeCompare(b))];
  }, [studentLeaveAll]);

  const studentLeave = useMemo(() => {
    if (studentClassFilter === 'All classes') return studentLeaveAll;
    return studentLeaveAll.filter((item) => leaveClassName(item) === studentClassFilter);
  }, [studentLeaveAll, studentClassFilter]);

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

  const teacherActions = (row: ApiLeave) =>
    row.status === 'PENDING' ? (
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
    ) : null;

  return (
    <>
      <SectionHeader
        title="Leave"
        subtitle="Approve teacher leave and monitor student leave status"
      />

      {loading && <p className="text-sm text-gray-500">Loading leave requests...</p>}
      {error && <p className="mb-4 text-sm text-red-600">{error}</p>}

      {!loading && (
        <>
          <h2 className="mb-3 text-base font-semibold text-gray-900">Teacher leave</h2>
          <div className="mb-8 space-y-3 md:hidden">
            {teacherLeave.map((row) => (
              <Card key={row.id} className="p-4">
                <div className="flex items-start justify-between gap-2">
                  <PersonCell name={leaveFullName(row)} sub="Teacher" />
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
                    <PrimaryButton className="flex-1" onClick={() => review(row.id, 'APPROVED')}>
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
            {!teacherLeave.length && (
              <Card className="p-6 text-center">
                <p className="text-sm text-gray-500">No teacher leave requests.</p>
              </Card>
            )}
          </div>

          <div className="mb-8 hidden md:block">
            <TableShell columns={['Teacher', 'Dates', 'Reason', 'Status', '']}>
              {teacherLeave.map((row) => (
                <tr key={row.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <PersonCell name={leaveFullName(row)} />
                  </td>
                  <td className="px-4 py-3 text-gray-500">
                    {formatLeaveDates(row.startDate, row.endDate)}
                  </td>
                  <td className="px-4 py-3 text-gray-500">{row.reason}</td>
                  <td className="px-4 py-3">
                    <Badge tone={leaveTone(row.status)}>{leaveStatusLabel(row.status)}</Badge>
                  </td>
                  <td className="px-2 py-3">{teacherActions(row)}</td>
                </tr>
              ))}
            </TableShell>
            {!teacherLeave.length && (
              <Card className="mt-3 p-6 text-center">
                <p className="text-sm text-gray-500">No teacher leave requests.</p>
              </Card>
            )}
          </div>

          <div className="mb-3 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h2 className="text-base font-semibold text-gray-900">Student leave</h2>
              <p className="mt-1 text-sm text-gray-500">
                Reviewed by each student’s class teacher. Admin view only.
              </p>
            </div>
            <label className="block text-sm text-gray-700 sm:w-56">
              Class
              <select
                value={studentClassFilter}
                onChange={(event) => setStudentClassFilter(event.target.value)}
                className="mt-1.5 h-10 w-full rounded-lg border border-gray-200 bg-white px-3 text-sm text-gray-700 focus:border-blue-600 focus:outline-none focus:ring-1 focus:ring-blue-600"
              >
                {studentClassOptions.map((name) => (
                  <option key={name} value={name}>
                    {name}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <div className="space-y-3 md:hidden">
            {studentLeave.map((row) => (
              <Card key={row.id} className="p-4">
                <div className="flex items-start justify-between gap-2">
                  <PersonCell
                    name={leaveFullName(row)}
                    sub={`${leaveClassName(row)} · Roll ${leaveRoll(row)}`}
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
              </Card>
            ))}
            {!studentLeave.length && (
              <Card className="p-6 text-center">
                <p className="text-sm text-gray-500">
                  {studentLeaveAll.length
                    ? 'No student leave requests for this class.'
                    : 'No student leave requests.'}
                </p>
              </Card>
            )}
          </div>

          <div className="hidden md:block">
            <TableShell columns={['Student', 'Class', 'Roll no.', 'Dates', 'Reason', 'Status']}>
              {studentLeave.map((row) => (
                <tr key={row.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <PersonCell name={leaveFullName(row)} />
                  </td>
                  <td className="px-4 py-3 text-gray-500">{leaveClassName(row)}</td>
                  <td className="px-4 py-3 text-gray-500">{leaveRoll(row)}</td>
                  <td className="px-4 py-3 text-gray-500">
                    {formatLeaveDates(row.startDate, row.endDate)}
                  </td>
                  <td className="px-4 py-3 text-gray-500">{row.reason}</td>
                  <td className="px-4 py-3">
                    <Badge tone={leaveTone(row.status)}>{leaveStatusLabel(row.status)}</Badge>
                  </td>
                </tr>
              ))}
            </TableShell>
            {!studentLeave.length && (
              <Card className="mt-3 p-6 text-center">
                <p className="text-sm text-gray-500">
                  {studentLeaveAll.length
                    ? 'No student leave requests for this class.'
                    : 'No student leave requests.'}
                </p>
              </Card>
            )}
          </div>
        </>
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
    const message: ChatMessage = {
      id: `out-${Date.now()}`,
      from: 'out',
      text,
      time: 'Just now',
    };
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
      <SectionHeader title="Messages" subtitle="Internal inbox with staff and parents" />
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

        <div
          className={cn(
            'min-w-0 flex-1 flex-col',
            mobileShowChat ? 'flex' : 'hidden md:flex',
          )}
        >
          <div className="flex items-center gap-2 border-b border-gray-200 px-3 py-3 md:px-4">
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
              <p className="truncate text-xs text-gray-400">{active.role}</p>
            </div>
          </div>
          <div className="flex-1 space-y-3 overflow-y-auto bg-gray-50 px-3 py-4 md:px-4">
            {active.messages.map((message) => (
              <div
                key={message.id}
                className={cn('flex', message.from === 'out' ? 'justify-end' : 'justify-start')}
              >
                <div
                  className={cn(
                    'max-w-[80%] px-3 py-2 text-sm',
                    message.from === 'out'
                      ? 'rounded-2xl rounded-br-md bg-blue-600 text-white'
                      : 'rounded-2xl rounded-bl-md border border-gray-200 bg-white text-gray-900',
                  )}
                >
                  <p>{message.text}</p>
                  <p
                    className={cn(
                      'mt-1 text-[11px]',
                      message.from === 'out' ? 'text-blue-100' : 'text-gray-400',
                    )}
                  >
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

const PAGES: Record<PageId, () => ReactNode> = {
  dashboard: DashboardPage,
  posts: PostsPage,
  users: UsersPage,
  classes: ClassesPage,
  attendance: AttendancePage,
  grades: GradesPage,
  leave: LeavePage,
  messages: MessagesPage,
};

export default function AdminPortal() {
  const { user, logout } = useAuth();
  const [page, setPage] = useState<PageId>('dashboard');
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [searchExpanded, setSearchExpanded] = useState(false);

  const displayName = user ? `${user.firstName} ${user.lastName}` : 'Divya Menon';
  const displayRole = user?.role === 'ADMIN' ? 'Administrator' : user?.role ?? 'Administrator';

  const goTo = (id: PageId) => {
    setPage(id);
    setDrawerOpen(false);
    setSearchExpanded(false);
  };

  const Page = PAGES[page];

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
            <p className="truncate text-sm font-semibold text-gray-900">Greenfield International</p>
            <p className="text-xs text-gray-400">Admin Portal</p>
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
        <div className="border-t border-gray-200 px-4 py-3">
          <div className="flex items-center gap-3">
            <Avatar name={displayName} />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-gray-900">{displayName}</p>
              <p className="text-xs text-gray-400">{displayRole}</p>
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
                  placeholder="Search students, staff, classes"
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
                <IconButton
                  label="Open menu"
                  onClick={() => setDrawerOpen(true)}
                  className="md:hidden"
                >
                  <Menu className="h-5 w-5" />
                </IconButton>
                <p className="truncate text-sm font-medium text-gray-900 md:hidden">
                  {PAGE_LABELS[page]}
                </p>
                <p className="hidden text-sm text-gray-400 md:block">
                  Admin / <span className="text-gray-900">{PAGE_LABELS[page]}</span>
                </p>
              </div>
              <div className="flex items-center gap-2 md:gap-4">
                <IconButton
                  label="Search"
                  onClick={() => setSearchExpanded(true)}
                  className="md:hidden"
                >
                  <Search className="h-4 w-4" />
                </IconButton>
                <div className="relative hidden md:block">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                  <input
                    placeholder="Search students, staff, classes"
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
          <Page />
        </main>
      </div>
    </div>
  );
}
