# Minhas Finanças — Guia Completo do Sistema

> **Versão:** 1.1.0 | **Última atualização:** Julho de 2026
> **Stack:** React 18 + TypeScript + Vite + Tailwind CSS + Supabase

---

## Índice

1. [Visão Geral](#1-visão-geral)
2. [Stack Tecnológica](#2-stack-tecnológica)
3. [Estrutura do Projeto](#3-estrutura-do-projeto)
4. [Páginas e Funcionalidades](#4-páginas-e-funcionalidades)
5. [Componentes de UI](#5-componentes-de-ui)
6. [Hooks Customizados](#6-hooks-customizados)
7. [Utils e Serviços](#7-utils-e-serviços)
8. [Motor Quantamental de Portfólio](#8-motor-quantamental-de-portfólio)
9. [Sistema de Banco de Dados (Supabase)](#9-sistema-de-banco-de-dados-supabase)
10. [Sistema de Z-Index (Hierarquia de Camadas)](#10-sistema-de-z-index-hierarquia-de-camadas)
11. [Sistema de Cores e Temas](#11-sistema-de-cores-e-temas)
12. [Estratégia Offline-First](#12-estratégia-offline-first)
13. [Arquitetura de Portfolio e Fechamento](#13-arquitetura-de-portfolio-e-fechamento)
14. [Configuração e Setup](#14-configuração-e-setup)
15. [Scripts de Verificação](#15-scripts-de-verificação)

---

## 1. Visão Geral

O **Minhas Finanças** é uma aplicação web **PWA (Progressive Web App)** de controle financeiro pessoal, projetada com foco em:

- **Simplicidade** — UX intuitiva e limpa
- **Offline-First** — Operação contínua sem internet
- **Consistência estética** — Design system glass-based com temas HSL
- **Análise avançada** — Motor quantamental híbrido para avaliação de investimentos

### Principais Funcionalidades

| Área | Funcionalidades |
|------|----------------|
| **Dashboard** | KPIs de rendas, despesas, investimentos e saldo; gráfico de fluxo diário; **Copiloto de IA** com sugestões inteligentes não-LLM, análise LLM via Gemini, gráficos interativos e análises fixadas; limites de gastos |
| **Despesas** | CRUD completo com parcelamento, competência de cartão de crédito, sincronização offline |
| **Rendas** | CRUD completo com suporte a estornos automáticos de cartões |
| **Investimentos** | Portfólio completo com motor quantamental (Scuttlebutt + Fundamentos), TWR, ledger, conciliação B3, Smart Aporte |
| **Cartões** | Gestão de faturas, conciliação CSV, estornos, ciclos de fechamento |
| **Dívidas** | Contas a pagar e receber com vínculo a despesas |
| **Categorias** | Planejamento de orçamentos (limites) e metas (expectativas) por categoria |
| **Relatórios** | Gráficos analíticos (pizza, evolução, fluxo, composição mensal, dia da semana) com modo mensal, anual e período customizado |
| **Configurações** | Temas (6 acentos × 2 paletas), calculadora flutuante, biometria, lembretes |

---

## 2. Stack Tecnológica

### Frontend

| Tecnologia | Versão | Uso |
|------------|--------|-----|
| React | ^18.2.0 | UI Library |
| TypeScript | ^5.2.2 | Type Safety |
| Vite | ^5.0.0 | Build tool |
| Tailwind CSS | ^3.3.5 | Estilização utilitária |
| Recharts | ^2.15.4 | Gráficos analíticos |
| Framer Motion | ^11.18.2 | Animações |
| Lucide React | ^0.294.0 | Ícones |
| React Router DOM | ^6.20.0 | Roteamento SPA |
| React Hot Toast | ^2.6.0 | Notificações toast |
| date-fns | ^2.30.0 | Manipulação de datas |
| xlsx | ^0.18.5 | Leitura de arquivos Excel (conciliação B3/CSV) |

### Radix UI (shadcn/ui)

| Componente | Uso |
|------------|-----|
| `@radix-ui/react-checkbox` | Checkbox estilizado |
| `@radix-ui/react-dialog` | Modal/Dialog |
| `@radix-ui/react-dropdown-menu` | Dropdown menus |
| `@radix-ui/react-label` | Labels de formulário |
| `@radix-ui/react-select` | Select estilizado |
| `@radix-ui/react-switch` | Switch toggle |
| `@radix-ui/react-tabs` | Abas de navegação |
| `@radix-ui/react-tooltip` | Tooltips |

### Backend

| Tecnologia | Uso |
|------------|-----|
| Supabase | Database PostgreSQL + Auth + Realtime subscriptions |
| Supabase Edge Functions | Funções serverless (daily-close) |

### Testes

| Tecnologia | Uso |
|------------|-----|
| Vitest | Test runner |
| Testing Library | Testes de componentes React |

---

## 3. Estrutura do Projeto

```text
├── database/                        # Modelagem do Banco de Dados
│   ├── database.sql                 # Estrutura base completa
│   ├── schema.sql                   # Schema DDL limpo
│   ├── migrations/                  # Migrations legadas
│   └── samples/                     # CSVs de amostra
│
├── docs/                            # Documentação
│   ├── ARCHITECTURE.md              # Arquitetura detalhada
│   ├── AUDITORIA_REVISAO.md         # Auditoria técnica
│   ├── COMPLETE_GUIDE.md            # Este guia
│   ├── IMPROVEMENT_PLAN.md          # Plano de melhorias
│   ├── REFACTORING_PLAN.md          # Plano de refatoração
│   ├── REFINEMENT_PLAN.md           # Plano de refinamento UI/UX
│   ├── NEXT_STEPS.md                # Próximos passos e pendências
│   ├── REIMPORT_INVESTMENTS.md      # Reimportação B3
│   └── ui/                          # Governança visual
│       ├── GOVERNANCA_UI.md
│       └── guardrails-baseline.json
│
├── scripts/                         # Scripts auxiliares
│   ├── check_shares.mjs
│   ├── ui-guardrails.mjs
│   └── query_db.mjs
│
├── src/
│   ├── main.tsx                     # Entry point
│   ├── App.tsx                      # Router + Providers
│   ├── index.css                    # Estilos globais + tema
│   │
│   ├── components/                  # Componentes de UI
│   │   ├── ui/                      # shadcn/ui primitives
│   │   ├── categories/              # Categorias (form, delete, limits)
│   │   ├── creditCards/             # Cartão de crédito (timeline, modais)
│   │   ├── dashboard/               # Dashboard (KPIs, charts)
│   │   ├── debts/                   # Dívidas (form, action modals)
│   │   ├── investments/             # Investimentos (completo)
│   │   │   ├── reconciliation/      # Etapas da conciliação B3
│   │   │   └── ...                  # Holdings, charts, modals
│   │   ├── reconciliation/          # Componentes de reconciliação
│   │   ├── reports/                 # Gráficos de relatórios
│   │   └── settings/                # Configurações visuais
│   │
│   ├── hooks/                       # Hooks customizados
│   ├── utils/                       # Funções utilitárias
│   ├── services/                    # Regras de negócio e APIs
│   ├── types/                       # Tipos TypeScript
│   ├── contexts/                    # Context providers
│   ├── constants/                   # Constantes globais
│   ├── lib/                         # Config (supabase, utils)
│   └── styles/                      # CSS tokens
│
├── supabase/migrations/             # Migrations SQL (cronológicas)
├── public/                          # Static assets
└── ...config files                  # vite.config, tailwind.config, etc.
```

---

## 4. Páginas e Funcionalidades

### 4.1 Mapa de Rotas

| Rota | Página | Descrição |
|------|--------|-----------|
| `/` | Dashboard | KPIs, gráfico fluxo diário, insights, orçamentos |
| `/despesas` | Expenses | CRUD despesas com parcelamento |
| `/rendas` | Incomes | CRUD rendas com estornos |
| `/investimentos` | Investments | Portfólio, holdings, ledger, TWR, conciliação B3 |
| `/contas` | Contas | Cartões, faturas, dívidas a pagar/receber |
| `/categorias` | Categories | Orçamentos (limites) e Metas (expectativas) |
| `/categorias-despesa` | ExpenseCategories | CRUD categorias de despesa |
| `/categorias-renda` | IncomeCategories | CRUD categorias de renda |
| `/relatorios` | Reports | Relatórios analíticos mensais/anuais/período |
| `/configuracoes` | Settings | Temas, biometria, calculadora, lembretes |
| `/login` | Login | Autenticação |
| `/cadastro` | Register | Registro |
| `/recuperar-senha` | ForgotPassword | Recuperação de senha |
| `/redefinir-senha` | ResetPassword | Redefinição de senha |
| `/onboarding` | OnboardingCategories | Primeiras categorias após cadastro |

### 4.2 Dashboard (`/`)

- **KPIs**: Rendas, Despesas, Investimentos, Saldo com glow dinâmico e sparklines
- **Copiloto de IA**:
  - Campo de pergunta para IA com suporte a lançamentos via linguagem natural
  - **Sugestões inteligentes não-LLM**: 7 tipos de insights baseados em dados reais (limites estourados, taxa de poupança, variação de despesas, categoria de maior custo, pico semanal, taxa de investimento, taxa de consumo) com priorização por criticidade
  - Cards clicáveis de detalhamento dos insights que enviam consultas específicas à IA
  - Análise fixada (pinned) com persistência no Supabase e botão de atualização
  - Gráfico interativo gerado pela IA (barras, rosca, comparativo)
  - Bloco integrado de **Gasto Disponível** (mensal + diário) e **Ajustes e Otimizações** (remanejamento de limites)
- **Gráfico fluxo diário**: Barras empilhadas (rendas/despesas/investimentos por dia)
- **Insights financeiros**: Cards com dicas e alertas
- **Limites/Orçamentos**: Cards de progresso por categoria
- **Ações flutuantes**: Navegação rápida para despesas, rendas, investimentos

### 4.3 Despesas (`/despesas`)

- Lista por mês com navegação por swipe
- Formulário completo: valor, peso relatório, data, categoria, forma pagamento, cartão, descrição
- **Parcelamento**: Até 60x com geração automática de parcelas e competência de cartão
- Exclusão: Single, All, Subsequent
- Modais adaptáveis: Sheet (mobile) / Dialog (desktop)
- Sincronização offline completa

### 4.4 Rendas (`/rendas`)

- Lista por mês com navegação por swipe
- Formulário completo: valor, peso relatório, data, categoria, tipo (dinheiro/PIX/transferência/outros), descrição
- **Estornos automáticos**: Rendas criadas automaticamente por estornos de cartão de crédito
- Sincronização offline completa

### 4.5 Investimentos (`/investimentos`)

#### Visões

| Aba | Funcionalidade |
|-----|---------------|
| **Visão Geral** | KPIs (Patrimônio, Rentabilidade, Aportes, Dividendos), gráfico de evolução (TWR vs CDI/IPCA), pizza por classe, pizza por setor, pizza por moeda, insights |
| **Ativos** | Tabela de holdings com badges quantamentais (Tier S/A/B/C, enquadramento) |
| **Razão** | Ledger completo com entradas/saídas por ativo |

#### Funcionalidades Específicas

- **Transações**: CRUD de operações (buy/sell/dividend/jcp/fii_yield/split/reverse_split/subscription)
- **Conciliação B3**: Upload de extrato `.xlsx` com matching automático de posições
- **Asset Config**: Pricing mode (market/fixed_income/manual_value/cash), overrides manuais de fundamentos, moeda
- **Avaliação Scuttlebutt**: Questionário qualitativo com pilares customizáveis e pesos
- **Smart Aporte**: Simulador de distribuição inteligente de capital
- **Exposure Limits**: Metas de alocação por classe e setor com travas
- **Quant Preferences**: Configuração de tiers e thresholds

### 4.6 Contas (`/contas`)

| Aba | Funcionalidade |
|-----|---------------|
| **Faturas** | Timeline de faturas por cartão, com despesas, pagamentos e estornos |
| **Dívidas** | Contas a pagar e receber com status pendente/pago |
| **Conciliação CSV** | Upload de extrato CSV da operadora do cartão |

### 4.7 Categorias (`/categorias`)

| Aba | Funcionalidade |
|-----|---------------|
| **Orçamentos (Despesas)** | KPIs de limites, grid de categorias com progresso, input inline de limite, sugestão baseada em % da renda |
| **Metas (Rendas)** | KPIs de expectativas, grid de categorias com progresso |

- Modal de sugestões de limites baseado em regras por nome de categoria
- CRUD completo de categorias com exclusão e migração de dados

### 4.8 Relatórios (`/relatorios`)

| Modo | Funcionalidade |
|------|---------------|
| **Mensal** | KPIs, pizza por categoria (despesa/renda/pagamento), fluxo diário consolidado, distribuição semanal, composição mensal |
| **Anual** | KPIs anuais, fluxo mensal, saldo acumulado, evolução por categoria, comparativo com ano anterior |
| **Período Customizado** | Similar ao mensal/anual mas com datas definidas pelo usuário |

- Comparação histórica (mês/ano anterior)
- Peso de relevância (`report_weight`) para ajuste de impacto

### 4.9 Configurações (`/configuracoes`)

- **Tema**: 6 acentos (blue/emerald/violet/amber/rose/teal), 2 paletas (vivid/monochrome), 3 modos (light/dark/midnight)
- **Calculadora flutuante**: Ativar/absorver nas ações
- **Biometria**: Trava de segurança por biometria
- **Lembretes**: Alertas para dívidas e faturas próximas

---

## 5. Componentes de UI

### 5.1 Primitives (shadcn/ui)

Localizados em `src/components/ui/`: `button`, `card`, `input`, `select`, `switch`, `checkbox`, `dialog`, `sheet`, `tabs`, `badge`, `label`, `table`, `skeleton`.

### 5.2 Wrappers Customizados

| Componente | Arquivo | Descrição |
|------------|---------|-----------|
| `Button` | `Button.tsx` | Wrapper com `variantMap` + `sizeMap` (inclui `size="icon"`) |
| `Card` | `Card.tsx` | Wrapper com glass + clickable states |
| `Input` | `Input.tsx` | Wrapper com label + error + suporte a DatePicker |
| `Select` | `Select.tsx` | Wrapper sobre Radix UI, mesma API |
| `Checkbox` | `Checkbox.tsx` | Checkbox com label |
| `Switch` | `Switch.tsx` | Switch toggle com label |
| `IconButton` | `IconButton.tsx` | Botão de ícone padronizado |

### 5.3 Modais

| Componente | Uso |
|------------|-----|
| `Modal` | Modal genérico com sheet (mobile) / dialog (desktop) |
| `ModalForm` | Modal com formulário e footer |
| `ModalFooter` | Footer com submit/cancel/delete |
| `ConfirmModal` | Confirmação com checkbox opcional |
| `ModalChoiceGrid` | Grid de opções |
| `ModalFieldRow` | Linha de campo em formulário |
| `ModalInfoPanel` | Painel informativo |
| `ModalSummaryPanel` | Painel de resumo |
| `ModalIntro` | Tela introdutória |

### 5.4 Formulários de Transação

| Componente | Função |
|------------|--------|
| `TransactionAmountFields` | Par de inputs (valor + peso relatório) com sincronização |
| `TransactionDateField` | Input de data padronizado |
| `TransactionCategorySelect` | Select de categoria |
| `TransactionDescriptionField` | Input de descrição |
| `ExpenseFormModal` | Modal completo de despesas |
| `IncomeFormModal` | Modal completo de rendas |

### 5.5 Componentes Flutuantes

| Componente | Função |
|------------|--------|
| `FloatingActionHub` | Portal único unificando ScrollToTop + NotificationsWidget (~50 linhas, 4 useEffects) |
| `FloatingCalculator` | Calculadora científica flutuante (drag, resize) — lógica extraída (~1.107 linhas) |
| `FloatingSideStack` | Painel lateral direito para ações |
| `PageActionButtonHub` | Botão FAB de ações da página atual |
| `PageHeaderActions` | Ações renderizadas pelo `usePageActions` |
| `ReportPendingDebtsWidget` | Widget de projeção de pendências financeiras |
| `ReportUnifiedCompositionCard` | Card de composição detalhada de relatórios |

### 5.6 Dashboard

| Componente | Função |
|------------|--------|
| `DashboardKpis` | Grade de 4 KPIs (Rendas, Despesas, Investimentos, Saldo) |
| `KpiCard` | Card individual com ícone, glow e ferramentas |
| `DailyFlowChart` | Gráfico de fluxo diário |
| `MonthlyOverviewChart` | Evolução mensal |
| `DailyBudgetAdvisor` | Orçamento diário sugerido |
| `LimitsControl` | Controle de limites por categoria |
| `FinancialInsights` | Cards de insights mensais |
| `BeautifulMarkdown` | Renderização de markdown com destaque para valores monetários |
| `InteractiveAIChart` | Gráfico interativo gerado pela IA (barras, rosca, comparativo) |

### 5.7 Investimentos

| Componente | Função |
|------------|--------|
| `PortfolioKpiBar` | 4 KPIs: Patrimônio, Rentabilidade, Aportes, Dividendos |
| `HoldingsTable` | Tabela de posições com badges quantamentais |
| `LedgerBook` | Razão contábil do portfólio |
| `EvolutionChart` | Gráfico TWR vs Benchmarks |
| `PortfolioPieChart` | Pizza por classe/setor/moeda |
| `PieChartsSection` | Seção com 3 pizzas lado a lado |
| `MonthlySummaryCard` | Resumo mensal da carteira |
| `AssetDetailModal` | Detalhamento: scores, checklist, enquadramento |
| `AssetConfigModal` | Configuração de ativo (pricing mode, overrides) |
| `ExposureLimitsEditor` | Metas de alocação |
| `SmartAporteSimulator` | Simulador de aporte inteligente |
| `InvestmentReconciliationModal` | Conciliação B3 (6 etapas) |

### 5.8 Layout

| Componente | Função |
|------------|--------|
| `Layout` | Bottom nav (mobile) + sidebar colapsável (desktop) |
| `MonthSelector` | Seletor de mês com setas |
| `YearSelector` | Seletor de ano |
| `MonthTransitionView` | Animação de transição entre meses |
| `Skeleton` | 7 variantes de skeleton loading |

---

## 6. Hooks Customizados

### 6.1 Hooks de Dados

| Hook | Função | Base |
|------|--------|------|
| `useSupabaseTable<T>` | Hook genérico CRUD com cache, offline, realtime | Genérico |
| `useExpenses(month?)` | CRUD despesas com parcelamento e competência | Manual |
| `useIncomes(month?)` | CRUD rendas | Manual |
| `useDebts` | CRUD dívidas com join expenses | Manual |
| `useCreditCards` | CRUD cartões | `useSupabaseTable` |
| `useCategories` | CRUD categorias despesa | `useSupabaseTable` |
| `useIncomeCategories` | CRUD categorias renda | `useSupabaseTable` |
| `useExpenseCategoryLimits(month)` | Limites mensais de despesa | Próprio |
| `useIncomeCategoryExpectations(month)` | Expectativas mensais de renda | Próprio |
| `useReports(year, includeWeights)` | Relatórios de despesa anuais | Próprio |
| `useIncomeReports(year, includeWeights)` | Relatórios de renda anuais | Próprio |
| `usePortfolioState` | Estado completo da carteira + motor quantamental | Próprio |

### 6.2 Hooks de UI

| Hook | Função |
|------|--------|
| `usePageActions(actions)` | Registra ações flutuantes na página atual |
| `useFloatingActions` | Consome ações flutuantes registradas |
| `useSwipeMonth(value, setter)` | Navegação por swipe entre meses |
| `useSwipeYear(value, setter)` | Navegação por swipe entre anos |
| `useFormAmountSync` | Sincroniza amount/report_amount em formulários |
| `useMediaQuery(query)` | Detecta media query |
| `usePaletteColors` | Paleta de cores atual (vivid/monochrome) |
| `useTheme` | Tema atual (light/dark/midnight) |
| `useNetworkStatus` | Estado de conectividade |
| `useBackgroundCache(key, fetcher)` | Cache em background |
| `useContasBills` | Carregamento de faturas e despesas por cartão |
| `useContasModals` | Estado de modais da página Contas |
| `useCalculatorKeyboard` | Atalhos de teclado da calculadora flutuante |
| `useCalculatorPanel` | Drag/resize do painel da calculadora |
| `useScrollToTop` | Scroll-to-top com pull gesture e haptics |

### 6.3 Hooks de Configuração

| Hook | Função |
|------|--------|
| `useAppSettings` | Configurações do app com `useReducer` |
| `useReconciliationState` | Estado da máquina de reconciliação |
| `useReconciliationDrafts` | Rascunhos de reconciliação |
| `useReconciliationActions` | Ações de reconciliação |
| `useReconciliationFiles` | Arquivos de reconciliação |

---

## 7. Utils e Serviços

### 7.1 Utilitários Core

| Arquivo | Funções |
|---------|---------|
| `format.ts` | `formatCurrency`, `formatDate`, `formatMonth`, `formatMoneyInput`, `parseMoneyInput`, `addMonths`, etc. |
| `calculator.ts` | `isCalculatorElement` |
| `calculatorExpression.ts` | Avaliação de expressões matemáticas |
| `calculatorGeometry.ts` | Geometria do painel da calculadora |
| `calculatorDom.ts` | Utilitários DOM para calculadora |
| `logger.ts` | Logger condicional (debug/info suprimidos em produção) |
| `reportAggregation.ts` | Funções de agregação de relatórios |
| `reportCustomData.ts` | Funções de período customizado de relatórios |
| `haptics.ts` | Vibração haptic multi-stage |
| `errorMessage.ts` | Mensagens de erro padronizadas |
| `categoryColors.ts` | Sistema de paletas de cores (vivid/monochrome) |
| `categoryIcons.tsx` | Ícones por nome de categoria |
| `colorValue.ts` | Utilitários de cor |
| `assetClassifier.ts` | Classificador de ativos (B3, ETFs, BDRs, etc.) |
| `biometric.ts` | Autenticação biométrica |
| `businessDays.ts` | Dias úteis |
| `offlineQueue.ts` | Fila de operações offline |
| `profileDisplayName.ts` | Nome de exibição do perfil |
| `reportWeight.ts` | `getWeightedReportAmount` para ajuste por peso |
| `solar.ts` | Utilitários solares |

### 7.2 Utilitários Financeiros

| Arquivo | Funções |
|---------|---------|
| `creditCardBilling.ts` | `resolveBillCompetence`, `splitAmountIntoInstallments`, lógica de fatura |
| `creditCardCsvReconciliation.ts` | Conciliação de CSV da operadora |
| `creditCardMonthSelection.ts` | Seleção de mês de fatura |
| `expenseInstallments.ts` | `buildInstallmentDates`, `generateInstallmentPayloads` |
| `cashBalanceApplication.ts` | Aplicação de saldo em caixa em transações de portfólio |
| `fixedIncomeCurve.ts` | Valoração de renda fixa na curva |
| `investmentExcelReconciliation.ts` | Conciliação de extrato B3 Excel |
| `investmentReconciliation.ts` | Lógica de reconciliação de investimentos |
| `positionValidation.ts` | Validação de posições |

### 7.3 Utilitários de Portfolio

| Arquivo | Funções |
|---------|---------|
| `portfolioCalculations.ts` | Cálculos de snapshot, split adjustment, TWR base |
| `portfolioLedger.ts` | Ledger de posições (quantidade, custo, dividendos) |
| `portfolioMonthlyFlow.ts` | Fluxo mensal de investimentos |
| `portfolioOperations.ts` | Operações de portfólio |
| `portfolioTwrEngine.ts` | Motor TWR avançado com cota |
| `portfolioBenchmarks.ts` | Benchmarks (CDI, IPCA) |
| `quantamentalEngine.ts` | Motor quantamental completo |

### 7.4 Serviços

| Arquivo | Funções |
|---------|---------|
| `priceService.ts` | Preços de ativos (Yahoo Finance, cache, fallbacks) |
| `cashOffsetService.ts` | Cash offset automático (compra/venda/provento) |
| `portfolioHistoricalRecalc.ts` | Recalculo histórico TWR client-side |
| `portfolioOrphanCleanup.ts` | Limpeza de órfãos de portfólio |
| `indexRatesFetcher.ts` | Taxas de índice (CDI, Selic, IPCA) |
| `offlineCache.ts` | Cache offline |

---

## 8. Motor Quantamental de Portfólio

### 8.1 Visão Geral

O motor quantamental avalia cada ativo de forma **híbrida** (qualitativa + quantitativa) para determinar:

- **Score de qualidade** (0-100)
- **Tier de convicção** (S/A/B/C)
- **Enquadramento** (em linha / limite atingido / desenquadrado)
- **Limites de exposição** por ativo, classe e setor

### 8.2 Componentes do Motor

| Componente | Função |
|------------|--------|
| `src/utils/quantamentalEngine.ts` | Engine pura (testável sem browser) |
| `src/hooks/usePortfolioState.ts` | Orquestração dos dados e integração Supabase |
| `src/services/fundamentalsService.ts` | Busca e cache de fundamentos via Yahoo Finance |
| `src/utils/assetClassifier.ts` | Classificação de ativos por ticker |

### 8.3 Avaliação Qualitativa (Scuttlebutt)

- **Pilares**: Categorias de avaliação com pesos configuráveis (ex: Vantagens Competitivas, Gestão, Saúde Financeira)
- **Perguntas**: Questões editáveis dentro de cada pilar
- **Respostas**: `yes` / `no` / `na` (N/A não penaliza)
- **Score**: `(pesos_ganhos / pesos_ativos) × 100`
- **Decay**: Configurável (90/180/365 dias) — após expirar, ativo fica `desenquadrado_obsoleto`

### 8.4 Avaliação Quantitativa (Fundamentos)

| Classe | Critérios | Pontuação Máxima |
|--------|-----------|-----------------|
| **Ações** | ROIC, Dívida/EBITDA, Valuation vs Histórico, Tendência Endividamento | 100 pts |
| **FIIs** | Dividend Yield, P/VP, Vacância | 100 pts |
| **ETFs** | Taxa Administração, Tracking Error | 100 pts |
| **Outros** | Sempre 100 (não se aplica) | 100 pts |

### 8.5 Tiers e Limites

| Tier | Score | Fator de Limite |
|------|-------|-----------------|
| S | ≥ 85 | Configurável (ex: 20%) |
| A | ≥ 70 | Configurável (ex: 15%) |
| B | ≥ 50 | Configurável (ex: 10%) |
| C | < 50 | Configurável (ex: 5%) |

### 8.6 Smart Aporte

O simulador de aporte inteligente segue o pipeline:

1. **Defasagem macro**: Identifica classes abaixo do target
2. **Filtro por classe**: Ativos elegíveis (em linha, não cash, sem decay)
3. **Ordenação**: Por score de qualidade descendente
4. **Distribuição**: Por limite absoluto do ativo e travas setoriais
5. **Fallback**: Sobra vai para caixa/reserva
6. **Log**: Roteamento completo exibido ao usuário

---

## 9. Sistema de Banco de Dados (Supabase)

### 9.1 Schema Principal

| Tabela | Finalidade |
|--------|------------|
| `profiles` | Perfil do usuário (role, approval, bloqueio) |
| `categories` | Categorias de despesa |
| `income_categories` | Categorias de renda |
| `expenses` | Despesas com parcelamento e cartão |
| `incomes` | Rendas |
| `credit_cards` | Cartões de crédito |
| `credit_card_bill_payments` | Pagamentos de faturas |
| `credit_card_monthly_cycles` | Ciclos mensais de fechamento |
| `debts` | Contas a pagar e receber |
| `expense_category_month_limits` | Limites mensais por categoria de despesa |
| `income_category_month_expectations` | Expectativas mensais por categoria de renda |

### 9.2 Schema de Portfolio

| Tabela | Finalidade |
|--------|------------|
| `portfolios` | Carteiras de investimento (cliente × consultor) |
| `portfolio_transactions` | Transações da carteira |
| `portfolio_asset_definitions` | Definições de ativos (pricing mode, indexer, overrides) |
| `portfolio_group_targets` | Metas de alocação por classe/setor |
| `portfolio_share_daily` | Histórico diário de cota |
| `portfolio_period_snapshots` | Snapshots mensais/anuais |
| `portfolio_quant_preferences` | Preferências quantamentais |
| `target_allocations` | Alocações alvo por ticker |
| `asset_prices` | Preços correntes dos ativos |
| `asset_price_daily` | Série histórica de preços |
| `index_rates` | Taxas de índices (CDI, Selic, IPCA) |
| `vna_daily` | Série histórica de VNA |

### 9.3 Schema Quantamental

| Tabela | Finalidade |
|--------|------------|
| `scuttlebutt_pillars` | Pilares da avaliação qualitativa |
| `scuttlebutt_questions` | Perguntas do Scuttlebutt |
| `scuttlebutt_answers` | Respostas por ativo |
| `asset_fundamentals_cache` | Cache de fundamentos (Yahoo Finance) |

### 9.4 Migrations

As migrations estão em `supabase/migrations/` organizadas cronologicamente (prefixo `YYYYMMDD`). As principais:

| Migration | Conteúdo |
|-----------|----------|
| `20260523_master_investments_and_consulting_consolidated.sql` | Estrutura base de investimentos + consultoria |
| `20260602140000_portfolio_returns_engine.sql` | Motor de retornos (cota, TWR) |
| `20260613143000_create_debts.sql` | Tabela de dívidas |
| `20260611172200_add_icon_to_categories.sql` | Ícones em categorias |
| `20260622140200_add_cash_and_invested_columns.sql` | Colunas de caixa/investido |

---

## 10. Sistema de Z-Index (Hierarquia de Camadas)

O sistema de z-index é centralizado para evitar bugs de sobreposição.

### Níveis

| Nível | Constante | Classe CSS | Uso |
|-------|-----------|------------|-----|
| 0 | `Z_INDEX.BASE` | `z-0` | App shell glow, backgrounds |
| 1 | `Z_INDEX.DECORATION` | `z-[1]` | Elementos decorativos |
| 10 | `Z_INDEX.CONTENT` | `z-10` | Conteúdo principal |
| 30 | `Z_INDEX.STICKY` | `z-30` | Elementos elevados temporários |
| 100 | `Z_INDEX.NAVIGATION` | `z-[100]` | Bottom nav, sidebar |
| 150 | `Z_INDEX.POPOVER` | `z-[150]` | Tooltips, popovers |
| 200 | `Z_INDEX.FAB_HUB` | `z-[200]` | Hub de ações FAB |
| 900 | `Z_INDEX.OVERLAY` | `z-[900]` | Overlay de modal |
| 1000 | `Z_INDEX.MODAL` | `z-[1000]` | Modal padrão |
| 1100 | `Z_INDEX.SIDE_STACK` | `z-[1100]` | Stack lateral flutuante |
| 1200 | `Z_INDEX.ELEVATED` | `z-[1200]` | Modal elevado |
| 1300 | `Z_INDEX.CALCULATOR` | `z-[1300]` | Calculadora flutuante |
| 1400 | `Z_INDEX.TOAST` | `z-[1400]` | Toasts e notificações |
| 9999 | `Z_INDEX.PRINT` | `z-[9999]` | Impressão |

### Arquivos de Definição

- `src/constants/zIndex.ts` — Constantes TypeScript
- `src/styles/theme-tokens.css` — CSS Custom Properties (`--z-*`)
- Teste de consistência: `src/constants/zIndex.test.ts`

---

## 11. Sistema de Cores e Temas

### 11.1 Modos

| Modo | Descrição |
|------|-----------|
| `light` | Fundo claro, texto escuro |
| `dark` | Fundo escuro, texto claro |
| `midnight` | Fundo muito escuro (azul profundo) |

### 11.2 Acents

| Acento | Cor Primária |
|--------|-------------|
| Blue | Azul padrão |
| Emerald | Verde esmeralda |
| Violet | Roxo |
| Amber | Âmbar/laranja |
| Rose | Rosa |
| Teal | Verde azulado |

### 11.3 Paletas de Categoria

| Paleta | Cores | Uso |
|--------|-------|-----|
| `vivid` | 20 cores vibrantes | Categorias de despesa/renda |
| `monochrome` | 24 tons neutros | Modo minimalista |

---

## 12. Estratégia Offline-First

### 12.1 Leitura

- Todas as listagens usam cache do `localStorage`
- Cache atualizado em segundo plano quando online
- Leitura do cache quando offline

### 12.2 Escrita (Fila de Mutações)

1. Mutação sem conexão é capturada pelo `useOfflineQueue`
2. Recebe ID provisório (`offline-{timestamp}`)
3. Ação serializada no `localStorage`
4. Evento `local-data-changed` dispara atualização imediata da UI
5. Quando a internet volta, a fila é sincronizada na ordem cronológica

### 12.3 Componentes Offline

| Componente | Função |
|------------|--------|
| `OfflineSyncManager` | Gerencia sincronização da fila |
| `NetworkStatusToast` | Toast de status offline |
| `SupabaseWarning` | Aviso de conectividade com Supabase |

---

## 13. Arquitetura de Portfolio e Fechamento

### 13.1 Pipeline de Fechamento

O fechamento patrimonial é calculado em TypeScript puro (testável sem browser):

```
Entrada (DailyCloseInput):
  - portfolioId, transactions, definitions, targets
  - prices, cashBalance, indexRatesByIndexer, asOfDate?

Saída (DailyCloseResult):
  - grossPl, netPl, shareValue, totalShares, lotCount
```

### 13.2 Módulos de Valoração

| Ativo | Fonte | Regra |
|-------|-------|-------|
| Mercado (RV) | Yahoo Finance | Guard de spike 50% → Last Known Value |
| RF / Tesouro | Curva | Pré: 252 DU; IPCA+: fator VNA |
| Caixa | applied_amount | Valor direto |
| Manual | manual_current_value | Valor informado pelo usuário |

### 13.3 TWR (Time Weighted Return)

- Cota base: 1.00 (0.00%)
- Desconsidera entradas/saídas de caixa
- Benchmarks: CDI, IPCA

---

## 14. Configuração e Setup

### 14.1 Pré-requisitos

- Node.js 18+
- npm 9+
- Conta Supabase (gratuita)

### 14.2 Instalação

```bash
npm install
```

### 14.3 Variáveis de Ambiente

Crie `.env` na raiz:

```env
VITE_SUPABASE_URL=https://seu-projeto.supabase.co
VITE_SUPABASE_ANON_KEY=sua-chave-anonima-supabase
VITE_YAHOO_FINANCE_API_KEY=sua-chave-api
```

### 14.4 Setup do Banco

1. Abra o SQL Editor do Supabase
2. Execute `database/database.sql`
3. Execute as migrations em `supabase/migrations/` na ordem cronológica

### 14.5 Executar

```bash
npm run dev       # Desenvolvimento
npm run build     # Produção
npm run preview   # Preview do build
```

---

## 15. Scripts de Verificação

| Script | Comando | Descrição |
|--------|---------|-----------|
| Dev | `npm run dev` | Ambiente de desenvolvimento |
| Build | `npm run build` | Typecheck + Vite build |
| Test | `npm run test:run` | 267 testes Vitest |
| UI Guardrails | `npm run guardrails:ui` | Validação de estilos |
| Lint | `npm run lint` | Guardrails + ESLint |

---

## Apêndice: Métricas do Projeto

| Métrica | Valor |
|---------|-------|
| TypeScript errors | **0** |
| Testes passando | **267/267** (30 arquivos) |
| UI Guardrails | **0 violações** |
| `as any` em produção | **0** |
| `as any` em assinaturas de função | **0** |
| Non-null assertions em produção | **0** |
| `catch(err: any)` | **0** |
| `console.log` em produção | **0** (via logger condicional) |
| Maior arquivo | **2.276 linhas** (Reports.tsx) |
| Total componentes | **130+** |
| Total hooks | **35+** |
| Total migrations | **43** |
| Novos arquivos (última sessão) | **14** |

---

> **Documentos relacionados:** [`ARCHITECTURE.md`](./ARCHITECTURE.md) — [`REFACTORING_PLAN.md`](./REFACTORING_PLAN.md) — [`IMPROVEMENT_PLAN.md`](./IMPROVEMENT_PLAN.md) — [`AUDITORIA_REVISAO.md`](./AUDITORIA_REVISAO.md)
