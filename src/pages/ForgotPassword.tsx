import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';
import { Mail, AlertCircle, KeyRound, ArrowLeft, Loader2 } from 'lucide-react';
import Button from '@/components/Button';
import Input from '@/components/Input';
import Card from '@/components/Card';

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
    } catch (err: any) {
      setError(err.message || 'Falha ao redefinir a senha');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-secondary px-4 py-12 sm:px-6 lg:px-8 animate-page-enter">
      <div className="w-full max-w-md space-y-8">
        <div>
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-tertiary">
            <KeyRound className="h-6 w-6 text-primary" />
          </div>
          <h2 className="mt-6 text-center text-3xl font-bold tracking-tight text-primary">
            Redefinir Senha
          </h2>
          <p className="mt-2 text-center text-sm text-secondary">
            Digite seu email e enviaremos um link para você redefinir sua senha.
          </p>
        </div>

        {error && (
          <div className="flex items-center space-x-2 rounded-md bg-[var(--color-intent-danger)]/10 p-4 text-[var(--color-intent-danger)]">
            <AlertCircle className="h-5 w-5 flex-shrink-0" />
            <p className="text-sm font-medium">{error}</p>
          </div>
        )}
        {message && (
          <div className="rounded-md bg-[var(--color-intent-success)]/10 p-4 text-[var(--color-intent-success)]">
            <p className="text-sm font-medium">{message}</p>
          </div>
        )}

        <Card className="mt-8">
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
      </div>
    </div>
  );
}
