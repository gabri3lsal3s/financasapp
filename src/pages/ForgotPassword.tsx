import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';
import { Mail, AlertCircle, KeyRound, ArrowLeft, Loader2 } from 'lucide-react';
import Button from '@/components/Button';
import Input from '@/components/Input';
import Card from '@/components/Card';
import AuthShell from '@/components/auth/AuthShell';
import { getErrorMessage } from '@/utils/errorMessage';

export default function ForgotPassword() {
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isSupabaseConfigured) {
      setError('Supabase não configurado.');
      return;
    }

    try {
      setError('');
      setMessage('');
      setLoading(true);
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`,
      });

      if (error) throw error;
      setMessage('Verifique seu e-mail para encontrar o link de redefinição de senha.');
    } catch (err: unknown) {
      setError(getErrorMessage(err, 'Falha ao redefinir a senha'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthShell
      title="Redefinir Senha"
      icon={<KeyRound className="h-6 w-6 text-primary" />}
      subtitle="Digite seu email e enviaremos um link para você redefinir sua senha."
    >

        {error && (
          <div className="flex items-center space-x-2 rounded-md bg-[var(--color-danger)]/10 p-4 text-[var(--color-danger)]">
            <AlertCircle className="h-5 w-5 flex-shrink-0" />
            <p className="text-sm font-medium">{error}</p>
          </div>
        )}
        {message && (
          <div className="rounded-md bg-[var(--color-success)]/10 p-4 text-[var(--color-success)]">
            <p className="text-sm font-medium">{message}</p>
          </div>
        )}

        <Card className="mt-8 surface-glass border border-glass">
          <form className="space-y-6" onSubmit={handleReset}>
            <div className="relative">
              <Input
                id="email-address"
                name="email"
                type="email"
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

            <Button
              type="submit"
              disabled={loading}
              variant="primary"
              fullWidth
            >
              {loading ? (
                <div className="flex items-center gap-2">
                  <Loader2 size={18} className="animate-spin" />
                  <span>Enviando...</span>
                </div>
              ) : 'Enviar Link de Redefinição'}
            </Button>
          </form>
        </Card>

        <div className="text-center mt-4">
          <Link to="/login" className="inline-flex items-center text-sm font-semibold text-accent hover:underline">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Voltar para o Login
          </Link>
        </div>
    </AuthShell>
  );
}
