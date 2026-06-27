# Arquitetura do Sistema - Minhas Finanças

Este documento descreve detalhadamente a estrutura técnica, os padrões de design e o fluxo de dados da aplicação **Minhas Finanças**. Ele serve como guia de onboarding e de governança técnica para garantir a consistência do ecossistema.

> **Última atualização:** Junho de 2026 — Refatoração completa + Sistema de z-index unificado.

---

## 1. Visão Geral da Arquitetura

O **Minhas Finanças** é uma aplicação **PWA (Progressive Web App)** construída com a stack React 18, TypeScript, Vite e Tailwind CSS, integrada ao Supabase como Backend-as-a-Service (BaaS). A aplicação foi projetada sob o paradigma **Offline-First**, permitindo que todas as mutações e visualizações de dados funcionem sem conexão com a internet.

### Mapa de Fluxo e Componentes (Mermaid Diagram)

```mermaid
graph TD
    subgraph Client [Camada do Cliente - Frontend]
        P_Dashboard[Páginas: Dashboard]
        P_Transactions[Páginas: Despesas / Rendas / Investimentos]
        P_Categories[Páginas: Planejamento de Categorias]
        
        subgraph UIComponents [Componentes Padronizados Reutilizáveis]
            C_Card[TransactionCard / TransactionRow]
            C_Kpis[DashboardKpis]
            C_ExpModal[ExpenseFormModal<br/>usa TransactionAmountFields<br/>TransactionDateField<br/>TransactionCategorySelect<br/>TransactionDescriptionField]
            C_IncModal[IncomeFormModal<br/>usa mesmos sub-componentes]
        end
        
        subgraph Hooks [Hooks Customizados & Lógica]
            H_SupabaseTable[useSupabaseTable<br/>hook genérico CRUD<br/>configRef pattern]
            H_Categories[useCategories<br/>usa useSupabaseTable]
            H_IncomeCats[useIncomeCategories<br/>usa useSupabaseTable]
            H_CreditCards[useCreditCards<br/>usa useSupabaseTable]
            H_Expenses[useExpenses<br/>manual (lógica de parcelas/cc)]
            H_Incomes[useIncomes<br/>manual (lógica específica)]
            H_AppSettings[useAppSettings<br/>reducer pattern]
            H_PageActions[usePageActions<br/>substitui PageHeader]
            H_Queue[useOfflineQueue]
        end
        
        subgraph LocalStorage [Armazenamento Local & Queue]
            L_Cache[(Dados Locais Cacheados)]
            L_Queue[(Fila Offline Mutações)]
        end
    end

    subgraph Service [Serviço & Sincronização]
        S_Sync[Serviço de Sincronização]
        S_SW[Service Worker - PWA]
    end

    subgraph Cloud [Camada de Nuvem - Backend]
        B_Supabase[(Supabase Database)]
    end

    %% Relações do Cliente
    P_Dashboard --> C_Kpis
    P_Dashboard --> C_ExpModal
    P_Dashboard --> C_IncModal
    
    P_Transactions --> C_Card
    P_Transactions --> C_ExpModal
    P_Transactions --> C_IncModal
    
    C_ExpModal --> H_Expenses
    C_IncModal --> H_Incomes
    C_Card --> H_Categories
    
    H_Expenses --> H_Queue
    H_Incomes --> H_Queue
    H_Categories --> H_SupabaseTable
    H_IncomeCats --> H_SupabaseTable
    H_CreditCards --> H_SupabaseTable
    H_Queue --> L_Queue
    H_Queue --> L_Cache
    
    L_Queue --> S_Sync
    S_Sync --> B_Supabase
    S_SW --> Client
```

---

## 2. Componentes Padronizados (UI/UX Core)

Para evitar redundância e garantir consistência estética extrema (em conformidade com a governança HSL), a interface de usuário foi modularizada nos seguintes componentes fundamentais em `src/components/`:

### 2.1 Componentes de Transação

| Componente | Propósito |
|-----------|-----------|
| `TransactionCard.tsx` | Unifica a exibição de despesas e rendas. Controla badges de categoria com cor dinâmica, representação de parcelamento (`1/12`), badges de faturas de cartão de crédito e indicador animado de carregamento para IDs `offline-`. |
| `TransactionRow.tsx` | Sub-componente reutilizável extraído de `TransactionCard`. Usado em `CategoryDetailModal` e `Dashboard` para linhas de transação consistentes. |

