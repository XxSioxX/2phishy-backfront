import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

interface RouteGuardProps {
  children: React.ReactNode;
  allowedRoles?: string[];
  redirectTo?: string;
}

const RouteGuard: React.FC<RouteGuardProps> = ({
  children,
  allowedRoles = [],
  redirectTo = "/play-game"
}) => {
  const { user, isAuthenticated, loading } = useAuth();

  if (loading) {
    return (
      <div style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        height: '100vh',
        fontSize: '18px'
      }}>
        Loading...
      </div>
    );
  }

  // redirect to login
  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  if (allowedRoles.length === 0) {
    return <>{children}</>;
  }

  // Check if user has required role
  if (user?.role && allowedRoles.includes(user.role)) {
    return <>{children}</>;
  }

  if (user?.role === 'student') {
    return <Navigate to="/play-game" replace />;
  } else if (user?.role === 'admin' || user?.role === 'super-admin') {
    return <Navigate to="/admin" replace />;
  }

  return <Navigate to={redirectTo} replace />;
};

export default RouteGuard;
