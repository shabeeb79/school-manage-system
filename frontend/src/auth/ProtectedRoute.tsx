import { Navigate, Outlet } from 'react-router-dom';
import { useAuth, type UserRole } from './AuthContext';

export function ProtectedRoute({ roles }: { roles?: UserRole[] }) {
  const { user, loading } = useAuth();

  if (loading) {
    return <div className="center-page">Loading...</div>;
  }

  if (!user) return <Navigate to="/login" replace />;
  if (roles && !roles.includes(user.role)) {
    return <Navigate to="/" replace />;
  }

  return <Outlet />;
}