### 2.2 Sub-componentes de Formulário de Transação (Item 7)

Extraídos para eliminar duplicação entre `ExpenseFormModal` e `IncomeFormModal`:

| Componente | Arquivo | Função |
|-----------|---------|--------|
| `TransactionAmountFields` | `src/components/TransactionAmountFields.tsx` | Par de inputs de valor (amount + report_weight) com `useFormAmountSync` embutido, `onAmountChanged` para side effects, e `onReportAmountBlur` para formatação |
| `TransactionDateField` | `src/components/TransactionDateField.tsx` | Input `type="date"` padronizado com `APP_START_DATE` como mínimo |
| `TransactionCategorySelect` | `src/components/TransactionCategorySelect.tsx` | Select de categoria padronizado com `Select` component |
| `TransactionDescriptionField` | `src/components/TransactionDescriptionField.tsx` | Input de descrição padronizado |

### 2.3 Modais de Transação

| Componente | Arquivo | Função |
|-----------|---------|--------|
| `ExpenseFormModal` | `src/components/ExpenseFormModal.tsx` | Gerencia o ciclo completo (cadastro, edição e deleção) de despesas. Inclui lógica de competência de cartões, peso de inclusão em relatórios (`report_weight`), parcelamento, e vínculo com dívidas. Refatorado para usar os 4 sub-componentes acima. |
| `IncomeFormModal` | `src/components/IncomeFormModal.tsx` | Gerencia o ciclo de rendas. Trata de forma especial estornos automáticos de cartões de crédito. Refatorado para usar os 4 sub-componentes acima. |

### 2.4 Dashboard e KPIs

| Componente | Função |
|-----------|--------|
| `DashboardKpis.tsx` | Renderiza a grade padrão de KPIs do Dashboard (Rendas, Despesas, Investimentos e Saldo) |
| `KpiCard.tsx` | Card individual de KPI com ícone, valor, glow e tooltip |
| `FloatingActionHub.tsx` | Consolida `ScrollToTop` + `NotificationsWidget` em um portal único, substituindo ~14 imports |

### 2.5 Elementos Flutuantes

| Componente | Função |
|-----------|--------|
| `FloatingCalculator` | Calculadora flutuante (drag, resize, animação) — ~11 useEffects (MutationObserver, effects unificados) |
| `FloatingSideStack` | Painel lateral direito para ações flutuantes |
| `FloatingActionHub` | Hub unificado para ScrollToTop e NotificationsWidget |

### 2.6 Componentes de Layout

| Componente | Função |
|-----------|--------|
| `Layout.tsx` | Layout responsivo: mobile bottom nav (5 tabs + sheet "Mais"), desktop sidebar colapsável |
| `IconButton.tsx` | Botão de ícone padronizado — usa `@/components/Button` custom com `size="icon"` |

### 2.7 Botões

O sistema de botões segue um padrão **wrapper → shadcn/ui**, auditado e consolidado (Item 8):

| Custom (`src/components/`) | shadcn/ui (`src/components/ui/`) | Padrão |
|---------------------------|----------------------------------|--------|
| `Button.tsx` | `ui/button.tsx` | Wrapper com `variantMap` + `sizeMap` (inclui `size="icon"`) |
| `Card.tsx` | `ui/card.tsx` | Wrapper com glass + clickable states |
| `Input.tsx` | `ui/input.tsx` | Wrapper com label + error + DatePicker (sem `as any`) |
| `IconButton.tsx` | — | Usa `Button` custom com `size="icon"` diretamente |

---

## 3. Hooks Customizados

### 3.1 `useSupabaseTable` — Hook Genérico CRUD (Item 6 + Correção)

```typescript
function useSupabaseTable<T extends { id: string }>(config: {
  table: QueueEntity
  select?: string
  filters?: Record<string, unknown>
  orderBy?: { column: string; ascending?: boolean }
  month?: string                       // Filtro por mês (date range ou coluna month)
  cacheKey?: string | (() => string)
  userScoped?: boolean                 // Cache key inclui user.id
  subscribe?: boolean                  // Realtime subscription
  sortBy?: (items: T[]) => T[]
  listenLocalDataChanged?: boolean     // Escuta eventos locais
  errorMessage?: string                // Mensagem custom de erro no catch
})
```

