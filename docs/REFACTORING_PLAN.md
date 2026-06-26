# Plano de Refatoração: FinançasApp

> **Data:** Junho de 2026
> **Escopo:** User Flow, Consistência Visual, Redução de Ruído, Padronização de Componentes, Eliminação de Redundâncias

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
      ├── PageHeader (sempre renderiza null — existe para registrar ações flutuantes)
      ├── Seletor de Mês (Dashboard, Expenses, Incomes, Contas, Categories, Reports)
      ├── Skeleton (enquanto carrega)
      └── ScrollToTop (toda página)
```

### 1.2 Elementos Flutuantes Concorrentes

| Elemento | Posição | Z-index | Página | Propósito |
|----------|---------|---------|--------|-----------|
| `FloatingCalculator` | Bottom-left / side | `z-50` | Global (desktop) | Calculadora |
| `ScrollToTop` | Bottom-right | `z-50` | Global | Voltar ao topo |
| `MobileAlertsPill` | Topo do conteúdo | inline | Dashboard, Expenses, Incomes | Alertas no mobile |
| `NotificationsWidget` | Bottom-left (desktop) | alto | Global | Sininho + alertas |
| `NetworkStatusToast` | Top-right | alto | Global | Status offline |
| `FloatingSideStack` | Right side | alto | Global | Ações flutuantes + calc |

**Problema:** Sobrecarga de elementos flutuantes. Usuário vê até 4 camadas sobrepostas.

### 1.3 Fluxos de Dados Repetitivos

Todas as páginas de CRUD seguem o mesmo padrão:
```
Página → Hook useX() → 2 useEffects (load inicial + subscribe) → useState → render
```

Hooks como `useExpenses`, `useIncomes`, `useCategories`, `useIncomeCategories`, `useCreditCards`, `useDebts` têm **90% de código idêntico** — diferem apenas no nome da tabela Supabase.

---

## 2. Ruídos Visuais: Diagnóstico e Soluções

### 2.1 🔴 SUPERPOSIÇÃO DE ELEMENTOS FLUTUANTES

**Problema:** `ScrollToTop` e `FloatingCalculator` dividem o espaço inferior da tela, ambos com `z-50`. No mobile, também competem com o bottom nav (`z-[100]`).

**Solução:** Unificar todos os elementos flutuantes em um único **Floating Action Hub**:

```
┌────────────────┬──────────────────────┐
│ Floating       │                      │
│ Action Hub     │ (conteúdo principal) │
│                │                      │
│ [ ^ ] Voltar   │                      │
│ ao topo        │                      │
│                │                      │
│ [ 🧮 ] Calc    │                      │
│                │                      │
│ [ 🔔 ] Alertas │                      │
└────────────────┴──────────────────────┘
```

- **Desktop:** Coluna fixa à direita (`bottom-6 right-6` ou side stack) com botões empilhados verticalmente
- **Mobile:** Botão FAB expansível (ex: `FloatingActionButton` que abre um mini-menu radial ou sheet)
- Unifica `ScrollToTop`, `FloatingCalculator`, `NotificationsWidget` e ações de página
- Reduz de 4+ elementos para 1 hub inteligente
- Implementação: criar `FloatingActionHub.tsx` que substitui `ScrollToTop` no Layout

### 2.2 🟡 MOBILE ALERTS PILL REDUNDANTE

**Problema:** `MobileAlertsPill` aparece no topo de Dashboard, Expenses e Incomes. É redundante com o `NotificationsWidget` e `NetworkStatusToast`.

**Solução:** Remover `MobileAlertsPill` das páginas e consolidar alertas de limite no `FinancialInsights` (já existente) ou no novo Floating Action Hub.

### 2.3 🟡 PAGE HEADER "FANTASMA"

**Problema:** `PageHeader` sempre renderiza `null`. Existe unicamente para registrar ações no contexto `FloatingActionsContext`. Todas as páginas importam e configuram `PageHeader`, `PageHeaderActions`, e `PageHeaderActionButton` — 3 imports por página para um componente que não renderiza nada visualmente.

**Solução:** Renomear para `usePageActions` — hook que atualiza o contexto diretamente:

```tsx
// Uso atual (8 imports + configuração):
import PageHeader, { PageHeaderActions } from '@/components/PageHeader'
import PageHeaderActionButton from '@/components/PageHeaderActionButton'

