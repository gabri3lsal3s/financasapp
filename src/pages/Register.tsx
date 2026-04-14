import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';
import { UserPlus, Mail, Lock, AlertCircle, Loader2 } from 'lucide-react';
import Button from '@/components/Button';
import Input from '@/components/Input';
import Card from '@/components/Card';

export default function Register() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [isRegistered, setIsRegistered] = useState(false);
  const navigate = useNavigate();

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isSupabaseConfigured) {
      setError('Supabase não está configurado.');
      return;
    }
    if (password !== confirmPassword) {
      setError('As senhas não coincidem.');
      return;
    }

    try {
      setError('');
      setLoading(true);
      const { error } = await supabase.auth.signUp({
        email,
        password,
      });

      if (error) throw error;
      setIsRegistered(true);
    } catch (err: any) {
      if (err.status === 429 || err.message?.toLowerCase().includes('rate limit')) {
        setError('Muitas tentativas em pouco tempo. Por favor, aguarde alguns minutos antes de tentar novamente.');
      } else {
        setError(err.message || 'Falha ao criar conta');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-primary px-4 py-12 sm:px-6 lg:px-8 animate-page-enter">
      <div className="w-full max-w-md space-y-8">
        <div>
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-tertiary">
            <UserPlus className="h-6 w-6 text-primary" />
          </div>
          <h2 className="mt-6 text-center text-3xl font-bold tracking-tight text-primary">
            Crie sua conta
          </h2>
        </div>


        {isRegistered ? (
          <Card className="mt-8 text-center animate-surface-enter">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-[var(--color-success)]/10 mb-4">
              <Mail className="h-8 w-8 text-[var(--color-success)]" />
            </div>
            <h3 className="text-xl font-bold text-primary mb-2">Verifique seu Email</h3>
            <p className="text-secondary mb-6 leading-relaxed">
              Cadastro realizado com sucesso! Enviamos um link de confirmação para o seu email. 
              Por favor, clique no link para ativar sua conta. 
              <strong> Após confirmar, você poderá fazer login.</strong>
            </p>
            <div className="space-y-4">
              <Button 
                variant="primary" 
                fullWidth 
                onClick={() => navigate('/login')}
              >
                Ir para o Login
              </Button>
              <p className="text-xs text-secondary">
                Não recebeu? Verifique a pasta de spam.
              </p>
            </div>
          </Card>
        ) : (
          <>
            {error && (
              <div className="flex items-center space-x-2 rounded-md bg-[var(--color-intent-danger)]/10 p-4 text-[var(--color-intent-danger)]">
                <AlertCircle className="h-5 w-5 flex-shrink-0" />
                <p className="text-sm font-medium">{error}</p>
              </div>
            )}

            <Card className="mt-8">
              <form className="space-y-6" onSubmit={handleRegister}>
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
                      autoComplete="new-password"
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

                  <div className="relative">
                    <Input
                      id="confirm-password"
                      name="confirm-password"
                      type="password"
                      autoComplete="new-password"
                      required
                      label="Confirmar Senha"
                      placeholder="Confirme sua senha"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      className="pl-10"
                    />
                    <div className="pointer-events-none absolute bottom-0 left-0 flex h-10 items-center pl-3">
                      <Lock className="h-5 w-5 text-secondary" />
                    </div>
                  </div>
                </div>

                <Button
                  type="submit"
                  disabled={loading}
                  variant="primary"
                  fullWidth
                  className="mt-6"
                >
                  {loading ? (
                    <div className="flex items-center gap-2">
                      <Loader2 size={18} className="animate-spin" />
                      <span>Cadastrando...</span>
                    </div>
                  ) : 'Cadastrar'}
                </Button>
              </form>
            </Card>

            <p className="mt-4 text-center text-sm text-secondary">
              Já tem uma conta?{' '}
              <Link to="/login" className="font-semibold text-accent hover:underline">
                Faça login
              </Link>
            </p>
          </>
        )}
      </div>
    </div>
  );
}
