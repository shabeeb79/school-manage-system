import {
  Bell,
  CalendarOff,
  Check,
  ChevronDown,
  ChevronLeft,
  ClipboardCheck,
  GraduationCap,
  LayoutDashboard,
  Megaphone,
  Menu,
  MessageSquare,
  LogOut,
  Paperclip,
  Plus,
  School,
  Search,
  Send,
  TrendingDown,
  TrendingUp,
  Users,
  X,
} from 'lucide-react';
import { useState, type ReactNode } from 'react';
import { useAuth } from './auth/AuthContext';
import {
  Avatar,
  Badge,
  Card,
  IconButton,
  OverflowMenu,
  PersonCell,
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

type LeaveStatus = 'Approved' | 'Pending' | 'Rejected';

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
  if (role === 'Admin') return 'blue';
  if (role === 'Teacher') return 'slate';
  if (role === 'Student') return 'green';
  return 'amber';
}

const WEEKLY_ATTENDANCE = [
  { day: 'Mon', value: 96 },
  { day: 'Tue', value: 94 },
  { day: 'Wed', value: 97 },
  { day: 'Thu', value: 93 },
  { day: 'Fri', value: 95 },
  { day: 'Sat', value: 48 },
  { day: 'Sun', value: 12 },
];

const ACTIVITY = [
  { name: 'Kavya Menon', action: 'marked attendance for Grade 8 - A', time: '12 min ago' },
  { name: 'Suresh Pillai', action: 'published “Science practical schedule”', time: '1 hr ago' },
  { name: 'Fathima Beevi', action: 'entered English grades for Grade 10 - A', time: '2 hr ago' },
  { name: 'Rahul Varma', action: 'submitted Climate change essay', time: '3 hr ago' },
  { name: 'Divya Menon', action: 'approved leave for Arjun Nair', time: '5 hr ago' },
];

const POSTS = [
  {
    id: 'p1',
    audience: 'All school',
    tone: 'blue' as BadgeTone,
    date: '8 Sep 2026',
    title: 'Term 2 parent-teacher meeting on 19 September',
    author: 'Divya Menon',
  },
  {
    id: 'p2',
    audience: 'Grade 9',
    tone: 'green' as BadgeTone,
    date: '6 Sep 2026',
    title: 'Science practical schedule for Term 2',
    author: 'Suresh Pillai',
  },
  {
    id: 'p3',
    audience: 'Staff',
    tone: 'slate' as BadgeTone,
    date: '4 Sep 2026',
    title: 'Staff meeting — Friday 3:00 PM, Conference Room',
    author: 'Divya Menon',
  },
  {
    id: 'p4',
    audience: 'Grade 8 - A',
    tone: 'amber' as BadgeTone,
    date: '2 Sep 2026',
    title: 'Mathematics unit test on 15 September',
    author: 'Kavya Menon',
  },
];

const USERS = [
  { id: 'u1', name: 'Divya Menon', role: 'Admin', email: 'divya.menon@greenfield.edu.in', status: 'Active' },
  { id: 'u2', name: 'Kavya Menon', role: 'Teacher', email: 'kavya.menon@greenfield.edu.in', status: 'Active' },
  { id: 'u3', name: 'Suresh Pillai', role: 'Teacher', email: 'suresh.pillai@greenfield.edu.in', status: 'Active' },
  { id: 'u4', name: 'Fathima Beevi', role: 'Teacher', email: 'fathima.beevi@greenfield.edu.in', status: 'Active' },
  { id: 'u5', name: 'Rahul Varma', role: 'Student', email: 'rahul.varma@student.greenfield.edu.in', status: 'Active' },
  { id: 'u6', name: 'Arjun Nair', role: 'Student', email: 'arjun.nair@student.greenfield.edu.in', status: 'Suspended' },
  { id: 'u7', name: 'Meera Krishnan', role: 'Parent', email: 'meera.krishnan@gmail.com', status: 'Active' },
  { id: 'u8', name: 'Ananya Iyer', role: 'Student', email: 'ananya.iyer@student.greenfield.edu.in', status: 'Active' },
];

const CLASSES = [
  { id: 'c1', name: 'Grade 8 - A', room: 'Room 12', teacher: 'Kavya Menon', students: 38 },
  { id: 'c2', name: 'Grade 9 - B', room: 'Room 21', teacher: 'Suresh Pillai', students: 36 },
  { id: 'c3', name: 'Grade 10 - A', room: 'Room 05', teacher: 'Fathima Beevi', students: 40 },
  { id: 'c4', name: 'Grade 7 - C', room: 'Room 18', teacher: 'Priya Nambiar', students: 34 },
  { id: 'c5', name: 'Grade 6 - B', room: 'Room 09', teacher: 'Vikram Rao', students: 32 },
  { id: 'c6', name: 'Grade 11 - Science', room: 'Lab 2', teacher: 'Meera Krishnan', students: 28 },
];

