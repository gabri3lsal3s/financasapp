# Backlog de Refatoração — Assistente de Voz

## Checklist de execução (acompanhamento)
- [x] Criar estrutura inicial de `assistant-core`
- [x] Extrair `inferIntent` para módulo dedicado
- [x] Integrar `assistantService` ao `assistant-core` sem quebrar API pública
- [x] Rodar testes focados de parser/assistente (`src/services/assistantService.test.ts`)
- [x] Extrair parser de slots (`amount/date/description/items`) para `assistant-core`
- [x] Extrair e centralizar policy engine de confirmação
- [x] Criar hook unificado de turno para Dashboard + Settings
- [x] Extrair `voiceAdapter` compartilhado e remover duplicação de captação
- [x] Implementar base da trilha offline-first de cadastro com idempotência explícita (fallback para fila offline)
- [x] Fechar Sprint 1 com testes de integração do turno
- [x] Implementar configuração global de método de confirmação (voz/toque/ambos) com aplicação em Dashboard e Settings
- [x] Consolidar policy engine com confirmação por risco (ações sensíveis sempre confirmadas)
- [x] Expor política de confirmação configurável (always/write_only/never+sensível) em Configurações e aplicar no interpretador
- [x] Implementar telemetria mínima do turno (interpretação/confirmação, latência e resultado) com persistência local
- [x] Exibir métricas do assistente em Configurações (acurácia, execução, latência, eventos) com limpeza local
- [x] Adicionar resumo de desempenho dos últimos 7 dias nas métricas do assistente
- [x] Adicionar tendências semanais (7d atual vs 7d anterior) no painel de métricas
- [x] Adicionar filtro de métricas por origem (Geral, Dashboard, Configurações)
- [x] Implementar fila offline dedicada do assistente (interpretar localmente cadastro e sincronizar ao reconectar)
- [x] Exibir indicador visual de comandos do assistente pendentes de sincronização (Dashboard + Configurações)
- [x] Exibir histórico de sincronização offline do assistente em Configurações (última tentativa + lista recente)
- [x] Adicionar ação de limpeza do histórico de sincronização offline do assistente em Configurações
- [x] Validar estabilidade da suíte do assistente após refactors offline (incluindo `assistantService.test.ts`)
- [x] Implementar Session Context Manager local com janela de confirmação e restauração por dispositivo
- [x] Melhorar mensagens de fallback offline para comandos não suportados (orientação de reconexão)
- [x] Implementar memória longa editável local (aplicação automática, autoaprendizado e edição em Configurações)
- [x] Implementar resolução determinística de conflitos de contexto (comando > sessão > memória) com log técnico local
- [x] Implementar política de retenção local e limpeza automática de metadados do assistente (privacidade)
- [x] Exibir painel técnico de logs de decisão de contexto em Configurações (com limpeza dedicada)
- [x] Documentar política de retenção e privacidade do assistente no README
- [x] Isolar componente reutilizável de confirmação do assistente (Dashboard + Configurações)
- [x] Consolidar configurações globais do assistente (idioma, offline e profundidade) em camada única
- [x] Padronizar TTS consultivo em PT-BR com profundidade configurável e cancelamento de fala
- [x] Proteger metadados de voz na fila offline (armazenamento local protegido + limpeza de privacidade)
- [x] Validar build de produção completo após refactors do assistente
- [x] Otimizar chunking do build (manualChunks para React/Supabase/Recharts)
- [x] Fechar Sprint 2 com validação de fluxo híbrido/offline e estabilidade
- [x] Fechar Sprint 3 com hardening, observabilidade e validação completa (build + suíte total)

## Objetivo
Construir um assistente em **português (PT-BR)**, fluido, robusto e integrado ao app inteiro, com:
- interação híbrida (voz + toque),
- confirmação por voz e por UI (configurável),
- arquitetura sem duplicações,
- prioridade offline para cadastro de lançamentos,
- memória longa sem edição manual pelo usuário.

---

## Princípios de Arquitetura (obrigatórios)
1. **Fonte única de verdade** para NLU, slots, validação e políticas de confirmação.
2. **Separação de responsabilidades**: domínio, orquestração, adaptadores de voz/texto/UI e persistência.
3. **Sem lógica duplicada** entre Dashboard, Settings e Edge Function.
4. **Política de decisão única**: regras de segurança > comando atual > contexto de sessão > memória histórica.
5. **Offline-first para cadastro** com reconciliação idempotente.

