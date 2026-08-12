# Governança UI — Minhas Finanças

Manual de referência para consistência visual, tokens HSL e primitivos compartilhados. Complementa a regra Cursor `07-ui-hsl-design-system.mdc` e o script `scripts/ui-guardrails.mjs`.

---

## 1. Princípios

1. **Tokens primeiro** — cores, espaçamento e motion vêm de variáveis CSS em `src/index.css`, não de valores soltos no JSX.
2. **Primitivos compartilhados** — páginas compõem `Button`, `Input`, `Select`, `Modal`, `PageHeader`; não reinventam controles nativos.
3. **Mobile-first** — layout em coluna, áreas de toque generosas, `safe-area-*` para notch.
4. **Semântica financeira** — rendas, despesas e saldo usam tokens dedicados (`text-income`, `text-expense`, `text-balance`).
5. **pt-BR na UI** — textos visíveis ao usuário em português; código em inglês.

---

## 2. Camadas de tokens (`src/index.css`)

### 2.1 Design system (`--ds-*`)

| Token | Uso |
|-------|-----|
| `--ds-color-surface-*` | Fundos primary / secondary / tertiary |
| `--ds-color-text-*` | Texto principal e secundário |
| `--ds-color-accent-primary*` | Ação primária, hover, soft |
| `--ds-color-intent-success/warning/danger` | Feedback e estados |
| `--ds-color-data-income/expense/balance` | Valores financeiros |
| `--ds-space-*` | Escala de espaçamento |
| `--ds-radius-*` | Cantos |
| `--ds-motion-*` | Duração e easing |

### 2.2 Aliases de app (`--color-*`)

Consumidos pelas classes utilitárias Tailwind do projeto:

- `--color-bg-primary`, `--color-bg-secondary`, `--color-bg-tertiary`
- `--color-text-primary`, `--color-text-secondary`
- `--color-primary`, `--color-primary-dark`, `--color-primary-light`
- `--color-income`, `--color-expense`, `--color-balance`
- `--color-border`, `--color-focus`, `--color-button-text`

**Regra:** em componentes TSX, preferir classes `bg-primary`, `text-secondary`, `text-income`, etc., ou `var(--color-*)` — nunca `#RRGGBB` no código-fonte.

### 2.3 Tipografia fluida

Classes em `@layer utilities`:

- `text-fluid-xs` … `text-fluid-2xl`
- Hierarquia de UI: `text-ui-label`, `text-ui-value`, `text-ui-title`, `text-ui-heading`

### 2.4 Motion

- Utilitários: `motion-standard`, `hover-lift-subtle`, `press-subtle`
- Respeitar `prefers-reduced-motion` (já tratado em `index.css`)
- Transição de tema: classe `.theme-transitioning` no root durante troca de paleta

### 2.5 Safe area (PWA)

- `safe-area-top`, `safe-area-bottom`, `safe-area-left`, `safe-area-right`
- Usar no `PageHeader` e barras fixas inferiores

### 2.6 Glass Layer Stack (`--glass-*`)

Hierarquia de camadas glass em `src/styles/theme-tokens.css` e classes em `src/index.css`:

| Camada | Token | Classe CSS | Uso |
|--------|-------|------------|-----|
| L0 Overlay | `--glass-layer-overlay` | `.modal-overlay` | Backdrop de modais/sheets |
| L1 Shell | `--glass-layer-shell` | `.modal-dialog-shell`, `.surface-glass` | Shell de modal, cards da página |
| L2 Panel | `--glass-layer-panel` | `.modal-panel-glass`, `.surface-glass-strong` | Painéis internos, KPIs |
| L3 Interactive | `--glass-layer-interactive` | `.glass-choice-card`, `.glass-input` | Cards de escolha, inputs em modais |

Header/footer de modais ficam **transparentes** sobre o shell L1 (mesmo efeito do modal Novo lançamento).

Sombras tokenizadas: `--glass-shadow-elevated`, `--glass-shadow-panel`, `--glass-shadow-tooltip`.

**Primitivos glass:**

| Componente | Arquivo |
|------------|---------|
| Card de escolha | `GlassChoiceCard.tsx` |
| Footer híbrido | `ModalFooter.tsx` (ícones mobile / texto desktop) |
| Modal shell | `Modal.tsx` + `ModalForm.tsx` |
| Confirmação | `ConfirmModal.tsx` |
| Picker de mês | `MonthPickerModal.tsx` (via `MonthSelector`) |

