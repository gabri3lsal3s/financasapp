import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';
import { LogIn, Fingerprint, Lock, Mail, AlertCircle, KeyRound } from 'lucide-react';
import Button from '@/components/Button';
import Input from '@/components/Input';
import Card from '@/components/Card';
import {
  isBiometricAvailable,
  isBiometricRegistered,
  verifyBiometric,
} from '@/utils/biometric';

type LoginMode = 'biometric' | 'password';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [mode, setMode] = useState<LoginMode>('password');
  const [biometricAvailable, setBiometricAvailable] = useState(false);
  const navigate = useNavigate();

  // On mount: if biometrics are registered and available, go straight to biometric mode
  useEffect(() => {
    const available = isBiometricAvailable();
    const registered = isBiometricRegistered();
    setBiometricAvailable(available);
    if (available && registered) {
      setMode('biometric');
    }
  }, []);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isSupabaseConfigured) {
      setError('Supabase não está configurado. Verifique as variáveis de ambiente.');
      return;
    }

    try {
      setError('');
      setLoading(true);
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
      navigate('/');
    } catch (err: any) {
      setError(err.message || 'Falha ao fazer login');
    } finally {
      setLoading(false);
    }
  };

  const handleBiometricLogin = async () => {
    setError('');
    setLoading(true);

    try {
      const result = await verifyBiometric();

      if (!result.success) {
        setError(result.error || 'Verificação biométrica falhou.');
        return;
      }

      // Biometric passed — check if Supabase session is still valid
      const { data } = await supabase.auth.getSession();
      if (data.session) {
        navigate('/');
        return;
      }

      // Session expired — fall back to password form
      setError('Sua sessão expirou. Por favor, entre com email e senha.');
      setMode('password');
    } catch (err: any) {
      setError(err.message || 'Erro ao verificar biometria.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-secondary px-4 py-12 sm:px-6 lg:px-8">
      <div className="w-full max-w-md space-y-8">
        <div>
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-tertiary">
            {mode === 'biometric' ? (
              <Fingerprint className="h-6 w-6 text-primary" />
            ) : (
              <LogIn className="h-6 w-6 text-primary" />
            )}
          </div>
          <h2 className="mt-6 text-center text-3xl font-bold tracking-tight text-primary">
            {mode === 'biometric' ? 'Verificação biométrica' : 'Entre na sua conta'}
          </h2>
          {mode === 'biometric' && (
            <p className="mt-2 text-center text-sm text-secondary">
              Use sua biometria para acessar o app
            </p>
          )}
        </div>

        {error && (
          <div className="flex items-center space-x-2 rounded-md bg-[var(--color-danger)]/10 p-4 text-[var(--color-danger)]">
            <AlertCircle className="h-5 w-5 flex-shrink-0" />
            <p className="text-sm font-medium">{error}</p>
          </div>
        )}

        <Card className="mt-8">
          {mode === 'biometric' ? (
            /* ── Biometric unlock screen ── */
            <div className="space-y-5 text-center">
              <div className="flex justify-center">
                <div className="flex h-20 w-20 items-center justify-center rounded-full bg-tertiary border border-primary">
                  <Fingerprint className="h-10 w-10 text-[var(--color-primary)]" />
                </div>
              </div>

              <Button
                type="button"
                variant="primary"
                fullWidth
                disabled={loading}
                onClick={handleBiometricLogin}
                className="flex items-center justify-center gap-2"
              >
                <Fingerprint className="h-5 w-5" />
                {loading ? 'Verificando...' : 'Verificar biometria'}
              </Button>

              <button
                type="button"
                className="text-sm text-secondary hover:text-primary motion-standard flex items-center justify-center gap-1.5 mx-auto"
                onClick={() => { setMode('password'); setError(''); }}
              >
                <KeyRound size={14} />
                Usar email e senha
              </button>
            </div>
          ) : (
            /* ── Password login form ── */
            <form className="space-y-6" onSubmit={handleLogin}>
              <div className="space-y-4">
                <div className="relative">
                  <Input
                    id="email-address"
                    name="email"
                    type="email"
                    autoComplete="email"
                    required
                    label="Email"
                    placeholder="Seu email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="pl-10"
                  />
                  <div className="pointer-events-none absolute bottom-0 left-0 flex h-10 items-center pl-3">
                    <Mail className="h-5 w-5 text-secondary" />
                  </div>
                </div>

                <div className="relative">
                  <Input
                    id="password"
                    name="password"
                    type="password"
                    autoComplete="current-password"
                    required
                    label="Senha"
                    placeholder="Sua senha"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="pl-10"
                  />
                  <div className="pointer-events-none absolute bottom-0 left-0 flex h-10 items-center pl-3">
                    <Lock className="h-5 w-5 text-secondary" />
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-between">
                <div className="text-sm">
                  <Link to="/forgot-password" className="font-semibold text-[var(--color-primary)] hover:underline">
                    Esqueceu a senha?
                  </Link>
                </div>
              </div>

              <div className="space-y-3">
                <Button type="submit" disabled={loading} variant="primary" fullWidth>
                  {loading ? 'Entrando...' : 'Entrar'}
                </Button>

                {biometricAvailable && isBiometricRegistered() && (
                  <>
                    <div className="relative my-4">
                      <div className="absolute inset-0 flex items-center">
                        <div className="w-full border-t border-primary" />
                      </div>
                      <div className="relative flex justify-center text-sm">
                        <span className="bg-primary px-2 text-secondary">Ou continue com</span>
                      </div>
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      disabled={loading}
                      fullWidth
                      onClick={() => { setMode('biometric'); setError(''); }}
                      className="flex items-center justify-center gap-2"
                    >
                      <Fingerprint className="h-5 w-5 text-[var(--color-primary)]" />
                      Usar biometria
                    </Button>
                  </>
                )}
              </div>
            </form>
          )}
        </Card>

        <p className="mt-4 text-center text-sm text-secondary">
          Não tem uma conta?{' '}
          <Link to="/register" className="font-semibold text-[var(--color-primary)] hover:underline">
            Cadastre-se
          </Link>
        </p>
      </div>
    </div>
  );
}
