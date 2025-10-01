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
  const { user, isAuthenticated } = useAuth();

  // If not authenticated, redirect to login
  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  // If no roles specified, allow access
  if (allowedRoles.length === 0) {
    return <>{children}</>;
  }

  // Check if user has required role
  if (user?.role && allowedRoles.includes(user.role)) {
    return <>{children}</>;
  }

  // Redirect to appropriate page based on role
  if (user?.role === 'student') {
    return <Navigate to="/play-game" replace />;
  } else if (user?.role === 'admin' || user?.role === 'super-admin') {
    return <Navigate to="/admin" replace />;
  }

  // Default redirect
  return <Navigate to={redirectTo} replace />;
};

export default RouteGuard;
