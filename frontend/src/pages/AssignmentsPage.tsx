import { FormEvent, useEffect, useState } from 'react';
import api from '../api/client';
import { useAuth } from '../auth/AuthContext';

export default function AssignmentsPage() {
  const { user } = useAuth();
  const [items, setItems] = useState<any[]>([]);
  const [classes, setClasses] = useState<any[]>([]);
  const [form, setForm] = useState({
    title: '',
    description: '',
    subject: '',
    dueDate: '',
    schoolClassId: '',
    maxScore: 100,
  });
  const [submitText, setSubmitText] = useState<Record<string, string>>({});
  const canCreate = user?.role === 'ADMIN' || user?.role === 'STAFF';

  const load = async () => {
    const a = await api.get('/assignments');
    setItems(a.data);
    if (canCreate) {
      const c = await api.get('/classes');
      setClasses(c.data);
    }
  };

  useEffect(() => {
    load().catch(console.error);
  }, [user]);

  const onCreate = async (e: FormEvent) => {
    e.preventDefault();
    await api.post('/assignments', {
      ...form,
      maxScore: Number(form.maxScore),
    });
    await load();
  };

  return (
    <div className="page">
      <header className="page-header">
        <h1>Assignments</h1>
      </header>

      {canCreate && (
        <form className="panel stack" onSubmit={onCreate}>
          <h2>Create assignment</h2>
          <label>
            Title
            <input
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              required
            />
          </label>
          <label>
            Description
            <textarea
              value={form.description}
              onChange={(e) =>
                setForm({ ...form, description: e.target.value })
              }
              required
            />
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
            Due date
            <input
              type="datetime-local"
              value={form.dueDate}
              onChange={(e) => setForm({ ...form, dueDate: e.target.value })}
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
              required
            >
              <option value="">Select</option>
              {classes.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>
          <button className="btn primary" type="submit">
            Create
          </button>
        </form>
      )}

      <div className="list">
        {items.map((a) => (
          <article key={a.id} className="panel stack">
            <div className="row-between">
              <div>
                <h2>{a.title}</h2>
                <p className="muted">
                  {a.subject} · {a.schoolClass?.name} · due{' '}
                  {new Date(a.dueDate).toLocaleString()}
                </p>
              </div>
              <span className="tag">{a._count?.submissions || 0} submissions</span>
            </div>
            <p>{a.description}</p>

            {user?.role === 'STUDENT' && (
              <div className="stack">
                <textarea
                  placeholder="Your submission"
                  value={submitText[a.id] || a.submissions?.[0]?.content || ''}
                  onChange={(e) =>
                    setSubmitText({ ...submitText, [a.id]: e.target.value })
                  }
                />
                <button
                  className="btn primary"
                  type="button"
                  onClick={async () => {
                    await api.post(`/assignments/${a.id}/submit`, {
                      content: submitText[a.id] || '',
                    });
                    await load();
                  }}
                >
                  Submit
                </button>
                {a.submissions?.[0]?.isGraded && (
                  <p className="muted">
                    Graded: {a.submissions[0].score}/{a.maxScore} —{' '}
                    {a.submissions[0].feedback}
                  </p>
                )}
              </div>
            )}

            {canCreate &&
              a.submissions?.map((sub: any) => (
                <div key={sub.id} className="list-item">
                  <div>
                    <strong>
                      {sub.student?.firstName} {sub.student?.lastName}
                    </strong>
                    <p>{sub.content}</p>
                  </div>
                  {!sub.isGraded && (
                    <button
                      className="btn ghost"
                      type="button"
                      onClick={async () => {
                        const score = Number(
                          prompt('Score', String(a.maxScore)) || 0,
                        );
                        await api.patch(
                          `/assignments/submissions/${sub.id}/grade`,
                          { score, feedback: 'Reviewed' },
                        );
                        await load();
                      }}
                    >
                      Grade
                    </button>
                  )}
                  {sub.isGraded && (
                    <span className="tag">
                      {sub.score}/{a.maxScore}
                    </span>
                  )}
                </div>
              ))}
          </article>
        ))}
      </div>
    </div>
  );
}
