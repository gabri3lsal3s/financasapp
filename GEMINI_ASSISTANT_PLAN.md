# Integração Android + Gemini/Assistant (Voz)

## Objetivo
Permitir que o usuário interaja por voz com o app (Android/Gemini/Assistant) para executar ações financeiras e receber respostas faladas.

Exemplos:
- "Adicione uma despesa de 42 reais com almoço"
- "Registre renda de 3000 salário"
- "Qual meu saldo do mês?"
- "Me dê insights deste mês"

## Checklist de execução (status real)

### Fundação de dados
- [x] `MIGRATION_ASSISTANT.sql` aplicada no banco
- [x] Tabelas `assistant_sessions`, `assistant_commands`, `assistant_confirmations`, `assistant_category_mappings`
- [x] Índices principais e chave de idempotência

### Núcleo do assistente no app
- [x] Serviço base em `src/services/assistantService.ts`
- [x] Interpretação de intenção (`interpretAssistantCommand`)
- [x] Confirmação obrigatória para escritas (`confirmAssistantCommand`)
- [x] Expiração de confirmação (janela de 2 minutos)
- [x] Inferência de categoria por mapeamento + heurística + fallback
- [x] Persistência de `user_id` quando usuário autenticado
- [x] Normalização de descrição curta para lançamentos por voz

### Ações implementadas
- [x] `add_expense`
- [x] `add_income`
- [x] `add_investment`
- [x] `get_month_balance`
- [x] `list_recent_transactions`
- [x] `monthly_insights`
- [x] `update_transaction` (seleção do lançamento mais provável + atualização de valor/descrição)
- [x] `delete_transaction` (seleção do lançamento mais provável + exclusão com confirmação)
- [x] `create_category` (detecção do tipo despesa/renda + validação de duplicidade + criação)

### Superfície de testes
- [x] Hook `useAssistant` para integração (`src/hooks/useAssistant.ts`)
- [x] Painel MVP na página de configurações para testar fluxo completo
- [x] Contrato de bridge de voz + orquestrador de turnos (`src/types/assistantBridge.ts`, `src/services/assistantBridge.ts`)
- [x] Endpoint HTTP do bridge via Supabase Edge Function (`supabase/functions/assistant-bridge/index.ts`)
- [x] Skeleton Android nativo (Kotlin) para consumo do bridge (`android-skeleton/`)
- [x] Bootstrap Android (Retrofit + Auth header + wiring base) no skeleton

### Próximos passos prioritários
- [x] Adicionar desambiguação quando confiança de categoria ficar em faixa intermediária
- [x] Aplicar políticas RLS específicas das tabelas `assistant_*` (migration criada: `MIGRATION_ASSISTANT_RLS.sql`)
- [ ] Integrar o skeleton `android-skeleton/` ao app Android real (SpeechRecognizer/Gemini + TTS + sessão)

## Decisões de produto já definidas
- Canal inicial: Android com Gemini/Assistant.
- Interação: voz (entrada e confirmação).
- Escritas sempre exigem confirmação de valor por voz (sem faixa de corte).
- O assistente deve inferir automaticamente categoria (despesa/renda) a partir do texto falado.

---

## Arquitetura de referência

### 1) Android Voice Bridge
- Recebe intenção de voz do usuário.
- Encaminha texto para backend do assistente.
- Lê em voz alta resumo/confirmação/resposta final.

### 2) Backend Orquestrador (Gemini)
- Interpreta intenção em formato estruturado (JSON).
- Resolve categoria automaticamente.
- Retorna ação proposta para confirmação.

### 3) Backend Executor
- Após confirmação de voz, grava no Supabase.
- Garante idempotência e auditoria de comando.

### 4) Supabase
- Persiste comandos, confirmação e sessão conversacional.
- Persiste transações finais em expenses/incomes/investments.

---

## Regras funcionais do assistente

### Ações do MVP
- add_expense
- add_income
- add_investment
- get_month_balance
- list_recent_transactions
- update_transaction
- delete_transaction
- create_category
- monthly_insights

### Fluxo obrigatório para ações de escrita
1. Parse de intenção + campos obrigatórios.
2. Inferência de categoria.
3. Resumo falado: "Confirma despesa de R$ X em CATEGORIA, data Y?"
4. Usuário confirma por voz.
5. Persistência.
6. Resposta final falada.

### Política de confirmação
- Toda ação de escrita exige confirmação explícita.
- Confirmação expira (ex.: 2 minutos) para evitar execução tardia.

