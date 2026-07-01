# Arquitetura do Sistema - Minhas Finanças

Este documento descreve detalhadamente a estrutura técnica, os padrões de design e o fluxo de dados da aplicação **Minhas Finanças**. Ele serve como guia de onboarding e de governança técnica para garantir a consistência do ecossistema.

> **Última atualização:** Julho de 2026 — TopBar padronizado, notificações unificadas, cards de ação removidos, labels de 'base' limpos.

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
| `TransactionCard.tsx` | Unifica a exibição de despesas e rendas. Controla badges de categoria com cor dinâmica, representação de parcelamento (`1/12`), badges de faturas de cartão de crédito e indicador animado de carregamento para IDs `offline-`. **Otimização:** Usa `useMediaQuery` para renderizar apenas o layout ativo (mobile compacto ou desktop com colunas), eliminando a renderização duplicada de ambos os layouts no DOM. |
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
| `FloatingCalculator` | Calculadora flutuante (drag, resize, animação) — ~10 useEffects, com lógica extraída para 3 utils + 2 hooks |
| `FloatingSideStack` | Painel lateral direito para ações flutuantes |
| `FloatingActionHub` | Hub unificado para ScrollToTop e NotificationsWidget — ~50 linhas, 4 useEffects, com lógica extraída para `hooks/useScrollToTop.ts` + `utils/haptics.ts` |

### 2.6 Componentes de Layout

| Componente | Função |
|-----------|--------|
| `Layout.tsx` | Layout responsivo: mobile bottom nav (5 tabs + sheet "Mais"), desktop sidebar colapsável |
| `IconButton.tsx` | Botão de ícone padronizado — usa `@/components/Button` custom com `size="icon"` |

### 2.7 Componentes UI — Arquitetura de Camadas

O sistema de componentes segue uma arquitetura de duas camadas:

**Camada 1 — Primitivos (`src/components/ui/`)**: Componentes base do shadcn/ui, com funcionalidades estendidas:
- `ui/button.tsx` — Aceita `fullWidth` prop para largura total
- `ui/card.tsx` — Aceita `onClick` com suporte a teclado (Enter/Space) e acessibilidade (`role="button"`, `tabIndex`)
- `ui/input.tsx` — Primitivo puro (apenas `<input>` estilizado)
- `ui/skeleton.tsx` — Contém TODAS as variantes de skeleton (texto, card, accordion, KPI, página)

**Camada 2 — Domínio (`src/components/`)**: Componentes de domínio que usam os primitivos:
| Componente | Primitivo | Funcionalidades adicionadas |
|-----------|-----------|------------------------------|
| `Button.tsx` | `ui/button.tsx` | Mapeamento de variantes (`primary`→`default`, `danger`→`destructive`), `fullWidth` delegado |
| `Card.tsx` | `ui/card.tsx` | Padding padrão `p-4`, transições `hover:border-glass-strong hover:shadow-md` |
| `Input.tsx` | `ui/input.tsx` | Label + error + helperText + integração com `DatePicker` para `type="date"` |
| `IconButton.tsx` | `Button` | `rounded-full` + mapeamento de variantes visuais (`neutral`, `danger`, `success`) |
| `Skeleton.tsx` | — | Re-exports puro de `ui/skeleton.tsx` (compatibilidade retroativa) |

