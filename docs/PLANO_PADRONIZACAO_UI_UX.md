# Plano completo de organização e padronização visual (UI/UX)

## 1) Contexto e direcionadores definidos

Este plano foi desenhado com base nas decisões já alinhadas:

- Objetivo principal: **usabilidade + consistência visual**.
- Escopo: **componentes base, páginas principais, tema/paleta, navegação/layout, feedbacks de estado e microinterações**.
- Regra de padronização: **estrita**.
- Tokens: **obrigatórios** (sem valores soltos/hardcoded fora do sistema).
- Refatoração: **nível médio**.
- Tolerância a regressão visual: **baixíssima**.
- Validação: **checklist de UX/UI + snapshots**.
- Prioridade de telas fase 1: **Dashboard, Despesas, Receitas, Cartões, Relatórios e Configurações**.

---

## 2) Diagnóstico inicial do app (baseline técnico)

Pontos observados no código atual:

1. Já existe base de tokens via CSS variables em `src/index.css` e aplicação dinâmica no `ThemeContext`.
2. Há mistura de estilos via utilitários Tailwind + variáveis CSS + classes utilitárias customizadas.
3. Componentes base (`Button`, `Input`, `Card`, `Modal`) já têm boa estrutura, mas sem contrato visual único formalizado.
4. Layout e navegação mobile/desktop estão robustos, porém sem uma especificação central de espaçamentos, densidade e hierarquia.
5. Não há pipeline específico de regressão visual por imagem; hoje a base é Vitest + Testing Library.

Implicação: o caminho de menor risco é **evolutivo**, consolidando tokens e contratos de componentes antes da migração total das telas.

---

## 3) Princípios obrigatórios de implementação

1. **Token-first**: qualquer cor, espaçamento, raio, tipografia, sombra, duração e easing deve vir de token.
2. **Componente-first**: telas só usam variantes aprovadas dos componentes base.
3. **Acessibilidade essencial (mínimo obrigatório)**:
   - foco visível consistente,
   - navegação por teclado para elementos interativos,
   - contraste funcional,
   - estados de erro/sucesso legíveis.
4. **Sem regressão silenciosa**: toda mudança visual relevante precisa de checklist e evidência de teste/snapshot.
5. **Simplicidade e replicabilidade**: evitar lógica visual ad hoc por página.
6. **Formatação BR obrigatória**: todos os números e valores exibidos ao usuário devem seguir padrão brasileiro (ex.: `1.000,00` e `R$1.000,00`).
7. **Ações de exclusão padronizadas**: usar botão com **ícone de lixeira discreto** como representação padrão de remover/excluir em toda a aplicação.
8. **Alinhamento e centralização consistentes**: elementos equivalentes devem manter o mesmo alinhamento horizontal/vertical e centralização visual entre telas e seções.
9. **Espaçamento padronizado por escala**: toda distância interna/externa deve seguir a escala de espaçamento definida em tokens, sem variações arbitrárias.

---

## 4) Arquitetura-alvo de design system (dentro do app)

## 4.1 Camadas

- **Camada 1 — Foundation (tokens)**
  - cores semânticas (surface, text, border, intent),
  - spacing scale,
  - radius scale,
  - typography scale,
  - motion tokens (duration/easing).

- **Camada 2 — Primitives**
  - `Button`, `Input`, `Select`, `Card`, `Modal`, `IconButton`, badges e feedbacks.

- **Camada 3 — Patterns**
  - `PageHeader`, blocos de filtro, blocos de KPIs, listas e seções padrão.

- **Camada 4 — Screens**
  - páginas de negócio consumindo apenas componentes/patterns aprovados.

## 4.2 Convenção de naming dos tokens

- `--ds-color-*`
- `--ds-space-*`
- `--ds-radius-*`
- `--ds-font-*`
- `--ds-motion-*`

Obs.: manter compatibilidade temporária com tokens antigos em fase de transição (alias), removendo-os no hardening final.

---

## 5) Plano faseado de execução

## Fase 0 — Preparação e baseline (Sprint 0)

**Objetivo:** garantir ponto de partida estável e critério objetivo de comparação.

**Tarefas:**
1. Criar checklist oficial de UX/UI por tela.
2. Inventariar componentes e variantes em uso real.
3. Mapear classes/tokens hardcoded mais frequentes.
4. Definir matriz de estados padrão (loading, empty, error, success).
5. Definir estratégia de snapshots (inicial: snapshots DOM por componente + telas-chave).

