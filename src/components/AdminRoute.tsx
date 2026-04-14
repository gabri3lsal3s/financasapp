import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import Loader from '@/components/Loader';

interface AdminRouteProps {
  children: React.ReactNode;
}

export default function AdminRoute({ children }: AdminRouteProps) {
  const { user, profile, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center bg-primary">
        <Loader text="Carregando..." />
      </div>
    );
  }

  if (!user || !profile?.is_admin) {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
}