---

## Épico 1 — Núcleo de Domínio do Assistente
**Meta:** extrair e modularizar a inteligência hoje concentrada em serviço único.

### Story 1.1 — Extrair parser e inferência de intenção
- Prioridade: P0
- Escopo:
  - mover inferência de intenção para módulo dedicado;
  - manter compatibilidade com intenções existentes.
- Critérios de aceite:
  - API estável para `inferIntent(text, context)`;
  - testes atuais de parser continuam passando;
  - cobertura mínima de cenários de regressão mantida.

### Story 1.2 — Extrair resolução de slots e normalização
- Prioridade: P0
- Escopo:
  - separar extração de `amount/date/month/description/category`;
  - padronizar normalização textual e numérica em um util único.
- Critérios de aceite:
  - sem duplicação de normalização entre cliente e edge;
  - erros de parsing retornam códigos tipados.

### Story 1.3 — Motor de políticas (confirmação e risco)
- Prioridade: P0
- Escopo:
  - centralizar regras de `requiresConfirmation`;
  - suportar modo configurável (sempre confirmar, etc.) com default “sempre confirmar”.
- Critérios de aceite:
  - decisões de confirmação explicáveis por regra;
  - ações sensíveis sempre bloqueadas sem confirmação explícita.

### Story 1.4 — Contratos e tipos únicos
- Prioridade: P0
- Escopo:
  - revisar e consolidar contratos de `Intent`, `Slots`, `TurnResult`, `ExecutionResult`.
- Critérios de aceite:
  - contratos usados por UI, hooks e edge sem variações paralelas.

---

## Épico 2 — Orquestração de Conversa e Memória
**Meta:** gerenciar contexto curto e histórico longo com robustez.

### Story 2.1 — Session Context Manager
- Prioridade: P0
- Escopo:
  - introduzir gerenciador de sessão (estado do turno, último comando, pendências);
  - timeout e expiração padronizados.
- Critérios de aceite:
  - retomada de contexto confiável no mesmo dispositivo;
  - não há execução fora da janela de confirmação.

### Story 2.2 — Memória longa (não editável)
- Prioridade: P1
- Escopo:
  - persistir preferências inferidas e padrões úteis;
  - sem UI de edição de memória.
- Critérios de aceite:
  - memória melhora desambiguação sem quebrar comandos explícitos;
  - respeita política de prioridade (comando atual vence memória).

### Story 2.3 — Resolução de conflitos de contexto
- Prioridade: P0
- Escopo:
  - criar mecanismo determinístico para conflitos entre comando, sessão e histórico.
- Critérios de aceite:
  - decisão reproduzível e auditável em logs técnicos.

---

## Épico 3 — Camada de Voz Híbrida (PT-BR)
**Meta:** unificar captação, transcrição e confirmação por voz/toque.

### Story 3.1 — Voice Adapter único
- Prioridade: P0
- Escopo:
  - criar adaptador único para reconhecimento de voz e fallback;
  - remover duplicações de captura em múltiplas páginas.
- Critérios de aceite:
  - Dashboard e Settings usam o mesmo adaptador;
  - estados de voz padronizados (idle/listening/stopped/error).

### Story 3.2 — Confirmação por voz + UI com personalização
- Prioridade: P0
- Escopo:
  - permitir configurar método de confirmação nas Configurações;
  - manter suporte simultâneo (voz + botões).
- Critérios de aceite:
  - preferência salva e aplicada em todo app;
  - fluxo de confirmação não diverge entre telas.

### Story 3.3 — TTS consultivo em PT-BR
- Prioridade: P2
- Escopo:
  - respostas em tom consultivo financeiro;
  - mensagens curtas e acionáveis.
- Critérios de aceite:
  - tom consistente e sem verbosidade excessiva;
  - interrupção/cancelamento de fala sem travar fluxo.

---

## Épico 4 — Offline-First para Cadastro
**Meta:** cadastro por voz funcionando sem internet como prioridade.

### Story 4.1 — NLU local mínima para cadastro
- Prioridade: P0
- Escopo:
  - garantir interpretação local para comandos de adicionar lançamento (despesa/renda/investimento).
- Critérios de aceite:
  - sem internet, usuário consegue cadastrar com confirmação local;
  - comando fica enfileirado para sync.

