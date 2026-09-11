import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../AuthContext';

const linksByRole = {
  ADMIN: [
    { to: '/', label: 'Dashboard' },
    { to: '/posts', label: 'Posts' },
    { to: '/users', label: 'Users' },
    { to: '/classes', label: 'Classes' },
    { to: '/attendance', label: 'Attendance' },
    { to: '/grades', label: 'Grades' },
    { to: '/assignments', label: 'Assignments' },
    { to: '/leave', label: 'Leave' },
    { to: '/messages', label: 'Messages' },
  ],
  STAFF: [
    { to: '/', label: 'Dashboard' },
    { to: '/my-students', label: 'My Students' },
    { to: '/attendance', label: 'Attendance' },
    { to: '/grades', label: 'Grades' },
    { to: '/assignments', label: 'Assignments' },
    { to: '/leave', label: 'Leave' },
    { to: '/messages', label: 'Messages' },
    { to: '/feed', label: 'Announcements' },
  ],
  STUDENT: [
    { to: '/', label: 'Dashboard' },
    { to: '/feed', label: 'Announcements' },
    { to: '/attendance', label: 'Attendance' },
    { to: '/grades', label: 'Grade Card' },
    { to: '/assignments', label: 'Assignments' },
    { to: '/leave', label: 'Leave' },
    { to: '/messages', label: 'Messages' },
  ],
};

export default function Layout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  if (!user) return null;

  const links = linksByRole[user.role];

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <span className="brand-mark">SMS</span>
          <div>
            <strong>School Manage</strong>
            <p>{user.role.toLowerCase()} portal</p>
          </div>
        </div>
        <nav>
          {links.map((link) => (
            <NavLink
              key={link.to}
              to={link.to}
              end={link.to === '/'}
              className={({ isActive }) => (isActive ? 'nav-link active' : 'nav-link')}
            >
              {link.label}
            </NavLink>
          ))}
        </nav>
        <div className="sidebar-footer">
          <p>
            {user.firstName} {user.lastName}
          </p>
          <button
            type="button"
            className="btn ghost"
            onClick={() => {
              logout();
              navigate('/login');
            }}
          >
            Sign out
          </button>
        </div>
      </aside>
      <main className="main">
        <Outlet />
      </main>
    </div>
  );
}
