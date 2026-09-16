import { useEffect, useState, type FormEvent } from 'react';
import api from '../api/client';
import { useAuth } from '../auth/AuthContext';

const statuses = ['PRESENT', 'ABSENT', 'LATE', 'EXCUSED'];

export default function AttendancePage() {
  const { user } = useAuth();
  const [records, setRecords] = useState<any[]>([]);
  const [students, setStudents] = useState<any[]>([]);
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [entries, setEntries] = useState<Record<string, string>>({});
  const canMark = user?.role === 'ADMIN' || user?.role === 'STAFF';

  const load = async () => {
    const res = await api.get('/attendance', { params: { date } });
    setRecords(res.data);
    if (canMark) {
      const s =
        user?.role === 'STAFF'
          ? await api.get('/users/my-students')
          : await api.get('/users', { params: { role: 'STUDENT' } });
      const list =
        user?.role === 'STAFF'
          ? s.data
          : s.data.map((u: any) => ({
              ...u.studentProfile,
              user: u,
            }));
      setStudents(list);
      const map: Record<string, string> = {};
      list.forEach((st: any) => {
        const id = st.user?.id || st.userId;
        const existing = res.data.find((r: any) => r.studentId === id);
        map[id] = existing?.status || 'PRESENT';
      });
      setEntries(map);
    }
  };

  useEffect(() => {
    load().catch(console.error);
  }, [date, user]);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const classId =
      user?.staffProfile?.assignedClassId ||
      students[0]?.schoolClassId ||
      undefined;
    await api.post('/attendance', {
      date,
      schoolClassId: classId,
      entries: Object.entries(entries).map(([studentId, status]) => ({
        studentId,
        status,
      })),
    });
    await load();
  };

  return (
    <div className="page">
      <header className="page-header">
        <h1>Attendance</h1>
        <input
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
        />
      </header>

      {canMark && (
        <form className="panel stack" onSubmit={onSubmit}>
          <h2>Mark attendance</h2>
          {students.map((st) => {
            const id = st.user?.id || st.userId;
            const name = st.user
              ? `${st.user.firstName} ${st.user.lastName}`
              : id;
            return (
              <label key={id} className="row-between">
                <span>{name}</span>
                <select
                  value={entries[id] || 'PRESENT'}
                  onChange={(e) =>
                    setEntries({ ...entries, [id]: e.target.value })
                  }
                >
                  {statuses.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </label>
            );
          })}
          <button className="btn primary" type="submit">
            Save attendance
          </button>
        </form>
      )}

      <div className="panel">
        <h2>Records</h2>
        <table>
          <thead>
            <tr>
              <th>Student</th>
              <th>Date</th>
              <th>Status</th>
              <th>Remarks</th>
            </tr>
          </thead>
          <tbody>
            {records.map((r) => (
              <tr key={r.id}>
                <td>
                  {r.student?.firstName} {r.student?.lastName}
                </td>
                <td>{String(r.date).slice(0, 10)}</td>
                <td>
                  <span className="tag">{r.status}</span>
                </td>
                <td>{r.remarks || '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
