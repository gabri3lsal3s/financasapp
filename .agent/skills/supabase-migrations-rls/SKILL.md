---
name: supabase-migrations-rls
description: Criação de migrations SQL, RLS por user_id e políticas de consultoria no Supabase. Use ao alterar schema ou políticas.
---

# Skill: Migrations e RLS (Supabase)

## Escopo e gatilhos

- `database/database.sql`
- `supabase/migrations/*.sql`
- Discussões de índices, FK, triggers

## Regras de schema

- Tabelas pessoais: `user_id UUID DEFAULT auth.uid() NOT NULL`.
- PK explícita (`uuid` ou `bigserial` conforme padrão existente).
- Índice em `user_id` e colunas de filtro (`date`, FKs).

## RLS

```sql
ALTER TABLE expenses ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own expenses"
  ON expenses FOR SELECT USING (auth.uid() = user_id);
-- repetir INSERT/UPDATE/DELETE com WITH CHECK / USING
```

- Consultoria: copiar padrão das migrations `20260523_*` (portfolios, consultant_profiles).
- Testar com usuário A não vendo dados do usuário B no SQL Editor.

## Processo de migration

1. Criar arquivo `supabase/migrations/YYYYMMDD_descricao.sql`.
2. Aplicar no projeto Supabase (SQL Editor ou CLI).
3. Atualizar `database/database.sql` se for bootstrap de ambiente novo.
4. Documentar breaking change no PR.

## Integridade

- `UNIQUE` compostos quando regra de negócio exigir (ex.: insight por mês/usuário).
- Triggers existentes no `database.sql` — não remover sem migração de dados.

## Anti-padrões

- Schema só no cliente sem migration versionada.
- Desabilitar RLS "temporariamente" em produção.
- Introduzir Drizzle/Prisma neste repo sem decisão de arquitetura.

## Referências

- `.cursor/rules/04-supabase-database-rls.mdc`