<PageHeader
  title="..."
  subtitle="..."
  action={
    <PageHeaderActions>
      <PageHeaderActionButton ... />
    </PageHeaderActions>
  }
/>

// Novo uso (1 import):
import { usePageActions } from '@/hooks/usePageActions'

usePageActions([
  { icon: Plus, label: 'Adicionar', intent: 'primary', onClick: fn }
])
```

Isso elimina 3 componentes fantasmas, reduz imports por página de 3 para 1, e simplifica drasticamente o boilerplate de cada página.

### 2.4 🟢 SKELETON CARREGAMENTO DUPLICADO

**Problema:** Toda página tem `<SkeletonX />` exibido durante `loading`, e também mostra `<ScrollToTop />` no final — que aparece junto com os skeletons.

**Solução:** Mover `ScrollToTop` para dentro do `Layout.tsx` (fora do conteúdo condicional), garantindo que ele exista em todas as páginas sem precisar importar em cada uma. 7 páginas podem remover o import de `ScrollToTop`.

---

## 3. Padronização de Componentes

### 3.1 🔴 DUALIDADE Button / Card / Input

**Problema:** Existem **dois sistemas de componentes base**:

| Componente | Custom (`src/components/`) | shadcn/ui (`src/components/ui/`) |
|-----------|---------------------------|----------------------------------|
| Button | `Button.tsx` | `ui/button.tsx` |
| Card | `Card.tsx` | `ui/card.tsx` |
| Input | `Input.tsx` | `ui/input.tsx` |
| Badge | `CategoryBadge.tsx`, `ReconciliationBadge.tsx` | `ui/badge.tsx` |
| Select | `Select.tsx` | `ui/select.tsx` |
| Switch | `Switch.tsx` | `ui/switch.tsx` |
| Checkbox | `Checkbox.tsx` | `ui/checkbox.tsx` |

**Impacto:** 
- 14 componentes base onde poderiam ser 7
- `CategoryBadge` e `ReconciliationBadge` são wrappers de 20 linhas que poderiam usar `ui/badge` com variantes
- `ui/separator.tsx` existe mas nunca é usado
- `ui/scroll-area.tsx` existe mas nunca é usado diretamente

**Solução:**
1. **Auditar uso real** de cada componente em todo o app
2. **Consolidar**: onde `ui/*` atende, usar `ui/*`; onde custom tem features extras, portar para `ui/*` ou criar variante
3. **Remover** `ui/separator.tsx` e `ui/scroll-area.tsx` (dead code)
4. **Eliminar** `CategoryBadge.tsx` e `ReconciliationBadge.tsx` — substituir por `<Badge variant="category">` com Tailwind

### 3.2 🟡 MODAIS: 3 SISTEMAS CONCORRENTES

**Problema:** Existem 3 formas concorrentes de abrir modais:

| Sistema | Exemplos | Problema |
|---------|----------|---------|
| `Modal.tsx` (wrapper Dialog/Sheet) | 20+ modais | Padrão principal, consistente |
| `ConfirmModal.tsx` | DeleteConfirm, etc | Duplicata do Modal com checkbox |
| `Sheet` direto (Layout.tsx) | Mobile menu | Deveria usar Modal |

**Solução:**
1. `ConfirmModal` pode ser substituído por `<Modal variant="confirm">` com checkbox embutido
2. Sheet do mobile menu pode usar `Modal` com `mobileType="sheet"`
3. Consolidar toda a lógica de modais em `Modal.tsx`

### 3.3 🟢 PADRÃO TransactionCard

**Problema:** O `TransactionCard` é usado em `Expenses.tsx` e `Incomes.tsx`. O padrão de exibição (valor ponderado + original riscado + InfoTooltip) foi replicado manualmente em:
- `CategoryDetailModal.tsx` (detalhamento de categoria)
- `Dashboard.tsx` (modal inline de categoria)

**Solução:** Extrair um sub-componente `TransactionRow` de `TransactionCard` que possa ser reutilizado nos modais, garantindo consistência visual e evitando replicação.

```tsx
// Uso ideal:
<TransactionRow
  description="..."
  date={...}
  amount={weighted}
  originalAmount={base}
  onClick={...}
/>
```

### 3.4 🟡 InfoTooltip DISPERSO

**Problema:** `InfoTooltip` é importado em 5+ arquivos com textos hardcoded repetidos. Alguns tooltips na aba de Cartões ainda usam `title` nativo do HTML (sem padronização visual).

**Solução:** Centralizar textos de tooltip em constantes ou hook:

```tsx
// src/constants/tooltips.ts
export const WEIGHT_TOOLTIPS = {
  reportValue: 'Valor considerado nos relatórios mensais. Pode ser diferente do valor real quando o lançamento tem impacto parcial (ex: conta dividida).',
  baseValue: 'Valor original do lançamento, sem ajustes.',
  cardHeader: 'Valor real da fatura, sem ajustes. O valor nos relatórios pode ser diferente.',
} as const
```

---

## 4. Eliminação de Redundâncias

### 4.1 🔴 ExpenseFormModal ≈ IncomeFormModal

**Problema:** `ExpenseFormModal.tsx` e `IncomeFormModal.tsx` têm **~85% de código duplicado**:
- Mesma estrutura de form (amount + report weight + date + category + description)
- Mesmo uso de `useFormAmountSync`
- Mesmos padrões de submit/update
- Mesmos campos de parcelamento (apenas despesas, mas estrutura similar)
- Mesmo modal header/footer/body pattern

**Solução:** Extrair `TransactionFormBase` — componente base que recebe:
- `fields` (quais campos mostrar: amount, weight, date, category, description, installments)
- `categoryType` ('expense' | 'income')
- `hooks` (create, update, delete)
- `onSubmit`, `onUpdate`, `onDelete`

```tsx
// Estrutura proposta:
TransactionFormBase
├── TransactionAmountFields (amount + weight)
├── TransactionDateField
├── TransactionCategorySelect
├── TransactionPaymentFields (expense-specific)
├── TransactionInstallmentFields (expense-specific)
└── TransactionDescriptionField
```

**Economia estimada:** ~400 linhas de código.

### 4.2 🔴 HOOKS CRUD REPETITIVOS

**Problema:** 7 hooks CRUD seguem o MESMO padrão:

```typescript
// useExpenses, useIncomes, useCategories, useIncomeCategories,
// useCreditCards, useDebts, useExpenseCategoryLimits

const [data, setData] = useState<T[]>([])
const [loading, setLoading] = useState(true)

useEffect(() => { loadData() }, [])
useEffect(() => { subscribeToChanges() }, [])

async function loadData() { ... setLoading(false) }
async function create(payload) { ... }
async function update(id, payload) { ... }
async function delete_(id) { ... }
```

**Solução:** Criar **`useSupabaseTable`** — hook genérico que aceita:

```typescript
function useSupabaseTable<T extends { id: string }>(config: {
  table: string
  select?: string
  filters?: Record<string, any>
  orderBy?: { column: string; ascending?: boolean }
  subscribe?: boolean
  transform?: (data: any) => T
}) {
  // load, create, update, delete, subscribe, loading, error
}
```

**Economia estimada:** ~500 linhas de código, 7 hooks → 1 hook + 7 chamadas de configuração.

### 4.3 🟡 floatingSideLayout.ts DEAD CODE?

**Problema:** `floatingSideLayout.ts` contém constantes de dimensões de layout que podem estar obsoletas ou subutilizadas.

**Solução:** Auditar e remover ou consolidar.

### 4.4 🟢 DUPLICAÇÃO DE ESTILOS RECHARTS

**Problema:** O CSS do Recharts está duplicado entre `index.css` e possivelmente `theme-tokens.css`.

**Solução:** Centralizar TODO o CSS do Recharts em `index.css` numa seção `/* Recharts */` claramente demarcada, e remover duplicatas.

---

## 5. Refinamento de Pop-ups Informativos

### 5.1 ONDE JÁ EXISTEM

| Componente | Tooltip | Texto Atual |
|-----------|---------|-------------|
| `BillExpenseRowButton` | ✅ InfoTooltip | Valor ponderado / relatórios |
| `CreditCardTimeline` | ✅ InfoTooltip | Valor da fatura nos relatórios |
| `TransactionCard` | ✅ InfoTooltip | Valor original vs reportado |
| `Contas.tsx` header | ✅ InfoTooltip | Valor real da fatura |
| `Categories.tsx` | ✅ InfoTooltip | Valor original vs ajustado |
| `CategoryDetailModal` | ✅ InfoTooltip | Valor base no resumo |
| `Dashboard.tsx` modal | ✅ InfoTooltip | Valor original riscado |
| `EvolutionChart.tsx` | ✅ InfoTooltip (componente) | TWR methodology |
| `ReportsCategoryRowButton` | ❌ **FALTA** | Valor base vs ponderado |
| `Relatórios (pie charts)` | ❌ **FALTA** | Explicação dos tipos de gráfico |

### 5.2 ONDE ADICIONAR

1. **`ReportsCategoryRowButton.tsx`** — tooltip no valor base vs ponderado (consistência com o resto do app)
2. **Gráficos de pizza** — tooltips sutis explicando o que cada segmento representa
3. **MonthSelector** — tooltip no Mês atual explicando swipe navigation
4. **Seções de KPI** — tooltips nos valores que têm subtexto (ex: "vs. mês anterior")

### 5.3 PADRONIZAÇÃO DE TEXTOS

Centralizar todos os textos em `src/constants/tooltips.ts` para evitar repetição e facilitar manutenção.

---

## 6. Otimização de Hooks e Data Flow

### 6.1 🟡 useEffect EM EXCESSO

**Problema:** ~131 `useEffect` no app, muitos com dependências complexas que causam re-renders desnecessários.

**Top offenders:**
| Arquivo | useEffects | Ação |
|---------|-----------|------|
| `FloatingCalculator.tsx` | 12 | Já reduzido, pode mais |
| `Reports.tsx` | 12+ | Aceitável pela complexidade |
| `FloatingCalculator.tsx` | 12 | Pode unificar effects de resize/drag |

**Solução:** Usar `useEvent` (React 19) ou biblioteca `react-use` para efeitos comuns (scroll, resize, etc.).

### 6.2 🟢 useAppSettings CRESCENTE

**Problema:** `useAppSettings` está acumulando setters para cada configuração individual (8 setters e crescendo), importado em 5+ componentes.

**Solução:** Adotar um reducer pattern:

```typescript
type AppSetting = {
  floatingCalculatorEnabled: boolean
  dashboardReportsWeightsEnabled: boolean
  creditCardsWeightsEnabled: boolean
  categoriesWeightsEnabled: boolean
  biometricLockTimeout: BiometricLockTimeout
  remindersEnabled: boolean
  remindersDaysBeforeDebts: number
  remindersDaysBeforeCardBills: number
}

