import React, { useState, useEffect } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { isSupabaseConfigured } from '@/lib/supabase';
import { isBiometricRegistered, verifyBiometric } from '@/utils/biometric';
import { Fingerprint, LogOut, AlertCircle } from 'lucide-react';
import Button from '@/components/Button';

interface ProtectedRouteProps {
  children: React.ReactNode;
}

export default function ProtectedRoute({ children }: ProtectedRouteProps) {
  const { user, isLoading, signOut } = useAuth();
  const navigate = useNavigate();
  
  // App Lock pattern: if biometrics are registered, require unlock ONCE per app load
  const [isLocked, setIsLocked] = useState(() => isBiometricRegistered());
  const [unlocking, setUnlocking] = useState(false);
  const [error, setError] = useState('');

  // Auto-trigger biometric prompt if locked
  useEffect(() => {
    if (isLocked && user && !isLoading) {
      handleUnlock();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLocked, user, isLoading]);

  const handleUnlock = async () => {
    setUnlocking(true);
    setError('');
    try {
      const result = await verifyBiometric();
      if (result.success) {
        setIsLocked(false);
      } else {
        setError(result.error || 'Autenticação cancelada ou falhou.');
      }
    } catch (err: any) {
      setError(err.message || 'Erro ao desbloquear');
    } finally {
      setUnlocking(false);
    }
  };

  const handleLogout = async () => {
    await signOut();
    navigate('/login');
  };

  // Se o Supabase não estiver configurado, permite acesso a tudo (modo demo local sem bd)
  if (!isSupabaseConfigured) {
    return <>{children}</>;
  }

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center bg-gray-50 dark:bg-gray-900">
        <div className="flex flex-col items-center">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-indigo-600 border-t-transparent dark:border-indigo-400 dark:border-t-transparent"></div>
          <p className="mt-4 text-sm text-gray-500 dark:text-gray-400">Carregando...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  // Se usuário está logado, mas o App está trancado
  if (isLocked) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-secondary px-4">
        <div className="w-full max-w-md space-y-8 text-center p-8 bg-[var(--color-bg-primary)] rounded-2xl shadow-xl border border-[var(--color-border)]">
          <div className="mx-auto flex h-24 w-24 items-center justify-center rounded-full bg-tertiary border-2 border-primary">
            <Fingerprint className="h-12 w-12 text-primary animate-pulse" />
          </div>
          
          <h2 className="mt-6 text-2xl font-bold tracking-tight text-primary">
            App Bloqueado
          </h2>
          <p className="text-secondary text-sm">
            Use sua biometria para acessar suas finanças.
          </p>

          {error && (
            <div className="flex items-center space-x-2 rounded-md bg-[var(--color-danger)]/10 p-3 text-[var(--color-danger)] text-left mb-4">
              <AlertCircle className="h-5 w-5 flex-shrink-0" />
              <p className="text-sm font-medium">{error}</p>
            </div>
          )}

          <div className="space-y-4 pt-4">
            <Button
              type="button"
              variant="primary"
              fullWidth
              disabled={unlocking}
              onClick={handleUnlock}
              className="flex items-center justify-center gap-2"
            >
              <Fingerprint className="h-5 w-5" />
              {unlocking ? 'Verificando...' : 'Desbloquear App'}
            </Button>

            <button
              onClick={handleLogout}
              className="text-sm text-secondary hover:text-[var(--color-danger)] motion-standard flex items-center justify-center gap-1.5 mx-auto"
            >
              <LogOut size={16} />
              Sair da conta
            </button>
          </div>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