**Regra:** Para novo código, prefira importar de `@/components/ui/` quando possível. Os wrappers em `@/components/` são mantidos para compatibilidade com código existente.

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
| `useContasBills` | Carregamento de faturas, despesas por cartão, pagamentos |
| `useContasModals` | ~30 estados de modal + handlers de ação complexa |
| `useCalculatorKeyboard` | Atalhos de teclado para calculadora flutuante |
| `useCalculatorPanel` | Drag/resize do painel da calculadora |
| `useScrollToTop` | Scroll-to-top com pull gesture e haptics |

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
│   │   ├── investments/        # Componentes de investimentos e quantamental
│   │   │   ├── AssetDetailModal.tsx         # Detalhamento: scores, checklist quantitativo, gráfico
│   │   │   ├── AssetConfigModal.tsx         # Configuração: pricing mode, overrides manuais
│   │   │   ├── ScuttlebuttEvaluationModal.tsx # Avaliação qualitativa: pilares e perguntas
│   │   │   ├── SmartAporteSimulator.tsx     # Simulador de distribuição de aporte
│   │   │   ├── ExposureLimitsEditor.tsx     # Editor de metas de alocação por classe
│   │   │   ├── QuantPreferencesEditor.tsx   # Editor de tiers e thresholds
│   │   │   ├── HoldingsTable.tsx            # Tabela de posições com badges quantamental
│   │   │   └── ...                         # Demais componentes de investimentos
│   │   ├── reports/            # Componentes de relatórios
│   │   ├── dashboard/          # Componentes do dashboard
│   │   ├── settings/           # Componentes de configurações
│   │   ├── categories/         # Componentes de categorias
│   │   └── reconciliation/     # Componentes de reconciliação
│   │
│   ├── hooks/                  # Hooks customizados
│   │   ├── useSupabaseTable.ts  # Hook genérico CRUD (com configRef pattern)
│   │   ├── usePortfolioState.ts # Estado da carteira: motor quantamental + enquadramento
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
│   ├── services/               # Regras de negócio (fundamentalsService, priceService, etc.)
│   ├── types/                  # Contratos TypeScript de domínio
│   └── utils/                  # quantamentalEngine, assetClassifier, helpers
│
├── supabase/migrations/        # Migrations SQL (quantamental, scuttlebutt, etc.)
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
| TWR mensal | `portfolioTwrEngine.ts` | `Rm = (cota_fech / cota_abertura) - 1` (com `cota_abertura` obtida do fechamento do mês anterior) |

### Tabelas (migration `20260602140000_portfolio_returns_engine.sql`)

- `portfolio_share_daily` — histórico de cota
- `portfolio_period_snapshots` — fechamentos mensais/anuais
- `asset_price_daily`, `vna_daily` — séries de mercado e VNA

### Disparo no SPA

- Botão **Atualizar fechamento** em `Investments.tsx` → `usePortfolioClose().runClose`
- Futuro backend próprio deve importar as mesmas funções (`computeDailyClose` / `runDailyClose`) sem alterar contratos.

---

## 7.1 Motor Quantamental de Portfólio

O sistema quantamental avalia cada ativo de forma híbrida (qualitativa + quantitativa) e determina enquadramento, tiers de convicção e limites de exposição. A engine é 100% cliente-side, testável sem browser.

> Para detalhes completos da lógica de negócio, pontuação e algoritmo de roteamento, consulte o [blueprint-gestão-portifolio.md](../blueprint-gestão-portifolio.md).

### Módulos do Motor (`src/utils/quantamentalEngine.ts`)

| Função | Propósito |
|--------|-----------|
| `calculateScuttlebuttScore()` | Score qualitativo (0-100) com pilares ponderados e redistribuição de N/A |
| `calculateQuantitativeScore()` | Score quantitativo (0-100) por classe (Ações: 4 critérios, FIIs: 3, ETFs: 2) |
| `getQuantitativeScoreDetails()` | Retorna array detalhado de cada critério: nome, valor, pontos e status |
| `determineTier()` | Score → Tier (S ≥ 85 / A ≥ 70 / B ≥ 50 / C < 50) |
| `calculateAbsoluteLimit()` | `Target Classe × Limite Tier` → % máximo do ativo no portfólio |
| `determineEnquadramentoState()` | Comparação de % atual vs limite → em_linha / limite_atingido / excesso / obsoleto |
| `checkScuttlebuttDecay()` | Verifica expiração do timestamp da última avaliação qualitativa |
| `simulateSmartAporte()` | Roteamento inteligente de capital: defasagem macro → filtro micro → ordenação por qualidade → distribuição proporcional → travas setoriais → fallback caixa |

### Serviço de Fundamentos (`src/services/fundamentalsService.ts`)

| Função | Propósito |
|--------|-----------|
| `getMergedFundamentals()` | Mescla dados do cache da API (Yahoo Finance) com overrides manuais (`manual_*`) do usuário |
| `fetchAndCacheFundamentals()` | Busca indicadores atualizados via Yahoo Finance e persiste no `asset_fundamentals_cache` |

### Classificador de Ativos (`src/utils/assetClassifier.ts`)

Fonte única de verdade para classificação de tickers. Determina `asset_class`, `sector`, `currency` e `pricing_mode` a partir de heurísticas baseadas no código do ativo (B3, ETFs, BDRs, internacionais, renda fixa, cripto, caixa).

### Hook Principal (`src/hooks/usePortfolioState.ts`)

Orquestra toda a pipeline quantamental para cada ativo:
1. Carrega pilares, perguntas e respostas Scuttlebutt do Supabase.
2. Busca cache de fundamentos e definições com overrides.
3. Calcula score qualitativo, quantitativo e híbrido.
4. Determina tier, limite absoluto, estado de enquadramento e gaps.
5. Retorna `ValuedPosition[]` enriquecido com dados quantamentais para a UI.

