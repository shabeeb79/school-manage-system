import { useEffect, useState, type FormEvent } from 'react';
import api from '../api/client';

function formatClassLabel(name: string, section?: string | null) {
  const sec = section?.trim();
  return sec ? `${name} - ${sec}` : name;
}

export default function ClassesPage() {
  const [classes, setClasses] = useState<any[]>([]);
  const [form, setForm] = useState({
    name: '',
    section: '',
    academicYear: '2025-26',
  });

  const load = () => api.get('/classes').then((r) => setClasses(r.data));

  useEffect(() => {
    load().catch(console.error);
  }, []);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    await api.post('/classes', form);
    setForm({ name: '', section: '', academicYear: '2025-26' });
    await load();
  };

  return (
    <div className="page">
      <header className="page-header">
        <h1>Classes</h1>
      </header>
      <div className="grid-2">
        <form className="panel stack" onSubmit={onSubmit}>
          <h2>Add class</h2>
          <label>
            Class
            <input
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              required
              placeholder="10"
            />
          </label>
          <label>
            Section
            <input
              value={form.section}
              onChange={(e) => setForm({ ...form, section: e.target.value })}
              required
              placeholder="A"
            />
          </label>
          <label>
            Academic year
            <input
              value={form.academicYear}
              onChange={(e) =>
                setForm({ ...form, academicYear: e.target.value })
              }
            />
          </label>
          <button className="btn primary" type="submit">
            Create
          </button>
        </form>
        <div className="panel">
          <table>
            <thead>
              <tr>
                <th>Class</th>
                <th>Students</th>
                <th>Staff</th>
              </tr>
            </thead>
            <tbody>
              {classes.map((c) => (
                <tr key={c.id}>
                  <td>{formatClassLabel(c.name, c.section)}</td>
                  <td>{c._count?.students ?? 0}</td>
                  <td>{c._count?.staff ?? 0}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
