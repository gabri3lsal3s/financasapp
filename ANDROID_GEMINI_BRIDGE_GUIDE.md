# Android Gemini Bridge Guide

## Status atual (resumo)
- O núcleo do assistente no app web já está pronto (interpretação, confirmação, execução e insights).
- O contrato do bridge já existe no frontend:
  - `src/types/assistantBridge.ts`
  - `src/services/assistantBridge.ts`
- Endpoint HTTP do bridge já criado via Supabase Edge Function:
  - `supabase/functions/assistant-bridge/index.ts`
- A integração **nativa Android** (captura de voz + TTS + consumo desse endpoint) ainda precisa ser implementada no projeto Android.

---

## Endpoint para consumo no Android

### URL
- `POST https://<PROJECT_REF>.supabase.co/functions/v1/assistant-bridge`

### Headers
- `Authorization: Bearer <SUPABASE_ACCESS_TOKEN_DO_USUÁRIO>`
- `Content-Type: application/json`

### Deploy da função
```bash
supabase functions deploy assistant-bridge
```

### Smoke test rápido do endpoint
```bash
ASSISTANT_BRIDGE_URL="https://<PROJECT_REF>.supabase.co/functions/v1/assistant-bridge" \
ASSISTANT_ACCESS_TOKEN="<ACCESS_TOKEN_DO_USUÁRIO_LOGADO>" \
node scripts/assistant-bridge-smoke.mjs
```

Script disponível em:
- `scripts/assistant-bridge-smoke.mjs`

### Secrets da função (obrigatório)
No projeto Supabase, configure:
- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`

Exemplo:
```bash
supabase secrets set SUPABASE_URL="https://<PROJECT_REF>.supabase.co"
supabase secrets set SUPABASE_ANON_KEY="<ANON_KEY>"
```

---

## Como proceder para funcionar perfeitamente

### Etapa 1 — Banco e segurança
1. Execute `MIGRATION_ASSISTANT.sql` no Supabase SQL Editor.
2. Execute `MIGRATION_ASSISTANT_RLS.sql` no Supabase SQL Editor.
3. Confirme que as tabelas `assistant_*` existem e que o usuário autenticado consegue inserir registros.

### Etapa 2 — Deploy do endpoint
1. Faça deploy da função `assistant-bridge`.
2. Garanta que o token enviado no header `Authorization` seja do usuário logado (não use chave service role no app).
3. Valide com um POST manual (Postman/Insomnia) para `turnType = interpret`.

### Etapa 3 — Integração Android (cliente HTTP)
Use o skeleton em `android-skeleton/`:
- `app/build.gradle.kts.example`
- `assistant/AndroidBridgeClientFactory.kt`
- `assistant/AssistantBridgeRepository.kt`
- `voice/VoiceOrchestrator.kt`

Passos:
1. Copie as classes para seu projeto Android.
2. Ajuste `baseUrl` para `https://<PROJECT_REF>.supabase.co/`.
3. Implemente `AccessTokenProvider` lendo a sessão autenticada do Supabase no Android.
4. Inicie o `VoiceOrchestrator` na sua camada de UI.

### Etapa 4 — Voz (STT/TTS)
1. Implemente `SpeechInput.listen()` com SpeechRecognizer ou Gemini input.
2. Implemente `SpeechOutput.speak()` com Android TextToSpeech.
3. Fluxo mínimo:
  - capturar voz
  - `interpret`
  - reproduzir `speakText`
  - se `requiresConfirmation`, capturar nova voz
  - `confirm`
  - reproduzir resposta final

### Etapa 5 — Testes de aceitação
Teste os cenários abaixo no Android real:
1. `add_expense` com confirmação por voz.
2. Desambiguação de categoria (quando o assistente pedir categoria).
3. `delete_transaction` com confirmação.
4. `create_category` para despesa e renda.
5. `insights` sem confirmação.