**Funcionalidades:**
- Load com cache + fallback offline (lê cache quando offline)
- Create / Update / Delete com suporte offline (fila de mutações)
- Realtime subscription via Supabase (`postgres_changes`)
- Listeners `offline-queue-processed` e `local-data-changed`
- Estados `loading` / `error`
- Cache key com escopo de usuário

#### ⚠️ Correção de Bug Crítico — configRef Pattern

**Problema:** O `useEffect(() => { load() }, [load])` causava um **loop infinito de render**. A função `load` (um `useCallback`) mudava de referência a cada render porque:

1. Os hooks consumidores (`useCategories`, `useIncomeCategories`, etc.) passam a config como **objeto literal inline**: `{ table: 'categories', orderBy: {...}, ... }`
2. A cada render, esse objeto é recriado → `filters`, `orderBy`, `sortBy` têm novas referências
3. `buildQuery` (que depende desses objetos) mudava → `load` mudava → `useEffect` disparava → `setState` → **loop infinito**

**Solução:** Armazenar o objeto `config` em um `useRef` (`configRef`) e ler as valores mutáveis dentro dos `useCallback`s a partir da ref. As dependências dos `useCallback`s passaram a conter **apenas valores primitivos estáveis** (`table`, `month`, `isOnline`, `user?.id`), eliminando a cascata de novas referências:

```typescript
// Antes (causava loop):
const buildQuery = useCallback(() => {
  // depende de filters, orderBy, ... → novas referências a cada render
}, [table, select, filters, month, dateColumn, orderBy])

const load = useCallback(async () => {
  // depende de buildQuery → muda toda vez que buildQuery muda
}, [table, month, isOnline, getCacheKey, buildQuery, sortBy, errorMessage])

useEffect(() => { load() }, [load]) // ← load MUDA a cada render → LOOP

// Depois (estável):
const configRef = useRef(config)
configRef.current = config

const buildQuery = useCallback(() => {
  const { select, filters, dateColumn, orderBy } = configRef.current
  // lê valores da ref, sem depender das referências
}, [table, month]) // ← apenas primitivas estáveis

const load = useCallback(async () => {
  const { sortBy, errorMessage } = configRef.current
  // ...
}, [table, month, isOnline, getCacheKey, buildQuery]) // ← dependências estáveis

useEffect(() => { load() }, [load]) // ← load NÃO muda mais em loop ✅
```

**Hooks refatorados para usar `useSupabaseTable`:**
- `useCategories` (~60% menos linhas)
- `useIncomeCategories` (~60% menos linhas)
- `useCreditCards` (~50% menos linhas)

**Total:** ~250 linhas de boilerplate eliminadas.

**Hooks mantidos manuais (lógica de negócio muito específica para refatoração segura):**
- `useExpenses` — parcelamento, competência de cartão de crédito, exclusão single/all/subsequent
- `useIncomes` — validações específicas de tipo de renda
- `useDebts` — join com expenses, grupos de exclusão, optimistic insert com temp ID

### 3.2 `useAppSettings` — Reducer Pattern (Item 11)

Refatorado de **8 `useState` + 8 `useCallback`** para **1 `useReducer` + 1 `updateSetting<K>(key, value)` genérico**:

```typescript
type AppSettingsState = {
  floatingCalculatorEnabled: boolean
  dashboardReportsWeightsEnabled: boolean
  creditCardsWeightsEnabled: boolean
  categoriesWeightsEnabled: boolean
  biometricLockTimeout: BiometricLockTimeout
  remindersEnabled: boolean
  remindersDaysBeforeDebts: number
  remindersDaysBeforeCardBills: number
}

// Uso:
const { settings, updateSetting } = useAppSettings()
// settings.floatingCalculatorEnabled
// updateSetting('floatingCalculatorEnabled', false)
```

**Consumidores atualizados:** NotificationsContext, ProtectedRoute, Settings, Layout, Contas (5 arquivos).

### 3.3 `usePageActions` — Substitui PageHeader (Item 5)

Substitui o antigo `PageHeader` (que renderizava `null`) para registrar ações flutuantes:

```tsx
// Antes: 3 imports + ~15 linhas de JSX
// Depois: 1 import + 1 chamada de hook
import { usePageActions } from '@/hooks/usePageActions'
usePageActions([{ icon: Plus, label: 'Adicionar', intent: 'primary', onClick: fn }])
```

