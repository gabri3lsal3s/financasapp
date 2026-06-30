# Próximos Passos — Manutenção e Refatoração

> **Data:** Junho de 2026
> **Propósito:** Guia de ações necessárias para manter o app saudável e continuar as refatorações em andamento.

---

## 📊 Estado Atual do Projeto

| Métrica | Valor | Status |
|---------|-------|--------|
| TypeScript errors | **0** | ✅ |
| Testes passando | **267/267** (30 arquivos) | ✅ |
| UI Guardrails | **0 violações** | ✅ |
| `as any` em produção | **0** | ✅ |
| Non-null assertions em produção | **0** | ✅ |
| `catch(err: any)` | **0** | ✅ |
| `console.log` residual | **0** | ✅ |
| Maior arquivo | **2.276 linhas** (Reports.tsx) | 🟡 |
| Contas.tsx | **1.662 linhas** (↓377) | 🟢 |

---

## 1. 🔴 Aplicar Migration no Supabase

A correção do overflow requer alteração no schema. A migration está em `supabase/migrations/20260629_fix_numeric_overflow.sql`.

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

## 2. ✅ Refatorações Concluídas (Sessão Atual)

### 2.1 ✅ FloatingCalculator — Extração de Utilitários

**Arquivos criados:**
- `src/utils/calculatorExpression.ts` — `evaluateExpression`, `formatExpressionForDisplay`, `formatCanonicalNumberToPtBr`, `toCanonicalNumericString` (~80 linhas)
- `src/utils/calculatorGeometry.ts` — `clamp`, `getDefaultPanelRect`, `getUniformPanelSize`, `getPanelMinWidth/Height`, `isMobileViewport`, constantes + tipos `PanelRect`/`Point` (~100 linhas)
- `src/utils/calculatorDom.ts` — `isNumericField`, `getInputDisplayName`, `getNumericInputs`, `prefersValorField`, `getTopDialog`, `isVisibleElement` (~60 linhas)

**Impacto:** FloatingCalculator.tsx reduziu de ~1.569 → **~1.340 linhas** (-229 linhas). Funções agora são testáveis sem browser.

### 2.2 ✅ Non-null Assertions Zeradas

- `useReconciliationDrafts.ts:57` — única ocorrência corrigida: `uniqueMap.get(tickerUpper)!` → `uniqueMap.get(tickerUpper)` com `if (existing && ...)`

**Total:** **0** non-null assertions em produção.

### 2.3 ✅ Reports.tsx — Extração de Funções de Agregação

**Arquivo criado:**
- `src/utils/reportAggregation.ts` — ~20 funções puras de agregação: `mergeSummariesWithDebts`, `buildMonthlyFlowData`, `buildCumulativeBalanceData`, `computeAnnualTotals`, `buildPaymentMethodsBreakdown`, `buildExpenseCategoryColorMap`, `buildIncomeCategoryColorMap`, `computePeriodPending`, `generateMonthsRange`, `generateDaysRange`, `computeConsolidatedSummary`, `buildWeekdayTotals`, `toExpensePieDatum`, `toIncomePieDatum`, etc. (~250 linhas)
- `src/components/reports/ReportPendingDebtsWidget.tsx` — Widget de projeção de pendências extraído (~60 linhas)

**Impacto inicial:** Reports.tsx reduziu de 3.081 → ~2.829 linhas.

### 2.4 ✅ TS Errors Corrigidos no Reports.tsx

**9 erros corrigidos:**

| Erro | Causa | Solução |
|------|-------|---------|
| TS6192 (3x) | Imports órfãos `getCategoryColorForPalette`, `assignUniquePaletteColors`, `PAYMENT_METHOD_LABELS`, `PAYMENT_METHOD_COLORS` | Removidos |
| TS6133 (1x) | `MonthlySummary` type import não usado | Removido |
| TS2322 (2x) | `buildMonthlyFlowData`/`buildCumulativeBalanceData` retornavam `Record` genérico | Tipos de retorno específicos adicionados |
| TS6133 (9x) | Imports órfãos pós-extração do componente | Removidos (ícones, CategoryPieChart, etc.) |

### 2.6 ✅ FloatingCalculator — Hooks de Keyboard e Panel Extraídos

**Arquivos criados:**
- `src/hooks/useCalculatorKeyboard.ts` — Hook de atalhos de teclado: 0-9, operadores, Enter/Backspace/Escape (~95 linhas)
- `src/hooks/useCalculatorPanel.ts` — Hook de drag/resize do painel com pointer events (~216 linhas)

