# Plano de Refinamento — FinançasApp

> **Data:** Junho de 2026
> **Propósito:** Análise detalhada de UI/UX, funcionalidade e performance — mobile e desktop — com plano de implementação por fases.
> **Baseado em:** Auditoria de código, análise de componentes, padrões de CSS/TSX, revisão de acessibilidade e estados.

---

## Sumário

1. [Resumo das Fragilidades Identificadas](#1-resumo-das-fragilidades-identificadas)
2. [Fase 1 — 🎨 Consistência Visual e CSS](#2-fase-1--consistência-visual-e-css)
3. [Fase 2 — ♿ Acessibilidade e Input](#3-fase-2--acessibilidade-e-input)
4. [Fase 3 — 📱 Mobile First e Touch](#4-fase-3--mobile-first-e-touch)
5. [Fase 4 — 🖥️ Desktop e Layout](#5-fase-4--desktop-e-layout)
6. [Fase 5 — ⚡ Performance](#6-fase-5--performance)
7. [Fase 6 — 🧩 Estados e Resiliência](#7-fase-6--estados-e-resiliência)
8. [Fase 7 — 🌗 Temas e Modos](#8-fase-7--temas-e-modos)
9. [Métricas de Sucesso](#9-métricas-de-suceddo)
10. [Apêndice: Inventário de Inline Styles](#10-apêndice-inventário-de-inline-styles)

---

## 1. Resumo das Fragilidades Identificadas

### 🔴 Críticas

| # | Fragilidade | Impacto | Localização |
|---|------------|---------|-------------|
| C1 | **92+ `style={{ }}` inline** em produção | Renderização, manutenibilidade, consistência | 30+ arquivos TSX |
| C2 | **15+ `!important`** no CSS global | Dificulta sobreposição e temas | `src/index.css` |
| C3 | **`console.log` em testes e edge function** | Ruído, produção com log residual | `portfolioTwrEngine.test.ts`, `portfolioHistoricalRecalc.test.ts`, `daily-close/index.ts` |
| C4 | **`setCache().catch(e => logger.error(e))` sem feedback** | Erro silencioso para o usuário | 7+ hooks (useCategories, useIncomeCategories, useDebts, useSupabaseTable, etc.) |
| C5 | **Theme transition 450ms com `!important`** | Jank/lag em troca de tema | `index.css` linhas 124-136 |

### 🟡 Médias

| # | Fragilidade | Impacto | Localização |
|---|------------|---------|-------------|
| M1 | **Estados vazios inconsistentes** | UX inconsistente entre páginas | `Expenses.tsx`, `Incomes.tsx`, `Contas.tsx`, `Categories.tsx`, `Reports.tsx` |
| M2 | **`var(--color-*)` vs classes `text-*`** | Duplicidade de tokens CSS | `DashboardKpis.tsx`, `TransactionCard.tsx`, `Investments.tsx` |
| M3 | **Floating elements sem gestão de conflito** | Sobreposição entre calculator, FAB hub, toast | `FloatingCalculator.tsx`, `PageActionButtonHub.tsx`, `NetworkStatusToast.tsx` |
| M4 | **ErrorBoundary com fallback básico** | Experiência pobre em crash | `ErrorBoundary.tsx` |
| M5 | **Focus outline inconsistency** | Acessibilidade parcial | 20+ componentes com padrões diferentes |

### 🟢 Baixas

| # | Fragilidade | Impacto | Localização |
|---|------------|---------|-------------|
| B1 | **`-webkit-` prefixed properties no CSS** | Depreciação futura | `index.css` |
| B2 | **Animação `animate-pulse` em Loader tsx** | Performance reduzida | `Loader.tsx` |
| B3 | **Overflow-x em tabs de investimentos** | Scroll horizontal inestético | `Investments.tsx` |
| B4 | **KPI text sizing com `text-[9px]`** | Legibilidade em certos dispositivos | `KpiCard.tsx`, `Contas.tsx` |
| B5 | **Campo `placeholder` vs label** | Acessibilidade de formulários | `AmountInput.tsx`, `TransactionAmountFields.tsx` |

---

## 2. Fase 1 — 🎨 Consistência Visual e CSS

### 2.1 Eliminar Inline Styles (C1)

**Problema:** 92+ ocorrências de `style={{ }}` espalhadas por 30+ arquivos. Isso:
- Cria objetos novos a cada render (impacto em performance)
- Dificulta manutenção de temas
- Viola o princípio de design system

**Ação:** Migrar inline styles para classes Tailwind ou variáveis CSS.

#### Tabela de Substituições Prioritárias

| Arquivo | Ocorrências | Inline Style Atual | Classe Tailwind Equivalente |
|---------|-------------|-------------------|---------------------------|
| `DashboardKpis.tsx` | 4 | `style={{ borderLeftColor: 'var(--color-income)' }}` | `border-l-income` |
| `KpiCard.tsx` | 2 | `style={{ backgroundColor: glowColor }}` | `bg-[var(--ds-glow)]` ou classe dedicada |
| `TransactionCard.tsx` | 20+ | `style={{ color: 'var(--ds-*)' }}` | `text-primary`, `text-secondary`, `text-expense` |
| `Investments.tsx` | 1 | `style={{ backgroundColor: cashValue > 0 ? '...' : '...' }}` | Classe condicional |
| `Categories.tsx` | 6 | `style={{ color: categoryColor }}` | Classe dinâmica com `style` só quando necessário |
| `Contas.tsx` | 1 | `style={{ backgroundColor: card.color }}` | Aceitável (cor dinâmica) — manter |
| `PageActionButtonHub.tsx` | 4 | `style={{ color: iconColor, pointerEvents }}` | Aceitável para dinâmicos — consolidar |
| `FloatingActionHub.tsx` | 1 | `style={{ transform, opacity }}` | Aceitável (animação) |
| `CategoryBadge.tsx` | 1 | `style={{ backgroundColor: normalizedColor }}` | Aceitável (cor dinâmica) |
| `CategoryColorBar.tsx` | 1 | `style={{ backgroundColor: mappedColor }}` | Aceitável (cor dinâmica) |
| `FloatingCalculator.tsx` | 4 | `style={{ left, top, transform }}` | Aceitável (posição dinâmica) |
| `ReportCharts.tsx` | 3 | `style={{ marginBottom }}` | Classe `mb-*` |
| `AssetDetailModal.tsx` | 2 | `style={{ left: posição }}` | Aceitável (posição dinâmica) |
| `SmartAporteSimulator.tsx` | 2 | `style={{ width }}` | Aceitável (dinâmico) |

**Esforço estimado:** ~4h

### 2.2 Reduzir `!important` (C2)

**Problema:** 15+ ocorrências de `!important` no CSS global dificultam manutenção.

**Ação:** Substituir por especificidade adequada.

| Local | `!important` Atual | Substituição |
|-------|-------------------|--------------|
| Theme transition (L124-136) | `transition: background-color 0.45s ease !important` | Usar `@layer` ou classes específicas |
| `display: none !important` (L176, 205) | Scrollbar hiding | Usar `scrollbar-none` Tailwind |
| Sidebar transform (L380) | `transform: translate(0, 0) !important` | Aumentar especificidade com `[data-state="expanded"]` |

**Esforço estimado:** ~1h

### 2.3 Migrar `var(--color-*)` para Classes Temáticas (M2)

**Problema:** Uso misto de `var(--color-income)` e `text-income`. As variáveis `--color-*` são aliases, mas usar classes é mais limpo e performático.

**Ação:** Substituir `style={{ borderLeftColor: 'var(--color-income)' }}` por classe `border-l-income` e similares.

**Arquivos alvo:** `DashboardKpis.tsx`, `TransactionCard.tsx`, `KpiCard.tsx`, `ReportsCategoryRowButton.tsx`

**Esforço estimado:** ~2h

### 2.4 Unificar Estados Vazios (M1)

**Problema:** Cada página implementa empty state de forma diferente:
- `Expenses.tsx`: `<p className="text-secondary">Nenhuma despesa no mês selecionado.</p>`
- `Incomes.tsx`: `<p className="text-secondary">Nenhuma renda no mês selecionado.</p>`
- `Categories.tsx`: `<p className="...">Nenhuma categoria...</p>`
- `Contas.tsx`: `<p className="text-secondary text-sm">Nenhuma pendência ativa...</p>`
- `Reports.tsx`: `<p className="text-secondary">Sem dados consolidados...</p>`

**Ação:** Criar componente `EmptyState` padronizado:

```tsx
interface EmptyStateProps {
  icon?: React.ReactNode
  title: string
  description?: string
  action?: { label: string; onClick: () => void }
}
```

- Ícone opcional (Inbox, SearchX, etc.)
- Título + descrição
- CTA opcional
- Animação fade-in

**Esforço estimado:** ~2h
**Arquivos a modificar:** 8 páginas + 1 novo componente

### 2.5 Remover `console.log` Residual (C3)

**Problema:** `console.log` em arquivos de teste e edge function.

| Arquivo | Linha | Código |
|---------|-------|--------|
| `portfolioTwrEngine.test.ts` | 515 | `console.log('Final row details...')` |
| `portfolioHistoricalRecalc.test.ts` | 259 | `console.log('--- UPSERTED DAILY ROWS...')` |
| `daily-close/index.ts` | 249 | `console.log('[daily-close] Deleted...')` |
| `daily-close/index.ts` | 320 | `console.warn(...)` |
| `daily-close/index.ts` | 591 | `console.error(...)` |

**Ação:** Remover ou substituir por logger.

**Esforço estimado:** ~15min

---

## 3. Fase 2 — ♿ Acessibilidade e Input

### 3.1 Padronizar Focus Ring (M5)

**Problema:** Diferentes padrões de focus ring:
- `focus:ring-2 focus:ring-[var(--color-focus)]` — padrão
- `focus:ring-ring` — Radix UI
- `focus:ring-0 focus:outline-none` — TransactionCard (desabilitado)
- `focus:outline-none focus:border-brand` — Scuttlebutt inputs
- `focus:ring-balance` — B3 checkbox

**Ação:** Criar classe utilitária `focus-standard` no CSS:
```css
.focus-standard {
  @apply focus:outline-none focus:ring-2 focus:ring-[var(--color-focus)] focus:ring-offset-2;
}
```

E migrar todos os componentes para usar essa classe.

**Esforço estimado:** ~1.5h

### 3.2 Melhorar Labels de Formulário (B5)

**Problema:** Alguns inputs usam `placeholder` como única dica visual (ex: `placeholder="Se vazio, usa o valor total"`). Placeholder não é substituto de label para acessibilidade.

**Ação:** Garantir que todos os inputs tenham `aria-label` ou `<label>` associado via `htmlFor`.

**Arquivos alvo:** `AmountInput.tsx`, `TransactionAmountFields.tsx`, `RefundIncomeEditModal.tsx`, `ExpenseEditModal.tsx`

**Esforço estimado:** ~1h

### 3.3 Melhorar ErrorBoundary (M4)

**Problema:** ErrorBoundary atual mostra erro genérico com opção de recarregar, mas é visualmente básico.

**Ação:** Melhorar fallback:
```tsx
<ErrorBoundary fallback={
  <div className="flex flex-col items-center justify-center p-12 gap-6">
    <AlertTriangle size={48} className="text-expense" />
    <h2 className="text-lg font-bold">Algo deu errado</h2>
    <p className="text-secondary text-sm text-center max-w-md">
      Ocorreu um erro inesperado. Tente recarregar a página.
    </p>
    <Button onClick={() => window.location.reload()}>
      <RefreshCw size={16} /> Recarregar
    </Button>
  </div>
} />
```

**Esforço estimado:** ~30min

### 3.4 ConfirmModal — Checkbox Acessível

**Problema:** `ConfirmModal.tsx` linha 56: `<input type="checkbox" className="... cursor-pointer" />` sem `aria-label` associado.

**Ação:** Adicionar `aria-label` ou label wrapping.

**Esforço estimado:** ~15min

---

## 4. Fase 3 — 📱 Mobile First e Touch

### 4.1 Gestão de Conflito de Elementos Flutuantes (M3)

**Problema:** Múltiplos elementos flutuantes competem por espaço:
- `FloatingCalculator` — bottom-left
- `PageActionButtonHub` — bottom-right
- `FloatingActionHub (ScrollToTop)` — bottom-right, acima do FAB
- `NetworkStatusToast` — bottom-right
- `PwaUpdatePrompt` — bottom-right

No mobile, com bottom nav ocupando a parte inferior, há conflito de espaço e z-index.

**Ação:**
1. **Auditar sobreposições reais** — Usar browser-use para verificar em breakpoints 375px, 768px, 1024px
2. **Ajustar posições dinamicamente** — Calculator em mobile pode ficar em tela cheia (já implementado parcialmente)
3. **Unificar notificações** — NetworkStatusToast + PwaUpdatePrompt + NotificationsWidget em um único container

**Esforço estimado:** ~3h

### 4.2 Revisão de Touch Targets

**Problema:** Embora a Rodada 3 tenha melhorado bottom nav e botões do TransactionCard, outros botões podem ter targets < 44px.

**Ação:** Verificar:
- Botões de ação inline em cards (editar/excluir em desktop compacto)
- Spin buttons do NumberInput
- Botões de fechar modais
- Ícones em Select options

**Esforço estimado:** ~1.5h

### 4.3 Transição Mobile Sheet → Desktop Dialog

**Problema:** Atualmente modais usam Sheet (mobile) e Dialog (desktop) via `useMediaQuery`. A transição é suave, mas alguns modais não têm essa adaptação.

**Ação:** Verificar se todos os modais usam `Modal.tsx` como base (que já implementa essa lógica) ou se algum modal foge do padrão.

**Esforço estimado:** ~1h

---

## 5. Fase 4 — 🖥️ Desktop e Layout

### 5.1 Sidebar Collapse State Persistência

**Problema:** O estado de expansão/contração da sidebar (`isDesktopMenuExpanded`) provavelmente reinicia ao recarregar a página.

**Ação:** Persistir no `localStorage`.

**Esforço estimado:** ~30min

### 5.2 KPI Spacing em Desktop Wide

**Problema:** KPIs em viewports >= 1280px (xl) usam `xl:grid-cols-4` mas sem max-width constraint, podendo ficar muito espalhados em monitores wide.

**Ação:** Adicionar `max-w-7xl mx-auto` nos containers de KPI ou usar `xl:max-w-6xl`.

**Esforço estimado:** ~15min

### 5.3 Reports Responsivo

**Problema:** Reports.tsx usa muitos breakpoints manuais. A seção de gráficos tem `grid grid-cols-1 md:grid-cols-2` mas em desktop wide os gráficos podem ficar desproporcionais.

**Ação:** Revisar layout dos relatórios em 1440px+.

**Esforço estimado:** ~1h

---

## 6. Fase 5 — ⚡ Performance

### 6.1 Otimizar Transição de Tema (C5)

**Problema:** A transição de tema atual (L124-136) aplica `transition: background-color 0.45s ease !important` em **todos os elementos** via `*`. Isso causa:
- Jank em dispositivos mais lentos
- 450ms pode ser muito longo para feedback visual
- `!important` impede override

**Ação:**
```css
.theme-transitioning,
.theme-transitioning * {
  transition: background-color 0.3s ease,
              color 0.3s ease,
              border-color 0.3s ease,
              box-shadow 0.3s ease;
}
/* Remover !important */
```

**Esforço estimado:** ~30min

### 6.2 Reduzir Re-renders com Inline Styles

**Problema:** Cada `style={{ }}` cria um novo objeto a cada render. 92+ ocorrências significa 92+ novos objetos por render tree.

**Ação:** Migrar os estáticos (não dinâmicos) para classes. Manter apenas os dinâmicos (posições, cores de categoria, animações).

**Benefício estimado:** Redução de ~70% dos inline styles (92 → ~28 dinâmicos necessários).

**Esforço estimado:** ~4h (já incluso em 2.1)

### 6.3 Verificar Dependências de useCallback/useMemo

**Problema:** Alguns `useCallback` podem ter dependências desnecessárias ou ausentes, causando re-renders em cascata.

**Ação:** Auditoria rápida nos componentes pesados (FloatingCalculator, Reports, Contas, Categories).

**Esforço estimado:** ~1h

---

## 7. Fase 6 — 🧩 Estados e Resiliência

### 7.1 Feedback de Erro em Operações Offline (C4)

**Problema:** 7+ hooks fazem `setCache(getCacheKey(), next).catch(e => logger.error(e))` — erro silencioso. Se o cache falhar, o usuário não sabe.

**Ação:** Adicionar toast de erro quando cache falha:
```typescript
.catch(e => {
  logger.error('Erro ao salvar cache:', e)
  toast.error('Erro ao salvar dados localmente. Tente novamente.')
})
```

**Arquivos:** `useCategories.ts`, `useIncomeCategories.ts`, `useDebts.ts`, `useSupabaseTable.ts`, `useExpenseCategoryLimits.ts`, `useBackgroundCache.ts`

**Esforço estimado:** ~1h

### 7.2 EmptyState Component (M1, já detalhado)

Ver seção 2.4.

### 7.3 Skeleton Timing e Transições

**Problema:** Skeletons aparecem e desaparecem abruptamente em alguns casos (ex: mudança de mês nas listas).

**Ação:** Adicionar `min-height` para evitar layout shift e usar `animate-out` para fade out suave.

**Esforço estimado:** ~1h

---

## 8. Fase 7 — 🌗 Temas e Modos

### 8.1 Reduzir Transição de Tema (C5, já detalhado)

Ver seção 6.1.

### 8.2 Verificar Contraste em Modo Midnight

**Problema:** O modo midnight (fundo muito escuro) pode ter problemas de contraste em elementos secundários.

**Ação:** Verificar se `text-secondary` e `border-glass` têm contraste suficiente (WCAG AA ≥ 4.5:1) no modo midnight.

**Esforço estimado:** ~30min

---

## 9. Métricas de Sucesso

| Métrica | Estado Atual | Meta Pós-Refinamento | Fase |
|---------|-------------|---------------------|------|
| `style={{ }}` em produção | 92+ ocorrências | < 30 (só dinâmicos) | Fase 1 |
| `!important` no CSS | 15+ | < 5 | Fase 1 |
| `console.log` residual | 5 ocorrências | 0 | Fase 1 |
| Empty states padronizados | 8 implementações diferentes | 1 componente reutilizável | Fase 1 |
| `var(--color-*)` inline | 20+ | 0 (classes temáticas) | Fase 1 |
| Focus ring padrão | 5+ padrões diferentes | 1 classe `focus-standard` | Fase 2 |
| `catch(e) -> logger.error` silencioso | 7+ hooks | 0 (todos com toast) | Fase 6 |
| Elementos flutuantes conflitantes | 5+ | < 3 (unificados) | Fase 3 |

---

## 10. Apêndice: Inventário de Inline Styles

### Dinâmicos (manter, não migrar)

Estes usam valores dinâmicos calculados em runtime e **não devem** ser migrados:

| Arquivo | Propósito | Justificativa |
|---------|-----------|---------------|
| `FloatingCalculator.tsx` | `left, top, width, height` | Posição drag/resize |
| `Categories.tsx` | `color: categoryColor` | Cor dinâmica por categoria |
| `Contas.tsx` | `backgroundColor: card.color` | Cor dinâmica do cartão |
| `CategoryBadge.tsx` | `backgroundColor: normalizedColor` | Cor dinâmica |
| `CategoryColorBar.tsx` | `backgroundColor: mappedColor` | Cor dinâmica |
| `PageActionButtonHub.tsx` | `color: iconColor` | Cor dinâmica do ícone |
| `FloatingActionHub.tsx` | `transform, opacity` | Animação |

### Estáticos (migrar para classes)

Estes usam valores estáticos que podem ser classes Tailwind:

| Arquivo | Substituição |
|---------|-------------|
| `DashboardKpis.tsx` 4x | `border-l-income`, `border-l-expense`, `border-l-balance` |
| `TransactionCard.tsx` 20x | `text-primary`, `text-secondary`, `text-expense` |
| `ReportCharts.tsx` 3x | `mb-6`, `gap-6` |
| `KpiCard.tsx` 2x | Classes de background |
| `AssetDetailModal.tsx` (estático) | Classes de posição |
| `reportsChartShared.tsx` | Classes de estilo |

---

## 📊 Resumo por Fase

| Fase | Nome | Itens | Esforço Total | Dependências |
|------|------|-------|---------------|--------------|
| 1 | 🎨 Consistência Visual | 2.1→2.5 (5 itens) | ~9h | Nenhuma |
| 2 | ♿ Acessibilidade | 3.1→3.4 (4 itens) | ~3h | Fase 1 (CSS tokens) |
| 3 | 📱 Mobile First | 4.1→4.3 (3 itens) | ~5.5h | Fase 1 |
| 4 | 🖥️ Desktop | 5.1→5.3 (3 itens) | ~1.75h | Fase 1 |
| 5 | ⚡ Performance | 6.1→6.3 (3 itens) | ~5.5h | Fase 1 (inline styles) |
| 6 | 🧩 Resiliência | 7.1→7.3 (3 itens) | ~3h | Nenhuma |
| 7 | 🌗 Temas | 8.1→8.2 (2 itens) | ~1h | Fase 1 |

---

## 📋 Histórico de Correções

### 🔧 Sessão Atual (Junho 2026)

| # | Correção | Descrição | Arquivo |
|---|----------|-----------|---------|
| 1 | **Bug: teclado nativo no mobile ao usar calculadora** | Ao abrir a calculadora flutuante em mobile, o input numeric era mantido em foco, ativando o teclado nativo. Corrigido com `setTimeout(0)` para dar blur no input após o evento de focus. | `FloatingCalculator.tsx` |
| 2 | **Bug: valor enviado pela calculadora não persistia ao sair do campo** | Corrigido com `queueMicrotask`: React processa o `input` antes do `blur`. | `FloatingCalculator.tsx` |
| 3 | **Fase 1.2: Reduzir !important** | ~15 ocorrências de `!important` removidas do CSS (scrollbar, glass-button-side, calculator, select-dropdown, etc). Mantidos apenas os necessários (recharts, print, reduced-transparency). | `index.css` |
| 4 | **Fase 2: ConfirmModal acessível** | Adicionado `aria-label` no checkbox de confirmação. | `ConfirmModal.tsx` |
| 5 | **Fase 4: Sidebar persistence** | Estado de expansão da sidebar persiste em `localStorage`. Fecha também com Escape e clique fora. | `Layout.tsx` |

**Esforço total estimado:** ~29h distribuídas em 7 fases.

---

> **Nota:** Este plano é um guia vivo. Cada fase deve ser validada com `npx tsc --noEmit`, `npx vitest run` e `npm run guardrails:ui` antes de prosseguir.
> Consulte também: [`ARCHITECTURE.md`](./ARCHITECTURE.md) — [`IMPROVEMENT_PLAN.md`](./IMPROVEMENT_PLAN.md) — [`NEXT_STEPS.md`](./NEXT_STEPS.md)