**10 páginas** atualizadas — Dashboard, Expenses, Incomes, Investments, Categories, Contas, Reports, Settings, ExpenseCategories, IncomeCategories.

### 3.4 `useFormAmountSync` — Sincronização de Valores

Hook compartilhado entre `ExpenseFormModal` e `IncomeFormModal` para sincronizar `amount` e `report_amount`. Embutido no componente `TransactionAmountFields`.

### 3.5 Demais Hooks

| Hook | Função |
|------|--------|
| `useExpenses` | CRUD de despesas (manual — parcelas, cc competence) |
| `useIncomes` | CRUD de rendas (manual — validações específicas) |
| `useDebts` | CRUD de dívidas (manual — join com expenses) |
| `useSwipeMonth` | Navegação por swipe entre meses |
| `useBackgroundCache` | Cache em background para dados do dashboard |
| `useNetworkStatus` | Monitor de conectividade |

---

## 4. Estratégia Offline-First (Mutações em Fila)

O aplicativo garante operação contínua mesmo em quedas de sinal de rede:

* **Leitura**: Todas as listagens usam cache do `localStorage` atualizado em segundo plano.
* **Escrita (Fila de Mutações)**: 
  1. Quando uma mutação (criar/editar/deletar) ocorre sem conexão, o hook `useOfflineQueue` captura a ação.
  2. A mutação recebe um ID provisório (ex: `offline-1716382103`).
  3. A ação é serializada na tabela local de pendências.
  4. Um evento global `local-data-changed` é disparado, forçando a atualização imediata da interface.
  5. Quando o navegador detecta a volta da internet (evento `online`), o serviço sincroniza a fila executando as operações na ordem cronológica exata no Supabase.

O hook genérico `useSupabaseTable` encapsula toda essa lógica automaticamente.

---

## 5. Estrutura de Diretórios Organizada

```text
├── database/                   # Scripts de Banco de Dados
│   ├── database.sql            # Estrutura base completa (Tabelas, Triggers, RLS)
│   ├── schema.sql              # Apenas o schema DDL limpo
│   ├── migrations/             # Migrations de evolução de banco
│   └── samples/                # Arquivos CSV ou dados de amostra para testes
│
├── docs/                       # Documentações do Projeto
│   ├── ui/                     # Governança visual de Guardrails
│   │   ├── GOVERNANCA_UI.md
│   │   └── guardrails-baseline.json
│   ├── ARCHITECTURE.md         # Este documento
│   ├── REFACTORING_PLAN.md     # Plano de refatoração completo
│   └── AUDITORIA_REVISAO.md    # Auditoria técnica
│
├── src/
│   ├── components/             # Componentes de UI
│   │   ├── ui/                 # shadcn/ui primitives
│   │   ├── debts/              # Componentes de dívidas
│   │   ├── creditCards/        # Componentes de cartão de crédito
│   │   ├── investments/        # Componentes de investimentos
│   │   ├── reports/            # Componentes de relatórios
│   │   ├── dashboard/          # Componentes do dashboard
│   │   ├── settings/           # Componentes de configurações
│   │   ├── categories/         # Componentes de categorias
│   │   └── reconciliation/     # Componentes de reconciliação
│   │
│   ├── hooks/                  # Hooks customizados
│   │   ├── useSupabaseTable.ts  # Hook genérico CRUD (com configRef pattern)
│   │   ├── usePageActions.tsx   # Ações flutuantes
│   │   ├── useAppSettings.ts    # Settings com reducer
│   │   ├── useFormAmountSync.ts # Sincronização amount/report_amount
│   │   └── ... (demais hooks)
│   │
│   ├── constants/              # Constantes globais
│   │   └── tooltips.ts         # Textos de tooltips centralizados
│   │
│   ├── contexts/               # Provedores (Auth, Notifications, FloatingActions)
│   ├── pages/                  # Páginas principais roteadas
│   ├── services/               # Regras de negócio (motor de rentabilidade, etc.)
│   ├── types/                  # Contratos TypeScript de domínio
│   └── utils/                  # Helpers e utilitários
│
└── ... (config files: vite.config.ts, tailwind.config.js, etc.)
```

---

## 6. Governança de Layout & HSL

