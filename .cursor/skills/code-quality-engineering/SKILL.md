---
name: code-quality-engineering
description: Padrões de engenharia para financasapp — funções enxutas, tipagem, duplicação, comentários WHY e testes F.I.R.S.T. Use em refactors e PRs.
---

# Skill: Engenharia de Qualidade de Código

## Objetivo

Aplicar diretrizes de estilo sem contradizer arquitetura e segurança. Regras de negócio: `.cursor/rules/`. UI: `.cursor/skills/ui-hsl-primitives/SKILL.md`.

## Funções e controle de fluxo

- Preferir **4–20 linhas** por função; dividir quando ultrapassar.
- **Early returns** em vez de `if` aninhados profundos.
- **Uma responsabilidade** por função (SRP).

## Arquivos e módulos

- Manter arquivos **< 300 linhas**; partir por domínio (`CreditCards.tsx` já grande — extrair utils ao tocar).
- Estrutura: `.cursor/skills/project-structure/SKILL.md`.

## Nomes

- Identificadores em **inglês** (`billCompetence`, `offlineQueue`).
- Texto de UI em **pt-BR**.
- Evitar `data`, `handler`, `temp` em código novo.

## Tipos

- Tipagem explícita em hooks exportados e APIs de `services/`.
- **Proibido `any`**; `unknown` + type guards.
- Tipos de domínio em `src/types/index.ts`.

## Duplicação

- 1 ocorrência: não abstrair.
- 3 ocorrências idênticas: extrair para `utils/`.

## Comentários

- Só comentários **WHY** para regras não óbvias (ex.: exceção de guardrail UI).
- Sem comentários que repetem o código.

## Exceções

- Lançar `Error` com mensagem útil para dev; usuário vê toast traduzido na camada UI.

## Testes F.I.R.S.T.

- Fast, Independent, Repeatable, Self-validating, Timely.
- Priorizar teste no nível mais barato (`utils` > hook > página).

## Logging

- Sem `console.log` em feature de produção.

## Referências

- `.cursor/rules/01-architecture-principles.mdc`
- `.cursor/rules/02-typescript-quality.mdc`
