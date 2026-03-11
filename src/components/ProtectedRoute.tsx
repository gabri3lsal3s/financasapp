import React, { useState, useEffect, useRef } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';

import { isBiometricRegistered, verifyBiometric } from '@/utils/biometric';
import { useAppSettings } from '@/hooks/useAppSettings';
import { Fingerprint, LogOut, AlertCircle, ShieldCheck } from 'lucide-react';

import Button from '@/components/Button';
import Loader from '@/components/Loader';

interface ProtectedRouteProps {
  children: React.ReactNode;
}

export default function ProtectedRoute({ children }: ProtectedRouteProps) {
  const { user, profile, isLoading, signOut, refreshProfile } = useAuth();
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

  // 1. Verificar se o usuário está BLOQUEADO (prioridade máxima)
  // Bloqueio ocorre se is_blocked for true OU se já foi rejeitado 2 vezes ou mais
  if (profile && (profile.is_blocked || (profile.rejection_count >= 2))) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-secondary px-4">
        <div className="w-full max-w-md space-y-8 text-center p-8 bg-[var(--color-bg-primary)] rounded-2xl shadow-xl border border-[var(--color-border)] animate-page-enter">
          <div className="mx-auto flex h-24 w-24 items-center justify-center rounded-full bg-[var(--color-danger)]/10 border-2 border-[var(--color-danger)]">
            <ShieldCheck className="h-12 w-12 text-[var(--color-danger)] animate-pulse" />
          </div>

          <h2 className="mt-6 text-2xl font-bold tracking-tight text-[var(--color-danger)]">
            Acesso Bloqueado
          </h2>
          <p className="text-secondary text-sm">
            Seu acesso foi permanentemente suspenso pelo administrador.
          </p>

          <div className="space-y-4 pt-4">
            <button
              onClick={handleLogout}
              className="text-sm text-secondary hover:text-primary motion-standard flex items-center justify-center gap-1.5 mx-auto pt-2"
            >
              <LogOut size={16} />
              Sair da Conta
            </button>
          </div>
        </div>
      </div>
    );
  }

  // 2. Verificar se o usuário foi REJEITADO (pela primeira vez)
  if (profile && profile.is_rejected && profile.rejection_count < 2) {
    const handleRetryRegistration = async () => {
      try {
        const { error } = await supabase
          .from('profiles')
          .update({ is_rejected: false })
          .eq('id', profile.id);

        if (error) throw error;
        await refreshProfile();
      } catch (err) {
        console.error('Error retrying registration:', err);
        alert('Erro ao tentar novamente. Tente atualizar a página.');
      }
    };

    return (
      <div className="flex min-h-screen items-center justify-center bg-secondary px-4">
        <div className="w-full max-w-md space-y-8 text-center p-8 bg-[var(--color-bg-primary)] rounded-2xl shadow-xl border border-[var(--color-border)] animate-page-enter">
          <div className="mx-auto flex h-24 w-24 items-center justify-center rounded-full bg-[var(--color-warning)]/10 border-2 border-[var(--color-warning)]">
            <AlertCircle className="h-12 w-12 text-[var(--color-warning)]" />
          </div>

          <h2 className="mt-6 text-2xl font-bold tracking-tight text-primary">
            Solicitação Recusada
          </h2>
          <p className="text-secondary text-sm px-4">
            Sua solicitação de cadastro não foi aceita no momento. Você pode tentar mais uma vez.
          </p>

          <div className="p-4 bg-[var(--color-tertiary)]/30 rounded-lg text-sm text-secondary">
            Certifique-se de que seus dados estão corretos antes de tentar novamente.
          </div>

          <div className="space-y-4 pt-4">
            <Button
              type="button"
              variant="primary"
              fullWidth
              onClick={handleRetryRegistration}
            >
              Tentar Novamente
            </Button>

            <button
              onClick={handleLogout}
              className="text-sm text-secondary hover:text-primary motion-standard flex items-center justify-center gap-1.5 mx-auto pt-2"
            >
              <LogOut size={16} />
              Sair da Conta
            </button>
          </div>
        </div>
      </div>
    );
  }

  // 3. Verificar se o usuário está aprovado pelo ADM
  if (profile && !profile.is_approved) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-secondary px-4">
        <div className="w-full max-w-md space-y-8 text-center p-8 bg-[var(--color-bg-primary)] rounded-2xl shadow-xl border border-[var(--color-border)] animate-page-enter">
          <div className="mx-auto flex h-24 w-24 items-center justify-center rounded-full bg-tertiary border-2 border-primary">
            <AlertCircle className="h-12 w-12 text-primary animate-pulse" />
          </div>

          <h2 className="mt-6 text-2xl font-bold tracking-tight text-primary">
            Aguardando Aprovação
          </h2>
          <p className="text-secondary text-sm">
            Sua conta foi criada com sucesso, mas o administrador (gabrielisaacsales@gmail.com) precisa autorizar seu primeiro acesso.
          </p>

          <div className="p-4 bg-[var(--color-tertiary)]/30 rounded-lg text-sm text-secondary">
            Enquanto aguarda, você pode entrar em contato com o ADM para agilizar o processo.
          </div>

          <div className="space-y-4 pt-4">


            <button
              onClick={handleLogout}
              className="text-sm text-secondary hover:text-primary motion-standard flex items-center justify-center gap-1.5 mx-auto pt-2"
            >
              <LogOut size={16} />
              Sair da Conta
            </button>
          </div>
        </div>
      </div>
    );
  }


  // Se usuário está logado e aprovado, mas o App está trancado por biometria
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