O sistema de cores do aplicativo é totalmente configurado via variáveis HSL em `src/index.css` e integrado ao `tailwind.config.js`. Para manter a harmonia visual:
* Evite cores sólidas como `bg-red-500` ou `bg-blue-600`.
* Sempre use as classes temáticas: `text-primary`, `bg-secondary`, `border-primary`, `bg-tertiary` ou classes semânticas `text-expense`, `text-income`.
* A conformidade de estilos é verificada a cada commit pelo validador de guardrails (`npm run guardrails:ui`).

### Componentes removidos por dead code

- `ui/separator.tsx` — 0 imports, removido
- `ui/scroll-area.tsx` — 0 imports, removido
- `PageHeader.tsx` — 0 imports, substituído por usePageActions
- `MobileAlertsPill.tsx` — 0 imports, consolidado em NotificationsWidget
- `PageHeaderActions.tsx` e `PageHeaderActionButton.tsx` — **restaurados** (usados por `usePageActions.tsx`)

### CSS Recharts

Centralizado em `index.css` na seção `/* Estilização centralizada de gráficos Recharts */`, sem duplicação em `theme-tokens.css`.

---

## 7. Motor de rentabilidade (carteira / consultoria)

O fechamento patrimonial e a cota líquida são calculados em TypeScript puro, testável sem browser, com persistência opcional no Supabase.

### Contrato estável (`runDailyClose`)

Entrada (`DailyCloseInput`): `portfolioId`, `transactions`, `definitions`, `targets`, `prices`, `cashBalance`, `indexRatesByIndexer`, `asOfDate?`.

Saída (`DailyCloseResult`): `grossPl`, `netPl`, `shareValue`, `totalShares`, `lotCount`.

Orquestração em `src/services/returns/closePipeline.ts` (cálculo) e `src/services/returns/portfolioCloseService.ts` (persistência + snapshot mensal).

### Módulos de valoração

| Módulo | Arquivo | Regra |
|--------|---------|--------|
| Mercado (RV) | `priceService.ts` | Yahoo + guard de spike 50% → Last Known Value |
| RF / Tesouro na curva | `fixedIncomeValuation.ts` | Pré: 252 DU; IPCA+: fator VNA; lotes FIFO |
| IR por lote | `taxProvision.ts` | Tabela regressiva / 15% mercado |
| TWR mensal | `periodReturns.ts` | `Rm = cota_fech / cota_abertura - 1` |

### Tabelas (migration `20260602140000_portfolio_returns_engine.sql`)

- `portfolio_share_daily` — histórico de cota
- `portfolio_period_snapshots` — fechamentos mensais/anuais
- `asset_price_daily`, `vna_daily` — séries de mercado e VNA

### Disparo no SPA

- Botão **Atualizar fechamento** em `Investments.tsx` → `usePortfolioClose().runClose`
- Futuro backend próprio deve importar as mesmas funções (`computeDailyClose` / `runDailyClose`) sem alterar contratos.

---

## 8. Skeleton Loading States

O componente `Skeleton.tsx` (`src/components/Skeleton.tsx`) fornece placeholders estruturais para loading states em todas as páginas do app:

### Variantes disponíveis

| Variante | Uso | Descrição |
|----------|-----|-----------|
| `SkeletonDashboard` | Dashboard | 4 KPIs + gráfico de fluxo + limites + insights |
| `SkeletonInvestments` | Investimentos | 4 KPIs + tabs + saldo + chart evolução + 3 pizza charts |
| `SkeletonCategories` | Categorias | 4 KPIs + 6 category cards com status |
| `SkeletonTransactionList` | Despesas/Rendas | 3 linhas com ícone, título e valor |
| `SkeletonContas` | Contas | 4 KPIs + tabs + accordion cards + pendências |
| `SkeletonReports` | Relatórios | tabs período + 4 KPIs + 2 charts + composição + insights |
| `SkeletonCategoryGrid` | Categ. Despesa/Renda | 4 cards em grid com ícone e nome |

### Primitivos base

- `SkeletonText` — linha de texto placeholder
- `SkeletonCard` — card placeholder com N linhas
- `SkeletonKpi` — KPI individual neutro (sem borda colorida)
- `SkeletonKpiGrid` — grid de 4 KPIs para painéis
- `SkeletonAccordionCard` — card expansível para listas

Todos os skeletons usam classes `border-glass` e `bg-glass/10` para um visual neutro e padronizado.

---

## 9. Logger Condicional

O `src/utils/logger.ts` padroniza o logging do app:

