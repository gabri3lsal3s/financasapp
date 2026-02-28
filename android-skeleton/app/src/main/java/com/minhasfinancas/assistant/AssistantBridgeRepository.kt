package com.minhasfinancas.assistant

class AssistantBridgeRepository(
    private val api: AssistantBridgeApi,
    private val deviceIdProvider: () -> String,
) {
    suspend fun interpret(text: String, locale: String = "pt-BR"): AssistantBridgeTurnResponse {
        return api.processTurn(
            AssistantBridgeTurnRequest(
                turnType = "interpret",
                deviceId = deviceIdProvider(),
                locale = locale,
                text = text,
            ),
        )
    }

    suspend fun confirm(commandId: String, confirmed: Boolean, spokenText: String): AssistantBridgeTurnResponse {
        return api.processTurn(
            AssistantBridgeTurnRequest(
                turnType = "confirm",
                deviceId = deviceIdProvider(),
                commandId = commandId,
                confirmed = confirmed,
                spokenText = spokenText,
            ),
        )
    }

    suspend fun insights(month: String? = null): AssistantBridgeTurnResponse {
        return api.processTurn(
            AssistantBridgeTurnRequest(
                turnType = "insights",
                deviceId = deviceIdProvider(),
                month = month,
            ),
        )
    }
}
