import { Navigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';

export function ProtectedRoute({ children, allowPasswordChange = false }: { children: React.ReactNode, allowPasswordChange?: boolean }) {
  const { user, profile, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-teal-500"></div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  // If the user's profile requires a password reset, force them to the change-password page
  if (!allowPasswordChange && profile?.requires_password_change) {
    return <Navigate to="/change-password" replace />;
  }

  // Prevent users from accessing change-password if they don't need to (and avoid loop)
  if (allowPasswordChange && profile && !profile.requires_password_change) {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
}
