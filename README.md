# Minhas Finanças

Aplicação React + TypeScript para controle financeiro pessoal, com foco em usabilidade, responsividade e análise mensal/anual de desempenho.

## Principais recursos

- Dashboard com KPIs mensais (rendas, despesas, investimentos e saldo).
- Inclusão rápida na Home (despesa, renda e investimento) sem redirecionamento.
- CRUD completo para despesas, rendas, investimentos e categorias.
- Relatórios com visualização Ano/Mês e múltiplos gráficos (line, bar, area, pie e radar).
- Indicadores de categorias de despesas para atenção (peso percentual no mês).
- Navegação responsiva: menu móvel (drawer) e sidebar desktop colapsável.
- Sistema de tema (light/dark) e paletas de cores com persistência.
- PWA instalável com atualização automática e aviso de nova versão.
- Suporte offline com fila de alterações (create/update/delete) e sincronização automática ao reconectar.

## Stack

- React 18 + TypeScript
- Vite
- Tailwind CSS
- Supabase
- Recharts
- React Router
- Lucide React

## Setup local

1) Instalar dependências:

```bash
npm install
```

2) Criar arquivo `.env` com as credenciais do Supabase:

```env
VITE_SUPABASE_URL=https://seu-projeto.supabase.co
VITE_SUPABASE_ANON_KEY=sua-chave-anon
```

3) Configurar banco no Supabase SQL Editor:

- Para instalação inicial completa: execute [database.sql](database.sql).
- Para atualizar uma base antiga: execute [MIGRATION.sql](MIGRATION.sql).

4) Rodar em desenvolvimento:

```bash
npm run dev
```

## Scripts

- `npm run dev`: ambiente local.
- `npm run build`: valida TypeScript e gera build de produção.
- `npm run preview`: serve build localmente.

## Estrutura (resumo)

```text
src/
  components/   # componentes reutilizáveis (layout, modal, inputs, cards)
  contexts/     # contexto de tema/paleta
  hooks/        # hooks de dados (Supabase)
  pages/        # páginas principais
  types/        # contratos TypeScript
  utils/        # formatadores e helpers
```

## UX e padrões de interface

- Modais centralizados e padronizados em todas as telas.
- Fechamento de modal por `Esc`, clique no fundo e botão de fechar.
- Foco automático no primeiro campo ao abrir formulários.
- Tokens semânticos de cor para manter consistência visual em light/dark.
- Prompt de atualização da PWA (nova versão disponível / modo offline pronto).

## PWA e sincronização offline

- O app pode ser instalado como PWA (desktop/mobile) via navegador compatível.
- O service worker faz precache dos assets do front-end para funcionamento offline da interface.
- Chamadas de API do Supabase não são cacheadas pelo service worker para evitar conflitos de consistência.
- Quando offline, operações de escrita (despesas, rendas, investimentos) entram em fila local.
- Ao reconectar, a fila é sincronizada automaticamente com o banco.

### Fluxo resumido

1. Usuário registra alteração sem conexão.
2. Alteração é armazenada localmente em fila.
3. Evento `online` dispara sincronização.
4. App envia pendências ao Supabase e recarrega dados.

### Arquivos principais da implementação

- [vite.config.ts](vite.config.ts): configuração PWA e Workbox.
- [src/components/PwaUpdatePrompt.tsx](src/components/PwaUpdatePrompt.tsx): prompt de atualização/estado offline.
- [src/components/OfflineSyncManager.tsx](src/components/OfflineSyncManager.tsx): gatilho de sincronização ao reconectar.
- [src/utils/offlineQueue.ts](src/utils/offlineQueue.ts): fila local e flush de pendências.
- [src/hooks/useExpenses.ts](src/hooks/useExpenses.ts), [src/hooks/useIncomes.ts](src/hooks/useIncomes.ts), [src/hooks/useInvestments.ts](src/hooks/useInvestments.ts): fallback offline nas operações de escrita.

## Observações de build

O Vite pode exibir aviso de chunk grande (`>500kB`) na build de produção. Isso não bloqueia o deploy; otimizações de code-splitting podem ser aplicadas em etapa futura.





