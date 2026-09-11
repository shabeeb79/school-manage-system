import { AuthProvider, useAuth } from './auth/AuthContext';
import AdminPortal from './AdminPortal';
import StaffPortal from './StaffPortal';
import StudentPortal from './StudentPortal';
import LoginPage from './pages/LoginPage';

function PortalGate() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-gray-50 text-sm text-gray-500">
        Loading...
      </div>
    );
  }

  if (!user) return <LoginPage />;

  if (user.role === 'ADMIN') return <AdminPortal />;
  if (user.role === 'STAFF') return <StaffPortal />;
  return <StudentPortal />;
}

export default function App() {
  return (
    <AuthProvider>
      <PortalGate />
    </AuthProvider>
  );
}
