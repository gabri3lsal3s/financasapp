# Próximos Passos — Manutenção, Refatoração e Melhorias do Copiloto IA

> **Data:** Julho de 2026
> **Propósito:** Guia de ações necessárias para manter o app saudável, continuar refatorações e melhorar o card de análise IA.

---

## 📊 Estado Atual do Projeto

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
| Maior arquivo | **2.276 linhas** (Reports.tsx) | 🟡 |
| Dashboard.tsx | **~1.900+ linhas** | 🟡 |
| Notificações | **Unificadas** em NotificationsOverlay (app-top-bar) | ✅ |
| Top Bar alinhado | **Padronizado** com wrapper de Layout (px-3 sm:px-6 lg:px-6) | ✅ |
| SmartLimitSuggestions | **Dead code** — nunca importado, mantido para referência | 🟤 |
| 3 botões de ação removidos | Revisar Assinaturas, Desafios de Economia, Limites por Categoria | ✅ |
| Label "base" removido | LimitsControl.tsx — não aparece mais nas pills | ✅ |

---

## 1. 🔴 Aplicar Migration no Supabase

A correção do overflow requer alteração no schema. Migration em `supabase/migrations/20260629_fix_numeric_overflow.sql`.

```bash
supabase migration up
# Ou via SQL Editor do Supabase
```

### O que a migration faz:

| Tabela | Colunas | Tipo Antigo → Novo |
|--------|---------|-------------------|
| `portfolio_share_daily` | `gross_pl`, `net_pl`, `cash_value`, `invested_cost` | `DECIMAL(15,2)` → `DECIMAL(18,2)` |
| `portfolios` | `cash_balance`, `last_gross_pl`, `last_net_pl` | `DECIMAL(15,2)` → `DECIMAL(18,2)` |
| `portfolio_period_snapshots` | `somatorio_aportes`, `somatorio_resgates`, `dividendos_recebidos` | `DECIMAL(15,2)` → `DECIMAL(18,2)` |
| `portfolio_asset_definitions` | `applied_amount`, `manual_current_value` | `DECIMAL(15,2)` → `DECIMAL(18,2)` |

---

## 2. 🟡 Novo — Card de IA (Copiloto): Diagnóstico e Melhorias

### 2.1 Diagnóstico — 6 Problemas Identificados

| # | Problema | Impacto | Local |
|---|----------|---------|-------|
| 1 | **Card fixado duplicado** — Análise pinned renderizada em Card separado, com header + workspace duplicados | 🔴 UX: redundância visual | `Dashboard.tsx` ~1500-1560 |
| 2 | **Carrossel inchado** — 6 insights em cards `w-64` com glass completo; some sem empty state | 🟡 Espaço vertical | `Dashboard.tsx` ~1420-1450 |
| 3 | **Input inconsistente** — Usa `bg-secondary/5` em vez de `surface-glass-strong` da topbar | 🟡 Visual | `Dashboard.tsx` ~1455-1470 |
| 4 | **BeautifulMarkdown limitado** — Só `**bold**`, `# header`, `• bullets`; sem links, listas, code | 🟡 Funcionalidade | `BeautifulMarkdown.tsx` |
| 5 | **InteractiveAIChart frágil** — Auto-detecção com `string.includes()` hardcoded | 🟡 Confiabilidade | `InteractiveAIChart.tsx` |
| 6 | **Lógica inchada** — `dynamicAiSuggestions` (+200 linhas) e `handleSendChat` (+150 linhas) inline | 🟡 Manutenibilidade | `Dashboard.tsx` |
| 7 | **Fallback mockado no geminiService** — `simulateAssistantResponseClient` com dados hardcoded | 🟡 Confiabilidade | `geminiService.ts` |

### 2.2 Plano de Melhorias

