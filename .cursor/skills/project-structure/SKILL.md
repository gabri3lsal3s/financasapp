---
name: project-structure
description: Define a estrutura de diretórios do SPA React+Vite+Supabase (financasapp). Use ao criar, mover ou nomear arquivos no repositório.
---

# Skill: Estrutura de Diretórios (Minhas Finanças)

Respeita estritamente esta topologia ao criar, mover ou editar arquivos.

## Escopo e gatilhos

Usa esta skill para qualquer alteração de arquivos no repositório `financasapp` / `minhas-financas`.

## Princípios fundamentais

- **Monorepo frontend único** na raiz — um `package.json`, sem pacotes workspace separados.
- **Não há** `src/app/` (Next.js) nem `src/server/` com Drizzle — dados via Supabase no cliente.
- Roteamento: `src/pages/**` + registro em `src/App.tsx`.

## Layout obrigatório

```text
financasapp/
  .cursor/
  database/                 # SQL base e samples
  docs/                     # ARCHITECTURE.md, ui/GOVERNANCA_UI.md
  public/                   # manifest PWA, ícones, assets estáticos
  scripts/                  # ui-guardrails.mjs
  supabase/migrations/      # evoluções RLS/schema
  src/
    components/             # UI reutilizável (primitivos + consulting/)
    constants/
    contexts/               # Auth, Theme
    hooks/                  # useExpenses, useIncomes, ...
    lib/                    # supabase client
    pages/                  # telas (Dashboard, Expenses, ...)
    services/               # offlineCache, investmentEngine, ai, pdf
    types/
    utils/                  # billing, offlineQueue, format
    App.tsx
    main.tsx
    index.css
  vite.config.ts
  vercel.json
  tailwind.config.js
  tsconfig.json
```

## Decisão rápida (onde colocar?)

| Caso | Diretório |
|------|-----------|
| Nova tela | `src/pages/<Nome>.tsx` + rota em `App.tsx` |
| Hook de dados Supabase | `src/hooks/use<Entidade>.ts` |
| Regra pura / parsing | `src/utils/<area>.ts` |
| Integração externa / engine | `src/services/<nome>.ts` |
| Primitivo UI (botão, input) | `src/components/<Nome>.tsx` |
| Feature consultoria | `src/components/consulting/**` |
| Tipo compartilhado | `src/types/index.ts` |
| Migration SQL | `supabase/migrations/<data>_<desc>.sql` |
| Bootstrap schema | `database/database.sql` |

## Regras de fronteira

- `src/utils/**` e funções puras: sem import de React, sem side effect de UI.
- `src/hooks/**`: orquestra Supabase + cache + fila offline — lógica pesada delegada a `utils/` / `services/`.
- `src/pages/**`: composição de componentes; evitar centenas de linhas de regra de negócio inline.

## Checklist antes de concluir

- [ ] Arquivo no diretório correto para sua responsabilidade?
- [ ] Nova página registrada em `App.tsx` e, se autenticada, dentro de `ProtectedRoute` + `Layout`?
- [ ] Migration SQL criada quando o schema/RLS mudar?
- [ ] Primitivo UI reutilizado em vez de duplicar `<button>` em página?

## Referências

- `.cursor/rules/03-react-vite-spa.mdc`
- `.cursor/rules/04-supabase-database-rls.mdc`
- `docs/ARCHITECTURE.md`
