import { useState, type FormEvent } from 'react';
import { useAuth } from '../auth/AuthContext';

const DEMO_ACCOUNTS = [
  { email: 'admin@school.com', label: 'Admin portal', role: 'ADMIN' },
  { email: 'staff@school.com', label: 'Staff portal', role: 'STAFF' },
  { email: 'student@school.com', label: 'Student portal', role: 'STUDENT' },
] as const;

export default function LoginPage() {
  const { login } = useAuth();
  const [email, setEmail] = useState('admin@school.com');
  const [password, setPassword] = useState('password123');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      await login(email, password);
    } catch {
      setError('Invalid email or password');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex min-h-dvh items-center justify-center bg-gradient-to-b from-slate-50 to-white px-4 py-10 font-sans">
      <div className="w-full max-w-md rounded-2xl border border-gray-200 bg-white p-6 shadow-sm md:p-8">
        <div className="mb-6 flex items-center gap-3">
          <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-blue-600 text-sm font-bold text-white">
            G
          </span>
          <div>
            <p className="text-sm font-semibold text-gray-900">Greenfield International School</p>
            <p className="text-xs text-gray-400">Sign in to your role portal</p>
          </div>
        </div>

        <h1 className="text-[22px] font-bold text-gray-900">Welcome back</h1>
        <p className="mt-1 text-sm text-gray-500">
          Admin, staff, and student accounts open different dashboards.
        </p>

        <form onSubmit={onSubmit} className="mt-6 space-y-4">
          <label className="block text-sm text-gray-700">
            Email
            <input
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              type="email"
              required
              className="mt-1.5 h-11 w-full rounded-xl border border-gray-200 px-3 text-sm text-gray-900 placeholder:text-gray-400 focus:border-blue-600 focus:outline-none focus:ring-1 focus:ring-blue-600"
            />
          </label>
          <label className="block text-sm text-gray-700">
            Password
            <input
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              type="password"
              required
              className="mt-1.5 h-11 w-full rounded-xl border border-gray-200 px-3 text-sm text-gray-900 placeholder:text-gray-400 focus:border-blue-600 focus:outline-none focus:ring-1 focus:ring-blue-600"
            />
          </label>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <button
            type="submit"
            disabled={busy}
            className="inline-flex h-11 w-full items-center justify-center rounded-xl bg-blue-600 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-60"
          >
            {busy ? 'Signing in...' : 'Sign in'}
          </button>
        </form>

        <div className="mt-6 rounded-xl border border-dashed border-gray-200 bg-gray-50 p-4">
          <p className="text-xs text-gray-500">
            Demo password for all: <code className="font-semibold text-gray-700">password123</code>
          </p>
          <div className="mt-3 flex flex-col gap-2">
            {DEMO_ACCOUNTS.map((account) => (
              <button
                key={account.email}
                type="button"
                onClick={() => {
                  setEmail(account.email);
                  setPassword('password123');
                  setError('');
                }}
                className="rounded-lg bg-white px-3 py-2 text-left text-sm text-blue-700 ring-1 ring-gray-200 hover:bg-blue-50"
              >
                <span className="font-medium">{account.label}</span>
                <span className="mt-0.5 block text-xs text-gray-400">{account.email}</span>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
