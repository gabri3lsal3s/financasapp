# Android Skeleton (Gemini Voice Bridge)

Este diretório contém um esqueleto Kotlin para integração Android nativa com o endpoint `assistant-bridge`.

## Conteúdo
- `assistant/BridgeModels.kt`: modelos request/response do contrato.
- `assistant/AssistantBridgeApi.kt`: interface Retrofit.
- `assistant/AssistantBridgeRepository.kt`: wrapper de chamadas de turno.
- `assistant/AndroidBridgeClientFactory.kt`: cliente Retrofit com header Authorization.
- `assistant/AndroidBridgeBootstrap.kt`: criação de repository/orchestrator.
- `assistant/SupabaseSessionTokenProvider.kt`: provider de access token.
- `voice/VoiceOrchestrator.kt`: fluxo de interpretação + confirmação + TTS.
- `voice/AssistantVoiceViewModel.kt`: ViewModel simplificado para UI Compose.
- `voice/AndroidSpeechInput.kt`: implementação real de SpeechRecognizer.
- `voice/AndroidTtsOutput.kt`: implementação real de TextToSpeech.
- `voice/AssistantVoiceScreen.kt`: tela Compose de exemplo.

## Como plugar no app Android real
### 0) Copiar classes para o projeto Android real
Copie para o seu app Android:
- pasta `assistant/`
- pasta `voice/`
- conteúdo de `MainActivity.kt.example` para sua Activity (ou adapte na Navigation)

1. Configurar Retrofit com base URL do Supabase (`https://<project-ref>.supabase.co/`).
2. Adicionar interceptor de `Authorization: Bearer <access_token>` do usuário logado.
3. Implementar `SpeechInput` com Android SpeechRecognizer ou Gemini voice input.
4. Implementar `SpeechOutput` com Android TextToSpeech.
5. Injetar `AssistantBridgeApi -> Repository -> VoiceOrchestrator -> ViewModel`.

### Permissões AndroidManifest
Adicionar no `AndroidManifest.xml` (ou use `AndroidManifest.xml.example`):

```xml
<uses-permission android:name="android.permission.RECORD_AUDIO" />
<uses-permission android:name="android.permission.INTERNET" />
```

### Leitura real do access token
No `SupabaseSessionTokenProvider`, conecte uma fonte de sessão real do seu app:

```kotlin
val tokenProvider = SupabaseSessionTokenProvider(
	sessionSource = LambdaSessionSource {
		// Exemplo (supabase-kt): supabaseClient.auth.currentSessionOrNull()?.accessToken
		currentSession?.accessToken
	},
)
```

Você pode implementar `SupabaseAuthSessionSource` com qualquer mecanismo de sessão que já usa no app.

### Wiring mínimo (exemplo)
```kotlin
val tokenProvider = SupabaseSessionTokenProvider {
	// retornar access token da sessão atual do usuário
	currentSession?.accessToken
}

val repository = AndroidBridgeBootstrap.createRepository(
	baseUrl = "https://<PROJECT_REF>.supabase.co/",
	tokenProvider = tokenProvider,
	deviceIdProvider = { "android-${Build.MODEL}" },
)

val speechInput = AndroidSpeechInput(context)
val speechOutput = AndroidTtsOutput(context)

val orchestrator = AndroidBridgeBootstrap.createVoiceOrchestrator(
	repository = repository,
	speechInput = speechInput,
	speechOutput = speechOutput,
)
```

### Conectar na Activity/Navigation
- Exemplo pronto em `MainActivity.kt.example`.
- Se usar Navigation Compose, chame `AssistantVoiceScreen(viewModel)` na sua rota.

### Teste em dispositivo
1. Abrir tela do assistente por voz.
2. Falar: "Adicione uma despesa de almoço 10,40".
3. Confirmar por voz: "confirmar".
4. Validar retorno falado de sucesso.
5. Testar "Pedir insights".

## Dependências esperadas
- Kotlin Serialization
- Retrofit + converter kotlinx.serialization (ou Moshi/Gson)
- AndroidX Lifecycle ViewModel
- Coroutines
