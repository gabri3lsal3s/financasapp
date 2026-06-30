# Plano de Melhorias — FinançasApp

> **Data:** Junho de 2026
> **Baseado em:** Auditoria estrutural de código, regras Cursor, skills de engenharia e documentação do projeto.
> **Propósito:** Registrar fragilidades identificadas e servir como guia priorizado para sprints futuros.

---

## Sumário

1. [Resumo do Estado Atual](#1-resumo-do-estado-atual)
2. [🔴 Críticas: Correções Imediatas](#2--correções-urgentes)
3. [🟡 Melhorias de Curto Prazo](#3--melhorias-de-curto-prazo)
4. [🟢 Melhorias de Médio/Longo Prazo](#4--melhorias-de-médiolongo-prazo)
5. [Métricas e Validação](#5-métricas-e-validação)
6. [Glossário de Anti-padrões](#6-glossário-de-anti-padrões)

---

## 1. Resumo do Estado Atual

### 1.1 Métricas da Codebase

| Métrica | Valor | Classificação |
|---------|-------|---------------|
| TypeScript errors | **0** | ✅ |
| Testes passando | **267/267** (30 arquivos) | ✅ |
| UI Guardrails | **0 violações** | ✅ |
| `as any` em produção | **0** | ✅ |
| `as any` em assinaturas de função | **0** | ✅ |
| Non-null assertions (`!`) em produção | **0** | ✅ |
| `catch(err: any)` | **0** | ✅ |
| HTML nativo em pages | **0** | ✅ |
| `console.log` em produção | **0** (exceto logger.ts) | ✅ |
| `@ts-ignore` / `@ts-expect-error` | **0** | ✅ |
| Maior arquivo | **2.276 linhas** (Reports.tsx) | 🟡 |
| `useEffect` médio por componente | ~5 | 🟡 |
| FloatingActionHub useEffects | **4** (↓6) ✅ |

### 1.3 Últimas Correções Realizadas (Junho 2026)

| # | Correção | Arquivo |
|---|----------|---------|
| 1 | **CSS spacing bug** — `h - 2 w - 2 rounded - full` → `h-2 w-2 rounded-full` | Settings.tsx |
| 2 | **CSS spacing bug** — `rounded - lg border p - 3` → `rounded-lg border p-3` | Settings.tsx |
| 3 | **Inline style → class** — `style={{ color: '...' }}` → `text-expense` | ErrorBoundary.tsx |
| 4 | **`any` type eliminado** — `ValuedPosition['fundamentals']` | usePortfolioState.ts |
| 5 | **`console.debug`** → `logger.debug` | priceService.ts |
| 6 | **`key={index}`** → chaves estáveis | DatePicker.tsx |
| 7 | **Blank line** extra removida | Reports.tsx |
| 8 | **Renda Fixa: Fórmulas e Imposto de Renda** — CDI multiplicativo, IR regressivo por lote e paridade da Edge Function | fixedIncomeCurve.ts & portfolioCalculations.ts & daily-close/index.ts |
| 9 | **Motor TWR e Snapshots** — Base de abertura mensal, drawdown máximo mensal real e acúmulo de proventos/fluxos dia a dia | portfolioTwrEngine.ts & daily-close/index.ts |
| 10 | **Correção de Cotação Flatline** — Forward-fill do motor TWR | portfolioTwrEngine.ts & daily-close/index.ts |
| 11 | **Bug Fix — Select.Item value="" no Radix UI** — sentinel value `__empty__` | Select.tsx |
| 12 | **Componentes padronizados: FieldLabel + SectionHeader** — ~50 labels migradas | FieldLabel.tsx, SectionHeader.tsx, + 5 arquivos |
| 13 | **NumberInput padronizado em 7 arquivos** | ExpenseFormModal, CardFormModal, + 5 modais |
| 14 | **Overflow DECIMAL(15,2)** — Migration DECIMAL(18,2) + arredondamento | portfolioTwrEngine.ts, portfolioHistoricalRecalc.ts, daily-close/index.ts, 20260629_fix_numeric_overflow.sql |
| 15 | **Non-null assertion zerada** — `uniqueMap.get(tickerUpper)!` → safe check | useReconciliationDrafts.ts |
| 16 | **FloatingCalculator extraído** — 3 utilitários: `calculatorExpression`, `calculatorGeometry`, `calculatorDom` (~240 linhas removidas) | FloatingCalculator.tsx → 3 novos arquivos |
| 17 | **Reports.tsx extração parcial** — `reportAggregation.ts` (~20 funções) + `ReportPendingDebtsWidget.tsx` (~252 linhas removidas) | Reports.tsx → reportAggregation.ts + ReportPendingDebtsWidget.tsx |
| 18 | **TS errors corrigidos** — 9 erros (imports órfãos, tipos de retorno) | Reports.tsx, reportAggregation.ts |
| 19 | **ReportUnifiedCompositionCard extraído** — componente standalone (~172 linhas removidas) | Reports.tsx → ReportUnifiedCompositionCard.tsx |
| 20 | **FloatingCalculator hooks extraídos** — `useCalculatorKeyboard` + `useCalculatorPanel` (~233 linhas removidas, ~17%) | FloatingCalculator.tsx → 2 hooks |
| 21 | **Reports.tsx período customizado** — `reportCustomData.ts` com ~15 funções puras de agregação customizada (~381 linhas removidas, ~14%) | Reports.tsx → reportCustomData.ts |
| 22 | **Contas.tsx — Hooks de bills + modais** — `useContasBills.ts` + `useContasModals.ts` (~377 linhas removidas, ~18%) | Contas.tsx → 2 hooks |
| 23 | **Teste de integridade CDI/SELIC** — `checkDbRates.test.ts` (~59 linhas) | Utilitário de teste |
| 24 | **TS Errors pós-extração Contas.tsx** — 3 erros corrigidos (Expense import, unused params, null safety) | useContasModals.ts, Contas.tsx |
| 25 | **Non-null assertions zeradas em Contas.tsx** — 5 ocorrências em callbacks substituídas por captura de variável local | Contas.tsx |
| 26 | **Non-null assertions zeradas em IncomeFormModal.tsx** — 4 ocorrências substituídas por captura local + guard | IncomeFormModal.tsx |
| 27 | **`as any` zerado em reportCustomData.ts** — 2 casts substituídos por narrowing com `'total' in obj` + typed cast | reportCustomData.ts |
| 28 | **FloatingActionHub extraído** — lógica de scroll/haptic/gesture movida para `hooks/useScrollToTop.ts` + `utils/haptics.ts` | FloatingActionHub.tsx → 2 novos arquivos |

### 1.2 Princípios da Arquitetura (Regras do Projeto)

As regras em `.cursor/rules/` e skills em `.cursor/skills/` definem:

| Princípio | Descrição |
|-----------|-----------|
| **KISS/DRY/YAGNI** | Menor mudança possível, consolidar duplicação real, não antecipar requisitos |
| **Arquivos < 300 linhas** | Partir por domínio; atualmente violado em 5+ arquivos |
| **Proibido `any`** | `unknown` + type guards; 5 ocorrências residuais |
| **Funções 4-20 linhas** | Uma responsabilidade por função |
| **Comentários WHY** | Apenas para regras não óbvias |
| **Testes F.I.R.S.T.** | Priorizar nível mais barato (util > hook > página) |
| **Sem useEffect longo sem extração** | Lógica pesada em utils/services |

---

## 2. 🔴 Correções Urgentes

### 2.1 Eliminar `as any` no `useSupabaseTable.ts`

**Arquivo:** `src/hooks/useSupabaseTable.ts`

**Ocorrências:**

```typescript
// Linha 172 — retorno de buildQuery
let query: any = supabase.from(table).select(select ?? '*')
// ...
return query as any

// Linhas 233-234 — filtro Realtime
'on'('postgres_changes' as any, { event: '*', schema: 'public', table } as any, ...)
```

**Risco:** As 3 ocorrências rompem a checagem de tipos do Supabase QueryBuilder. Um erro de query (coluna errada, filtro inválido) só seria detectado em runtime.

**Solução proposta:**

1. **Linha 172:** Tipar o retorno de `buildQuery` como `PostgrestFilterBuilder` do `@supabase/supabase-js`:
   ```typescript
   import type { PostgrestFilterBuilder } from '@supabase/postgrest-js'
   
   const buildQuery = useCallback((): PostgrestFilterBuilder<any, any, T> => {
     // ...
     return query
   }, [table, month])
   ```

2. **Linhas 233-234:** Extrair constante tipada para o channel filter:
   ```typescript
   type RealtimeFilter = {
     event: '*'
     schema: 'public'
     table: QueueEntity
   }
   const filter: RealtimeFilter = { event: '*', schema: 'public', table }
   .on('postgres_changes', filter, () => { load() })
   ```

**Esforço estimado:** ~30min

---

### 2.2 Substituir Non-null Assertions em `Reports.tsx` e `useReports.ts`

**Arquivos:** `src/pages/Reports.tsx` (6 ocorrências), `src/hooks/useReports.ts` (2 ocorrências)

**Ocorrências em Reports.tsx:**

```typescript
// Linhas 872, 892 — agregação de categorias
expenseCategoryMap.get(catId)!.total += total   // ← crash se catId não existir no Map

// Linhas 1053, 1081, 1111, 1139 — agregação adicional
categoryMap.get(catId)!.total += total
```

**Risco:** Se o Map não contiver a chave (ex: dado corrompido, categoria deletada entre carregamentos), o app **quebra** com `TypeError: Cannot read properties of undefined`.

**Solução proposta:**

```typescript
// Antes (quebra):
categoryMap.get(catId)!.total += total

// Depois (seguro):
const category = categoryMap.get(catId)
if (category) {
  category.total += total
} else {
  logger.warn(`Categoria não encontrada para agregação: ${catId}`)
}
```

**Esforço estimado:** ~1h

---

### 2.3 Substituir Non-null Assertions em `MonthlySummaryCard.tsx`

**Arquivo:** `src/components/investments/MonthlySummaryCard.tsx`

**Ocorrências:** 8 non-null assertions em `summary!.totalInvested`, `summary!.totalWithdrawn`, `summary!.totalIncome`, `summary!.monthlyReturn`

**Contexto:** O `summary` é o resultado de um `useMemo` que SEMPRE retorna um objeto (nunca `undefined`). No entanto, o TypeScript não consegue provar isso estaticamente porque o `useMemo` retorna tipo `{ ... } | undefined` se houver branch sem return, ou o tipo do initial state pode ser `null`.

**Análise:** O `useMemo` sempre retorna um objeto válido, então as non-null assertions são **seguras em runtime** mas **frágeis a refatoração** — se alguém adicionar um early return sem objeto, o `!` não avisa.

**Solução proposta:**

```typescript
// Opção A — Refinar tipo (recomendado): garantir que useMemo sempre retorna objeto
const summary = useMemo((): { totalInvested: number; totalWithdrawn: number; totalIncome: number; monthlyReturn: number | null } => {
  // ... sempre retorna { ... }
}, [transactions, shareHistory, selectedMonth])

// Depois usar:
const { totalInvested, totalWithdrawn, totalIncome, monthlyReturn } = summary
// Sem non-null assertions
```

**Esforço estimado:** ~30min

---

### 2.4 Eliminar `as any` no `Input.tsx`

**Arquivo:** `src/components/Input.tsx`, linha 35

**Ocorrência:**

```typescript
const syntheticEvent = e as unknown as React.ChangeEvent<HTMLInputElement>
```

**Contexto:** `DatePicker` emite `{ target: { value, name } }`, que é compatível com `ChangeEvent<HTMLInputElement>`. O `as unknown as` é um workaround documentado.

**Solução proposta:** Extrair um tipo de evento compartilhado:

```typescript
// Em src/types/index.ts ou utils.ts
export type SyntheticInputChange = {
  target: { value: string; name?: string }
}

// No Input.tsx
const syntheticEvent = e as SyntheticInputChange as React.ChangeEvent<HTMLInputElement>
```

**Esforço estimado:** ~15min

---

### 2.5 Eliminar `as any` no `portfolioHistoricalRecalc.ts`

**Arquivo:** `src/services/portfolioHistoricalRecalc.ts`, linha 137

**Ocorrência:**

```typescript
const data = await res.json() as any
```

**Solução proposta:** Tipar o retorno com o tipo conhecido da API:

```typescript
interface PriceApiResponse {
  symbol: string
  historical: Array<{ date: string; close: number }>
}
const data = await res.json() as PriceApiResponse
```

**Esforço estimado:** ~15min

---

## 3. 🟡 Melhorias de Curto Prazo

### 3.1 ✅ Extrair Lógica do `FloatingCalculator.tsx` (Concluído)

**Progresso:**

| Extração | Status | Arquivo | Linhas |
|----------|--------|---------|--------|
| `utils/calculatorGeometry.ts` | ✅ | Geometria do painel, constantes | ~100 |
| `utils/calculatorExpression.ts` | ✅ | Avaliação de expressões, formatação | ~80 |
| `utils/calculatorDom.ts` | ✅ | Utilitários DOM | ~60 |
| `hooks/useCalculatorKeyboard.ts` | ✅ | Atalhos de teclado | ~95 |
| `hooks/useCalculatorPanel.ts` | ✅ | Drag/resize do painel | ~216 |

**Impacto final:** FloatingCalculator.tsx reduziu de ~1.569 → **~1.107 linhas** (-462, ~29%). UseEffects: ~13 → **~10**.

### 3.2 ✅ Extrair `FloatingActionHub.tsx` (Concluído)

**Progresso:**

| Extração | Status | Arquivo | Linhas |
|----------|--------|---------|--------|
| `hooks/useScrollToTop.ts` | ✅ | Máquina de estados pull-to-top + scroll detect + touch/wheel gesture + haptics | ~220 |
| `utils/haptics.ts` | ✅ | Função `triggerHaptic` com multi-stage vibrate patterns | ~25 |

**Impacto final:** FloatingActionHub.tsx reduziu de ~520 → **~50 linhas** (-470, ~90%).

---



### 3.3 Extrair Lógica de Agregação de `Reports.tsx` (3.119 linhas)

**Problema:** O maior arquivo do projeto. Contém agregação de receitas/despesas, filtragem por categoria/período, e lógica de gráficos, tudo no mesmo módulo.

**Plano de extração:**

| Passo | Ação | Linhas removidas |
|-------|------|------------------|
| 1 | Extrair tipos de agregação para `types/reports.ts` | — |
| 2 | Extrair funções de agregação para `utils/reportAggregation.ts` (categoryMap, expenseCategoryMap, incomeCategoryMap) | ~200 |
| 3 | Extrair funções de filtro para `utils/reportFilters.ts` | ~100 |
| 4 | Extrair componentes de seção: `ReportSummarySection`, `ReportChartsSection`, `ReportInsightsSection` | ~300 |

**Meta:** Reduzir Reports.tsx de 3.119 para ~1.200 linhas.

**Esforço estimado:** ~6h

---

### 3.4 ✅ Extrair Lógica de `Contas.tsx` (Concluído)

**Progresso:**

| Extração | Status | Arquivo | Linhas |
|----------|--------|---------|--------|
| `hooks/useContasBills.ts` | ✅ | Carregamento de faturas, despesas por cartão, pagamentos, ciclos | ~264 |
| `hooks/useContasModals.ts` | ✅ | ~30 estados de modal + handlers de ação complexa | ~551 |

**Impacto final:** Contas.tsx reduziu de **2.039 → 1.662 linhas** (-377, ~18%).

**Próximo passo:** Extrair lógica de cálculos (juros, saldo devedor, fatura) para utils puras.

---

### 3.5 Extrair Lógica de `useExpenses.ts` (606 linhas)

**Problema:** Hook mais longo do projeto. Lógica de parcelamento, competência de cartão de crédito e exclusão `single/all/subsequent`.

**Plano de extração:**

| Extração | Função |
|----------|--------|
| `utils/expenseInstallments.ts` | Cálculo de parcelas: gerar parcelas, calcular competência |
| `utils/expenseDeletion.ts` | Lógica de exclusão single/all/subsequent |
| `utils/creditCardCompetence.ts` | Determinar competência de fatura por data de compra |

**Esforço estimado:** ~3h

---

### 3.6 Tipar `buildQuery` no `useSupabaseTable.ts`

**Detalhamento:** Já descrito no item 2.1. A tipagem correta do `PostgrestFilterBuilder` eliminaria o `as any` e daria autocomplete nos métodos de query.

**Esforço estimado:** ~30min (incluído no 2.1)

---

## 4. 🟢 Melhorias de Médio/Longo Prazo

### 4.1 Fracionamento de Arquivos > 1000 Linhas

**Arquivos alvo:**

| Arquivo | Linhas | Ação | Esforço |
|---------|--------|------|---------|
| `src/pages/Reports.tsx` | **2.276** | ✅ Extração de período customizado concluída | ✅ |
| `src/pages/Contas.tsx` | **1.662** | ✅ Hooks de bills + modais extraídos (era 2.039) | ✅ |
| `src/pages/Categories.tsx` | 1.252 | Extrair `CategoryGrid`, `CategoryKPIs`, `CategoryDetailModal` já existe | ~3h |
| `src/components/CreditCardCsvReconciliationPanel.tsx` | 1.193 | Extrair `CsvUploadZone`, `CsvMatchTable`, `CsvSummaryPanel` | ~3h |
| `src/components/FloatingCalculator.tsx` | **1.107** | ✅ Extração concluída (era 1.569) | ✅ |

### 4.2 Redução de useEffect em Componentes Críticos

**Meta:** Reduzir total de `useEffect` no app de ~119 para ~100.

| Componente | Atual | Meta | Técnica |
|-----------|-------|------|---------|
| `FloatingCalculator.tsx` | ~10 | 8 | Refatoração adicional: extrair efeito de viewport resize |
| `Reports.tsx` | 12 | 8 | Extrair lógica de filtro/agregação para utils puras |
| `FloatingActionHub.tsx` | 10 | 7 | Extrair hooks de gesture (touch/wheel) |
| `useReconciliationState.ts` | 5 | 3 | Extrair máquina de estados para reducer |

### 4.3 Migrar `--color-*` para `--ds-*`

**Contexto:** O projeto tem dois sistemas de tokens CSS: os novos `--ds-*` (design system) e os legados `--color-*` (aliases). O plano de refatoração anterior já apontou isso.

**Escopo:** ~2h para mapear usos de `--color-*` em arquivos CSS e TSX e substituir pelos equivalentes `--ds-*`.

**Risco:** Baixo — as variáveis `--color-*` são aliases que apontam para `--ds-*`, então a migração é segura.

### 4.4 Tooltips em Gráficos de Pizza

**Contexto:** Único local sem tooltip em gráficos. Os gráficos de pizza em Reports e Investments não mostram tooltip ao hover.

**Esforço estimado:** ~30min

### 4.5 Adicionar Verificação de z-index no Guardrail de UI

**Contexto:** O sistema de z-index agora está padronizado, mas não há verificação automatizada. O script `scripts/ui-guardrails.mjs` poderia ser estendido para detectar valores hardcoded de `z-*` que não façam parte do `Z_INDEX` system.

**Esforço estimado:** ~1h

---

## 5. Métricas e Validação

### 5.1 Estado Desejado Pós-Melhoria

| Métrica | Atual | Meta | Prioridade |
|---------|-------|------|------------|
| `as any` em produção | 0 | **0** | ✅ |
| Non-null assertions em produção | 0 | **0** | ✅ |
| Arquivos > 1000 linhas | 4 | **< 3** | 🟡 |
| Hooks > 400 linhas | 5 | **< 3** | 🟡 |
| `useEffect` no FloatingCalculator | ~10 | **~7** | 🟡 |
| Testes passando | 267 | **267+** | ✅ |
| TypeScript errors | 0 | **0** | ✅ |

### 5.2 Checklist Antes de Cada Merge

- [ ] `npx tsc --noEmit` → 0 erros
- [ ] `npx vitest run` → todos verdes
- [ ] `npm run guardrails:ui` → 0 violações
- [ ] Sem `console.log` residual
- [ ] Sem `any` novo
- [ ] Sem `!` non-null assertion novo sem justificativa documentada

---

## 6. Glossário de Anti-padrões

| Anti-padrão | Exemplo | Consequência | Como evitar |
|-------------|---------|--------------|-------------|
| `as any` | `const data = res.json() as any` | Desativa typecheck | Usar `unknown` + type guard ou tipar explicitamente |
| Non-null assertion | `map.get(key)!.prop` | Crash se key não existir | Verificar com `if` ou optional chaining `?.` |
| `catch(err: any)` | `catch(err: any) { ... }` | Perde type safety | Usar `unknown` + `instanceof Error` |
| Arquivo inchado | > 300 linhas | Dificulta manutenção | Extrair por domínio (utils, components, hooks) |
| useEffect sem extração | useEffect com 100+ linhas | Lógica não testável | Extrair para hook customizado ou util pura |
| Comentário que repete código | `// set loading to false` | Ruído | Remover ou converter para WHY |
| `.toFixed()` em página | `value.toFixed(2)` | Viola guardrail de UI | Usar `formatCurrency` de `format.ts` |

---

> Este documento é um guia vivo. Atualize quando novas fragilidades forem identificadas ou quando itens forem concluídos.
> Consulte `docs/ARCHITECTURE.md` para visão geral do sistema e `docs/REFACTORING_PLAN.md` para o plano de refatoração anterior.