const ATTENDANCE_ROWS = [
  { roll: '01', name: 'Rahul Varma', status: 'Present' },
  { roll: '02', name: 'Ananya Iyer', status: 'Present' },
  { roll: '03', name: 'Arjun Nair', status: 'Absent' },
  { roll: '04', name: 'Aditi Nair', status: 'Late' },
  { roll: '05', name: 'Mohammed Irfan', status: 'Present' },
  { roll: '06', name: 'Lakshmi Pillai', status: 'Present' },
  { roll: '07', name: 'Nikhil Varma', status: 'Absent' },
  { roll: '08', name: 'Sneha Menon', status: 'Present' },
];

const GRADE_ROWS = [
  { subject: 'Mathematics', section: 'Grade 8 - A', average: 86, trend: 'up' as const, top: 'Ananya Iyer' },
  { subject: 'English', section: 'Grade 10 - A', average: 81, trend: 'down' as const, top: 'Lakshmi Pillai' },
  { subject: 'Science', section: 'Grade 9 - B', average: 78, trend: 'up' as const, top: 'Rahul Varma' },
  { subject: 'Social Studies', section: 'Grade 7 - C', average: 84, trend: 'up' as const, top: 'Sneha Menon' },
  { subject: 'Mathematics', section: 'Grade 11 - Science', average: 72, trend: 'down' as const, top: 'Mohammed Irfan' },
];

