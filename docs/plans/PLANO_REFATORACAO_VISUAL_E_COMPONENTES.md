# 📐 Plano Mestre de Refatoração Visual & Reorganização em Componentes (Mobile PWA) — v2 Revisada

> **Status desta versão:** revisão completa (12/08/2026), calibrada contra o estado real do repositório.
> A v1 tratava o projeto como se fosse refatorar do zero. A v2 reconhece que **~80% da fundação já existe**
> (primitivos `ui/`, hooks, subdiretórios de domínio, Z-index, haptics, navegação com FAB) e foca em
> **consolidar, sanear e reduzir os orquestradores grandes**, seguindo DRY sem quebrar funcionalidades.

---

## 📑 Índice
1. [Visão Geral e Objetivos Estratégicos](#1-visão-geral-e-objetivos-estratégicos)
2. [Diagnóstico Verificado do Repositório & Metas de Redução](#2-diagnóstico-verificado-do-repositório--metas-de-redução)
3. [Stack Oficial Confirmada](#3-stack-oficial-confirmada)
4. [Catálogo das 9 Regras Rígidas de Governança (UI Guardrails)](#4-catálogo-das-9-regras-rígidas-de-governança-ui-guardrails)
5. [Design System Existente: Obsidian Glass & Bento Grid](#5-design-system-existente-obsidian-glass--bento-grid)
6. [Política DRY de Primitivos (Ponto Único de Import)](#6-política-dry-de-primitivos-ponto-único-de-import)
7. [Arquitetura de Layout, Navegação e Z-Index](#7-arquitetura-de-layout-navegação-e-z-index)
8. [Camada de Dados Real (Hooks já existentes)](#8-camada-de-dados-real-hooks-já-existentes)
9. [Matriz de Riscos Técnicos e Salvaguardas Funcionais](#9-matriz-de-riscos-técnicos-e-salvaguardas-funcionais)
10. [Preservação Absoluta das Regras de Negócio Críticas](#10-preservação-absoluta-das-regras-de-negócio-críticas)
11. [Estrutura Real de Diretórios e Foco por Módulo](#11-estrutura-real-de-diretórios-e-foco-por-módulo)
12. [Roteiro Executivo de Implementação em 7 Fases](#12-roteiro-executivo-de-implementação-em-7-fases)
13. [Protocolo de Testes Automatizados e Critérios de Aceite](#13-protocolo-de-testes-automatizados-e-critérios-de-aceite)

---

## 1. Visão Geral e Objetivos Estratégicos

1. **Consolidar, não recriar:** o app já possui primitivos `ui/` (13 arquivos), 47 hooks de dados, subdiretórios de domínio e navegação mobile com FAB. A refatoração consolida essa base e elimina duplicações.
2. **Reduzir orquestradores monolíticos:** `Contas.tsx` (1.792 linhas), `Reports.tsx` (1.452), `Settings.tsx` (816) e `Categories.tsx` (716) são os alvos reais de decomposição.
3. **Experiência Mobile-First (PWA):** manter a navegação atual com **8 destinos** (sem remover acesso a features), aprimorando bottom sheets, micro-interações e ergonomia de toque.
4. **Design System Obsidian Glass & Bento Grid:** padronizar cards, hierarquia tipográfica, micro-interações (`Framer Motion`), contadores animados e sparklines — todos já parcialmente implementados.
5. **Iconografia Profissional (Zero Emojis):** `lucide-react` exclusivo; restam apenas 1 emoji em UI (a corrigir).
6. **Governança Automatizada:** sanear as 8 violações ativas de guardrails (Fase 0) e manter 100% de conformidade dali em diante, sem regressões nas regras de negócio.

---

## 2. Diagnóstico Verificado do Repositório & Metas de Redução

Verificação empírica (wc -l, 12/08/2026):

| Arquivo / Módulo | Linhas Atuais | Dores Identificadas | Meta Pós-Refatoração |
| :--- | :--- | :--- | :--- |
| `src/pages/Contas.tsx` | **1.792** | Orquestrador com 5 blocos grandes de JSX (cartões, faturas, conciliação CSV, dívidas, ~12 modais). Já consome hooks (`useContasBills`, `useContasModals`) e modais extraídos. | **< 250 linhas** (orquestrador + render de seções delegado) |
| `src/pages/Reports.tsx` | **1.452** | Gráficos, métricas, exportação e filtros misturados; já existem 18 componentes em `components/reports/`. | **< 220 linhas** |
| `src/pages/Settings.tsx` | **816** | Abas de aparência, segurança biométrica e painel admin sem isolamento. | **< 150 linhas** (abas modulares) |
| `src/pages/Categories.tsx` | **716** (não ~600 como na v1) | Listas de categorias de despesa/renda + grids existentes em `components/categories/`. | **< 180 linhas** |
| `src/components/TransactionCard.tsx` | **359** | Expansão inline tipo sanfona causa layout shift; detalhes devem ir para bottom sheet. | **Feed Card + Bottom Sheet** |
| `src/components/Layout.tsx` | **471** | Shell com navegação (8 destinos), lógica online/offline e FAB — candidato a decomposição leve. | **< 300 linhas** (navegação extraída) |
| `src/components/AppTopBar.tsx` | **389** | Topbar com busca, sincronização e ações — extrair subcomponentes. | **< 200 linhas** |
| `src/index.css` + `theme-tokens.css` | **~100 KB** (76 + 24) | Classes legadas duplicadas; enxugar progressivamente. | **< 80 KB** (sem regressão visual) |

**Nota da v2:** as metas da v1 (< 180 linhas para Contas) eram irrealistas sem remover JSX estrutural do app. As metas acima preservam funcionalidade e são atingíveis por fase.

---

## 3. Stack Oficial Confirmada (Auditada em 12/08/2026)

### 3.1 Auditoria de dependências — uso real no código

| Dependência | Instalada | Uso real em `src/` | Decisão |
| :--- | :--- | :--- | :--- |
| `react` / `react-dom` / `react-router-dom` | ✔ | 21 arquivos | **Manter** — base |
| `@supabase/supabase-js` | ✔ | (lib/supabase) | **Manter** — backend |
| `tailwindcss` + `autoprefixer` + `postcss` | ✔ | — | **Manter** — estilos |
| `tailwindcss-animate` | ✔ | (plugin) | **Manter** — animações de entrada |
| `class-variance-authority` | ✔ | 4 (primitivos) | **Manter** — variantes |
| `tailwind-merge` + `clsx` | ✔ | `lib/utils.ts` | **Manter** — função `cn()` |
| `lucide-react` (^0.294) | ✔ | **97 arquivos** | **Manter** — iconografia oficial; **sem upgrade** (risco de quebra de nomes de ícones) |
| `framer-motion` v11 | ✔ | 7 arquivos | **Manter** — micro-interações |
| `recharts` 2.15 | ✔ | 14 arquivos | **Manter** — gráficos |
| `date-fns` v2 | ✔ | 22 arquivos | **Manter** — datas pt-BR |
| `react-hot-toast` | ✔ | 20 arquivos | **Manter** — toasts (não migrar para Sonner) |
| `xlsx` | ✔ | 8 arquivos | **Manter** — importação Excel (B3/cartões) |
| `@dnd-kit/core` + `@dnd-kit/sortable` | ✔ | 1 (WidgetSettingsSheet) | **Manter** — reordenação de widgets do Dashboard |
| `@radix-ui/react-dialog` | ✔ | 2 (ui/dialog + ui/sheet) | **Manter** |
| `@radix-ui/react-select` | ✔ | 2 (ui/select) | **Manter** |
| `@radix-ui/react-switch` | ✔ | 1 (ui/switch) | **Manter** |
| `@radix-ui/react-tabs` | ✔ | 1 (ui/tabs) | **Manter** |
| `@radix-ui/react-checkbox` | ✔ | 1 (ui/checkbox) | **Manter** |
| `@radix-ui/react-label` | ✔ | 1 (ui/label) | **Manter** |
| `@radix-ui/react-slot` | ✔ | 1 (ui/button) | **Manter** |
| `@radix-ui/react-dropdown-menu` | ✔ | **0 arquivos** | ⚠️ **Remover** (sem primitivo `ui/dropdown-menu` e sem uso) |
| `@radix-ui/react-scroll-area` | ✔ | **0 arquivos** | ⚠️ **Remover** (sem `ui/scroll-area` e sem uso) |
| `@radix-ui/react-separator` | ✔ | **0 arquivos** | ⚠️ **Remover** (sem `ui/separator` e sem uso) |
| `@radix-ui/react-tooltip` | ✔ | **0 arquivos** | ⚠️ **Remover** (app usa `InfoTooltip.tsx` custom) |
| `vite` / `@vitejs/plugin-react` / `vite-plugin-pwa` | ✔ | — | **Manter** — build + PWA (workbox com cache offline) |
| `vitest` / `@testing-library/*` / `jsdom` | ✔ | 40+ testes | **Manter** — testes (`@vitest-environment jsdom` por docblock) |

**4 pacotes Radix não utilizados** (dropdown-menu, scroll-area, separator, tooltip) devem ser removidos de `package.json` **e** do `manualChunks` em `vite.config.ts` (chunk `radix`) — limpeza de dependência sem impacto em runtime.

### 3.2 Camadas da stack (congruência final)

```
┌──────────────────────────┬──────────────────────────────────────────────────────────────────┐
│ Camada                   │ Biblioteca & Situação Real                                       │
├──────────────────────────┼──────────────────────────────────────────────────────────────────┤
│ 1. Primitivos & A11y     │ Radix UI (@radix-ui/react-* usados) + Tailwind CSS ✔            │
│ 2. Bottom Sheets         │ Radix Dialog via `src/components/ui/sheet.tsx` (side="bottom")   │
│                          │ ✔ existe — estender (snap points/swipe) sem instalar Vaul       │
│ 3. Micro-interações      │ Framer Motion v11+ ✔                                            │
│ 4. Gráficos & Dashboards │ Recharts + padrões `reportsChartShared.tsx` ✔                    │
│ 5. Iconografia           │ lucide-react (strokeWidth ~1.75, SEM EMOJIS) ✔                   │
│ 6. Notificações & Toasts │ react-hot-toast ✔ (manter)                                      │
│ 7. Números & Contadores  │ font-mono tabular + `animated-number.tsx` ✘ a criar (gap real)   │
│ 8. Testes                │ Vitest + Testing Library + jsdom (docblock por arquivo) ✔        │
└──────────────────────────┴──────────────────────────────────────────────────────────────────┘
```

### 3.3 Convenções de importação (congruência de código)

1. **Alias obrigatório:** todo import usa `@/` (verificado: 100% das páginas usam alias, 0 relativos entre páginas). Nunca importar por caminho relativo `../../`. Aliases já configurados em `vite.config.ts` e `tsconfig.json` (`@/* → ./src/*`).
2. **Ponto único de primitivos:** código novo importa exclusivamente de `@/components/ui/*` (Regra 9). Wrappers legados (`Button`, `Card`, `Modal`, `Input`, `Select`, `Switch`, `Checkbox`, `Skeleton`) viram **re-exports** de `ui/` na Fase 1 — nunca duplicar lógica.
3. **`cn()` de `@/lib/utils`** para combinar classes (nunca template strings com `clsx` solto).
4. **Formatação financeira:** somente `@/utils/format` (Regra 3 — `npm run guardrails:ui` fiscaliza).
5. **Haptics:** somente `@/utils/haptics` (`triggerHaptic`).
6. **Z-index:** somente constantes `@/constants/zIndex` (`Z_INDEX.*`).

### 3.4 Decisões da v2 (diferem da v1)
- ❌ **Não instalar Vaul** — `sheet.tsx` já resolve bottom sheet responsivo via Radix.
- ❌ **Não instalar Sonner** — `react-hot-toast` está consolidado; troca é churn sem ROI claro.
- ✅ **Criar `src/components/ui/animated-number.tsx`** — único primitivo realmente ausente.
- ✅ **Criar `src/components/PageHeader.tsx`** — documentado na governança, mas inexistente no código (gap real).
- ⚠️ **Remover 4 pacotes Radix sem uso** (Fase 1 — junto à limpeza de `vite.config.ts`).
- 🚫 **Sem upgrade de `lucide-react`** (^0.294 funciona com 97 arquivos; atualizar é risco fora do escopo).

---

## 4. Catálogo das 9 Regras Rígidas de Governança (UI Guardrails)

1. 🚫 **Regra 1: Zero Cores HEX ou RGB Hardcoded no JSX:** apenas variáveis semânticas (`text-primary`, `text-income`, `surface-glass`, `border-glass`).
2. 💎 **Regra 2: Proibição de Emojis / Apenas Ícones Lucide:** usar exclusivamente `lucide-react` com `strokeWidth` uniforme (1.5–2.0) e tamanhos proporcionais (16/18/20).
3. 💰 **Regra 3: Formatação Financeira Centralizada:** uso exclusivo de `src/utils/format.ts`. Proibido `.toFixed`/`.toLocaleString` manuais em `pages/` e `components/`.
4. 📱 **Regra 4: Ergonomia Mobile & Thumb Zone:** alvos de toque ≥ 44×44px e `safe-area-inset-*` respeitados; ações principais na metade inferior.
5. 🧩 **Regra 5: Limites de Tamanho por Arquivo:** orquestradores até 250 linhas; subcomponentes até 200; regras de negócio em hooks (`src/hooks/`).
6. 🪟 **Regra 6: Hierarquia Glass L0–L3 Controlada:** no máximo 2 camadas de `backdrop-blur` sobrepostas no mesmo ponto (60 FPS).
7. ⚡ **Regra 7: Haptics Engine (`src/utils/haptics.ts`):** já existe com `triggerHaptic('start'|'active'|'cancel'|'trigger')` — estender tipos se necessário, não duplicar.
8. ♿ **Regra 8: Acessibilidade (WCAG AA):** `aria-label` em botões de ícone, teclado (`Escape`/`Tab`) e contraste ≥ 4.5:1 em todos os temas.
9. 📦 **Regra 9: Ponto Único de Import de Primitivos:** ver Seção 6 (política DRY).

**Baseline atual:** `npm run guardrails:ui` acusa **8 violações novas** a sanear na Fase 0 (ver Seção 12).

---

## 5. Design System Existente: Obsidian Glass & Bento Grid

Já implementado em `src/index.css` e `src/styles/theme-tokens.css` — a refatoração **consome** e consolida, não recria.

### 5.1 Camadas de Profundidade (L0 a L3)
```
L3: Controles Ativos, Badges e Botões   (active:scale, focus-ring, toggles)
L2: Elevated Panels, Sheets e Modais     (surface-glass-strong, border-glass, shadows)
L1: Bento Grid Cards                      (surface-glass, backdrop-blur-md, rounded-2xl/3xl)
L0: Canvas & Ambient Glow                 (hsl(var(--background)), safe-area insets)
```

### 5.2 Modos de Tema & Paletas
| Modo | Fundo | Superfície L1 | Acento |
| :--- | :--- | :--- | :--- |
| Claro | `#f8fafc` | `rgba(255,255,255,0.75)` | Preto / acento selecionado |
| Escuro (Dark Slate) | `#0b0f19` | `rgba(15,23,42,0.65)` | Branco / acento |
| Midnight (OLED) | `#000000` | `rgba(12,12,14,0.70)` | Branco puro / neon sutil |

### 5.3 Primitivos glass documentados (GOVERNANCA_UI.md)
`GlassChoiceCard`, `ModalFooter` (híbrido ícones/texto), `Modal`, `ModalForm`, `ConfirmModal`, `MonthPickerModal`, `ModalIntro`, `ModalChoiceGrid`, `ModalInfoPanel`, `ModalSummaryPanel`, `ModalFieldRow`. **Reutilizar antes de criar.**

---

## 6. Política DRY de Primitivos (Ponto Único de Import)

### 6.1 Problema diagnosticado (duplicação raiz vs `ui/`)
| Wrapper raiz (em uso) | Primitivo `ui/` | Imports do wrapper |
|---|---|---|
| `src/components/Button.tsx` | `ui/button.tsx` | **49 arquivos** |
| `src/components/Card.tsx` | `ui/card.tsx` | **32 arquivos** |
| `src/components/Modal.tsx` | `ui/dialog.tsx` | **16 arquivos** |
| `Input.tsx`, `Select.tsx`, `Switch.tsx`, `Checkbox.tsx`, `Skeleton.tsx` | idem `ui/` | — |

`Button.tsx` já é um **adapter fino** que mapeia variantes legadas para o shadcn — não é mau código, mas cria dois pontos de entrada.

### 6.2 Decisão: wrappers viram re-exports (migração sem quebra)
1. Transformar cada wrapper raiz em **re-export de `ui/`** (mantendo a API legada de variantes via `cva` maps), eliminando lógica duplicada.
2. **Novo código** importa exclusivamente de `src/components/ui/` (Regra 9).
3. Migração progressiva: reescrever imports existentes em lotes por página, rodando `build` + snapshots a cada lote.
4. **Snapshots afetados:** `uiPrimitivesSnapshot.test.ts` (201 linhas) e `uiSecondarySnapshot.test.tsx` (27 linhas) — atualizar na mesma etapa de cada mudança de primitivo.

### 6.3 Contratos de primitivos (a criar/extender)
```typescript
// ui/animated-number.tsx (NOVO)
interface AnimatedNumberProps {
  value: number
  format?: (n: number) => string
  duration?: number // ms
  className?: string
}
// Restrito a KPIs de topo (regra de performance — NÃO animar listas)

// ui/sheet.tsx (ESTENDER)
// side="bottom" já existe — adicionar: drag-to-dismiss (pointer events) e snap points opcionais
// SEM introduzir Vaul

// components/PageHeader.tsx (NOVO — gap da governança)
// Props: title, subtitle?, action?, back? — único h1 por página
```

---

## 7. Arquitetura de Layout, Navegação e Z-Index

### 7.1 Z-Index — já implementado em `src/constants/zIndex.ts`
A escala proposta na v1 **já existe com os mesmos valores** (BASE 0 … PRINT 9999, incluindo `OVERLAY 900`, `MODAL 1000`, `CALCULATOR 1300`, `TOAST 1400`). Refatoração apenas **consome** `Z_INDEX.*` — proibido z-index arbitrário.

### 7.2 Navegação — MANTER 8 destinos (correção da v1)
O `Layout.tsx` já renderiza bottom nav mobile com **8 destinos**:

| # | Rota | Ícone | Observação |
|---|---|---|---|
| 1 | `/` | Home | Início |
| 2 | `/expenses` | TrendingDown | Despesas |
| 3 | `/incomes` | TrendingUp | Rendas |
| 4 | `/contas` | Receipt | Contas |
| 5 | `/investments` | PiggyBank | Investimentos |
| 6 | `/reports` | BarChart3 | Relatórios |
| 7 | `/categories` | Tags | Categorias |
| 8 | `/settings` | Settings | Configurações |

**🚫 A v1 propunha 4 abas — rejeitada:** removeria acesso direto a Investimentos, Relatórios, Categorias e Configurações, violando "manter todas as funcionalidades". Ação: redesenhar visualmente a navegação existente (ícones Lucide, estados ativos, FAB central já existente em `FloatingActionHub.tsx`), sem reduzir destinos.

### 7.3 Scroll Padding & Safe Areas
- Containers principais: `pb-[calc(5.5rem+env(safe-area-inset-bottom))]` ou classe `pb-safe` existente.
- Respeitar `safe-area-inset-top` no `AppTopBar` e cabeçalhos.

---

## 8. Camada de Dados Real (Hooks já existentes)

**47 hooks já implementados** em `src/hooks/` — a v1 tratava esta camada como a criar; ela **já existe e é consumida**. A refatoração apenas completa/ajusta:

| Módulo | Hooks consumidos (existentes) | Subcomponentes existentes |
| :--- | :--- | :--- |
| Início (`Dashboard.tsx`) | `useDashboardData`, `useAppSettings`, `useDashboardInsights`, `useDashboardLayout`, `useBalanceGlow` | `dashboard/DashboardWidgetGrid`, `dashboard/QuickLaunchOption`, `KpiCard`, `dashboard/WidgetCard` |
| Despesas/Rendas | `useExpenses`, `useIncomes`, `useCategories`, `useFormAmountSync` (+ test) | `ExpenseFormModal`, `IncomeFormModal`, `TransactionCard`, `TransactionRow`, `TransactionCurrencyFields` |
| Contas | `useContasBills`, `useContasModals`, `useCreditCards`, `useDebts` | `creditCards/*` (15 arquivos), `debts/*` (2), `CreditCardCsvReconciliationPanel` |
| Relatórios | `useReports`, `useReportCustomPeriod`, `useIncomeReports`, `useSpendingProjection` | `reports/*` (18 arquivos), `ReportCharts.tsx` |
| Ajustes | `useAppSettings`, `useTheme`, `usePaletteColors` | `settings/VisualStyleOptionCard`, `ThemeSwitcher`, `ColorPaletteSwitcher`, `AccentToneSwitcher` |
| Investimentos | `usePortfolioState`, `useDashboardPortfolio` | `investments/*` (27 arquivos) |

**Gap a preencher (se confirmado por teste):** hooks usados exclusivamente por uma página podem ser mantidos como estão; a redução de linhas vem do JSX, não de novos hooks.

---

## 9. Matriz de Riscos Técnicos e Salvaguardas Funcionais

```
┌──────────────────────────────┬──────────────────────────────┬──────────────────────────────────┐
│ Risco                        │ Impacto                      │ Salvaguarda                      │
├──────────────────────────────┼──────────────────────────────┼──────────────────────────────────┤
│ 1. Teclado iOS PWA empurra   │ Esconde botões Salvar        │ sheet.tsx + inputs inputMode     │
│    o layout                  │                              │ decimal + rodapé fixo do sheet   │
│ 2. Máscaras monetárias       │ Valor digitado ≠ float       │ Preservar hooks existentes:      │
│                              │ enviado ao Supabase/offline  │ useFormAmountSync,               │
│                              │                              │ TransactionCurrencyFields        │
│ 3. Z-index/portais           │ Calculadora/FAB vazam        │ createPortal em document.body   │
│                              │ sobre bottom sheets          │ + Z_INDEX.* (já padronizado)     │
│ 4. Recharts em abas/sheets   │ ResponsiveContainer 0px      │ Padronizar em reportsChartShared │
│                              │ quebra com animação          │ (delay + dimensões mínimas)      │
│ 5. Fila offline/optimistic   │ Badge de sync pendente some  │ TransactionCard mantém isOffline │
│ 6. 50+ itens animados        │ Engasgos na rolagem          │ AnimatedNumber só em KPIs;       │
│                              │                              │ listas usam font-mono tabular    │
│ 7. Snapshots de primitivos   │ Build/test quebram           │ Atualizar uiPrimitivesSnapshot e │
│    (NOVO na v2)              │                              │ uiSecondarySnapshot por fase     │
│ 8. Guardrails ativos         │ baseline suja (NOVO na v2)   │ Fase 0 sana as 8 violações       │
└──────────────────────────────┴──────────────────────────────┴──────────────────────────────────┘
```

---

## 10. Preservação Absoluta das Regras de Negócio Críticas

1. **Sistema de Pesos em Rendas (`peso`/`proporcao`):** proporcionalidade intacta no rateio e relatórios.
2. **Motor do Ciclo de Cartões:** `closing_day`, `due_day`, parcelamento, conciliação CSV (há 4 suítes de teste dedicadas: `creditCard*`).
3. **Quitação de Dívidas:** liquidação parcial/total e recálculo imediato no saldo do mês.
4. **Biometria & WebAuthn:** registro de chaves, bloqueio por inatividade.
5. **Calculadora Flutuante com Memória:** alternância flutuante/hub (`FloatingCalculator`, `FloatingSideStack`, `calculatorOriginFlip`).
6. **Carteira de Investimentos:** tiers S/A/B/C e rentabilidade histórica (`portfolioHistoricalRecalc.ts`).
7. **Recorrências & Feedback de Despesas Recorrentes:** `recurringExpenseLearning` + feedback com tabela dedicada.

**Salvaguarda:** toda fase roda a suíte completa de testes (Seção 13) antes e depois.

---

## 11. Estrutura Real de Diretórios e Foco por Módulo

A estrutura real **já é modular** — a refatoração não cria `billing/` nem `transactions/` novos; ela preenche os orquestradores usando a estrutura existente:

```
src/
├── components/
│   ├── ui/                         # Primitivos (13 existentes + animated-number NOVO)
│   ├── creditCards/                # 15 arquivos — Cartões, Faturas, Refunds, Conciliação
│   ├── debts/                      # 2 arquivos — Dívidas
│   ├── reports/                    # 18 arquivos — Gráficos e visões de relatório
│   ├── dashboard/                  # Widgets, KPIs, QuickLaunch
│   ├── categories/                 # Grids e modais de categorias
│   ├── investments/                # 27 arquivos — Carteira completa
│   ├── reconciliation/             # Conciliação de crédito
│   ├── settings/                   # VisualStyleOptionCard etc.
│   └── (raiz)                      # Modal, ModalForm, ConfirmModal, TransactionCard,
│                                   # Button, Card, Input, Select, Switch, Layout, AppTopBar...
├── hooks/                          # 47 hooks de dados — NÃO criar novos sem necessidade
├── pages/                          # Orquestradores (alvo de redução)
└── utils/                          # format.ts, haptics.ts, creditCardBilling.ts, etc.
```

### 11.1 Foco de decomposição por orquestrador
| Página | Subcomponentes a extrair (JSX remanescente) | Para onde |
|---|---|---|
| `Contas.tsx` | Blocos de cartões, timeline de fatura, lista de dívidas, grid de KPI | `creditCards/`, `debts/` (já existem) |
| `Reports.tsx` | Seções de métricas mensais/anuais, filtros | `reports/` (já existe) |
| `Settings.tsx` | Abas aparência/segurança/admin | `settings/` + `ThemeSwitcher`/`ColorPaletteSwitcher` |
| `Categories.tsx` | Lista de categorias com grids | `categories/` (já existe) |
| `Layout.tsx` | Navegação mobile + sidebar desktop | Extrair `MobileNav`/`DesktopNav` internos |

---

## 12. Roteiro Executivo de Implementação em 7 Fases

```
┌──────────────────────────────────────────────────────────────────────────────────────────┐
│ FASE 0 (NOVA): Saneamento da Baseline de Guardrails                                      │
│ ├── Corrigir 8 violações ativas:                                                        │
│ │   • DashboardCategoryDetailModal.tsx:120  → usar format.ts (.toFixed)                 │
│ │   • RecurringExpenseDetailModal.tsx:142/202/211 → classes glass (não bg-secondary/10) │
│ │   • Contas.tsx:1249-1271 (3 <button> nativos) → ui/button ou Button existente        │
│ │   • DashboardWidgetGrid.tsx:194 (#888) → token de cor                                 │
│ ├── Remover emoji 🎉 em dashboard/details/LimitsOverviewDetail.tsx                      │
│ └── Critério de saída: npm run guardrails:ui VERDE + build ok                           │
├──────────────────────────────────────────────────────────────────────────────────────────┤
│ FASE 1: Fundação DRY — Primitivos                                                        │
│ ├── Criar ui/animated-number.tsx (KPIs de topo apenas)                                  │
│ ├── Criar components/PageHeader.tsx (gap da governança)                                 │
│ ├── Wrappers raiz → re-exports de ui/ (Button, Card, Modal, Input, Select, Switch...)   │
│ ├── Remover 4 pacotes Radix sem uso (dropdown-menu, scroll-area, separator, tooltip)    │
│ │   do package.json e do manualChunks 'radix' em vite.config.ts                        │
│ └── Atualizar snapshots (uiPrimitivesSnapshot, uiSecondarySnapshot) na mesma etapa      │
├──────────────────────────────────────────────────────────────────────────────────────────┤
│ FASE 2: Bottom Sheets — estender ui/sheet.tsx (swipe-dismiss + snap points)             │
│ └── Migrar transações de detalhe/edição para sheet (TransactionCard → sheet de detalhes)│
├──────────────────────────────────────────────────────────────────────────────────────────┤
│ FASE 3: Contas.tsx (1.792 → <250 linhas)                                                 │
│ └── Extrair JSX remanescente para creditCards/ e debts/ (estrutura já existe)           │
├──────────────────────────────────────────────────────────────────────────────────────────┤
│ FASE 4: Reports.tsx (1.452 → <220 linhas)                                                │
│ └── Consolidar métricas/filtros nos componentes reports/ existentes                     │
├──────────────────────────────────────────────────────────────────────────────────────────┤
│ FASE 5: Settings.tsx (816 → <150) e Categories.tsx (716 → <180)                         │
│ └── Abas modulares em settings/ + grids existentes em categories/                       │
├──────────────────────────────────────────────────────────────────────────────────────────┤
│ FASE 6: Layout/AppTopBar + Limpeza de CSS                                                │
│ └── Extrair navegação do Layout (471), subcomponentes do AppTopBar (389),               │
│ └── enxugar index.css (76 KB) e theme-tokens.css (24 KB) sem regressão visual           │
└──────────────────────────────────────────────────────────────────────────────────────────┘
```

---

## 13. Protocolo de Testes Automatizados e Critérios de Aceite

### 13.1 Bateria de Testes Automatizados (gate de cada fase)
```bash
# 0. Sanidade rápida (antes de começar a fase)
npm run test:run

# 1. Verificação Estrita de Guardrails de UI
npm run guardrails:ui          # deve estar VERDE após a Fase 0 e permanecer

# 2. Verificação de Tipos e Build de Produção
npm run build

# 3. Suíte Completa de Testes Unitários
npm run test:run

# 4. Lint (ESLint + guardrails)
npm run lint

# 5. Snapshots de primitivos (se a fase tocou em ui/ ou wrappers)
npm run test:run -- src/components/uiPrimitivesSnapshot.test.ts src/components/uiSecondarySnapshot.test.tsx
```

### 13.2 Critérios de Aceite de UX
- [ ] **Zero Emojis:** nenhum emoji nativo em tela, botão, aba ou modal (inclui o 🎉 pendente).
- [ ] **Zero Violações de Guardrails:** `npm run guardrails:ui` verde continuamente.
- [ ] **Navegação Completa Preservada:** os **8 destinos** atuais seguem acessíveis; apenas o visual muda.
- [ ] **Gestos no Mobile:** fechamento de bottom sheets por swipe (via `sheet.tsx` estendido).
- [ ] **Ergonomia:** botões de navegação e formulários ≥ 44×44px.
- [ ] **Resposta Tátil:** `triggerHaptic` em confirmações de pagamento/liquidação/exclusão.
- [ ] **Ponto Único de Import:** novo código só importa primitivos de `src/components/ui/`.
- [ ] **Redução Efetiva:** Contas < 250 linhas, Reports < 220, Settings < 150, Categories < 180.
- [ ] **Zero Regressões de Negócio:** 100% da suíte de testes verde (incluindo `creditCard*`, `portfolio*`, `useDebts`, `useFormAmountSync`).

---

## Apêndice A — Status de Progresso

| Fase | Descrição | Status | Data | Validação |
| :--- | :--- | :--- | :--- | :--- |
| **0** | Saneamento da baseline de guardrails | ✅ **Concluída** | 12/08/2026 | guardrails:ui verde · tsc limpo · **438 testes OK** · build OK · lint sem erros novos |
| 1 | Primitivos DRY + deps | ⬜ Pendente | — | — |
| 2 | Bottom Sheets | ⬜ Pendente | — | — |
| 3 | Contas.tsx | ⬜ Pendente | — | — |
| 4 | Reports.tsx | ⬜ Pendente | — | — |
| 5 | Settings + Categories | ⬜ Pendente | — | — |
| 6 | Shell + CSS | ⬜ Pendente | — | — |

### Fase 0 — Registro de mudanças
- `DashboardCategoryDetailModal.tsx`: `.toFixed(1)` → `formatPercentBR(pctOfTotal, 1)` (Regra 3) e `${color}20/15` → `color-mix(in srgb, ...)` (Regra 1).
- `RecurringExpenseDetailModal.tsx`: 3 usos de `bg-secondary/10` → `bg-tertiary/10` e `hover:bg-tertiary/60` (painéis ad hoc em modal).
- `Contas.tsx`: 3 `<button>` nativos (filtros de dívida) → `Button` do design system (Regra 4).
- `DashboardWidgetGrid.tsx`: fallback `#888` → `var(--color-text-secondary)` (Regra 1).
- `LimitsOverviewDetail.tsx`: emoji 🎉 removido (Regra 2 — zero emojis).

---

## Apêndice B — Registro de Revisões
| Versão | Data | Mudanças |
|---|---|---|
| v1 | (original) | Plano "do zero" — assumia criação de primitivos, hooks, navegação e Vaul/Sonner. |
| **v2** | **12/08/2026** | **Revisão calibrada à realidade:** Fase 0 (8 violações + emoji), 8 destinos de navegação preservados, sem Vaul/Sonner, wrappers como re-exports (política DRY), snapshots de primitivos no protocolo, metas de linhas realistas, estrutura real de diretórios, `animated-number` e `PageHeader` identificados como únicos gaps de primitivos. |
