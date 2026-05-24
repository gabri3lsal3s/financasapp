---
name: vercel-deploy
description: Quality gate e deploy SPA na Vercel para financasapp. Use ao preparar release ou configurar ambiente.
---

# Skill: Deploy Vercel

## Escopo e gatilhos

- `vercel.json`
- Variáveis de ambiente de produção
- Checklist pré-deploy

## Quality gate padrão

```bash
npm run lint
npm run test:run
npm run build
```

## Hotfix mínimo

```bash
npm run test:run
npm run build
```

## Configuração SPA (`vercel.json`)

- Rewrite: todas as rotas → `/index.html` (React Router).
- `index.html`: `Cache-Control: no-cache`.
- `/assets/*`: cache longo imutável (hash no filename do Vite).

## Variáveis no painel Vercel

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`
- Demais `VITE_*` conforme features (ex.: AI, se habilitada com cuidado).

## Build output

- Diretório: `dist/`
- Comando de build: `npm run build` (`tsc && vite build`)

## Rollback

- Usar deployment anterior no painel Vercel ou redeploy de commit `sha` conhecido.
- Não depender só do deployment `production` sem referência de commit.

## Anti-padrões

- Deploy com testes vermelhos em utils de billing.
- Commitar `.env` ou pasta `env/`.

## Referências

- `.cursor/rules/16-vercel-release.mdc`
