# Migrações Pendentes — Supabase

> **Última atualização:** Julho de 2026

As migrações abaixo existem no repositório em `supabase/migrations/` mas **não foram aplicadas ao projeto Supabase**. Enquanto não forem executadas, os services correspondentes operam em fallback para `localStorage` (sem perda de dados).

---

## 📋 Migrações a Aplicar

| # | Arquivo | Tabela | Finalidade | Impacto |
|---|---------|--------|------------|---------|
| 1 | `20260701_user_preferences.sql` | `user_preferences` | Preferências do usuário (layout do dashboard, análises fixadas) | Fallback para localStorage. Ao aplicar, dados locais são sincronizados automaticamente na próxima requisição. |
| 2 | `20260710_create_recurring_expense_feedback.sql` | `recurring_expense_feedback` | Feedback do usuário sobre despesas recorrentes (confirmar/ignorar) | Fallback para localStorage. Ao aplicar, feedbacks locais são sincronizados automaticamente. |

---

## 🚀 Como Aplicar

### Opção 1 — Supabase CLI (recomendado)

```bash
# Na raiz do projeto
npx supabase db push
```

Isso aplica **todas** as migrations pendentes na ordem cronológica.

### Opção 2 — SQL Editor (Supabase Dashboard)

1. Acesse o [Supabase Dashboard](https://supabase.com/dashboard)
2. Selecione o projeto
3. Vá em **SQL Editor**
4. Copie e cole o conteúdo de cada arquivo na ordem abaixo e execute:

```sql
-- 1. Primeiro: user_preferences
-- Arquivo: supabase/migrations/20260701_user_preferences.sql

-- 2. Depois: recurring_expense_feedback
-- Arquivo: supabase/migrations/20260710_create_recurring_expense_feedback.sql
```

> ⚠️ **Ordem importante:** `20260701_user_preferences.sql` deve ser executado **antes** de qualquer outra migração que dependa da tabela `user_preferences`.

---

## 🔍 Verificação

Após aplicar, confirme que as tabelas foram criadas:

```sql
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
  AND table_name IN ('user_preferences', 'recurring_expense_feedback');
```

O resultado esperado:

| table_name |
|------------|
| user_preferences |
| recurring_expense_feedback |

---

## 🧠 Comportamento Atual (sem as migrations)

Os services `userPreferencesService.ts` e `recurringExpenseFeedbackService.ts` já possuem **fallback automático para localStorage**. O app funciona normalmente mesmo sem essas tabelas, com as seguintes diferenças:

- **Sem migração**: dados persistidos apenas no navegador (localStorage)
- **Com migração**: dados sincronizados entre dispositivos via Supabase

Um cache de sessão (`_supabaseFailed`) impede requisições repetidas ao Supabase após a primeira falha 404, evitando poluição do console e consumo de rede.