**Subcomponentes visuais de modal:**

| Componente | Arquivo | Uso |
|------------|---------|-----|
| Intro | `ModalIntro.tsx` | Texto introdutório (picker, confirmação) |
| Grid de escolha | `ModalChoiceGrid.tsx` | Layout para `GlassChoiceCard` |
| Painel info | `ModalInfoPanel.tsx` | Checkbox, toggles, avisos (L2) |
| Resumo financeiro | `ModalSummaryPanel.tsx` | Cálculos e totais (L2) |
| Linha de campos | `ModalFieldRow.tsx` | Dois campos lado a lado |

### Anatomia visual do modal

```
L0  .modal-overlay          → backdrop blur
L1  .modal-dialog-shell    → shell glass (header + body + footer)
L2  .modal-panel-glass     → painéis internos (info, resumo, upload)
L3  .glass-choice-card     → cards interativos de picker
```

**Arquétipos:**

| Tipo | Composição |
|------|------------|
| Picker | `Modal` + `ModalIntro` + `ModalChoiceGrid` + `GlassChoiceCard` |
| Form CRUD | `ModalForm` + campos + `ModalInfoPanel` / `ModalSummaryPanel` + `ModalFooter` |
| Confirmação | `ConfirmModal` + `modal-alert` + conteúdo livre |
| Wizard | `Modal` size `2xl` + steps inline (exceção documentada) |

Título do header: uppercase automático via `Modal`. Footer fixo fora da área rolável. Intents financeiros: `text-income`, `text-expense`, `text-balance` — adaptam-se ao tema/paleta HSL escolhida.

**Regras visuais em modais:**

- Preferir classes glass (`border-glass`, `modal-panel-glass`, `modal-info-panel`, `modal-summary-panel`) em vez de `bg-secondary/30`, `border-primary/40`, `from-balance/5`.
- Inputs usam `.glass-input` (blur via `--glass-blur`, não `backdrop-blur-sm`).
- `@media (prefers-reduced-transparency: reduce)` desativa blur e usa fundos opacos.

---

## 3. Primitivos obrigatórios

| Componente | Arquivo | Notas |
|------------|---------|--------|
| Botão | `src/components/Button.tsx` | Variants: `primary`, `secondary`, `danger`, `outline`, `ghost`, `ghost-success`, `ghost-danger`. Sizes: `sm`, `md`, `lg` (`min-h-12` no `lg`). |
| Campo | `src/components/Input.tsx` | Estados de foco com `--color-focus` |
| Seleção | `src/components/Select.tsx` | Listas fechadas |
| Modal | `src/components/Modal.tsx` | Formulários e confirmações |
| Form modal | `src/components/ModalForm.tsx` | Form com footer fixo |
| Sheet (mobile) | `src/components/ui/sheet.tsx` | Bottom sheet com `dragToDismiss` (swipe fecha) — sem Vaul |
| Detalhe de transação | `src/components/transactions/TransactionDetailDrawer.tsx` | Feed + bottom sheet (substitui sanfona inline) |
| Confirmação | `src/components/ConfirmModal.tsx` | Delete e 2-step |
| Footer modal | `src/components/ModalFooter.tsx` | Híbrido: ícones (mobile) / texto (desktop) |
| Card de escolha | `src/components/GlassChoiceCard.tsx` | Seletores tipo "Novo lançamento" |
| Cabeçalho | `src/components/PageHeader.tsx` | Cabeçalho de conteúdo (h2 — o h1 global é do `AppTopBar`) |
| Card | `src/components/Card.tsx` | Agrupamento visual |
| Ícone | `src/components/IconButton.tsx` | Ações compactas |
| Número animado | `src/components/ui/animated-number.tsx` | Contadores de KPI (respeita `prefers-reduced-motion`) |
| Valor monetário | `src/components/ui/amount-text.tsx` | Tipografia tabular + formatação central via `format.ts` — **nunca formatar moeda à mão fora dele** |
| Eyebrow | `src/components/ui/eyebrow.tsx` | Label uppercase `text-[10px]` com tone (`secondary`/`income`/`expense`), weight e tracking — substitui padrão inline repetido em 17 usos |
| Card glass | `src/components/ui/glass-card.tsx` | Superfície `surface-glass` com variante `interactive` (hover-lift/press) para links clicáveis |
| Layout | `src/components/Layout.tsx` | Shell autenticado + nav (orquestrador enxuto, 125 linhas) |

