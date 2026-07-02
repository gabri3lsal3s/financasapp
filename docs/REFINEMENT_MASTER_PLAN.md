# Plano de Refinamento — FinançasApp (Consolidado)

> **Última atualização:** Julho de 2026 (v1.9) — Motor de sugestões de otimização (`optimizationSuggestionsEngine.ts`) com 8 tipos de ações contextuais. QuickWinsGrid refatorado: só aparece quando há ações úteis, cards dinâmicos com economia mensal + projeção anual. Build: 0 erros TS, 387/387 testes, Build OK.
> **Propósito:** Documento único consolidando todo o planejamento de refatoração, refinamento e melhorias do aplicativo — tanto concluído quanto pendente.
> **Substitui:** `AUDITORIA_REVISAO.md`, `REFACTORING_PLAN.md`, `IMPROVEMENT_PLAN.md`, `REFINEMENT_PLAN.md`, `NEXT_STEPS.md`, `SEARCH_IMPROVEMENT_PLAN.md`

---

## Sumário

1. [Estado Atual do Projeto](#1-estado-atual-do-projeto)
2. [Fases Concluídas](#2-fases-concluídas)
3. [Correções de Bugs](#3-correções-de-bugs)
4. [Melhorias de UI/UX Concluídas](#4-melhorias-de-uiux-concluídas)
5. [Pendências Técnicas](#5-pendências-técnicas)
6. [Dashboard Redesign](#6-dashboard-redesign)
7. [Melhorias de Curto Prazo](#7-melhorias-de-curto-prazo)
8. [Melhorias de Médio/Longo Prazo](#8-melhorias-de-médiolongo-prazo)
9. [Monitoramento Contínuo](#9-monitoramento-contínuo)
10. [Apêndice: Inventário de Componentes](#10-apêndice-inventário-de-componentes)

---

## 1. Estado Atual do Projeto

### Stack

| Camada | Tecnologias |
|--------|-------------|
| **Core** | React 18, TypeScript 5.2, Vite 5 |
| **Estilização** | Tailwind CSS 3, Radix UI (shadcn/ui), Framer Motion |
| **Gráficos** | Recharts 2 |
| **Backend** | Supabase (PostgreSQL, Auth, Realtime, Edge Functions) |
| **Testes** | Vitest + Testing Library |
| **PWA** | vite-plugin-pwa (Service Worker, cache 75 entradas) |

### Métricas

| Métrica | Valor | Status |
|---------|-------|--------|
| TypeScript errors | **0** | ✅ |
| Testes passando | **387/387** (35 arquivos, ~8s) | ✅ |
| Build | **OK** (PWA, 72 entries precached) | ✅ |
| Build | **OK** | ✅ |
| UI Guardrails | **21 na baseline** | 🟡 |
| `as any` em produção | **0** | ✅ |
| Non-null assertions em produção | **0** | ✅ |
| `catch(err: any)` | **0** | ✅ |
| `console.log` residual | **0** (via logger condicional) | ✅ |
| `style={{ }}` em produção | **< 50 ocorrências** | 🟡 |
| Maior arquivo | **~1.600 linhas** (Reports.tsx, -17% graças ao useReportCustomPeriod) | 🟢 |
| Dashboard.tsx | **~1.700 linhas** (3 hooks extraídos) | 🟢 |
| Componentes | **130+** | ✅ |
| Hooks customizados | **35+** | ✅ |
| Migrations | **43** | ✅ |

### Rotas do App

| Rota | Página | Descrição |
|------|--------|-----------|
| `/` | Dashboard | KPIs, fluxo diário, Centro de Economia (10 insights), ações de otimização inline, limites |
| `/expenses` | Expenses | CRUD despesas c/ parcelamento |
| `/incomes` | Incomes | CRUD rendas |
| `/investments` | Investments | Portfólio, quantamental, conciliação B3 |
| `/contas` | Contas | Cartões, faturas, dívidas |
| `/categories` | Categories | Orçamentos e metas |
| `/expense-categories` | ExpenseCategories | CRUD categorias despesa |
| `/income-categories` | IncomeCategories | CRUD categorias renda |
| `/reports` | Reports | Relatórios mensais/anuais/período |
| `/settings` | Settings | Temas, biometria, calculadora, lembretes |

---

## 2. Fases Concluídas

### Fase 1 — Refatoração Inicial ✅

| # | Item | Descrição | Status |
|---|------|-----------|--------|
| 1.1 | FloatingActionHub | Unifica ScrollToTop + NotificationsWidget em portal único (~50 linhas, 4 useEffects) | ✅ |
| 1.2 | TransactionRow extraído | Sub-componente reutilizável de TransactionCard | ✅ |
| 1.3 | Tooltips centralizados | Textos movidos para `constants/tooltips.ts` | ✅ |
| 1.4 | Tooltips faltantes | Adicionados em ReportsCategoryRowButton e outros | ✅ |

### Fase 2 — Hooks e Componentes Genéricos ✅

| # | Item | Descrição | Status |
|---|------|-----------|--------|
| 2.1 | usePageActions | Substitui PageHeader em 10 páginas (3 imports → 1) | ✅ |
| 2.2 | useSupabaseTable | Hook genérico CRUD com cache + offline + realtime. 3 hooks refatorados (~250 linhas eliminadas) | ✅ |
| 2.3 | Sub-componentes TransactionForm | TransactionAmountFields, TransactionDateField, TransactionCategorySelect, TransactionDescriptionField | ✅ |
| 2.4 | Button size="icon" + IconButton | Botão de ícone padronizado | ✅ |

### Fase 3 — Limpeza e Performance ✅

| # | Item | Descrição | Status |
|---|------|-----------|--------|
| 3.1 | Dead code removido | separator, scroll-area, PageHeader, MobileAlertsPill | ✅ |
| 3.2 | useAppSettings reducer | 8 useState + 8 useCallback → 1 useReducer + 1 updateSetting | ✅ |
| 3.3 | CSS Recharts consolidado | Centralizado em index.css | ✅ |
| 3.4 | Inline styles → Tailwind | ~30 estilos migrados em 4 arquivos (TransactionRow, TransactionCard, PageActionButtonHub, FloatingCalculator) | ✅ |
| 3.5 | EmptyState unificado | ExpenseCategoryGrid + IncomeCategoryGrid usam EmptyState component | ✅ |

### Fase 4 — Extração de Arquivos Grandes ✅

| # | Arquivo Original | Linhas (antes) | Linhas (depois) | Extrações | Status |
|---|-----------------|:--------------:|:---------------:|-----------|--------|
| 4.1 | `FloatingCalculator.tsx` | 1.569 | 1.107 (-29%) | calculatorExpression, calculatorGeometry, calculatorDom, useCalculatorKeyboard, useCalculatorPanel | ✅ |
| 4.2 | `Reports.tsx` | 3.119 | ~1.925 (-38%) | reportAggregation, reportCustomData, AnnualReportView, MonthlyReportView, ReportPendingDebtsWidget, ReportUnifiedCompositionCard, ReportCustomDateFilter | ✅ |
| 4.3 | `Contas.tsx` | 2.039 | 1.668 (-18%) | useContasBills, useContasModals | ✅ |
| 4.4 | `FloatingActionHub.tsx` | 520 | ~50 (-90%) | useScrollToTop, haptics | ✅ |

### Fase 4.5 — Layout Alignment ✅

| # | Item | Descrição | Status |
|---|------|-----------|--------|
| 4.5.1 | AppTopBar padding | px-3 → px-4 (alinhado com p-4 das páginas) | ✅ |
| 4.5.2 | AppTopBar margin | mb-5 → mb-4 lg:mb-6 (match card spacing) | ✅ |
| 4.5.3 | Layout wrapper padding | px-3 → px-4 (consistente com AppTopBar) | ✅ |
| 4.5.4 | Mobile full-width | max-w-7xl mx-auto → lg:max-w-7xl lg:mx-auto | ✅ |
| 4.5.5 | Vertical centering | py-2.5 sm:py-3 para melhor centralização | ✅ |

---

## 3. Correções de Bugs

### 🔴 Críticas

| # | Bug | Arquivo | Correção |
|---|-----|---------|----------|
| 1 | **Loop infinito no useSupabaseTable** | `useSupabaseTable.ts` | configRef pattern — dependências de useCallback estabilizadas |
| 2 | **Overflow DECIMAL(15,2)** — crash em valores grandes | `portfolioTwrEngine.ts` + migration | Migration DECIMAL(18,2) + arredondamento round2 |
| 3 | **Select.Item value=""** — erro no Radix UI | `Select.tsx` | Sentinel value `__empty__` |
| 4 | **InfoTooltip z-index/overflow clipping** | `InfoTooltip.tsx` | Reescrevido com portal |
| 5 | **CSS spacing bug** — `h - 2 w - 2` | `Settings.tsx` | Corrigido para `h-2 w-2` |
| 6 | **CSS spacing bug** — `rounded - lg border p - 3` | `Settings.tsx` | Corrigido para `rounded-lg border p-3` |
| 7 | **Non-null assertions** — 13 ocorrências | `Contas.tsx`, `IncomeFormModal.tsx` | Eliminadas com optional chaining |
| 8 | **`any` type** — escaped type safety | `usePortfolioState.ts`, `reportCustomData.ts` | Substituído por tipos fortes |

### 🟡 Médias

| # | Bug | Arquivo | Correção |
|---|-----|---------|----------|
| 9 | **key={index}** — React anti-pattern | `DatePicker.tsx`, `CreditCardTimeline.tsx` | Chaves estáveis (name, cell.dateStr) |
| 10 | **console.debug → logger.debug** | `priceService.ts` | Logger condicional |
| 11 | **Blank line extra entre imports** | `Reports.tsx` | Formatação |
| 12 | **Teclado nativo ao usar calculadora mobile** | `FloatingCalculator.tsx` | setTimeout(0) para blur |
| 13 | **Valor calculadora não persistia ao sair do campo** | `FloatingCalculator.tsx` | queueMicrotask |

---

## 4. Melhorias de UI/UX Concluídas

### Componentes Padronizados

| Componente | Descrição |
|-----------|-----------|
| `FieldLabel.tsx` | Label uppercase, font-black, text-secondary |
| `SectionHeader.tsx` | Duas APIs: children+as+bordered e title+description+action |
| `NumberInput.tsx` | Migração de Input type="number" em 7 arquivos |
| `EmptyState.tsx` | Componente unificado (icon, title, description, action) |

### Mobile Optimization

| Melhoria | Descrição |
|----------|-----------|
| `touch-action: manipulation` | Elimina delay 300ms em toques iOS |
| Touch targets 44px (WCAG 2.5.5) | Bottom nav + botões com min-height |
| Feedback tátil | `@media (hover: none) and (pointer: coarse)` |
| TransactionCard mobile | Botões com min-h-[44px], ícones 16px |

### Busca Global

| Funcionalidade | Descrição |
|----------------|-----------|
| Motor de busca | `searchEngine.ts` — pesquisa descrições, valores, datas, categorias |
| Scoring | Match exato (100), prefixo (85), substring (60), recência (25-0) |
| 6 entidades pesquisáveis | Despesas, Rendas, Dívidas, Cartões, Categorias, Categorias de Renda |
| Highlight | Termo destacado com `<mark>` |
| Navegação contextual | Cada resultado navega p/ página correta c/ `?highlight={id}` |
| 23+ testes | `searchEngine.test.ts` — todos passando |

### Notificações

| Melhoria | Descrição |
|----------|-----------|
| Notificações unificadas | `NotificationsOverlay` substitui 3 UIs diferentes |
| Mesmo padrão SearchOverlay | Backdrop blur + max-w-xl + animação spring |
| Bell button unificado | Sem distinção mobile/desktop |

---

## 5. Pendências Técnicas

### ✅ Insights do Dashboard Refatorados (v1.6)

| Item | Descrição | Status |
|------|-----------|--------|
| Motor de insights | `insightsEngine.ts` — 10 cards: Alerta Crítico, Assinaturas, Desafios, Limites, Concentração Renda, Tendência vs Mês, Gastos FDS, Categoria Destaque, Status Poupança, Compromisso Investimentos | ✅ |
| InsightsCard | Reescrevido sem input de chat, grid 2 colunas para novos insights, seções organizadas | ✅ |
| useDashboardInsights | Hook simplificado, sem estado de chat, retorna dados estruturados | ✅ |
| aiIcons | Novos ícones: BarChart3, Activity, Coffee, Landmark | ✅ |
| Engine refinado | Filtra parcelas em assinaturas, +10 categorias de desafios, mínimo dinâmico (0.5% renda), redução de 30% adicionada | ✅ |
| QuickWinsGrid | **Reescrito**: 4 ações inline sem navegação, sem duplicatas com InsightsCard. Ações: Ajustar Limite Manual, Remanejamento Inteligente, Redução Rápida (-10%/-20%), Aplicar Sugestão do Motor | ✅ |

### ✅ Fase 2 — Refinamento de Insights (v1.8)

| Item | Descrição | Status |
|------|-----------|--------|
| **Detecção multi-mês de assinaturas** | `additionalPreviousMonthExpenses` aceita até 3 meses históricos. `monthsFound` e `confidence` refletem o real histórico. Maior precisão em assinaturas consolidadas | ✅ |
| **Projeção anual nos desafios** | `SavingsChallenge.annualProjectedSavings` calcula economia em 12 meses. Exibido no `InsightsCard.tsx` como badge `🗓️ R$ X/ano` | ✅ |
| **Dismiss/Restore de assinaturas** | `ignoredSubscriptions.ts` — persistência em localStorage, seção recolhida de ignorados no InsightsCard | ✅ |
| **Testes de assinaturas ignoradas** | `ignoredSubscriptions.test.ts` — 16 testes: mock localStorage, normalize, ignore/restore, edge cases | ✅ |
| **Testes de calculadora** | `calculatorExpression.test.ts` (23 testes), `calculatorGeometry.test.ts` (24 testes) — pure functions | ✅ |
| **Integração Dashboard** | Dashboard carrega meses -2 e -3 e passa ao motor via `additionalPreviousMonthExpenses` | ✅ |

### ✅ Fase 2.5 — Motor de Sugestões de Otimização (v1.9)

| Item | Descrição | Status |
|------|-----------|--------|
| **`optimizationSuggestionsEngine.ts`** | Novo motor que combina 8 fontes: assinaturas cortáveis, desafios, limites estourados, sobras de limite, remanejamento, gastos FDS, status poupança, investimentos. Cada sugestão inclui `monthlySavings` + `annualProjectedSavings` | ✅ |
| **QuickWinsGrid refatorado** | Só renderiza quando `hasActionableSuggestions === true`. Cards dinâmicos (não mais painéis fixos). Ação com 1 clique (Aplicar/Ignorar/Ver). Badges de economia mensal + anual | ✅ |
| **Dashboard integrado** | `optimizationSummary` computado via `useMemo` no Dashboard. `onRefreshInsights` recarrega após cada ação | ✅ |
| **Código morto removido** | `reduce_limit` type, `EmptyOptimizationState`, `X` icon. ActionButton com switch unificado (`set_limit` + `create_limit` combinados) | ✅ |

### ⏳ Migration Pendente no Supabase

A correção do overflow DECIMAL(15,2) precisa ser aplicada via migration:

**Migration:** `supabase/migrations/20260629_fix_numeric_overflow.sql`

| Tabela | Colunas | Tipo Antigo → Novo |
|--------|---------|-------------------|
| `portfolio_share_daily` | `gross_pl`, `net_pl`, `cash_value`, `invested_cost` | `DECIMAL(15,2)` → `DECIMAL(18,2)` |
| `portfolios` | `cash_balance`, `last_gross_pl`, `last_net_pl` | `DECIMAL(15,2)` → `DECIMAL(18,2)` |
| `portfolio_period_snapshots` | `somatorio_aportes`, `somatorio_resgates`, `dividendos_recebidos` | `DECIMAL(15,2)` → `DECIMAL(18,2)` |
| `portfolio_asset_definitions` | `applied_amount`, `manual_current_value` | `DECIMAL(15,2)` → `DECIMAL(18,2)` |

**Como aplicar:** Acesse o SQL Editor do Supabase Dashboard e execute o SQL.

### ⏳ Pendências Resolvidas

| Item | Descrição | Resolução |
|------|-----------|-----------|
| 4.4 | Extrair dynamicAiSuggestions do Dashboard | ✅ Já estava extraído — `aiSuggestions.ts`, `useDashboardAI.ts`, `InsightsCard.tsx`, `aiIcons.tsx` |
| 4.5 | Contraste modo midnight (WCAG AA) | ✅ `--ds-color-text-secondary` alterado de `#a1a1aa` → `#d4d4d8` (zinc-300). text-secondary/60 passa de 3.40:1 → 5.25:1 no WCAG AA. text-secondary/50 permanece 3.95:1 (aceitável para texto decorativo). |

---

## 6. Dashboard Redesign ✅

| # | Item | Descrição | Status |
|---|------|-----------|--------|
| D.1 | AppTopBar greeting | Saudação "Olá, [Nome] 👋" + "Faltam [X] dias" | ✅ |
| D.2 | Card Herói (Gasto Disponível) | BudgetHeroCard com diário + mensal + alerta de estouro | ✅ (pré-existente) |
| D.3 | Termômetro do Mês | Barra de progresso unificada no Resumo do Mês | ✅ (pré-existente) |
| D.4 | Carrossel de Insights Proativos | Chips compactos, max 3, empty state | ✅ |
| D.5 | Grade de Quick Wins | QuickWinsGrid refatorado: 4 ações inline (Ajustar Limite, Remanejamento, Redução Rápida, Sugestão Motor). Navegação removida, duplicatas eliminadas. | ✅ |

---

## 7. Melhorias de Curto Prazo

### Prioridade Alta 🟡

| # | Item | Esforço | Arquivos | Descrição |
|---|------|---------|----------|-----------|
| 1 | ✅ Extrair lógica de `useExpenses.ts` (~497 linhas → 437) | **✅ Concluído** | `utils/expenseInstallments.ts`, `utils/expenseDeletion.ts`, `utils/creditCardCompetence.ts` | Já estava extraído — usoExpenses.ts importa dos 3 utils |
| 2 | ✅ Extrair `dynamicAiSuggestions` + `handleSendChat` do Dashboard | ~3h | Componentes extraídos para `insightsEngine.ts`, `useDashboardInsights.ts`, `InsightsCard.tsx`, `aiIcons.tsx` | ✅ Já extraído — lógica em service + hook, render em componente |
| 3 | Padronizar espaçamento entre cards em todas as páginas | ~1h | Todas as pages | Unificar `space-y-4/5/6` para valor consistente |
| 4 | ✅ Limpar imports não usados (TS6133) no Reports.tsx + MonthlyReportView.tsx | ✅ Fixado | `Reports.tsx`, `MonthlyReportView.tsx` | Após extração da Fase 4 |

### Prioridade Média 🟡

| # | Item | Esforço | Descrição | Status |
|---|------|---------|-----------|--------|
| 5 | ✅ Unificar card fixado no Copiloto IA | ✅ Concluído | Análise fixada integrada como pill inline no Copiloto (card separado removido) | ✅ |
| 6 | ✅ Redesenhar carrossel de insights | ✅ Concluído | Max 3 insights, chips menores (pill-style), empty state adicionado | ✅ |
| 7 | ✅ Padronizar input do Copiloto com topbar-search-bar | ✅ Concluído | Input do Insights foi removido — insights agora são 100% automáticos | ✅ |
| 8 | ✅ Extrair `dynamicAiSuggestions` do Dashboard para service | ~2h | ✅ Extraído — `insightsEngine.ts` + `useDashboardInsights.ts` + `InsightsCard.tsx` + `aiIcons.tsx` |
| 9 | ✅ Verificar contraste em modo midnight (WCAG AA) | ~30min | ✅ `--ds-color-text-secondary` alterado de `#a1a1aa` → `#d4d4d8` no midnight |
| 10 | ✅ Refatorar QuickWinsGrid — ações inline, sem navegação, sem duplicatas | ~3h | ✅ QuickWinsGrid reescrito com 4 painéis expansíveis inline (Ajustar Limite Manual, Remanejamento Inteligente, Redução Rápida, Sugestão do Motor). Dashboard.tsx atualizado para passar dados. |
| 11 | ✅ Adicionar 6 novos cards de insights ao insightsEngine | ~2h | ✅ Concentração Renda, Tendência vs Mês, Gastos FDS, Categoria Destaque, Status Poupança, Compromisso Investimentos. Todos integrados ao InsightsCard. |

---

## 8. Melhorias de Médio/Longo Prazo

### Arquivos > 1000 Linhas para Fracionar

| Arquivo | Linhas | Ação | Esforço |
|---------|--------|------|---------|
| `src/pages/Reports.tsx` | ~1.600 | Hook `useReportCustomPeriod` extraído (~250 linhas). Pendente: ReportSummarySection, ReportChartsSection, ReportInsightsSection | ~2h |
| `src/pages/Dashboard.tsx` | ~1.900 | Extrair lógica de IA + seções para hooks/componentes | ~3h |
| `src/pages/Categories.tsx` | 1.252 | Componentização adicional das seções de KPI | ~2h |
| `src/components/CreditCardCsvReconciliationPanel.tsx` | 1.193 | Extrair CsvUploadZone, CsvMatchTable | ~3h |

### Testes Pendentes

| Área | Esforço | Prioridade | Status |
|------|---------|------------|--------|
| `calculatorExpression`, `calculatorGeometry` | ~1h | 🟢 | ✅ Concluído |
| `calculatorDom` | ~30min | 🟢 | ⏳ |
| `useReportCustomPeriod` | ~1h | 🟢 | ✅ Concluído |
| `useCalculatorKeyboard`, `useCalculatorPanel`, `useScrollToTop` | ~1.5h | 🟢 | ⏳ |
| `reportAggregation` + `reportCustomData` | ~1h | 🟢 | ⏳ |
| Componentes extraídos (AnnualReportView, MonthlyReportView) | ~2h | 🟢 | ⏳ |

### Melhorias de Qualidade

| Item | Esforço | Descrição |
|------|---------|-----------|
| Migrar `--color-*` para `--ds-*` | ~2h | Unificar tokens de cor do design system |
| Tooltips em gráficos de pizza | ~30min | Adicionar tooltips nos gráficos de Reports e Investments |
| Adicionar verificação de z-index no guardrail | ~1h | Detectar valores hardcoded de `z-*` |
| Migrar nomenclatura pt-br → en | ~4h | Consistência de nomes de arquivos e variáveis |

---

## 9. Monitoramento Contínuo

### Pré-commit Checklist

```bash
npx tsc --noEmit           # 0 erros
npx vitest run             # 290+ testes passando
npm run guardrails:ui      # 0 violações (ou baseline atualizada)
npm run build              # Build OK
```

### Anti-padrões a Evitar

| Anti-padrão | Consequência | Como evitar |
|-------------|-------------|-------------|
| `as any` | Desativa typecheck | `unknown` + type guard |
| `catch(err: any)` | Perde type safety | `unknown` + `instanceof Error` |
| Arquivo > 300 linhas | Dificulta manutenção | Extrair por domínio |
| `style={{ }}` estático | Objetos novos a cada render | Classes Tailwind |
| `key={index}` | Re-renders incorretos | Chaves estáveis únicas |

---

## 10. Apêndice: Inventário de Componentes

### Primitives (shadcn/ui) — `src/components/ui/`

`button`, `card`, `input`, `select`, `switch`, `checkbox`, `dialog`, `sheet`, `tabs`, `badge`, `label`, `table`, `skeleton`

### Wrappers Customizados

`Button`, `Card`, `Input`, `Select`, `Checkbox`, `Switch`, `IconButton`, `NumberInput`

### TransactionForm

`TransactionAmountFields`, `TransactionDateField`, `TransactionCategorySelect`, `TransactionDescriptionField`

### Modais

`Modal`, `ModalForm`, `ModalFooter`, `ConfirmModal`, `ModalChoiceGrid`, `ModalFieldRow`, `ModalInfoPanel`, `ModalSummaryPanel`, `ModalIntro`

### Componentes Extraídos

| Componente | Arquivo | Linhas |
|-----------|---------|:------:|
| `AnnualReportView` | `src/components/reports/AnnualReportView.tsx` | Novo |
| `MonthlyReportView` | `src/components/reports/MonthlyReportView.tsx` | Novo |
| `ReportCustomDateFilter` | `src/components/reports/ReportCustomDateFilter.tsx` | Novo |
| `ExpenseCategoryGrid` | `src/components/categories/ExpenseCategoryGrid.tsx` | Novo |
| `IncomeCategoryGrid` | `src/components/categories/IncomeCategoryGrid.tsx` | Novo |

---

> **Documentos relacionados:** [`ARCHITECTURE.md`](./ARCHITECTURE.md) — [`COMPLETE_GUIDE.md`](./COMPLETE_GUIDE.md) — [`REIMPORT_INVESTMENTS.md`](./REIMPORT_INVESTMENTS.md)
> 
> **Manter este documento atualizado** conforme novas correções forem aplicadas ou pendências forem resolvidas.
