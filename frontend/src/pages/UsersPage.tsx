import { useEffect, useState, type FormEvent } from 'react';
import api from '../api/client';

export default function UsersPage() {
  const [users, setUsers] = useState<any[]>([]);
  const [classes, setClasses] = useState<any[]>([]);
  const [form, setForm] = useState({
    email: '',
    password: 'password123',
    firstName: '',
    lastName: '',
    role: 'STUDENT',
    studentId: '',
    employeeId: '',
    schoolClassId: '',
    assignedClassId: '',
  });

  const load = async () => {
    const [u, c] = await Promise.all([api.get('/users'), api.get('/classes')]);
    setUsers(u.data);
    setClasses(c.data);
  };

  useEffect(() => {
    load().catch(console.error);
  }, []);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    await api.post('/auth/register', {
      ...form,
      studentId: form.role === 'STUDENT' ? form.studentId : undefined,
      employeeId: form.role === 'STAFF' ? form.employeeId : undefined,
      schoolClassId: form.role === 'STUDENT' ? form.schoolClassId || undefined : undefined,
      assignedClassId: form.role === 'STAFF' ? form.assignedClassId || undefined : undefined,
    });
    setForm({
      email: '',
      password: 'password123',
      firstName: '',
      lastName: '',
      role: 'STUDENT',
      studentId: '',
      employeeId: '',
      schoolClassId: '',
      assignedClassId: '',
    });
    await load();
  };

  return (
    <div className="page">
      <header className="page-header">
        <h1>Users</h1>
        <p className="muted">Create admin, staff, and student accounts.</p>
      </header>
      <div className="grid-2">
        <form className="panel stack" onSubmit={onSubmit}>
          <h2>Register user</h2>
          <label>
            Role
            <select
              value={form.role}
              onChange={(e) => setForm({ ...form, role: e.target.value })}
            >
              <option value="ADMIN">ADMIN</option>
              <option value="STAFF">STAFF</option>
              <option value="STUDENT">STUDENT</option>
            </select>
          </label>
          <label>
            First name
            <input
              value={form.firstName}
              onChange={(e) => setForm({ ...form, firstName: e.target.value })}
              required
            />
          </label>
          <label>
            Last name
            <input
              value={form.lastName}
              onChange={(e) => setForm({ ...form, lastName: e.target.value })}
              required
            />
          </label>
          <label>
            Email
            <input
              type="email"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              required
            />
          </label>
          <label>
            Password
            <input
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
              required
            />
          </label>
          {form.role === 'STUDENT' && (
            <>
              <label>
                Student ID
                <input
                  value={form.studentId}
                  onChange={(e) =>
                    setForm({ ...form, studentId: e.target.value })
                  }
                  required
                />
              </label>
              <label>
                Class
                <select
                  value={form.schoolClassId}
                  onChange={(e) =>
                    setForm({ ...form, schoolClassId: e.target.value })
                  }
                >
                  <option value="">None</option>
                  {classes.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </label>
            </>
          )}
          {form.role === 'STAFF' && (
            <>
              <label>
                Employee ID
                <input
                  value={form.employeeId}
                  onChange={(e) =>
                    setForm({ ...form, employeeId: e.target.value })
                  }
                  required
                />
              </label>
              <label>
                Assigned class
                <select
                  value={form.assignedClassId}
                  onChange={(e) =>
                    setForm({ ...form, assignedClassId: e.target.value })
                  }
                >
                  <option value="">None</option>
                  {classes.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </label>
            </>
          )}
          <button className="btn primary" type="submit">
            Create user
          </button>
        </form>

        <div className="panel">
          <h2>Directory</h2>
          <table>
            <thead>
              <tr>
                <th>Name</th>
                <th>Email</th>
                <th>Role</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id}>
                  <td>
                    {u.firstName} {u.lastName}
                  </td>
                  <td>{u.email}</td>
                  <td>{u.role}</td>
                  <td>
                    <button
                      className="btn ghost"
                      type="button"
                      onClick={async () => {
                        await api.patch(`/users/${u.id}/active`, {
                          isActive: !u.isActive,
                        });
                        await load();
                      }}
                    >
                      {u.isActive ? 'Active' : 'Inactive'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
