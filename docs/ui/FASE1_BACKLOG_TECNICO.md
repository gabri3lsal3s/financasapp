# Fase 1 — Backlog técnico de implementação (tokens e base visual)

Objetivo: consolidar foundation visual (tokens + contratos de componentes) com risco mínimo.

## T1 — Namespace de design tokens

- Criar namespace novo em `src/index.css`:
  - `--ds-color-*`
  - `--ds-space-*`
  - `--ds-radius-*`
  - `--ds-font-*`
  - `--ds-motion-*`
- Manter aliases temporários dos tokens atuais para evitar quebra imediata.

## Critério de aceite
- Novos estilos passam a consumir tokens `--ds-*`.
- Nenhum comportamento visual quebra em tema claro/escuro.

---

## T2 — Mapeamento de tema para tokens semânticos

- Atualizar `ThemeContext` para escrever tokens semânticos em vez de valores acoplados ao componente.
- Garantir que paleta (`vivid`/`monochrome`) continue aplicando cores de renda/despesa/saldo.

## Critério de aceite
- Troca de tema e paleta preserva contraste e semântica visual.
- Tokens antigos continuam funcionais apenas como compatibilidade temporária.

---

## T3 — Contrato oficial de Button

- Validar e documentar variantes suportadas.
- Padronizar estados: default/hover/focus/disabled/active.
- Revisar largura e altura mínimas para toque/teclado.

## Critério de aceite
- Todos os usos de botão em páginas prioritárias usam variantes oficiais.

---

## T4 — Contrato oficial de Input e Select

- Consolidar comportamento visual e de erro.
- Padronizar labels e mensagens de validação.
- Reduzir exceções de controles nativos fora do componente.

## Critério de aceite
- Exceções de `select` nativo mapeadas e convertidas (prioridade: Relatórios).

---

## T5 — Contrato oficial de Card, Modal e PageHeader

- Definir spacing padrão interno e externo.
- Definir composição recomendada para header/ações.
- Definir padrão de footer de modal para CRUD.

## Critério de aceite
- Estruturas repetidas de card/header/modal deixam de usar variações ad hoc.

---

## T6 — Testes de regressão imediata

- Adicionar snapshots DOM dos componentes base (`Button`, `Input`, `Select`, `Card`, `Modal`, `PageHeader`).
- Cobrir estados principais por componente (normal/erro/disabled/variante).

## Critério de aceite
- `npm run test:run` cobre snapshots novos sem falha.

---

## T7 — Padronização de números e valores em formato brasileiro

- Centralizar formatação numérica/monetária em utilitário único (`pt-BR`).
- Remover formatações locais divergentes em componentes/serviços (`toFixed`, `toLocaleString`, `Intl.NumberFormat` fora do helper quando for exibição ao usuário).
- Garantir padrão visual e textual em toda exibição de valores (`1.000,00` e `R$1.000,00`).

## Critério de aceite
- Nenhuma tela/mensagem ao usuário exibe `1000.00` ou variantes fora do padrão brasileiro.
- Helpers centralizados são usados como fonte única de verdade para números/valores.

---

## T8 — Centralização de elementos e padronização de espaçamentos

- Definir regras explícitas de alinhamento horizontal/vertical para blocos equivalentes (cards, linhas de lista, badges, ações e cabeçalhos de seção).
- Normalizar espaçamentos para uso exclusivo da escala de tokens (`--ds-space-*`).
- Corrigir divergências da seção **Despesas por categoria** na Dashboard (centralização/alinhamento e espaçamento).

## Critério de aceite
- Blocos equivalentes da Dashboard e telas prioritárias seguem o mesmo padrão de alinhamento/centralização.
- Não há uso novo de espaçamentos fora da escala de tokens.
- Seção **Despesas por categoria** validada no checklist com alinhamento e espaçamento consistentes.

---

## Sequência de execução sugerida

1. T1
2. T2
3. T3 + T4 (em paralelo leve)
4. T5
5. T6
6. T7
7. T8

---

## Definição de pronto da Fase 1

- Foundation visual em tokens semânticos consolidada.
- Componentes base com contrato visual estável.
- Exceções críticas mapeadas e com plano de migração.
- Testes/snapshots mínimos de proteção estabelecidos.
