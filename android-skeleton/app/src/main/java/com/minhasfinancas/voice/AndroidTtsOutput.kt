package com.minhasfinancas.voice

import android.content.Context
import android.speech.tts.TextToSpeech
import kotlinx.coroutines.suspendCancellableCoroutine
import java.util.Locale
import kotlin.coroutines.resume

class AndroidTtsOutput(
    context: Context,
    locale: Locale = Locale("pt", "BR"),
) : SpeechOutput {

    private val tts: TextToSpeech

    init {
        tts = TextToSpeech(context.applicationContext) { status ->
            if (status == TextToSpeech.SUCCESS) {
                tts.language = locale
            }
        }
    }

    override suspend fun speak(text: String) {
        if (text.isBlank()) return

        suspendCancellableCoroutine { continuation ->
            val utteranceId = "assistant-${System.currentTimeMillis()}"

            tts.setOnUtteranceProgressListener(object : android.speech.tts.UtteranceProgressListener() {
                override fun onStart(utteranceId: String?) = Unit

                override fun onDone(utteranceId: String?) {
                    if (continuation.isActive) continuation.resume(Unit)
                }

                @Deprecated("Deprecated in Java")
                override fun onError(utteranceId: String?) {
                    if (continuation.isActive) continuation.resume(Unit)
                }
            })

            tts.speak(text, TextToSpeech.QUEUE_FLUSH, null, utteranceId)

            continuation.invokeOnCancellation {
                tts.stop()
            }
        }
    }

    fun release() {
        tts.stop()
        tts.shutdown()
    }
}