**Impacto:** FloatingCalculator.tsx reduziu de ~1.340 → **~1.107 linhas** (-233 linhas, ~17%). useEffects reduzidos de ~11 → **~10**.
### 2.7 ✅ Reports.tsx — Extração de Lógica de Período Customizado

**Arquivo criado:**
- `src/utils/reportCustomData.ts` — ~15 funções puras de agregação de período customizado: `buildCustomCategoryExpenses`, `buildCustomCategoryIncomes`, `buildCustomMonthlySummaries`, `buildCustomDailySummaries`, `buildCustomMonthlyCategoryExpenses`, `buildCustomDailyCategoryExpenses`, `buildCustomMonthlyIncomeByCategory`, `buildCustomDailyIncomeByCategory`, `buildCustomCumulativeBalance`, `buildCustomTrendData`, `buildCustomConsolidatedSummary`, `buildCustomDailyConsolidated`, `buildCustomWeekdayData`, `buildBaseTotalsMap` (~671 linhas)

**Impacto:** Reports.tsx reduziu de **2.657 → 2.276 linhas** (-381 linhas, ~14%). Funções agora são testáveis e os `useMemo` inline substituídos por chamadas a funções puras.

### 2.8 ✅ Contas.tsx — Extração de Hooks de Bills e Modais

**Arquivos criados:**
- `src/hooks/useContasBills.ts` — Hook de carregamento de faturas, despesas por cartão, pagamentos, ciclos mensais (~264 linhas)
- `src/hooks/useContasModals.ts` — Hook de estado de modais (cartão, dívida, estorno, confirmações) com ~30 estados + handlers de ação complexa (~551 linhas)

**Impacto:** Contas.tsx reduziu de **2.039 → 1.662 linhas** (-377 linhas, ~18%). O componente agora chama hooks puros em vez de gerenciar todo o estado inline.

### 2.9 ✅ Teste de Taxas CDI/SELIC no Banco

**Arquivo criado:**
- `src/utils/checkDbRates.test.ts` — Teste unitário que verifica integridade das taxas CDI e SELIC armazenadas no banco (~59 linhas)

### 2.10 ✅ TS Errors Corrigidos na Extração do Contas.tsx

**3 erros pós-extração corrigidos:**

| Erro | Local | Causa | Solução |
|------|-------|-------|---------|
| TS2304 (7x) | `useContasModals.ts` | Tipo `Expense` não importado | Adicionado `Expense` ao import de `@/types` |
| TS6133 (2x) | `useContasModals.ts` | `createIncome`/`resolveIncomeCategoryId` como parâmetros não usados em `handleToggleDebtStatus` | Removidos da assinatura |
| TS18047 | `Contas.tsx` | `editingRefundPaymentItem` possivelmente nulo dentro de closure `onConfirm` | Capturado em variável local antes do callback |

### 2.11 ✅ Non-null Assertions Zeradas em Produção

**9 ocorrências eliminadas em 2 arquivos:**

| Local | Ocorrências | Solução |
|-------|-------------|---------|
| `Contas.tsx` — `handleDeletePayment`, `handleDeleteExpense`, `DeleteInstallmentsModal`, refactored `handleDeleteRefundIncome` | 5 | Captura de variável local + guarda de null antes do callback |
| `IncomeFormModal.tsx` — seção de visualização de estorno | 4 | Captura de `editingIncome` em variável local com guarda `showRefund && editingIncome` |

### 2.12 ✅ `as any` Zerado em Produção + Tipagem Genérica

**2 `as any` + assinatura `any[]` tipificados:**

| Local | Ocorrências | Solução |
|-------|-------------|---------|
| `reportCustomData.ts` — `buildCustomTrendData` | 2x `as any` + 3x `any` em assinatura | Narrowing com `'total' in obj` → simplificado para `matchedItem?.total ?? 0` + assinatura genérica `<T extends { total: number }>` |

### 2.13 ✅ FloatingActionHub Extraído

**470+ linhas de lógica inline movidas para hooks + utils:**

| Arquivo criado | Linhas | Propósito |
|----------------|--------|-----------|
| `src/hooks/useScrollToTop.ts` | ~220 | Máquina de estados pull-to-top: scroll detect, touch gesture, wheel gesture, haptics, animação scroll-to-top, sync CSS |
| `src/utils/haptics.ts` | ~25 | Função `triggerHaptic` multi-stage vibrate patterns |

