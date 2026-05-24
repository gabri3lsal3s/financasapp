---
name: testing-strategy-financas
description: Estratégia Vitest para utils, services e guardrails UI no financasapp. Use ao alterar lógica financeira ou contratos de dados.
---

# Skill: Estratégia de Testes (financasapp)

## Objetivo

Qualidade contínua com testes rápidos alinhados ao papel de cada camada.

## Quando aplicar

- Alteração em `src/utils/**`, `src/services/**`.
- Alteração em fila offline, billing, CSV, `format.ts`.
- Alteração em primitivos UI com snapshot (`uiPrimitivesSnapshot.test.ts`).

## Matriz de decisão

| Mudança | Teste prioritário |
|---------|-------------------|
| Função pura (`creditCardBilling`) | Vitest unitário |
| Fila offline | `offlineQueue.test.ts` |
| Parsing CSV | `creditCardCsvReconciliation.test.ts` |
| Engine investimentos | testes em `services/` ou extrair função pura |
| Primitivo Button/Input | snapshot existente se classes base mudarem |
| Nova página só composição | testar utils extraídos, não E2E |

## Config Vitest (`vite.config.ts`)

```ts
test: {
  globals: true,
  environment: 'node',
  include: ['src/**/*.test.ts'],
  clearMocks: true,
}
```

## Padrão AAA

```ts
it('resolve bill competence when closing day is 5', () => {
  // Arrange
  const date = '2026-03-10'
  // Act
  const result = resolveBillCompetence(date, () => 5)
  // Assert
  expect(result).toBe('2026-03')
})
```

## Banco / Supabase

- Testes unitários **não** dependem de Supabase real por padrão.
- Integração com DB só com projeto de teste dedicado (não assumido hoje).

## Comandos

| Alvo | Comando |
|------|---------|
| Watch | `npm test` |
| CI | `npm run test:run` |
| Lint | `npm run lint` |
| Build | `npm run build` |

## Referências

- `.cursor/rules/14-testing-strategy.mdc`
- `.cursor/skills/testing-quality-habit/SKILL.md`
