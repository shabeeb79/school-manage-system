import { useEffect, useState } from 'react';
import api from '../api/client';

export default function FeedPage() {
  const [posts, setPosts] = useState<any[]>([]);

  useEffect(() => {
    api.get('/posts/feed').then((res) => setPosts(res.data));
  }, []);

  return (
    <div className="page">
      <header className="page-header">
        <h1>Announcements</h1>
        <p className="muted">Posts targeted to you and your groups.</p>
      </header>
      <div className="list">
        {posts.map((post) => (
          <article key={post.id} className="panel list-item">
            <div>
              <div className="row-between">
                <h2>{post.title}</h2>
                <span className="tag">{post.audience}</span>
              </div>
              <p>{post.content}</p>
              <small className="muted">
                {post.author?.firstName} {post.author?.lastName} ·{' '}
                {new Date(post.createdAt).toLocaleString()}
              </small>
            </div>
          </article>
        ))}
        {!posts.length && <p className="muted">No announcements for you.</p>}
      </div>
    </div>
  );
}
