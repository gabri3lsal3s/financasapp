# Plano de Implementação: Refinamento Completo do Dashboard Financeiro

> **Última atualização:** 2026-07-01  
> **Status geral:** 🟡 Em andamento — 4 de 8 fases concluídas.

Este plano descreve todas as etapas para refinar o Dashboard (`src/pages/Dashboard.tsx`), cabeçalho (`src/components/AppTopBar.tsx`), navegação (`src/components/Layout.tsx`, `src/components/PageActionButtonHub.tsx`) e design system (`src/styles/theme-tokens.css`, `src/index.css`), organizando em 8 fases progressivas.

---

## Visão Geral das Fases

| Fase | Nome | Status | Prioridade |
|------|------|:------:|:----------:|
| 0 | 🐛 Correção de Bugs & TypeScript | ⏳ | 🔴 Crítica |
| 1 | 🧱 Foundation — Padronização de Layout, a11y, Constantes | ❌ | 🔴 Alta |
| 2 | 💎 Card Herói — Sparkline, Tooltips, Badge de Mês | ❌ | 🟡 Média |
| 3 | ✨ Smart Ambient Glow + Animações | ✅ | 🟡 Média |
| 4 | 🤖 Copiloto — Placeholder Inteligente + Empty States | ❌ | 🟢 Baixa |
| 5 | 🧭 Navegação — Bottom Nav + Carrossel + Indicadores | ❌ | 🟡 Média |
| 6 | 🎨 Grupos 3–4 do Plano Original (Nav, FAB, Verificação) | ❌ | 🟡 Média |
| 7 | ✅ Verificação Visual Multi-tema & Testes | ⏳ | 🔴 Alta |

---

## Decisões do Usuário (Consolidadas)

| # | Decisão | Implementado |
|---|---------|:---:|
| 1 | FAB mantido flutuante, visual limpo sem ruído, `≥ 16px` acima da bottom nav | ⏳ (Fase 6) |
| 2 | Insights proativos via `dynamicAiSuggestions` (análise local, sem chamada IA no load) | ✅ |
| 3 | Ações de otimização como grade de botões preparados para IA-Driven futura | ✅ |
| 4 | Contagem de dias corridos; mensagem especial no último dia do mês | ✅ |

---

## FASE 0 — 🐛 Correção de Bugs & TypeScript

**Objetivo:** Eliminar erros de compilação que impedem typecheck e causam potenciais quebras em runtime.

### Bugs Identificados

| # | Arquivo | Erro | Gravidade |
|---|---------|------|:---------:|
| 1 | `src/pages/Dashboard.tsx` | `cn` não importado (TS2304 — 6 ocorrências) | 🔴 Crítica |
| 2 | `src/pages/Dashboard.tsx` | `KpiCard` importado mas não usado (TS6133) | 🟡 Média |
| 3 | `src/pages/Dashboard.tsx` | `Wallet` importado mas não usado (TS6133) | 🟡 Média |

### O que fazer

- [ ] Adicionar `import { cn } from '@/lib/utils'` no Dashboard.tsx
- [ ] Remover imports não utilizados (`KpiCard`, `Wallet`)
- [ ] Rodar `npx tsc --noEmit` para verificar que todos os erros foram resolvidos

---

## FASE 1 — 🧱 Foundation: Padronização de Layout, Acessibilidade e Constantes

**Objetivo:** Unificar padding de cards, adicionar aria-labels e roles, criar constantes de layout reutilizáveis.

### 1a. Constantes de Layout

**O que fazer:** Criar `src/constants/layout.ts` com tokens de padding:

```ts
// src/constants/layout.ts
export const CARD_PADDING = 'p-4 sm:p-5'
export const CARD_PADDING_LARGE = 'p-5 sm:p-6'
export const SECTION_GAP = 'space-y-5'
export const CARD_BORDER = 'border border-glass surface-glass rounded-2xl shadow-sm'
export const CARD_BORDER_FLAT = 'border border-glass surface-glass rounded-2xl'
```

### 1b. Unificar Padding nos Cards do Dashboard

