---
name: testing-quality-habit
description: Hábito de testes por alteração relevante em utils, services e billing. Use ao implementar features ou quando o usuário pedir Definition of Done.
---

# Skill: Hábito de Testes por Alteração

## Objetivo

Cada mudança relevante sai com pelo menos um teste no nível mais barato que faça sentido.

## Quando aplicar

- Edição em `src/utils/**`, `src/services/**`.
- Alteração em `offlineQueue`, billing, CSV, seleção de mês de cartão.
- Refactor que move lógica de hook para util — criar teste no util.

## Pirâmide (ordem de preferência)

1. **Vitest** em função pura (`src/**/*.test.ts`).
2. **Snapshot** pontual de primitivos UI quando classes estruturais mudam.
3. E2E — **não disponível** no projeto; não bloquear entrega por Playwright inexistente.

## Checklist antes de concluir task

- [ ] Toca `utils/`, `services/` ou regra de billing?
- [ ] Existe teste que falharia se o bug voltasse?
- [ ] `npm run test:run` verde?
- [ ] `npm run lint` verde se tocou UI?
- [ ] Sem `console.log` residual?
- [ ] Sem `any` novo?

## Definition of Done

- Lint passa (quando UI alterada).
- Build passa.
- Testes passam.
- Mensagens de usuário em pt-BR.

## O que não fazer

- Testar snapshot de página inteira para lógica que deveria estar em `utils/`.
- Mock anônimo gigante — preferir dados de fixture nomeados no próprio arquivo de teste.

## Referências

- `.cursor/skills/testing-strategy-financas/SKILL.md`
- `.cursor/skills/code-quality-engineering/SKILL.md`
