# Sprint 0 — Matriz de estados visuais (padrão único)

Esta matriz define a linguagem mínima obrigatória de feedback para todas as telas.

## 1) Loading

## Objetivo
Informar processamento sem bloquear entendimento da tela.

## Regras
- Sempre exibir indicador textual claro (ex.: "Carregando...").
- Em listas/cards, preferir placeholder de conteúdo ao invés de tela vazia abrupta.
- Em ações pontuais (botão), indicar estado de processamento no próprio botão quando aplicável.

## Não permitido
- Ausência total de feedback em operações assíncronas perceptíveis.

---

## 2) Empty

## Objetivo
Comunicar ausência de dados sem parecer erro.

## Regras
- Mensagem direta e contextual (ex.: "Nenhuma despesa no mês selecionado.").
- Sempre que possível, incluir CTA de próximo passo (ex.: "Adicionar item").
- Manter tom neutro e útil.

## Não permitido
- Mensagem genérica sem contexto da tela.

---

## 3) Error

## Objetivo
Comunicar falha e orientar recuperação.

## Regras
- Mensagem clara de falha + ação de recuperação quando possível (ex.: tentar novamente).
- Exibir em região previsível e consistente.
- Diferenciar erro de validação (formulário) de erro operacional (rede/salvamento).

## Não permitido
- Dependência exclusiva de `alert(...)` como canal de erro em fluxo principal.

---

## 4) Success

## Objetivo
Confirmar conclusão da ação sem ruído visual.

## Regras
- Feedback curto e contextual (ex.: "Despesa salva com sucesso").
- Priorizar confirmação inline próxima da ação quando possível.
- Evitar bloquear fluxo do usuário com confirmação desnecessária.

## Não permitido
- Sucesso silencioso em operações sensíveis sem qualquer retorno.

---

## 5) Validação de formulário

## Regras
- Campo com erro deve usar estado visual de erro (`Input`/`Select` com `error`).
- Mensagem de erro deve ser específica e próxima do campo.
- Botão de submissão desabilitado quando dados mínimos não forem válidos.

---

## 6) Priorização de implementação por telas

1. Dashboard — padronizar loading geral e feedback de ação rápida.
2. Despesas/Receitas — consolidar erros de CRUD para padrão único.
3. Cartões — reduzir dependência de `alert(...)` em operações críticas.
4. Relatórios — padronizar empty/loading em blocos de visualização.
5. Configurações — harmonizar estados de teste/conexão (idle/testing/success/error).

---

## 7) Checklist rápido por PR

- [ ] Tela cobre loading/empty/error/success conforme matriz.
- [ ] Não introduz `alert(...)` como principal mecanismo de feedback.
- [ ] Mensagens de status são contextuais e consistentes.
- [ ] Estado visual acompanha estado real da operação.
