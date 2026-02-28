package com.minhasfinancas.assistant

import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable

@Serializable
data class AssistantBridgeTurnRequest(
    @SerialName("turnType") val turnType: String,
    @SerialName("deviceId") val deviceId: String,
    @SerialName("locale") val locale: String? = "pt-BR",
    @SerialName("text") val text: String? = null,
    @SerialName("commandId") val commandId: String? = null,
    @SerialName("confirmed") val confirmed: Boolean? = null,
    @SerialName("spokenText") val spokenText: String? = null,
    @SerialName("month") val month: String? = null,
)

@Serializable
data class AssistantBridgeOptionItem(
    @SerialName("id") val id: String? = null,
    @SerialName("name") val name: String,
    @SerialName("confidence") val confidence: Double? = null,
)

@Serializable
data class AssistantBridgeTurnResponse(
    @SerialName("status") val status: String,
    @SerialName("requiresConfirmation") val requiresConfirmation: Boolean,
    @SerialName("speakText") val speakText: String,
    @SerialName("commandId") val commandId: String? = null,
    @SerialName("intent") val intent: String? = null,
    @SerialName("options") val options: List<AssistantBridgeOptionItem> = emptyList(),
) {
    val isError: Boolean get() = status.equals("error", ignoreCase = true)
}