| Método | Nível | Comportamento em produção |
|--------|-------|--------------------------|
| `logger.debug()` | DEBUG | Suprimido |
| `logger.info()` | INFO | Suprimido |
| `logger.warn()` | WARN | Exibido |
| `logger.error()` | ERROR | Exibido |

Controlado via `VITE_LOG_LEVEL` (default: `'warn'` em produção).

**89 chamadas `console.*`** foram substituídas pelo logger em **32+ arquivos**.

---

## 10. Histórico de Refatoração e Correções

| Item | Descrição | Fase | Status |
|------|-----------|------|--------|
| 1 | FloatingActionHub (unifica ScrollToTop + NotificationsWidget) | Fase 1 | ✅ |
| 2 | TransactionRow extraído de TransactionCard | Fase 1 | ✅ |
| 3 | Tooltips centralizados em `constants/tooltips.ts` | Fase 1 | ✅ |
| 4 | Tooltips faltantes adicionados | Fase 1 | ✅ |
| 5 | usePageActions substitui PageHeader (10 páginas) | Fase 2 | ✅ |
| 6 | useSupabaseTable hook genérico + 3 hooks refatorados | Fase 2 | ✅ |
| 7 | 4 sub-componentes TransactionForm + modais refatorados | Fase 2 | ✅ |
| 8 | Button size="icon" + IconButton consolidado | Fase 2 | ✅ |
| 9 | Dead code removido (separator, scroll-area) | Fase 3 | ✅ |
| 10 | Reduzir useEffect em componentes críticos | Fase 3 | ✅ |
| 11 | useAppSettings reducer pattern | Fase 3 | ✅ |
| 12 | CSS Recharts consolidado | Fase 3 | ✅ |
| — | Dead code (PageHeader, MobileAlertsPill) + restauração (PageHeaderActions/PageHeaderActionButton) | Final | ✅ |
| — | `as any` / `catch(err: any)` zerados no código de produção | Final | ✅ |
| — | **Correção: loop infinito no useSupabaseTable** usando configRef | Correção | ✅ |
| — | Teste de snapshot corrigido (PageHeader removido) | Correção | ✅ |
| — | **RowButton — ExpenseCategoryRowButton refatorado + PaymentRowButton removido** | Melhoria | ✅ |
| — | **Select custom → Radix UI (shadcn) — mantendo mesma API** | Melhoria | ✅ |
| — | **useEffect reduzido (FloatingCalculator ~14→11, Reports 2→1)** | Melhoria | ✅ |
| — | Documentação finalizada | Final | ✅ |

### Validação final

- ✅ Build: OK
- ✅ Typecheck: 0 erros
- ✅ Testes: 237/237 passando (27 arquivos)

### Melhorias adicionais (pós-refatoração)

- **RowButton extraído**: `ExpenseCategoryRowButton` refatorado para usar `RowButton` base. `PaymentRowButton` removido (wrapper vazio). `Contas.tsx` atualizado.
- **Select → Radix UI**: `Select.tsx` refatorado internamente para usar `@radix-ui/react-select` (shadcn), mantendo a mesma API externa. 19 consumidores inalterados. 4 snapshots atualizados.
- **useEffect reduzido**: FloatingCalculator ~14→11 effects (MutationObserver + resize unificado + localStorage unificado + keyboard com useRef). Reports.tsx: 2 effects de validação unificados.
- **Sistema de z-index unificado**: Implementação de CSS Custom Properties e constantes TypeScript para hierarquia padronizada. Todos os componentes migrados de valores hardcoded. Teste de consistência automatizado (16 testes).

---

## 11. Sistema de Z-Index (Hierarquia de Camadas)

O aplicativo utiliza um sistema centralizado e padronizado de `z-index` para evitar bugs de sobreposição e garantir consistência visual em todos os temas.

### 11.1 Arquivos de Definição

| Arquivo | Função |
|---------|--------|
| `src/constants/zIndex.ts` | Constantes TypeScript (`Z_INDEX`) — usadas em componentes `.tsx/.ts` |
| `src/styles/theme-tokens.css` | CSS Custom Properties (`--z-*`) — usadas em `.css` |
| `src/constants/zIndex.test.ts` | Teste de consistência entre as duas fontes |

### 11.2 Tabela de Níveis