// Hook retorna:
const { settings, updateSetting } = useAppSettings()
// updateSetting('floatingCalculatorEnabled', false)
```

### 6.3 🟢 onDataChanged EVENT LISTENER

**Problema:** `window.addEventListener('local-data-changed', ...)` aparece em Dashboard e Reports — mesmo pattern, código duplicado.

**Solução:** Criar hook `useDataRefresh(callback, deps)` que gerencia o listener e cleanup automático.

---

## 7. Plano de Implementação por Prioridade

### 🔴 FASE 1 — Alto Impacto, Baixo Risco (dias 1-3)

| # | Tarefa | Arquivos | Economia |
|---|--------|----------|----------|
| 1 | Consolidar todos os elementos flutuantes em `FloatingActionHub` | `ScrollToTop.tsx`, `Layout.tsx`, `FloatingCalculator.tsx`, `NotificationsWidget.tsx`, `MobileAlertsPill.tsx` | -5 arquivos |
| 2 | Extrair `TransactionRow` de `TransactionCard` e usar nos modais | `TransactionCard.tsx`, `CategoryDetailModal.tsx`, `Dashboard.tsx` | -50 linhas |
| 3 | Centralizar textos de tooltips em constantes | `src/constants/tooltips.ts`, +5 arquivos | Padronização |
| 4 | Adicionar tooltips faltantes (`ReportsCategoryRowButton`) | `ReportsCategoryRowButton.tsx` | Consistência |

### 🟡 FASE 2 — Refatoração Estrutural (dias 4-7)

| # | Tarefa | Arquivos | Economia |
|---|--------|----------|----------|
| 5 | Substituir `PageHeader` por `usePageActions` hook | `PageHeader.tsx`, todas as 9 páginas | -3 imports/página |
| 6 | Criar `useSupabaseTable` hook genérico | `useExpenses.ts`, `useIncomes.ts`, +5 hooks | -500 linhas |
| 7 | Extrair `TransactionFormBase` | `ExpenseFormModal.tsx`, `IncomeFormModal.tsx` | -400 linhas |
| 8 | Consolidar Button/Card/Input para eliminar dualidade | `Button.tsx`, `Card.tsx`, `Input.tsx`, `ui/*` | -7 arquivos |

### 🟢 FASE 3 — Polish e Performance (dias 8-10)

| # | Tarefa | Arquivos | Economia |
|---|--------|----------|----------|
| 9 | Mover `ScrollToTop` para Layout (remover de páginas) | `Layout.tsx`, 7 páginas | -7 imports |
| 10 | Limpeza de dead code (`ui/separator`, `ui/scroll-area`) | `src/components/ui/` | -2 arquivos |
| 11 | Reduzir `useEffect` nos componentes críticos | `FloatingCalculator.tsx` | -4 effects |
| 12 | Refatorar `useAppSettings` para reducer pattern | `useAppSettings.ts` | Manutenibilidade |
| 13 | Consolidar CSS Recharts em `index.css` | `index.css`, `theme-tokens.css` | Organização |

### 📊 Métricas de Sucesso

| Métrica | Antes | Depois (estimado) |
|---------|-------|-------------------|
| Elementos flutuantes na tela | 4-5 | 1 hub |
| Imports de PageHeader por página | 3 | 1 |
| Hooks CRUD | 7 | 1 + 7 configs |
| Linhas em ExpenseForm + IncomeForm | ~700+ | ~300 + base |
| Componentes base duais | 14 | 7 |
| `useEffect` no app | ~131 | < 100 |
| Arquivos de componente | ~100+ | ~85 |

---

## Legado: O que NÃO mudar

- **InfoTooltip.tsx** — componente está maduro e bem projetado
- **MonthSelector/MonthTransitionView** — animações e UX excelentes
- **Skeleton.tsx** — variantes por página bem resolvidas
- **Layout responsivo** (mobile nav + desktop sidebar) — sólido e testado
- **Sistema de temas** (ThemeContext, theme-tokens) — bem arquitetado
- **Sistema glass** (glass-border, surface-glass, etc.) — consistente e único
- **FloatingCalculator** — complexo mas maduro, melhorias seriam arriscadas
- **Motor de cálculos de portfolio** — testado 238/238 testes passando

---

> Este plano é um guia vivo. Cada fase deve ser validada com `tsc --noEmit` e `vitest run` antes de avançar para a próxima.
