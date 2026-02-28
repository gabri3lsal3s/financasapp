package com.minhasfinancas.voice

import com.minhasfinancas.assistant.AssistantBridgeRepository
import com.minhasfinancas.assistant.AssistantBridgeTurnResponse

interface SpeechInput {
    suspend fun listen(prompt: String? = null): String
}

interface SpeechOutput {
    suspend fun speak(text: String)
}

class VoiceOrchestrator(
    private val repository: AssistantBridgeRepository,
    private val speechInput: SpeechInput,
    private val speechOutput: SpeechOutput,
) {
    suspend fun runSingleTurn(initialText: String) {
        val interpretation = repository.interpret(initialText)
        speechOutput.speak(interpretation.speakText)

        if (!interpretation.requiresConfirmation) return

        val confirmationSpeech = speechInput.listen(prompt = "Confirme por voz")
        val confirmation = resolveConfirmation(interpretation, confirmationSpeech)

        val result = repository.confirm(
            commandId = interpretation.commandId.orEmpty(),
            confirmed = confirmation,
            spokenText = confirmationSpeech,
        )

        speechOutput.speak(result.speakText)
    }

    suspend fun runInsights(month: String? = null) {
        val insights = repository.insights(month)
        speechOutput.speak(insights.speakText)
    }

    private fun resolveConfirmation(
        interpretation: AssistantBridgeTurnResponse,
        spokenText: String,
    ): Boolean {
        val normalized = spokenText.trim().lowercase()

        if (interpretation.options.isNotEmpty()) {
            return interpretation.options.any { option ->
                normalized.contains(option.name.lowercase())
            }
        }

        return normalized.contains("sim")
            || normalized.contains("confirmar")
            || normalized.contains("ok")
    }
}
