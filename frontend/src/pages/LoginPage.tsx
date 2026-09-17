import { useState, type FormEvent } from 'react';
import { Eye, EyeOff, Lock, Mail } from 'lucide-react';
import { useAuth } from '../auth/AuthContext';

export default function LoginPage() {
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      await login(email.trim(), password);
    } catch {
      setError('Invalid email or password. Please try again.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="relative min-h-dvh overflow-hidden bg-[#0b1f17] font-sans text-white">
      <div
        className="pointer-events-none absolute inset-0 opacity-90"
        style={{
          background:
            'radial-gradient(ellipse 80% 60% at 20% 20%, rgba(34,197,94,0.28), transparent 55%), radial-gradient(ellipse 70% 50% at 85% 10%, rgba(16,185,129,0.18), transparent 50%), radial-gradient(ellipse 60% 45% at 70% 90%, rgba(6,95,70,0.45), transparent 55%)',
        }}
      />
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.07]"
        style={{
          backgroundImage:
            'url("data:image/svg+xml,%3Csvg width=\'60\' height=\'60\' viewBox=\'0 0 60 60\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cg fill=\'none\' fill-rule=\'evenodd\'%3E%3Cg fill=\'%23ffffff\' fill-opacity=\'1\'%3E%3Cpath d=\'M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z\'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")',
        }}
      />

      <div className="relative mx-auto flex min-h-dvh w-full max-w-6xl flex-col lg:flex-row">
        <section className="flex flex-1 flex-col justify-between px-6 pb-8 pt-10 sm:px-10 lg:px-12 lg:py-14">
          <div className="flex items-center gap-3">
            <span className="inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-emerald-400 text-base font-bold text-[#0b1f17] shadow-lg shadow-emerald-900/40">
              G
            </span>
            <div>
              <p className="text-sm font-semibold tracking-wide text-white sm:text-base">
                Greenfield International
              </p>
              <p className="text-xs text-emerald-100/70">School Management</p>
            </div>
          </div>

          <div className="mt-12 max-w-md lg:mt-0">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-300/90">
              Secure portal
            </p>
            <h1 className="mt-3 text-3xl font-semibold leading-tight tracking-tight text-white sm:text-4xl lg:text-[2.75rem]">
              Welcome back to campus.
            </h1>
            <p className="mt-4 text-sm leading-relaxed text-emerald-50/75 sm:text-base">
              Sign in to manage classes, attendance, announcements, and more —
              tailored to your role.
            </p>
          </div>

          <p className="hidden text-xs text-emerald-100/40 lg:block">
            © {new Date().getFullYear()} Greenfield International School
          </p>
        </section>

        <section className="flex flex-1 items-end px-4 pb-6 sm:items-center sm:px-8 sm:pb-10 lg:px-10 lg:py-14">
          <div className="w-full rounded-[1.75rem] border border-white/15 bg-white/95 p-5 text-gray-900 shadow-2xl shadow-black/30 backdrop-blur-md sm:p-8">
            <h2 className="text-xl font-semibold tracking-tight text-gray-900 sm:text-2xl">
              Sign in
            </h2>
            <p className="mt-1.5 text-sm text-gray-500">
              Use your school email and password.
            </p>

            <form onSubmit={onSubmit} className="mt-6 space-y-4 sm:mt-7">
              <label className="block text-sm font-medium text-gray-700">
                Email
                <div className="relative mt-1.5">
                  <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                  <input
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    type="email"
                    autoComplete="email"
                    required
                    placeholder="you@school.com"
                    className="h-12 w-full rounded-xl border border-gray-200 bg-white pl-10 pr-3 text-sm text-gray-900 placeholder:text-gray-400 outline-none transition focus:border-emerald-600 focus:ring-2 focus:ring-emerald-600/20"
                  />
                </div>
              </label>

              <label className="block text-sm font-medium text-gray-700">
                Password
                <div className="relative mt-1.5">
                  <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                  <input
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    type={showPassword ? 'text' : 'password'}
                    autoComplete="current-password"
                    required
                    placeholder="Enter your password"
                    className="h-12 w-full rounded-xl border border-gray-200 bg-white pl-10 pr-11 text-sm text-gray-900 placeholder:text-gray-400 outline-none transition focus:border-emerald-600 focus:ring-2 focus:ring-emerald-600/20"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    className="absolute right-2 top-1/2 inline-flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-lg text-gray-400 hover:bg-gray-100 hover:text-gray-700"
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                  >
                    {showPassword ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                  </button>
                </div>
              </label>

              {error && (
                <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 ring-1 ring-red-100">
                  {error}
                </p>
              )}

              <button
                type="submit"
                disabled={busy}
                className="inline-flex h-12 w-full items-center justify-center rounded-xl bg-emerald-700 text-sm font-semibold text-white shadow-lg shadow-emerald-900/20 transition hover:bg-emerald-800 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {busy ? 'Signing in…' : 'Sign in'}
              </button>
            </form>
          </div>
        </section>
      </div>
    </div>
  );
}
