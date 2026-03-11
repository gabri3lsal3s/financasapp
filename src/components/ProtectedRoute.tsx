import React, { useState, useEffect, useRef } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { isSupabaseConfigured } from '@/lib/supabase';
import { isBiometricRegistered, verifyBiometric } from '@/utils/biometric';
import { useAppSettings } from '@/hooks/useAppSettings';
import { Fingerprint, LogOut, AlertCircle } from 'lucide-react';
import Button from '@/components/Button';
import Loader from '@/components/Loader';

interface ProtectedRouteProps {
  children: React.ReactNode;
}

export default function ProtectedRoute({ children }: ProtectedRouteProps) {
  const { user, isLoading, signOut } = useAuth();
  const navigate = useNavigate();

  const { biometricLockTimeout } = useAppSettings();

  // App Lock pattern: if biometrics are registered, require unlock based on settings and session
  const [isLocked, setIsLocked] = useState(() => {
    if (!isBiometricRegistered()) return false;

    // Check bypass ticket from Login
    const justLoggedIn = sessionStorage.getItem('minhas_financas:login_bypass');
    if (justLoggedIn === 'true') {
      sessionStorage.removeItem('minhas_financas:login_bypass');
      localStorage.setItem('minhas-financas:last-hidden-at', Date.now().toString());
      return false;
    }

    const lastHiddenStr = localStorage.getItem('minhas-financas:last-hidden-at');
    const timeoutStr = localStorage.getItem('app.biometric.lockTimeoutMinutes');
    const timeout = timeoutStr !== null ? Number(timeoutStr) : 0;

    if (lastHiddenStr) {
      const lastHidden = Number(lastHiddenStr);
      const diffMinutes = (Date.now() - lastHidden) / 60000;
      if (diffMinutes >= timeout) {
        return true;
      }
      return false;
    }

    return true;
  });
  const [unlocking, setUnlocking] = useState(false);
  const [error, setError] = useState('');
  const autoUnlockAttempted = useRef(false);

  // Monitor screen off / app background
  useEffect(() => {
    if (!isBiometricRegistered() || !user) return;

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        localStorage.setItem('minhas-financas:last-hidden-at', Date.now().toString());
      } else if (document.visibilityState === 'visible') {
        const lastHiddenStr = localStorage.getItem('minhas-financas:last-hidden-at');
        if (lastHiddenStr) {
          const lastHidden = Number(lastHiddenStr);
          const diffMinutes = (Date.now() - lastHidden) / 60000;

          if (diffMinutes >= biometricLockTimeout) {
            setIsLocked(true);
            autoUnlockAttempted.current = false; // Reset auto-trigger attempt
          }
        }
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [biometricLockTimeout, user]);

  // Auto-trigger biometric prompt if locked
  useEffect(() => {
    if (isLocked && user && !isLoading && !autoUnlockAttempted.current) {
      autoUnlockAttempted.current = true;
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
        localStorage.setItem('minhas-financas:last-hidden-at', Date.now().toString());
      } else {
        if (result.error === 'CANCELLED') {
          setError('');
        } else {
          setError(result.error || 'Autenticação cancelada ou falhou.');
        }
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
        <Loader text="Carregando..." />
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
              className="text-sm text-secondary hover:text-primary motion-standard flex items-center justify-center gap-1.5 mx-auto pt-2"
            >
              <LogOut size={16} />
              Acessar com E-mail e Senha
            </button>
          </div>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