**Entregáveis:**
- documento de checklist,
- inventário de componentes e divergências,
- backlog priorizado por impacto.

**DoD:** baseline aprovado e pronto para iniciar tokenização sem retrabalho.

---

## Fase 1 — Fundação de tokens (alto impacto, baixo risco)

**Objetivo:** padronizar visual na raiz sem mexer pesado em regras de negócio.

**Tarefas:**
1. Consolidar tokens semânticos no CSS global.
2. Criar aliases temporários para manter compatibilidade.
3. Mapear tema/paleta para o novo namespace de tokens.
4. Eliminar valores duplicados de cor/espaço/transição fora dos tokens.
5. Definir utilitários de apoio (quando estritamente necessário).
6. Consolidar utilitários globais de formatação numérica e monetária em padrão brasileiro.

**Entregáveis:**
- matriz de tokens final,
- temas compatíveis,
- guia de uso de tokens.

**DoD:** nenhuma nova UI usa valor solto; novos PRs já obedecem ao padrão.

---

## Fase 2 — Padronização dos componentes base

**Objetivo:** criar API visual única e previsível para toda a aplicação.

**Tarefas:**
1. Formalizar variantes/sizes/estados dos componentes base.
2. Remover classes duplicadas repetidas nas telas.
3. Garantir acessibilidade essencial por componente.
4. Adicionar testes de comportamento + snapshots de markup/estados.
5. Publicar guia rápido de uso por componente.

**Componentes alvo iniciais:**
- `Button`, `Input`, `Select`, `Card`, `Modal`, `IconButton`, `PageHeader`.

**DoD:** componentes base com contrato estável; telas só podem usar variantes oficiais.

---

## Fase 3 — Layout, navegação e padrões de página

**Objetivo:** uniformizar estrutura visual entre mobile e desktop.

**Tarefas:**
1. Definir template padrão de página (header, ações, conteúdo, espaçamentos).
2. Padronizar comportamento do menu mobile/desktop e hierarquia de navegação.
3. Normalizar grid, container e gutters responsivos.
4. Padronizar blocos de seção e títulos secundários.

**DoD:** qualquer nova tela consegue ser montada com template + patterns sem CSS ad hoc.

---

## Fase 4 — Migração das páginas prioritárias

**Objetivo:** colher ganho visível de consistência e usabilidade nas telas críticas.

Ordem sugerida por impacto:
1. Dashboard
2. Despesas
3. Receitas
4. Cartões
5. Relatórios
6. Configurações

**Tarefas por página:**
1. Substituir estilos locais por componentes/tokens oficiais.
2. Aplicar padrões de feedback e hierarquia visual.
3. Ajustar densidade, espaçamento e legibilidade.
4. Validar checklist + snapshots antes de avançar para próxima tela.
5. Validar consistência de alinhamento/centralização em grids, listas, cards e blocos de ação.

**DoD:** página migrada sem regressão funcional e com checklist 100% atendido.

---

## Fase 5 — Estados de feedback e microinterações

**Objetivo:** consistência de percepção e resposta da interface.

**Tarefas:**
1. Padronizar loading/skeleton.
2. Padronizar empty state e mensagem de ação.
3. Padronizar erro e recuperação.
4. Unificar animações e transições via motion tokens.
5. Respeitar preferências de redução de movimento.

**DoD:** estados iguais em linguagem visual e comportamento no app inteiro.

---

## Fase 6 — Hardening, limpeza e governança

**Objetivo:** impedir regressão futura e manter escalabilidade.

**Tarefas:**
1. Remover aliases legados que não forem mais necessários.
2. Criar guardrails de lint/review para proibir hardcode visual.
3. Consolidar documentação viva do design system interno.
4. Criar checklist de PR visual obrigatório.

**DoD:** padrão estabilizado e sustentável para evolução contínua.

---

## 6) Backlog inicial priorizado (para começar agora)

## P0 — Iniciar imediatamente

1. Criar checklist oficial UX/UI por tela.
2. Inventariar uso real de componentes base nas páginas prioritárias.
3. Definir e congelar nomenclatura final de tokens semânticos.
4. Implementar tokens consolidados com aliases temporários.
5. Fechar contrato de variantes do `Button` e `Input`.
6. Fechar contrato de `Card` e `PageHeader`.
7. Criar snapshots de componentes base (estados principais).

