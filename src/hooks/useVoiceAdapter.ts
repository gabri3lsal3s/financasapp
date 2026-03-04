import { useCallback, useMemo, useRef, useState } from 'react'

interface UseVoiceAdapterOptions {
  locale?: string
  checkOnline?: boolean
  networkErrorMessage?: string
  autoSpeakEnabled?: boolean
  speechRate?: 'slow' | 'normal' | 'fast'
  speechPitch?: 'low' | 'normal' | 'high'
}

export function useVoiceAdapter(options: UseVoiceAdapterOptions = {}) {
  const {
    locale = 'pt-BR',
    checkOnline = false,
    networkErrorMessage = 'Falha de rede no reconhecimento de voz. Use o modo de texto como alternativa.',
    autoSpeakEnabled = true,
    speechRate = 'normal',
    speechPitch = 'normal',
  } = options

  const [voiceStatus, setVoiceStatus] = useState('')
  const [voiceListening, setVoiceListening] = useState(false)
  const [voicePhase, setVoicePhase] = useState<'idle' | 'listening' | 'stopped'>('idle')
  const [lastHeardCommand, setLastHeardCommand] = useState('')
  const activeRecognitionRef = useRef<any | null>(null)

  const voiceSupport = useMemo(() => {
    if (typeof window === 'undefined') {
      return { recognition: false, synthesis: false }
    }

    const hasRecognition = Boolean((window as any).SpeechRecognition || (window as any).webkitSpeechRecognition)
    const hasSynthesis = Boolean(window.speechSynthesis)

    return {
      recognition: hasRecognition,
      synthesis: hasSynthesis,
    }
  }, [])

  const getSpeechRecognitionErrorMessage = useCallback((errorCode?: string) => {
    const code = (errorCode || '').toLowerCase()

    if (code === 'network') {
      return networkErrorMessage
    }

    if (code === 'not-allowed' || code === 'service-not-allowed') {
      return 'Permissão de microfone negada. Libere o microfone nas permissões do navegador.'
    }

    if (code === 'no-speech') {
      return 'Nenhuma fala detectada. Fale novamente após tocar no botão.'
    }

    if (code === 'audio-capture') {
      return 'Não foi possível acessar o microfone. Verifique se outro app está usando o áudio.'
    }

    if (code === 'aborted') {
      return 'Captura de voz interrompida. Tente novamente.'
    }

    return 'Erro ao capturar voz. Use o modo de texto como alternativa.'
  }, [networkErrorMessage])

  const clearVoiceFeedback = useCallback(() => {
    setVoiceStatus('')
    setVoicePhase('idle')
    setLastHeardCommand('')
  }, [])

  const stopActiveListening = useCallback(() => {
    if (!activeRecognitionRef.current) return
    setVoiceStatus('Finalizando escuta...')
    activeRecognitionRef.current.stop()
  }, [])

  const resolveVoiceConfirmation = useCallback((spokenText: string) => {
    const normalized = spokenText.trim().toLowerCase()
    if (!normalized) return true

    if (
      normalized.includes('não')
      || normalized.includes('nao')
      || normalized.includes('cancelar')
      || normalized.includes('negar')
    ) {
      return false
    }

    return true
  }, [])

  const speakText = useCallback(async (text: string) => {
    if (!autoSpeakEnabled || !voiceSupport.synthesis || !text.trim() || typeof window === 'undefined') return

    const rateMap: Record<'slow' | 'normal' | 'fast', number> = {
      slow: 0.9,
      normal: 1,
      fast: 1.1,
    }
    const pitchMap: Record<'low' | 'normal' | 'high', number> = {
      low: 0.9,
      normal: 1,
      high: 1.1,
    }

    window.speechSynthesis.cancel()
    const utterance = new SpeechSynthesisUtterance(text)
    utterance.lang = locale
    utterance.rate = rateMap[speechRate]
    utterance.pitch = pitchMap[speechPitch]
    window.speechSynthesis.speak(utterance)
  }, [autoSpeakEnabled, locale, speechPitch, speechRate, voiceSupport.synthesis])

  const stopSpeaking = useCallback(() => {
    if (typeof window === 'undefined' || !voiceSupport.synthesis) return
    window.speechSynthesis.cancel()
  }, [voiceSupport.synthesis])

  const captureSpeech = useCallback(async (prompt?: string): Promise<string> => {
    if (!voiceSupport.recognition) {
      throw new Error('Reconhecimento de voz não suportado neste navegador/dispositivo.')
    }

    if (typeof window !== 'undefined' && !window.isSecureContext) {
      throw new Error('Reconhecimento de voz requer contexto seguro (HTTPS ou localhost).')
    }

    if (checkOnline && typeof navigator !== 'undefined' && !navigator.onLine) {
      throw new Error('Você está offline. Conecte-se à internet para usar reconhecimento de voz.')
    }

    return new Promise((resolve, reject) => {
      if (typeof window !== 'undefined' && window.speechSynthesis) {
        window.speechSynthesis.cancel()
      }

      const RecognitionCtor = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
      const recognition = new RecognitionCtor()
      let isSettled = false
      let hasHeardSpeech = false
      let transcriptBuffer = ''
      let silenceTimer: ReturnType<typeof setTimeout> | null = null
      let initialSpeechTimer: ReturnType<typeof setTimeout> | null = null

      const scheduleSilenceStop = (delayMs: number) => {
        if (silenceTimer) clearTimeout(silenceTimer)
        silenceTimer = setTimeout(() => {
          if (!isSettled) {
            recognition.stop()
          }
        }, delayMs)
      }

      recognition.lang = locale
      recognition.interimResults = true
      recognition.maxAlternatives = 1
      recognition.continuous = false

      setVoiceStatus(prompt || 'Ouvindo...')
      setVoiceListening(true)
      setVoicePhase('listening')
      activeRecognitionRef.current = recognition

      initialSpeechTimer = setTimeout(() => {
        if (!isSettled) {
          setVoiceStatus('Não detectei sua voz ainda. Tente falar mais próximo ao microfone.')
          recognition.stop()
        }
      }, 7000)

      recognition.onspeechstart = () => {
        hasHeardSpeech = true
        if (initialSpeechTimer) {
          clearTimeout(initialSpeechTimer)
          initialSpeechTimer = null
        }
      }

      recognition.onresult = (event: any) => {
        const chunks: string[] = []

        for (let index = 0; index < (event.results?.length || 0); index += 1) {
          const result = event.results[index]
          const chunk = result?.[0]?.transcript?.trim()
          if (chunk) chunks.push(chunk)
        }

        const mergedTranscript = chunks.join(' ').replace(/\s+/g, ' ').trim()

        if (mergedTranscript) {
          hasHeardSpeech = true
          if (initialSpeechTimer) {
            clearTimeout(initialSpeechTimer)
            initialSpeechTimer = null
          }
          transcriptBuffer = mergedTranscript
          setVoiceStatus(`Escutando: ${transcriptBuffer}`)
          scheduleSilenceStop(2500)
        }
      }

      recognition.onspeechend = () => {
        if (!isSettled && hasHeardSpeech) {
          scheduleSilenceStop(1200)
        }
      }

      recognition.onerror = (event: any) => {
        if (isSettled) return
        isSettled = true
        if (silenceTimer) clearTimeout(silenceTimer)
        if (initialSpeechTimer) clearTimeout(initialSpeechTimer)
        setVoiceListening(false)
        setVoicePhase('stopped')
        activeRecognitionRef.current = null

        if (event?.error === 'no-speech') {
          const transcript = transcriptBuffer.trim()
          setLastHeardCommand(transcript)
          if (transcript) {
            setVoiceStatus(`Reconhecido: ${transcript}`)
            resolve(transcript)
            return
          }

          setVoiceStatus('Nenhuma fala detectada. Tente novamente falando logo após tocar no botão.')
          resolve('')
          return
        }

        const errorMessage = getSpeechRecognitionErrorMessage(event?.error)
        setVoiceStatus(errorMessage)
        reject(new Error(errorMessage))
      }

      recognition.onend = () => {
        if (isSettled) return
        isSettled = true
        if (silenceTimer) clearTimeout(silenceTimer)
        if (initialSpeechTimer) clearTimeout(initialSpeechTimer)
        setVoiceListening(false)
        setVoicePhase('stopped')
        activeRecognitionRef.current = null

        const transcript = transcriptBuffer.trim()
        setLastHeardCommand(transcript)
        setVoiceStatus(transcript ? `Reconhecido: ${transcript}` : 'Nenhuma fala reconhecida.')
        resolve(transcript)
      }

      recognition.start()
    })
  }, [checkOnline, getSpeechRecognitionErrorMessage, locale, voiceSupport.recognition])

  return {
    voiceSupport,
    voiceStatus,
    setVoiceStatus,
    voiceListening,
    voicePhase,
    lastHeardCommand,
    clearVoiceFeedback,
    captureSpeech,
    stopActiveListening,
    resolveVoiceConfirmation,
    speakText,
    stopSpeaking,
  }
}
