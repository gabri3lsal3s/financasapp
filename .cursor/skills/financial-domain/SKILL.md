---
name: financial-domain
description: Regras de cartão de crédito, parcelas, relatórios, investimentos e consultoria. Use ao alterar billing, CSV, KPIs ou papéis de usuário.
---

# Skill: Domínio Financeiro

## Escopo e gatilhos

- `src/utils/creditCard*.ts`
- `src/hooks/useExpenses.ts`, `useIncomes.ts`, `useCreditCards.ts`
- `src/pages/CreditCards.tsx`, `Reports.tsx`, `Investments.tsx`
- `src/components/consulting/**`
- `src/services/investmentEngine.ts`

## Cartão de crédito

| Conceito | Onde |
|----------|------|
| Competência da fatura | `resolveBillCompetence` em `creditCardBilling.ts` |
| Dia de fechamento | `credit_cards.closing_day` + overrides em `credit_card_monthly_cycles` |
| Parcelas | `splitAmountIntoInstallments`, `buildInstallmentDates` em hooks/utils |
| CSV fatura | `creditCardCsvReconciliation.ts`, `creditCardCsvLearning.ts` |

**Ao alterar billing ou CSV:** rodar/estender testes `*.test.ts` correspondentes.

## Despesas / rendas

- `report_weight` afeta relatórios — documentar impacto ao mudar defaults.
- Estorno automático de cartão → renda com edição bloqueada quando aplicável.
- UI: `ExpenseFormModal`, `IncomeFormModal`, `TransactionCard`.

## Investimentos

- Cálculos e consolidação: `investmentEngine.ts`.
- Não misturar lógica de aporte com billing de cartão.

## Relatórios

- `ReportCharts` (Recharts), `useReports`, `useIncomeReports`.
- Agregações respeitam mês/competência e `report_weight`.

## Consultoria

- `profile.role === 'consultant'` → `/consulting` + componentes em `consulting/`.
- `profile.role === 'client'` → somente `ClientDashboard` (read-only).
- RLS de portfolios: migrations `supabase/migrations/20260523_*`.

## Papéis e aprovação

- Checar `is_approved`, `is_blocked`, `is_rejected` antes de liberar app completo.
- Novos papéis exigem UI (`App.tsx`) + políticas SQL.

## Anti-padrões

- Recalcular relatórios históricos ao mudar categoria atual sem migration.
- Duplicar fórmula de competência fora de `creditCardBilling`.
- Permitir cliente editar lançamentos do assessor.

## Referências

- `.cursor/rules/17-financial-domain.mdc`
- `docs/ARCHITECTURE.md`
