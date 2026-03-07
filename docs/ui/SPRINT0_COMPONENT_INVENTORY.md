# Sprint 0 — Inventário de componentes e divergências

Inventário inicial com base no uso real em `src/pages` e componentes compartilhados.

## 1) Componentes base detectados

- `PageHeader`
- `Card`
- `Button`
- `Input`
- `Select`
- `Modal`
- `IconButton`
- `MonthSelector`

## 2) Cobertura por páginas prioritárias

## Dashboard (`src/pages/Dashboard.tsx`)
- Usa: `PageHeader`, `Card`, `MonthSelector`, `Button`, `Modal`, `Input`, `Select`.
- Observação: tela densa, boa candidata para piloto de padronização.

## Despesas (`src/pages/Expenses.tsx`)
- Usa: `PageHeader`, `Card`, `Button`, `Modal`, `Input`, `Select`, `MonthSelector`.
- Observação: padrão bem próximo da base, baixo risco de migração.

## Receitas (`src/pages/Incomes.tsx`)
- Usa: `PageHeader`, `Card`, `Button`, `Modal`, `Input`, `Select`, `MonthSelector`.
- Observação: semelhante a Despesas, ideal para migração em onda conjunta.

## Cartões (`src/pages/CreditCards.tsx`)
- Usa: `PageHeader`, `Card`, `Button`, `IconButton`, `Input`, `Modal`, `Select`, `MonthSelector`.
- Observação: alta complexidade e maior chance de divergência visual.

## Relatórios (`src/pages/Reports.tsx`)
- Usa: `PageHeader`, `Card`, `Modal`.
- Divergência relevante: presença de `select` nativo com classe local (`selectClasses`) em vez de `Select` componente.

## Configurações (`src/pages/Settings.tsx`)
- Usa: `PageHeader`, `Card`, `Input`, `Select`, `Button`.
- Observação: muitos blocos de status e feedback, ideal para consolidar matriz de estados.

## 3) Variantes e padrões em uso

## Button
- Variantes em uso real: `primary` (implícita), `outline`, `danger`.
- Tamanhos em uso real: `sm`, padrão (`md`).
- Propriedade comum: `fullWidth` em ações de modal.

## Input/Select
- Uso recorrente com `label` e `error`.
- Forte aderência, porém ainda existem exceções com elementos nativos em algumas telas.

## Modal
- Uso amplo em CRUD e edição.
- Padrão de ações no rodapé repetido entre páginas (oportunidade de padronizar pattern de footer).

## IconButton
- Uso forte em Cartões e controles de ação contextual.

## 4) Principais divergências a tratar (P0/P1)

1. `select` nativo em Relatórios em vez de `Select` padronizado.
2. Botões com classes locais em alguns pontos em vez de `Button`.
3. Padrões de loading/empty/error/success variando por tela.
4. Repetição de blocos visuais de formulário e ações de modal.
5. Uso de mensagens de erro com `alert(...)` em múltiplas páginas (UX inconsistente).

## 5) Ação imediata sugerida

1. Fechar contrato final de `Button`, `Input`, `Select`, `Modal`, `Card`, `PageHeader`.
2. Migrar exceções evidentes (especialmente `Reports`) para os componentes base.
3. Aplicar matriz de estados padronizada antes da migração em massa das telas.