### Story 4.2 — Fila transacional idempotente
- Prioridade: P0
- Escopo:
  - usar idempotency key por comando confirmado;
  - reconciliação segura na volta de conectividade.
- Critérios de aceite:
  - não cria lançamentos duplicados após reconexão;
  - status final rastreável por comando.

### Story 4.3 — Política de fallback e mensagens
- Prioridade: P1
- Escopo:
  - respostas claras quando recurso exigir rede;
  - orientar automaticamente para modo suportado offline.
- Critérios de aceite:
  - usuário sempre recebe próximo passo explícito.

---

## Épico 5 — Integração App-Wide sem Repetição
**Meta:** comportamento idêntico do assistente em toda aplicação.

### Story 5.1 — Hook unificado de turno
- Prioridade: P0
- Escopo:
  - criar hook único para interpretar, confirmar, executar e sincronizar estado.
- Critérios de aceite:
  - Dashboard e Settings não implementam lógica duplicada de turno.

### Story 5.2 — Componente de confirmação reutilizável
- Prioridade: P1
- Escopo:
  - isolar UI de confirmação (slots editáveis + botões + status) em componente único.
- Critérios de aceite:
  - zero divergência visual/comportamental entre páginas.

### Story 5.3 — Configurações globais do assistente
- Prioridade: P0
- Escopo:
  - centralizar preferências: idioma, confirmação, modo de voz, comportamento offline, profundidade de resposta.
- Critérios de aceite:
  - alteração de configuração impacta imediatamente todos os fluxos.

---

## Épico 6 — Qualidade, Segurança e Observabilidade
**Meta:** robustez operacional e evolução segura.

### Story 6.1 — Testes por camada
- Prioridade: P0
- Escopo:
  - unitários: parser, slots, políticas;
  - integração: turnos e confirmação;
  - smoke: offline + sync.
- Critérios de aceite:
  - suíte do assistente verde no CI;
  - regressões críticas cobertas.

### Story 6.2 — Métricas e telemetria funcional
- Prioridade: P1
- Escopo:
  - métricas: entendimento correto, execução concluída, tempo por tarefa;
  - logs técnicos por etapa do turno.
- Critérios de aceite:
  - painel simples para monitorar evolução semanal.

### Story 6.3 — Hardening de segurança e privacidade
- Prioridade: P0
- Escopo:
  - revisão de dados sensíveis e retenção de metadados de voz;
  - criptografia local para dados persistidos de assistente (quando aplicável).
- Critérios de aceite:
  - nenhuma ação sensível executada sem confirmação;
  - política de retenção documentada.

---

## Ordem de Execução Recomendada (início imediato)
1. **Sprint 1 (P0):** Épico 1 (1.1–1.4) + Épico 5 (5.1) + testes mínimos.
2. **Sprint 2 (P0):** Épico 3 (3.1–3.2) + Épico 4 (4.1–4.2).
3. **Sprint 3 (P1/P2):** Épico 2 (2.1–2.3) + Épico 6 (6.1–6.3) + 3.3/4.3/5.2/5.3.

---

## Definição de Pronto (DoD) por Story
- Código sem duplicação entre camadas equivalentes.
- Tipos/contratos atualizados e usados ponta a ponta.
- Testes novos e existentes relevantes passando.
- Logs e mensagens de erro claros para suporte.
- Fluxo funcionando em português com confirmação conforme configuração.

---

## Critérios de Sucesso (4–6 semanas)
- Taxa de entendimento correto (cadastro): **>= 90%**.
- Taxa de execução concluída após confirmação: **>= 95%**.
- Cadastro offline sincronizando sem duplicidade: **100% dos casos testados**.
- Redução de código duplicado de fluxo assistente nas telas principais: **>= 70%**.

---

## Backlog de arranque (primeiras 10 tasks)
1. Criar estrutura de pastas do `assistant-core`.
2. Extrair `inferIntent` para módulo dedicado + testes.
3. Extrair parser de valores/data/descrição para módulo dedicado.
4. Criar `policyEngine` de confirmação.
5. Consolidar tipos de `TurnResult` e `ExecutionResult`.
6. Criar hook unificado de turno.
7. Migrar Dashboard para hook unificado.
8. Migrar Settings para hook unificado.
9. Criar `voiceAdapter` compartilhado.
10. Validar fluxo offline de cadastro com fila idempotente.
