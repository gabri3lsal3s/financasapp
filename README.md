# Minhas Finanças

Aplicação web para controle financeiro pessoal, com foco em simplicidade de uso, visão mensal/anual e operação offline.

## O que o app oferece

- Dashboard com KPIs de rendas, despesas, investimentos e saldo.
- CRUD completo de despesas, rendas, investimentos e categorias.
- Página de categorias unificada (`/categories`) com limites de despesa e expectativas de renda por mês.
- Relatórios mensais/anuais com detalhamento por categoria e inclusão parcial por item (`report_weight`).
- Fluxo de cartão de crédito com competência de fatura e suporte a estorno como renda.
- PWA instalável com atualização de versão e fila offline para mutações.

## Stack

- React 18 + TypeScript
- Vite
- Tailwind CSS
- Supabase
- Recharts
- React Router

## Setup rápido

1. Instale dependências:

```bash
npm install
```

2. Configure variáveis de ambiente no `.env`:

```env
VITE_SUPABASE_URL=https://seu-projeto.supabase.co
VITE_SUPABASE_ANON_KEY=sua-chave-anon
```

3. No Supabase SQL Editor, execute:

- [database.sql](database.sql) para estrutura base completa.
- [MIGRATION_RENAME_EXTORNO_TO_ESTORNO.sql](MIGRATION_RENAME_EXTORNO_TO_ESTORNO.sql) para padronizar categorias antigas (`Extorno` -> `Estorno`).

4. Rode o app em desenvolvimento:

```bash
npm run dev
```

## Scripts principais

- `npm run dev`: ambiente local com recarga automática.
- `npm run build`: valida TypeScript e gera build de produção.
- `npm run preview`: sobe build local para validação final.

## Estrutura do projeto

```text
src/
  components/   componentes reutilizáveis de UI
  contexts/     contexto de tema/paleta
  hooks/        regras de dados e integração com Supabase
  lib/          clientes/configurações de infraestrutura
  pages/        telas principais
  services/     regras de domínio e serviços auxiliares
  types/        contratos TypeScript
  utils/        helpers utilitários
```

## Banco de dados (resumo)

Tabelas principais:

- `categories`, `income_categories`
- `expenses`, `incomes`, `investments`
- `expense_category_month_limits`, `income_category_month_expectations`
- estruturas auxiliares de cartões e assistente já contempladas no script base.

Observações:

- `report_weight` permite considerar parcial/totalmente itens nos relatórios.
- Estornos são tratados como renda na categoria `Estorno`.

## PWA e modo offline

- Service Worker ativo para assets do app.
- Operações de escrita offline entram em fila local e sincronizam ao reconectar.
- Prompt de atualização aparece quando existe nova versão publicada.

## Assistente (resumo)

- Suporta adição de despesa, renda e investimento por voz/texto.
- Mantém confirmação explícita para ações sensíveis.
- Armazena telemetria e memória local com retenção configurável em Configurações.

## Segurança

- O setup atual é voltado para ambiente sem autenticação estrita.
- Para produção multiusuário, habilite RLS e políticas por `user_id` no Supabase.

## Checklist de validação

1. Execute `npm run build` sem erros.
2. Rode `npm run preview` e valide fluxo principal.
3. Teste modo offline (criar lançamento sem internet e sincronizar ao reconectar).
4. Valide estornos em cartões e visualização correta em rendas.
