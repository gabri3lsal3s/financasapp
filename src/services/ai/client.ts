import { GoogleGenAI } from '@google/genai'

export const createGenAIClient = () => {
  const apiKey = import.meta.env.VITE_GEMINI_API_KEY
  if (!apiKey || apiKey === 'sua_chave_gemini_aqui') {
    throw new Error('Chave da API do Google Gemini não configurada.')
  }
  return new GoogleGenAI({ apiKey })
}

// O modelo que melhor balanceia velocidade de extração, inteligência e custo (free-tier generoso)
export const GEMINI_MODEL = 'gemini-1.5-flash'
