---
name: ui-hsl-primitives
description: Design system HSL com primitivos Button/Input/Modal/PageHeader, tokens em index.css e guardrails UI. Use ao criar/editar layouts, páginas ou estilos.
---

# Skill: Design System HSL + Primitivos

## Escopo e gatilhos

- `src/components/**/*.tsx` (exceto `consulting/` — compor primitivos da mesma forma)
- `src/pages/**/*.tsx`
- `src/index.css`
- `docs/ui/GOVERNANCA_UI.md`

## Tokens (`src/index.css`)

- Camada `--ds-*`: superfícies, texto, bordas, acentos, intents, motion.
- Camada `--color-*`: aliases semânticos (`--color-primary`, `--color-income`, `--color-expense`, `--color-balance`).
- Classes utilitárias Tailwind mapeadas em `@layer utilities` (ex.: `bg-primary`, `text-secondary`, `border-primary`).

**Proibido:** `#hex` ou `rgb()` hardcoded em TSX — usar `var(--color-*)` ou classes semânticas.

## Primitivos obrigatórios

| Componente | Uso |
|------------|-----|
| `Button` | CTAs; variants `primary`, `secondary`, `danger`, `outline`, `ghost*`; sizes `sm`/`md`/`lg` |
| `Input` | Campos de texto/número/data |
| `Select` | Listas fechadas |
| `Modal` | Diálogos e formulários modais |
| `PageHeader` | `h1` + subtitle + action por página |
| `Layout` | Shell autenticado com navegação |
| `Card` | Superfícies agrupadas |
| `TransactionCard` | Linha de despesa/renda |

## Layout de página

```tsx
<PageHeader title="Despesas" subtitle="Mês atual" action={<Button>...</Button>} />
<main className="flex flex-col gap-4 p-4">...</main>
```

- Um `h1` por tela (`PageHeader`).
- Mobile-first: coluna única; `sm:` para linha em header actions.

## Formatação

- Moeda, percentual, datas: `src/utils/format.ts` (`formatCurrency`, `formatDate`, etc.).
- Guardrail bloqueia `.toFixed()` / `.toLocaleString()` em `pages/` e `components/`.

## Tema

- `ThemeContext` + classes no `document.documentElement`.
- `ColorPaletteSwitcher` para paletas HSL — não adicionar biblioteca de tema externa.

## Guardrails

```bash
npm run guardrails:ui
npm run guardrails:ui:baseline  # só com justificativa
```

## Anti-padrões

- `<button>` / `<input>` nativos em `src/pages/**` sem **WHY**.
- Duplicar `TransactionCard` como card custom por página.
- Cores fixas em `style={{ color: '#10b981' }}`.

## Referências

- `.cursor/rules/07-ui-hsl-design-system.mdc`
- `docs/ui/GOVERNANCA_UI.md`
