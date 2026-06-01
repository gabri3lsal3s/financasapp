---
name: supabase-hooks-mutations
description: CRUD Supabase em hooks com fila offline, tratamento de erro pt-BR e atualização de cache. Use ao implementar create/update/delete.
---

# Skill: Mutações Supabase em Hooks

## Escopo e gatilhos

- `src/hooks/useExpenses.ts`, `useIncomes.ts`, `useInvestments.ts`, `useCreditCards.ts`, etc.
- `src/utils/offlineQueue.ts`

## Fluxo de mutação online

```text
1. Validar entrada (tipos + regras em utils quando pesado)
2. supabase.from(table).insert|update|delete
3. Em erro → toast/mensagem pt-BR, não vazar SQL
4. Em sucesso → atualizar cache + local-data-changed
```

## Fluxo offline

```text
1. shouldQueueOffline() === true
2. enqueueOfflineOperation({ entity, action, recordId?, payload })
3. Atualizar UI com id offline-*
4. Sync posterior no evento online (OfflineSyncManager)
```

## Entidades da fila

`expenses` | `incomes` | `investments` | `credit_cards` | `credit_card_bills` | `categories` | `income_categories` | `expense_category_month_limits` | `income_category_month_expectations` | `user_settings`

Ao adicionar entidade: estender `QueueEntity` em `offlineQueue.ts` + handler de sync.

## Select explícito

- Projeção de colunas na resposta pós-insert quando necessário.
- Evitar `.select('*')` em perfil.

## Erros

- Mapear códigos PostgREST comuns para mensagens amigáveis.
- Conflito pós-sync → `ConflictResolutionModal` / `readConflictQueue`.

## Anti-padrões

- Mutação só em componente de página sem passar pelo hook.
- Esquecer fila offline em feature nova de escrita.
- Lógica de parcelamento/fatura inline — usar `creditCardBilling`.

## Referências

- `.cursor/rules/09-hooks-services-contracts.mdc`
- `.cursor/rules/12-pwa-offline-first.mdc`
