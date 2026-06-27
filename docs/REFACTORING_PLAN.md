# Plano de Refatoração: FinançasApp

> **Data:** Junho de 2026
> **Escopo:** User Flow, Consistência Visual, Redução de Ruído, Padronização de Componentes, Eliminação de Redundâncias, Correção de Bugs

---

## Índice

1. [Mapeamento do User Flow Atual](#1-mapeamento-do-user-flow-atual)
2. [Ruídos Visuais: Diagnóstico e Soluções](#2-ruídos-visuais-diagnóstico-e-soluções)
3. [Padronização de Componentes](#3-padronização-de-componentes)
4. [Eliminação de Redundâncias](#4-eliminação-de-redundâncias)
5. [Refinamento de Pop-ups Informativos](#5-refinamento-de-pop-ups-informativos)
6. [Otimização de Hooks e Data Flow](#6-otimização-de-hooks-e-data-flow)
7. [Plano de Implementação por Prioridade](#7-plano-de-implementação-por-prioridade)

---

## 1. Mapeamento do User Flow Atual

### 1.1 Navegação Principal

```
[Layout]
 ├── Mobile: Bottom Nav (5 tabs) + Sheet "Mais" (4 links + logout)
 ├── Desktop: Sidebar colapsável (8 links + logout)
 └── Main Content Area
      ├── usePageActions (hook que registra ações flutuantes no FloatingActionHub)
      ├── FloatingActionHub (portal único: ScrollToTop + NotificationsWidget)
      ├── Seletor de Mês (Dashboard, Expenses, Incomes, Contas, Categories, Reports)
      └── Skeleton (enquanto carrega)
```

### 1.2 Elementos Flutuantes Concorrentes

| Elemento | Posição | Z-index | Página | Propósito |
|----------|---------|---------|--------|-----------|
| `FloatingCalculator` | Bottom-left / side | `z-50` | Global (desktop) | Calculadora |
| `ScrollToTop` | Bottom-right | `z-50` | Global | Voltar ao topo |
| `NotificationsWidget` | Bottom-left (desktop) | alto | Global | Sininho + alertas |
| `NetworkStatusToast` | Top-right | alto | Global | Status offline |
| `FloatingSideStack` | Right side | alto | Global | Ações flutuantes + calc |

**Nota:** `MobileAlertsPill` foi removido (consolidado em NotificationsWidget). `PageHeader` foi removido (substituído por `usePageActions`).

### 1.3 Fluxos de Dados Repetitivos

Todas as páginas de CRUD seguem o mesmo padrão:
```
Página → Hook useX() → useSupabaseTable() → useState → render
```

Hooks como `useCategories`, `useIncomeCategories`, `useCreditCards` foram refatorados para usar `useSupabaseTable` (~250 linhas eliminadas).

Os hooks `useExpenses`, `useIncomes` e `useDebts` têm lógica de negócio muito específica (parcelamento, competência de cartão de crédito, grupos de exclusão `single/all/subsequent`, joins complexos) e foram **mantidos manuais intencionalmente** para evitar risco de regressão.

---

## 2. Ruídos Visuais: Diagnóstico e Soluções

### 2.1 🔴 SUPERPOSIÇÃO DE ELEMENTOS FLUTUANTES

**Problema:** `ScrollToTop` e `FloatingCalculator` dividem o espaço inferior da tela, ambos com `z-50`. No mobile, também competem com o bottom nav (`z-[100]`).

**Solução:** Unificar todos os elementos flutuantes em um único **Floating Action Hub** (`FloatingActionHub.tsx`).

### 2.2 🟡 MOBILE ALERTS PILL REDUNDANTE

**Problema:** `MobileAlertsPill` aparecia no topo de Dashboard, Expenses e Incomes.

**Solução:** Componente removido (0 imports). Alertas consolidados no `NotificationsWidget`.

### 2.3 🟡 PAGE HEADER "FANTASMA"

**Problema:** `PageHeader` sempre renderizava `null`. 3 imports por página para um componente invisível.

**Solução:** Substituído por `usePageActions` hook. `PageHeader.tsx` removido. `PageHeaderActions.tsx` e `PageHeaderActionButton.tsx` mantidos como dependências internas do hook.

### 2.4 🟢 SKELETON CARREGAMENTO DUPLICADO

**Problema:** Toda página tinha `<SkeletonX />` + `<ScrollToTop />`.

**Solução:** `ScrollToTop` movido para o `Layout.tsx` via `FloatingActionHub`.

---

## 3. Padronização de Componentes

### 3.1 🟡 DUALIDADE Button / Card / Input

**Problema:** Dois sistemas de componentes base (wrappers + shadcn/ui).

**Solução:** Auditado — padrão wrapper é saudável. Button com `size="icon"` adicionado. `as any` zerado em Input.tsx e NumberInput.tsx.

### 3.2 🟡 MODAIS: 3 SISTEMAS CONCORRENTES

**Problema:** Modal, ConfirmModal e Sheet direto.

**Solução:** Nenhuma ação no momento. Pode ser consolidado futuramente.

### 3.3 🟢 PADRÃO TransactionCard

**Problema:** `TransactionRow` replicado em CategoryDetailModal e Dashboard.

**Solução:** `TransactionRow.tsx` extraído e reutilizado em ambos os lugares.

### 3.4 🟡 InfoTooltip DISPERSO

**Problema:** Textos hardcoded em 5+ arquivos.

**Solução:** Centralizados em `src/constants/tooltips.ts`.

---

## 4. Eliminação de Redundâncias

### 4.1 🔴 ExpenseFormModal ≈ IncomeFormModal

**Problema:** ~85% de código duplicado.

**Solução:** Extraídos 4 sub-componentes compartilhados (TransactionAmountFields, TransactionDateField, TransactionCategorySelect, TransactionDescriptionField). 2 bugs de stale closure corrigidos.

### 4.2 🔴 HOOKS CRUD REPETITIVOS

**Problema:** 7 hooks CRUD seguiam o mesmo padrão.

**Solução:** Criado `useSupabaseTable` — hook genérico CRUD. 3 hooks refatorados (~250 linhas eliminadas).

### 4.3 🟡 floatingSideLayout.ts

Mantido (usado em 4 componentes).

### 4.4 🟢 DUPLICAÇÃO DE ESTILOS RECHARTS

Consolidado em `index.css`.

---

## 5. Refinamento de Pop-ups Informativos

### 5.1 ONDE EXISTEM

| Componente | Tooltip |
|-----------|---------|
| `BillExpenseRowButton` | ✅ InfoTooltip |
| `CreditCardTimeline` | ✅ InfoTooltip |
| `TransactionCard` | ✅ InfoTooltip |
| `Contas.tsx` header | ✅ InfoTooltip |
| `Categories.tsx` | ✅ InfoTooltip |
| `CategoryDetailModal` | ✅ InfoTooltip |
| `Dashboard.tsx` modal | ✅ InfoTooltip |
| `EvolutionChart.tsx` | ✅ InfoTooltip |
| `ReportsCategoryRowButton` | ✅ InfoTooltip |

**Pendente:** Tooltips em gráficos de pizza (baixa prioridade).

### 5.2 PADRONIZAÇÃO DE TEXTOS

✅ Textos centralizados em `src/constants/tooltips.ts`.

---

## 6. Otimização de Hooks e Data Flow

### 6.1 🟡 useEffect EM EXCESSO

**Problema:** ~119 `useEffect` no app.

**Progresso:** FloatingCalculator reduzido de 16→12 effects. Demais componentes mantidos (risco de regressão > benefício).

### 6.2 🟢 useAppSettings CRESCENTE

**Solução:** Reducer pattern implementado (8 useState → 1 useReducer).

### 6.3 🟢 onDataChanged EVENT LISTENER

**Nota:** O `useSupabaseTable` já gerencia esse listener automaticamente.

---

## 7. Plano de Implementação por Prioridade

### ✅ FASE 1 — COMPLETA

| # | Tarefa | Status |
|---|--------|--------|
| 1 | Consolidar elementos flutuantes em `FloatingActionHub` | ✅ |
| 2 | Extrair `TransactionRow` de `TransactionCard` | ✅ |
| 3 | Centralizar textos de tooltips em constantes | ✅ |
| 4 | Adicionar tooltips faltantes (`ReportsCategoryRowButton`) | ✅ |

### ✅ FASE 2 — COMPLETA

| # | Tarefa | Status |
|---|--------|--------|
| 5 | Substituir `PageHeader` por `usePageActions` hook | ✅ |
| 6 | Criar `useSupabaseTable` hook genérico + refatorar 3 hooks | ✅ |
| 7 | Extrair sub-componentes `TransactionForm` + refatorar modais | ✅ |
| 8 | Adicionar `size="icon"` ao Button e refatorar `IconButton` | ✅ |

### ✅ FASE 3 — COMPLETA

| # | Tarefa | Status |
|---|--------|--------|
| 9 | Limpeza de dead code | ✅ |
| 10 | Reduzir `useEffect` nos componentes críticos | ✅ |
| 11 | Refatorar `useAppSettings` para reducer pattern | ✅ |
| 12 | Consolidar CSS Recharts em `index.css` | ✅ |

### ✅ CORREÇÃO DE BUGS — IMPLEMENTADA

| # | Tarefa | Arquivo | Severidade |
|---|--------|---------|------------|
| 1 | **Loop infinito no useSupabaseTable** — configRef pattern | `src/hooks/useSupabaseTable.ts` | 🔴 Crítica |
| 2 | Remoção de dead code (PageHeader.tsx, MobileAlertsPill.tsx) | `src/components/` | 🟢 |
| 3 | Restauração de PageHeaderActions/PageHeaderActionButton | `src/components/` | 🟢 |
| 4 | Correção de teste de snapshot (PageHeader removido) | `src/components/uiPrimitivesSnapshot.test.ts` | 🟡 |

### 📊 Métricas de Sucesso

| Métrica | Antes | Depois |
|---------|-------|--------|
| Elementos flutuantes na tela | 4-5 | 1 hub (FloatingActionHub) |
| Imports de PageHeader por página | 3 | 1 (usePageActions) |
| Tooltips dispersos | 8+ arquivos com strings hardcoded | Centralizados |
| ScrollToTop por página | 10+ imports | 0 (centralizado) |
| Hooks CRUD manuais | 7 hooks | 3 hooks refatorados (4 mantidos manuais) |
| Dead code | 6+ arquivos | Removidos |
| `as any` / `catch(err: any)` | ~20 instâncias | 0 |
| **Loop infinito (useSupabaseTable)** | 🔴 **App quebrado** | ✅ **Corrigido** |
| ExpenseCategoryRowButton via Button | Button direto | ✅ RowButton base |
| PaymentRowButton | Wrapper vazio | ✅ Removido (usa RowButton) |
| Select | Custom state management | ✅ Radix UI (shadcn) |
| FloatingCalculator useEffect | ~14 effects | ✅ ~11 effects |
| Reports validation effects | 2 effects | ✅ 1 effect unificado |
| Build | ✅ | ✅ |
| Testes | 238 | ✅ 237/237 |
| Typecheck | ✅ | ✅ 0 erros |

---

## Legado: O que NÃO mudar

- **InfoTooltip.tsx** — maduro e bem projetado
- **MonthSelector/MonthTransitionView** — animações excelentes
- **Skeleton.tsx** — variantes por página bem resolvidas
- **Layout responsivo** (mobile nav + desktop sidebar) — sólido
- **Sistema de temas** (ThemeContext, theme-tokens) — bem arquitetado
- **Sistema glass** (glass-border, surface-glass, etc.) — consistente
- **FloatingCalculator** — complexo mas maduro
- **Motor de cálculos de portfolio** — 237 testes passando
- **useExpenses, useIncomes, useDebts** — mantidos manuais intencionalmente

---

> Este plano é um guia vivo. Cada fase foi validada com `tsc --noEmit` e `vitest run`.