| Nível | Constante | Classe CSS | Uso |
|-------|-----------|------------|-----|
| 0 | `Z_INDEX.BASE` | `z-0` | Camada base do app (`app-shell-glow`, grid backgrounds) |
| 1 | `Z_INDEX.DECORATION` | `z-[1]` | Elementos decorativos (halo glow, barras de progresso) |
| 10 | `Z_INDEX.CONTENT` | `z-10` | Conteúdo principal (containers de página, prefixos de input, timelines, scroll-to-top wrapper) |
| 30 | `Z_INDEX.STICKY` | `z-30` | Elementos temporariamente elevados (trigger de select aberto) |
| 100 | `Z_INDEX.NAVIGATION` | `z-[100]` | Barras de navegação (bottom nav, sidebar) |
| 150 | `Z_INDEX.POPOVER` | `z-[150]` | Popovers, tooltips, scroll-to-top button, FABs de notificação |
| 900 | `Z_INDEX.OVERLAY` | `z-[900]` | Overlays de modais e sheets (backdrop) |
| 1000 | `Z_INDEX.MODAL` | `z-[1000]` | Conteúdo de modais/sheets padrão |
| 1100 | `Z_INDEX.SIDE_STACK` | `z-[1100]` | Stack lateral flutuante (page actions, calculadora em modo aba, elevated modal overlay) |
| 1200 | `Z_INDEX.ELEVATED` | `z-[1200]` | Modais elevados (sobrepoem outros modais) |
| 1300 | `Z_INDEX.CALCULATOR` | `z-[1300]` | Calculadora flutuante (sempre acima de tudo, exceto toasts) |
| 1400 | `Z_INDEX.TOAST` | `z-[1400]` | Toasts e notificações temporárias (sempre visíveis) |
| 9999 | `Z_INDEX.PRINT` | `z-[9999]` | Camada de impressão |

### 11.3 Diagrama de Hierarquia

```
       ▲  z-index
       │
  9999 │ PRINT
       │
  1400 │ TOAST
  1300 │ CALCULATOR
  1200 │ ELEVATED         ───── Modal elevado (content)
  1100 │ SIDE_STACK       ───── Elevated overlay + Side stack
  1000 │ MODAL            ───── Modal/sheet padrão (content)
   900 │ OVERLAY          ───── Overlay de modal (backdrop)
       │
   150 │ POPOVER          ───── Tooltips, scroll-to-top btn, notification FAB
   100 │ NAVIGATION       ───── Bottom nav bar, sidebar
    30 │ STICKY           ───── Select trigger aberto
    10 │ CONTENT          ───── Conteúdo de página
     1 │ DECORATION       ───── Halo glow, barras de progresso
     0 │ BASE             ───── App shell glow, grid
```

### 11.4 Type Safety

O tipo `ZIndexElevated` (exportado de `src/constants/zIndex.ts`) é usado nos componentes `Modal`, `ModalForm` e `PortfolioTransactionFormModal` para garantir que apenas o valor `'z-[1200]'` (ELEVATED) seja passado como `zIndexClass`, eliminando valores arbitrários.

```typescript
import { Z_INDEX, type ZIndexElevated } from '@/constants/zIndex'

interface ModalProps {
  // ...
  zIndexClass?: ZIndexElevated  // apenas 'z-[1200]' é aceito
}
```

### 11.5 Migração para Novos Componentes

1. Identifique o nível apropriado na tabela 11.2
2. Use a constante `Z_INDEX.{NIVEL}` em componentes `.tsx/.ts`
3. Use `var(--z-{nivel})` em arquivos `.css`
4. Se precisar de um novo nível, adicione em **ambos** `zIndex.ts` e `theme-tokens.css`, e atualize o teste `zIndex.test.ts`
5. Rode `npx vitest run src/constants/zIndex.test.ts` para validar a consistência

### 11.6 Bugs Conhecidos (Corrigidos)

- **Tooltips atrás da bottom nav**: `Z_INDEX.POPOVER` foi elevado de `z-50` para `z-[150]` (acima de `NAVIGATION` = `z-[100]`)
- **Toasts atrás de modais elevados**: `NetworkStatusToast` e `PwaUpdatePrompt` migrados de `z-[1000]` (MODAL) para `z-[1400]` (TOAST), garantindo visibilidade sobre todos os modais

---

> Este documento é um guia vivo. Consulte `docs/REFACTORING_PLAN.md` para o plano detalhado e `docs/AUDITORIA_REVISAO.md` para o diagnóstico técnico completo.
