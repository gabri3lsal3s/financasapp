# Reimportação B3 — correção de cotas

Após atualizar o motor de posição (desdobro, grupamento e transferências de saída), siga estes passos para alinhar o livro-razão ao extrato XP/B3.

## Pré-requisitos

1. Aplicar a migration `20260601130000_portfolio_reverse_split.sql` no Supabase.
2. Fazer deploy ou rodar o app com a versão que inclui `portfolioLedger.ts`.

## Passos

1. Abra **Investimentos** (`/investments`).
2. Clique em **Conciliação B3** e envie o extrato `.xlsx` mais completo (ex.: `movimentacao-YYYY-MM-DD.xlsx`).
3. Na etapa **Resumo**, confira a tabela **Posição calculada (extrato B3 vs. sistema)**:
   - **BBAS3** deve convergir para ~30 cotas no extrato.
   - **GGRC11** para ~55.
   - **BCFF11** e **ALZM11** para ~0 se já vendidos.
4. Importe lançamentos **Faltando** (vendas e transferências de saída).
5. Em **Alertas Razão**, revise lançamentos `split` antigos que inflaram a posição (ex.: efeito de multiplicar em vez de somar). Exclua duplicatas ou corrija no modal do ativo.
6. Resolva **Divergentes** aceitando a sugestão do extrato quando fizer sentido.
7. Na etapa **Posição B3**, envie o relatório `posicao-*.xlsx` (exportado em Investimentos → Posição atual) para a dupla checagem: custódia oficial × movimentações × livro-razão.
8. Force atualização da página ou limpe o cache PWA (recarregar com rede) para renovar `portfolio-valuation-data-*`.

## Validação

- Na grade de ativos, confira cotas de BBAS3, GGRC11, BCFF11 e ALZM11.
- Abra o modal de transações de cada ticker e confira se vendas e desdobros batem com o extrato.

## Observações

- **Desdobro**: a coluna Quantidade do extrato B3 são **cotas creditadas**, não fator multiplicador.
- **Transferência** espelhada (Crédito + Débito, mesma data/qtd): **ignorada** (movimento interno de custódia; não é compra nem venda).
- Saída real de cotas aparece como **Transferência - Liquidação** em **Débito** (ou venda explícita).
- **Grupamento**: registrado como `reverse_split` (cotas canceladas).
