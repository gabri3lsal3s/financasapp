# Plano de Refinamento — FinançasApp (Consolidado)

> **Última atualização:** Julho de 2026
> **Propósito:** Documento único consolidando todo o planejamento de refatoração, refinamento e melhorias do aplicativo — tanto concluído quanto pendente.
> **Substitui:** `AUDITORIA_REVISAO.md`, `REFACTORING_PLAN.md`, `IMPROVEMENT_PLAN.md`, `REFINEMENT_PLAN.md`, `NEXT_STEPS.md`, `SEARCH_IMPROVEMENT_PLAN.md`

---

## Sumário

1. [Estado Atual do Projeto](#1-estado-atual-do-projeto)
2. [Fases Concluídas](#2-fases-concluídas)
3. [Correções de Bugs](#3-correções-de-bugs)
4. [Melhorias de UI/UX Concluídas](#4-melhorias-de-uiux-concluídas)
5. [Pendências Técnicas](#5-pendências-técnicas)
6. [Melhorias de Curto Prazo](#6-melhorias-de-curto-prazo)
7. [Melhorias de Médio/Longo Prazo](#7-melhorias-de-médiolongo-prazo)
8. [Monitoramento Contínuo](#8-monitoramento-contínuo)
9. [Apêndice: Inventário de Componentes](#9-apêndice-inventário-de-componentes)

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
| Testes passando | **290/290** (31 arquivos) | ✅ |
| Build | **OK** | ✅ |
| UI Guardrails | **21 na baseline** | 🟡 |
| `as any` em produção | **0** | ✅ |
| Non-null assertions em produção | **0** | ✅ |
| `catch(err: any)` | **0** | ✅ |
| `console.log` residual | **0** | ✅ |
| `style={{ }}` em produção | **< 50 ocorrências** | 🟡 |
| Maior arquivo | **~1.925 linhas** (Reports.tsx) | 🟡 |
| Dashboard.tsx | **~1.900+ linhas** | 🟡 |
| Componentes | **130+** | ✅ |
| Hooks customizados | **35+** | ✅ |
| Migrations | **43** | ✅ |

### Rotas do App

| Rota | Página | Descrição |
|------|--------|-----------|
| `/` | Dashboard | KPIs, fluxo diário, Copiloto IA, limites |
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

### 🔴 Migration Pendente no Supabase

A correção do overflow DECIMAL(15,2) precisa ser aplicada via migration:

```bash
supabase migration up
# Ou via SQL Editor do Supabase
```

**Migration:** `supabase/migrations/20260629_fix_numeric_overflow.sql`

| Tabela | Colunas | Tipo Antigo → Novo |
|--------|---------|-------------------|
| `portfolio_share_daily` | `gross_pl`, `net_pl`, `cash_value`, `invested_cost` | `DECIMAL(15,2)` → `DECIMAL(18,2)` |
| `portfolios` | `cash_balance`, `last_gross_pl`, `last_net_pl` | `DECIMAL(15,2)` → `DECIMAL(18,2)` |
| `portfolio_period_snapshots` | `somatorio_aportes`, `somatorio_resgates`, `dividendos_recebidos` | `DECIMAL(15,2)` → `DECIMAL(18,2)` |
| `portfolio_asset_definitions` | `applied_amount`, `manual_current_value` | `DECIMAL(15,2)` → `DECIMAL(18,2)` |

---

## 6. Melhorias de Curto Prazo

### Prioridade Alta 🟡

| # | Item | Esforço | Arquivos | Descrição |
|---|------|---------|----------|-----------|
| 1 | Extrair lógica de `useExpenses.ts` (~497 linhas) | ~3h | `utils/expenseInstallments.ts`, `utils/expenseDeletion.ts`, `utils/creditCardCompetence.ts` | Parcelamento, competência cartão, exclusão single/all/subsequent |
| 2 | Extrair `dynamicAiSuggestions` + `handleSendChat` do Dashboard | ~3h | `services/aiSuggestions.ts`, `hooks/useDashboardAI.ts` | Lógica de insights + NL parser do Copiloto IA |
| 3 | Padronizar espaçamento entre cards em todas as páginas | ~1h | Todas as pages | Unificar `space-y-4/5/6` para valor consistente |
| 4 | ✅ Limpar imports não usados (TS6133) no Reports.tsx + MonthlyReportView.tsx | ~30min | `Reports.tsx`, `MonthlyReportView.tsx` | Após extração da Fase 4 | ✅ Fixado |

### Prioridade Média 🟡

| # | Item | Esforço | Descrição |
|---|------|---------|-----------|
| 5 | Unificar card fixado no Copiloto IA | ~2h | Remover a funcionalidade de Pinned |
| 6 | Redesenhar carrossel de insights | ~1.5h | Max 3 insights, chips menores, empty state |
| 7 | Padronizar input do Copiloto com topbar | ~30min | Usar `topbar-search-bar` / `surface-glass-strong` |
| 8 | Extrair `dynamicAiSuggestions` do Dashboard para service | ~2h | Reduzir Dashboard.tsx em ~200 linhas |
| 9 | Verificar contraste em modo midnight (WCAG AA) | ~30min | text-secondary + border-glass no modo escuro |

---

## 7. Melhorias de Médio/Longo Prazo

### Arquivos > 1000 Linhas para Fracionar

| Arquivo | Linhas | Ação | Esforço |
|---------|--------|------|---------|
| `src/pages/Reports.tsx` | ~1.925 | Extrair seções restantes (ReportSummarySection, ReportChartsSection, ReportInsightsSection) | ~3h |
| `src/pages/Dashboard.tsx` | ~1.900 | Extrair lógica de IA + seções para hooks/componentes | ~3h |
| `src/pages/Categories.tsx` | 1.252 | Componentização adicional das seções de KPI | ~2h |
| `src/components/CreditCardCsvReconciliationPanel.tsx` | 1.193 | Extrair CsvUploadZone, CsvMatchTable | ~3h |

### Testes Pendentes

| Área | Esforço | Prioridade |
|------|---------|------------|
| `calculatorExpression`, `calculatorGeometry`, `calculatorDom` | ~1h | 🟢 |
| `useCalculatorKeyboard`, `useCalculatorPanel`, `useScrollToTop` | ~1.5h | 🟢 |
| `reportAggregation` + `reportCustomData` | ~1h | 🟢 |
| Componentes extraídos (AnnualReportView, MonthlyReportView) | ~2h | 🟢 |

### Melhorias de Qualidade

| Item | Esforço | Descrição |
|------|---------|-----------|
| Migrar `--color-*` para `--ds-*` | ~2h | Unificar tokens de cor do design system |
| Tooltips em gráficos de pizza | ~30min | Adicionar tooltips nos gráficos de Reports e Investments |
| Adicionar verificação de z-index no guardrail | ~1h | Detectar valores hardcoded de `z-*` |
| Migrar nomenclatura pt-br → en | ~4h | Consistência de nomes de arquivos e variáveis |

---

## 8. Monitoramento Contínuo

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

## 9. Apêndice: Inventário de Componentes

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