| Card atual | Padding atual | Padding novo |
|-----------|:-------------:|:------------:|
| Card Herói | `p-5 sm:p-6` | `CARD_PADDING_LARGE` |
| Termômetro | `p-5 sm:p-6` | `CARD_PADDING_LARGE` |
| Copiloto | `p-5 sm:p-6` | `CARD_PADDING_LARGE` |
| Fluxo Diário | `p-4 sm:p-5` | `CARD_PADDING` |
| LimitesControl | `p-4 sm:p-5` | `CARD_PADDING` |
| Ações | `p-3` (botões) | Mantido |

### 1c. Acessibilidade (a11y) na Barra de Progresso

- [ ] Adicionar `role="progressbar"`, `aria-valuenow`, `aria-valuemin`, `aria-valuemax` no Termômetro
- [ ] Adicionar `aria-label` descritivo nos botões de insight
- [ ] Garantir `tabIndex` e `onKeyDown` em cards clicáveis que não são `<button>`

---

## FASE 2 — 💎 Card Herói com Sparkline, Tooltips e Badge de Mês

**Objetivo:** Tornar o card principal do Dashboard mais informativo e visualmente impactante.

### 2a. Sparkline de Saldo Acumulado

- [ ] Adicionar mini gráfico sparkline (reutilizar `Sparkline` de `reportsChartShared.tsx`) abaixo do valor "Diário Sugerido"
- [ ] Dados: saldo acumulado dia a dia (`totalIncomes - totalExpenses - totalInvestments` cumulativo)
- [ ] Cor: `var(--color-primary)` ou `var(--color-income)` quando positivo, `var(--color-expense)` quando negativo

### 2b. Tooltips Informativos

- [ ] Tooltip no label "Diário Sugerido" explicando: *"Limite diário baseado no saldo disponível dividido pelos dias restantes do mês"*
- [ ] Tooltip no label "Mensal Livre": *"Saldo após descontar despesas e investimentos das receitas do mês"*

### 2c. Badge de Contexto do Mês

- [ ] Quando `mode === 'past'`: badge "Mês Encerrado" com ícone de check
- [ ] Quando `mode === 'future'`: badge "Mês Futuro" (planejamento)
- [ ] Quando `mode === 'current'` e saldo apertado (`|monthlyAvailable| < 50`): badge "Margem Apertada"

### 2d. Tratamento de Zeros

- [ ] Quando `totalIncomes === 0 && totalExpenses === 0` no mês atual: mostrar mensagem "Adicione receitas e despesas para ver seu orçamento"
- [ ] Quando `dailyAvailable === 0` e `monthlyAvailable === 0`: mostrar badge "Saldo Neutro"

---

## FASE 3 — ✨ Smart Ambient Glow + Animações de Transição

**Objetivo:** Adicionar feedback visual dinâmico e animações suaves.

### 3a. Smart Ambient Glow

O glow de fundo (`app-shell-glow`) muda de cor com base no saldo financeiro:

| Saldo | Cor do Glow |
|-------|:-----------:|
| Positivo (≥ 0) | `var(--color-income)` |
| Negativo (< 0) | `var(--color-expense)` |
| Neutro / Sem dados | `var(--color-balance)` (padrão) |

**Implementação:**
- Hook `useBalanceGlow()` no Layout.tsx que lê do AuthContext ou prop
- Modificar CSS `--ambient-glow-primary` dinamicamente via inline style
- Transição suave de 800ms na mudança de cor

### 3b. Animações de Stagger Intra-card

- [ ] Aplicar `animate-stagger-item` com delays nos elementos internos de cada card (título, valor, badge, barra)
- [ ] Usar `AnimatePresence` com `mode="wait"` nos cards que mudam de cor

---

## FASE 4 — 🤖 Copiloto: Placeholder Inteligente + Empty States Criativos

**Objetivo:** Tornar o Copiloto mais proativo e os estados vazios mais engajadores.

### 4a. Placeholder Inteligente do Copiloto

Em vez de texto fixo, o placeholder exibe **dicas contextuais** que alternam a cada visita:

- "💡 Você gastou [X]% a mais este mês em [categoria]. Quer saber onde cortar?"
- "📊 Seu saldo líquido é positivo. Quer dicas de investimento?"
- "⚡ [N] categorias estão perto do limite. Quer revisar?"
- "🎯 Sua maior despesa é [categoria]. Quer otimizar?"