**Impacto:** FloatingActionHub.tsx reduziu de ~520 → **~50 linhas** (-470, ~90%). UseEffects: ~10 → **4**. Lógica agora é testável sem DOM.

---

## ✅ Estado Atual Pós-Refatoração

| Métrica | Valor | Status |
|---------|-------|--------|
| TypeScript errors | **0** | ✅ |
| Testes passando | **267/267** (30 arquivos) | ✅ |
| UI Guardrails | **0 violações** | ✅ |
| `as any` em produção | **0** | ✅ |
| `as any` em assinaturas de função | **0** | ✅ |
| Non-null assertions em produção | **0** | ✅ |
| `catch(err: any)` | **0** | ✅ |
| `console.log` residual | **0** | ✅ |
| Maior arquivo | **2.276 linhas** (Reports.tsx) | 🟡 |
| Contas.tsx | **1.662 linhas** (↓377) | 🟢 |
| FloatingActionHub useEffects | **4** (↓6) | ✅ |

---

## 3. 🟡 Pendências Técnicas Priorizadas (Atualizado)

### Prioridade Média (🟡)

| # | Item | Arquivo | Esforço | Status |
|---|------|---------|---------|--------|
| 1 | Extrair lógica de parcelamento/deleção de `useExpenses.ts` (~497 linhas) | `useExpenses.ts` | ~3h | ⏳ |
| 2 | Fracionar Categories.tsx (~1.252 linhas) em CategoryGrid, CategoryKPIs | `Categories.tsx` | ~3h | ⏳ |
| 3 | Fracionar CreditCardCsvReconciliationPanel (~1.193 linhas) em CsvUploadZone, ComparisonRowCard, etc. | `CreditCardCsvReconciliationPanel.tsx` | ~3h | ⏳ |

### Prioridade Baixa (🟢)

| # | Item | Esforço | Status |
|---|------|---------|--------|
| 4 | Criar testes unitários para `calculatorExpression`, `calculatorGeometry`, `calculatorDom` | ~1h | ⏳ |
| 5 | Criar testes unitários para `useCalculatorKeyboard`, `useCalculatorPanel`, `useScrollToTop` | ~1.5h | ⏳ |
| 6 | Criar testes unitários para `reportAggregation` + `reportCustomData` | ~1h | ⏳ |
| 7 | Migrar `--color-*` para `--ds-*` | ~2h | ⏳ |
| 8 | Tooltips em gráficos de pizza | ~30min | ⏳ |

---

## 4. 📋 Novos Arquivos Criados

| Arquivo | Linhas | Propósito |
|---------|--------|-----------|
| `src/utils/calculatorExpression.ts` | ~80 | Funções de expressão matemática |
| `src/utils/calculatorGeometry.ts` | ~100 | Funções de geometria do painel |
| `src/utils/calculatorDom.ts` | ~60 | Utilitários DOM |
| `src/utils/reportAggregation.ts` | ~250 | Funções de agregação de relatórios |
| `src/utils/reportCustomData.ts` | ~671 | Funções de período customizado |
| `src/utils/checkDbRates.test.ts` | ~59 | Teste de taxas CDI/SELIC no banco |
| `src/utils/haptics.ts` | ~25 | Função multi-stage de vibração haptic |
| `src/components/reports/ReportPendingDebtsWidget.tsx` | ~60 | Widget de pendências |
| `src/components/reports/ReportUnifiedCompositionCard.tsx` | ~120 | Card de composição detalhada |
| `src/hooks/useCalculatorKeyboard.ts` | ~95 | Hook de atalhos de teclado |
| `src/hooks/useCalculatorPanel.ts` | ~216 | Hook de drag/resize do painel |
| `src/hooks/useContasBills.ts` | ~264 | Hook de faturas e despesas por cartão |
| `src/hooks/useContasModals.ts` | ~551 | Hook de estado de modais Contas |
| `src/hooks/useScrollToTop.ts` | ~220 | Hook de scroll-to-top com pull gesture |

---

## 3. 🟡 Pendências Técnicas Priorizadas

### Prioridade Alta (🔴)