| # | Melhoria | Esforço | Prioridade |
|---|----------|---------|------------|
| 1 | **Unificar card fixado no principal** — Pinned analysis vira modo dentro do card, não card separado | ~2h | 🔴 Alta |
| 2 | **Redesenhar carrossel** — Max 3 insights, chips menores, empty state, "Ver mais" opcional | ~1.5h | 🔴 Alta |
| 3 | **Padronizar input com topbar** — Usar `topbar-search-bar` / `surface-glass-strong` | ~30min | 🟡 Média |
| 4 | **Extrair lógica do Dashboard** — `dynamicAiSuggestions` → service, `handleSendChat` → split NL parser | ~3h | 🟡 Média |
| 5 | **Melhorar BeautifulMarkdown** — Suporte a links, listas, código inline; remover tamanhos fixos | ~1h | 🟢 Baixa |
| 6 | **Remover fallback mockado** — Mostrar erro amigável em vez de dados fictícios | ~30min | 🟢 Baixa |

**Total estimado:** ~8.5h

---

## 3. 🟡 Pendências Técnicas

### Prioridade Média

| # | Item | Arquivo | Esforço | Status |
|---|------|---------|---------|--------|
| 1 | Extrair lógica de parcelamento/deleção de `useExpenses.ts` (~497 linhas) | `useExpenses.ts` | ~3h | ⏳ |
| 2 | Extrair `dynamicAiSuggestions` + `handleSendChat` do Dashboard | `Dashboard.tsx` | ~3h | ⏳ |
| 3 | Fracionar Categories.tsx (~1.252 linhas) | `Categories.tsx` | ~3h | ⏳ |

### Prioridade Baixa

| # | Item | Esforço | Status |
|---|------|---------|--------|
| 4 | Testes unitários para `calculatorExpression`, `calculatorGeometry`, `calculatorDom` | ~1h | ⏳ |
| 5 | Testes para `useCalculatorKeyboard`, `useCalculatorPanel`, `useScrollToTop` | ~1.5h | ⏳ |
| 6 | Testes para `reportAggregation` + `reportCustomData` | ~1h | ⏳ |
| 7 | Migrar `--color-*` para `--ds-*` | ~2h | ⏳ |
| 8 | Tooltips em gráficos de pizza | ~30min | ⏳ |

---

## 4. ✅ Refatorações Concluídas

### 4.1 ✅ TopBar alinhado com wrapper de Layout

- Padding horizontal: `px-3 sm:px-6 lg:px-6 lg:xl:px-8` (mesmo do content wrapper em Layout.tsx)
- Gap após TopBar: `mb-5` (match `space-y-5` dos cards)
- Cantos arredondados: `rounded-2xl` (16px, igual cards)
- **Corrigido:** Antes usava `px-[1.75rem] sm:px-10 lg:px-12` (soma incorreta com padding interno das páginas)

### 4.2 ✅ Notificações unificadas

- `NotificationsOverlay` substitui 3 UIs diferentes (mobile modal, desktop dropdown, desktop card)
- Mesmo padrão do SearchOverlay: backdrop blur + `max-w-xl` centrado + animação spring do topo
- Bell button com estado local unificado (sem distinção mobile/desktop)

### 4.3 ✅ 3 botões de ação removidos do Dashboard

- **Removidos:** "Revisar Assinaturas", "Desafios de Economia", "Limites por Categoria"
- Substituídos por placeholder para cards contextuais
- Imports `Percent` e `ACTION_GRID` limpos

### 4.4 ✅ Label "base" removido do LimitsControl

- O texto "base {valor}" não aparece mais nos pills de categorias
- O valor base continua visível apenas no modal de detalhamento

### 4.5 ✅ FloatingCalculator — Extração (3 utils + 2 hooks)

- `calculatorExpression.ts`, `calculatorGeometry.ts`, `calculatorDom.ts`
- `useCalculatorKeyboard.ts`, `useCalculatorPanel.ts`
- **Impacto:** -462 linhas no FloatingCalculator.tsx

### 4.6 ✅ Reports.tsx — Extração (-843 linhas)

- `reportAggregation.ts`, `reportCustomData.ts`
- `ReportPendingDebtsWidget.tsx`, `ReportUnifiedCompositionCard.tsx`

### 4.7 ✅ Contas.tsx — Extração (-377 linhas)

- `useContasBills.ts`, `useContasModals.ts`

### 4.8 ✅ FloatingActionHub Extraído (-470 linhas)

- `useScrollToTop.ts`, `haptics.ts`