### Componentes de domínio (reutilizar antes de criar novos)

- `TransactionCard` — linha de despesa/renda
- `DashboardKpis` — grade de KPIs
- `ExpenseFormModal`, `IncomeFormModal`, `PortfolioTransactionFormModal`
- `src/components/consulting/**` — assessoria

**Página Relatórios (Fase 4 — orquestrador enxuto):**

| Componente/Hook | Arquivo | Responsabilidade |
|-----------------|---------|------------------|
| Dados do relatório | `src/hooks/useReportsData.ts` | Toda a lógica de dados (períodos, agregados, trends, período custom, seletores ativos) |
| Cabeçalho | `src/components/reports/ReportsPageHeader.tsx` | Seletor de período + tabs de modo + badge de pesos (props focados) |
| Views | `src/components/reports/AnnualReportView.tsx` / `MonthlyReportView.tsx` | Renderização anual/mensal (pré-existentes) |
| Detalhe | `src/components/reports/CategoryDetailModal.tsx` | Drill-down de categoria (pré-existente) |

**Páginas Settings e Categories (Fase 5 — orquestradores enxutos):**

| Componente/Hook | Arquivo | Responsabilidade |
|-----------------|---------|------------------|
| Lógica admin | `src/hooks/useSettingsAdmin.ts` | Painel admin (aprovar/bloquear/recusar/excluir usuários) |
| Lógica segurança | `src/hooks/useSettingsSecurity.ts` | Biometria WebAuthn + exclusão da conta |
| Abas de Configurações | `src/components/settings/SettingsTabs.tsx` | Navegação Aparência/Segurança/Admin |
| Painéis | `src/components/settings/{AdminPanel,AppearancePanel,SecurityPanel}.tsx` | Conteúdo de cada aba |
| Modais de Configurações | `src/components/settings/SettingsModals.tsx` | Exclusão de conta e de usuário |
| Linha de configuração | `src/components/settings/SettingRow.tsx` | Layout título + controle (compartilhado) |
| Dados de Categorias | `src/hooks/useCategoriesData.ts` | CRUD, sugestões, limites, expectativas, KPIs |
| Sugestões | `src/utils/categorySuggestions.ts` | `detectSuggestionRuleFromName` (util reutilizável) |
| Tabs de Categorias | `src/components/categories/CategoriesTabs.tsx` | Orçamentos/Metas (mobile) |
| Modais de Categorias | `src/components/categories/CategoriesModals.tsx` | Form, exclusão e sugestões |

**Página Contas (Fase 3 — orquestrador enxuto):**

| Componente/Hook | Arquivo | Responsabilidade |
|-----------------|---------|------------------|
| Seção cartões | `src/components/creditCards/CreditCardSection.tsx` | Accordion de cartões, timeline, ações, lançamentos/pagamentos |
| Seção pendências | `src/components/debts/DebtsSection.tsx` | Filtros, lista de dívidas, despesa integrada, confirmadas |
| Modais | `src/components/contas/ContasModals.tsx` | Os 14 modais da página (renderização única) |
| KPIs | `src/components/contas/ContasStats.tsx` | Grid de 4 cards de resumo |
| Ações de negócio | `src/hooks/useContasActions.ts` | 23 handlers com `useCallback` (DRY — único lugar de mutação) |
| Dados derivados | `src/hooks/useContasDerivedData.ts` | Memos de cartões ativos, pendências e stats |
| Navegação | `src/hooks/useContasNavigation.ts` | Deep-links `?month`, `?expand`, `?highlight`, `?card` |

**Convenção:** `useContasModals` mantém **somente estado e ações de modais**; a lógica de mutação (Supabase/hooks) vive exclusivamente em `useContasActions` (não duplicar handlers em ambos).

**Shell — Layout e AppTopBar (Fase 6 — orquestradores enxutos):**

