/**
 * Simplificação dos cálculos solares da NOAA para determinar os horários de nascer e pôr do sol.
 * latitude: Norte é positivo, Sul é negativo.
 * longitude: Leste é positivo, Oeste é negativo.
 */
export function calculateSunriseSunset(latitude: number, longitude: number, date: Date) {
  const year = date.getFullYear()
  const month = date.getMonth()
  const day = date.getDate()

  // 1. Calcular o dia do ano
  const start = new Date(year, 0, 0)
  const diff = date.getTime() - start.getTime()
  const oneDay = 1000 * 60 * 60 * 24
  const dayOfYear = Math.floor(diff / oneDay)

  // 2. Declinação solar
  const declination = 23.45 * Math.sin(((360 / 365) * (dayOfYear - 80) * Math.PI) / 180)

  // 3. Ângulo horário (quando o sol está no horizonte, altitude = -0.83 graus)
  const latRad = (latitude * Math.PI) / 180
  const declRad = (declination * Math.PI) / 180

  const cosHourAngle =
    (Math.sin((-0.833 * Math.PI) / 180) - Math.sin(latRad) * Math.sin(declRad)) /
    (Math.cos(latRad) * Math.cos(declRad))

  if (cosHourAngle > 1) {
    // Sol nunca nasce (noite polar)
    return { sunrise: null, sunset: null }
  }
  if (cosHourAngle < -1) {
    // Sol nunca se põe (dia polar)
    return { sunrise: null, sunset: null }
  }

  const hourAngle = (Math.acos(cosHourAngle) * 180) / Math.PI

  // 4. Equação do tempo (aproximação em minutos)
  const b = (((360 / 365) * (dayOfYear - 81)) * Math.PI) / 180
  const eqTime = 9.87 * Math.sin(2 * b) - 7.53 * Math.cos(b) - 1.5 * Math.sin(b)

  // 5. Meio-dia solar (UTC)
  // longitude é em graus. Leste é positivo, Oeste é negativo.
  // 4 minutos por grau. Portanto -longitude * 4 / 60 = -longitude / 15.
  const noonUTC = 12 - longitude / 15 - eqTime / 60

  // Nascer e pôr do sol em horas decimais UTC
  const sunriseUTC = noonUTC - hourAngle / 15
  const sunsetUTC = noonUTC + hourAngle / 15

  // Converter horas decimais UTC em objetos Date locais para o dia específico
  const localSunrise = new Date(Date.UTC(year, month, day))
  localSunrise.setUTCSeconds(Math.round(sunriseUTC * 3600))

  const localSunset = new Date(Date.UTC(year, month, day))
  localSunset.setUTCSeconds(Math.round(sunsetUTC * 3600))

  return { sunrise: localSunrise, sunset: localSunset }
}

export function formatCoordinate(value: number): string {
  return value.toFixed(4)
}
