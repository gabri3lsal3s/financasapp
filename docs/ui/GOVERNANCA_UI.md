# Governança UI/UX

Este documento define a camada de proteção para evitar regressões visuais após a padronização.

## Objetivo

- Bloquear **novas violações** de consistência visual.
- Permitir evolução incremental sem exigir refatoração massiva imediata.
- Garantir uso de padrões compartilhados (tokens, primitives e formatadores centrais).

## Guardrails automatizados

Script: `scripts/ui-guardrails.mjs`

Regras monitoradas:

1. `ui-no-direct-number-formatting`
   - Evita `toFixed`/`toLocaleString` em áreas de UI e mensagens.
   - Preferir funções centralizadas de `src/utils/format.ts`.
2. `ui-no-raw-hex-color`
   - Evita cores HEX hardcoded.
   - Preferir tokens do design system (`--ds-*` / aliases já existentes).
3. `ui-no-native-control-in-pages`
   - Evita controles HTML nativos em páginas.
   - Preferir primitives compartilhadas (`Input`, `Select`, `Button`, etc.).

## Baseline (estado atual)

Arquivo: `docs/ui/guardrails-baseline.json`

- A baseline registra ocorrências já existentes no projeto.
- O CI/local falha apenas quando surgem violações **novas** além da baseline.

## Comandos

- `npm run guardrails:ui`
  - Valida o projeto contra a baseline.
- `npm run guardrails:ui:baseline`
  - Atualiza a baseline (uso consciente, com revisão em PR).
- `npm run lint`
  - Executa `guardrails:ui` + ESLint.

## Fluxo recomendado de PR

1. Implementar mudanças UI.
2. Executar `npm run lint` e `npm run build`.
3. Se houver nova violação:
   - Corrigir para aderir ao padrão, **ou**
   - Atualizar baseline apenas quando a exceção for intencional e aprovada.
4. Em caso de baseline atualizada, descrever justificativa no PR.
