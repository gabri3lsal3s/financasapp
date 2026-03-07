# Sprint 0 — Checklist oficial de UX/UI por tela

Este checklist é obrigatório para validação visual de qualquer tela migrada.

## 1) Estrutura e hierarquia

- [ ] A tela usa `PageHeader` com título claro e subtítulo quando necessário.
- [ ] Ações primárias ficam em destaque e em posição consistente.
- [ ] O conteúdo está organizado por blocos (`Card`) com separação visual clara.
- [ ] Há consistência de espaçamento vertical/horizontal entre seções.
- [ ] Alinhamento e centralização visual de blocos equivalentes estão consistentes (cards, listas, ações e badges).

## 2) Tipografia e legibilidade

- [ ] Hierarquia tipográfica coerente (título, subtítulo, texto auxiliar).
- [ ] Texto secundário não compromete legibilidade.
- [ ] Não há mistura desnecessária de estilos tipográficos para mesma finalidade.

## 3) Componentes base

- [ ] Formulários usam `Input`/`Select` padronizados (evitar controles nativos fora do componente).
- [ ] Ações usam `Button`/`IconButton` com variantes oficiais.
- [ ] Modais usam `Modal` padrão e comportamento consistente de abertura/fechamento.
- [ ] Não há botões/inputs estilizados manualmente quando já existe componente equivalente.

## 4) Estados visuais

- [ ] Loading com feedback claro e consistente.
- [ ] Empty state com mensagem compreensível e ação sugerida quando aplicável.
- [ ] Error state com comunicação clara de falha.
- [ ] Success/confirmação com retorno claro ao usuário.

## 5) Interação e acessibilidade essencial

- [ ] Todos os elementos interativos têm foco visível.
- [ ] Fluxos funcionam por teclado (tab/enter/esc nos pontos críticos).
- [ ] Elementos clicáveis não-semânticos possuem semântica/ARIA adequada.
- [ ] Estados disabled são visualmente distinguíveis.

## 6) Responsividade

- [ ] Layout funciona em mobile sem sobreposição/quebra.
- [ ] Layout desktop mantém alinhamento e densidade visual consistentes.
- [ ] Menus, filtros e ações continuam acessíveis em diferentes larguras.

## 7) Qualidade de implementação

- [ ] Cores, espaço, borda e transições vêm de tokens (sem hardcode novo).
- [ ] Classes utilitárias duplicadas foram reduzidas quando possível.
- [ ] Comportamento existente da tela foi preservado.
- [ ] Snapshot/teste relevante foi atualizado.
- [ ] Espaçamentos seguem a escala padrão de tokens (sem espaçamentos ad hoc fora do sistema).

---

## Critério de aprovação da tela

A tela só é considerada concluída quando todos os itens acima estiverem marcados.
