import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { Lock, AlertCircle, KeyRound } from 'lucide-react';
import Button from '@/components/Button';
import Input from '@/components/Input';
import Card from '@/components/Card';
import AuthShell from '@/components/auth/AuthShell';
import { getErrorMessage } from '@/utils/errorMessage';

export default function ResetPassword() {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password !== confirmPassword) {
      setError('As senhas não coincidem.');
      return;
    }

    try {
      setError('');
      setLoading(true);
      const { error } = await supabase.auth.updateUser({
        password: password
      });

      if (error) throw error;
      setMessage('Sua senha foi atualizada com sucesso!');
      setTimeout(() => {
        navigate('/login');
      }, 3000);
    } catch (err: unknown) {
      setError(getErrorMessage(err, 'Falha ao atualizar a senha'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthShell
      title="Nova Senha"
      icon={<KeyRound className="h-6 w-6 text-primary" />}
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
          <form className="space-y-6" onSubmit={handleUpdate}>
            <div className="space-y-4">
              <div className="relative">
                <Input
                  id="password"
                  name="password"
                  type="password"
                  required
                  label="Nova Senha"
                  placeholder="Nova senha"
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
                  required
                  label="Confirmar Nova Senha"
                  placeholder="Confirme a nova senha"
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
              {loading ? 'Atualizando...' : 'Atualizar Senha'}
            </Button>
          </form>
        </Card>
    </AuthShell>
  );
}
