import { useEffect, useState, type FormEvent } from 'react';
import api from '../api/client';
import { useAuth } from '../auth/AuthContext';

export default function LeavePage() {
  const { user } = useAuth();
  const [items, setItems] = useState<any[]>([]);
  const [form, setForm] = useState({
    reason: '',
    startDate: '',
    endDate: '',
  });
  const canRequest = user?.role === 'STUDENT' || user?.role === 'STAFF';
  const canReview = user?.role === 'ADMIN' || user?.role === 'STAFF';

  const load = () => api.get('/leave').then((r) => setItems(r.data));

  useEffect(() => {
    load().catch(console.error);
  }, []);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    await api.post('/leave', form);
    setForm({ reason: '', startDate: '', endDate: '' });
    await load();
  };

  return (
    <div className="page">
      <header className="page-header">
        <h1>Leave requests</h1>
      </header>

      {canRequest && (
        <form className="panel stack" onSubmit={onSubmit}>
          <h2>Request leave</h2>
          <label>
            Reason
            <textarea
              value={form.reason}
              onChange={(e) => setForm({ ...form, reason: e.target.value })}
              required
            />
          </label>
          <label>
            Start
            <input
              type="date"
              value={form.startDate}
              onChange={(e) => setForm({ ...form, startDate: e.target.value })}
              required
            />
          </label>
          <label>
            End
            <input
              type="date"
              value={form.endDate}
              onChange={(e) => setForm({ ...form, endDate: e.target.value })}
              required
            />
          </label>
          <button className="btn primary" type="submit">
            Submit request
          </button>
        </form>
      )}

      <div className="panel">
        <table>
          <thead>
            <tr>
              <th>Requester</th>
              <th>Dates</th>
              <th>Reason</th>
              <th>Status</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {items.map((item) => (
              <tr key={item.id}>
                <td>
                  {item.requester
                    ? `${item.requester.firstName} ${item.requester.lastName}`
                    : 'You'}
                </td>
                <td>
                  {String(item.startDate).slice(0, 10)} →{' '}
                  {String(item.endDate).slice(0, 10)}
                </td>
                <td>{item.reason}</td>
                <td>
                  <span className="tag">{item.status}</span>
                </td>
                <td>
                  {canReview &&
                    item.status === 'PENDING' &&
                    item.requesterId !== user?.id && (
                      <div className="row-gap">
                        <button
                          className="btn ghost"
                          type="button"
                          onClick={async () => {
                            await api.patch(`/leave/${item.id}/review`, {
                              status: 'APPROVED',
                            });
                            await load();
                          }}
                        >
                          Approve
                        </button>
                        <button
                          className="btn ghost"
                          type="button"
                          onClick={async () => {
                            await api.patch(`/leave/${item.id}/review`, {
                              status: 'REJECTED',
                            });
                            await load();
                          }}
                        >
                          Reject
                        </button>
                      </div>
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