## P1 — Após estabilizar base

1. Migrar Dashboard para padrões oficiais.
2. Migrar Despesas e Receitas.
3. Migrar Cartões e Relatórios.
4. Migrar Configurações.
5. Padronizar estados de loading/erro/vazio.
6. Corrigir inconsistências de centralização e espaçamento na seção **Despesas por categoria** da Dashboard.

## P2 — Hardening

1. Remover classes/tokens legados remanescentes.
2. Criar regra automática para bloquear valores visuais soltos.
3. Consolidar guia técnico de contribuição visual.

---

## 7) Critérios de aceite (Definition of Done visual)

Uma entrega visual só é considerada concluída quando:

1. Usa apenas tokens e variantes aprovadas.
2. Não introduz hardcode visual.
3. Mantém navegação e foco por teclado nos elementos interativos.
4. Passa no checklist de UX/UI da tela.
5. Possui teste/snapshot atualizado para o que mudou.
6. Não quebra comportamento funcional existente.
7. Exibe números/valores no padrão brasileiro (`1.000,00` / `R$1.000,00`) sem formatações locais divergentes.
8. Mantém centralização e alinhamento visual consistentes com os padrões da tela.
9. Usa somente espaçamentos da escala padrão definida em tokens.

---

## 8) Modelo de checklist UX/UI por tela

1. Hierarquia visual clara (título, subtítulo, ações, conteúdo).
2. Espaçamento consistente entre blocos e elementos.
3. Tipografia consistente por nível de informação.
4. Estados de botão/campo (default, hover, focus, disabled, erro) consistentes.
5. Feedback de carregamento, vazio e erro presente e compreensível.
6. Navegação por teclado funcional e foco visível.
7. Responsividade mobile e desktop sem quebra de layout.
8. Contraste e legibilidade aceitáveis para uso contínuo.
9. Centralização e alinhamento de títulos, valores, badges e ações estão consistentes entre blocos equivalentes.
10. Espaçamentos aplicados seguem a escala padrão (sem ajustes ad hoc fora de token).

---

## 9) Estratégia de testes de regressão visual

Como base atual não possui suíte dedicada de screenshot visual, iniciar em 2 camadas:

1. **Camada A (imediata, sem mudança de stack):**
   - snapshots DOM/markup dos componentes base e padrões críticos com Vitest.
2. **Camada B (opcional, próxima etapa):**
   - adicionar snapshots por imagem para páginas prioritárias (ferramenta a definir).

Assim garantimos proteção rápida agora e evolução para proteção visual mais forte depois.

---

## 10) Riscos e mitigação

1. **Risco:** ruptura por migração ampla em telas complexas.
   - **Mitigação:** migrar por página em ondas curtas + validação por checklist.
2. **Risco:** duplicidade de estilos no período de transição.
   - **Mitigação:** aliases temporários com prazo de remoção definido.
3. **Risco:** regressão silenciosa de UX em interação/foco.
   - **Mitigação:** critérios de aceite e testes por estado interativo.

---

## 11) Sequência prática para início da implementação (próximos passos)

1. Executar Sprint 0 (baseline e checklist).
2. Implementar Fase 1 (tokens) em branch dedicada.
3. Fechar componentes base críticos (`Button`, `Input`, `Card`, `PageHeader`).
4. Iniciar migração da Dashboard como tela piloto.
5. Validar processo e escalar para demais páginas prioritárias.

---

## 12) Resultado esperado

Ao fim do plano, o app terá:

- linguagem visual coesa e previsível,
- menor custo de manutenção de UI,
- maior velocidade para criar/alterar telas,
- menos regressões visuais,
- base replicável para evolução contínua.

---

## 13) Artefatos já criados para início da implementação

- Checklist oficial: `docs/ui/SPRINT0_CHECKLIST_UI_UX.md`
- Inventário de componentes: `docs/ui/SPRINT0_COMPONENT_INVENTORY.md`
- Matriz de estados visuais: `docs/ui/SPRINT0_STATE_MATRIX.md`
- Backlog técnico da Fase 1: `docs/ui/FASE1_BACKLOG_TECNICO.md`
