import { describe, it, expect } from 'vitest'
import { calculateSunriseSunset } from './solar'

describe('calculateSunriseSunset', () => {
  it('correctly calcula o nascer e pôr do sol em São Paulo (Hemisfério Sul)', () => {
    // São Paulo, Brasil: lat -23.55, lng -46.63
    const lat = -23.55
    const lng = -46.63
    const date = new Date(2026, 5, 15) // 15 de Junho de 2026
    
    const { sunrise, sunset } = calculateSunriseSunset(lat, lng, date)
    
    expect(sunrise).toBeInstanceOf(Date)
    expect(sunset).toBeInstanceOf(Date)
    
    // O fuso horário de São Paulo é UTC-3.
    // O nascer do sol deve ser por volta de 06:40 a 06:50 local (09:40 a 09:50 UTC).
    // O pôr do sol deve ser por volta de 17:20 a 17:35 local (20:20 a 20:35 UTC).
    
    if (sunrise && sunset) {
      // Como o objeto Date retornado é absoluto (UTC), vamos converter para horas UTC.
      // E testar os valores esperados.
      expect(sunrise.getUTCHours()).toBe(9) // 06:46 UTC-3 = 09:46 UTC
      expect(sunset.getUTCHours()).toBe(20) // 17:27 UTC-3 = 20:27 UTC
    }
  })

  it('correctly calcula o nascer e pôr do sol em Londres (Hemisfério Norte)', () => {
    // Londres, Reino Unido: lat 51.5074, lng -0.1278
    const lat = 51.5074
    const lng = -0.1278
    const date = new Date(2026, 5, 15) // 15 de Junho de 2026
    
    const { sunrise, sunset } = calculateSunriseSunset(lat, lng, date)
    
    expect(sunrise).toBeInstanceOf(Date)
    expect(sunset).toBeInstanceOf(Date)
    
    // Em Londres no dia 15 de junho, o nascer do sol é por volta das 04:40 (03:40 UTC) e o pôr do sol é por volta das 21:20 (20:20 UTC)
    if (sunrise && sunset) {
      expect(sunrise.getUTCHours()).toBe(3)
      expect(sunset.getUTCHours()).toBe(20)
    }
  })
})
