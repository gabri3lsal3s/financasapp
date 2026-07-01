# Plano de Implementação: Refinamento Completo do Dashboard Financeiro

> **Última atualização:** 2026-07-01  
> **Status geral:** 🟢 Avançado — Múltiplas fases concluídas e refinamentos aplicados.

Este plano descreve todas as etapas para refinar o Dashboard (`src/pages/Dashboard.tsx`), cabeçalho (`src/components/AppTopBar.tsx`), navegação (`src/components/Layout.tsx`) e design system (`src/styles/theme-tokens.css`, `src/index.css`), organizando em fases progressivas.

---

## Visão Geral das Fases

| Fase | Nome | Status | Prioridade |
|------|------|:------:|:----------:|
| 0 | 🐛 Correção de Bugs & TypeScript | ✅ | 🔴 Crítica |
| 1 | 🧱 Foundation — Constantes de Layout, a11y | ✅ | 🔴 Alta |
| 2 | 💎 Card Herói — Gasto Disponível | ✅ | 🟡 Média |
| 2b | 🪄 Projeção de Fim do Mês | ✅ | 🔴 Alta |
| 3 | ✨ Smart Ambient Glow + Animações | ✅ | 🟡 Média |
| 4 | 🤖 Copiloto + Insights Proativos Refinados | ✅ | 🟡 Média |
| 5 | 📊 Reordenação dos Cards no Dashboard | ✅ | 🟡 Média |
| 6 | 🧭 Navegação — Bottom Nav, Top Bar | 🔄 | 🟢 Baixa |
| 7 | ✅ Verificação Final & Testes | ✅ | 🔴 Alta |

---

## ✅ FASE 0 — Correção de Bugs & TypeScript

**Status:** ✅ Concluído

**Bugs corrigidos:**
| # | Arquivo | Erro |
|---|---------|------|
| 1 | Dashboard.tsx | `cn` não importado (6x TS2304) |
| 2 | Dashboard.tsx | `KpiCard` import não usado (TS6133) |
| 3 | Dashboard.tsx | `Wallet` import não usado (TS6133) |
| 4 | Dashboard.tsx | `categoriesWithoutLimits` unused |
| 5 | Dashboard.tsx | `previousMonthIncomeTotal` unused |
| 6 | Dashboard.tsx | `prevSpentMap` unused |
| 7+ | Dashboard.tsx | Múltiplos outros unused vars |

---

## ✅ FASE 1 — Foundation: Layout Constants + Acessibilidade

**Status:** ✅ Concluído

### 1a. Constantes de Layout

`src/constants/layout.ts` criado com tokens:
- `CARD_PADDING`, `CARD_PADDING_LARGE`, `CARD_PADDING_XL`
- `CARD_BASE`, `CARD_BASE_FLAT`
- `ACTION_GRID`, `SECTION_GAP`, `KPI_GRID`
- `PAGE_ENTER_ANIMATION`, `CONTENT_PADDING`, `CONTENT_MAX_WIDTH`

### 1b. Constantes aplicadas em todos os cards do Dashboard

### 1c. Acessibilidade (a11y)

✅ `role="progressbar"`, `aria-valuenow`, `aria-valuemin`, `aria-valuemax`, `aria-valuetext`, `aria-labelledby` na barra de progresso do Termômetro

---

## ✅ FASE 2 — Card Herói (Gasto Disponível)

**Status:** ✅ Concluído

### Card Herói com:
- Diário Sugerido (saldo/dias restantes)
- Mensal Livre com cor dinâmica (verde/vermelho)
- Badge de Status: "Sob Controle" ou "Orçamento Ultrapassado"
- Glow de fundo dinâmico

### Card de Projeção de Fim do Mês (NOVO):
- Projeção de superávit/déficit baseada no ritmo diário atual
- Mini termômetro projetivo
- Badge "No rumo" / "Atenção" com animação
- Texto explicativo contextual
- **Só aparece após o 3º dia do mês** (dados mínimos)

---

## ✅ FASE 3 — Smart Ambient Glow

**Status:** ✅ Concluído

`src/hooks/useBalanceGlow.ts`:
- Hook que ajusta `--ambient-glow-primary` e `--ambient-glow-secondary` no `<html>`
- Saldo positivo → glow verde
- Saldo negativo → glow vermelho
- Cleanup ao desmontar
- Integrado no Dashboard via `useBalanceGlow(balance)`

