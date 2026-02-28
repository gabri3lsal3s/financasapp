package com.minhasfinancas.assistant

import retrofit2.http.Body
import retrofit2.http.POST

interface AssistantBridgeApi {
    @POST("functions/v1/assistant-bridge")
    suspend fun processTurn(
        @Body request: AssistantBridgeTurnRequest,
    ): AssistantBridgeTurnResponse
}