---

## Inferência automática de categoria (requisito crítico)

### Estratégia híbrida recomendada
1. **Heurística direta por dicionário de termos**
   - Ex.: "mercado", "farmácia", "uber", "almoço", "energia".
2. **Similaridade semântica com nomes de categorias do usuário**
   - Embeddings ou comparação textual robusta.
3. **Fallback Gemini com contexto de categorias existentes**
   - Gemini escolhe categoria mais provável com score de confiança.

### Regras de decisão
- Se confiança >= 0.80: aloca automaticamente.
- Se 0.50 <= confiança < 0.80: pede desambiguação por voz.
- Se confiança < 0.50: usa "Sem categoria" e avisa no resumo de confirmação.

### Aprendizado de preferência (opcional recomendado)
- Salvar mapeamentos aceitos pelo usuário:
  - "padaria" -> "Alimentação"
  - "99" -> "Transporte"
- Reaplicar preferências nas próximas inferências.

---

## Contratos de API (propostos)

## POST /assistant/interpret
Entrada:
```json
{
  "sessionId": "string",
  "deviceId": "string",
  "locale": "pt-BR",
  "text": "adicionar despesa de 45 almoço"
}
```

Saída:
```json
{
  "intent": "add_expense",
  "confidence": 0.92,
  "slots": {
    "amount": 45,
    "description": "almoço",
    "date": "2026-02-28",
    "category": {
      "id": "uuid-opcional",
      "name": "Alimentação",
      "confidence": 0.88
    }
  },
  "requiresConfirmation": true,
  "confirmationText": "Confirma despesa de R$45,00 em Alimentação hoje?"
}
```

## POST /assistant/confirm
Entrada:
```json
{
  "sessionId": "string",
  "commandId": "uuid",
  "confirmed": true,
  "spokenText": "confirmar"
}
```

Saída:
```json
{
  "status": "executed",
  "message": "Despesa adicionada com sucesso."
}
```

## GET /assistant/insights?month=YYYY-MM
Saída:
```json
{
  "month": "2026-02",
  "highlights": [
    "Alimentação subiu 18% vs mês anterior.",
    "Transporte ultrapassou limite em R$ 120,00."
  ],
  "recommendations": [
    "Defina teto de R$ 900 para Alimentação.",
    "Concentre corridas em dias úteis para reduzir custo médio."
  ]
}
```

---

## Roadmap técnico (execução)

## Fase 1 — Backend base
- Criar endpoints interpret/confirm/execute/insights.
- Integrar Gemini para parse estruturado.
- Implementar confirmação obrigatória.
- Implementar inferência de categoria (heurística + fallback).

Critérios de aceite:
- Comandos de escrita não executam sem confirmação.
- Categoria é sugerida corretamente em pelo menos 80% dos casos comuns.

## Fase 2 — Android bridge
- Implementar entrada de voz + TTS.
- Integrar fluxo com endpoints.
- Tratar timeout de confirmação e cancelamento.

Critérios de aceite:
- Fluxo completo por voz sem uso manual de tela.

## Fase 3 — Insights mensais
- Motor de insights com regras + Gemini.
- Endpoint de insight e resposta de voz.

Critérios de aceite:
- Entrega 3–5 insights úteis por mês com linguagem natural.

## Fase 4 — Robustez/produção
- Idempotência por command hash.
- Rate limit por device/session.
- Logs e trilha de auditoria.
- Alertas operacionais.

---

## Testes recomendados
- Testes de intenção: frases curtas, longas e ambíguas.
- Testes de categoria: termos informais e gírias.
- Testes de confirmação: confirmar, negar, repetir, silêncio.
- Testes de segurança: replay, comando duplicado, sessão expirada.

---

## Riscos e mitigação
- Ambiguidade de voz: confirmar sempre com resumo explícito.
- Erro de categoria: usar score + fallback + aprendizagem do usuário.
- Mudanças no Assistant/Gemini Android: isolar integração no bridge e manter API interna estável.

---

## Backlog inicial (tickets)
1. Criar schema de comandos/sessões/confirmações.
2. Implementar endpoint /assistant/interpret.
3. Implementar inferência de categoria com score.
4. Implementar endpoint /assistant/confirm e execução transacional.
5. Implementar endpoint /assistant/insights.
6. Implementar bridge Android (voz in/out).
7. Implementar observabilidade e auditoria.
8. Testes E2E de comandos por voz.
