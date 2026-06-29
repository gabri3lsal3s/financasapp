# Próximos Passos — Correção de Overflow e Manutenção

> **Data:** Junho de 2026
> **Propósito:** Guia de ações necessárias para aplicar as correções de overflow no motor de rentabilidade e manter o app saudável.

---

## 1. 🔴 Aplicar Migration no Supabase

A correção principal do overflow requer alteração no schema do banco de dados. A migration já foi criada em `supabase/migrations/20260629_fix_numeric_overflow.sql`.

### Opção A — Supabase CLI

```bash
supabase migration up
```

### Opção B — SQL Editor Manual

1. Abra o [Supabase Dashboard](https://supabase.com/dashboard)
2. Selecione o projeto
3. Vá em **SQL Editor**
4. Copie e cole o conteúdo de `supabase/migrations/20260629_fix_numeric_overflow.sql`
5. Execute

### O que a migration faz:

| Tabela | Colunas Alteradas | Tipo Antigo | Tipo Novo |
|--------|-------------------|-------------|-----------|
| `portfolio_share_daily` | `gross_pl`, `net_pl`, `cash_value`, `invested_cost` | `DECIMAL(15,2)` | `DECIMAL(18,2)` |
| `portfolios` | `cash_balance`, `last_gross_pl`, `last_net_pl` | `DECIMAL(15,2)` | `DECIMAL(18,2)` |
| `portfolio_period_snapshots` | `somatorio_aportes`, `somatorio_resgates`, `dividendos_recebidos` | `DECIMAL(15,2)` | `DECIMAL(18,2)` |
| `portfolio_asset_definitions` | `applied_amount`, `manual_current_value` | `DECIMAL(15,2)` | `DECIMAL(18,2)` |

---

## 2. 🟡 Recalcular Rentabilidade

Após aplicar a migration:

1. Abra o app no navegador
2. Vá para **Investimentos**
3. Clique no botão **Recalcular rentabilidade** (ou `reload` no hook `usePortfolioState`)
4. Verifique o console do navegador — o erro `numeric field overflow` não deve mais aparecer
5. Confira se os gráficos de evolução histórica e rentabilidade dos ativos de renda fixa estão sendo exibidos corretamente

Se o erro persistir, verifique:

```javascript
// No console do navegador:
console.log('dailyRows:', dailyRows)
```

Os valores de `gross_pl`, `net_pl`, `cash_value` e `invested_cost` devem estar arredondados para 2 casas decimais.

---

## 3. 🟢 Verificar Edge Function (Opcional)

A Edge Function `daily-close` (`supabase/functions/daily-close/index.ts`) foi atualizada com a mesma proteção de arredondamento. Para implantar:

```bash
supabase functions deploy daily-close
```

---

## 4. 🔍 Monitoramento Contínuo

### 4.1 Logs a observar

| Log | Significado | Ação |
|-----|-------------|------|
| `[recalcFallback]` | Recálculo TWR client-side iniciado | Normal |
| `[usePortfolioState] Backfill histórico falhou` | Erro no backfill | Verificar migration |
| `[usePortfolioState] Histórico TWR incompleto` | Backfill necessário | Normal (auto-recupera) |

### 4.2 Pré-commit checklist

```bash
npx tsc --noEmit           # 0 erros
npx vitest run             # 262 testes passando
npm run guardrails:ui      # 0 violações
```

---

## 5. 📋 Pendências Técnicas

### 5.1 Non-null Assertions (🔴 20+ ocorrências)

Arquivos mais críticos:
- `Reports.tsx` — 6 ocorrências em `categoryMap.get(catId)!`
- `MonthlySummaryCard.tsx` — 8 ocorrências em `summary!.totalInvested`
- `useReports.ts` — 2 ocorrências

**Impacto:** Crash runtime se o Map não contiver a chave esperada.

**Solução:** Substituir `!` por `if (value) { ... }` ou optional chaining.

### 5.2 Extrair FloatingCalculator (~1.465 linhas)

13 `useEffect` — extrair para hooks customizados:
- `useCalculatorDrag.ts` — handlers de drag/resize com pointer events
- `useCalculatorKeyboard.ts` — handlers de teclado
- `utils/calculatorExpression.ts` — avaliação de expressões

### 5.3 Fracionar Reports.tsx (~3.119 linhas)

Extrair para:
- `utils/reportAggregation.ts` — funções de agregação (categoryMap, etc.)
- `utils/reportFilters.ts` — funções de filtro
- `components/reports/ReportSummarySection.tsx` — seções de resumo
- `components/reports/ReportChartsSection.tsx` — seções de gráficos

### 5.4 Fracionar Contas.tsx (~2.039 linhas)

- `hooks/useContasState.ts` — estado de tabs, filtros, períodos
- `utils/creditCardCalculations.ts` — cálculos de fatura
- `utils/debtCalculations.ts` — cálculos de dívida

---

## 6. 📚 Documentação Relacionada

| Documento | Link | Conteúdo |
|-----------|------|----------|
| Arquitetura | `docs/ARCHITECTURE.md` | Visão geral do sistema, hooks, componentes |
| Plano de Melhorias | `docs/IMPROVEMENT_PLAN.md` | Prioridades e anti-padrões |
| Guia Completo | `docs/COMPLETE_GUIDE.md` | Stack, páginas, setup |
| Auditoria | `docs/AUDITORIA_REVISAO.md` | Diagnóstico técnico completo |
| Refatoração | `docs/REFACTORING_PLAN.md` | Plano de refatoração anterior |
| Importação B3 | `docs/REIMPORT_INVESTMENTS.md` | Guia de reimportação de extrato |

---

> **Mantenha este documento atualizado** conforme novas correções forem aplicadas ou novas pendências forem identificadas.
