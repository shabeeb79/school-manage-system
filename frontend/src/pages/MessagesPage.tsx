import { FormEvent, useEffect, useState } from 'react';
import api from '../api/client';

export default function MessagesPage() {
  const [inbox, setInbox] = useState<any[]>([]);
  const [sent, setSent] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [tab, setTab] = useState<'inbox' | 'sent'>('inbox');
  const [form, setForm] = useState({
    receiverId: '',
    subject: '',
    body: '',
  });

  const load = async () => {
    const [i, s, u] = await Promise.all([
      api.get('/messages/inbox'),
      api.get('/messages/sent'),
      api.get('/users'),
    ]);
    setInbox(i.data);
    setSent(s.data);
    setUsers(u.data);
  };

  useEffect(() => {
    load().catch(console.error);
  }, []);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    await api.post('/messages', form);
    setForm({ receiverId: '', subject: '', body: '' });
    setTab('sent');
    await load();
  };

  const list = tab === 'inbox' ? inbox : sent;

  return (
    <div className="page">
      <header className="page-header">
        <h1>Messages</h1>
      </header>

      <div className="grid-2">
        <form className="panel stack" onSubmit={onSubmit}>
          <h2>Compose</h2>
          <label>
            To
            <select
              value={form.receiverId}
              onChange={(e) =>
                setForm({ ...form, receiverId: e.target.value })
              }
              required
            >
              <option value="">Select user</option>
              {users.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.firstName} {u.lastName} ({u.role})
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
            Message
            <textarea
              value={form.body}
              onChange={(e) => setForm({ ...form, body: e.target.value })}
              rows={5}
              required
            />
          </label>
          <button className="btn primary" type="submit">
            Send
          </button>
        </form>

        <div className="panel">
          <div className="row-gap" style={{ marginBottom: '1rem' }}>
            <button
              type="button"
              className={tab === 'inbox' ? 'btn primary' : 'btn ghost'}
              onClick={() => setTab('inbox')}
            >
              Inbox ({inbox.filter((m) => !m.isRead).length})
            </button>
            <button
              type="button"
              className={tab === 'sent' ? 'btn primary' : 'btn ghost'}
              onClick={() => setTab('sent')}
            >
              Sent
            </button>
          </div>
          <div className="list">
            {list.map((m) => (
              <article
                key={m.id}
                className="list-item"
                onClick={async () => {
                  if (tab === 'inbox' && !m.isRead) {
                    await api.patch(`/messages/${m.id}/read`);
                    await load();
                  }
                }}
              >
                <div>
                  <h3>{m.subject}</h3>
                  <p>{m.body}</p>
                  <small className="muted">
                    {tab === 'inbox'
                      ? `From ${m.sender?.firstName} ${m.sender?.lastName}`
                      : `To ${m.receiver?.firstName} ${m.receiver?.lastName}`}{' '}
                    · {new Date(m.createdAt).toLocaleString()}
                  </small>
                </div>
                {tab === 'inbox' && !m.isRead && (
                  <span className="tag">NEW</span>
                )}
              </article>
            ))}
            {!list.length && <p className="muted">No messages.</p>}
          </div>
        </div>
      </div>
    </div>
  );
}