### Etapa 6 — Checklist de produção
- Usuário autenticado antes de qualquer turno.
- Timeout/retry em falhas de rede.
- Logs de erro por turno (interpret/confirm/insights).
- Tratamento de comando cancelado (`confirmed = false`).
- Mensagem de fallback quando STT não entender a fala.

---

## Troubleshooting rápido
- `401 Unauthorized`: token ausente/inválido no header `Authorization`.
- `RLS blocked`: `user_id` não preenchido ou sessão/token não corresponde ao usuário.
- `Comando não encontrado`: `commandId` expirado/errado na etapa de confirmação.
- `Intenção de escrita ainda não suportada`: endpoint ainda não cobre aquele intent específico.

---

## Contrato de integração já disponível

### Request (`AssistantBridgeTurnRequest`)
```ts
{
  turnType: 'interpret' | 'confirm' | 'insights',
  deviceId: string,
  locale?: string,
  text?: string,
  commandId?: string,
  confirmed?: boolean,
  spokenText?: string,
  month?: string,
}
```

### Response (`AssistantBridgeTurnResponse`)
```ts
{
  status: 'ok' | 'error',
  requiresConfirmation: boolean,
  speakText: string,
  commandId?: string,
  intent?: string,
  options?: Array<{ id?: string; name: string; confidence?: number }>,
  payload?: Record<string, unknown>,
  error?: string,
}
```

---

## Fluxo recomendado no Android

### 1) Captura de voz
- Receber texto do usuário via Gemini/Assistant ou SpeechRecognizer.
- Enviar o texto para o turno `interpret`.

### 2) Interpretação
- Chamar `processAssistantBridgeTurn({ turnType: 'interpret', ... })`.
- Ler `speakText` em TTS.
- Se `requiresConfirmation = true`, entrar no modo de confirmação.

### 3) Confirmação por voz
- Capturar confirmação falada (`confirmar`, `sim`, ou nome da categoria em caso de desambiguação).
- Chamar `processAssistantBridgeTurn({ turnType: 'confirm', commandId, confirmed, spokenText })`.
- Ler `speakText` final em TTS.

### 4) Insights (sem escrita)
- Chamar `processAssistantBridgeTurn({ turnType: 'insights', month })`.
- Ler `speakText` em TTS.

---

## Exemplo de sequência ponta a ponta

### Turno 1 (interpret)
Entrada:
```json
{
  "turnType": "interpret",
  "deviceId": "android-pixel-01",
  "locale": "pt-BR",
  "text": "Adicione uma despesa de almoço 10,40"
}
```

Saída esperada:
```json
{
  "status": "ok",
  "requiresConfirmation": true,
  "speakText": "Confirma despesa de R$10.40 em Alimentação na data 2026-02-28?",
  "commandId": "..."
}
```

### Turno 2 (confirm)
Entrada:
```json
{
  "turnType": "confirm",
  "deviceId": "android-pixel-01",
  "commandId": "...",
  "confirmed": true,
  "spokenText": "confirmar"
}
```

Saída esperada:
```json
{
  "status": "ok",
  "requiresConfirmation": false,
  "speakText": "Despesa adicionada com sucesso."
}
```

---

## Requisitos para funcionar em produção
- Usuário autenticado (devido ao RLS nas tabelas `assistant_*`).
- Migration de segurança aplicada:
  - `MIGRATION_ASSISTANT_RLS.sql`
- App Android chamando este contrato em uma camada de integração (API/BFF/Edge Function).

---

## Próximos passos técnicos (Android)
1. Criar módulo Android `VoiceOrchestrator` com estados (`idle`, `listening`, `awaiting_confirmation`, `speaking`).
2. Integrar STT (entrada de voz) e TTS (resposta do `speakText`).
3. Implementar cliente HTTP para enviar turnos ao backend que expõe este contrato.
4. Tratar timeout/retry e cancelamento por voz (`cancelar`).
5. Adicionar telemetria básica de erro por turno.
