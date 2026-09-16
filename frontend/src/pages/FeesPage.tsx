import { useEffect, useState, type FormEvent } from 'react';
import api from '../api/client';
import { useAuth } from '../auth/AuthContext';

export default function FeesPage() {
  const { user } = useAuth();
  const [fees, setFees] = useState<any[]>([]);
  const [students, setStudents] = useState<any[]>([]);
  const [form, setForm] = useState({
    studentId: '',
    title: '',
    description: '',
    amount: 0,
    dueDate: '',
  });

  const load = async () => {
    const f = await api.get('/fees');
    setFees(f.data);
    if (user?.role === 'ADMIN') {
      const s = await api.get('/users', { params: { role: 'STUDENT' } });
      setStudents(s.data);
    }
  };

  useEffect(() => {
    load().catch(console.error);
  }, [user]);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    await api.post('/fees', {
      ...form,
      amount: Number(form.amount),
      dueDate: form.dueDate || undefined,
    });
    await load();
  };

  return (
    <div className="page">
      <header className="page-header">
        <h1>Fee management</h1>
      </header>

      {user?.role === 'ADMIN' && (
        <form className="panel stack" onSubmit={onSubmit}>
          <h2>Create fee</h2>
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
            Title
            <input
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              required
            />
          </label>
          <label>
            Description
            <input
              value={form.description}
              onChange={(e) =>
                setForm({ ...form, description: e.target.value })
              }
            />
          </label>
          <label>
            Amount
            <input
              type="number"
              value={form.amount}
              onChange={(e) =>
                setForm({ ...form, amount: Number(e.target.value) })
              }
              required
            />
          </label>
          <label>
            Due date
            <input
              type="date"
              value={form.dueDate}
              onChange={(e) => setForm({ ...form, dueDate: e.target.value })}
            />
          </label>
          <button className="btn primary" type="submit">
            Create fee
          </button>
        </form>
      )}

      <div className="panel">
        <table>
          <thead>
            <tr>
              <th>Title</th>
              <th>Student</th>
              <th>Amount</th>
              <th>Paid</th>
              <th>Status</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {fees.map((fee) => (
              <tr key={fee.id}>
                <td>{fee.title}</td>
                <td>
                  {fee.student?.firstName} {fee.student?.lastName}
                </td>
                <td>${Number(fee.amount).toFixed(2)}</td>
                <td>${Number(fee.amountPaid).toFixed(2)}</td>
                <td>
                  <span className="tag">{fee.status}</span>
                </td>
                <td>
                  {fee.status !== 'PAID' && (
                    <button
                      className="btn ghost"
                      type="button"
                      onClick={async () => {
                        const remaining =
                          Number(fee.amount) - Number(fee.amountPaid);
                        await api.patch(`/fees/${fee.id}/pay`, {
                          amount: remaining,
                        });
                        await load();
                      }}
                    >
                      Mark paid
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
