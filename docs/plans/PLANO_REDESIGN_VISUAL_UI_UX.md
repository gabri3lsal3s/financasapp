# 🏦 Plano de Redesign Visual UI/UX — Fintech Minimalista & Obsidian Glass (v4.0 Calibrado)

> **Documento Estratégico de Redesign Visual, Ergonomia e Design System**  
> **Versão:** 4.0 — calibrada ao estado real do repositório (12/08/2026)  
> **Conceito:** Fintech Minimalista de Alta Precisão (*Apple Wallet, Nubank Ultravioleta, Revolut, Wise, Linear*).  
> **Base já concluída:** Plano Mestre de Refatoração (fases 0–6 ✅) + Auditoria de Limpeza A→D (✅). Este plano é a **camada visual/UX** sobre essa base — **nada é refeito, tudo é estendido**.  
> **Escopo:** 100% do app (10 módulos, incluindo Investimentos e Auth/Onboarding).

---

## 📑 Índice

0. [Contexto — O que já foi feito (não refazer)](#0-contexto--o-que-já-foi-feito-não-refazer)
1. [Diretrizes de Design & Decisões Homologadas](#1-diretrizes-de-design--decisões-homologadas)
2. [Fundação Visual — Calibrar Tokens (não recriar)](#2-fundação-visual--calibrar-tokens-não-recriar)
3. [Moldura Global: Shell, FAB, Busca e Calculadora](#3-moldura-global-shell-fab-busca-e-calculadora)
4. [Redesign Detalhado Página por Página (10 módulos)](#4-redesign-detalhado-página-por-página-10-módulos)
5. [Padronização Global de Bottom Sheets (DRY)](#5-padronização-global-de-bottom-sheets-dry)
6. [Diagnóstico de Fragilidades & Mitigações (F1–F8)](#6-diagnóstico-de-fragilidades--mitigações-f1f8)
7. [Mapeamento Completo de Arquivos (paths reais)](#7-mapeamento-completo-de-arquivos-paths-reais)
8. [Roteiro de Implementação — 7 Fases (R1–R7)](#8-roteiro-de-implementação--7-fases-r1r7)
9. [Salvaguardas & Protocolo de Qualidade](#9-salvaguardas--protocolo-de-qualidade)

---

## 0. Contexto — O que já foi feito (não refazer)

| Trabalho | Status | O que entregou (relevante para este plano) |
| :--- | :---: | :--- |
| Plano Mestre (fases 0–6) | ✅ | `Reports` 1452→219, `Contas` 1795→233, `Layout` 471→125, `AppTopBar` 389→126, `Settings` 824→127, `Categories` 716→164; `ui/sheet.tsx` com `dragToDismiss`; `TransactionDetailDrawer`; `animated-number`; `PageHeader`; 4 pacotes Radix órfãos removidos |
| Auditoria A→D | ✅ | 23 arquivos mortos removidos; DRY (`todayISO`, `roundToDecimals`, `formatCurrency`); primitivos `ui/eyebrow.tsx` + `ui/glass-card.tsx`; `CreditCardCsvReconciliationPanel` 1193→669; `FloatingCalculator` 1127→407 (3 hooks + `CalculatorPanel`/`CalculatorKeypad`); tipos de conciliação centralizados em `utils/csvReconciliationUi.ts` |

**3 regras de ouro deste plano:**

1. **Estender, nunca duplicar** — tokens vivem em `src/styles/theme-tokens.css`; primitivos vivem em `src/components/ui/`; formatação vive em `src/utils/format.ts`; novas peças entram nesses pontos únicos (Regras de Governança `docs/ui/GOVERNANCA_UI.md`).
2. **Zero mudança de contratos** — nenhum hook de dados (`useDashboardData`, `useExpenses`, `useContasActions`, `usePortfolioState`, etc.), API do Supabase ou regra financeira é alterado; redesign é 100% camada de apresentação.
3. **Cada fase entrega verde e commitada** — `tsc` + 443 testes + `npm run guardrails:ui` + build + commit/push por fase.

---

## 1. Diretrizes de Design & Decisões Homologadas

```
┌────────────────────────────────────────────────────────────────────────────────────────┐
│ DECISÕES DE DESIGN HOMOLOGADAS (v4)                                                    │
├────────────────────────────────────────────────────────────────────────────────────────┤
│ 1. Dashboard: widgets sempre abertos em colunas (reordenação já existe via             │
│    WidgetSettingsSheet — apenas evolução visual + hero com sparkline comparativo).     │
│ 2. Cartões de Crédito: cores institucionais foscas dos bancos via util DRY             │
│    `utils/bankBranding.ts` (Nubank roxo, Inter laranja, Itaú azul, C6 chumbo).         │
│ 3. Sparkline do Hero: comparação mês atual (sólida) vs mês anterior (pontilhada) —     │
│    novo primitivo `ui/comparison-sparkline.tsx` (fallback linha única sem histórico).  │
│ 4. Feed de Transações: cards individuais generosos (rounded-2xl/16px) — base           │
│    `TransactionCard`/`TransactionRow` já existente, refinar espaçamento e badges.      │
│ 5. Padrão de Interação: 100% Bottom Sheets no mobile — base `ui/sheet.tsx` + `Modal`   │
│    (dragToDismiss já implementado). Padronizar header/footer via primitivos existentes.│
│ 6. Relatórios: Visão Mensal com evolução + barras como padrão de entrada (já é a       │
│    estrutura do Reports orquestrador — apenas refino visual).                          │
│ 7. Investimentos: INCLUÍDO no escopo — consistência visual completa; o wizard de       │
│    conciliação B3 permanece isolado e inalterado em comportamento.                     │
│ 8. Estética: fintech minimalista de alta precisão — zero efeitos gamer/neon; glass     │
│    sóbrio (Obsidian Glass) com tokens existentes calibrados.                           │
│ 9. FAB: NÃO criar FAB concorrente — reestilizar o `PageActionButtonHub` existente      │
│    (hub de ações por página) no novo padrão visual.                                    │
│ 10. FloatingCalculator: entra no redesign do shell (superfície L2, keypad refinado) —  │
│     é feature diferenciada do app e não pode destoar.                                  │
│ 11. Auth & Onboarding: incluídos (Login, Register, ResetPassword, ForgotPassword,      │
│     OnboardingCategories) — mesma linguagem visual do shell.                           │
└────────────────────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Fundação Visual — Calibrar Tokens (não recriar)

### 2.1 O que JÁ EXISTE (fonte única — não duplicar)

| Camada | Onde | Estado |
| :--- | :--- | :--- |
| Tokens de tema (L0–L3, 3 temas: dark/midnight/light) | `src/styles/theme-tokens.css` | ✅ existe (auditado, sem dead code) |
| Tokens `--glass-*` (layer-panel, layer-interactive, surface-strong, input-bg, border) | `theme-tokens.css` | ✅ existe |
| Tokens `--color-*` (primary, secondary, income, expense, warning, focus) + `--ds-*` | `theme-tokens.css` | ✅ existe |
| Classes de superfície `surface-glass`, `surface-glass-strong`, `modal-panel-glass` | `src/index.css` | ✅ existe |
| Primitivos UI | `src/components/ui/` (sheet, tabs, button, input, checkbox, switch, dialog, skeleton, **eyebrow**, **glass-card**, **animated-number**) | ✅ existe |
| Wrappers legados (Button, Card, Input, Select, Modal, etc.) | `src/components/*` | ✅ re-exports de `ui/` (política DRY já aplicada) |
| Formatadores oficiais | `src/utils/format.ts` (`formatCurrency`, `formatMoneyInput`, `todayISO`, `roundToDecimals`, …) | ✅ existe |

### 2.2 Ajustes propostos (mudanças concretas e finitas)

1. **Bordas dinâmicas Dark/Light (mitigação F5):** mapear `--glass-border`/bordas de card por tema — `rgba(255,255,255,0.07)` no Dark/Midnight, `rgba(15,23,42,0.08)` no Light. **Não** criar classe nova; calibrar valores no `theme-tokens.css`.
2. **Cores semânticas maduras:** esmeralda `#10b981`/`#34d399` (income), coral `#ef4444`/`#f87171` (expense), âmbar `#f59e0b`/`#fbbf24` (warning) — calibrar os 3 temas, mantendo `--color-income/expense/warning` como fonte única (zero hex hardcoded em componentes — Regra 1 dos guardrails).
3. **Blur:** superfícies L1 `blur(16px)` e L2 `blur(24px)` — já modelados; ajustar só se a medição de FPS exigir (ver F7).
4. **Tipografia tabular para valores:** adicionar utilidade/componente de valor monetário (`tabular-nums tracking-tight`) reutilizável (ex.: `ui/AmountText.tsx`) — substitui repetição de `font-mono tabular-nums` em cards e KPIs (DRY).
5. **Contraste de texto em superfícies:** validar com o fluxo de guardrails existente; ajustar `--color-button-text` e `--color-secondary` nos 3 temas.

### 2.3 Regras DRY da camada visual

- Nenhum hex, `rgb()` ou `rgba()` em componente — **só tokens**.
- Nenhum `text-[10px] uppercase …` inline — **usar `Eyebrow`**.
- Nenhuma superfície glass inline — **usar `GlassCard`** ou `surface-glass`/`modal-panel-glass`.
- Novos primitivos só entram em `src/components/ui/` com snapshot de primitivo (padrão `uiPrimitivesSnapshot`/`uiSecondarySnapshot`).
- Repetição de estilo de valor monetário → `ui/AmountText`; repetição de sparkline → `ui/comparison-sparkline`.

---

## 3. Moldura Global: Shell, FAB, Busca e Calculadora

*(paths reais — o plano anterior referenciou `components/navigation/*`, que **não existe**; o correto é `components/layout/*`)*

### 3.1 Mobile — Bottom Navigation (`src/components/layout/MobileBottomNav.tsx`)
- Barra ultrafina em vidro fumê encaixada na `safe-area-bottom` (já existe estrutura).
- Indicador de aba ativa minimalista (ponto/linha 2px) — refino visual via tokens.
- **Não** alterar os 8 destinos de navegação (constante `src/constants/navigation.ts` — fonte única).

### 3.2 Mobile — Menu "Mais" (`src/components/layout/MobileMenuSheet.tsx`)
- Já usa `GlassCard` (4 atalhos) — padronizar com o novo token de borda e `Eyebrow`.

### 3.3 FAB de Ações (`src/components/PageActionButtonHub.tsx` + `src/hooks/usePageActions.tsx`)
- Reestilizar o hub existente (titânio grafite fosco, resposta tátil) — **sem FAB concorrente** (decisão 9).
- O "Novo lançamento" continua abrindo o seletor existente (`GlassChoiceCard`/`ModalChoiceGrid`).

### 3.4 Desktop — Sidebar (`src/components/layout/DesktopSidebar.tsx`)
- Esbelta, estática, com perfil, grupos e logout — refino visual (tokens, `Eyebrow`).

### 3.5 TopBar & Busca (`src/components/AppTopBar.tsx`, `src/components/topbar/SearchOverlay.tsx`, `src/components/topbar/NotificationsOverlay.tsx`, `src/components/TopBarSearchResults.tsx`)
- Título conciso, busca em overlay (já usa `searchEngine.ts` + `useSearchData.ts`) — refino visual.
- Overlay de notificações/lembretes — refino visual.

### 3.6 Calculadora Flutuante (`src/components/FloatingCalculator.tsx` + `src/components/calculator/CalculatorPanel.tsx` + `CalculatorKeypad.tsx`)
- Superfície L2 (`blur(24px)`), keypad com `Eyebrow`/tokens, display com `AmountText`.
- Nenhuma mudança de lógica (drag/snap/absorb/keyboard já extraídos em hooks).

### 3.7 Auth & Onboarding (`src/pages/Login.tsx`, `Register.tsx`, `ResetPassword.tsx`, `ForgotPassword.tsx`, `OnboardingCategories.tsx`)
- Cartão central em `surface-glass`, logo, mensagens de erro padronizadas.
- Onboarding com progresso discreto e `GlassChoiceCard` para categorias iniciais.

---

## 4. Redesign Detalhado Página por Página (10 módulos)

### 4.1 Dashboard — Hero & Bento Aberto
*Arquivos: `src/pages/Dashboard.tsx`, `src/components/dashboard/*` (WidgetCard, DashboardWidgetGrid, WidgetSettingsSheet, DailyFlowChart), `summaries/*`, `details/*`*

1. **Hero Card de Saldo:** `AmountText` (`text-2xl sm:text-3xl`), `AnimatedNumber`, **sparkline comparativo duplo** via `ui/comparison-sparkline.tsx` (mês atual sólida × mês anterior pontilhada; fallback linha única) e pílula `+2,4% vs mês anterior`. Dados do `useDashboardData` — sem tocar no contrato.
2. **Bento 2×2 (mobile) / 4 colunas (desktop):** Rendas, Despesas, Investimentos, Faturas Abertas — `KpiCard` refinado.
3. **Widget Cartão de Crédito:** cor institucional do banco via `utils/bankBranding.ts` (scrim para contraste), chip metálico, limite disponível.
4. **Fluxo Diário:** `DailyFlowChart` com linhas finas Recharts e tooltip L2.
5. **Widgets secundários sempre abertos em colunas:** `HealthSummary`, `SubscriptionsSummary`, `CategoryBreakdownSummary`, `LimitsOverviewSummary`, `ActionsSummary` — reordenação preservada via `WidgetSettingsSheet`.

### 4.2 Despesas — Feed & Sheets
*Arquivos: `src/pages/Expenses.tsx`, `TransactionCard.tsx`, `TransactionRow.tsx`, `transactions/TransactionDetailDrawer.tsx`, `ExpenseFormModal.tsx`*

1. Seletor de competência com setas + swipe calibrado (`hooks/useSwipeMonth.ts` — já existe).
2. Feed em cards 16px espaçados (12px), ícone vetorial em círculo, `line-clamp-1` + tooltip, badges de parcela (`2/10`) e fatura com `flex-wrap`, valor `- R$ 248,50` com `AmountText`.
3. `TransactionDetailDrawer` (já existe) com dados completos (data, valor, `report_weight`, categoria, notas) + Editar/Excluir.
4. **DRY:** fusão de `ExpenseFormModal` + `IncomeFormModal` → **`TransactionFormModal`** único (tipo de lançamento como prop) — elimina ~40% de duplicação de formulário (ver seção 5).

### 4.3 Rendas — Rateio Proporcional
*Arquivos: `src/pages/Incomes.tsx`, `IncomeFormModal.tsx`, `TransactionCard.tsx`, `utils/reportWeight.ts`*

1. Card de total com `AnimatedNumber` + **barra visual de rateio proporcional** (proporção por pessoa via `report_weight`).
2. Feed em cards 16px com `+ R$ 5.000,00` em esmeralda.
3. Inclusão/edição via `TransactionFormModal` (fusão DRY) com categorias de receita.

### 4.4 Contas & Faturas — Cartões, Timeline, CSV e Dívidas
*Arquivos: `src/pages/Contas.tsx`, `creditCards/*` (CreditCardSection, CreditCardTimeline, CardColorField, BillPaymentModal, RefundModal, CardFormModal, CycleConfigModal), `contas/*` (ContasModals, ContasStats), `debts/*` (DebtsSection, DebtFormModal, DebtActionConfirmModals), `CreditCardCsvReconciliationPanel.tsx`, `reconciliation/*`, `utils/refundNote.ts` (já em `utils/`, não em `pages/`)*

1. **Cores institucionais:** novo `utils/bankBranding.ts` (mapeamento instituição → cor fosca + badge) usado pelo `CreditCardSection`/`CardColorField` — contraste WCAG AA via scrim (F2).
2. **Timeline do ciclo:** `CreditCardTimeline` (compra → fechamento → vencimento) refinada.
3. **Gestão de faturas:** aberta/fechada/vencida com pagamento rápido, estornos (`RefundModal`) e notas (`refundNote.ts`).
4. **Conciliação CSV:** `CreditCardCsvReconciliationPanel` (já decomposto em 9 componentes) — refino visual do wizard (stepper `CsvWizardStepper`, cards `Reconciliation*`), virtualização leve para 50+ itens. Sem mudança de comportamento.
5. **Dívidas:** `DebtsSection` com chips de status (A Vencer/Vence Hoje/Atrasada/Quitada), filtros e quitação em 1 toque.
6. **KPIs:** `ContasStats` (Faturas Abertas, a Pagar, a Receber, Saldo Pendente) — `AmountText`.

### 4.5 Relatórios — Visão Mensal Padrão
*Arquivos: `src/pages/Reports.tsx` (orquestrador 219 linhas), `reports/*` (MonthlyReportView, AnnualReportView, ReportsPageHeader, CategoryDetailModal, ReportUnifiedCompositionCard, ReportPendingDebtsWidget, ReportCustomDateFilter, charts)*

1. Entrada na Visão Mensal (estrutura já pronta) — refino de hierarquia visual.
2. Controle de período em pílula (Mês/Ano/Customizado) — `ReportsTabButton`/tabs.
3. Gráficos Recharts com linhas finas, preenchimento 10% e ocultação inteligente de rótulos; toggle de séries 1 toque.
4. Matriz por categorias com drilldown `CategoryDetailModal`.
5. Chave com/sem pesos (`reportWeight`).

### 4.6 Categorias — Grid & Limites
*Arquivos: `src/pages/Categories.tsx`, `ExpenseCategories.tsx`, `IncomeCategories.tsx`, `categories/*` (ExpenseCategoryGrid, IncomeCategoryGrid, CategoryFormModal, LimitSuggestionsModal, CategoryDeleteConfirmModal), `hooks/useExpenseCategoryLimits.ts`*

1. Bento grid em vidro L1 com ícone vetorial e barra de progresso de limite.
2. Sugestões de orçamento (`LimitSuggestionsModal` — média de gastos).
3. Sheets de criação/edição com paleta de cores e catálogo Lucide pesquisável.

### 4.7 Configurações — Temas, Biometria, Admin
*Arquivos: `src/pages/Settings.tsx`, `settings/*` (AppearancePanel, SecurityPanel, AdminPanel, SettingsTabs, SettingsModals, SettingRow), `ThemeSwitcher.tsx`, `AccentToneSwitcher.tsx`, `appearanceChoice.ts`*

1. Miniaturas visuais dos 3 temas + amostras circulares de accent (já existem).
2. Biometria/Passkeys + timeout de bloqueio (já existem — refino visual).
3. Painel admin multi-usuário (aprovação/bloqueio/permissões).
4. Exportação JSON/Excel.

### 4.8 PWA Offline & Notificações
*Arquivos: `layout/OfflinePlaceholder.tsx`, `OfflineSyncManager.tsx`, `NetworkStatusToast.tsx`, `PullToRefresh.tsx`, `PwaUpdatePrompt.tsx`, `topbar/NotificationsOverlay.tsx`, `utils/offlineQueue.ts`*

1. Pill offline discreta + transição suave ao re-sincronizar (fila IndexedDB→Supabase).
2. Lembretes com "Adiar".

### 4.9 Investimentos (novo no escopo)
*Arquivos: `src/pages/Investments.tsx` (orquestrador 381 linhas), `investments/*` (~35 componentes: PortfolioKpiBar, PortfolioPieChart, HoldingsTable, EvolutionChart, LedgerBook, AssetDetailModal, AssetConfigModal, PortfolioTransactionFormModal, SmartAporteSimulator, RebalancingView, B3PositionValidationPanel, reconciliation/* — wizard de conciliação B3 em 8 steps, ExposureLimitsEditor, MonthlyActivityCard, AssetAnalyticsCard, QuickBalanceUpdateModal, etc.)*

1. **Consistência visual apenas:** KPIs, tabelas e modais migrados para tokens/`Eyebrow`/`GlassCard`/`AmountText`.
2. **Wizard de conciliação B3 (`investments/reconciliation/*`):** refino visual do stepper/cards; comportamento e steps **intocados**.
3. Ações críticas (aportes, ajustes B3, ledger) preservadas — nenhuma regra de cálculo alterada.

### 4.10 Auth & Onboarding (novo no escopo)
*Arquivos: `src/pages/Login.tsx`, `Register.tsx`, `ResetPassword.tsx`, `ForgotPassword.tsx`, `OnboardingCategories.tsx`, `ProtectedRoute.tsx`*

1. Tela de login com cartão `surface-glass` centralizado, `Logo`/marca, mensagens de erro consistentes e `Loader`.
2. Onboarding de categorias com `GlassChoiceCard` e progresso discreto.

---

## 5. Padronização Global de Bottom Sheets (DRY)

**Base existente (não recriar):** `ui/sheet.tsx` (com `dragToDismiss`), `Modal.tsx` (ativa o drag no mobile), `ModalFooter.tsx`, `ModalIntro.tsx`, `FieldLabel`, `SectionHeader`.

```
┌──────────────────────────────────────────────────────────┐
│        ─── BARRA DE ARRASTAR (PILL) — já no sheet ───    │
│  [Título via SectionHeader]                 [Fechar]     │
├──────────────────────────────────────────────────────────┤
│  • Formulários (via TransactionFormModal unificado)      │
│  • Detalhes (TransactionDetailDrawer, AssetDetailModal)  │
│  • Filtros & Ações (WidgetSettingsSheet)                 │
├──────────────────────────────────────────────────────────┤
│  [Botão Primário — ModalFooter, fixo acima do teclado]   │
└──────────────────────────────────────────────────────────┘
```

**Padrão único:** header sticky (`SectionHeader`) · corpo `max-h-[85vh] overflow-y-auto` · footer fixo com `env(safe-area-inset-bottom)` · `pb-safe` nos formulários · `dragToDismiss` ativo.

**Ação DRY principal:** fundir `ExpenseFormModal.tsx` + `IncomeFormModal.tsx` em **`TransactionFormModal.tsx`** (prop `type: 'expense' | 'income'` + campos compartilhados: data, valor, categoria, descrição, notas, método). As páginas `Expenses`/`Incomes` continuam passando os mesmos handlers — zero mudança de comportamento.

---

## 6. Diagnóstico de Fragilidades & Mitigações (F1–F8)

| # | Cenário & Fragilidade | Risco | Mitigação Técnica |
| :---: | :--- | :--- | :--- |
| **F1** | Teclado virtual cobre botão Salvar em sheets | Bloqueio de fluxo | `max-h-[85vh] overflow-y-auto` + header sticky + footer fixo com `env(safe-area-inset-bottom)` (padrão da seção 5) |
| **F2** | Contraste em cartões de banco com cores claras (amarelo/laranja) | Falha WCAG AA | Scrim `linear-gradient(rgba(0,0,0,0.3), rgba(0,0,0,0.6))` + texto ≥ 4.5:1 (dentro do `utils/bankBranding.ts`) |
| **F3** | Overflow de valores extremos no Hero (`R$ 1.850.420,00` em 360px) | Quebra feia | `AmountText` com `text-2xl sm:text-3xl font-mono tabular-nums tracking-tight` + `text-wrap: balance` |
| **F4** | Conflito de gestos no feed (scroll vertical × swipe de mês) | Troca acidental de mês | `useSwipeMonth` (já existe): só troca se movimento horizontal predominante com delta > 60px |
| **F5** | Bordas glass invisíveis no tema claro | Perda de estrutura | Bordas dinâmicas por tema em `theme-tokens.css` (white 7% dark / slate 8% light) |
| **F6** | Sparkline duplo sem histórico de mês anterior | Componente vazio | Fallback para linha única no `ui/comparison-sparkline.tsx` + pílula de variação oculta quando não há base |
| **F7** | `backdrop-filter` em listas longas (feed 100+ itens) | Queda de FPS no mobile | Blur pesado (24px) só em L2 (sheets/drawers); cards L1 com blur leve ou sem blur durante scroll (classe `will-change`/`content-visibility` onde medir ganho) |
| **F8** | FAB central proposto vs `PageActionButtonHub` existente | Dupla affordance | Decidido: reestilizar o hub existente (decisão 9); nenhum FAB novo |

---

## 7. Mapeamento Completo de Arquivos (paths reais)

| Módulo | Arquivos de Código (reais) | Responsabilidade do Redesign |
| :--- | :--- | :--- |
| **Tokens & Estilos** | `src/styles/theme-tokens.css`, `src/index.css`, `src/components/ui/eyebrow.tsx`, `ui/glass-card.tsx`, `ui/animated-number.tsx` | Calibração L0–L3, bordas dinâmicas, cores semânticas, `AmountText`/`comparison-sparkline` novos em `ui/` |
| **Shell & Navegação** | `src/components/Layout.tsx`, `layout/MobileBottomNav.tsx`, `layout/MobileMenuSheet.tsx`, `layout/DesktopSidebar.tsx`, `layout/OfflinePlaceholder.tsx`, `AppTopBar.tsx`, `topbar/SearchOverlay.tsx`, `topbar/NotificationsOverlay.tsx`, `TopBarSearchResults.tsx`, `PageActionButtonHub.tsx`, `FloatingActionHub.tsx`, `constants/navigation.ts` | Barra inferior, sidebar, FAB hub reestilizado, busca/lembretes em overlay |
| **Calculadora** | `FloatingCalculator.tsx`, `calculator/CalculatorPanel.tsx`, `calculator/CalculatorKeypad.tsx`, hooks `useCalculator*` | Superfície L2, keypad com tokens |
| **Dashboard** | `pages/Dashboard.tsx`, `dashboard/DashboardWidgetGrid.tsx`, `WidgetCard.tsx`, `WidgetSettingsSheet.tsx`, `DailyFlowChart.tsx`, `dashboard/summaries/*` (6), `dashboard/details/*` (7) | Hero com sparkline duplo, bento, cartão de banco |
| **Despesas & Rendas** | `pages/Expenses.tsx`, `pages/Incomes.tsx`, `TransactionCard.tsx`, `TransactionRow.tsx`, `transactions/TransactionDetailDrawer.tsx`, `ExpenseFormModal.tsx`, `IncomeFormModal.tsx` (**→ `TransactionFormModal`**) | Feed 16px, sheets, rateio de pesos |
| **Contas & Faturas** | `pages/Contas.tsx`, `creditCards/*` (CreditCardSection, CreditCardTimeline, CardColorField, BillPaymentModal, RefundModal, CardFormModal, CycleConfigModal, CreditCardCsvReconciliationPanel + `Csv*` steps), `contas/ContasModals.tsx`, `contas/ContasStats.tsx`, `debts/*`, `reconciliation/*`, `utils/bankBranding.ts` (novo), `utils/refundNote.ts` | Cores dos bancos, timeline, CSV, dívidas, KPIs |
| **Relatórios** | `pages/Reports.tsx`, `reports/*` (MonthlyReportView, AnnualReportView, ReportsPageHeader, CategoryDetailModal, ReportUnifiedCompositionCard, ReportPendingDebtsWidget, ReportCustomDateFilter, charts) | Visão mensal padrão, gráficos finos, pesos |
| **Categorias** | `pages/Categories.tsx`, `pages/ExpenseCategories.tsx`, `pages/IncomeCategories.tsx`, `categories/*`, `hooks/useExpenseCategoryLimits.ts` | Grid + limites + sugestões |
| **Configurações** | `pages/Settings.tsx`, `settings/*` (AppearancePanel, SecurityPanel, AdminPanel, SettingsTabs, SettingsModals, SettingRow), `ThemeSwitcher.tsx`, `AccentToneSwitcher.tsx`, `appearanceChoice.ts` | Temas, biometria, admin |
| **Investimentos** | `pages/Investments.tsx`, `investments/*` (~35: PortfolioKpiBar, PortfolioPieChart, HoldingsTable, EvolutionChart, LedgerBook, AssetDetailModal, SmartAporteSimulator, RebalancingView, B3PositionValidationPanel, `reconciliation/*` wizard, …) | Consistência visual; wizard B3 intocado |
| **Auth & Onboarding** | `pages/Login.tsx`, `Register.tsx`, `ResetPassword.tsx`, `ForgotPassword.tsx`, `OnboardingCategories.tsx`, `ProtectedRoute.tsx` | Glass panel, marca, onboarding |
| **PWA & Offline** | `OfflineSyncManager.tsx`, `NetworkStatusToast.tsx`, `PullToRefresh.tsx`, `PwaUpdatePrompt.tsx`, `SupabaseWarning.tsx`, `utils/offlineQueue.ts` | Pill offline, sincronização, atualização |

---

## 8. Roteiro de Implementação — 7 Fases (R1–R7)

> Toda fase: `npx tsc --noEmit` · `npm run test:run` (443) · `npm run guardrails:ui` · `npm run build` · lint dos arquivos alterados · **commit + push**.

| Fase | Escopo | Arquivos-chave | DRY / Entregáveis | Critério de Aceite |
| :--- | :--- | :--- | :--- | :--- |
| **R1** | Fundação visual & tokens | `theme-tokens.css`, `index.css`, `ui/AmountText.tsx` (novo) | Bordas dinâmicas dark/light; cores semânticas calibradas; `AmountText` criado e aplicado no Hero + KPIs | guardrails 100% verde; contraste AA nos 3 temas; snapshot de primitivo do `AmountText` |
| **R2** | Shell, FAB & Calculadora | `layout/*`, `AppTopBar`, `topbar/*`, `PageActionButtonHub`, `FloatingCalculator`, `calculator/*` | Refino visual via tokens; zero mudança de hooks | Navegação 8 destinos intacta; calculator drag/snap testado manualmente |
| **R3** | Dashboard & Hero | `Dashboard.tsx`, `dashboard/*`, `ui/comparison-sparkline.tsx` (novo), `utils/bankBranding.ts` (novo) | Sparkline duplo com fallback; cartão de banco com cor institucional; bento refinado | `useDashboardData` intocado; sparkline fallback sem mês anterior |
| **R4** | Despesas/Rendas & Sheets | `Expenses.tsx`, `Incomes.tsx`, `TransactionCard`, `TransactionRow`, `TransactionDetailDrawer`, **fusão `TransactionFormModal`** | Sheets padronizadas (seção 5); fusão DRY dos form modals | Fluxos de criação/edição/exclusão idênticos; 443 testes verdes |
| **R5** | Contas, Faturas, CSV & Dívidas | `Contas.tsx`, `creditCards/*`, `contas/*`, `debts/*`, `CreditCardCsvReconciliationPanel`, `reconciliation/*` | Cores dos bancos (bankBranding), timeline, wizard CSV refinado, chips de dívidas | Conciliação CSV com mesmo comportamento; testes de conciliação verdes |
| **R6** | Relatórios, Categorias & Configurações | `Reports.tsx`, `reports/*`, `Categories.tsx`, `categories/*`, `Settings.tsx`, `settings/*` | Visão mensal padrão, gráficos finos, grid com limites, temas/biometria/admin refinados | `useReportsData`/`useAppSettings` intocados |
| **R7** | Investimentos, Auth/Onboarding & Offline | `Investments.tsx`, `investments/*`, `Login/Register/Reset/Forgot/Onboarding`, `OfflineSyncManager`, `NetworkStatusToast` | Consistência visual total; wizard B3 intocado; auth com glass panel; polimento offline | Nenhuma regra de cálculo de portfólio alterada; fluxo de auth testado |

**Ordem de valor:** R1→R3 dá o impacto visual imediato (tokens + shell + dashboard); R4 e R5 entregam o padrão de interação (sheets + conciliação); R6-R7 fecham cobertura total (relatórios/configs/investimentos/auth).

**Status de execução (12/08/2026):**

| Fase | Status | Observações |
| :--- | :---: | :--- |
| **R1** | ✅ Concluída | Tokens **verificados já calibrados** (bordas dinâmicas dark/light/midnight, cores semânticas `#10b981/#34d399` e `#ef4444/#f87171`, blur 16/24px, z-index completo — sem alterações necessárias). Criado `ui/amount-text.tsx` (primitivo DRY de valor monetário: tabular-nums, sizes/tones/weights, `forceSign`, `nowrap` opt-in) + 7 testes (snapshot + comportamento, NBSP-aware). Aplicado na KPI bar do Dashboard (`DashboardWidgetGrid`) via prop tipada `tone`. **450 testes verdes**, guardrails OK, build OK. |
| R2 | ⏳ Pendente | — |
| **R3** | ✅ Concluída | Criado `ui/comparison-sparkline.tsx` (SVG dupla: atual sólida × anterior pontilhada, fallback p/ linha única, gradiente via `useId` sanitizado) + `utils/comparisonSparkline.ts` (`buildSparklinePath` + `accumulateSeries`, 7 testes) + `utils/bankBranding.ts` (cores institucionais de 15+ bancos + `resolveCardColor` + scrim, com allowlist consciente no `ui-guardrails.mjs`). Novo **Hero do Dashboard** (`DashboardHero.tsx`): saldo com `AnimatedNumber` + pílula de variação vs mês anterior + sparkline comparativo de gastos acumulados. Extensão aditiva `previousMonthDailyExpenses` (espelha `dailyFlowData`, com `applyReportWeight`). `CreditCardSection` usa a cor institucional do banco. DRY extra: `categoryDetailContext.ts` (extraído do grid) e `dashboardDataContext.ts` dividido do Provider — **6 warnings react-refresh pré-existentes zerados**. **470 testes verdes**, guardrails OK, build OK, lint zero warnings. |
| **R4** | ✅ Concluída | `ExpenseFormModal` + `IncomeFormModal` fundidos em **`TransactionFormModal.tsx`** (união discriminada `type: 'expense' \| 'income'`, esqueleto compartilhado: currency fields, data, descrição, report weight, delete confirm, submit — comportamento idêntico aos originais). 4 callers atualizados (Expenses, Incomes, Dashboard ×2 com quick-add, ContasModals com `defaultValues` para dívida). Estornos somente-visualização preservados; `loadRefundOrigin` dentro do effect (deps completas, zero disable); arrays vazios estáveis (NO_CATEGORIES) para hooks. Padrão de sheet já coberto pelo `Modal.tsx` (Sheet + dragToDismiss + safe-area + corpo rolável). **470 testes verdes**, lint zero warnings, guardrails OK, build OK. |
| R5 | ⏳ Pendente | — |
| R6 | ⏳ Pendente | — |
| R7 | ⏳ Pendente | — |

---

## 9. Salvaguardas & Protocolo de Qualidade

1. **443 testes automatizados 100% verdes** em cada fase (`npm run test:run`) — nenhuma regra financeira ou cálculo alterado.
2. **Governança de UI (`npm run guardrails:ui`):** zero cores hardcoded, zero emojis, uso estrito de `format.ts`, `Eyebrow`/`GlassCard`/`AmountText` nos padrões.
3. **Snapshots de primitivos:** qualquer novo componente em `ui/` acompanha snapshot (`uiPrimitivesSnapshot`/`uiSecondarySnapshot`).
4. **Acessibilidade WCAG AA:** contraste ≥ 4.5:1, alvos ≥ 44×44px, `prefers-reduced-motion` respeitado, `prefers-reduced-transparency` considerada para o glass.
5. **Safe areas e teclado:** `env(safe-area-inset-bottom)`, `max-h-[85vh]`, footer fixo em sheets.
6. **Performance:** blur pesado só em L2; FPS ≥ 60 no feed; virtualização leve na conciliação (50+ itens).
7. **Contratos preservados:** nenhum hook de dados, migration SQL ou API Supabase muda; redesign é camada de apresentação.
8. **Documentação:** ao final de cada fase, atualizar `docs/ARCHITECTURE.md` + `docs/COMPLETE_GUIDE.md` + este plano (status das fases), commit + push.