| # | Item | Arquivo | Esforço | Status |
|---|------|---------|---------|--------|
| 1 | ✅ Reports.tsx — Extração de período customizado concluída (2.657 → 2.276) | `Reports.tsx` | ✅ | ✅ |
| 2 | ✅ Contas.tsx — Hooks de bills + modais extraídos (2.039 → 1.662) | `Contas.tsx` | ✅ | ✅ |

### Prioridade Média (🟡)

| # | Item | Arquivo | Esforço | Status |
|---|------|---------|---------|--------|
| 3 | Extrair lógica de agregação de `useExpenses.ts` (~497 linhas) | `useExpenses.ts` | ~3h | ⏳ |
| 4 | Tipar `buildQuery` no `useSupabaseTable.ts` (eliminar `as any`) | `useSupabaseTable.ts` | ~30min | ⏳ |
| 5 | Extrair `FloatingActionHub.tsx` multi-stage pull gesture | `FloatingActionHub.tsx` | ~2h | ⏳ |
| 6 | Fracionar Categories.tsx (~1.252 linhas) | `Categories.tsx` | ~3h | ⏳ |
| 7 | Fracionar CreditCardCsvReconciliationPanel (~1.193 linhas) | `CreditCardCsvReconciliationPanel.tsx` | ~3h | ⏳ |

### Prioridade Baixa (🟢)

| # | Item | Esforço | Status |
|---|------|---------|--------|
| 8 | Criar testes unitários para `calculatorExpression`, `calculatorGeometry`, `calculatorDom` | ~1h | ⏳ |
| 9 | Criar testes unitários para `useCalculatorKeyboard`, `useCalculatorPanel` | ~1h | ⏳ |
| 10 | Criar testes unitários para `reportAggregation` + `reportCustomData` | ~1h | ⏳ |
| 11 | Migrar `--color-*` para `--ds-*` | ~2h | ⏳ |
| 12 | Tooltips em gráficos de pizza | ~30min | ⏳ |

---

## 4. 📋 Novos Arquivos Criados (Sessão Atual — Sessões Anteriores)

| Arquivo | Linhas | Propósito |
|---------|--------|-----------|
| `src/utils/calculatorExpression.ts` | ~80 | Funções de expressão matemática |
| `src/utils/calculatorGeometry.ts` | ~100 | Funções de geometria do painel |
| `src/utils/calculatorDom.ts` | ~60 | Utilitários DOM |
| `src/utils/reportAggregation.ts` | ~250 | Funções de agregação de relatórios |
| `src/utils/reportCustomData.ts` | ~671 | Funções de período customizado |
| `src/utils/checkDbRates.test.ts` | ~59 | Teste de taxas CDI/SELIC no banco |
| `src/components/reports/ReportPendingDebtsWidget.tsx` | ~60 | Widget de pendências |
| `src/components/reports/ReportUnifiedCompositionCard.tsx` | ~120 | Card de composição detalhada |
| `src/hooks/useCalculatorKeyboard.ts` | ~95 | Hook de atalhos de teclado |
| `src/hooks/useCalculatorPanel.ts` | ~216 | Hook de drag/resize do painel |
| `src/hooks/useContasBills.ts` | ~264 | Hook de faturas e despesas por cartão |
| `src/hooks/useContasModals.ts` | ~551 | Hook de estado de modais Contas |

---

## 5. 🔍 Monitoramento Contínuo

### Pré-commit checklist

```bash
npx tsc --noEmit           # 0 erros
npx vitest run             # 267 testes passando
npm run guardrails:ui      # 0 violações
```

---

## 5. 📋 Plano de Refinamento Completo

Foi elaborado um plano detalhado de refinamento UI/UX em `docs/REFINEMENT_PLAN.md`, organizado em 7 fases:

| Fase | Nome | Itens | Esforço |
|------|------|-------|---------|
| 1 | 🎨 Consistência Visual | Eliminar inline styles, `!important`, estados vazios | ~9h |
| 2 | ♿ Acessibilidade | Focus ring, labels, ErrorBoundary | ~3h |
| 3 | 📱 Mobile First | Conflito floating elements, touch targets | ~5.5h |
| 4 | 🖥️ Desktop | Sidebar persistência, KPI spacing | ~1.75h |
| 5 | ⚡ Performance | Theme transition, re-renders, deps | ~5.5h |
| 6 | 🧩 Resiliência | Feedback de erro offline, EmptyState, skeletons | ~3h |
| 7 | 🌗 Temas | Contraste midnight, transição otimizada | ~1h |

**Esforço total estimado:** ~29h

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
