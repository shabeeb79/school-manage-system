import { useEffect, useState } from 'react';
import api from '../api/client';

export default function MyStudentsPage() {
  const [students, setStudents] = useState<any[]>([]);
  const [editing, setEditing] = useState<string | null>(null);
  const [form, setForm] = useState({
    parentName: '',
    parentPhone: '',
    address: '',
  });

  const load = () =>
    api.get('/users/my-students').then((r) => setStudents(r.data));

  useEffect(() => {
    load().catch(console.error);
  }, []);

  return (
    <div className="page">
      <header className="page-header">
        <h1>My students</h1>
        <p className="muted">Students in your assigned class.</p>
      </header>

      <div className="panel">
        <table>
          <thead>
            <tr>
              <th>Student ID</th>
              <th>Name</th>
              <th>Email</th>
              <th>Parent</th>
              <th>Phone</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {students.map((st) => (
              <tr key={st.id}>
                <td>{st.studentId}</td>
                <td>
                  {st.user?.firstName} {st.user?.lastName}
                </td>
                <td>{st.user?.email}</td>
                <td>
                  {editing === st.userId ? (
                    <input
                      value={form.parentName}
                      onChange={(e) =>
                        setForm({ ...form, parentName: e.target.value })
                      }
                    />
                  ) : (
                    st.parentName || '—'
                  )}
                </td>
                <td>
                  {editing === st.userId ? (
                    <input
                      value={form.parentPhone}
                      onChange={(e) =>
                        setForm({ ...form, parentPhone: e.target.value })
                      }
                    />
                  ) : (
                    st.parentPhone || '—'
                  )}
                </td>
                <td>
                  {editing === st.userId ? (
                    <button
                      className="btn primary"
                      type="button"
                      onClick={async () => {
                        await api.patch(`/users/students/${st.userId}`, form);
                        setEditing(null);
                        await load();
                      }}
                    >
                      Save
                    </button>
                  ) : (
                    <button
                      className="btn ghost"
                      type="button"
                      onClick={() => {
                        setEditing(st.userId);
                        setForm({
                          parentName: st.parentName || '',
                          parentPhone: st.parentPhone || '',
                          address: st.address || '',
                        });
                      }}
                    >
                      Edit
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!students.length && (
          <p className="muted">No students assigned to your class yet.</p>
        )}
      </div>
    </div>
  );
}
