package com.minhasfinancas.voice

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch

data class VoiceUiState(
    val processing: Boolean = false,
    val lastSpokenText: String = "",
    val errorMessage: String? = null,
)

class AssistantVoiceViewModel(
    private val orchestrator: VoiceOrchestrator,
) : ViewModel() {

    private val _uiState = MutableStateFlow(VoiceUiState())
    val uiState: StateFlow<VoiceUiState> = _uiState.asStateFlow()

    fun handleVoiceCommand(text: String) {
        if (text.isBlank()) return

        viewModelScope.launch {
            _uiState.value = _uiState.value.copy(processing = true, errorMessage = null)
            try {
                orchestrator.runSingleTurn(text)
                _uiState.value = _uiState.value.copy(
                    processing = false,
                    lastSpokenText = "Comando processado",
                )
            } catch (error: Throwable) {
                _uiState.value = _uiState.value.copy(
                    processing = false,
                    errorMessage = error.message ?: "Falha no fluxo de voz",
                )
            }
        }
    }

    fun requestInsights(month: String? = null) {
        viewModelScope.launch {
            _uiState.value = _uiState.value.copy(processing = true, errorMessage = null)
            try {
                orchestrator.runInsights(month)
                _uiState.value = _uiState.value.copy(
                    processing = false,
                    lastSpokenText = "Insights reproduzidos",
                )
            } catch (error: Throwable) {
                _uiState.value = _uiState.value.copy(
                    processing = false,
                    errorMessage = error.message ?: "Falha ao gerar insights por voz",
                )
            }
        }
    }
}
