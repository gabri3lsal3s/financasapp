# Próximos Passos — Manutenção e Refatoração

> **Data:** Junho de 2026
> **Propósito:** Guia de ações necessárias para manter o app saudável e continuar as refatorações em andamento.

---

## 📊 Estado Atual do Projeto

| Métrica | Valor | Status |
|---------|-------|--------|
| TypeScript errors | **0** | ✅ |
| Testes passando | **267/267** (30 arquivos) | ✅ |
| Build | **OK** | ✅ |
| UI Guardrails | **0 violações** | ✅ |
| `as any` em produção | **0** | ✅ |
| Non-null assertions em produção | **0** | ✅ |
| `catch(err: any)` | **0** | ✅ |
| `console.log` residual | **0** | ✅ |
| Maior arquivo | **2.276 linhas** (Reports.tsx) | 🟡 |
| Contas.tsx | **1.668 linhas** (↓371) | 🟢 |

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

## 2. ✅ Refatorações Concluídas

### 2.1 ✅ FloatingCalculator — Extração de Utilitários

**Arquivos criados:**
- `src/utils/calculatorExpression.ts` — `evaluateExpression`, `formatExpressionForDisplay`, `formatCanonicalNumberToPtBr`, `toCanonicalNumericString` (~80 linhas)
- `src/utils/calculatorGeometry.ts` — `clamp`, `getDefaultPanelRect`, `getUniformPanelSize`, `getPanelMinWidth/Height`, `isMobileViewport`, constantes + tipos `PanelRect`/`Point` (~100 linhas)
- `src/utils/calculatorDom.ts` — `isNumericField`, `getInputDisplayName`, `getNumericInputs`, `prefersValorField`, `getTopDialog`, `isVisibleElement` (~60 linhas)

**Impacto:** FloatingCalculator.tsx reduziu de ~1.569 → **~1.107 linhas** (-462, ~29%). Funções agora são testáveis sem browser.

### 2.2 ✅ Non-null Assertions Zeradas

- `useReconciliationDrafts.ts:57` — única ocorrência corrigida: `uniqueMap.get(tickerUpper)!` → `uniqueMap.get(tickerUpper)` com `if (existing && ...)`
- **5 ocorrências em Contas.tsx** — callbacks com captura de variável local
- **4 ocorrências em IncomeFormModal.tsx** — captura local + guard
- **Total:** **0** non-null assertions em produção.

### 2.3 ✅ Reports.tsx — Extração de Funções de Agregação

**Arquivos criados:**
- `src/utils/reportAggregation.ts` — ~20 funções puras de agregação (~250 linhas)
- `src/utils/reportCustomData.ts` — ~15 funções puras de período customizado (~671 linhas)
- `src/components/reports/ReportPendingDebtsWidget.tsx` — Widget de projeção de pendências (~60 linhas)
- `src/components/reports/ReportUnifiedCompositionCard.tsx` — Card de composição detalhada (~120 linhas)

**Impacto:** Reports.tsx reduziu de **3.119 → 2.276 linhas** (-843, ~27%).

### 2.4 ✅ TS Errors Corrigidos

**12 erros corrigidos no total — Reports.tsx (9) + Contas.tsx (3):**

| Erro | Local | Causa | Solução |
|------|-------|-------|---------|
| TS6192 (3x) | Reports.tsx | Imports órfãos | Removidos |
| TS6133 (1x) | Reports.tsx | Type import não usado | Removido |
| TS2322 (2x) | Reports.tsx | Tipos de retorno genéricos | Tipos específicos adicionados |
| TS6133 (9x) | Reports.tsx | Imports órfãos pós-extração | Removidos |
| TS2304 (7x) | useContasModals.ts | Tipo `Expense` não importado | Adicionado ao import |
| TS6133 (2x) | useContasModals.ts | Parâmetros não usados | Removidos da assinatura |
| TS18047 | Contas.tsx | Null possível em closure | Captura em variável local |

### 2.5 ✅ FloatingCalculator — Hooks de Keyboard e Panel Extraídos

**Arquivos criados:**
- `src/hooks/useCalculatorKeyboard.ts` — Atalhos de teclado (~95 linhas)
- `src/hooks/useCalculatorPanel.ts` — Drag/resize do painel (~216 linhas)

**Impacto:** FloatingCalculator.tsx reduziu de ~1.340 → **~1.107 linhas** (-233, ~17%). UseEffects: ~11 → **~10**.

### 2.6 ✅ Contas.tsx — Extração de Hooks de Bills e Modais

**Arquivos criados:**
- `src/hooks/useContasBills.ts` — Faturas, despesas por cartão, pagamentos (~264 linhas)
- `src/hooks/useContasModals.ts` — ~30 estados de modal + handlers (~551 linhas)

**Impacto:** Contas.tsx reduziu de **2.039 → 1.668 linhas** (-371, ~18%).

### 2.7 ✅ FloatingActionHub Extraído

**Arquivos criados:**
- `src/hooks/useScrollToTop.ts` — Máquina de estados pull-to-top (~220 linhas)
- `src/utils/haptics.ts` — Função `triggerHaptic` multi-stage (~25 linhas)

**Impacto:** FloatingActionHub.tsx reduziu de ~520 → **~50 linhas** (-470, ~90%). UseEffects: ~10 → **4**.

### 2.8 ✅ Testes e Qualidade

- `src/utils/checkDbRates.test.ts` — Teste de integridade das taxas CDI/SELIC (~59 linhas)
- `as any` zerado — 2 casts em `reportCustomData.ts` substituídos por narrowing genérico `<T extends { total: number }>`
- `console.*` → `logger.*` — 89 chamadas substituídas em 32+ arquivos
- `key={index}` → chaves estáveis em DatePicker.tsx e CreditCardTimeline.tsx

