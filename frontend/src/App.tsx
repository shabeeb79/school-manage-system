import { lazy, Suspense } from 'react';
import { AuthProvider, useAuth } from './auth/AuthContext';
import LoginPage from './pages/LoginPage';
import { PortalSkeleton } from './ui';

const AdminPortal = lazy(() => import('./AdminPortal'));
const StaffPortal = lazy(() => import('./StaffPortal'));
const StudentPortal = lazy(() => import('./StudentPortal'));

function PortalGate() {
  const { user, loading } = useAuth();

  if (loading) {
    return <PortalSkeleton />;
  }

  if (!user) return <LoginPage />;

  return (
    <Suspense fallback={<PortalSkeleton />}>
      {user.role === 'ADMIN' ? (
        <AdminPortal />
      ) : user.role === 'STAFF' ? (
        <StaffPortal />
      ) : (
        <StudentPortal />
      )}
    </Suspense>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <PortalGate />
    </AuthProvider>
  );
}
