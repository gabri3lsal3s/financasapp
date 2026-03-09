import { GoogleGenAI } from '@google/genai'

export const createGenAIClient = () => {
  const apiKey = import.meta.env.VITE_GEMINI_API_KEY
  // If the key is missing, we return null to let the caller handle it.
  if (!apiKey) {
    return null
  }
  return new GoogleGenAI({ apiKey })
}

// O modelo que melhor balanceia velocidade de extração, inteligência e custo (free-tier generoso)
export const GEMINI_MODEL = 'gemini-2.5-flash'
