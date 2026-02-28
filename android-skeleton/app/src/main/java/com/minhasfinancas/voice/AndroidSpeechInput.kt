package com.minhasfinancas.voice

import android.content.Context
import android.content.Intent
import android.os.Bundle
import android.speech.RecognitionListener
import android.speech.RecognizerIntent
import android.speech.SpeechRecognizer
import kotlinx.coroutines.suspendCancellableCoroutine
import kotlin.coroutines.resume
import kotlin.coroutines.resumeWithException

class AndroidSpeechInput(
    private val context: Context,
    private val localeTag: String = "pt-BR",
) : SpeechInput {

    override suspend fun listen(prompt: String?): String {
        if (!SpeechRecognizer.isRecognitionAvailable(context)) {
            throw IllegalStateException("SpeechRecognizer não disponível no dispositivo")
        }

        return suspendCancellableCoroutine { continuation ->
            val recognizer = SpeechRecognizer.createSpeechRecognizer(context)
            val intent = Intent(RecognizerIntent.ACTION_RECOGNIZE_SPEECH).apply {
                putExtra(RecognizerIntent.EXTRA_LANGUAGE_MODEL, RecognizerIntent.LANGUAGE_MODEL_FREE_FORM)
                putExtra(RecognizerIntent.EXTRA_LANGUAGE, localeTag)
                putExtra(RecognizerIntent.EXTRA_LANGUAGE_PREFERENCE, localeTag)
                putExtra(RecognizerIntent.EXTRA_PARTIAL_RESULTS, false)
                putExtra(RecognizerIntent.EXTRA_PROMPT, prompt ?: "Fale agora")
                putExtra(RecognizerIntent.EXTRA_MAX_RESULTS, 1)
            }

            recognizer.setRecognitionListener(object : RecognitionListener {
                override fun onReadyForSpeech(params: Bundle?) = Unit
                override fun onBeginningOfSpeech() = Unit
                override fun onRmsChanged(rmsdB: Float) = Unit
                override fun onBufferReceived(buffer: ByteArray?) = Unit
                override fun onEndOfSpeech() = Unit
                override fun onPartialResults(partialResults: Bundle?) = Unit
                override fun onEvent(eventType: Int, params: Bundle?) = Unit

                override fun onResults(results: Bundle?) {
                    val matches = results?.getStringArrayList(SpeechRecognizer.RESULTS_RECOGNITION)
                    val spoken = matches?.firstOrNull()?.trim().orEmpty()
                    if (spoken.isBlank()) {
                        if (continuation.isActive) {
                            continuation.resumeWithException(IllegalStateException("Nenhuma fala reconhecida"))
                        }
                    } else {
                        if (continuation.isActive) continuation.resume(spoken)
                    }
                    recognizer.destroy()
                }

                override fun onError(error: Int) {
                    if (continuation.isActive) {
                        continuation.resumeWithException(IllegalStateException("Erro no reconhecimento de voz: $error"))
                    }
                    recognizer.destroy()
                }
            })

            continuation.invokeOnCancellation {
                recognizer.cancel()
                recognizer.destroy()
            }

            recognizer.startListening(intent)
        }
    }
}
