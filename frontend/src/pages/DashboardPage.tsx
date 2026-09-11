import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../api/client';
import { useAuth } from '../auth/AuthContext';

export default function DashboardPage() {
  const { user } = useAuth();
  const [stats, setStats] = useState<Record<string, number>>({});
  const [feed, setFeed] = useState<any[]>([]);

  useEffect(() => {
    const load = async () => {
      const feedRes = await api.get('/posts/feed');
      setFeed(feedRes.data.slice(0, 5));

      if (user?.role === 'ADMIN') {
        const [users, classes, fees, leave] = await Promise.all([
          api.get('/users'),
          api.get('/classes'),
          api.get('/fees'),
          api.get('/leave'),
        ]);
        setStats({
          users: users.data.length,
          classes: classes.data.length,
          fees: fees.data.length,
          pendingLeave: leave.data.filter((l: any) => l.status === 'PENDING')
            .length,
        });
      } else if (user?.role === 'STAFF') {
        const [students, assignments, leave] = await Promise.all([
          api.get('/users/my-students'),
          api.get('/assignments'),
          api.get('/leave'),
        ]);
        setStats({
          students: students.data.length,
          assignments: assignments.data.length,
          pendingLeave: leave.data.filter((l: any) => l.status === 'PENDING')
            .length,
        });
      } else {
        const [grades, fees, assignments] = await Promise.all([
          api.get('/grades/my-card'),
          api.get('/fees'),
          api.get('/assignments'),
        ]);
        setStats({
          subjects: grades.data.summary?.length || 0,
          openFees: fees.data.filter((f: any) => f.status !== 'PAID').length,
          assignments: assignments.data.length,
        });
      }
    };
    load().catch(console.error);
  }, [user]);

  return (
    <div className="page">
      <header className="page-header">
        <div>
          <p className="eyebrow">Welcome back</p>
          <h1>
            {user?.firstName} {user?.lastName}
          </h1>
        </div>
      </header>

      <section className="stat-row">
        {Object.entries(stats).map(([key, value]) => (
          <div key={key} className="stat">
            <span>{key.replace(/([A-Z])/g, ' $1')}</span>
            <strong>{value}</strong>
          </div>
        ))}
      </section>

      <section className="panel">
        <div className="panel-head">
          <h2>Latest announcements</h2>
          <Link to={user?.role === 'ADMIN' ? '/posts' : '/feed'}>View all</Link>
        </div>
        <div className="list">
          {feed.map((post) => (
            <article key={post.id} className="list-item">
              <div>
                <h3>{post.title}</h3>
                <p>{post.content}</p>
              </div>
              <span className="tag">{post.audience}</span>
            </article>
          ))}
          {!feed.length && <p className="muted">No announcements yet.</p>}
        </div>
      </section>
    </div>
  );
}
