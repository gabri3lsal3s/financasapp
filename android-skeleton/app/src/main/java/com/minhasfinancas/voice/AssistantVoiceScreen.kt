package com.minhasfinancas.voice

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.Button
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp

@Composable
fun AssistantVoiceScreen(
    viewModel: AssistantVoiceViewModel,
) {
    val state by viewModel.uiState.collectAsState()
    var commandText by remember { mutableStateOf("") }

    Column(
        modifier = Modifier
            .fillMaxSize()
            .padding(16.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp),
    ) {
        Text(
            text = "Assistente por Voz",
            style = MaterialTheme.typography.headlineSmall,
        )

        OutlinedTextField(
            modifier = Modifier.fillMaxWidth(),
            value = commandText,
            onValueChange = { commandText = it },
            label = { Text("Comando inicial") },
            placeholder = { Text("Ex.: Adicione uma despesa de almoço 10,40") },
        )

        Button(
            onClick = { viewModel.handleVoiceCommand(commandText) },
            enabled = !state.processing && commandText.isNotBlank(),
        ) {
            Text(if (state.processing) "Processando..." else "Executar fluxo de voz")
        }

        Button(
            onClick = { viewModel.requestInsights() },
            enabled = !state.processing,
        ) {
            Text("Pedir insights")
        }

        if (state.lastSpokenText.isNotBlank()) {
            Text("Status: ${state.lastSpokenText}")
        }

        state.errorMessage?.let { error ->
            Text(
                text = "Erro: $error",
                color = MaterialTheme.colorScheme.error,
            )
        }
    }
}
