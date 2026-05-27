---
name: offline-hooks-data
description: Padrão cache-then-revalidate com offlineCache, eventos local-data-changed e hooks use*. Use ao criar/editar hooks de listagem ou cache.
---

# Skill: Hooks de Dados + Cache Offline

## Escopo e gatilhos

- `src/hooks/use*.ts`
- `src/services/offlineCache.ts`
- `src/hooks/useBackgroundCache.ts`

## Fluxo padrão de leitura

```text
1. Ler getCache(key) → hidratar estado se existir
2. setLoading(true) se não houver cache
3. supabase.from(...).select(...) 
4. setCache(key, data) + setState
5. setLoading(false)
```

## Invalidação

- Após mutação local ou remota bem-sucedida:
  - `setCache(key, updatedData)`
  - `window.dispatchEvent(new Event('local-data-changed'))`
- Hooks escutam `local-data-changed` e `online` para recarregar (padrão em `useExpenses`, `useIncomes`, etc.).

## Chaves de cache

- Incluir escopo do usuário e filtro temporal quando aplicável (mês, cartão).
- Não cachear listas gigantes sem necessidade de tela.

## Optimistic / offline IDs

- Registros pendentes: `id` começando com `offline-`.
- UI deve tolerar badge/estado diferenciado (`TransactionCard`).

## Proibições

- Não adicionar TanStack Query sem ADR/decisão explícita.
- Não duplicar política de cache em cada hook — extrair helper se 3+ hooks repetirem o mesmo boilerplate.

## Referências

- `.cursor/rules/13-offline-cache-hooks.mdc`
- `.cursor/skills/supabase-hooks-mutations/SKILL.md`
