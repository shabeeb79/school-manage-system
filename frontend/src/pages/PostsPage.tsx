import { FormEvent, useEffect, useState } from 'react';
import api from '../api/client';

const audiences = ['ALL', 'ADMIN', 'STAFF', 'STUDENT', 'CLASS', 'CUSTOM'];

export default function PostsPage() {
  const [posts, setPosts] = useState<any[]>([]);
  const [classes, setClasses] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [form, setForm] = useState({
    title: '',
    content: '',
    audience: 'ALL',
    targetClassId: '',
    targetUserIds: [] as string[],
  });
  const [error, setError] = useState('');

  const load = async () => {
    const [p, c, u] = await Promise.all([
      api.get('/posts'),
      api.get('/classes'),
      api.get('/users'),
    ]);
    setPosts(p.data);
    setClasses(c.data);
    setUsers(u.data);
  };

  useEffect(() => {
    load().catch(console.error);
  }, []);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    try {
      await api.post('/posts', {
        title: form.title,
        content: form.content,
        audience: form.audience,
        targetClassId: form.targetClassId || undefined,
        targetUserIds:
          form.audience === 'CUSTOM' ? form.targetUserIds : undefined,
      });
      setForm({
        title: '',
        content: '',
        audience: 'ALL',
        targetClassId: '',
        targetUserIds: [],
      });
      await load();
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to create post');
    }
  };

  return (
    <div className="page">
      <header className="page-header">
        <h1>Targeted posts</h1>
        <p className="muted">Publish announcements to roles, classes, or people.</p>
      </header>

      <div className="grid-2">
        <form className="panel stack" onSubmit={onSubmit}>
          <h2>Create post</h2>
          <label>
            Title
            <input
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              required
            />
          </label>
          <label>
            Content
            <textarea
              value={form.content}
              onChange={(e) => setForm({ ...form, content: e.target.value })}
              rows={4}
              required
            />
          </label>
          <label>
            Audience
            <select
              value={form.audience}
              onChange={(e) => setForm({ ...form, audience: e.target.value })}
            >
              {audiences.map((a) => (
                <option key={a} value={a}>
                  {a}
                </option>
              ))}
            </select>
          </label>
          {form.audience === 'CLASS' && (
            <label>
              Target class
              <select
                value={form.targetClassId}
                onChange={(e) =>
                  setForm({ ...form, targetClassId: e.target.value })
                }
                required
              >
                <option value="">Select class</option>
                {classes.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </label>
          )}
          {form.audience === 'CUSTOM' && (
            <label>
              Target users
              <select
                multiple
                value={form.targetUserIds}
                onChange={(e) =>
                  setForm({
                    ...form,
                    targetUserIds: Array.from(
                      e.target.selectedOptions,
                      (o) => o.value,
                    ),
                  })
                }
              >
                {users.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.firstName} {u.lastName} ({u.role})
                  </option>
                ))}
              </select>
            </label>
          )}
          {error && <p className="error">{error}</p>}
          <button className="btn primary" type="submit">
            Publish
          </button>
        </form>

        <div className="panel">
          <h2>All posts</h2>
          <div className="list">
            {posts.map((post) => (
              <article key={post.id} className="list-item">
                <div>
                  <h3>{post.title}</h3>
                  <p>{post.content}</p>
                  <small className="muted">
                    by {post.author?.firstName} · {post.audience}
                    {post.targetClass ? ` · ${post.targetClass.name}` : ''}
                  </small>
                </div>
                <button
                  className="btn ghost"
                  type="button"
                  onClick={async () => {
                    await api.delete(`/posts/${post.id}`);
                    await load();
                  }}
                >
                  Delete
                </button>
              </article>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
