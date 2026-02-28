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
- PWA instalável com atualização de versão no cliente.
- Operação offline com fila local para create/update/delete e sincronização automática ao reconectar.

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

## PWA e Offline

- Service Worker ativo com precache de assets da aplicação.
- Prompt de atualização quando existe nova versão publicada.
- Política de cache evita conflito com dados do Supabase (API não é cacheada no SW).
- Em modo offline, mutações de despesas/rendas/investimentos entram em fila local.
- Ao voltar conexão, a fila é enviada automaticamente para o banco.

### Fluxo de sincronização offline

1. Usuário cria/edita/deleta um registro sem internet.
2. A operação é armazenada localmente na fila (`localStorage`).
3. A UI reflete a alteração local imediatamente.
4. Quando `online` retorna, o app processa a fila e sincroniza com o Supabase.
5. Os hooks recarregam os dados para garantir consistência final.

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

## Observações de build

O Vite pode exibir aviso de chunk grande (`>500kB`) na build de produção. Isso não bloqueia o deploy; otimizações de code-splitting podem ser aplicadas em etapa futura.

## Checklist rápido de validação (PWA)

1. Rode `npm run build` e confirme geração de `dist/sw.js`.
2. Sirva com `npm run preview`.
3. Instale o app no dispositivo/navegador (Add to Home Screen / Instalar app).
4. Teste offline:
  - desligue a internet;
  - faça um lançamento (despesa/renda/investimento);
  - religue a internet e confirme sincronização automática.





