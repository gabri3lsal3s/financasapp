package com.minhasfinancas.assistant

import com.minhasfinancas.voice.VoiceOrchestrator

object AndroidBridgeBootstrap {

    fun createRepository(
        baseUrl: String,
        tokenProvider: AccessTokenProvider,
        deviceIdProvider: () -> String,
    ): AssistantBridgeRepository {
        val api = AndroidBridgeClientFactory.createApi(
            baseUrl = baseUrl,
            tokenProvider = tokenProvider,
            enableHttpLog = true,
        )

        return AssistantBridgeRepository(
            api = api,
            deviceIdProvider = deviceIdProvider,
        )
    }

    fun createVoiceOrchestrator(
        repository: AssistantBridgeRepository,
        speechInput: com.minhasfinancas.voice.SpeechInput,
        speechOutput: com.minhasfinancas.voice.SpeechOutput,
    ): VoiceOrchestrator {
        return VoiceOrchestrator(
            repository = repository,
            speechInput = speechInput,
            speechOutput = speechOutput,
        )
    }
}
