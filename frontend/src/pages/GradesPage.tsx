import { useEffect, useState, type FormEvent } from 'react';
import api from '../api/client';
import { useAuth } from '../auth/AuthContext';

export default function GradesPage() {
  const { user } = useAuth();
  const [grades, setGrades] = useState<any[]>([]);
  const [card, setCard] = useState<any>(null);
  const [students, setStudents] = useState<any[]>([]);
  const [form, setForm] = useState({
    studentId: '',
    subject: '',
    examName: '',
    score: 0,
    maxScore: 100,
    gradeLetter: '',
    term: 'Term 1',
  });

  const canEdit = user?.role === 'ADMIN' || user?.role === 'STAFF';

  const load = async () => {
    if (user?.role === 'STUDENT') {
      const cardRes = await api.get('/grades/my-card');
      setCard(cardRes.data);
      setGrades(cardRes.data.grades || []);
    } else {
      const [g, s] = await Promise.all([
        api.get('/grades'),
        user?.role === 'STAFF'
          ? api.get('/users/my-students')
          : api.get('/users', { params: { role: 'STUDENT' } }),
      ]);
      setGrades(g.data);
      setStudents(
        user?.role === 'STAFF'
          ? s.data.map((st: any) => st.user)
          : s.data,
      );
    }
  };

  useEffect(() => {
    load().catch(console.error);
  }, [user]);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    await api.post('/grades', {
      ...form,
      score: Number(form.score),
      maxScore: Number(form.maxScore),
    });
    await load();
  };

  const viewCard = async (studentId: string) => {
    const res = await api.get(`/grades/card/${studentId}`);
    setCard(res.data);
  };

  return (
    <div className="page">
      <header className="page-header">
        <h1>{user?.role === 'STUDENT' ? 'Grade card' : 'Grades'}</h1>
      </header>

      {canEdit && (
        <div className="grid-2">
          <form className="panel stack" onSubmit={onSubmit}>
            <h2>Record grade</h2>
            <label>
              Student
              <select
                value={form.studentId}
                onChange={(e) => setForm({ ...form, studentId: e.target.value })}
                required
              >
                <option value="">Select</option>
                {students.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.firstName} {s.lastName}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Subject
              <input
                value={form.subject}
                onChange={(e) => setForm({ ...form, subject: e.target.value })}
                required
              />
            </label>
            <label>
              Exam
              <input
                value={form.examName}
                onChange={(e) => setForm({ ...form, examName: e.target.value })}
                required
              />
            </label>
            <label>
              Score
              <input
                type="number"
                value={form.score}
                onChange={(e) =>
                  setForm({ ...form, score: Number(e.target.value) })
                }
                required
              />
            </label>
            <label>
              Max score
              <input
                type="number"
                value={form.maxScore}
                onChange={(e) =>
                  setForm({ ...form, maxScore: Number(e.target.value) })
                }
                required
              />
            </label>
            <label>
              Letter
              <input
                value={form.gradeLetter}
                onChange={(e) =>
                  setForm({ ...form, gradeLetter: e.target.value })
                }
              />
            </label>
            <label>
              Term
              <input
                value={form.term}
                onChange={(e) => setForm({ ...form, term: e.target.value })}
              />
            </label>
            <button className="btn primary" type="submit">
              Save grade
            </button>
          </form>

          <div className="panel stack">
            <h2>Open grade card</h2>
            {students.map((s) => (
              <button
                key={s.id}
                type="button"
                className="btn ghost"
                onClick={() => viewCard(s.id)}
              >
                {s.firstName} {s.lastName}
              </button>
            ))}
          </div>
        </div>
      )}

      {card && (
        <section className="panel">
          <h2>
            Grade card — {card.student?.firstName} {card.student?.lastName}
          </h2>
          <p className="muted">
            {card.student?.studentProfile?.schoolClass?.name || 'No class'}
          </p>
          <div className="stat-row">
            {card.summary?.map((s: any) => (
              <div key={s.subject} className="stat">
                <span>{s.subject}</span>
                <strong>
                  {s.average}/{s.maxScore}
                </strong>
                <small>{s.gradeLetter || `${s.exams} exams`}</small>
              </div>
            ))}
          </div>
        </section>
      )}

      <div className="panel">
        <h2>Grade records</h2>
        <table>
          <thead>
            <tr>
              <th>Student</th>
              <th>Subject</th>
              <th>Exam</th>
              <th>Score</th>
              <th>Term</th>
            </tr>
          </thead>
          <tbody>
            {grades.map((g) => (
              <tr key={g.id}>
                <td>
                  {g.student
                    ? `${g.student.firstName} ${g.student.lastName}`
                    : '—'}
                </td>
                <td>{g.subject}</td>
                <td>{g.examName}</td>
                <td>
                  {g.score}/{g.maxScore} {g.gradeLetter || ''}
                </td>
                <td>{g.term || '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