---

## ✅ FASE 4 — Copiloto + Insights Proativos Refinados

**Status:** ✅ Concluído

### 4a. Insights Nativos (dynamicAiSuggestions)

| # | Insight | Gatilho |
|---|---------|---------|
| 1 | Limite estourado | `limitsExceededCount > 0` |
| 2 | Taxa de poupança | `savingsRate` calculado |
| 3 | Variação vs. mês anterior | `diffPct > 5% ou < -5%` |
| 4 | Maior categoria de gasto | `topCat > 15% do total` |
| 5 | Pico de gastos por dia da semana | Análise de weekday |
| 6 | Taxa de investimento | % da renda investida |
| 7 | **Projeção de fim do mês** 🆕 | Ritmo atual vs. orçamento |
| 8 | Concentração de renda | Fonte única > 50% |
| 9 | Ritmo de gastos | Benchmark mensal |
| 10 | Taxa de consumo (burn rate) | % da renda gasta |

### 4b. Botões "Analisar" removidos

✅ Cards de insight agora são **totalmente clicáveis** (elemento `<button>` com `onClick`), eliminando o botão separado "Analisar" com `Sparkles`.

---

## ✅ FASE 5 — Reordenação dos Cards

**Status:** ✅ Concluído

### Nova ordem do Dashboard (fluxo lógico de cima para baixo):

1. 🏆 **Card Herói** — Gasto Disponível (Diário Sugerido)
2. 🔮 **Projeção de Fim do Mês** — Onde você vai parar no ritmo atual
3. 📊 **Resumo do Mês** — Termômetro do orçamento
4. 📈 **Fluxo Diário** — Padrões visuais de gastos
5. ⚠️ **Limites de Categoria** — Onde você está no risco
6. 🤖 **Copiloto de IA** — Análise aprofundada + Carrossel de Insights
7. ⚡ **Ações de Otimização** — Assinaturas, Desafios, Limites
8. 📌 **Análise Fixada** — Insights salvos

**Princípio:** Dados imediatos e acionáveis primeiro → Padrões visuais → Riscos → Análise aprofundada

---

## ✅ FASE 6 — Navegação (Bottom Nav, Top Bar)

**Status:** ✅ Concluído

### Top Bar, FAB e Navegação — Padronização Visual

✅ **Top bar fixo na página** — `sticky` removido, agora é bloco normal (`mb-4`) sem seguir a rolagem  
✅ **Padding alinhado** com o conteúdo: `px-3 sm:px-6 lg:px-6 lg:xl:px-8` + `max-w-7xl mx-auto`  
✅ **Sombras padronizadas via tokens** — 6 elementos (top bar, FAB, speed dial, search bar, notificação) usam `var(--glass-shadow-panel), var(--glass-inset-highlight)` em vez de sombras hardcoded exageradas  
✅ **FAB desktop** — mesmo visual glass dos demais elementos, sem sombra excessiva  
✅ Saudação personalizada com nome do usuário + mensagem temporal  
✅ Busca global integrada via `useSearchData` + `searchEngine` + `TopBarSearchResults`  
✅ Pesquisa em despesas, rendas, dívidas, cartões e categorias com scoring por relevância e recência  
✅ Highlight do termo buscado nos resultados  
✅ Navegação contextual (cada resultado leva à página correta com foco no item)

---

## ✅ FASE 7 — Verificação Final

**Status:** ✅ Concluído

- ✅ `npx tsc --noEmit` — **0 erros**
- ✅ `npx vitest run` — **290/290 testes passando**
- ✅ Code Review — Aprovado

---

## Arquivos Modificados/Criados

| Arquivo | Tipo | Mudança |
|---------|:----:|---------|
| `src/pages/Dashboard.tsx` | Editado | Projeção, insights, reordenação, remoção botões "Analisar" |
| `src/components/AppTopBar.tsx` | Editado | Sombra tema-safe, padding alinhado |
| `src/constants/layout.ts` | 🆕 Novo | Constantes de layout |
| `src/hooks/useBalanceGlow.ts` | 🆕 Novo | Smart Ambient Glow |
| `docs/implementation_plan.md` | 🆕 Novo | Plano atualizado |