### Tabelas do Supabase (Migrations)

| Migration | Tabelas Criadas |
|-----------|------------------|
| `20260628144200_quantamental_portfolio_management.sql` | `portfolio_quant_preferences`, `scuttlebutt_pillars`, `scuttlebutt_questions`, `scuttlebutt_answers`, `asset_fundamentals_cache` + campos `manual_*` em `portfolio_asset_definitions` |
| `20260628150300_extend_scuttlebutt_questions.sql` | Adiciona `portfolio_id` em `scuttlebutt_questions` para perguntas customizadas do usuário |

### Testes

- `quantamentalEngine.test.ts` — 4 testes: score Scuttlebutt (100%, redistribuição N/A), score quantitativo (ações excelentes) e simulação Smart Aporte (fallback caixa).

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
| — | **FloatingCalculator extraído** — 3 utils + 2 hooks (~462 linhas removidas) | Refatoração | ✅ |
| — | **Reports.tsx extraído** — 2 utils + 2 componentes (~633 linhas removidas) | Refatoração | ✅ |
| — | **Contas.tsx extraído** — 2 hooks (~377 linhas removidas) | Refatoração | ✅ |
| — | **FloatingActionHub extraído** — 1 hook + 1 util (~470 linhas removidas, ~90%) | Refatoração | ✅ |
| — | **Non-null assertions zeradas** — 13 ocorrências em Contas.tsx + IncomeFormModal.tsx | Segurança | ✅ |
| — | **`as any` zerado + genérico** — reportCustomData.ts com `<T extends { total: number }>` | Type Safety | ✅ |
| — | Teste de snapshot corrigido (PageHeader removido) | Correção | ✅ |
| — | **RowButton — ExpenseCategoryRowButton refatorado + PaymentRowButton removido** | Melhoria | ✅ |
| — | **Select custom → Radix UI (shadcn) — mantendo mesma API** | Melhoria | ✅ |
| — | **useEffect reduzido (FloatingCalculator ~14→11, Reports 2→1)** | Melhoria | ✅ |
| — | Documentação finalizada | Final | ✅ |
| — | **CSS class spacing bug (Settings.tsx) — `h - 2 w - 2` → `h-2 w-2 rounded-full`** | Bug Fix | ✅ |
| — | **CSS class spacing bug (Settings.tsx) — `rounded - lg border p - 3` → `rounded-lg border p-3`** | Bug Fix | ✅ |
| — | **ErrorBoundary inline style → `text-expense` class** | Melhoria | ✅ |
| — | **`as any` eliminado em usePortfolioState.ts (mergedFundamentals)** | Melhoria | ✅ |
| — | **`console.debug` → `logger.debug` em priceService.ts** | Consistência | ✅ |
| — | **`key={index}` → chaves estáveis em DatePicker.tsx e CreditCardTimeline.tsx** | Correção | ✅ |
| — | **Blank line extra entre imports em Reports.tsx removida** | Formatação | ✅ |
| — | **Compatibilidade com "IMOBILIÁRIO"** | Suporte unificado de FIIs em acentos e classificação | Melhoria | ✅ |
| — | **Saneamento total de hooks e dependências** | Correção de React Hook useCallback e useEffect deps no linter | Melhoria | ✅ |
| — | **Interação robusta FloatingCalculator & ScrollToTop** | Arrastar no touch, gestos de roda de scroll e callbacks robustos | Melhoria | ✅ |
| — | **Saneamento de types any em cache e reconciliação** | Substituição de explicit any por tipos fortemente tipados | Melhoria | ✅ |
| — | **Bug Fix — Select.Item value="" no Radix UI** | Uso de sentinel value `__empty__` no Select.tsx para evitar que opções com `value=""` causem erro no Radix Select.Item que rejeita strings vazias | Bug Fix | ✅ |
| — | **Componentes padronizados: FieldLabel e SectionHeader** | Criação de `FieldLabel.tsx` (uppercase, font-black, text-secondary) e `SectionHeader.tsx` (duas APIs: children+as+bordered e title+description+action). Migração de ~50 labels raw em 5 arquivos | Melhoria | ✅ |
| — | **NumberInput padronizado em todo o app** | Migração de `Input type="number"` para `NumberInput` com spin buttons em 7 arquivos (ExpenseFormModal, CardFormModal, CycleConfigModal, LimitSuggestionsModal, DebtFormModal, BillPaymentModal, CorrectionsMissingTab) | Melhoria | ✅ |
| — | **Overflow DECIMAL(15,2) no motor de rentabilidade** | Aumento de precisão de `DECIMAL(15,2)` para `DECIMAL(18,2)` em 12 colunas (migration). Adição de arredondamento defensivo (`round2`) antes do upsert em `portfolioTwrEngine.ts`, `portfolioHistoricalRecalc.ts` e `daily-close/index.ts` | Bug Fix | ✅ |

