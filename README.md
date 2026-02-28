# Minhas Finanças

Aplicação React + TypeScript para controle financeiro pessoal, com foco em usabilidade, responsividade e análise mensal/anual de desempenho.

## Principais recursos

- Dashboard com KPIs mensais (rendas, despesas, investimentos e saldo) e atalhos de detalhamento.
- Inclusão rápida na Home (despesa, renda e investimento) sem redirecionamento.
- CRUD completo para despesas, rendas, investimentos e categorias.
- Página unificada de categorias (`/categories`) com atalhos para categorias de despesa e renda.
- Limites mensais por categoria de despesa e expectativas mensais por categoria de renda.
- Herança automática do mês anterior para limites/expectativas quando o mês atual ainda não possui valor definido.
- Exclusão segura de categorias com reatribuição automática para `Sem categoria` quando houver lançamentos vinculados.
- Relatórios com visualização Ano/Mês, detalhamento por categoria no próprio fluxo, comparação anual com ano anterior e botão discreto `Ver mais` para listas extensas.
- Seletores por item em despesas e rendas para inclusão total/parcial/zero nos relatórios (útil para reembolsos).
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

## Estrutura de dados (resumo)

Além das tabelas principais (`categories`, `income_categories`, `expenses`, `incomes`, `investments`), o projeto usa:

- `expense_category_month_limits`: limite mensal por categoria de despesa.
- `income_category_month_expectations`: expectativa mensal por categoria de renda.

Os scripts [database.sql](database.sql) e [MIGRATION.sql](MIGRATION.sql) já incluem criação de tabelas, constraints e índices dessas estruturas.

## PWA e Offline

- Service Worker ativo com precache de assets da aplicação.
- Prompt de atualização quando existe nova versão publicada.
- Política de cache evita conflito com dados do Supabase (API não é cacheada no SW).
- Em modo offline, mutações de despesas/rendas/investimentos entram em fila local.
- Ao voltar conexão, a fila é enviada automaticamente para o banco.

### Assistente por voz no PWA

- O `Dashboard` possui atalho de uso final do assistente (fluxo por voz, sem redirecionamento de página).
- A tela de `Configurações` concentra as funções de teste/diagnóstico do assistente (texto, voz, insights e validação).
- Requisitos de navegador:
  - HTTPS ativo (ou localhost em desenvolvimento);
  - navegador com Web Speech API (Chrome/Edge Android);
  - permissão de microfone concedida.
- Padrões de UX do assistente:
  - botão de voz com toggle (`Falar Comando` / `Parar Escuta`);
  - finalização por silêncio após a fala;
  - estado visual de escuta (`Escutando`, `Parou`, `Comando ouvido`);
  - confirmação manual editável por clique no texto antes de confirmar;
  - para `add_expense`, confirmação é somente manual no app.
- Escopo atual do assistente:
  - adição de `despesa`, `renda` e `investimento`.
  - demais funções ficam fora do fluxo principal de voz.
- Regra de descrição:
  - o assistente salva descrições curtas e polidas (`Almoço`, `Almoço com Glenda`, `Hambúrguer com Gabi`) em vez de gravar o comando completo.
- Comandos com múltiplos itens:
  - o assistente aceita lote na mesma frase para adição, por exemplo:
    - `adicionar despesa 25 almoço e 18 uber`
    - `registrar renda 3000 salário e 450 freelancer`
    - `adicionar investimento 200 tesouro e 150 reserva`
  - cada item é interpretado e salvo separadamente, com retorno de quantidade adicionada.
- Fluxo recomendado de validação:
  1. Dashboard: tocar no atalho do assistente e falar um comando completo;
  2. Confirmar manualmente quando o comando exigir confirmação;
  3. Configurações: usar bloco `Assistente (MVP)` para testes de texto, voz e insights;
  4. Validar persistência no Supabase e feedback visual do comando reconhecido.

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
- Itens de lista clicáveis para edição rápida; ações destrutivas concentradas no modal de edição.
- Tokens semânticos de cor para manter consistência visual em light/dark.

## Segurança e autenticação

- O script padrão está preparado para ambiente sem autenticação (RLS desabilitado).
- Para produção multiusuário, habilite RLS e políticas por `user_id` antes de publicar.

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

## Checklist funcional rápido

1. Crie categorias em despesas e rendas.
2. Em `Categorias`, defina limite/expectativa no mês atual e confirme salvamento.
3. Troque para o mês seguinte e valide herança automática do valor anterior.
4. Abra `Relatórios` e teste detalhamento por categoria (mês e ano).
5. Delete uma categoria com lançamentos e confirme reatribuição para `Sem categoria`.