### 4.9 ✅ Correções de Bugs

| # | Correção | Severidade |
|---|----------|------------|
| 1 | **Loop infinito no useSupabaseTable** — configRef pattern | 🔴 Crítica |
| 2 | **CSS spacing bug** — `h - 2 w - 2` em Settings.tsx | 🔴 Visual |
| 3 | **CSS spacing bug** — `rounded - lg border p - 3` em Settings.tsx | 🔴 Visual |
| 4 | **Overflow DECIMAL(15,2)** — Migration DECIMAL(18,2) | 🔴 Crash |
| 5 | **Select.Item value=""** — sentinel value `__empty__` | 🔴 Erro |
| 6 | **InfoTooltip z-index/overflow clipping** — Reescrevido com portal | 🔴 Visual |
| 7 | **PageActionButtonHub hover** — Padronizado com nav sidebar | 🔴 Visual |
| 8 | **Inline styles → classes** — ~30 migrados em ReportCharts + TransactionCard | 🟡 |

---

## 5. 📋 Novos Arquivos Criados

### Sessão atual (Julho 2026)

| Arquivo | Linhas | Propósito |
|---------|--------|-----------|
| `src/utils/expenseDeletion.ts` | ~90 | Lógica de exclusão de despesas |
| `src/utils/creditCardCompetence.ts` | ~70 | Competência de fatura de cartão |
| `src/hooks/useDashboardPortfolio.ts` | ~55 | Hook de carregamento de portfólio |
| `src/hooks/useDashboardData.ts` | ~290 | Hook de agregação de dados + tipos |
| `src/hooks/useDashboardAI.tsx` | ~530 | Hook do Copiloto de IA |
| `src/components/dashboard/BudgetHeroCard.tsx` | ~65 | Card herói de gasto disponível |
| `src/components/dashboard/ProjectionCard.tsx` | ~105 | Card de projeção de fim do mês |

### Sessão anterior (Junho 2026)

| Arquivo | Linhas | Propósito |
|---------|--------|-----------|
| `calculatorExpression.ts`, `calculatorGeometry.ts`, `calculatorDom.ts` | ~240 | Utilitários da calculadora |
| `reportAggregation.ts`, `reportCustomData.ts` | ~921 | Utilitários de relatórios |
| `checkDbRates.test.ts` | ~59 | Teste de taxas |
| `haptics.ts` | ~25 | Vibração haptic |
| `ReportPendingDebtsWidget.tsx`, `ReportUnifiedCompositionCard.tsx` | ~180 | Componentes de relatórios |
| `useCalculatorKeyboard.ts`, `useCalculatorPanel.ts` | ~311 | Hooks da calculadora |
| `useContasBills.ts`, `useContasModals.ts` | ~815 | Hooks de contas |
| `useScrollToTop.ts` | ~220 | Hook de scroll-to-top |

---

## 6. 🔍 Monitoramento Contínuo

### Pré-commit checklist

```bash
npx tsc --noEmit           # 0 erros
npx vitest run             # 290+ testes passando
npm run guardrails:ui      # 0 violações (ou baseline atualizada)
npm run build              # Build OK
```

---

## 7. 📚 Documentação Relacionada

| Documento | Link | Conteúdo |
|-----------|------|----------|
| Arquitetura | `docs/ARCHITECTURE.md` | Visão geral do sistema, hooks, componentes |
| Plano de Melhorias | `docs/IMPROVEMENT_PLAN.md` | Prioridades e anti-padrões |
| Guia Completo | `docs/COMPLETE_GUIDE.md` | Stack, páginas, setup |
| Auditoria | `docs/AUDITORIA_REVISAO.md` | Diagnóstico técnico completo |
| Refatoração | `docs/REFACTORING_PLAN.md` | Plano de refatoração anterior |
| Refinamento UI/UX | `docs/REFINEMENT_PLAN.md` | Plano de refinamento visual |
| Importação B3 | `docs/REIMPORT_INVESTMENTS.md` | Guia de reimportação de extrato |

---

> **Mantenha este documento atualizado** conforme novas correções forem aplicadas ou novas pendências forem identificadas.
