const ASSISTANT_VOICE_KEY = 'assistant-sensitive-voice-key'

const canUseStorage = () => typeof window !== 'undefined' && typeof window.localStorage !== 'undefined'

const getVoiceKey = () => {
  if (!canUseStorage()) return 'assistant-default-key'

  let key = window.localStorage.getItem(ASSISTANT_VOICE_KEY)
  if (!key) {
    key = `${Date.now()}-${Math.random().toString(36).slice(2, 12)}`
    window.localStorage.setItem(ASSISTANT_VOICE_KEY, key)
  }

  return key
}

const xorBytes = (input: string, key: string) => {
  const result: number[] = []

  for (let index = 0; index < input.length; index += 1) {
    const keyCode = key.charCodeAt(index % key.length)
    result.push(input.charCodeAt(index) ^ keyCode)
  }

  return String.fromCharCode(...result)
}

export const protectVoiceText = (text?: string) => {
  const value = text?.trim()
  if (!value) return undefined

  try {
    const payload = encodeURIComponent(value)
    const cipher = xorBytes(payload, getVoiceKey())
    return `v1:${btoa(cipher)}`
  } catch {
    return undefined
  }
}

export const unprotectVoiceText = (encoded?: string) => {
  if (!encoded) return undefined
  if (!encoded.startsWith('v1:')) return undefined

  try {
    const cipher = atob(encoded.slice(3))
    const payload = xorBytes(cipher, getVoiceKey())
    return decodeURIComponent(payload)
  } catch {
    return undefined
  }
}