### 4b. Empty State Criativo (sem dados no mês)

- [ ] Ilustração contextual (ícone grande + gradiente no fundo)
- [ ] Sugestões: "Importe seu extrato bancário" ou "Comece adicionando uma receita"
- [ ] Botões: "Importar Dados" + "Adicionar Lançamento"

---

## FASE 5 — 🧭 Navegação: Bottom Nav + Carrossel + Indicadores

**Objetivo:** Melhorar indicadores visuais de navegação e scroll horizontal.

### 5a. Indicador de Página Ativa na Bottom Nav

- [ ] Indicador `::after` aumentar de 3px para 4px
- [ ] Adicionar `background-color: var(--ds-color-accent-primary-soft)` no item ativo
- [ ] Transição `scale(1.05)` no ícone ativo
- [ ] Touch targets mínimos de 44px já implementados — verificar consistência

### 5b. Carrossel de Insights com Scroll Snap

- [ ] Adicionar `scroll-snap-type: x mandatory` no container
- [ ] Adicionar `scroll-snap-align: start` nos cards
- [ ] Sombra gradiente nas bordas (fade edge) para indicar scroll horizontal
- [ ] Em desktop (>1024px): `grid grid-cols-2 lg:grid-cols-3` em vez de scroll horizontal

---

## FASE 6 — 🎨 Grupos 3–4 do Plano Original (Nav, FAB, Verificação)

**Objetivo:** Completar as melhorias de navegação planejadas originalmente.

### 6a. Bottom Nav Opaca

- [ ] `background-color: var(--ds-color-surface-secondary)` no lugar de `var(--glass-surface-strong)`
- [ ] `box-shadow` com linha divisória no topo (`0 -1px 0 0 var(--glass-border)`)

### 6b. FAB com Clearance de 16px

- [ ] Ajustar `bottom` do `.page-action-hub-root` em mobile
- [ ] Simplificar `box-shadow` do FAB (remover `var(--glass-inset-highlight)`)

### 6c. Verificação Visual

| Checklist | Light | Dark | Midnight |
|-----------|:-----:|:----:|:--------:|
| Bottom nav opaca e separada do conteúdo | ⬜ | ⬜ | ⬜ |
| FAB 16px acima da nav sem sobreposição | ⬜ | ⬜ | ⬜ |
| Carrossel de insights com scroll | ⬜ | ⬜ | ⬜ |
| Card Herói muda cor corretamente | ⬜ | ⬜ | ⬜ |
| Barra de progresso com a11y | ⬜ | ⬜ | ⬜ |
| Sparkline no Card Herói | ⬜ | ⬜ | ⬜ |
| Smart Ambient Glow dinâmico | ⬜ | ⬜ | ⬜ |

---

## FASE 7 — ✅ Verificação Final Multi-tema & Testes

**Objetivo:** Garantir que tudo funciona em todos os temas e tamanhos de tela.

- [ ] Rodar `npx tsc --noEmit` — typecheck sem erros
- [ ] Rodar `npx vitest run` — testes passando
- [ ] Verificar visualmente Light / Dark / Midnight
- [ ] Verificar mobile / desktop / tablet
- [ ] Verificar com accent tones diferentes (white, violet, blue, emerald, red)
- [ ] Verificar com paletas vivid e monochrome

---

## Arquivos Envolvidos por Fase

| Arquivo | Fase |
|---------|:----:|
| `src/pages/Dashboard.tsx` | 0, 1, 2, 4 |
| `src/components/AppTopBar.tsx` | 1, 4 |
| `src/index.css` | 3, 5, 6 |
| `src/styles/theme-tokens.css` | 3, 6 |
| `src/components/PageActionButtonHub.tsx` | 6 |
| `src/components/Layout.tsx` | 3, 5 |
| `src/components/ui/skeleton.tsx` | 4 |
| `src/constants/layout.ts` (novo) | 1 |
| `src/components/dashboard/HeroCard.tsx` (novo) | 2 |
| `src/hooks/useBalanceGlow.ts` (novo) | 3 |