| Componente/Hook | Arquivo | Responsabilidade |
|-----------------|---------|------------------|
| Navegação (fonte única) | `src/constants/navigation.ts` | `NAV_ITEMS` (8 destinos), `MAIN_NAV_ITEMS`, `SETTINGS_NAV_ITEMS`, `MOBILE_MAIN_PATHS` |
| Estado do shell | `src/hooks/useLayoutNavigation.ts` | Menus mobile/desktop, Escape/clique-fora, scroll-lock, logout, refs |
| Menu mobile | `src/components/layout/MobileMenuSheet.tsx` | Bottom sheet "Mais Opções" (destinos secundários + logout) |
| Bottom nav | `src/components/layout/MobileBottomNav.tsx` | 4 abas fixas (Início/Despesas/Rendas/Contas) + botão Mais |
| Sidebar desktop | `src/components/layout/DesktopSidebar.tsx` | Expansível (persistida), perfil, grupos e logout |
| Offline | `src/components/layout/OfflinePlaceholder.tsx` | Estado vazio de página online-only sem conexão |
| Busca global | `src/components/topbar/SearchOverlay.tsx` | Overlay de busca via portal (debounce + resultados) |
| Notificações | `src/components/topbar/NotificationsOverlay.tsx` | Overlay de lembretes via portal |

**Convenção shell:** refs passados por props devem ser tipados `React.Ref<T>` (não `RefObject<T | null>` — incompatível com `LegacyRef` dos elementos DOM).

---

## 4. Padrão de página

```tsx
<PageHeader
  title="Despesas"
  subtitle="Competência março/2026"
  action={<Button size="lg">Nova despesa</Button>}
/>
<main className="flex flex-col gap-4 p-4 pb-safe">
  {/* conteúdo */}
</main>
```

- **Um** título de página (`h1` no `PageHeader`).
- Subtítulos e metadados: `text-secondary`, truncar em mobile (`truncate`).
- CTAs principais: `Button` com `size="lg"` ou `fullWidth` em mobile.

---

## 5. Formatação de números e datas

Centralizar em `src/utils/format.ts`:

- `formatCurrency`, formatadores com `Intl.NumberFormat` (`pt-BR`)
- Datas com `date-fns` + locale `pt-BR`

**Proibido** em `src/pages/**` e `src/components/**`:

```ts
value.toFixed(2)
value.toLocaleString('pt-BR')
```

Usar os helpers exportados de `format.ts`.

---

## 6. Tema e paletas

- `ThemeContext` — modo claro/escuro
- `ColorPaletteSwitcher` — variações HSL da paleta
- Não introduzir segundo sistema de tema (ex.: biblioteca externa)

Ao adicionar cor nova ao tema, definir em `:root` e espelhar no bloco de tema escuro/paletas no mesmo `index.css`.

---

## 7. Guardrails automatizados

Executados via `npm run lint` (primeiro passo):

| ID | Regra |
|----|--------|
| `ui-no-direct-number-formatting` | Sem `.toFixed` / `.toLocaleString` em pages/components |
| `ui-no-raw-hex-color` | Sem `#hex` em `src/**` |
| `ui-no-native-control-in-pages` | Sem `<input>`, `<button>`, etc. nativos em `src/pages/**` |
| `ui-no-inline-modal-panel-styles` | Sem painéis ad hoc em `*Modal*.tsx` (`bg-secondary/`, `border-primary/`, `from-balance/`) |

### Fluxo de trabalho

1. Corrigir violações no código (preferível).
2. Se a violação for legítima e temporária, documentar com comentário **WHY** e avaliar exceção no script.
3. Atualizar baseline apenas de forma consciente:

```bash
npm run guardrails:ui:baseline
```

Baseline versionada: `docs/ui/guardrails-baseline.json`.

---

## 8. Exemplos

### Correto

```tsx
<p className="text-income font-bold">{formatCurrency(totalIncomes)}</p>
<Button variant="primary" size="lg" fullWidth>Salvar</Button>
```

### Incorreto

```tsx
<p style={{ color: '#10b981' }}>R$ {amount.toFixed(2)}</p>
<button className="px-4 py-2 bg-blue-500">Salvar</button>
```

---

## 9. Referências cruzadas

- Arquitetura: [docs/ARCHITECTURE.md](../ARCHITECTURE.md)
- Regras Cursor: `.cursor/rules/07-ui-hsl-design-system.mdc`
- Skill agente: `.cursor/skills/ui-hsl-primitives/SKILL.md`
- Script: `scripts/ui-guardrails.mjs`

---

## 10. Manutenção

Revisar este documento quando:

- Novos tokens forem adicionados a `index.css`
- Novos primitivos forem criados em `src/components/`
- Regras do guardrail forem alteradas em `scripts/ui-guardrails.mjs`