### Validação final

- ✅ Build: OK
- ✅ Typecheck: 0 erros
- ✅ Testes: 267/267 passando (30 arquivos)
- ✅ UI Guardrails: 0 violações
- ✅ `as any` em produção: 0
- ✅ Non-null assertions em produção: 0

### Melhorias adicionais (pós-refatoração)

- **RowButton extraído**: `ExpenseCategoryRowButton` refatorado para usar `RowButton` base. `PaymentRowButton` removido (wrapper vazio). `Contas.tsx` atualizado.
- **Select → Radix UI**: `Select.tsx` refatorado internamente para usar `@radix-ui/react-select` (shadcn), mantendo a mesma API externa. 19 consumidores inalterados. 4 snapshots atualizados.
- **useEffect reduzido**: FloatingCalculator ~14→11 effects (MutationObserver + resize unificado + localStorage unificado + keyboard com useRef). Reports.tsx: 2 effects de validação unificados.
- **Sistema de z-index unificado**: Implementação de CSS Custom Properties e constantes TypeScript para hierarquia padronizada. Todos os componentes migrados de valores hardcoded. Teste de consistência automatizado (16 testes).
- **Motor Quantamental**: Sistema completo de avaliação híbrida (Scuttlebutt + Fundamentos) com Tiers de convicção, enquadramento automático, Smart Aporte com log de roteamento, overrides manuais com alertas de contraste, decay trigger configurável, e checklist detalhado de critérios quantitativos por classe (Ações, FIIs, ETFs). Migrations SQL, 27 componentes de investimentos, 4 testes específicos do engine.
- **Bug Fix — CSS class spacing**: Settings.tsx — classes Tailwind com espaços entre hífens (`h - 2 w - 2`, `rounded - lg border p - 3`) corrompiam a renderização do indicador biométrico e do card de status.
- **Bug Fix — `any` type eliminado**: `let mergedFundamentals: any = null` → `ValuedPosition['fundamentals']` em `usePortfolioState.ts`.
- **Consistência — Logger**: `console.debug()` em `priceService.ts` substituído por `logger.debug()`.
- **Bug Fix — React keys**: `key={index}` removido em `DatePicker.tsx` (months + days) e `CreditCardTimeline.tsx` — chaves estáveis únicas agora.
- **Melhoria — Thema system**: `ErrorBoundary.tsx` — inline style substituído por classe `text-expense`.
- **Compatibilidade Completa de FIIs ("IMOBILIÁRIO")**: Unificação de classificação e regras de negócios no `assetClassifier.ts` e no motor quantamental para suportar de forma robusta e transparente o termo com ou sem acento ("IMOBILIÁRIO" / "IMOBILIARIO").
- **Saneamento Total do Linter**: Correção de todas as dependências ausentes/redundantes em hooks React, remoção de imports e variáveis redundantes em arquivos de testes e produção, e substituição de tipos `any` genéricos por tipos fortes nos serviços de investimentos (como `Omit<PortfolioTransaction, 'created_at'>[]` na inserção de lote), garantindo build 100% limpo com `--max-warnings 0`.
- **Aprimoramento de Controles Fáceis na UI**:
  - Correção no FloatingCalculator para arrastar em telas touch e impedir comportamentos inadequados de scroll do navegador.
  - Implementação de um manipulador de interrupção de scroll no ScrollToTopButton sob gestos físicos (wheel, touchstart, mousedown, keydown, etc.) com interrupção instantânea para uma experiência fluida.

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
| 150 | `Z_INDEX.POPOVER` | `z-[150]` | Popovers, tooltips, FABs de notificação |
| 200 | `Z_INDEX.FAB_HUB` | `z-[200]` | Hub de ações PageActionButtonHub |
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

> Este documento é um guia vivo. Consulte [`docs/REFINEMENT_MASTER_PLAN.md`](./REFINEMENT_MASTER_PLAN.md) para o plano consolidado de refatoração com todas as fases concluídas e pendentes.