const INITIAL_LEAVE: {
  id: string;
  name: string;
  role: string;
  dates: string;
  reason: string;
  status: LeaveStatus;
}[] = [
  { id: 'l1', name: 'Kavya Menon', role: 'Teacher', dates: '18–20 Sep', reason: 'Family function', status: 'Pending' },
  { id: 'l2', name: 'Rahul Varma', role: 'Student', dates: '12 Sep', reason: 'Fever', status: 'Approved' },
  { id: 'l3', name: 'Suresh Pillai', role: 'Teacher', dates: '22 Sep', reason: 'Medical appointment', status: 'Pending' },
  { id: 'l4', name: 'Arjun Nair', role: 'Student', dates: '10 Sep', reason: 'Family travel', status: 'Rejected' },
  { id: 'l5', name: 'Fathima Beevi', role: 'Teacher', dates: '25–26 Sep', reason: 'Personal', status: 'Approved' },
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
          value="94.6%"
          trend={{ direction: 'down', percent: '0.8%' }}
          subtext="1,180 of 1,248 present"
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
            {WEEKLY_ATTENDANCE.map((item) => (
              <div key={item.day} className="flex h-full min-w-0 flex-1 flex-col items-center gap-2">
                <div className="flex w-full flex-1 items-end">
                  <div
                    className="w-full rounded-t-md bg-blue-600 transition-colors hover:bg-blue-700"
                    style={{ height: `${item.value}%` }}
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

function PostsPage() {
  return (
    <>
      <SectionHeader
        title="Posts"
        subtitle="Announcements for staff, classes, and the whole school"
        action={
          <PrimaryButton icon={<Plus className="h-4 w-4" />}>New post</PrimaryButton>
        }
      />
      <div className="space-y-3">
        {POSTS.map((post) => (
          <Card key={post.id} className="p-4 md:p-5">
            <div className="flex items-start gap-3">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge tone={post.tone}>{post.audience}</Badge>
                  <span className="text-xs text-gray-400">{post.date}</span>
                </div>
                <h2 className="mt-2 font-semibold text-gray-900">{post.title}</h2>
                <p className="mt-1 text-sm text-gray-500">Posted by {post.author}</p>
              </div>
              <OverflowMenu />
            </div>
          </Card>
        ))}
      </div>
    </>
  );
}

function UsersPage() {
  const [query, setQuery] = useState('');
  const [role, setRole] = useState('All roles');
  const filtered = USERS.filter((user) => {
    const matchesQuery =
      !query ||
      user.name.toLowerCase().includes(query.toLowerCase()) ||
      user.email.toLowerCase().includes(query.toLowerCase());
    const matchesRole = role === 'All roles' || user.role === role;
    return matchesQuery && matchesRole;
  });

  return (
    <>
      <SectionHeader
        title="Users"
        subtitle="Staff, students, and parent accounts"
        action={<PrimaryButton icon={<Plus className="h-4 w-4" />}>Add user</PrimaryButton>}
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
          <option>Parent</option>
        </select>
      </div>

      <div className="space-y-3 md:hidden">
        {filtered.map((user) => (
          <Card key={user.id} className="p-4">
            <div className="flex items-start justify-between gap-2">
              <PersonCell name={user.name} sub={user.email} />
              <OverflowMenu />
            </div>
            <div className="mt-3 flex flex-wrap gap-x-4 gap-y-2 text-sm">
              <p className="text-gray-500">
                Role: <Badge tone={roleTone(user.role)}>{user.role}</Badge>
              </p>
              <p className="text-gray-500">
                Status:{' '}
                <Badge tone={user.status === 'Active' ? 'green' : 'red'}>{user.status}</Badge>
              </p>
            </div>
          </Card>
        ))}
      </div>

      <div className="hidden md:block">
        <TableShell columns={['Name', 'Role', 'Email', 'Status', '']}>
          {filtered.map((user) => (
            <tr key={user.id} className="hover:bg-gray-50">
              <td className="px-4 py-3">
                <PersonCell name={user.name} />
              </td>
              <td className="px-4 py-3">
                <Badge tone={roleTone(user.role)}>{user.role}</Badge>
              </td>
              <td className="px-4 py-3 text-gray-500">{user.email}</td>
              <td className="px-4 py-3">
                <Badge tone={user.status === 'Active' ? 'green' : 'red'}>{user.status}</Badge>
              </td>
              <td className="px-2 py-3 text-right">
                <OverflowMenu />
              </td>
            </tr>
          ))}
        </TableShell>
      </div>
    </>
  );
}

function ClassesPage() {
  return (
    <>
      <SectionHeader
        title="Classes"
        subtitle="Sections, rooms, and class teachers"
        action={<PrimaryButton icon={<Plus className="h-4 w-4" />}>Add class</PrimaryButton>}
      />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {CLASSES.map((item) => (
          <Card key={item.id} className="p-4 md:p-5">
            <div className="flex items-start justify-between gap-3">
              <h2 className="font-semibold text-gray-900">{item.name}</h2>
              <Badge tone="slate">{item.room}</Badge>
            </div>
            <div className="mt-4 flex items-center gap-3">
              <Avatar name={item.teacher} size="sm" />
              <p className="text-sm text-gray-500">{item.teacher}</p>
            </div>
            <div className="mt-4 border-t border-gray-200 pt-3">
              <p className="text-sm text-gray-400">Students enrolled</p>
              <p className="mt-1 text-lg font-semibold text-gray-900">{item.students}</p>
            </div>
          </Card>
        ))}
      </div>
    </>
  );
}

function AttendancePage() {
  const statusTone = (status: string): BadgeTone => {
    if (status === 'Present') return 'green';
    if (status === 'Absent') return 'red';
    return 'amber';
  };

  return (
    <>
      <SectionHeader title="Attendance" subtitle="Daily register for Term 2, 2026" />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4 lg:gap-4">
        <StatCard label="Present today" value="1,180" subtext="94.6% of campus" icon={<Check className="h-4 w-4" />} />
        <StatCard label="Absent today" value="52" subtext="4.2% of campus" icon={<X className="h-4 w-4" />} />
        <StatCard label="Late arrivals" value="16" subtext="1.3% of campus" icon={<Bell className="h-4 w-4" />} />
        <StatCard label="Sections marked" value="28 / 32" subtext="4 still open" icon={<ClipboardCheck className="h-4 w-4" />} />
      </div>
      <div className="mt-6 mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="font-semibold text-gray-900">Grade 8 - A</h2>
          <p className="text-sm text-gray-400">Friday, 11 September 2026</p>
        </div>
        <button
          type="button"
          className="inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-gray-200 bg-white px-3 text-sm font-medium text-gray-700 hover:bg-gray-50"
        >
          Change section
          <ChevronDown className="h-4 w-4 text-gray-400" />
        </button>
      </div>
      <TableShell columns={['Roll no.', 'Student', 'Status', '']}>
        {ATTENDANCE_ROWS.map((row) => (
          <tr key={row.roll} className="hover:bg-gray-50">
            <td className="px-4 py-3 text-gray-500">{row.roll}</td>
            <td className="px-4 py-3">
              <PersonCell name={row.name} />
            </td>
            <td className="px-4 py-3">
              <Badge tone={statusTone(row.status)}>{row.status}</Badge>
            </td>
            <td className="px-2 py-3 text-right">
              <OverflowMenu />
            </td>
          </tr>
        ))}
      </TableShell>
    </>
  );
}

function GradesPage() {
  return (
    <>
      <SectionHeader
        title="Grades"
        subtitle="Class averages for the latest assessments"
        action={<PrimaryButton icon={<Plus className="h-4 w-4" />}>Enter grades</PrimaryButton>}
      />
      <TableShell columns={['Subject', 'Section', 'Class average', 'Top scorer', '']}>
        {GRADE_ROWS.map((row) => (
          <tr key={`${row.subject}-${row.section}`} className="hover:bg-gray-50">
            <td className="px-4 py-3 font-medium text-gray-900">{row.subject}</td>
            <td className="px-4 py-3 text-gray-500">{row.section}</td>
            <td className="px-4 py-3">
              <span className="inline-flex items-center gap-1.5">
                <span className="font-medium text-gray-900">{row.average}%</span>
                {row.trend === 'up' ? (
                  <TrendingUp className="h-3.5 w-3.5 text-green-600" />
                ) : (
                  <TrendingDown className="h-3.5 w-3.5 text-red-600" />
                )}
              </span>
            </td>
            <td className="px-4 py-3">
              <PersonCell name={row.top} />
            </td>
            <td className="px-2 py-3 text-right">
              <OverflowMenu />
            </td>
          </tr>
        ))}
      </TableShell>
    </>
  );
}

function LeavePage() {
  const [rows, setRows] = useState(INITIAL_LEAVE);

  const setStatus = (id: string, status: LeaveStatus) => {
    setRows((current) => current.map((row) => (row.id === id ? { ...row, status } : row)));
  };

  const tone = (status: LeaveStatus): BadgeTone => {
    if (status === 'Approved') return 'green';
    if (status === 'Rejected') return 'red';
    return 'amber';
  };

  const actions = (row: (typeof rows)[number]) =>
    row.status === 'Pending' ? (
      <div className="flex items-center justify-end">
        <IconButton
          label={`Approve leave for ${row.name}`}
          onClick={() => setStatus(row.id, 'Approved')}
          className="text-green-600 hover:bg-green-50 hover:text-green-700"
        >
          <Check className="h-4 w-4" />
        </IconButton>
        <IconButton
          label={`Reject leave for ${row.name}`}
          onClick={() => setStatus(row.id, 'Rejected')}
          className="text-red-600 hover:bg-red-50 hover:text-red-700"
        >
          <X className="h-4 w-4" />
        </IconButton>
      </div>
    ) : (
      <div className="flex justify-end">
        <OverflowMenu />
      </div>
    );

  return (
    <>
      <SectionHeader title="Leave" subtitle="Staff and student leave requests" />

      <div className="space-y-3 md:hidden">
        {rows.map((row) => (
          <Card key={row.id} className="p-4">
            <div className="flex items-start justify-between gap-2">
              <PersonCell name={row.name} sub={row.role} />
              {actions(row)}
            </div>
            <dl className="mt-3 space-y-2 text-sm">
              <div className="flex justify-between gap-3">
                <dt className="text-gray-400">Dates</dt>
                <dd className="text-gray-700">{row.dates}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-gray-400">Reason</dt>
                <dd className="text-right text-gray-700">{row.reason}</dd>
              </div>
              <div className="flex items-center justify-between gap-3">
                <dt className="text-gray-400">Status</dt>
                <dd>
                  <Badge tone={tone(row.status)}>{row.status}</Badge>
                </dd>
              </div>
            </dl>
          </Card>
        ))}
      </div>

      <div className="hidden md:block">
        <TableShell columns={['Name', 'Role', 'Dates', 'Reason', 'Status', '']}>
          {rows.map((row) => (
            <tr key={row.id} className="hover:bg-gray-50">
              <td className="px-4 py-3">
                <PersonCell name={row.name} />
              </td>
              <td className="px-4 py-3 text-gray-500">{row.role}</td>
              <td className="px-4 py-3 text-gray-500">{row.dates}</td>
              <td className="px-4 py-3 text-gray-500">{row.reason}</td>
              <td className="px-4 py-3">
                <Badge tone={tone(row.status)}>{row.status}</Badge>
              </td>
              <td className="px-2 py-3">{actions(row)}</td>
            </tr>
          ))}
        </TableShell>
      </div>
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