### 2.9 ✅ Correções de Bugs

| # | Correção | Arquivo | Severidade |
|---|----------|---------|------------|
| 1 | **Loop infinito no useSupabaseTable** — configRef pattern | `useSupabaseTable.ts` | 🔴 Crítica |
| 2 | **CSS spacing bug** — `h - 2 w - 2` → `h-2 w-2 rounded-full` | Settings.tsx | 🔴 Visual |
| 3 | **CSS spacing bug** — `rounded - lg border p - 3` → `rounded-lg border p-3` | Settings.tsx | 🔴 Visual |
| 4 | **Overflow DECIMAL(15,2)** — Migration DECIMAL(18,2) + arredondamento | Vários | 🔴 Crash |
| 5 | **Select.Item value="" no Radix UI** — sentinel value `__empty__` | Select.tsx | 🔴 Erro |
| 6 | **`any` type** — `ValuedPosition['fundamentals']` | usePortfolioState.ts | 🟡 Type safety |
| 7 | **InfoTooltip z-index/overflow clipping** — tooltips cortados por cards pais. Reescrevido com `createPortal` + `position: fixed` + posição calculada via `getBoundingClientRect` | `InfoTooltip.tsx` | 🔴 Visual |

---

## ✅ Estado Atual Pós-Refatoração

| Métrica | Valor | Status |
|---------|-------|--------|
| TypeScript errors | **0** | ✅ |
| Testes passando | **267/267** (30 arquivos) | ✅ |
| Build | **OK** | ✅ |
| UI Guardrails | **0 violações** | ✅ |
| `as any` em produção | **0** | ✅ |
| Non-null assertions em produção | **0** | ✅ |
| `console.log` residual | **0** | ✅ |
| Maior arquivo | **2.276 linhas** (Reports.tsx) | 🟡 |
| Contas.tsx | **1.668 linhas** (↓371) | 🟢 |
| FloatingActionHub useEffects | **4** (↓6) | ✅ |

---

## 3. 🟡 Pendências Técnicas Priorizadas

### Prioridade Média (🟡)

| # | Item | Arquivo | Esforço | Status |
|---|------|---------|---------|--------|
| 1 | Extrair lógica de parcelamento/deleção de `useExpenses.ts` (~497 linhas) | `useExpenses.ts` | ~3h | ⏳ |
| 2 | Fracionar Categories.tsx (~1.252 linhas) em CategoryGrid, CategoryKPIs | `Categories.tsx` | ~3h | ⏳ |
| 3 | Fracionar CreditCardCsvReconciliationPanel (~1.193 linhas) em CsvUploadZone, ComparisonRowCard | `CreditCardCsvReconciliationPanel.tsx` | ~3h | ⏳ |

### Prioridade Baixa (🟢)

| # | Item | Esforço | Status |
|---|------|---------|--------|
| 4 | Criar testes unitários para `calculatorExpression`, `calculatorGeometry`, `calculatorDom` | ~1h | ⏳ |
| 5 | Criar testes unitários para `useCalculatorKeyboard`, `useCalculatorPanel`, `useScrollToTop` | ~1.5h | ⏳ |
| 6 | Criar testes unitários para `reportAggregation` + `reportCustomData` | ~1h | ⏳ |
| 7 | Migrar `--color-*` para `--ds-*` | ~2h | ⏳ |
| 8 | Tooltips em gráficos de pizza | ~30min | ⏳ |

---

## 4. 📋 Plano de Refinamento Completo

Foi elaborado um plano detalhado de refinamento UI/UX em `docs/REFINEMENT_PLAN.md`, organizado em 7 fases (~29h estimadas):

| Fase | Nome | Itens | Esforço |
|------|------|-------|---------|
| 1 | 🎨 Consistência Visual | Eliminar inline styles, `!important`, estados vazios | ~9h |
| 2 | ♿ Acessibilidade | Focus ring, labels, ErrorBoundary | ~3h |
| 3 | 📱 Mobile First | Conflito floating elements, touch targets | ~5.5h |
| 4 | 🖥️ Desktop | Sidebar persistência, KPI spacing | ~1.75h |
| 5 | ⚡ Performance | Theme transition, re-renders, deps | ~5.5h |
| 6 | 🧩 Resiliência | Feedback de erro offline, EmptyState, skeletons | ~3h |
| 7 | 🌗 Temas | Contraste midnight, transição otimizada | ~1h |

---

## 5. 📋 Novos Arquivos Criados

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

## 6. 🔍 Monitoramento Contínuo

### Pré-commit checklist

```bash
npx tsc --noEmit           # 0 erros
npx vitest run             # 267 testes passando
npm run guardrails:ui      # 0 violações
npm run build              # Build OK
```

---

## 7. 📚 Documentação Relacionada

| Documento | Link | Conteúdo |
|-----------|------|----------|
| Arquitetura | `docs/ARCHITECTURE.md` | Visão geral do sistema, hooks, componentes |
| Plano de Melhorias | `docs/IMPROVEMENT_PLAN.md` | Prioridades e anti-padrões |
| Guia Completo | `docs/COMPLETE_GUIDE.md` | Stack, páginas, setup |
| Auditoria | `docs/AUDITORIA_REVISAO.md` | Diagnóstico técnico completo |
| Refatoração | `docs/REFACTORING_PLAN.md` | Plano de refatoração anterior |
| Refinamento UI/UX | `docs/REFINEMENT_PLAN.md` | Plano de refinamento visual e acessibilidade |
| Importação B3 | `docs/REIMPORT_INVESTMENTS.md` | Guia de reimportação de extrato |

---

> **Mantenha este documento atualizado** conforme novas correções forem aplicadas ou novas pendências forem identificadas.
