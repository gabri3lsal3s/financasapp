# Plano de Melhorias — FinançasApp

> **Data:** Junho de 2026
> **Baseado em:** Auditoria estrutural de código, regras Cursor, skills de engenharia e documentação do projeto.
> **Propósito:** Registrar fragilidades identificadas e servir como guia priorizado para sprints futuros.

---

## Sumário

1. [Resumo do Estado Atual](#1-resumo-do-estado-atual)
2. [🟡 Melhorias de Curto Prazo](#2--melhorias-de-curto-prazo)
3. [🟢 Melhorias de Médio/Longo Prazo](#3--melhorias-de-médiolongo-prazo)
4. [Métricas e Validação](#4-métricas-e-validação)
5. [Glossário de Anti-padrões](#5-glossário-de-anti-padrões)

---

## 1. Resumo do Estado Atual

### 1.1 Métricas da Codebase

| Métrica | Valor | Classificação |
|---------|-------|---------------|
| TypeScript errors | **0** | ✅ |
| Testes passando | **267/267** (30 arquivos) | ✅ |
| Build | **OK** | ✅ |
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
| FloatingActionHub useEffects | **4** (↓6) | ✅ |

### 1.2 Últimas Correções Realizadas (Junho 2026)

| # | Correção | Arquivo |
|---|----------|---------|
| 1 | **CSS spacing bug** — `h - 2 w - 2 rounded - full` → `h-2 w-2 rounded-full` | Settings.tsx |
| 2 | **CSS spacing bug** — `rounded - lg border p - 3` → `rounded-lg border p-3` | Settings.tsx |
| 3 | **Inline style → class** — `style={{ color: '...' }}` → `text-expense` | ErrorBoundary.tsx |
| 4 | **Loop infinito no useSupabaseTable** — configRef pattern | useSupabaseTable.ts |
| 5 | **`any` type eliminado** — `ValuedPosition['fundamentals']` | usePortfolioState.ts |
| 6 | **`console.debug`** → `logger.debug` | priceService.ts |
| 7 | **`key={index}`** → chaves estáveis | DatePicker.tsx |
| 8 | **Renda Fixa: Fórmulas e Imposto de Renda** — CDI multiplicativo, IR regressivo | Vários |
| 9 | **Motor TWR e Snapshots** — Base de abertura mensal, drawdown máximo | portfolioTwrEngine.ts & daily-close/index.ts |
| 10 | **Correção de Cotação Flatline** — Forward-fill do motor TWR | portfolioTwrEngine.ts & daily-close/index.ts |
| 11 | **Bug Fix — Select.Item value="" no Radix UI** — sentinel value `__empty__` | Select.tsx |
| 12 | **Componentes padronizados: FieldLabel + SectionHeader** — ~50 labels migradas | FieldLabel.tsx, SectionHeader.tsx |
| 13 | **NumberInput padronizado em 7 arquivos** | ExpenseFormModal, CardFormModal, etc. |
| 14 | **Overflow DECIMAL(15,2)** — Migration DECIMAL(18,2) + arredondamento | Vários |
| 15 | **FloatingCalculator extraído** — 3 utils + 2 hooks (~462 linhas removidas) | FloatingCalculator.tsx → 5 novos arquivos |
| 16 | **Reports.tsx extração completa** — ~843 linhas removidas (2 utils + 2 componentes) | Reports.tsx → 4 novos arquivos |
| 17 | **Contas.tsx extração** — 2 hooks (~377 linhas removidas) | Contas.tsx → 2 hooks |
| 18 | **FloatingActionHub extraído** — ~470 linhas para useScrollToTop.ts + haptics.ts | FloatingActionHub.tsx → 2 novos arquivos |
| 19 | **Non-null assertions zeradas** — 13 ocorrências (5 Contas + 4 IncomeFormModal + 1 reconciliation + 3 reports) | Vários |
| 20 | **`as any` zerado** — 2 casts em reportCustomData.ts | reportCustomData.ts |

### 1.3 Princípios da Arquitetura

| Princípio | Descrição |
|-----------|-----------|
| **KISS/DRY/YAGNI** | Menor mudança possível, consolidar duplicação real, não antecipar requisitos |
| **Proibido `any`** | `unknown` + type guards; **0 ocorrências** no código de produção |
| **Funções 4-20 linhas** | Uma responsabilidade por função |
| **Comentários WHY** | Apenas para regras não óbvias |
| **Testes F.I.R.S.T.** | Priorizar nível mais barato (util > hook > página) |
| **Sem useEffect longo sem extração** | Lógica pesada em utils/services |

---

## 2. 🟡 Melhorias de Curto Prazo

### 2.1 ✅ FloatingCalculator — Extração Concluída

| Extração | Status | Arquivo | Linhas |
|----------|--------|---------|--------|
| `utils/calculatorGeometry.ts` | ✅ | Geometria do painel, constantes | ~100 |
| `utils/calculatorExpression.ts` | ✅ | Avaliação de expressões, formatação | ~80 |
| `utils/calculatorDom.ts` | ✅ | Utilitários DOM | ~60 |
| `hooks/useCalculatorKeyboard.ts` | ✅ | Atalhos de teclado | ~95 |
| `hooks/useCalculatorPanel.ts` | ✅ | Drag/resize do painel | ~216 |

**Impacto final:** FloatingCalculator.tsx reduziu de ~1.569 → **~1.107 linhas** (-462, ~29%). UseEffects: ~13 → **~10**.

### 2.2 ✅ FloatingActionHub — Extração Concluída

| Extração | Status | Arquivo | Linhas |
|----------|--------|---------|--------|
| `hooks/useScrollToTop.ts` | ✅ | Máquina de estados pull-to-top | ~220 |
| `utils/haptics.ts` | ✅ | Função `triggerHaptic` multi-stage | ~25 |

**Impacto final:** FloatingActionHub.tsx reduziu de ~520 → **~50 linhas** (-470, ~90%). UseEffects: ~10 → **4**.

### 2.3 ✅ Reports.tsx — Extração Concluída

**Problema original:** O maior arquivo do projeto com 3.119 linhas.

**Progresso:**

| Etapa | Ação | Status |
|-------|------|--------|
| 1 | Extrair funções de agregação para `utils/reportAggregation.ts` | ✅ |
| 2 | Extrair `ReportPendingDebtsWidget.tsx` | ✅ |
| 3 | Extrair `ReportUnifiedCompositionCard.tsx` | ✅ |
| 4 | Extrair período customizado para `utils/reportCustomData.ts` | ✅ |

**Impacto final:** Reports.tsx reduziu de **3.119 → 2.276 linhas** (-843, ~27%).

**Próximo passo:** Extrair componentes de seção: `ReportSummarySection`, `ReportChartsSection`, `ReportInsightsSection` (~3h estimado).

### 2.4 ✅ Contas.tsx — Extração Concluída

| Extração | Status | Arquivo | Linhas |
|----------|--------|---------|--------|
| `hooks/useContasBills.ts` | ✅ | Carregamento de faturas, despesas por cartão | ~264 |
| `hooks/useContasModals.ts` | ✅ | ~30 estados de modal + handlers | ~551 |

**Impacto final:** Contas.tsx reduziu de **2.039 → 1.668 linhas** (-371, ~18%).

**Próximo passo:** Extrair lógica de cálculos (juros, saldo devedor, fatura) para utils puras.

### 2.5 Extrair Lógica de `useExpenses.ts` (~497 linhas)

**Problema:** Hook com lógica de parcelamento, competência de cartão de crédito e exclusão `single/all/subsequent`.

**Plano de extração:**

| Extração | Função |
|----------|--------|
| `utils/expenseInstallments.ts` | Cálculo de parcelas: gerar parcelas, calcular competência |
| `utils/expenseDeletion.ts` | Lógica de exclusão single/all/subsequent |
| `utils/creditCardCompetence.ts` | Determinar competência de fatura por data de compra |

**Esforço estimado:** ~3h

---

## 3. 🟢 Melhorias de Médio/Longo Prazo

### 3.1 Fracionamento de Arquivos > 1000 Linhas

**Arquivos alvo:**

| Arquivo | Linhas | Ação | Esforço |
|---------|--------|------|---------|
| `src/pages/Reports.tsx` | **2.276** | ✅ Extração de período customizado concluída | ✅ |
| `src/pages/Contas.tsx` | **1.668** | ✅ Hooks extraídos (era 2.039) | ✅ |
| `src/pages/Categories.tsx` | 1.252 | Extrair `CategoryGrid`, `CategoryKPIs` | ~3h |
| `src/components/CreditCardCsvReconciliationPanel.tsx` | 1.193 | Extrair `CsvUploadZone`, `CsvMatchTable` | ~3h |
| `src/components/FloatingCalculator.tsx` | **1.107** | ✅ Extração concluída (era 1.569) | ✅ |

### 3.2 Migrar `--color-*` para `--ds-*`

**Contexto:** O projeto tem dois sistemas de tokens CSS: os novos `--ds-*` (design system) e os legados `--color-*` (aliases).

**Escopo:** ~2h para mapear usos de `--color-*` em arquivos CSS e TSX e substituir pelos equivalentes `--ds-*`.

**Risco:** Baixo — as variáveis `--color-*` são aliases que apontam para `--ds-*`, então a migração é segura.

### 3.3 Tooltips em Gráficos de Pizza

**Contexto:** Único local sem tooltip em gráficos. Gráficos de pizza em Reports e Investments não mostram tooltip ao hover.

**Esforço estimado:** ~30min

### 3.4 Testes Unitários para Utilitários Extraídos

| Arquivo | Esforço |
|---------|---------|
| `calculatorExpression`, `calculatorGeometry`, `calculatorDom` | ~1h |
| `useCalculatorKeyboard`, `useCalculatorPanel`, `useScrollToTop` | ~1.5h |
| `reportAggregation` + `reportCustomData` | ~1h |

### 3.5 Adicionar Verificação de z-index no Guardrail de UI

**Contexto:** O sistema de z-index está padronizado, mas não há verificação automatizada. O script `scripts/ui-guardrails.mjs` poderia ser estendido para detectar valores hardcoded de `z-*`.

**Esforço estimado:** ~1h

---

## 4. Métricas e Validação

### 4.1 Estado Desejado Pós-Melhoria

| Métrica | Atual | Meta | Prioridade |
|---------|-------|------|------------|
| `as any` em produção | **0** | **0** | ✅ |
| Non-null assertions em produção | **0** | **0** | ✅ |
| Arquivos > 1000 linhas | 5 | **< 4** | 🟡 |
| Hooks > 400 linhas | 5 | **< 3** | 🟡 |
| Testes passando | 267 | **267+** | ✅ |
| TypeScript errors | **0** | **0** | ✅ |

### 4.2 Checklist Antes de Cada Merge

- [ ] `npx tsc --noEmit` → 0 erros
- [ ] `npx vitest run` → todos verdes
- [ ] `npm run guardrails:ui` → 0 violações
- [ ] `npm run build` → Build OK
- [ ] Sem `console.log` residual
- [ ] Sem `any` novo
- [ ] Sem `!` non-null assertion novo sem justificativa documentada

---

## 5. Glossário de Anti-padrões

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
